import type { Metadata } from "next";
import Link from "next/link";
import { CypherBlock } from "@/components/CypherBlock";
import { SiteNav } from "@/components/landing/SiteNav";
import { MCP_URL, REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Docs · Echo",
  description: "Connect Echo to your agent, bring your own model, set a trust policy, and self-host.",
};

const API = MCP_URL.replace(/\/mcp\/$/, "");

const SECTIONS = [
  ["quickstart", "Quickstart"],
  ["connect", "Connect your agent"],
  ["models", "Bring your own model"],
  ["sources", "Adding sources"],
  ["policy", "Trust policy"],
  ["verdicts", "Verdicts"],
  ["memories", "Memories, export, import"],
  ["api", "HTTP API"],
  ["self-host", "Self-host"],
];

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="display scroll-mt-24 border-t border-line pt-12 text-[34px] leading-tight first:border-t-0 first:pt-0">
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-[68ch] text-[15.5px] leading-relaxed text-muted">{children}</p>;
}
function Code({ children, title, lang = "shell" }: { children: string; title?: string; lang?: string }) {
  return (
    <div className="mt-5">
      <CypherBlock code={children} title={title ?? lang} lang={lang} />
    </div>
  );
}
const c = "rounded bg-surface-3 px-1 font-mono text-[13px] text-text";

