# Launch kit

**Video:** `launch/out/echo-launch.mp4` (1920×1080, 77 s, narrated, captioned). Re-render with `cd launch && pnpm render`.

## Better narration (pick one, then re-render)

1. **Groq Orpheus (free, about 10 seconds of setup).** Accept the model's terms once at
   https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english, then:
   ```bash
   cd launch && VOICE=troy python3 scripts/vo.py && pnpm render
   ```
   Voices to try: `troy`, `austin`, `daniel`, `hannah`, `diana`, `autumn`. The video re-times itself to the new clips.
2. **Your own voice** (best for a founder launch, like Voyager's). Record each line below as its own file, save as
   `launch/public/vo/00.wav` … `12.wav`, run `python3 scripts/vo.py --keep` (it measures your clips and re-times the video) and `pnpm render`.

### Script (13 lines, about 66 s)

| # | Line | On screen |
|---|---|---|
| 0 | Today, we're launching Echo. | Wordmark over the painting |
| 1 | Memory for AI agents that knows where every belief came from. | Tagline |
| 2 | Agents trust a claim more, each time they read it. | "Every repeat feels like proof." |
| 3 | But five pages saying the same thing can be one planted post, copied five times. | Five sources → 1 |
| 4 | Echo traces every claim back to its origin, and counts independent origins, not repeats. | The collapse |
| 5 | Ask your agent anything. It recalls what it knows, checks each belief's independence, and shows its work. | Agent run |
| 6 | Plain memory recommends the planted vendor. Echo sees five sources, one origin, and doesn't. | What Echo caught |
| 7 | Open the lineage, and see the proof. Every copy, every link, every shared figure. | Lineage |
| 8 | Retract the planted post, and everything built on it is rescored in milliseconds. | Retraction |
| 9 | Under the hood, it's FalkorDB. Every verdict is a graph traversal. PageRank finds the origins your beliefs rest on. And every memory is its own graph. | FalkorDB |
| 10 | Bring your own model. Set your own trust policy. And connect Echo to Claude Code, Cursor, or any agent over MCP. | Settings, Connect |
| 11 | On our benchmark, plain memory stated seventeen of eighteen poisoned claims as fact. Echo stated one. | 17/18 vs 1/18 |
| 12 | Echo. Count origins, not mentions. | End card |

## Launch post (X)

> Today we're launching Echo: memory for AI agents that knows where every belief came from.
>
> Agents trust a claim more each time they read it. But five pages saying the same thing can be one planted post, copied five times.
>
> Echo traces every claim to its origin and counts independent origins, not repeats.
>
> 🔗 meetecho.vercel.app

Thread:

1. How it works: every source gets edges back to where it came from (links, copied passages, shared figures, same ad-network fingerprints, the agent's own notes). Sources that share an origin fold into one. Only 2+ independent origins make a belief verified.
2. Retract a source and every belief built on it is rescored in the same request, in milliseconds.
3. On a 30-scenario benchmark, plain memory stated 17 of 18 poisoned claims as fact. Echo stated 1, and still trusted all 12 genuine claims. The miss is in the eval on purpose.
4. Built on @FalkorDB: every verdict is a graph traversal, PageRank finds load-bearing origins, label propagation finds content rings, and every memory is its own graph.
5. Bring your own model (Groq, OpenAI, Anthropic, Gemini, OpenRouter, NVIDIA NIM, any OpenAI-compatible), set a trust policy, and connect it to Claude Code, Cursor, VS Code or LangGraph over MCP.
6. Built for Graph Hacks by @WeMakeDevs × @FalkorDB. Code: github.com/Gravyie/echo

## Launch post (LinkedIn)

Today I'm launching Echo, a memory layer for AI agents that knows where every belief came from.

Agents treat repetition as evidence: five pages calling a vendor "the safest choice" look like consensus, even when all five copied one planted post. The same thing happens with no attacker, when an agent re-reads its own earlier summary.

Echo links every source back to its origin and counts independent origins instead of mentions. It's built on FalkorDB, where every verdict is a graph traversal and retracting a source rescores everything downstream in milliseconds. Bring your own model, set a trust policy per memory, and plug it into Claude Code, Cursor or any MCP agent.

On a 30-scenario benchmark, plain memory stated 17 of 18 poisoned claims as fact; Echo stated 1, while still trusting every genuine claim.

Try it: https://meetecho.vercel.app · Code: https://github.com/Gravyie/echo

#AIagents #GraphDatabase #FalkorDB #MCP #GraphHacks
