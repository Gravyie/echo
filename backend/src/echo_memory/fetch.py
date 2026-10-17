"""Fetch a web page for ingestion, safely (http/https only, no private networks)."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit

import httpx
import trafilatura

UA = "Mozilla/5.0 (compatible; EchoMemory/0.1; +https://github.com/echo-memory)"
MAX_BYTES = 3_000_000


class FetchError(Exception):
    pass


def _check_host(url: str) -> None:
    p = urlsplit(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise FetchError("only http(s) URLs are allowed")
    try:
        infos = socket.getaddrinfo(p.hostname, p.port or (443 if p.scheme == "https" else 80))
    except socket.gaierror as e:
        raise FetchError(f"cannot resolve {p.hostname}") from e
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise FetchError("refusing to fetch a private or local address")


def fetch(url: str) -> dict:
    """Returns {url, title, author, published_at, text (markdown with links), raw (head html)}."""
    current = url
    with httpx.Client(headers={"User-Agent": UA}, timeout=15, follow_redirects=False) as c:
        for _ in range(5):
            _check_host(current)
            r = c.get(current)
            if r.is_redirect and r.headers.get("location"):
                current = str(r.next_request.url) if r.next_request else r.headers["location"]
                continue
            break
        else:
            raise FetchError("too many redirects")
    if r.status_code >= 400:
        raise FetchError(f"HTTP {r.status_code}")
    html = r.text[:MAX_BYTES]
    text = trafilatura.extract(html, output_format="markdown", include_links=True, include_comments=False,
                               url=current) or ""
    meta = trafilatura.extract_metadata(html, default_url=current)
    if not text.strip():
        raise FetchError("no readable text on that page")
    head = html.split("</head>", 1)[0][:40_000]
    return {
        "url": current,
        "title": (meta.title if meta and meta.title else current),
        "author": (meta.author if meta and meta.author else ""),
        "published_at": (meta.date if meta and meta.date else ""),
        "text": text[:20_000],
        "raw": head,
    }
