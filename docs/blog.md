# Five sources, one origin: teaching agent memory to count independence with FalkorDB

*Built for Graph Hacks 2026 (WeMakeDevs × FalkorDB). Live demo: [echo-memory-rho.vercel.app](https://echo-memory-rho.vercel.app). Code: [github.com/Gravyie/echo](https://github.com/Gravyie/echo).*

An agent researching LLM gateways for a hospital reads five pages that call one vendor "the safest choice for patient data". Five sources agree, so it stores the claim as well supported, and from then on it recommends that vendor in every session.

All five pages copied one planted blog post. One copies it word for word. Two link to it. One shares its affiliate tag. One is a forum thread linking to one of the copies.

There doesn't even have to be an attacker. An agent that re-reads its own earlier summary and counts it as fresh evidence makes the same mistake. Journalists call this **circular reporting**. Agent memory systems count how often a claim appears and how often it is used. None of the ones I looked at ask whether those appearances are *independent*.

Echo is a memory layer that asks that question, and FalkorDB is what makes it a query rather than a research project.

## The idea: count origins, not mentions

Echo stores every source as a node and links it back toward where it came from. To judge a belief, it walks each supporting source up its lineage, folds together the sources that share an ancestor or an owner, and counts what is left: the **independent origins**. Only two or more origins make a belief `VERIFIED`.

There are three steps:

1. **Link.** When a source is added, Echo finds what it depends on and writes an edge for each dependence, with the evidence on the edge:
   - hyperlinks and shared identifiers (CVE, DOI, arXiv) become `CITES`;
   - verbatim passages (5-gram shingle containment), paraphrased sentences (TF-IDF sentence alignment) and shared precise figures ("99.982%") become `COPIED_FROM`;
   - the agent's own notes become `DERIVED_FROM` the sources they were written from;
   - domains, authors, affiliate tags and analytics IDs become `Owner` nodes via `PUBLISHED_BY`.
2. **Collapse.** For a belief, one traversal finds every ancestor of every supporting source. Sources that share an ancestor or an owner fold into one cluster. Retracted nodes block the walk, and a citation loop counts once.
3. **Decide.** Confidence is a log-odds score over origin clusters, using exactly the rule a plain memory applies to raw mentions. The only thing that changes is what gets counted.

## Why a graph, and why FalkorDB

This problem is a graph problem in its plainest form. "Do these five pages have a common ancestor?" is a reachability question, and it is easy to get wrong with joins and recursion in application code. In Cypher it is one pattern:

```cypher
MATCH (s:Source) WHERE s.id IN $supporting
MATCH (s)-[:CITES|COPIED_FROM|DERIVED_FROM*0..8]->(a:Source)
WITH DISTINCT a
OPTIONAL MATCH (a)-[:CITES|COPIED_FROM|DERIVED_FROM]->(up:Source)
OPTIONAL MATCH (a)-[:PUBLISHED_BY]->(w:Owner)
RETURN a.id, a.retracted, a.trust, collect(DISTINCT up.id) AS ups, collect(DISTINCT w.id) AS owners
```

That returns the lineage neighbourhood of every supporting source in one round trip. Echo finds each source's live roots (a retracted node blocks the walk, and a loop with no root becomes its own origin), merges sources that share a root or an owner with union-find, and the verdict is the number of clusters left.

Retraction runs the same walk in the other direction. When a source turns out to be planted, every belief downstream of it is rescored in the same request (about 12 to 17 ms for the demo graph):

```cypher
MATCH (s:Source) WHERE s.id IN $ids
MATCH (s)<-[:CITES|COPIED_FROM|DERIVED_FROM*0..8]-(d:Source)
      -[:YIELDED]->(:Observation)-[:SUPPORTS|CONTRADICTS]->(b:Belief)
RETURN DISTINCT b.id
```

Other FalkorDB features the project relies on:

| Feature | What Echo does with it |
|---|---|
| `shortestPath` | the hop-by-hop proof shown for each collapsed source ("copied from → links to → origin") |
| `algo.pageRank` | **load-bearing origins**: which origins the most beliefs rest on, and how many would fall if each were wrong |
| `algo.labelPropagation` | **content rings**: sites bound together by copying and shared ad or affiliate IDs |
| `algo.WCC` | evidence families across the whole memory |
| Vector index | semantic recall of beliefs and matching new claims to existing beliefs, in the same database as the lineage |
| Multigraph + `GRAPH.COPY` | every visitor (or agent team) gets a private graph cloned from a seeded template in milliseconds |
| `GRAPH.RO_QUERY` | the agent may write its own Cypher, and the database rejects writes |

Two details took longer than expected:

- FalkorDB allows `shortestPath` only in `WITH` and `RETURN`, not in `MATCH`, so the proof query reads `MATCH (a:Source {id:$a}), (b:Source {id:$b}) WITH shortestPath((a)-[:CITES|COPIED_FROM|DERIVED_FROM*1..8]->(b)) AS p WHERE p IS NOT NULL RETURN ...`.
- The score `db.idx.vector.queryNodes` returns is cosine *distance*, not similarity.

Keeping vectors in the same graph paid off. Recall returns beliefs together with their verdicts in one round trip, and claim canonicalisation ("is this new sentence the same belief we already have?") never leaves the database.

## The agent

The research agent runs on Groq (`openai/gpt-oss-120b`) with tool calling. In Echo mode, its tools are graph operations:

- `recall_beliefs`: vector search, returning each belief with its sources and origins;
- `inspect_belief`: the independence report, with clusters, paths and contradicting origins;
- `load_bearing_origins`: PageRank;
- `query_graph`: read-only Cypher.

In plain mode it gets a single `search_memory` tool that reports mention counts. Both modes get the same trust policy: call a claim confirmed when two or more independent units back it. Echo's unit is an origin, the plain agent's unit is a source, and that is the only difference.

Every answer is written back to memory as a note. In Echo the note is `DERIVED_FROM` what the agent read and carries no evidential weight of its own. In plain memory it is one more source, so plain memory's count for the planted claim climbs from 5 to 6 the first time the agent repeats it. The studio shows this happen live.

## Results

I built a seeded, reproducible evaluation: 30 scenarios with 18 poisoned claims, each spread by 2 to 6 echo pages using six copying methods, and 12 genuine claims with independent support. Both memories see the same graph and use the same scoring rule.

| | Poisoned claims stated as fact | Genuine claims trusted |
|---|---|---|
| Plain memory (counts mentions) | 17 / 18 | 12 / 12 |
| Echo (counts origins) | 1 / 18 | 12 / 12 |

Detection by method:

| Verbatim | Hyperlink | Shared figures | Same ad network | Chain of copies | Reworded, no trace |
|---|---|---|---|---|---|
| 17/17 | 23/23 | 10/10 | 8/8 | 2/4 | 2/10 |

The last column matters. A reworded copy with no link, no shared figures and a different owner leaves no trace in the text, and Echo counts it as independent. That case is in the evaluation on purpose. It accounts for the one poisoned claim Echo still trusts, and for the chains built on such a copy. Claims are given to both systems as annotations, so these numbers measure lineage detection and scoring, not LLM claim extraction.

## What I would do next

- **Better paraphrase detection** (embedding alignment at sentence level, with the same evidence-on-the-edge discipline) to close the "reworded, no trace" gap.
- **Temporal reasoning**: a source published after the claim spread cannot be its origin, and `published_at` is already on every node.
- **Shared memory for agent teams**: one agent's note should never count as independent confirmation for another agent that read the same page. The `DERIVED_FROM` edges already support this.

## Try it

The studio clones a private FalkorDB graph for you. Ask the agent the hospital question, watch both answers stream in, open the disputed belief, then retract the planted post and watch every belief built on it fall. Echo also runs as an MCP server, so you can point Claude Code or Cursor at `https://echo-memory.onrender.com/mcp/` and give your own agent the same independence check.

*Every company, person and site in the demo data is fictional.*
