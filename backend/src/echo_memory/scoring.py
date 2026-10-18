"""Independence scoring.

Given the support for a belief and the lineage subgraph above it, collapse
sources that share an ancestor or an owner into one *origin cluster*, then
score the belief with a simple log-odds rule.

The same rule scores the "plain memory" baseline; the only difference is that
plain memory treats every mention as its own piece of evidence.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field

DEFAULT_TRUST = {"web": 0.6, "doc": 0.7, "user": 0.8, "stub": 0.55, "ident": 0.85, "agent": 0.0}
MAX_TRUST = 0.95


@dataclass
class SupportItem:
    observation_id: str
    source_id: str
    stance: str  # supports | contradicts
    quote: str = ""


@dataclass
class SourceInfo:
    id: str
    kind: str
    title: str = ""
    url: str | None = None
    retracted: bool = False
    trust: float | None = None
    owners: list[str] = field(default_factory=list)

    def weight(self) -> float:
        if self.retracted:
            return 0.0
        t = self.trust if self.trust is not None else DEFAULT_TRUST.get(self.kind, 0.6)
        return min(MAX_TRUST, max(0.0, t))


@dataclass
class Cluster:
    stance: str
    members: list[str]  # supporting/contradicting source ids
    roots: list[str]  # live origins (not blocked by retraction)
    dead_roots: list[str]  # origins cut off by a retraction
    shared_owners: list[str]
    weight: float
    reason: str  # why the members collapsed

    @property
    def live(self) -> bool:
        return self.weight > 0


@dataclass
class Verdict:
    mentions: int
    sources: int
    origins: int  # independent live supporting clusters
    against_origins: int
    confidence: float
    status: str  # VERIFIED | CORROBORATING | SINGLE_ORIGIN | CONTESTED | DISPUTED | UNSUPPORTED | RETRACTED
    echo: bool  # more sources than origins
    plain_confidence: float
    plain_status: str
    clusters: list[Cluster]

    def as_dict(self) -> dict:
        d = asdict(self)
        d["echo_ratio"] = round(self.sources / self.origins, 2) if self.origins else None
        return d


class _UF:
    def __init__(self, items):
        self.p = {i: i for i in items}

    def find(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[max(ra, rb)] = min(ra, rb)


def live_ancestry(start: str, parents: dict[str, list[str]], info: dict[str, SourceInfo]) -> tuple[set[str], set[str], set[str]]:
    """Walk upstream from `start`. Retracted nodes block the walk.

    Returns (ancestors incl. start, live roots, dead roots). A root is a node with
    no upstream edge; in a citation cycle every node of the cycle is treated as root.
    """
    seen, live, dead = set(), set(), set()
    stack = [start]
    while stack:
        n = stack.pop()
        if n in seen:
            continue
        seen.add(n)
        node = info.get(n)
        if node and node.retracted:
            dead.add(n)
            continue
        ups = parents.get(n, [])
        if not ups:
            live.add(n)
        stack.extend(ups)
    if not live and not dead:  # no root: the origin is the citation loop itself
        live = {n for n in seen if _on_cycle(n, parents, seen)}
    return seen, live, dead


def _on_cycle(n: str, parents: dict[str, list[str]], within: set[str]) -> bool:
    stack, seen = list(parents.get(n, [])), set()
    while stack:
        x = stack.pop()
        if x == n:
            return True
        if x in seen or x not in within:
            continue
        seen.add(x)
        stack.extend(parents.get(x, []))
    return False


def _logodds(w: float) -> float:
    w = min(MAX_TRUST, max(1e-6, w))
    return math.log(w / (1 - w))


def _confidence(support: list[float], against: list[float]) -> float:
    z = sum(_logodds(w) for w in support if w > 0) - sum(_logodds(w) for w in against if w > 0)
    return 1 / (1 + math.exp(-z))


def score(
    items: list[SupportItem],
    info: dict[str, SourceInfo],
    parents: dict[str, list[str]],
    min_origins: int = 2,
) -> Verdict:
    by_stance: dict[str, list[str]] = {"supports": [], "contradicts": []}
    for it in items:
        lst = by_stance.setdefault(it.stance, [])
        if it.source_id not in lst:
            lst.append(it.source_id)

    clusters: list[Cluster] = []
    for stance, srcs in by_stance.items():
        if not srcs:
            continue
        anc, live, dead = {}, {}, {}
        for s in srcs:
            anc[s], live[s], dead[s] = live_ancestry(s, parents, info)
        uf = _UF(srcs)
        why: dict[tuple[str, str], str] = {}
        for i, a in enumerate(srcs):
            for b in srcs[i + 1 :]:
                common = anc[a] & anc[b]
                if common:
                    uf.union(a, b)
                    why[(a, b)] = "shared ancestor " + ", ".join(sorted(common)[:3])
                    continue
                own = set(info[a].owners if a in info else []) & set(info[b].owners if b in info else [])
                if own:
                    uf.union(a, b)
                    why[(a, b)] = "same owner " + ", ".join(sorted(own)[:3])
        groups: dict[str, list[str]] = {}
        for s in srcs:
            groups.setdefault(uf.find(s), []).append(s)
        for members in groups.values():
            roots = sorted(set().union(*(live[m] for m in members)))
            dead_roots = sorted(set().union(*(dead[m] for m in members)))
            owners = set(info[members[0]].owners) if members[0] in info else set()
            for m in members[1:]:
                owners &= set(info[m].owners) if m in info else set()
            # Cluster weight: the most trustworthy live origin it rests on.
            # A note the agent wrote itself is never evidence on its own.
            w = max((info[r].weight() for r in roots if r in info), default=0.0)
            if all(info.get(m) and info[m].kind == "agent" for m in members):
                w = 0.0  # notes the agent wrote are never evidence on their own
            reasons = sorted({v for (a, b), v in why.items() if a in members and b in members})
            clusters.append(
                Cluster(stance, sorted(members), roots, dead_roots, sorted(owners), round(w, 3),
                        "; ".join(reasons) if reasons else ("independent" if len(members) == 1 else ""))
            )

    sup = [c for c in clusters if c.stance == "supports"]
    con = [c for c in clusters if c.stance == "contradicts"]
    live_sup = [c for c in sup if c.live]
    live_con = [c for c in con if c.live]
    conf = _confidence([c.weight for c in live_sup], [c.weight for c in live_con])

    sup_sources = by_stance.get("supports", [])
    if sup and not live_sup and any(c.dead_roots for c in sup):
        status = "RETRACTED"
    elif sup and not live_sup:
        status = "UNSUPPORTED"
    elif live_con and conf < 0.35:
        status = "DISPUTED"
    elif live_con and conf < 0.65:
        status = "CONTESTED"
    elif len(live_sup) >= min_origins and conf >= 0.65:
        status = "VERIFIED"
    elif live_sup:
        # independent but not enough of them for this memory's policy (or too weak); nothing disagrees
        status = "SINGLE_ORIGIN" if len(live_sup) == 1 else ("CONTESTED" if live_con else "CORROBORATING")
    else:
        status = "UNSUPPORTED"

    # Plain memory: every mention counts, retractions are invisible, self-notes count.
    plain_sup = [DEFAULT_TRUST["web"] for it in items if it.stance == "supports"]
    plain_con = [DEFAULT_TRUST["web"] for it in items if it.stance == "contradicts"]
    plain_conf = _confidence(plain_sup, plain_con)
    plain_status = (
        f"CONFIRMED by {len(plain_sup)} sources" if len(plain_sup) >= min_origins and plain_conf >= 0.65
        else ("DISPUTED" if plain_conf < 0.35 else "REPORTED")
    )

    return Verdict(
        mentions=len(items),
        sources=len(sup_sources),
        origins=len(live_sup),
        against_origins=len(live_con),
        confidence=round(conf, 3),
        status=status,
        echo=len(sup_sources) > max(1, len(live_sup)),
        plain_confidence=round(plain_conf, 3),
        plain_status=plain_status,
        clusters=clusters,
    )
