"""The research agent. Same LLM, same graph, two memories:

  echo   recalls beliefs with independent-origin verdicts and can inspect lineage
  plain  recalls beliefs with mention counts, the way most memory stores do

Every step is yielded as an event so the UI can light up the graph as the agent works.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
from typing import Any

from . import llm
from .db import capture
from .memory import Claim, EchoMemory

log = logging.getLogger(__name__)
MAX_ROUNDS = 6

ECHO_SYSTEM = """You are a careful research agent. Your long-term memory is Echo, a graph that tracks where every
belief came from. For each belief Echo reports how many sources mention it and how many *independent origins*
those sources trace back to. Copies, paraphrases, sites from one ownership network, and your own earlier notes
all collapse into a single origin.

How to work:
1. Call recall_beliefs for the question (try a second phrasing if results look thin).
2. Call inspect_belief on every belief your answer will lean on, to see its origins and what contradicts it.
3. Answer.

Trust policy (follow it exactly):
- Only call something verified/confirmed when its status is VERIFIED (at least 2 independent origins).
- SINGLE_ORIGIN: say it rests on one origin, name that origin, and say what would verify it.
- When sources > origins, call it out plainly, e.g. "5 sources, but 1 origin".
- DISPUTED/CONTESTED: present both sides with their origin counts. RETRACTED: do not rely on it.
- Never let the number of mentions stand in for evidence.

Answer format: GitHub markdown, under 220 words. Start with a one or two sentence direct answer in bold.
Then short bullets with the evidence. Cite sources inline as [[source-id]] using ids from tool results.
End with one line "Next check:" naming the single most useful thing to verify."""

PLAIN_SYSTEM = """You are a research agent with a long-term memory store. Each memory lists how many sources
mention it. Call search_memory for the question, then answer using your memories.

