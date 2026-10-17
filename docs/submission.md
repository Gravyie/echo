# Submission text

**Project name:** Echo

**Tagline:** Agent memory that knows when five sources are really one.

**Tracks:** 02 Agent Memory and Coordination (primary), 01 Agents That Act on Connected Data

**Links:**
- Live demo: <VERCEL_URL>
- API (FalkorDB + agent, MCP at `/mcp/`): <SPACE_URL>
- Repository: <REPO_URL>
- Demo video: <VIDEO_URL>
- Blog post: <BLOG_URL>

## What it does

AI agents store what they read as long-term memory, and they trust a claim more when more sources repeat it. Five pages calling a vendor "the safest choice" look like strong evidence, even when all five copied one planted post. The same failure happens with no attacker, when an agent re-reads its own earlier summary and counts it as new evidence.

Echo is a memory layer on FalkorDB that tracks where each belief came from and counts **independent origins** instead of mentions:

- **Link:** every source gets edges back toward where it came from: hyperlinks and CVE/DOI identifiers, verbatim and paraphrased copies, shared precise figures, the agent's own notes, and shared owners (domain, author, affiliate tag, analytics ID). Each edge stores its evidence.
- **Collapse:** one variable-length Cypher traversal finds each supporting source's ancestors. Sources that share an ancestor or owner fold into one origin.
- **Decide:** only two or more independent origins make a belief VERIFIED. Retracting a source rescores every belief downstream of it in the same request.

## How FalkorDB is used

- Variable-length traversals decide every verdict and drive retraction.
- `shortestPath` gives the hop-by-hop proof for each collapsed source.
- `algo.pageRank` finds load-bearing origins (with blast radius), `algo.labelPropagation` finds content rings, and `algo.WCC` finds evidence families.
- A vector index provides semantic recall in the same graph.
- Multigraph plus `GRAPH.COPY` gives every visitor a private graph cloned in milliseconds.
- `GRAPH.RO_QUERY` lets the agent run its own Cypher safely.

## Results (30 scripted scenarios, same scoring rule for both)

- **Plain memory** states 17 of 18 poisoned claims as fact.
- **Echo** states 1 of 18, and still trusts all 12 genuine claims.
- **Known limit:** a reworded copy with no link, figures or shared owner is not caught (2/10). It is in the eval on purpose.

## Built with

FalkorDB, Python, FastAPI, Groq (gpt-oss-120b), fastembed, scikit-learn, trafilatura, MCP, Next.js 16, React 19, Tailwind v4, Motion, react-force-graph.

All FalkorDB work was built during the hackathon. All companies, people and sites in the demo data are fictional.
