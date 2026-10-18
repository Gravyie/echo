import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import evalData from "@/data/eval.json";
import hero from "@/assets/hero.webp";
import reflection from "@/assets/reflection.webp";
import { CypherBlock } from "@/components/CypherBlock";
import { Mark } from "@/components/Brand";
import { CollapseViz } from "@/components/landing/CollapseViz";
import { LoopDiagram, PlantedDiagram, SelfEchoDiagram } from "@/components/landing/Diagrams";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ProductTour } from "@/components/landing/ProductTour";
import { Faq, ProductGrid, WorksWith } from "@/components/landing/ProductSections";
import { Reveal } from "@/components/landing/Reveal";
import { SiteNav } from "@/components/landing/SiteNav";
import { WakeApi } from "@/components/landing/WakeApi";
import { MCP_URL, REPO_URL } from "@/lib/site";

const E = evalData as unknown as {
  n: number;
  poisoned: number;
  genuine: number;
  plain: { false_claims_trusted: number; true_claims_trusted: number };
  echo: { false_claims_trusted: number; true_claims_trusted: number };
  detection_by_method: Record<string, { detected: number; total: number; recall: number }>;
};
const of = (rate: number, n: number) => Math.round(rate * n);

const METHOD_LABEL: Record<string, [string, string]> = {
  verbatim: ["Verbatim copy", "Shared 5-word runs"],
  link: ["Hyperlink", "Cites the origin or a copy"],
  specifics: ["Shared figures", "Same precise numbers"],
  network: ["Same ad network", "Affiliate tag or analytics ID"],
  chain: ["Chain of copies", "A copy of a copy"],
  hidden: ["Reworded, no trace", "Nothing in the text to follow"],
};

