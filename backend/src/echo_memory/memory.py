"""EchoMemory: the agent memory layer, stored in FalkorDB.

Graph model
  (:Source {id, kind, url, title, author, published_at, text, retracted, trust})
  (:Owner {id, name, kind})            domain | author | network
  (:Observation {id, quote, stance})   one claim, as seen in one source
  (:Belief {id, statement, ... verdict fields})
  (:Entity {id, name})                 what a belief is about
  (:Agent {id, name}) (:Episode {id, question, answer, mode, at})

  (Source)-[:CITES|COPIED_FROM|DERIVED_FROM {method, score, evidence}]->(Source)
  (Source)-[:PUBLISHED_BY]->(Owner)
  (Source)-[:YIELDED]->(Observation)-[:SUPPORTS|CONTRADICTS]->(Belief)-[:ABOUT]->(Entity)
  (Source {kind:'agent'})-[:WRITTEN_BY]->(Agent)
  (Agent)-[:RAN]->(Episode)-[:RECALLED]->(Belief), (Episode)-[:PRODUCED]->(Source)
"""

from __future__ import annotations

import hashlib
import re
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from . import embed
from .config import settings
from .db import LINEAGE, Store, capture
from .lineage import SourceDoc, detect, normalize_url, owner_keys
from .scoring import SourceInfo, SupportItem, score

DEPTH = settings().max_lineage_depth
_locks: dict[str, threading.Lock] = {}


def ws_lock(ws: str) -> threading.Lock:
    return _locks.setdefault(ws, threading.Lock())


def slug(text: str, n: int = 48) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:n].strip("-")
    return s or hashlib.sha1(text.encode()).hexdigest()[:10]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Claim:
    statement: str
    subject: str
    stance: str = "supports"  # supports | contradicts
    quote: str = ""
    belief: str | None = None  # canonical belief key, when known
    attributed_to: str | None = None  # "according to X" — an upstream origin named in text


VERDICT_FIELDS = ("mentions", "sources", "origins", "against_origins", "confidence", "status", "echo",
                  "plain_confidence", "plain_status")


