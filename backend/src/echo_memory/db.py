"""FalkorDB access. One graph per workspace (FalkorDB multigraph = per-tenant memory)."""

from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from falkordb import FalkorDB, Graph

from .config import settings

_WS_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,40}$")

LINEAGE = "CITES|COPIED_FROM|DERIVED_FROM"

SCHEMA = [
    "CREATE INDEX FOR (s:Source) ON (s.id)",
    "CREATE INDEX FOR (s:Source) ON (s.url)",
    "CREATE INDEX FOR (b:Belief) ON (b.id)",
    "CREATE INDEX FOR (o:Observation) ON (o.id)",
    "CREATE INDEX FOR (w:Owner) ON (w.id)",
    "CREATE INDEX FOR (e:Entity) ON (e.id)",
    "CREATE INDEX FOR (a:Agent) ON (a.id)",
    "CREATE INDEX FOR (e:Episode) ON (e.id)",
    "CREATE FULLTEXT INDEX FOR (b:Belief) ON (b.statement)",
]


def vector_index_query(dim: int) -> str:
    return (
        "CREATE VECTOR INDEX FOR (b:Belief) ON (b.embedding) "
        f"OPTIONS {{dimension:{dim}, similarityFunction:'cosine'}}"
    )


@dataclass
class QueryLog:
    """Every Cypher statement Echo runs for a request, so the UI can show its work."""

    entries: list[dict[str, Any]] = field(default_factory=list)

    def add(self, cypher: str, params: dict | None, ms: float, rows: int) -> None:
        self.entries.append(
            {"cypher": " ".join(cypher.split()), "params": params or {}, "ms": round(ms, 2), "rows": rows}
        )


_local = threading.local()


def current_log() -> QueryLog | None:
    return getattr(_local, "log", None)


class capture:
    """Context manager: collect the Cypher statements executed inside it."""

    def __enter__(self) -> QueryLog:
        self.prev = current_log()
        _local.log = QueryLog()
        return _local.log

    def __exit__(self, *exc) -> None:
        _local.log = self.prev


_client: FalkorDB | None = None
_client_lock = threading.Lock()


def client() -> FalkorDB:
    global _client
    with _client_lock:
        if _client is None:
            s = settings()
            if s.falkordb_url:
                _client = FalkorDB.from_url(s.falkordb_url)
            else:
                _client = FalkorDB(host=s.falkordb_host, port=s.falkordb_port, password=s.falkordb_password)
        return _client


def wait_for_db(timeout: float = 60) -> None:
    deadline = time.time() + timeout
    while True:
        try:
            client().connection.ping()
            return
        except Exception:
            if time.time() > deadline:
                raise
            time.sleep(0.5)


def graph_name(ws: str) -> str:
    return f"{settings().graph_prefix}__{ws}"


def valid_workspace(ws: str) -> bool:
    return bool(_WS_RE.match(ws))


class Store:
    """Thin wrapper over a FalkorDB graph that logs queries and returns dict rows."""

    def __init__(self, ws: str):
        if not valid_workspace(ws):
            raise ValueError(f"invalid workspace name: {ws!r}")
        self.ws = ws
        self.graph: Graph = client().select_graph(graph_name(ws))

    def q(self, cypher: str, params: dict | None = None, *, ro: bool = False) -> list[dict[str, Any]]:
        t0 = time.perf_counter()
        fn = self.graph.ro_query if ro else self.graph.query
        res = fn(cypher, params or None)
        ms = (time.perf_counter() - t0) * 1000
        cols = [c[1] if isinstance(c, (list, tuple)) else c for c in res.header]
        rows = [dict(zip(cols, [_plain(v) for v in r])) for r in res.result_set]
        log = current_log()
        if log is not None:
            log.add(cypher, params, ms, len(rows))
        return rows

    def one(self, cypher: str, params: dict | None = None, *, ro: bool = False) -> dict[str, Any] | None:
        rows = self.q(cypher, params, ro=ro)
        return rows[0] if rows else None

    def ensure_schema(self, dim: int) -> None:
        for stmt in [*SCHEMA, vector_index_query(dim)]:
            try:
                self.graph.query(stmt)
            except Exception as e:  # index already exists
                if "already" not in str(e).lower():
                    raise

    def drop(self) -> None:
        try:
            self.graph.delete()
        except Exception:
            pass
        self.graph = client().select_graph(graph_name(self.ws))


def _plain(v: Any) -> Any:
    """Convert FalkorDB Node/Edge/Path objects into JSON-friendly dicts."""
    from falkordb import Edge, Node, Path

    if isinstance(v, Node):
        props = {k: x for k, x in v.properties.items() if k != "embedding"}
        return {"_id": v.id, "_labels": list(v.labels), **props}
    if isinstance(v, Edge):
        return {"_id": v.id, "_type": v.relation, "_src": v.src_node, "_dst": v.dest_node, **v.properties}
    if isinstance(v, Path):
        return {"nodes": [_plain(n) for n in v.nodes()], "edges": [_plain(e) for e in v.edges()]}
    if isinstance(v, list):
        return [_plain(x) for x in v]
    return v


def list_workspaces() -> list[str]:
    prefix = f"{settings().graph_prefix}__"
    return sorted(g[len(prefix):] for g in client().list_graphs() if g.startswith(prefix))
