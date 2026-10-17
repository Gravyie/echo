import Link from "next/link";
import { ArrowRight, ArrowUpRight, GithubLogo } from "@phosphor-icons/react/dist/ssr";
import evalData from "@/data/eval.json";
import { REPO_URL, Wordmark } from "@/components/Brand";
import { CypherBlock } from "@/components/CypherBlock";
import { CollapseViz } from "@/components/landing/CollapseViz";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ProductShot } from "@/components/landing/ProductShot";
import { Reveal } from "@/components/landing/Reveal";

const E = evalData as unknown as {
  n: number;
  poisoned: number;
  genuine: number;
  plain: { false_claims_trusted: number; true_claims_trusted: number };
  echo: { false_claims_trusted: number; true_claims_trusted: number };
  origin_count_exact: number;
  avg_mentions_per_poisoned_claim: number;
  detection_by_method: Record<string, { detected: number; total: number; recall: number }>;
};
const of = (rate: number, n: number) => Math.round(rate * n);

const METHOD_LABEL: Record<string, string> = {
  verbatim: "Verbatim copy",
  link: "Hyperlink",
  specifics: "Shared figures",
  network: "Same ad network",
  chain: "Chain of copies",
  hidden: "Reworded, no trace",
};

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 md:px-8">
        <Wordmark />
        <div className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#how" className="transition-colors hover:text-text">How it works</a>
          <a href="#results" className="transition-colors hover:text-text">Results</a>
          <a href="#falkordb" className="transition-colors hover:text-text">FalkorDB</a>
          <a href="#mcp" className="transition-colors hover:text-text">MCP</a>
        </div>
        <div className="flex items-center gap-3">
          <a href={REPO_URL} aria-label="Source code on GitHub" className="hidden rounded-full p-2 text-muted transition-colors hover:text-text sm:block">
            <GithubLogo size={20} />
          </a>
          <Link
            href="/studio"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-transform active:scale-[0.98]"
          >
            Open the studio
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1280px] grid-cols-1 items-center gap-12 px-5 pb-16 pt-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:px-8 md:pt-10">
      <Reveal>
        <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-6xl lg:text-7xl">
          Five sources.
          <br />
          <span className="text-accent">One origin.</span>
        </h1>
        <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-muted">
          Echo is agent memory on FalkorDB that counts where a claim came from, not how often it was repeated.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link
            href="/studio"
            className="group flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-accent-ink transition-transform active:scale-[0.98]"
          >
            Open the studio
            <ArrowRight size={18} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a href="#results" className="rounded-full border border-line-strong px-6 py-3 font-medium text-text transition-colors hover:bg-surface-2">
            See the eval
          </a>
        </div>
      </Reveal>
      <div className="relative aspect-[15/13] w-full md:aspect-auto md:h-[540px]">
        <CollapseViz />
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-[1280px] px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <p className="max-w-[26ch] font-display text-3xl font-medium leading-tight tracking-tight md:text-5xl">
            An agent reads five pages that call a vendor the safest choice. All five copied one planted post.
          </p>
        </Reveal>
        <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-20">
          <Reveal delay={0.1}>
            <div className="space-y-5 text-lg leading-relaxed text-muted">
              <p>
                It stores the claim as confirmed by five sources and recommends that vendor in every later session. The same
                thing happens with no attacker at all, when an agent re-reads its own earlier summary and counts it as fresh
                evidence.
              </p>
              <p>
                Journalists call this circular reporting. Agent memory systems count how often a claim appears and how often it
                is used. None of them ask whether those appearances are independent.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="space-y-8">
              <figure>
                <blockquote className="font-display text-xl leading-snug">
                  “A single adversarial memory write can exert long-term influence over agent behavior.”
                </blockquote>
                <figcaption className="mt-3 text-sm text-faint">
                  <a className="underline decoration-line-strong underline-offset-4 hover:text-text" href="https://arxiv.org/abs/2606.04329">
                    MPBench, arXiv 2606.04329
                  </a>
                  , June 2026
                </figcaption>
              </figure>
              <figure>
                <blockquote className="font-display text-xl leading-snug">
                  Memory-formation poisoning, evidence poisoning included, finds broad susceptibility at all five interfaces tested.
                </blockquote>
                <figcaption className="mt-3 text-sm text-faint">
                  <a className="underline decoration-line-strong underline-offset-4 hover:text-text" href="https://arxiv.org/abs/2610.14431">
                    MemForm, arXiv 2610.14431
                  </a>
                  , October 2026
                </figcaption>
              </figure>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Results() {
  const pf = of(E.plain.false_claims_trusted, E.poisoned);
  const ef = of(E.echo.false_claims_trusted, E.poisoned);
  const et = of(E.echo.true_claims_trusted, E.genuine);
  const pt = of(E.plain.true_claims_trusted, E.genuine);
  return (
    <section id="results" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-24 md:px-8 md:py-32">
      <Reveal>
        <div className="font-mono text-sm text-accent">Measured on {E.n} scripted scenarios</div>
        <h2 className="mt-4 max-w-[22ch] font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Same claims, same scoring rule. Only the counting changes.
        </h2>
      </Reveal>
      <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
        <div className="bg-bg p-8 md:p-12">
          <div className="text-sm text-muted">Plain memory, counting mentions</div>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-display text-7xl font-semibold tabular-nums text-bad md:text-8xl">{pf}</span>
            <span className="font-display text-3xl text-faint">/ {E.poisoned}</span>
          </div>
          <p className="mt-3 text-muted">poisoned claims it would state as fact</p>
          <p className="mt-8 border-t border-line pt-5 text-sm text-faint">
            {pt} of {E.genuine} genuine claims trusted
          </p>
        </div>
        <div className="bg-bg p-8 md:p-12">
          <div className="text-sm text-muted">Echo, counting independent origins</div>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-display text-7xl font-semibold tabular-nums text-ok md:text-8xl">{ef}</span>
            <span className="font-display text-3xl text-faint">/ {E.poisoned}</span>
          </div>
          <p className="mt-3 text-muted">poisoned claims it would state as fact</p>
          <p className="mt-8 border-t border-line pt-5 text-sm text-faint">
            {et} of {E.genuine} genuine claims trusted, so the caution is not blanket doubt
          </p>
        </div>
      </div>

      <Reveal className="mt-16">
        <h3 className="font-display text-xl font-medium">Which echoes Echo catches</h3>
        <div className="scrollbar-thin mt-6 flex snap-x gap-3 overflow-x-auto pb-2">
          {Object.entries(E.detection_by_method).map(([m, d]) => (
            <div
              key={m}
              className={`min-w-[170px] snap-start rounded-xl border p-4 ${d.recall < 0.5 ? "border-bad/40 bg-bad/5" : "border-line bg-surface"}`}
            >
              <div className="text-sm text-muted">{METHOD_LABEL[m] ?? m}</div>
              <div className="mt-2 font-mono text-2xl tabular-nums">
                {d.detected}
                <span className="text-faint">/{d.total}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-[70ch] text-sm leading-relaxed text-faint">
          A reworded copy with no link, no shared figures and a different owner leaves no trace, and Echo counts it as
          independent. That case is in the set on purpose; it is the one poisoned claim Echo still trusts, and chains built on
          such a copy inherit the miss. Claims are given to both systems as annotations, so this measures lineage and scoring,
          not LLM extraction. Rerun it with <code className="font-mono text-muted">uv run python -m echo_memory.evaluate</code>.
        </p>
      </Reveal>
    </section>
  );
}

const BENTO = [
  {
    title: "Ancestry walks",
    body: "One variable-length traversal finds every upstream ancestor of a belief's sources.",
    code: "(s)-[:CITES|COPIED_FROM|DERIVED_FROM*0..8]->(a)",
    span: "md:col-span-4",
    tone: "accent",
  },
  {
    title: "Load-bearing origins",
    body: "PageRank over lineage ranks the origins the most beliefs rest on, with their blast radius.",
    code: "CALL algo.pageRank('Source', null)",
    span: "md:col-span-2",
    tone: "plain",
  },
  {
    title: "Content rings",
    body: "Label propagation over copies and shared ad or affiliate IDs surfaces coordinated sites.",
    code: "CALL algo.labelPropagation({...})",
    span: "md:col-span-2",
    tone: "grid",
  },
  {
    title: "Evidence families",
    body: "Weakly connected components group sources by any lineage tie.",
    code: "CALL algo.WCC({nodeLabels:['Source','Owner']})",
    span: "md:col-span-2",
    tone: "plain",
  },
  {
    title: "One graph per tenant",
    body: "Every visitor and agent team gets its own graph, cloned from a template in milliseconds. Agents query it read-only.",
    code: "GRAPH.COPY echo__tpl-halcyon echo__halcyon--3f9a1c",
    span: "md:col-span-2",
    tone: "surface",
  },
  {
    title: "Recall in the same database",
    body: "Beliefs carry embeddings in a FalkorDB vector index, so recall and lineage never leave the graph.",
    code: "CALL db.idx.vector.queryNodes('Belief','embedding',6,vecf32($v))",
    span: "md:col-span-6",
    tone: "surface",
  },
];

function FalkorBento() {
  return (
    <section id="falkordb" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <h2 className="max-w-[24ch] font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Take the graph away and Echo cannot count origins.
          </h2>
          <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted">
            FalkorDB is not storage beside the agent. Every verdict is a traversal, and the agent's tools are graph queries
            and graph algorithms.
          </p>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6">
          {BENTO.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.05} className={b.span}>
              <div
                className={`relative h-full overflow-hidden rounded-2xl border p-7 ${
                  b.tone === "accent"
                    ? "border-accent/30 bg-accent-soft"
                    : b.tone === "grid"
                      ? "border-line bg-bg [background-image:radial-gradient(var(--line-strong)_1px,transparent_1px)] [background-size:16px_16px]"
                      : b.tone === "surface"
                        ? "border-line bg-surface-2"
                        : "border-line bg-bg"
                }`}
              >
                <h3 className="font-display text-xl font-medium">{b.title}</h3>
                <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">{b.body}</p>
                <code className="mt-6 block overflow-x-auto whitespace-nowrap rounded-lg bg-bg/70 px-3 py-2 font-mono text-xs text-accent scrollbar-thin">
                  {b.code}
                </code>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const MCP_CONFIG = `{
  "mcpServers": {
    "echo": {
      "type": "http",
      "url": "https://<your-echo-api>/mcp/"
    }
  }
}`;

const TOOLS = [
  ["echo_recall", "beliefs relevant to a query, with verdicts"],
  ["echo_check", "origin clusters and lineage paths for one belief"],
  ["echo_ingest", "store a source; lineage is inferred"],
  ["echo_remember", "write a note linked to what it came from"],
  ["echo_retract", "retract a source and rescore dependents"],
  ["echo_load_bearing", "PageRank origins and blast radius"],
  ["echo_cypher", "read-only Cypher over the memory"],
];

function Mcp() {
  return (
    <section id="mcp" className="mx-auto grid max-w-[1280px] scroll-mt-20 grid-cols-1 gap-12 px-5 py-24 md:grid-cols-2 md:px-8 md:py-32">
      <Reveal>
        <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Give any agent this memory.</h2>
        <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-muted">
          Echo ships as an MCP server. Point Claude, Cursor or your own agent at it and the independence check becomes a tool
          the model can choose.
        </p>
        <div className="mt-8">
          <CypherBlock code={MCP_CONFIG} title=".mcp.json" lang="Claude Code / Desktop" />
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOOLS.map(([name, desc]) => (
            <li key={name} className="rounded-xl border border-line bg-surface p-4">
              <div className="font-mono text-sm text-accent">{name}</div>
              <div className="mt-1.5 text-sm text-muted">{desc}</div>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

function Closing() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-8 px-5 py-24 md:flex-row md:items-end md:justify-between md:px-8 md:py-28">
        <h2 className="max-w-[18ch] font-display text-4xl font-semibold tracking-tight md:text-6xl">
          Retract one post. Watch every belief built on it fall.
        </h2>
        <Link
          href="/studio"
          className="group flex shrink-0 items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-medium text-accent-ink transition-transform active:scale-[0.98]"
        >
          Open the studio
          <ArrowRight size={18} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <footer className="mx-auto flex max-w-[1280px] flex-col gap-3 border-t border-line px-5 py-8 text-sm text-faint md:flex-row md:justify-between md:px-8">
        <span>Built for Graph Hacks 2026 on FalkorDB. Every company, site and person in the demo data is fictional.</span>
        <a href={REPO_URL} className="flex items-center gap-1 hover:text-text">
          Source <ArrowUpRight size={14} />
        </a>
      </footer>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <Problem />
        <section id="studio" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 pt-24 md:px-8 md:pt-32">
          <Reveal>
            <h2 className="max-w-[22ch] font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Ask once. See which sources were really one.
            </h2>
            <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted">
              The same research agent answers twice, once on a plain memory and once on Echo. The plain one recommends the
              planted vendor. Echo shows why it should not.
            </p>
          </Reveal>
          <div className="mt-14">
            <ProductShot />
          </div>
        </section>
        <section id="how" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-24 md:px-8 md:py-28">
          <Reveal>
            <h2 className="max-w-[20ch] font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Count origins, not mentions.
            </h2>
          </Reveal>
          <HowItWorks />
        </section>
        <Results />
        <FalkorBento />
        <Mcp />
        <Closing />
      </main>
    </>
  );
}