export default function Docs() {
  return (
    <>
      <SiteNav alwaysSolid />
      <main className="mx-auto grid w-full max-w-[1240px] flex-1 grid-cols-1 gap-12 px-5 pb-32 pt-28 md:grid-cols-[220px_minmax(0,1fr)] md:px-8">
        <nav className="hidden md:block">
          <div className="sticky top-24">
            <span className="eyebrow">Docs</span>
            <ul className="mt-5 space-y-2.5 text-[14px]">
              {SECTIONS.map(([id, t]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-muted hover:text-text">
                    {t}
                  </a>
                </li>
              ))}
            </ul>
            <Link href="/studio" className="mt-8 inline-block rounded-md bg-text px-4 py-2 text-[13px] font-medium text-bg">
              Open the studio
            </Link>
          </div>
        </nav>

        <article>
          <h1 className="display text-[clamp(2.6rem,5vw,4rem)] leading-[1.02]">Echo docs</h1>
          <p className="mt-5 max-w-[60ch] text-[18px] leading-relaxed text-muted">
            Echo is a memory layer for AI agents on FalkorDB. It links every belief to where it came from and counts independent
            origins, so repetition stops passing for evidence.
          </p>

          <div className="mt-14 space-y-2">
            <H id="quickstart">Quickstart</H>
            <P>
              Open the <Link className="text-text underline underline-offset-4" href="/studio">studio</Link>. It clones a private
              FalkorDB graph for you with a prepared scenario. Follow <b>Start here</b>: ask the agent, open the disputed belief, trace
              its lineage, retract the planted post. Then switch to <b>Your memory</b> to start an empty one and add your own pages.
            </P>

            <H id="connect">Connect your agent</H>
            <P>
              Echo is an MCP server (streamable HTTP). Every memory has its own address: add <code className={c}>?workspace=&lt;id&gt;</code>{" "}
              to point an agent at the memory you have open. The studio's <b>Connect</b> button gives you the exact URL and one-click
              installs.
            </P>
            <Code title="Claude Code">{`claude mcp add --transport http echo "${MCP_URL}?workspace=<memory-id>"`}</Code>
            <Code title="Cursor · ~/.cursor/mcp.json" lang="json">{`{
  "mcpServers": {
    "echo": { "url": "${MCP_URL}?workspace=<memory-id>" }
  }
}`}</Code>
            <Code title="LangGraph" lang="python">{`from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({"echo": {"url": "${MCP_URL}?workspace=<memory-id>", "transport": "streamable_http"}})
tools = await client.get_tools()`}</Code>
            <P>
              Tools: <code className={c}>echo_recall</code>, <code className={c}>echo_check</code>, <code className={c}>echo_ingest</code>,{" "}
              <code className={c}>echo_remember</code>, <code className={c}>echo_retract</code>, <code className={c}>echo_load_bearing</code>,{" "}
              <code className={c}>echo_cypher</code>. A good system prompt line: “Before you rely on a remembered claim, call echo_check;
              only VERIFIED is established. Store findings with echo_remember and the source ids they came from.”
            </P>

            <H id="models">Bring your own model</H>
            <P>
              The agent and claim extraction work with any OpenAI-compatible chat model. The free default is Groq's{" "}
              <code className={c}>openai/gpt-oss-120b</code>. In <b>Settings → Model</b>, pick Groq, OpenAI, Anthropic, Google Gemini,
              OpenRouter, NVIDIA NIM, Together AI or any https endpoint, paste a key, list the provider's models and test the
              connection.
            </P>
            <P>
              Keys are stored only in your browser and sent with your own requests as <code className={c}>X-Echo-LLM-*</code> headers.
              The API uses them for that request and keeps nothing; error messages are scrubbed of anything that looks like a key.
              Custom endpoints must be public https.
            </P>
            <Code title="the same choice over HTTP">{`curl -N -X POST ${API}/api/w/<memory-id>/ask \\
  -H 'content-type: application/json' \\
  -H 'x-echo-llm-provider: anthropic' -H 'x-echo-llm-model: claude-sonnet-5-5' \\
  -H "x-echo-llm-key: $ANTHROPIC_API_KEY" \\
  -d '{"question": "What do I know, and how well is it supported?"}'`}</Code>

            <H id="sources">Adding sources</H>
            <P>
              <b>Add source</b> takes URLs (several at once, read in order so later copies link back to earlier originals), files
              (PDF, Markdown, text, HTML) or pasted text. Echo extracts the claims with the model, matches them to beliefs already in
              memory, and infers lineage against every stored source: links, identifiers, verbatim and paraphrased passages, shared
              figures, and shared owners or ad and analytics fingerprints.
            </P>

            <H id="policy">Trust policy</H>
            <P>
              Each memory decides how many independent origins make a belief <b>verified</b> (default two). Raise it for clinical,
              legal or security work; lower it to explore. Changing it rescores every belief immediately.
            </P>

            <H id="verdicts">Verdicts</H>
            <ul className="mt-5 max-w-[68ch] space-y-2.5 text-[15px] leading-relaxed text-muted">
              <li><b className="text-ok">Verified</b>: enough independent origins for the policy, and nothing outweighs them.</li>
              <li><b className="text-single">Needs more origins</b>: independent origins agree, but fewer than the policy requires.</li>
              <li><b className="text-single">Single origin</b>: every source traces back to one place.</li>
              <li><b className="text-contested">Contested</b>: independent origins disagree.</li>
              <li><b className="text-bad">Disputed</b>: independent evidence against outweighs the support.</li>
              <li><b className="text-gone">Unsupported</b>: only the agent's own notes support it.</li>
              <li><b className="text-gone">Retracted</b>: its origin was retracted.</li>
            </ul>

            <H id="memories">Memories, export, import</H>
            <P>
              Keep a memory per project. The tab menu next to <b>Your memory</b> lists yours and creates new ones. <b>Settings → This
              memory</b> renames, exports a portable JSON file (sources, their claims, retractions and the policy) and imports one into
              a new memory. The hosted demo keeps memories you build for 30 days; export to keep one, or self-host.
            </P>

            <H id="api">HTTP API</H>
            <Code>{`POST   /api/workspaces                      {"scenario": null}  → new empty memory
POST   /api/workspaces/import               an export file      → new memory
GET    /api/w/{id}                          stats, title, policy
PATCH  /api/w/{id}/settings                 {"title", "min_origins"}
POST   /api/w/{id}/ingest                   {"url"} | {"text", "title"}
POST   /api/w/{id}/ingest-file              {"filename", "data_b64"}
GET    /api/w/{id}/beliefs[/{belief}]       verdicts, origin clusters, proof paths
POST   /api/w/{id}/sources/{src}/retract    {"restore": false}
POST   /api/w/{id}/ask                      {"question", "mode": "echo"|"plain"}  (SSE)
POST   /api/w/{id}/cypher                   read-only Cypher
GET    /api/w/{id}/export · origins · rings · families · graph`}</Code>

            <H id="self-host">Self-host</H>
            <P>
              FalkorDB and the API run in one container. Point the web app at it with <code className={c}>NEXT_PUBLIC_API_URL</code>.
              Source: <a className="text-text underline underline-offset-4" href={REPO_URL}>{REPO_URL.replace(/^https:\/\//, "")}</a>.
            </P>
            <Code>{`git clone ${REPO_URL} && cd echo
cp .env.example .env               # GROQ_API_KEY=... (optional; any provider works per request)
docker compose up --build          # FalkorDB :6379 · API :8000
cd web && pnpm install && pnpm dev -p 3100   # studio on :3100`}</Code>
          </div>
        </article>
      </main>
    </>
  );
}
