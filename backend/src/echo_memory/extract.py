"""Claim extraction for sources ingested live (URLs, pasted text).

With an LLM: atomic claims, each mapped onto an existing belief when it states
the same thing (so independent sources accumulate on one belief), plus any
"according to X" attribution, which becomes a lineage edge.

Without an LLM: a conservative heuristic that keeps declarative sentences and
maps them to existing beliefs by embedding similarity.
"""

from __future__ import annotations

import logging
import re

from . import embed, llm
from .lineage import sentences
from .memory import Claim, EchoMemory

log = logging.getLogger(__name__)

PROMPT = """You extract factual claims from a document for an agent memory system.

Return JSON: {"claims": [{"statement": str, "subject": str, "stance": "supports"|"contradicts",
"belief_id": str|null, "quote": str, "attributed_to": str|null}]}

Rules:
- At most 6 claims. Only checkable factual claims or recommendations that matter; skip boilerplate.
- "statement": one self-contained sentence, written so it can be true or false.
- "subject": the product, organisation, person or thing the claim is about (short name).
- If the claim states the same thing as one of the EXISTING BELIEFS, set "belief_id" to that id and
  "statement" to that belief's statement. Use "stance":"contradicts" when the document asserts the opposite
  of an existing belief. Otherwise "belief_id": null and "stance": "supports".
- "quote": the shortest exact span from the document that makes the claim.
- "attributed_to": if the document says the claim comes from someone else ("according to X", "X reported"),
  name X. Otherwise null.

EXISTING BELIEFS:
{beliefs}

DOCUMENT (title: {title}):
{text}
"""


def extract_claims(mem: EchoMemory, title: str, text: str) -> tuple[list[Claim], str]:
    """Returns (claims, method)."""
    existing = mem.recall(f"{title}\n{text[:1500]}", k=12)
    if llm.available():
        try:
            listing = "\n".join(f"- {b['id']}: {b['statement']}" for b in existing) or "(none yet)"
            msg = llm.chat(
                [{"role": "user", "content": PROMPT.replace("{beliefs}", listing).replace("{title}", title)
                  .replace("{text}", text[:9000])}],
                json_mode=True, temperature=0.0, max_tokens=1600,
            )
            data = llm.parse_json(msg.content or "{}")
            known = {b["id"]: b for b in existing}
            claims = []
            for c in (data.get("claims") or [])[:6]:
                st = (c.get("statement") or "").strip()
                if not st:
                    continue
                bid = c.get("belief_id")
                belief = bid.removeprefix("b:") if bid and bid in known else None
                if belief:
                    st = known[bid]["statement"]
                # A page can only contradict a belief that exists; otherwise the claim is its own, and it supports it.
                contra = c.get("stance") == "contradicts" and belief is not None
                claims.append(Claim(statement=st, subject=(c.get("subject") or title)[:80],
                                    stance="contradicts" if contra else "supports",
                                    quote=(c.get("quote") or st)[:400], belief=belief,
                                    attributed_to=c.get("attributed_to") or None))
            return claims, "llm"
        except Exception as e:
            log.warning("LLM extraction failed, using heuristic: %s", e)
    return _heuristic(existing, title, text), "heuristic"


_CUE = re.compile(r"\b(is|are|was|were|has|have|had|passed|found|shows?|adds?|sends?|supports?|meets?|"
                  r"reported|confirmed|designed|leaks?|uses?)\b", re.I)


def _heuristic(existing: list[dict], title: str, text: str) -> list[Claim]:
    cands = [s for s in sentences(text) if _CUE.search(s) and len(s) < 300 and not s.endswith("?")][:30]
    if not cands:
        return []
    vecs = embed.embed(cands)
    claims, used = [], set()
    bvecs = embed.embed([b["statement"] for b in existing]) if existing else []
    for s, v in zip(cands, vecs):
        best, bi = 0.0, -1
        for i, bv in enumerate(bvecs):
            c = embed.cosine(v, bv)
            if c > best:
                best, bi = c, i
        if bi >= 0 and best >= 0.8 and existing[bi]["id"] not in used:
            b = existing[bi]
            used.add(b["id"])
            claims.append(Claim(statement=b["statement"], subject=b.get("subject") or title, quote=s,
                                belief=b["id"].removeprefix("b:")))
    if not claims:  # nothing matched: keep the two most claim-like sentences as new beliefs
        subj = title.split(":")[0].split("|")[0].strip()[:60] or "Document"
        claims = [Claim(statement=s, subject=subj, quote=s) for s in cands[:2]]
    return claims[:6]
