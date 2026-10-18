"""HTTP API for the Echo studio, plus the MCP server at /mcp."""

from __future__ import annotations

import base64
import contextlib
import json
import logging
import secrets
import time
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse
from starlette.concurrency import iterate_in_threadpool, run_in_threadpool

from . import embed, llm, scenarios
from .agent import Agent
from .config import settings
from .db import client, graph_name, list_workspaces, valid_workspace, wait_for_db
from .extract import extract_claims
from .fetch import FetchError, fetch
from .lineage import SourceDoc
from .mcp_server import current_workspace, mcp
from .memory import Claim, EchoMemory, slug

log = logging.getLogger("echo")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

TEMPLATE_VERSION = "3"
MAX_VISITOR_WORKSPACES = 150
VISITOR_TTL_S = 36 * 3600
KEPT_TTL_S = 30 * 24 * 3600  # memories someone actually built (added sources, imported, renamed)


def _template(scenario: str) -> str:
    return f"tpl-{scenario}"


def _meta(ws: str) -> dict:
    return EchoMemory(ws).db.one("MATCH (m:Meta {id:'workspace'}) RETURN m.scenario AS scenario, m.title AS title, "
                                 "m.version AS version, m.created AS created, m.keep AS keep, "
                                 "coalesce(m.min_origins, $d) AS min_origins", {"d": settings().verify_min_origins}, ro=True) or {}


def _keep(ws: str) -> None:
    """Someone is building this memory: keep it for longer than a demo clone."""
    with contextlib.suppress(Exception):
        EchoMemory(ws).db.q("MATCH (m:Meta {id:'workspace'}) SET m.keep=true")


def ensure_templates(force: bool = False) -> None:
    """Seed one template graph per scenario, plus a shared public copy (used by MCP clients)."""
    existing = set(list_workspaces())
    for sid in scenarios.SCENARIOS:
        tpl = _template(sid)
        if force or tpl not in existing or _meta(tpl).get("version") != TEMPLATE_VERSION:
            t0 = time.time()
            scenarios.seed(tpl, sid)
            EchoMemory(tpl).db.q("MATCH (m:Meta {id:'workspace'}) SET m.version=$v", {"v": TEMPLATE_VERSION})
            log.info("seeded template %s in %.1fs", tpl, time.time() - t0)
        if force or sid not in existing or _meta(sid).get("version") != TEMPLATE_VERSION:
            _copy(tpl, sid)


def _copy(src: str, dst: str) -> None:
    c = client()
    with contextlib.suppress(Exception):
        c.select_graph(graph_name(dst)).delete()
    try:
        c.connection.execute_command("GRAPH.COPY", graph_name(src), graph_name(dst))
    except Exception as e:  # managed instances without GRAPH.COPY: re-seed instead
        log.warning("GRAPH.COPY failed (%s); seeding %s directly", e, dst)
        scen = _meta(src).get("scenario")
        scenarios.seed(dst, scen)
        EchoMemory(dst).db.q("MATCH (m:Meta {id:'workspace'}) SET m.version=$v", {"v": TEMPLATE_VERSION})
    EchoMemory(dst).db.q("MATCH (m:Meta {id:'workspace'}) SET m.created=$t", {"t": int(time.time())})


def _gc_visitors() -> None:
    now = time.time()
    visitors = [w for w in list_workspaces() if "--" in w]
    aged = []
    for w in visitors:
        m = _meta(w)
        aged.append((m.get("created") or 0, w, bool(m.get("keep"))))
    aged.sort()
    for i, (created, w, keep) in enumerate(aged):
        if now - created > (KEPT_TTL_S if keep else VISITOR_TTL_S) or len(aged) - i > MAX_VISITOR_WORKSPACES:
            with contextlib.suppress(Exception):
                client().select_graph(graph_name(w)).delete()


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    await run_in_threadpool(wait_for_db)
    if settings().seed_on_start:
        await run_in_threadpool(ensure_templates)
    await run_in_threadpool(embed.embed_one, "warm up")
    async with mcp.session_manager.run():
        yield


app = FastAPI(title="Echo", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings().cors_origins.split(","), allow_methods=["*"],
                   allow_headers=["*"])

