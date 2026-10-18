import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "./Reveal";

const MODELS = ["Echo default · free", "Groq", "OpenAI", "Anthropic", "Google Gemini", "OpenRouter", "NVIDIA NIM", "Together AI", "Any OpenAI-compatible"];
const AGENTS = ["Claude Code", "Cursor", "Claude Desktop", "VS Code", "Windsurf", "LangGraph", "OpenAI Agents SDK", "REST + SSE"];
const SOURCES = ["Web pages", "Bulk URLs", "PDF", "Markdown", "HTML", "Plain text", "Agent notes", "JSON import"];

function Row({ label, items, accent }: { label: string; items: string[]; accent?: number }) {
  return (
    <div className="grid grid-cols-1 items-baseline gap-3 border-t border-line py-6 md:grid-cols-[200px_minmax(0,1fr)]">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <div className="flex flex-wrap gap-2">
        {items.map((x, i) => (
          <span
            key={x}
            className={`rounded-full border px-3 py-1 text-[13px] ${i === accent ? "border-accent/40 bg-accent-soft text-text" : "border-line-strong text-muted"}`}
          >
            {x}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WorksWith() {
  return (
    <section id="integrations" className="scroll-mt-16 py-28 md:py-36">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end md:gap-20">
          <Reveal>
            <span className="eyebrow">Works with your stack</span>
            <h2 className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05]">Your model. Your agent. Your sources.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-[17px] leading-relaxed text-muted">
              Start free on Echo's default model, or bring your own key for any provider. Plug the memory into the agent you
              already use. Feed it pages, papers and notes.
            </p>
          </Reveal>
        </div>
        <Reveal className="mt-14 border-b border-line">
          <Row label="Models" items={MODELS} accent={0} />
          <Row label="Agents" items={AGENTS} />
          <Row label="Sources" items={SOURCES} />
        </Reveal>
      </div>
    </section>
  );
}

const FEATURES = [
  ["Bring your own model", "Pick a provider and a model in settings. Your key stays in your browser and travels only with your own requests; the server never stores it."],
  ["A trust policy per memory", "Decide how many independent origins make a belief verified: one for exploring, three for clinical or legal work. Every belief is rescored when you change it."],
  ["Many memories", "One for each project, client or agent team. Name them, switch between them, export one as JSON and import it anywhere."],
  ["Memory your agent can reach", "Every memory has its own MCP address. Your agent reads and writes the same graph you are looking at, with the same verdicts."],
  ["Retraction that propagates", "Flag a source as wrong and every belief built on it, through any chain of copies, is rescored in the same request."],
  ["Runs anywhere", "FalkorDB and the API ship as one container. Use the hosted studio, or run your own on a laptop or a server you control."],
];

export function ProductGrid() {
  return (
    <section id="product" className="scroll-mt-16 border-t border-line py-28 md:py-36">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <Reveal>
          <span className="eyebrow">The product</span>
          <h2 className="display mt-5 max-w-[20ch] text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05]">A memory you can run your work on.</h2>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-px border-y border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, b], i) => (
            <Reveal key={t} delay={(i % 3) * 0.06} className="bg-bg py-8 sm:px-6">
              <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="display mt-3 text-[24px] leading-tight">{t}</h3>
              <p className="mt-2 max-w-[42ch] text-[14.5px] leading-relaxed text-muted">{b}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 flex flex-wrap gap-3">
          <Link href="/studio" className="group flex items-center gap-2 rounded-md bg-text px-5 py-3 text-[14px] font-medium text-bg">
            Open the studio <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/docs" className="rounded-md border border-line-strong px-5 py-3 text-[14px] font-medium text-text hover:bg-surface-2">
            Read the docs
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

const FAQ = [
  ["Who is Echo for?", "Anyone whose agents read the web and remember what they read: research and diligence agents, support and sales copilots, security and compliance assistants, newsroom fact-checkers. If an agent's answer can be steered by repeating a claim, Echo is the check."],
  ["Is it free?", "The hosted studio is free and runs on a free model. Bring your own key for a stronger or private model. You can also run the whole thing yourself in one container."],
  ["Where do my API keys go?", "Nowhere you didn't send them. They are kept in your browser's storage and sent as headers with your own requests to the Echo API, which uses them for that request and keeps nothing."],
  ["What does Echo catch, and what does it miss?", "Verbatim and paraphrased copies, hyperlinks, shared identifiers, shared precise figures, shared owners and ad or analytics fingerprints, chains of copies, citation loops, and an agent's own notes. A reworded copy with no link, no shared figures and a different owner leaves no trace; the eval reports that case honestly."],
  ["How is this different from other agent memory?", "Most memory layers decide what to keep and how relevant it is. Echo decides how much to believe it: it counts independent origins, so repetition stops passing for evidence. It complements a memory store; it can also be the store."],
  ["Why a graph database?", "Every verdict is a reachability question over lineage, and retraction is the same walk in reverse. FalkorDB answers both in milliseconds, runs the graph algorithms (PageRank, label propagation, components), and keeps the vector index in the same place."],
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 border-t border-line py-28 md:py-36">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-12 px-5 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:px-8">
        <Reveal>
          <span className="eyebrow">Questions</span>
          <h2 className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05]">FAQ</h2>
        </Reveal>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] text-text">
                {q}
                <span className="font-mono text-[18px] text-faint transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