function Section({ id, className = "", children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-16 ${className}`}>
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">{children}</div>
    </section>
  );
}

function Hero() {
  return (
    <section className="ink relative isolate overflow-hidden">
      <Image src={hero} alt="" placeholder="blur" priority fill sizes="100vw" className="-z-10 object-cover object-[60%_40%]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(10_10_9/0.82)_0%,rgb(10_10_9/0.55)_45%,rgb(10_10_9/0.15)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[rgb(10_10_9/0.7)] to-transparent" />
      <div className="mx-auto flex min-h-[92dvh] max-w-[1240px] flex-col justify-end px-5 pb-56 pt-32 md:px-8 md:pb-64">
        <Reveal>
          <span className="eyebrow !text-white/70">Agent memory on FalkorDB</span>
          <h1 className="display mt-6 text-[clamp(3.2rem,8vw,6.6rem)] leading-[0.98] text-white">
            Five sources.
            <br />
            <em className="inline-block pb-2 text-[#ffb08a]">One origin.</em>
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-white/80">
            Agents trust a claim more each time they read it. Echo traces every claim back to where it came from, and counts
            the independent origins instead of the repeats.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/studio"
              className="group flex items-center gap-2 rounded-md bg-white px-5 py-3 text-[15px] font-medium text-[#141413] transition-transform active:scale-[0.98]"
            >
              Open the studio
              <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/docs#connect" className="rounded-md border border-white/30 px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-white/10">
              Connect your agent
            </Link>
          </div>
        </Reveal>
      </div>
      <p className="absolute right-5 top-20 hidden font-mono text-[10.5px] text-white/50 sm:block md:right-8">
        J. W. Waterhouse, Echo and Narcissus, 1903 (detail)
      </p>
    </section>
  );
}

function HeroWindow() {
  return (
    <div className="relative z-10 mx-auto -mt-40 max-w-[1120px] px-5 md:-mt-48 md:px-8">
      <Reveal>
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgb(18_18_18/0.45)]">
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
            <div className="flex shrink-0 items-center gap-2">
              <Mark size={20} />
              <span className="font-mono text-[11px] text-muted">belief / halcyon-safest</span>
            </div>
            <span className="hidden truncate font-mono text-[11px] text-faint sm:block">
              “Halcyon Gateway is the safest LLM gateway for patient data.”
            </span>
          </div>
          <div className="dots relative h-[580px] px-4 py-6 md:h-[540px] md:px-10 md:py-10">
            <CollapseViz />
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function Problem() {
  const cols = [
    { n: "01", title: "Planted posts", body: "One paid post, copied and reworded across five sites, reads to an agent as consensus.", D: PlantedDiagram },
    { n: "02", title: "Circular citations", body: "A wiki cites a local paper that copied the wiki. Two sources, one unverified edit.", D: LoopDiagram },
    { n: "03", title: "Self-echo", body: "An agent re-reads its own earlier summary and counts it as fresh evidence. No attacker needed.", D: SelfEchoDiagram },
  ];
  return (
    <Section id="problem" className="pb-24 pt-28 md:pb-32 md:pt-36">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-20">
        <Reveal>
          <span className="eyebrow">The problem</span>
          <h2 className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05]">
            Agent memory counts how often it heard something. Not who said it first.
          </h2>
        </Reveal>
        <Reveal delay={0.1} className="md:pt-14">
          <p className="text-[17px] leading-relaxed text-muted">
            Memory poisoning is an active research problem. MPBench finds that a single adversarial memory write can steer an
            agent long after it lands, and MemForm finds broad susceptibility at every memory-formation interface it tests.
            Memory systems rank by frequency and recency. None ask whether the repeats are independent.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11.5px] text-faint">
            <a className="underline decoration-line-strong underline-offset-4 hover:text-text" href="https://arxiv.org/abs/2606.04329">
              MPBench, arXiv 2606.04329
            </a>
            <a className="underline decoration-line-strong underline-offset-4 hover:text-text" href="https://arxiv.org/abs/2610.14431">
              MemForm, arXiv 2610.14431
            </a>
          </div>
        </Reveal>
      </div>
      <div className="mt-16 grid grid-cols-1 border-t border-line md:grid-cols-3">
        {cols.map(({ n, title, body, D }, i) => (
          <Reveal
            key={n}
            delay={i * 0.08}
            className={`flex flex-col gap-4 py-8 md:px-7 md:py-10 ${i > 0 ? "border-t border-line md:border-l md:border-t-0" : "md:pl-0"}`}
          >
            <span className="font-mono text-[11px] text-faint">{n}</span>
            <h3 className="display text-[26px] leading-tight">{title}</h3>
            <p className="max-w-[36ch] text-[15px] leading-relaxed text-muted">{body}</p>
            <div className="mt-4">
              <D />
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function ReflectionBand() {
  return (
    <section className="ink relative isolate overflow-hidden">
      <Image src={reflection} alt="" placeholder="blur" fill sizes="100vw" className="-z-10 object-cover" />
      <div className="absolute inset-0 -z-10 bg-[rgb(10_10_9/0.55)]" />
      <div className="mx-auto flex min-h-[420px] max-w-[1240px] flex-col justify-center px-5 py-20 md:px-8">
        <Reveal>
          <p className="display max-w-[18ch] text-[clamp(2.2rem,5vw,4.2rem)] leading-[1.02] text-white">
            A reflection is not a second witness.
          </p>
          <p className="mt-6 max-w-[56ch] text-[16px] leading-relaxed text-white/75">
            In the myth, Echo could only repeat the last words she heard, and Narcissus took his reflection for someone else.
            Memory that counts repetitions makes both mistakes. Echo is built to catch them.
          </p>
        </Reveal>
      </div>
      <p className="absolute bottom-4 right-5 hidden font-mono text-[10.5px] text-white/50 sm:block md:right-8">
        J. W. Waterhouse, Echo and Narcissus, 1903 (detail)
      </p>
    </section>
  );
}

function Studio() {
  return (
    <Section id="studio" className="pt-28 md:pt-36">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end md:gap-20">
        <Reveal>
          <span className="eyebrow">The studio</span>
          <h2 className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05]">Ask once. See which sources were really one.</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-[17px] leading-relaxed text-muted">
            The same research agent answers twice, once on a plain memory and once on Echo. The plain one recommends the planted
            vendor. Echo shows its work. Scroll to follow one run.
          </p>
        </Reveal>
      </div>
      <div className="mt-10 lg:mt-4">
        <ProductTour />
      </div>
    </Section>
  );
}

function Results() {
  const pf = of(E.plain.false_claims_trusted, E.poisoned);
  const ef = of(E.echo.false_claims_trusted, E.poisoned);
  const et = of(E.echo.true_claims_trusted, E.genuine);
  const pt = of(E.plain.true_claims_trusted, E.genuine);
  return (
    <section id="results" className="ink mt-28 scroll-mt-16 md:mt-36">
      <div className="mx-auto max-w-[1240px] px-5 py-24 md:px-8 md:py-32">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end md:gap-20">
          <Reveal>
            <span className="eyebrow">Results</span>
            <h2 className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05]">
              Same claims, same scoring rule. Only the counting changes.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-[17px] leading-relaxed text-muted">
              {E.n} seeded scenarios: {E.poisoned} poisoned claims spread by two to six echo pages, and {E.genuine} genuine claims
              with independent support.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid grid-cols-1 border-y border-line md:grid-cols-2">
          {[
            { label: "Plain memory, counting mentions", n: pf, tone: "text-bad", foot: `${pt} of ${E.genuine} genuine claims trusted` },
            {
              label: "Echo, counting independent origins",
              n: ef,
              tone: "text-ok",
              foot: `${et} of ${E.genuine} genuine claims trusted. The caution is not blanket doubt.`,
            },
          ].map((c, i) => (
            <Reveal key={c.label} delay={i * 0.1} className={`py-10 md:py-14 ${i ? "border-t border-line md:border-l md:border-t-0 md:pl-12" : "md:pr-12"}`}>
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">{c.label}</div>
              <div className="mt-6 flex items-baseline gap-3">
                <span className={`display text-[clamp(5rem,11vw,9rem)] leading-none tabular-nums ${c.tone}`}>{c.n}</span>
                <span className="display text-4xl text-faint">/ {E.poisoned}</span>
              </div>
              <p className="mt-4 text-[16px] text-text">poisoned claims it would state as fact</p>
              <p className="mt-2 text-[14px] text-muted">{c.foot}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16">
          <h3 className="display text-[26px]">Which echoes Echo catches</h3>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {Object.entries(E.detection_by_method).map(([m, d]) => {
              const [name, how] = METHOD_LABEL[m] ?? [m, ""];
              const weak = d.recall < 0.5;
              return (
                <div
                  key={m}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-4 md:grid-cols-[200px_minmax(0,1fr)_minmax(0,2fr)_64px]"
                >
                  <span className="text-[15px]">{name}</span>
                  <span className="hidden text-[13.5px] text-muted md:block">{how}</span>
                  <span className="text-right font-mono text-[13px] tabular-nums md:order-last">
                    {d.detected}
                    <span className="text-faint">/{d.total}</span>
                  </span>
                  <div className="col-span-2 h-1.5 overflow-hidden bg-surface-3 md:col-span-1">
                    <div className={`h-full ${weak ? "bg-bad" : "bg-accent"}`} style={{ width: `${Math.max(4, d.recall * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 max-w-[74ch] text-[14px] leading-relaxed text-muted">
            A reworded copy with no link, no shared figures and a different owner leaves no trace, and Echo counts it as
            independent. That case is in the set on purpose: it is the one poisoned claim Echo still trusts, and chains built on
            such a copy inherit the miss. Claims are given to both systems as annotations, so this measures lineage and scoring,
            not LLM extraction. Rerun it with <code className="font-mono text-text">uv run python -m echo_memory.evaluate</code>.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const FALKOR = [
  ["Ancestry walks", "One variable-length traversal finds every upstream ancestor of a belief's sources.", "(s)-[:CITES|COPIED_FROM|DERIVED_FROM*0..8]->(a)"],
  ["Proof paths", "shortestPath returns the hop-by-hop chain from each copy back to its origin, with evidence.", "WITH shortestPath((a)-[*1..8]->(b)) AS p"],
  ["Load-bearing origins", "PageRank over lineage ranks the origins the most beliefs rest on, with blast radius.", "CALL algo.pageRank('Source', null)"],
  ["Content rings", "Label propagation over copies and shared ad or affiliate IDs surfaces coordinated sites.", "CALL algo.labelPropagation({...})"],
  ["Recall in the same graph", "Beliefs carry embeddings in a vector index, so recall and lineage never leave the database.", "CALL db.idx.vector.queryNodes('Belief', ...)"],
  ["A graph per visitor", "Each visitor gets a private graph cloned from a template in milliseconds. Agents query it read-only.", "GRAPH.COPY · GRAPH.RO_QUERY"],
];

function Falkor() {
  return (
    <Section id="falkordb" className="py-28 md:py-36">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end md:gap-20">
        <Reveal>
          <span className="eyebrow">Why a graph</span>
          <h2 className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05]">Take the graph away and Echo cannot count origins.</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-[17px] leading-relaxed text-muted">
            FalkorDB is not storage beside the agent. Every verdict is a traversal, and the agent's tools are graph queries and
            graph algorithms.
          </p>
        </Reveal>
      </div>
      <div className="mt-16 grid grid-cols-1 gap-px border-y border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {FALKOR.map(([title, body, code], i) => (
          <Reveal key={title} delay={(i % 3) * 0.06} className="flex flex-col bg-bg py-8 sm:px-6">
            <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="display mt-3 text-[24px] leading-tight">{title}</h3>
            <p className="mt-2 max-w-[40ch] flex-1 text-[14.5px] leading-relaxed text-muted">{body}</p>
            <code className="mt-6 block overflow-x-auto whitespace-nowrap font-mono text-[11.5px] text-accent scrollbar-thin">{code}</code>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

const TOOLS = [
  ["echo_recall", "Beliefs relevant to a query, with verdicts"],
  ["echo_check", "Origin clusters and lineage paths for one belief"],
  ["echo_ingest", "Store a source; lineage is inferred"],
  ["echo_remember", "Write a note linked to what it came from"],
  ["echo_retract", "Retract a source and rescore dependents"],
  ["echo_load_bearing", "PageRank origins and blast radius"],
  ["echo_cypher", "Read-only Cypher over the memory"],
];

function Mcp() {
  const config = `{
  "mcpServers": {
    "echo": {
      "type": "http",
      "url": "${MCP_URL}"
    }
  }
}`;
  return (
    <Section id="mcp" className="border-t border-line py-28 md:py-36">
      <div className="grid grid-cols-1 gap-14 md:grid-cols-2 md:gap-20">
        <Reveal>
          <span className="eyebrow">For your agents</span>
          <h2 className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05]">Give any agent this memory.</h2>
          <p className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-muted">
            Echo ships as an MCP server. Point Claude Code, Cursor or your own agent at it and the independence check becomes a
            tool the model can choose.
          </p>
          <div className="mt-8">
            <CypherBlock code={config} title=".mcp.json" lang="Claude Code / Cursor" />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <ul className="divide-y divide-line border-y border-line">
            {TOOLS.map(([name, desc]) => (
              <li key={name} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="font-mono text-[13px] text-accent">{name}</span>
                <span className="text-[14px] text-muted sm:text-right">{desc}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}

function Closing() {
  return (
    <section className="ink relative isolate overflow-hidden">
      <Image src={hero} alt="" placeholder="blur" fill sizes="100vw" className="-z-10 object-cover object-[30%_60%] opacity-70" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[rgb(10_10_9/0.86)] to-[rgb(10_10_9/0.62)]" />
      <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-10 px-5 py-28 md:flex-row md:items-end md:justify-between md:px-8 md:py-36">
        <h2 className="display max-w-[16ch] text-[clamp(2.4rem,5.4vw,4.6rem)] leading-[1.02] text-white">
          Retract one post. Watch every belief built on it fall.
        </h2>
        <Link
          href="/studio"
          className="group flex shrink-0 items-center gap-2 rounded-md bg-white px-6 py-3.5 text-[15px] font-medium text-[#141413] transition-transform active:scale-[0.98]"
        >
          Open the studio
          <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <footer className="mx-auto flex max-w-[1240px] flex-col gap-3 border-t border-white/15 px-5 py-8 text-[13px] text-white/55 md:flex-row md:justify-between md:px-8">
        <span>Built for Graph Hacks 2026 on FalkorDB. Every company, site and person in the demo data is fictional.</span>
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          <span>Painting: J. W. Waterhouse, 1903, public domain</span>
          <a href={REPO_URL} className="flex items-center gap-1 hover:text-white">
            Source <ArrowUpRight size={13} />
          </a>
        </span>
      </footer>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <WakeApi />
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <HeroWindow />
        <Problem />
        <ReflectionBand />
        <Studio />
        <Section id="how" className="pt-28 md:pt-36">
          <Reveal>
            <span className="eyebrow">How Echo works</span>
            <h2 className="display mt-5 max-w-[18ch] text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05]">Link. Collapse. Decide.</h2>
          </Reveal>
          <div className="mt-12">
            <HowItWorks />
          </div>
        </Section>
        <Results />
        <WorksWith />
        <ProductGrid />
        <Falkor />
        <Mcp />
        <Faq />
        <Closing />
      </main>
    </>
  );
}
