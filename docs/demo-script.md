# Demo video (about 2 minutes)

Record at 1440×900 in the studio, dark mode. Open a fresh tab or click **Reset** first so the counts start at 5.

| Time | On screen | Say |
|---|---|---|
| 0:00 | Landing hero, let the animation loop once | "An agent reads five pages that call a vendor the safest choice. All five copied one planted post. Plain memory counts five. Echo counts one." |
| 0:12 | Click **Open the studio** | "Echo is agent memory on FalkorDB. Every visitor gets a private graph, cloned with GRAPH.COPY." |
| 0:20 | Click the hospital question. Both runs stream in. | "Same research agent, same trust policy, asked twice. Once on plain memory, once on Echo." |
| 0:30 | Point at the plain answer | "Plain memory says Halcyon. Five sources confirm it." |
| 0:38 | Point at the Echo steps, expand one Cypher query | "Echo's tools are graph queries. It recalls with the vector index, then checks independence with a lineage traversal. You can see the Cypher and the milliseconds." |
| 0:50 | Echo answer, then click the disputed belief in the right panel | "Echo picks Corvid and says why: the 'safest' claim is six sources but one origin, with two independent origins against it." |
| 1:00 | Inspector: scroll the collapse list and the path | "Here's the proof: verbatim copy, hyperlink, same affiliate tag, a forum post that links to a copy. And the plain agent's own note, which plain memory now counts as a sixth source, carries zero weight here." |
| 1:15 | Click the origin, then **Retract this source** | "Say the security team flags that post. Retract it." |
| 1:20 | Toast and rescore diff | "Every belief built on it is rescored in the same request, here in about 15 milliseconds. Disputed becomes retracted, one origin becomes zero." |
| 1:30 | **Load-bearing** tab, then **Rings** tab | "PageRank shows which origins hold up the most beliefs. Label propagation finds the content ring: sites tied together by copying and a shared analytics ID." |
| 1:42 | Switch to **The circular citation** | "No attacker needed. A wiki cites a newspaper that copied the wiki. Echo counts the loop once." |
| 1:50 | Landing results section | "On a 30-scenario eval, plain memory states 17 of 18 poisoned claims as fact. Echo states one, and it still trusts every genuine claim. It's also an MCP server, so any agent can use it." |
| 2:00 | End on the studio | "Echo. Count origins, not mentions." |

Tips:
- If the LLM is slow, the built-in reasoner gives the same verdicts (unset `GROQ_API_KEY`), but the LLM version is the one to show.
- Run the question once before recording so Groq is warm, then click **Reset**.
