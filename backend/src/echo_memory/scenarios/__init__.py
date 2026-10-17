"""Built-in demo scenarios. Each one seeds its own workspace graph."""

from __future__ import annotations

from types import ModuleType

from ..lineage import SourceDoc
from ..memory import Claim, EchoMemory
from . import citogenesis, halcyon

SCENARIOS: dict[str, ModuleType] = {m.ID: m for m in (halcyon, citogenesis)}


def to_doc(s: dict) -> SourceDoc:
    return SourceDoc(
        id=s["id"], text=s["text"], url=s.get("url"), title=s.get("title", ""), author=s.get("author", ""),
        published_at=s.get("published_at", ""), kind=s.get("kind", "web"), raw=s.get("raw", ""),
        extra_links=s.get("extra_links", []),
    )


def to_claims(s: dict) -> list[Claim]:
    return [Claim(statement=c["statement"], subject=c["subject"], stance=c.get("stance", "supports"),
                  quote=c.get("quote", ""), belief=c.get("belief"), attributed_to=c.get("attributed_to"))
            for c in s.get("claims", [])]


def seed(ws: str, scenario: str) -> dict:
    mod = SCENARIOS[scenario]
    mem = EchoMemory(ws)
    mem.reset()
    edges = 0
    for s in sorted(mod.SOURCES, key=lambda x: x.get("published_at", "")):
        r = mem.ingest(to_doc(s), to_claims(s), trust=s.get("trust"))
        edges += len(r["edges"])
    mem.db.q("MERGE (m:Meta {id:'workspace'}) SET m.scenario=$s, m.title=$t", {"s": scenario, "t": mod.TITLE})
    return {"workspace": ws, "scenario": scenario, "sources": len(mod.SOURCES), "edges": edges}


def info(scenario: str) -> dict:
    m = SCENARIOS[scenario]
    return {"id": m.ID, "title": m.TITLE, "question": m.QUESTION, "suggested": m.SUGGESTED,
            "retract_hint": m.RETRACT_HINT, "sources": len(m.SOURCES)}