Answer format: GitHub markdown, under 220 words. Start with a one or two sentence direct answer in bold, then
short bullets with the evidence. Cite sources inline as [[source-id]] using ids from tool results."""


def _fn(name: str, desc: str, props: dict, required: list[str]) -> dict:
    return {"type": "function", "function": {"name": name, "description": desc,
                                             "parameters": {"type": "object", "properties": props, "required": required}}}


ECHO_TOOLS = [
    _fn("recall_beliefs", "Semantic search over beliefs in memory. Returns each belief with status, mention count, "
        "source count, independent origins and confidence.", {"query": {"type": "string"}}, ["query"]),
    _fn("inspect_belief", "Independence report for one belief: origin clusters, why sources collapsed together, "
        "lineage paths, and contradicting origins.", {"belief_id": {"type": "string"}}, ["belief_id"]),
    _fn("load_bearing_origins", "PageRank over the lineage graph: the origins the most beliefs rest on, with blast "
        "radius (how many beliefs fall if that origin is wrong).", {}, []),
    _fn("query_graph", "Run a read-only Cypher query on the memory graph (FalkorDB). Labels: Source, Owner, "
        "Observation, Belief, Entity, Agent, Episode. Lineage edges: CITES, COPIED_FROM, DERIVED_FROM; "
        "(Source)-[:PUBLISHED_BY]->(Owner); (Source)-[:YIELDED]->(Observation)-[:SUPPORTS|CONTRADICTS]->(Belief).",
        {"cypher": {"type": "string"}}, ["cypher"]),
]
PLAIN_TOOLS = [
    _fn("search_memory", "Semantic search over memories. Returns each memory with how many sources mention it.",
        {"query": {"type": "string"}}, ["query"]),
]


def _src_label(info: dict, sid: str) -> str:
    s = info.get(sid) or {}
    return s.get("title") or sid


class Agent:
    def __init__(self, ws: str, mode: str = "echo"):
        self.ws, self.mode = ws, mode
        self.mem = EchoMemory(ws)
        self.recalled: list[str] = []
        self.cited_sources: set[str] = set()

    # ------------------------------------------------------------------ tools

    def tool(self, name: str, args: dict) -> tuple[dict, dict]:
        """Run a tool. Returns (result for the model, ui payload with highlights + cypher)."""
        with capture() as qlog:
            result, hl = self._tool(name, args)
        return result, {"highlight": hl, "cypher": qlog.entries}

    def _tool(self, name: str, args: dict) -> tuple[dict, dict]:
        if name in ("recall_beliefs", "search_memory"):
            rows = [r for r in self.mem.recall(args.get("query", ""), k=6) if r["similarity"] > 0.05][:6]
            for r in rows:
                if r["id"] not in self.recalled:
                    self.recalled.append(r["id"])
            hl = {"nodes": [r["id"] for r in rows]}
            if name == "search_memory":
                out = []
                for r in rows:
                    rep = self.mem.report(r["id"]) or {}
                    sup = [q["source"] for q in rep.get("quotes", []) if q["stance"] == "supports"]
                    con = [q["source"] for q in rep.get("quotes", []) if q["stance"] == "contradicts"]
                    out.append({"memory": r["statement"], "mentioned_by": len(sup), "contradicted_by": len(con),
                                "status": r["plain_status"], "sources": sup[:8], "contradicting_sources": con[:4]})
                    hl["nodes"] += sup + con
                return {"memories": out}, hl
            return {"beliefs": [{k: r[k] for k in ("id", "statement", "subject", "status", "sources", "origins",
                                                    "against_origins", "confidence", "echo")} for r in rows]}, hl

        if name == "inspect_belief":
            bid = args.get("belief_id", "")
            if not bid.startswith("b:"):
                bid = "b:" + bid
            rep = self.mem.report(bid)
            if not rep:
                return {"error": f"no belief {bid}"}, {}
            if bid not in self.recalled:
                self.recalled.append(bid)
            v, info = rep["verdict"], rep["sources"]
            clusters = []
            nodes, edges = {bid}, []
            for c in v["clusters"]:
                nodes |= set(c["members"]) | set(c["roots"]) | set(c["dead_roots"])
                self.cited_sources |= set(c["members"])
                clusters.append({
                    "stance": c["stance"], "live": c["weight"] > 0, "weight": c["weight"],
                    "sources": [{"id": m, "title": _src_label(info, m)} for m in c["members"]],
                    "origin": [{"id": r, "title": _src_label(info, r), "kind": (info.get(r) or {}).get("kind")}
                               for r in c["roots"]] or None,
                    "retracted_origins": c["dead_roots"] or None,
                    "why_collapsed": c["reason"],
                })
            for p in rep["paths"]:
                ns = p["nodes"]
                edges += [[a, b] for a, b in zip(ns, ns[1:])]
            quotes = [{"source": q["source"], "stance": q["stance"], "quote": q["quote"][:200]} for q in rep["quotes"]]
            return ({"belief": bid, "statement": rep["statement"], "status": v["status"], "confidence": v["confidence"],
                     "sources": v["sources"], "independent_origins": v["origins"],
                     "contradicting_origins": v["against_origins"], "clusters": clusters, "quotes": quotes[:10],
                     "lineage": [{"from": p["from"], "to": p["to"],
                                  "via": [f"{h['type']}({h['method']})" for h in p["hops"]]} for p in rep["paths"][:12]]},
                    {"nodes": sorted(nodes), "edges": edges, "focus": bid})

        if name == "load_bearing_origins":
            res = self.mem.load_bearing(6)["origins"]
            return {"origins": res}, {"nodes": [r["id"] for r in res]}

        if name == "query_graph":
            try:
                res = self.mem.cypher(args.get("cypher", ""))
                return {"rows": res["rows"][:30]}, {}
            except Exception as e:
                return {"error": str(e)[:300]}, {}

        return {"error": f"unknown tool {name}"}, {}

    # ------------------------------------------------------------------ loop

    def run(self, question: str) -> Iterator[dict[str, Any]]:
        t0 = time.time()
        yield {"type": "start", "mode": self.mode, "llm": llm.available()}
        answer = None
        if llm.available():
            try:
                for ev in self._llm_loop(question):
                    if ev["type"] == "answer":
                        answer = ev["text"]
                    else:
                        yield ev
            except Exception as e:
                log.warning("agent LLM loop failed, falling back: %s", e)
                yield {"type": "notice", "text": "LLM unavailable, switched to Echo's built-in reasoner."}
        if answer is None:
            for ev in self._scripted(question):
                if ev["type"] == "answer":
                    answer = ev["text"]
                else:
                    yield ev
        produced = self._remember(question, answer)
        eid = self.mem.record_episode(f"{self.mode}-agent", question, answer, self.mode, self.recalled, produced)
        yield {"type": "answer", "text": answer, "beliefs": self.recalled, "episode": eid, "note": produced,
               "seconds": round(time.time() - t0, 2)}

    def _llm_loop(self, question: str) -> Iterator[dict[str, Any]]:
        tools = ECHO_TOOLS if self.mode == "echo" else PLAIN_TOOLS
        msgs: list[dict] = [{"role": "system", "content": ECHO_SYSTEM if self.mode == "echo" else PLAIN_SYSTEM},
                            {"role": "user", "content": question}]
        for rnd in range(MAX_ROUNDS):
            last = rnd == MAX_ROUNDS - 1
            msg = llm.chat(msgs, tools=None if last else tools, max_tokens=1600)
            calls = getattr(msg, "tool_calls", None) or []
            if not calls:
                text = (msg.content or "").strip()
                if not text:
                    raise RuntimeError("empty answer")
                yield {"type": "answer", "text": text}
                return
            msgs.append({"role": "assistant", "content": msg.content or "",
                         "tool_calls": [{"id": c.id, "type": "function",
                                         "function": {"name": c.function.name, "arguments": c.function.arguments}}
                                        for c in calls]})
            for c in calls:
                try:
                    args = json.loads(c.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                yield {"type": "step", "tool": c.function.name, "args": args}
                result, ui = self.tool(c.function.name, args)
                yield {"type": "step_result", "tool": c.function.name, "summary": _summarize(c.function.name, result), **ui}
                msgs.append({"role": "tool", "tool_call_id": c.id, "content": json.dumps(result, default=str)[:12000]})
        raise RuntimeError("no answer after max rounds")

    # ------------------------------------------------------------------ deterministic fallback

    def _scripted(self, question: str) -> Iterator[dict[str, Any]]:
        name = "recall_beliefs" if self.mode == "echo" else "search_memory"
        yield {"type": "step", "tool": name, "args": {"query": question}}
        res, ui = self.tool(name, {"query": question})
        yield {"type": "step_result", "tool": name, "summary": _summarize(name, res), **ui}
        if self.mode == "plain":
            yield {"type": "answer", "text": _plain_answer(res["memories"][:4])}
            return
        reports = []
        for b in res["beliefs"][:4]:
            yield {"type": "step", "tool": "inspect_belief", "args": {"belief_id": b["id"]}}
            r, ui = self.tool("inspect_belief", {"belief_id": b["id"]})
            yield {"type": "step_result", "tool": "inspect_belief", "summary": _summarize("inspect_belief", r), **ui}
            reports.append(r)
        yield {"type": "answer", "text": _echo_answer(reports)}

    # ------------------------------------------------------------------ memory write-back

    def _remember(self, question: str, answer: str) -> str | None:
        """The agent's answer becomes a note in memory, the way agents write back summaries.

        Echo links the note to every source it read (DERIVED_FROM), so when a later session
        re-reads this note it collapses into those origins. Plain memory stores the note as
        just another source that mentions the beliefs, which is how self-echo inflates counts.
        """
        top = [b for b in self.recalled[:2]]
        if not top:
            return None
        claims = []
        for bid in top:
            rep = self.mem.db.one("MATCH (b:Belief {id:$id})-[:ABOUT]->(e:Entity) RETURN b.statement AS s, e.name AS e",
                                  {"id": bid}, ro=True)
            if rep:
                claims.append(Claim(statement=rep["s"], subject=rep["e"], belief=bid.removeprefix("b:"),
                                    quote=f"(agent note) {rep['s']}"))
        derived = sorted(self.cited_sources) if self.mode == "echo" else []
        if self.mode == "echo" and not derived:
            for bid in top:
                rep = self.mem.report(bid) or {}
                derived += [q["source"] for q in rep.get("quotes", [])]
        # Echo only writes back beliefs it did not reject; plain memory writes back everything it repeated.
        if self.mode == "echo":
            keep = []
            for c in claims:
                st = self.mem.db.one("MATCH (b:Belief {id:$id}) RETURN b.status AS s", {"id": f"b:{c.belief}"}, ro=True)
                if st and st["s"] in ("VERIFIED", "SINGLE_ORIGIN"):
                    keep.append(c)
            claims = keep
        r = self.mem.remember_note(f"{self.mode}-agent", f"Q: {question}\n\n{answer}", sorted(set(derived)), claims)
        return r["source"]


# ---------------------------------------------------------------------- summaries & templates


def _summarize(tool: str, r: dict) -> str:
    if "error" in r:
        return r["error"]
    if tool == "recall_beliefs":
        return f"{len(r['beliefs'])} beliefs: " + "; ".join(
            f"{b['statement'][:60]}… {b['sources']} sources → {b['origins']} origins" for b in r["beliefs"][:3])
    if tool == "search_memory":
        return f"{len(r['memories'])} memories: " + "; ".join(
            f"{m['memory'][:60]}… ({m['status']})" for m in r["memories"][:3])
    if tool == "inspect_belief":
        echo = f" · echo: {r['sources']} sources, {r['independent_origins']} origin(s)" if r["sources"] > r["independent_origins"] else ""
        return f"{r['status']} · {r['independent_origins']} independent origin(s) for, {r['contradicting_origins']} against{echo}"
    if tool == "load_bearing_origins":
        return "; ".join(f"{o['title'][:40]} (blast radius {o['beliefs']})" for o in r["origins"][:3])
    if tool == "query_graph":
        return f"{len(r.get('rows', []))} rows"
    return ""


def _plain_answer(mems: list[dict]) -> str:
    if not mems:
        return "**I don't have anything in memory about that yet.**"
    top = max(mems, key=lambda m: m["mentioned_by"])
    lines = [f"**{top['memory']}** This is {top['status'].lower()}.", ""]
    for m in mems:
        cites = " ".join(f"[[{s}]]" for s in m["sources"][:5])
        lines.append(f"- {m['memory']} ({m['mentioned_by']} sources) {cites}")
    return "\n".join(lines)


def _echo_answer(reports: list[dict]) -> str:
    if not reports:
        return "**Nothing in memory addresses that yet.** Next check: ingest a primary source on the question."

    def cites(r, stance):
        ids = [s["id"] for c in r["clusters"] if c["stance"] == stance for s in c["sources"]]
        return " ".join(f"[[{i}]]" for i in ids[:5])

    good = [r for r in reports if r["status"] == "VERIFIED"]
    bad = [r for r in reports if r["status"] in ("DISPUTED", "RETRACTED", "UNSUPPORTED")]
    thin = [r for r in reports if r["status"] in ("SINGLE_ORIGIN", "CONTESTED")]
    head = []
    if bad:
        b = bad[0]
        head.append(f"**Don't rely on “{b['statement'].rstrip('.')}”: it has {b['sources']} sources but "
                    f"{b['independent_origins']} independent origin(s), and {b['contradicting_origins']} independent "
                    "origin(s) contradict it.**")
    if good:
        head.append(f"**What does hold up: {good[0]['statement']}** ({good[0]['independent_origins']} independent origins.)")
    if not head:
        t = thin[0]
        head.append(f"**Unverified: {t['statement']}** It rests on {t['independent_origins']} origin(s).")
    lines = [" ".join(head), ""]
    for r in reports:
        origin_titles = [o["title"] for c in r["clusters"] if c["stance"] == "supports" and c["origin"] for o in c["origin"]]
        echo = f" — {r['sources']} sources, {r['independent_origins']} origin" if r["sources"] > r["independent_origins"] else ""
        lines.append(f"- **{r['status'].replace('_', ' ').title()}**: {r['statement']}{echo} {cites(r, 'supports')}"
                     + (f" · against: {cites(r, 'contradicts')}" if r["contradicting_origins"] else ""))
        if origin_titles and r["status"] != "VERIFIED":
            lines.append(f"  - origin: {origin_titles[0]}")
    target = (thin or bad or good)[0]
    lines += ["", f"Next check: find a second independent origin for “{target['statement'].rstrip('.')}”."]
    return "\n".join(lines)
