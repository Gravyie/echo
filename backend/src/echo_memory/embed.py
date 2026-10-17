"""Local sentence embeddings for belief recall and canonicalisation.

fastembed (ONNX, CPU) when available; otherwise a deterministic hashed bag-of-words
vector so Echo still works fully offline.
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
import threading

from .config import settings

log = logging.getLogger(__name__)
_model = None
_lock = threading.Lock()
_failed = False
_TOKEN = re.compile(r"[a-z0-9]+")


def _hashed(text: str, dim: int) -> list[float]:
    v = [0.0] * dim
    toks = _TOKEN.findall(text.lower())
    grams = toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:])]
    for t in grams:
        h = int.from_bytes(hashlib.blake2b(t.encode(), digest_size=8).digest(), "big")
        v[h % dim] += 1.0 if (h >> 32) & 1 else -1.0
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def _load():
    global _model, _failed
    if _model is not None or _failed or settings().disable_fastembed:
        return _model
    with _lock:
        if _model is None and not _failed:
            try:
                from fastembed import TextEmbedding

                _model = TextEmbedding(settings().embed_model)
            except Exception as e:  # offline, no model cache, etc.
                log.warning("fastembed unavailable (%s); using hashed embeddings", e)
                _failed = True
    return _model


def embed(texts: list[str]) -> list[list[float]]:
    dim = settings().embed_dim
    m = _load()
    if m is None:
        return [_hashed(t, dim) for t in texts]
    return [list(map(float, v)) for v in m.embed(texts)]


def embed_one(text: str) -> list[float]:
    return embed([text])[0]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b)) / ((math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))) or 1)


def backend() -> str:
    return "fastembed:" + settings().embed_model if _load() is not None else "hashed-bow"