class EchoMemory:
    def __init__(self, ws: str):
        self.ws = ws
        self.db = Store(ws)

    # ------------------------------------------------------------------ setup

    def init(self) -> None:
        self.db.ensure_schema(settings().embed_dim)

    def reset(self) -> None:
        self.db.drop()
        self.init()

    # ------------------------------------------------------------------ ingest

    def corpus(self) -> list[SourceDoc]:
        rows = self.db.q(
            "MATCH (s:Source) WHERE s.kind <> 'stub' AND s.kind <> 'ident' "
            "RETURN s.id AS id, s.text AS text, s.url AS url, s.title AS title, s.author AS author, "
            "s.published_at AS published_at, s.kind AS kind, s.seq AS seq ORDER BY s.seq",
            ro=True,
        )
        return [SourceDoc(id=r["id"], text=r["text"] or "", url=r["url"], title=r["title"] or "",
                          author=r["author"] or "", published_at=r["published_at"] or "", kind=r["kind"] or "web")
                for r in rows]

    def ingest(self, doc: SourceDoc, claims: list[Claim], trust: float | None = None,
               agent_id: str | None = None) -> dict[str, Any]:
        """Store a source, infer its lineage, attach its claims, rescore what changed."""
        with ws_lock(self.ws), capture() as log:
            corpus = self.corpus()
            order = {d.id: i for i, d in enumerate(corpus)} | {doc.id: len(corpus)}
            seq = len(corpus)
            self.db.q(
                "MERGE (s:Source {id:$id}) SET s.kind=$kind, s.url=$url, s.title=$title, s.author=$author, "
                "s.published_at=$pub, s.text=$text, s.seq=$seq, s.retracted=coalesce(s.retracted,false), "
                "s.ingested_at=$at, s.trust=$trust",
                {"id": doc.id, "kind": doc.kind, "url": normalize_url(doc.url) if doc.url else None,
                 "title": doc.title, "author": doc.author, "pub": doc.published_at, "text": doc.text,
                 "seq": seq, "at": now_iso(), "trust": trust},
            )
            if doc.url:  # an earlier source linked to this URL before we had it: adopt the stub
                self._adopt_stub(f"url:{normalize_url(doc.url)}", doc.id)
            for k in owner_keys(doc):
                self.db.q(
                    "MATCH (s:Source {id:$sid}) MERGE (w:Owner {id:$id}) SET w.name=$name, w.kind=$kind "
                    "MERGE (s)-[:PUBLISHED_BY]->(w)",
                    {"sid": doc.id, "id": k.id, "name": k.name, "kind": k.kind},
                )
            if agent_id:
                self.db.q("MATCH (s:Source {id:$sid}) MERGE (a:Agent {id:$aid}) ON CREATE SET a.name=$aid "
                          "MERGE (s)-[:WRITTEN_BY]->(a)", {"sid": doc.id, "aid": agent_id})

            deps = detect(doc, corpus, order)
            for c in claims:
                if c.attributed_to:
                    deps.append(_attribution(doc.id, c.attributed_to))
            touched = {doc.id}
            for d in deps:
                self._ensure_stub(d.dst)
                self.db.q(
                    f"MATCH (a:Source {{id:$src}}), (b:Source {{id:$dst}}) MERGE (a)-[r:{d.rel}]->(b) "
                    "SET r.method=$method, r.score=$score, r.evidence=$ev",
                    {"src": d.src, "dst": d.dst, "method": d.method, "score": d.score, "ev": d.evidence},
                )
                touched |= {d.src, d.dst}

            belief_ids = [self._attach(doc.id, c) for c in claims]
            affected = set(belief_ids) | set(self.beliefs_downstream(list(touched)))
            changes = [self._rescore(b) for b in sorted(affected)]
            return {"source": doc.id, "edges": [d.__dict__ for d in deps], "beliefs": belief_ids,
                    "rescored": changes, "cypher": log.entries}

    def _ensure_stub(self, sid: str) -> None:
        if sid.startswith("url:"):
            self.db.q("MERGE (s:Source {id:$id}) ON CREATE SET s.kind='stub', s.url=$url, s.title=$url, "
                      "s.retracted=false", {"id": sid, "url": sid[4:]})
        elif sid.startswith("id:") or sid.startswith("attrib:"):
            kind = "ident" if sid.startswith("id:") else "stub"
            self.db.q("MERGE (s:Source {id:$id}) ON CREATE SET s.kind=$kind, s.title=$t, s.retracted=false",
                      {"id": sid, "kind": kind, "t": sid.split(":", 1)[1]})

    def _adopt_stub(self, stub_id: str, real_id: str) -> None:
        rows = self.db.q("MATCH (x:Source)-[r:CITES]->(st:Source {id:$stub}) RETURN x.id AS x, r.method AS m, "
                         "r.evidence AS ev", {"stub": stub_id})
        for r in rows:
            self.db.q("MATCH (x:Source {id:$x}), (s:Source {id:$real}) MERGE (x)-[e:CITES]->(s) "
                      "SET e.method=$m, e.evidence=$ev, e.score=1.0", {"x": r["x"], "real": real_id, "m": r["m"], "ev": r["ev"]})
        self.db.q("MATCH (st:Source {id:$stub}) DELETE st", {"stub": stub_id})

    def _attach(self, source_id: str, c: Claim) -> str:
        bid = self._canonical_belief(c)
        oid = f"obs:{source_id}:{bid}"
        rel = "CONTRADICTS" if c.stance == "contradicts" else "SUPPORTS"
        self.db.q(
            "MATCH (s:Source {id:$sid}), (b:Belief {id:$bid}) "
            "MERGE (s)-[:YIELDED]->(o:Observation {id:$oid}) SET o.quote=$quote, o.stance=$stance "
            f"MERGE (o)-[:{rel}]->(b)",
            {"sid": source_id, "bid": bid, "oid": oid, "quote": c.quote or c.statement, "stance": c.stance},
        )
        return bid

    def _canonical_belief(self, c: Claim) -> str:
        subject_id = f"ent:{slug(c.subject)}"
        if c.belief:
            bid = f"b:{slug(c.belief, 64)}"
        else:
            vec = embed.embed_one(c.statement)
            hit = self.db.one(
                "CALL db.idx.vector.queryNodes('Belief','embedding',1,vecf32($v)) YIELD node, score "
                "RETURN node.id AS id, score", {"v": vec}, ro=True,
            )
            # FalkorDB returns cosine *distance* for cosine indexes.
            if hit and (1 - hit["score"]) >= 0.9:
                return hit["id"]
            bid = f"b:{slug(c.statement, 64)}"
        exists = self.db.one("MATCH (b:Belief {id:$id}) RETURN b.id AS id", {"id": bid}, ro=True)
        if not exists:
            vec = embed.embed_one(c.statement)
            self.db.q(
                "MERGE (e:Entity {id:$eid}) ON CREATE SET e.name=$ename "
                "CREATE (b:Belief {id:$id, statement:$st, created_at:$at, embedding:vecf32($v)}) "
                "CREATE (b)-[:ABOUT]->(e)",
                {"eid": subject_id, "ename": c.subject, "id": bid, "st": c.statement, "at": now_iso(), "v": vec},
            )
        return bid

    # ------------------------------------------------------------------ independence

    def beliefs_downstream(self, source_ids: list[str]) -> list[str]:
        rows = self.db.q(
            f"MATCH (s:Source) WHERE s.id IN $ids "
            f"MATCH (s)<-[:{LINEAGE}*0..{DEPTH}]-(d:Source)-[:YIELDED]->(:Observation)-[:SUPPORTS|CONTRADICTS]->(b:Belief) "
            "RETURN DISTINCT b.id AS id",
            {"ids": source_ids}, ro=True,
        )
        return [r["id"] for r in rows]

    def _support(self, belief_id: str):
        items = [
            SupportItem(r["oid"], r["sid"], "contradicts" if r["rel"] == "CONTRADICTS" else "supports", r["quote"] or "")
            for r in self.db.q(
                "MATCH (b:Belief {id:$id})<-[r:SUPPORTS|CONTRADICTS]-(o:Observation)<-[:YIELDED]-(s:Source) "
                "RETURN o.id AS oid, s.id AS sid, type(r) AS rel, o.quote AS quote ORDER BY s.seq",
                {"id": belief_id}, ro=True,
            )
        ]
        ids = sorted({i.source_id for i in items})
        rows = self.db.q(
            f"MATCH (s:Source) WHERE s.id IN $ids "
            f"MATCH (s)-[:{LINEAGE}*0..{DEPTH}]->(a:Source) "
            "WITH DISTINCT a "
            f"OPTIONAL MATCH (a)-[:{LINEAGE}]->(up:Source) "
            "OPTIONAL MATCH (a)-[:PUBLISHED_BY]->(w:Owner) "
            "RETURN a.id AS id, a.kind AS kind, a.title AS title, a.url AS url, a.retracted AS retracted, "
            "a.trust AS trust, collect(DISTINCT up.id) AS ups, collect(DISTINCT w.id) AS owners",
            {"ids": ids}, ro=True,
        ) if ids else []
        info = {r["id"]: SourceInfo(r["id"], r["kind"] or "web", r["title"] or "", r["url"], bool(r["retracted"]),
                                    r["trust"], [o for o in r["owners"] if o]) for r in rows}
        parents = {r["id"]: [u for u in r["ups"] if u] for r in rows}
        return items, info, parents

    def verdict(self, belief_id: str):
        items, info, parents = self._support(belief_id)
        return score(items, info, parents, settings().verify_min_origins), items, info, parents

    def _rescore(self, belief_id: str) -> dict[str, Any]:
        before = self.db.one(
            "MATCH (b:Belief {id:$id}) RETURN b.status AS status, b.confidence AS confidence, b.origins AS origins, "
            "b.statement AS statement", {"id": belief_id}, ro=True,
        ) or {}
        v, *_ = self.verdict(belief_id)
        d = v.as_dict()
        self.db.q(
            "MATCH (b:Belief {id:$id}) SET " + ", ".join(f"b.{k}=${k}" for k in VERDICT_FIELDS) + ", b.updated_at=$at",
            {"id": belief_id, "at": now_iso(), **{k: d[k] for k in VERDICT_FIELDS}},
        )
        return {"belief": belief_id, "statement": before.get("statement"),
                "before": {k: before.get(k) for k in ("status", "confidence", "origins")},
                "after": {"status": v.status, "confidence": v.confidence, "origins": v.origins}}

    def report(self, belief_id: str) -> dict[str, Any] | None:
        """Full, explainable independence report for one belief."""
        with capture() as log:
            b = self.db.one(
                "MATCH (b:Belief {id:$id}) OPTIONAL MATCH (b)-[:ABOUT]->(e:Entity) "
                "RETURN b.id AS id, b.statement AS statement, e.name AS subject", {"id": belief_id}, ro=True,
            )
            if not b:
                return None
            v, items, info, parents = self.verdict(belief_id)
            paths = []
            for c in v.clusters:
                for m in c.members:
                    for r in c.roots + c.dead_roots:
                        if m == r:
                            continue
                        p = self.path(m, r)
                        if p:
                            paths.append({"from": m, "to": r, **p})
            sources = {sid: {"id": s.id, "kind": s.kind, "title": s.title, "url": s.url, "retracted": s.retracted,
                             "owners": s.owners, "weight": s.weight()} for sid, s in info.items()}
            quotes = [{"source": i.source_id, "stance": i.stance, "quote": i.quote} for i in items]
        return {**b, "verdict": v.as_dict(), "sources": sources, "quotes": quotes, "paths": paths, "cypher": log.entries}

    def path(self, a: str, b: str) -> dict[str, Any] | None:
        """Shortest lineage path a -> b, with the evidence on each hop."""
        row = self.db.one(
            "MATCH (a:Source {id:$a}), (b:Source {id:$b}) "
            f"WITH shortestPath((a)-[:{LINEAGE}*1..{DEPTH}]->(b)) AS p WHERE p IS NOT NULL "
            "RETURN [n IN nodes(p) | n.id] AS nodes, "
            "[e IN relationships(p) | {type:type(e), method:e.method, evidence:e.evidence}] AS hops",
            {"a": a, "b": b}, ro=True,
        )
        return row

    # ------------------------------------------------------------------ retraction

    def set_retracted(self, source_id: str, retracted: bool, reason: str = "") -> dict[str, Any]:
        with ws_lock(self.ws), capture() as log:
            ok = self.db.one("MATCH (s:Source {id:$id}) SET s.retracted=$r, s.retract_reason=$why RETURN s.id AS id",
                             {"id": source_id, "r": retracted, "why": reason})
            if not ok:
                raise KeyError(source_id)
            affected = self.beliefs_downstream([source_id])
            t0 = time.perf_counter()
            changes = [self._rescore(b) for b in affected]
            return {"source": source_id, "retracted": retracted, "rescored": changes,
                    "ms": round((time.perf_counter() - t0) * 1000, 1), "cypher": log.entries}

    # ------------------------------------------------------------------ agent memory

    def remember_note(self, agent_id: str, text: str, derived_from: list[str], claims: list[Claim],
                      note_id: str | None = None) -> dict[str, Any]:
        """An agent writes its own note. It is linked to what it read, so it can never
        count as fresh evidence for the beliefs it came from."""
        nid = note_id or f"note:{agent_id}:{hashlib.sha1((text + now_iso()).encode()).hexdigest()[:10]}"
        doc = SourceDoc(id=nid, text=text, title=f"Note by {agent_id}", author=agent_id, kind="agent",
                        published_at=now_iso(), derived_from=[d for d in derived_from if d])
        return self.ingest(doc, claims, agent_id=agent_id)

    def record_episode(self, agent_id: str, question: str, answer: str, mode: str, beliefs: list[str],
                       produced: str | None) -> str:
        eid = f"ep:{hashlib.sha1((question + now_iso()).encode()).hexdigest()[:10]}"
        self.db.q(
            "MERGE (a:Agent {id:$aid}) ON CREATE SET a.name=$aid "
            "CREATE (a)-[:RAN]->(e:Episode {id:$eid, question:$q, answer:$ans, mode:$mode, at:$at}) "
            "WITH e UNWIND $beliefs AS bid MATCH (b:Belief {id:bid}) MERGE (e)-[:RECALLED]->(b)",
            {"aid": agent_id, "eid": eid, "q": question, "ans": answer, "mode": mode, "at": now_iso(), "beliefs": beliefs},
        )
        if produced:
            self.db.q("MATCH (e:Episode {id:$eid}), (s:Source {id:$sid}) MERGE (e)-[:PRODUCED]->(s)",
                      {"eid": eid, "sid": produced})
        return eid

    def episodes(self, limit: int = 20) -> list[dict[str, Any]]:
        return self.db.q(
            "MATCH (a:Agent)-[:RAN]->(e:Episode) OPTIONAL MATCH (e)-[:RECALLED]->(b:Belief) "
            "RETURN e.id AS id, a.id AS agent, e.question AS question, e.answer AS answer, e.mode AS mode, "
            "e.at AS at, collect(b.id) AS beliefs ORDER BY e.at DESC LIMIT $n", {"n": limit}, ro=True,
        )

    # ------------------------------------------------------------------ reads

    def recall(self, query: str, k: int = 6) -> list[dict[str, Any]]:
        vec = embed.embed_one(query)
        rows = self.db.q(
            "CALL db.idx.vector.queryNodes('Belief','embedding',$k,vecf32($v)) YIELD node, score "
            "OPTIONAL MATCH (node)-[:ABOUT]->(e:Entity) "
            "RETURN node.id AS id, node.statement AS statement, e.name AS subject, 1 - score AS similarity, "
            + ", ".join(f"node.{f} AS {f}" for f in VERDICT_FIELDS) + " ORDER BY similarity DESC",
            {"k": k, "v": vec}, ro=True,
        )
        return [r for r in rows if r["similarity"] is not None]

    def ledger(self) -> list[dict[str, Any]]:
        return self.db.q(
            "MATCH (b:Belief) OPTIONAL MATCH (b)-[:ABOUT]->(e:Entity) "
            "RETURN b.id AS id, b.statement AS statement, e.name AS subject, b.updated_at AS updated_at, "
            + ", ".join(f"b.{f} AS {f}" for f in VERDICT_FIELDS) + " ORDER BY b.sources DESC, b.id",
            ro=True,
        )

    def load_bearing(self, limit: int = 8) -> list[dict[str, Any]]:
        """Origins the most beliefs rest on: PageRank over lineage + blast radius."""
        with capture() as log:
            ranked = self.db.q(
                "CALL algo.pageRank('Source', null) YIELD node, score "
                "WHERE node.kind <> 'agent' "
                f"AND NOT (node)-[:{LINEAGE}]->(:Source) "
                "RETURN node.id AS id, node.title AS title, node.url AS url, node.kind AS kind, "
                "node.retracted AS retracted, score ORDER BY score DESC LIMIT $n",
                {"n": limit}, ro=True,
            )
            for r in ranked:
                br = self.db.one(
                    f"MATCH (o:Source {{id:$id}})<-[:{LINEAGE}*0..{DEPTH}]-(d:Source)-[:YIELDED]->(:Observation)-[:SUPPORTS]->(b:Belief) "
                    "RETURN count(DISTINCT b) AS beliefs, count(DISTINCT d) AS dependents",
                    {"id": r["id"]}, ro=True,
                ) or {}
                r["beliefs"] = br.get("beliefs", 0)
                r["dependents"] = br.get("dependents", 0)
                r["score"] = round(r["score"], 4)
        return {"origins": ranked, "cypher": log.entries}

    def families(self) -> dict[str, Any]:
        """Weakly connected components of the lineage + ownership graph."""
        with capture() as log:
            rows = self.db.q(
                "CALL algo.WCC({nodeLabels:['Source','Owner'], "
                "relationshipTypes:['CITES','COPIED_FROM','DERIVED_FROM','PUBLISHED_BY']}) "
                "YIELD node, componentId WITH componentId, collect(node) AS ns "
                "RETURN componentId AS id, [n IN ns WHERE n:Source | n.id] AS sources, "
                "[n IN ns WHERE n:Owner | n.id] AS owners ORDER BY size(sources) DESC",
                ro=True,
            )
        return {"families": [r for r in rows if r["sources"]], "cypher": log.entries}

    def rings(self) -> dict[str, Any]:
        """Suspected content rings: label-propagation communities of web sources bound by
        copying and shared network fingerprints (affiliate tags, analytics IDs)."""
        with capture() as log:
            rows = self.db.q(
                "CALL algo.labelPropagation({nodeLabels:['Source','Owner'], "
                "relationshipTypes:['COPIED_FROM','PUBLISHED_BY']}) "
                "YIELD node, communityId WITH communityId, collect(node) AS ns "
                "WITH communityId, [n IN ns WHERE n:Source AND n.kind = 'web'] AS srcs, "
                "[n IN ns WHERE n:Owner AND n.kind = 'network'] AS nets "
                "WHERE size(srcs) >= 3 "
                "RETURN communityId AS id, [s IN srcs | s.id] AS sources, [s IN srcs | s.title] AS titles, "
                "[w IN nets | w.id] AS networks ORDER BY size(srcs) DESC",
                ro=True,
            )
        return {"rings": rows, "cypher": log.entries}

    def stats(self) -> dict[str, Any]:
        r = self.db.one(
            "OPTIONAL MATCH (s:Source) WHERE s.kind <> 'stub' AND s.kind <> 'ident' WITH count(s) AS sources "
            "OPTIONAL MATCH (b:Belief) WITH sources, count(b) AS beliefs, sum(b.mentions) AS mentions, "
            "sum(CASE WHEN b.echo THEN 1 ELSE 0 END) AS echoes, "
            "sum(CASE WHEN b.status = 'VERIFIED' THEN 1 ELSE 0 END) AS verified "
            "OPTIONAL MATCH ()-[e:CITES|COPIED_FROM|DERIVED_FROM]->() "
            "RETURN sources, beliefs, mentions, echoes, verified, count(e) AS lineage_edges",
            ro=True,
        ) or {}
        return r

    def graph(self) -> dict[str, Any]:
        """Everything the UI needs to draw the memory graph."""
        nodes = self.db.q(
            "MATCH (n) WHERE n:Source OR n:Owner OR n:Belief OR n:Entity OR n:Agent OR n:Episode "
            "RETURN n.id AS id, labels(n)[0] AS label, coalesce(n.title, n.statement, n.name, n.question, n.id) AS name, "
            "n.kind AS kind, n.url AS url, n.retracted AS retracted, n.status AS status, n.origins AS origins, "
            "n.sources AS sources, n.echo AS echo, n.published_at AS published_at, n.author AS author",
            ro=True,
        )
        edges = self.db.q(
            "MATCH (a)-[e]->(b) WHERE type(e) IN ['CITES','COPIED_FROM','DERIVED_FROM','PUBLISHED_BY','WRITTEN_BY','ABOUT','RAN','RECALLED','PRODUCED'] "
            "RETURN a.id AS source, b.id AS target, type(e) AS type, e.method AS method, e.evidence AS evidence "
            "UNION ALL "
            "MATCH (s:Source)-[:YIELDED]->(o:Observation)-[r]->(b:Belief) "
            "RETURN s.id AS source, b.id AS target, type(r) AS type, null AS method, o.quote AS evidence",
            ro=True,
        )
        return {"nodes": nodes, "edges": edges}

    def source(self, sid: str) -> dict[str, Any] | None:
        return self.db.one(
            "MATCH (s:Source {id:$id}) OPTIONAL MATCH (s)-[:PUBLISHED_BY]->(w:Owner) "
            "RETURN s.id AS id, s.kind AS kind, s.title AS title, s.url AS url, s.author AS author, "
            "s.published_at AS published_at, s.text AS text, s.retracted AS retracted, "
            "s.retract_reason AS retract_reason, collect(w {.id, .name, .kind}) AS owners",
            {"id": sid}, ro=True,
        )

    def cypher(self, query: str, params: dict | None = None) -> dict[str, Any]:
        """Read-only Cypher for agents (GRAPH.RO_QUERY: writes are rejected by FalkorDB)."""
        with capture() as log:
            rows = self.db.q(query, params or {}, ro=True)[:50]
        return {"rows": rows, "cypher": log.entries}


def _attribution(source_id: str, who: str):
    from .lineage import Dependence

    return Dependence("CITES", source_id, f"attrib:{slug(who)}", "attribution", 0.8, f"text attributes the claim to {who}")
