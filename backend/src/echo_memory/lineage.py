"""Lineage detection: how does a new source depend on sources already in memory?

Echo infers five kinds of dependence. Each becomes an edge in FalkorDB so the
independence check is a graph traversal, and each edge carries the evidence
that produced it so every verdict can be explained.

  CITES         explicit links, and shared identifiers (CVE, DOI, arXiv) that
                point at a common upstream record
  COPIED_FROM   verbatim/excerpt copies (word-shingle containment), paraphrases
                (sentence TF-IDF alignment), and shared precise figures
  DERIVED_FROM  agent-written notes -> the sources the agent read
  PUBLISHED_BY  ownership: registrable domain, named author, and network
                fingerprints (affiliate tags, analytics/ad IDs)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import tldextract

_extract = tldextract.TLDExtract(suffix_list_urls=())  # bundled snapshot, no network

PLATFORMS = {
    "medium.com", "substack.com", "reddit.com", "wordpress.com", "blogspot.com", "github.io",
    "dev.to", "linkedin.com", "x.com", "twitter.com", "youtube.com", "ycombinator.com",
    "quora.com", "hashnode.dev", "github.com", "notion.site", "wikipedia.org", "stackexchange.com",
}
PATH_PLATFORMS = {"github.com", "medium.com", "x.com", "twitter.com", "youtube.com", "linkedin.com"}
GENERIC_AUTHORS ={"", "staff", "admin", "editor", "editors", "editorial team", "team", "guest",
                   "anonymous", "unknown", "contributor", "newsroom", "the team"}
TRACKING_PARAMS = {"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"}

_LINK_RES = [
    re.compile(r"\[[^\]]*\]\((https?://[^)\s]+)\)"),
    re.compile(r"href=[\"'](https?://[^\"']+)[\"']"),
    re.compile(r"(?<![(\"'=])(https?://[^\s<>()\"']+)"),
]
_IDENT_RES = [
    ("cve", re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.I)),
    ("doi", re.compile(r"\b10\.\d{4,9}/[^\s\"<>,;]+[^\s\"<>,;.)]")),
    ("arxiv", re.compile(r"\barXiv:\s?(\d{4}\.\d{4,5})(v\d+)?\b", re.I)),
]
_NET_RES = [
    ("ga", re.compile(r"\b(UA-\d{4,10}-\d{1,4}|G-[A-Z0-9]{8,12})\b")),
    ("adsense", re.compile(r"\b(pub-\d{10,20})\b")),
    ("affiliate", re.compile(r"[?&](?:ref|aff|affiliate|partner|tag|via)=([A-Za-z0-9_-]{4,40})")),
]
# Precise figures rarely arise independently: 99.982%, $4.71M, 1,284 hospitals, 3.6x.
_SPECIFIC = re.compile(
    r"(?<![\w.])(\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\$?\d+\.\d{2,}%?|\$?\d+\.\d+\s?(?:x|ms|%|M|B|K|GB|TB)\b|\d{3,}\s?(?:ms|hospitals|clinics|customers|teams|deployments|endpoints|patients))",
)
_YEAR = re.compile(r"^(19|20)\d{2}$")
_WORD = re.compile(r"[a-z0-9']+")
_SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])")


@dataclass
class SourceDoc:
    id: str
    text: str
    url: str | None = None
    title: str = ""
    author: str = ""
    published_at: str = ""  # ISO-8601; empty = unknown
    kind: str = "web"  # web | doc | agent | user | stub
    derived_from: list[str] = field(default_factory=list)  # agent notes only
    extra_links: list[str] = field(default_factory=list)
    raw: str = ""  # raw HTML (head, scripts) scanned for network fingerprints only

    @property
    def body(self) -> str:
        return f"{self.title}\n{self.text}" if self.title else self.text


@dataclass
class Dependence:
    rel: str  # CITES | COPIED_FROM | DERIVED_FROM
    src: str  # dependent source id
    dst: str  # upstream source id
    method: str
    score: float = 1.0
    evidence: str = ""


@dataclass
class OwnerKey:
    id: str
    name: str
    kind: str  # domain | author | network


# ---------------------------------------------------------------- URLs & owners


def normalize_url(url: str) -> str:
    p = urlsplit(url.strip())
    host = (p.hostname or "").lower().removeprefix("www.")
    q = urlencode(sorted((k, v) for k, v in parse_qsl(p.query) if k.lower() not in TRACKING_PARAMS))
    path = p.path.rstrip("/") or "/"
    return urlunsplit(("https", host, path, q, ""))


def site_of(url: str | None) -> str:
    """Registrable domain, or the full host for platform-hosted sites (foo.substack.com)."""
    if not url:
        return ""
    ext = _extract(url)
    reg = ext.top_domain_under_public_suffix if hasattr(ext, "top_domain_under_public_suffix") else ext.registered_domain
    reg = (reg or "").lower()
    if reg in PLATFORMS:
        p = urlsplit(url)
        host = (p.hostname or "").lower().removeprefix("www.")
        if host != reg:  # foo.substack.com: the subdomain is the publisher
            return host
        seg = next((s for s in p.path.split("/") if s), "")
        if reg in PATH_PLATFORMS and seg:  # github.com/org, medium.com/@user
            return f"{reg}/{seg.lower()}"
        return ""  # reddit, HN...: only the author identifies the publisher
    return reg


def owner_keys(doc: SourceDoc) -> list[OwnerKey]:
    keys: list[OwnerKey] = []
    site = site_of(doc.url)
    if site:
        keys.append(OwnerKey(f"domain:{site}", site, "domain"))
    a = re.sub(r"\s+", " ", doc.author.strip().lower())
    if a not in GENERIC_AUTHORS and len(a) > 2:
        keys.append(OwnerKey(f"author:{a}", doc.author.strip(), "author"))
    seen = set()
    for kind, rx in _NET_RES:
        for m in rx.finditer(" ".join([doc.text, doc.raw, *doc.extra_links])):
            tag = m.group(1)
            if tag not in seen:
                seen.add(tag)
                keys.append(OwnerKey(f"net:{kind}:{tag}", f"{kind} {tag}", "network"))
    return keys


MAX_LINK_STUBS = 24


def links_in(doc: SourceDoc) -> list[str]:
    out, seen = [], set()
    for rx in _LINK_RES:
        for m in rx.finditer(doc.text):
            u = m.group(1).rstrip(".,;:")
            n = normalize_url(u)
            if n not in seen:
                seen.add(n)
                out.append(n)
    for u in doc.extra_links:
        n = normalize_url(u)
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out


def is_commercial(link: str) -> bool:
    """Partner/affiliate links are a fingerprint of who profits, not a citation of where a claim came from."""
    return bool(_NET_RES[2][1].search(link))


def identifiers_in(text: str) -> list[str]:
    ids = []
    for kind, rx in _IDENT_RES:
        for m in rx.finditer(text):
            val = (m.group(1) if kind == "arxiv" else m.group(0)).upper() if kind != "doi" else m.group(0).lower()
            key = f"{kind}:{val}"
            if key not in ids:
                ids.append(key)
    return ids


# ---------------------------------------------------------------- text similarity


def words(text: str) -> list[str]:
    return _WORD.findall(text.lower())


def shingles(text: str, k: int = 5) -> set[tuple[str, ...]]:
    w = words(text)
    return {tuple(w[i : i + k]) for i in range(max(0, len(w) - k + 1))}


def containment(a: set, b: set) -> float:
    """Share of a's shingles that also appear in b."""
    return len(a & b) / len(a) if a else 0.0


def sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT.split(re.sub(r"\s+", " ", text)) if len(words(s)) >= 6]


def specifics(text: str) -> set[str]:
    out = set()
    for m in _SPECIFIC.finditer(text):
        s = m.group(1).replace(" ", "").lower()
        if not _YEAR.match(s):
            out.add(s)
    return out


def _paraphrase_alignment(a_sents: list[str], b_sents: list[str], corpus_sents: list[str]) -> tuple[float, str]:
    """Fraction of a's sentences that align (TF-IDF cosine) to some sentence of b."""
    if len(a_sents) < 2 or not b_sents:
        return 0.0, ""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english", min_df=1)
    vec.fit(corpus_sents + a_sents + b_sents)
    sim = cosine_similarity(vec.transform(a_sents), vec.transform(b_sents))
    best = sim.max(axis=1)
    hits = [i for i, v in enumerate(best) if v >= PARAPHRASE_SENT_SIM]
    if len(hits) < 2:  # a single matching sentence is a shared fact, not a paraphrased page
        return 0.0, ""
    frac = len(hits) / len(a_sents)
    ev = a_sents[hits[0]] if hits else ""
    return frac, ev


VERBATIM_CONTAINMENT = 0.30
MIN_SHARED_SHINGLES = 15
PARAPHRASE_SENT_SIM = 0.42
PARAPHRASE_FRACTION = 0.45
SHARED_SPECIFICS = 2


