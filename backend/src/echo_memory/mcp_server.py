"""Echo as an MCP server: any MCP client (Claude Desktop, Claude Code, Cursor...) can give
its agent independence-aware memory.

  stdio:  uv run echo-mcp
  http:   mounted by the API at /mcp (streamable HTTP)
"""

from __future__ import annotations

from typing import Any

from mcp.server.mcpserver import MCPServer

from .lineage import SourceDoc
from .memory import Claim, EchoMemory, slug

INSTRUCTIONS = (
    "Echo is a memory layer that counts independent origins, not mentions. Before treating a remembered claim as "
    "established, call echo_check: only VERIFIED (2+ independent origins) is established. When sources > origins, "
    "the claim is an echo. Use echo_remember to store findings with the source ids they came from, so your own notes "
    "never count as new evidence. Every tool takes a workspace (default 'halcyon', a seeded demo)."
)

mcp = MCPServer("echo-memory", title="Echo: independence-aware agent memory", instructions=INSTRUCTIONS)


def _verdict(r: dict) -> dict:
    keys = ("id", "statement", "subject", "status", "mentions", "sources", "origins", "against_origins", "confidence")
    return {k: r.get(k) for k in keys}


@mcp.tool(description="Search memory for beliefs relevant to a query, each with its independent-origin verdict.")
def echo_recall(query: str, workspace: str = "halcyon", k: int = 6) -> list[dict[str, Any]]:
    return [_verdict(r) for r in EchoMemory(workspace).recall(query, k)]


@mcp.tool(description="Independence report for a belief: origin clusters, why sources collapsed, lineage paths.")
def echo_check(belief_id: str, workspace: str = "halcyon") -> dict[str, Any]:
    bid = belief_id if belief_id.startswith("b:") else f"b:{belief_id}"
    rep = EchoMemory(workspace).report(bid)
    if not rep:
        return {"error": f"no belief {bid}"}
    rep.pop("cypher", None)
    return rep


@mcp.tool(description="Store a source (text you read) with the claims it makes. Echo infers its lineage "
          "(links, copies, paraphrases, shared owners) and rescores affected beliefs.")
def echo_ingest(text: str, title: str, claims: list[dict], workspace: str = "halcyon", url: str | None = None,
                author: str = "", published_at: str = "") -> dict[str, Any]:
    """claims: [{statement, subject, stance: supports|contradicts, quote?, belief_id?}]"""
    sid = "src:" + slug(url or title, 40)
    doc = SourceDoc(id=sid, text=text, url=url, title=title, author=author, published_at=published_at)
    cl = [Claim(statement=c["statement"], subject=c.get("subject", title), stance=c.get("stance", "supports"),
                quote=c.get("quote", ""), belief=(c.get("belief_id") or "").removeprefix("b:") or None) for c in claims]
    r = EchoMemory(workspace).ingest(doc, cl)
    r.pop("cypher", None)
    return r


@mcp.tool(description="Write an agent note. Pass the source ids it was derived from so the note can never be "
          "counted as independent evidence for what it summarises.")
def echo_remember(note: str, derived_from: list[str], statement: str | None = None, subject: str = "",
                  belief_id: str | None = None, agent: str = "mcp-agent", workspace: str = "halcyon") -> dict[str, Any]:
    claims = [Claim(statement=statement, subject=subject or "note", belief=(belief_id or "").removeprefix("b:") or None)] if statement else []
    r = EchoMemory(workspace).remember_note(agent, note, derived_from, claims)
    r.pop("cypher", None)
    return r


@mcp.tool(description="Retract (or restore) a source. Every belief that leaned on it is rescored immediately.")
def echo_retract(source_id: str, reason: str = "", restore: bool = False, workspace: str = "halcyon") -> dict[str, Any]:
    r = EchoMemory(workspace).set_retracted(source_id, not restore, reason)
    r.pop("cypher", None)
    return r


@mcp.tool(description="Origins the most beliefs rest on (PageRank over lineage) with their blast radius.")
def echo_load_bearing(workspace: str = "halcyon", limit: int = 6) -> list[dict[str, Any]]:
    return EchoMemory(workspace).load_bearing(limit)["origins"]


@mcp.tool(description="Read-only Cypher over the memory graph (FalkorDB GRAPH.RO_QUERY).")
def echo_cypher(cypher: str, workspace: str = "halcyon") -> list[dict[str, Any]]:
    return EchoMemory(workspace).cypher(cypher)["rows"]


def main() -> None:
    mcp.run("stdio")