mcp_app = mcp.streamable_http_app(
    streamable_http_path="/", stateless_http=True,
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


class _ScopedMCP:
    """/mcp/?workspace=<id> points every tool at that memory by default."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        token = None
        if scope["type"] == "http":
            from urllib.parse import parse_qs

            ws = (parse_qs(scope.get("query_string", b"").decode()).get("workspace") or [""])[0]
            if ws and valid_workspace(ws) and not ws.startswith("tpl-"):
                token = current_workspace.set(ws)
        try:
            await self.inner(scope, receive, send)
        finally:
            if token is not None:
                current_workspace.reset(token)


app.mount("/mcp", _ScopedMCP(mcp_app))


def mem(ws: str) -> EchoMemory:
    if not valid_workspace(ws) or ws.startswith("tpl-"):
        raise HTTPException(404, "unknown workspace")
    return EchoMemory(ws)


# ---------------------------------------------------------------------- meta


@app.get("/api/health")
def health() -> dict[str, Any]:
    client().connection.ping()
    return {"ok": True, "falkordb": True, "llm": llm.available(), "llm_model": settings().llm_model if llm.available() else None,
            "embeddings": embed.backend()}


def llm_cfg(request: Request) -> llm.LLMConfig:
    try:
        return llm.from_headers(request.headers)
    except llm.ConfigError as e:
        raise HTTPException(400, str(e)) from e


@app.get("/api/llm/providers")
def llm_providers() -> dict:
    d = llm.default()
    return {"default": {"model": d.model, "available": llm.available(d), "label": "Echo default (free, via Groq)"},
            "providers": [{"id": k, **{x: v[x] for x in ("label", "base", "keys", "models")}} for k, v in llm.PROVIDERS.items()]}


@app.post("/api/llm/test")
def llm_test(request: Request) -> dict:
    return llm.test(llm_cfg(request))


@app.post("/api/llm/models")
def llm_models(request: Request) -> dict:
    try:
        return {"models": llm.list_models(llm_cfg(request))}
    except llm.ConfigError as e:
        raise HTTPException(400, str(e)) from e


@app.get("/api/scenarios")
def list_scenarios() -> list[dict]:
    return [scenarios.info(s) for s in scenarios.SCENARIOS]


class NewWorkspace(BaseModel):
    scenario: str | None = "halcyon"


@app.post("/api/workspaces")
def create_workspace(body: NewWorkspace) -> dict:
    """A private workspace for one visitor: its own FalkorDB graph, cloned from a scenario template."""
    _gc_visitors()
    scen = body.scenario if body.scenario in scenarios.SCENARIOS else None
    ws = f"{scen or 'blank'}--{secrets.token_hex(3)}"
    if scen:
        _copy(_template(scen), ws)
    else:
        m = EchoMemory(ws)
        m.init()
        m.db.q("MERGE (m:Meta {id:'workspace'}) SET m.scenario=null, m.title='Your memory', m.created=$t",
               {"t": int(time.time())})
    return {"workspace": ws, "scenario": scen}


@app.get("/api/w/{ws}")
def workspace(ws: str) -> dict:
    m = mem(ws)
    meta = _meta(ws)
    if not meta and ws not in list_workspaces():
        raise HTTPException(404, "unknown workspace")
    scen = meta.get("scenario")
    return {"workspace": ws, "meta": meta, "scenario": scenarios.info(scen) if scen in scenarios.SCENARIOS else None,
            "stats": m.stats()}


@app.post("/api/w/{ws}/reset")
def reset(ws: str) -> dict:
    meta = _meta(ws)
    scen = meta.get("scenario")
    if scen in scenarios.SCENARIOS:
        _copy(_template(scen), ws)
    else:
        mem(ws).reset()
    return {"ok": True}


class WorkspaceSettings(BaseModel):
    title: str | None = Field(default=None, max_length=80)
    min_origins: int | None = Field(default=None, ge=1, le=5)


@app.patch("/api/w/{ws}/settings")
def update_settings(ws: str, body: WorkspaceSettings) -> dict:
    m = mem(ws)
    out: dict[str, Any] = {"ok": True}
    if body.title is not None:
        m.db.q("MERGE (x:Meta {id:'workspace'}) SET x.title=$t", {"t": body.title.strip() or "Untitled memory"})
        _keep(ws)
    if body.min_origins is not None:
        t0 = time.time()
        out["rescored"] = m.set_policy(body.min_origins)
        out["ms"] = round((time.time() - t0) * 1000, 1)
    return out


@app.delete("/api/w/{ws}")
def delete_workspace(ws: str) -> dict:
    if "--" not in ws:
        raise HTTPException(403, "shared workspaces can't be deleted")
    mem(ws).drop()
    return {"ok": True}


@app.get("/api/w/{ws}/export")
def export_workspace(ws: str) -> dict:
    m = mem(ws)
    return {**m.export(), "title": _meta(ws).get("title") or ws, "exported_at": int(time.time())}


class ImportBody(BaseModel):
    format: str = "echo-memory/1"
    title: str = "Imported memory"
    min_origins: int | None = None
    sources: list[dict] = Field(max_length=400)


@app.post("/api/workspaces/import")
def import_workspace(body: ImportBody) -> dict:
    """Rebuild a memory from an export: sources in their original order, with their claims, then retractions."""
    if not body.format.startswith("echo-memory/"):
        raise HTTPException(400, "not an Echo memory export")
    _gc_visitors()
    ws = f"blank--{secrets.token_hex(3)}"
    m = EchoMemory(ws)
    m.init()
    m.db.q("MERGE (x:Meta {id:'workspace'}) SET x.scenario=null, x.title=$t, x.created=$c, x.keep=true, x.min_origins=$n",
           {"t": body.title[:80], "c": int(time.time()), "n": body.min_origins or settings().verify_min_origins})
    retracted = []
    for s in body.sources:
        if not s.get("id") or not (s.get("text") or s.get("title")):
            continue
        doc = SourceDoc(id=str(s["id"])[:120], text=str(s.get("text") or "")[:40000], url=s.get("url"), title=str(s.get("title") or "")[:200],
                        author=str(s.get("author") or "")[:120], published_at=str(s.get("published_at") or "")[:10],
                        kind=s.get("kind") if s.get("kind") in ("web", "doc", "user") else "web")
        claims = [Claim(statement=c["statement"], subject=c.get("subject") or "", stance=c.get("stance") or "supports",
                        quote=c.get("quote") or "", belief=(c.get("belief") or "").removeprefix("b:") or None)
                  for c in (s.get("claims") or []) if c and c.get("statement")]
        m.ingest(doc, claims, trust=s.get("trust"))
        if s.get("retracted"):
            retracted.append(doc.id)
    for sid in retracted:
        m.set_retracted(sid, True, "retracted before export")
    return {"workspace": ws, "sources": len(body.sources), "stats": m.stats()}


# ---------------------------------------------------------------------- reads


@app.get("/api/w/{ws}/graph")
def graph(ws: str) -> dict:
    return mem(ws).graph()


@app.get("/api/w/{ws}/beliefs")
def beliefs(ws: str) -> list[dict]:
    return mem(ws).ledger()


@app.get("/api/w/{ws}/beliefs/{bid}")
def belief(ws: str, bid: str) -> dict:
    r = mem(ws).report(bid)
    if not r:
        raise HTTPException(404, "unknown belief")
    return r


@app.get("/api/w/{ws}/sources/{sid}")
def source(ws: str, sid: str) -> dict:
    r = mem(ws).source(sid)
    if not r:
        raise HTTPException(404, "unknown source")
    return r


@app.get("/api/w/{ws}/origins")
def origins(ws: str) -> dict:
    return mem(ws).load_bearing(10)


@app.get("/api/w/{ws}/families")
def families(ws: str) -> dict:
    return mem(ws).families()


@app.get("/api/w/{ws}/rings")
def rings(ws: str) -> dict:
    return mem(ws).rings()


@app.get("/api/w/{ws}/episodes")
def episodes(ws: str) -> list[dict]:
    return mem(ws).episodes()


class CypherBody(BaseModel):
    cypher: str = Field(max_length=4000)


@app.post("/api/w/{ws}/cypher")
def cypher(ws: str, body: CypherBody) -> dict:
    try:
        return mem(ws).cypher(body.cypher)
    except Exception as e:
        raise HTTPException(400, str(e)[:400]) from e


# ---------------------------------------------------------------------- writes


class RetractBody(BaseModel):
    reason: str = ""
    restore: bool = False


@app.post("/api/w/{ws}/sources/{sid}/retract")
def retract(ws: str, sid: str, body: RetractBody) -> dict:
    try:
        return mem(ws).set_retracted(sid, not body.restore, body.reason)
    except KeyError as e:
        raise HTTPException(404, "unknown source") from e


class IngestBody(BaseModel):
    url: str | None = None
    text: str | None = Field(default=None, max_length=40000)
    title: str = ""
    author: str = ""
    published_at: str = ""


class FileBody(BaseModel):
    filename: str = Field(max_length=200)
    data_b64: str = Field(max_length=12_000_000)


def _file_text(name: str, data: bytes) -> str:
    low = name.lower()
    if low.endswith(".pdf"):
        import io

        from pypdf import PdfReader

        return "\n\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages[:60])
    raw = data.decode("utf-8", errors="replace")
    if low.endswith((".html", ".htm")):
        import trafilatura

        return trafilatura.extract(raw, output_format="markdown", include_links=True) or ""
    return raw


@app.post("/api/w/{ws}/ingest-file")
def ingest_file(ws: str, body: FileBody, request: Request) -> dict:
    """A document (.pdf, .md, .txt, .html) dropped into the studio."""
    try:
        data = base64.b64decode(body.data_b64)
        text = _file_text(body.filename, data).strip()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"could not read {body.filename}: {type(e).__name__}") from e
    if len(text) < 20:
        raise HTTPException(400, "no readable text in that file")
    title = body.filename.rsplit("/", 1)[-1].rsplit(".", 1)[0].replace("_", " ").replace("-", " ")
    return ingest(ws, IngestBody(text=text[:40000], title=title), request, kind="doc")


@app.post("/api/w/{ws}/ingest")
def ingest(ws: str, body: IngestBody, request: Request, kind: str = "web") -> dict:
    m = mem(ws)
    cfg = llm_cfg(request)
    if body.url and not body.text:
        if not settings().allow_live_fetch:
            raise HTTPException(400, "live fetching is disabled")
        try:
            page = fetch(body.url)
        except FetchError as e:
            raise HTTPException(400, f"could not fetch: {e}") from e
        except Exception as e:
            raise HTTPException(400, f"could not fetch: {type(e).__name__}") from e
    elif body.text:
        page = {"url": body.url, "title": body.title or body.text[:60], "author": body.author,
                "published_at": body.published_at, "text": body.text, "raw": ""}
    else:
        raise HTTPException(400, "give a url or text")
    claims, method = extract_claims(m, page["title"], page["text"], cfg)
    sid = "src:" + slug(page["url"] or page["title"], 40)
    doc = SourceDoc(id=sid, text=page["text"], url=page["url"], title=page["title"], author=page["author"] or "",
                    published_at=(page["published_at"] or "")[:10], raw=page.get("raw", ""),
                    kind="doc" if kind == "doc" else "web")
    r = m.ingest(doc, claims)
    if "--" in ws:
        _keep(ws)
    r["extraction"] = method
    r["claims"] = [c.__dict__ for c in claims]
    return r


class AskBody(BaseModel):
    question: str = Field(min_length=2, max_length=600)
    mode: str = "echo"


@app.post("/api/w/{ws}/ask")
async def ask(ws: str, body: AskBody, request: Request):
    mem(ws)
    agent = Agent(ws, "plain" if body.mode == "plain" else "echo", llm_cfg(request))

    async def events():
        try:
            async for ev in iterate_in_threadpool(agent.run(body.question)):
                yield {"event": ev["type"], "data": json.dumps(ev, default=str)}
        except Exception as e:
            log.exception("agent failed")
            yield {"event": "error", "data": json.dumps({"type": "error", "text": str(e)[:300]})}

    return EventSourceResponse(events(), ping=10)


@app.get("/api/eval")
def eval_results() -> dict:
    from .evaluate import load_results

    return load_results()


def main() -> None:
    import os

    import uvicorn

    uvicorn.run("echo_memory.api:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