def _earlier(a: SourceDoc, b: SourceDoc, order: dict[str, int]) -> bool:
    """True when a was published before b (falls back to ingest order)."""
    if a.published_at and b.published_at and a.published_at != b.published_at:
        return a.published_at < b.published_at
    return order.get(a.id, 0) < order.get(b.id, 0)


def detect(new: SourceDoc, corpus: list[SourceDoc], order: dict[str, int] | None = None) -> list[Dependence]:
    """All dependence edges between `new` and the existing corpus (both directions)."""
    order = order or {d.id: i for i, d in enumerate(corpus)} | {new.id: len(corpus)}
    deps: list[Dependence] = []
    by_url = {normalize_url(d.url): d for d in corpus if d.url}

    # Agent notes: explicit derivation, nothing to infer.
    for up in new.derived_from:
        deps.append(Dependence("DERIVED_FROM", new.id, up, "agent-note", 1.0, "written by an agent from this source"))
    if new.kind == "agent":  # an agent's note has exactly the lineage it declares, nothing inferred
        return deps

    # Explicit citations (resolved later against stubs when the target is unknown).
    own = normalize_url(new.url) if new.url else None
    home, stubs = site_of(new.url), 0
    for link in links_in(new):
        if link == own or is_commercial(link):
            continue
        tgt = by_url.get(link)
        if not tgt:
            # Links to unknown pages on the same site are navigation (same owner anyway); cap the rest.
            if (home and site_of(link) == home) or stubs >= MAX_LINK_STUBS:
                continue
            stubs += 1
        deps.append(Dependence("CITES", new.id, tgt.id if tgt else f"url:{link}", "hyperlink", 1.0, link))
    for d in corpus:  # existing docs that link to the new one
        if own and own in links_in(d) and d.id != new.id:
            deps.append(Dependence("CITES", d.id, new.id, "hyperlink", 1.0, own))

    # Shared identifiers: both point at the same upstream record.
    for ident in identifiers_in(new.body):
        deps.append(Dependence("CITES", new.id, f"id:{ident}", "identifier", 1.0, ident))

    if new.kind in ("agent", "stub"):
        return deps

    new_sh = shingles(new.body)
    new_sents = sentences(new.body)
    new_spec = specifics(new.body)
    corpus_sents = [s for d in corpus for s in sentences(d.body)][:4000]

    for d in corpus:
        if d.id == new.id or d.kind in ("agent", "stub"):
            continue
        new_first = _earlier(new, d, order)
        copier, original = (d, new) if new_first else (new, d)

        c_sh = new_sh if copier is new else shingles(d.body)
        o_sh = shingles(d.body) if copier is new else new_sh
        cont = containment(c_sh, o_sh)
        # One shared sentence is how two honest sources state the same fact; a copy shares passages.
        if cont >= VERBATIM_CONTAINMENT and len(c_sh & o_sh) >= MIN_SHARED_SHINGLES:
            deps.append(Dependence("COPIED_FROM", copier.id, original.id, "verbatim", round(cont, 3),
                                   f"{cont:.0%} of word 5-grams appear in the earlier source"))
            continue

        shared = sorted(new_spec & specifics(d.body))
        if len(shared) >= SHARED_SPECIFICS:
            deps.append(Dependence("COPIED_FROM", copier.id, original.id, "shared-specifics",
                                   min(1.0, len(shared) / 4), "same precise figures: " + ", ".join(shared[:4])))
            continue

        c_sents = new_sents if copier is new else sentences(d.body)
        o_sents = sentences(d.body) if copier is new else new_sents
        frac, ev = _paraphrase_alignment(c_sents, o_sents, corpus_sents)
        if frac >= PARAPHRASE_FRACTION:
            deps.append(Dependence("COPIED_FROM", copier.id, original.id, "paraphrase", round(frac, 3),
                                   f"{frac:.0%} of sentences paraphrase the earlier source, e.g. “{ev[:140]}”"))
    return deps
