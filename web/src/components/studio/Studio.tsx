"use client";

import { ArrowCounterClockwise, ChatCircleText, Code, Plus, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wordmark } from "../Brand";
import {
  API,
  api,
  ask,
  type Belief,
  type GraphEdge,
  type GraphNode,
  type Origin,
  type Report,
  type Rescore,
  type Scenario,
  type SourceDetail,
  type WorkspaceInfo,
} from "@/lib/api";
import { AskPanel, applyEvent, type Step, type Turn } from "./AskPanel";
import { GraphView, type Highlight } from "./GraphView";
import { BeliefInspector, SourceInspector } from "./Inspector";
import { Overview } from "./Overview";
import { CypherConsole, IngestPanel } from "./Tools";

type Sel = { kind: "belief" | "source"; id: string } | null;
type LeftTab = "ask" | "ingest" | "cypher";
const BLANK = "blank";

function storageGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function storageSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

export default function Studio() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenario, setScenario] = useState<string>("halcyon");
  const [ws, setWs] = useState<string | null>(null);
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [beliefs, setBeliefs] = useState<Belief[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [rings, setRings] = useState<{ id: number; sources: string[]; titles: string[]; networks: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [health, setHealth] = useState<{ llm: boolean; llm_model: string | null } | null>(null);

  const [sel, setSel] = useState<Sel>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState(true);
  const [left, setLeft] = useState<LeftTab>("ask");
  const [lastRescore, setLastRescore] = useState<{ source: string; ms: number; rescored: Rescore[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showOwners, setShowOwners] = useState(false);
  const [showAgent, setShowAgent] = useState(true);
  const turnId = useRef(0);

  // ---------------------------------------------------------------- bootstrap

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (s) setScenario(s);
    api.scenarios().then(setScenarios).catch(() => undefined);
    api.health().then(setHealth).catch(() => undefined);
  }, []);

  const refresh = useCallback(async (w: string) => {
    const [g, b, o, r, i] = await Promise.all([api.graph(w), api.beliefs(w), api.origins(w), api.rings(w), api.workspace(w)]);
    setGraph(g);
    setBeliefs(b);
    setOrigins(o.origins);
    setRings(r.rings);
    setInfo(i);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFatal(null);
      setSel(null);
      setTurns([]);
      setHighlight(null);
      setLastRescore(null);
      const key = `echo.ws.${scenario}`;
      let w = storageGet(key);
      try {
        if (w) {
          try {
            await api.workspace(w);
          } catch {
            w = null;
          }
        }
        if (!w) {
          w = (await api.createWorkspace(scenario === BLANK ? null : scenario)).workspace;
          storageSet(key, w);
        }
        if (cancelled) return;
        setWs(w);
        await refresh(w);
      } catch {
        if (!cancelled) setFatal(`Can't reach the Echo API at ${API}.`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenario, refresh]);

  const switchScenario = (s: string) => {
    if (s === scenario) return;
    const url = new URL(window.location.href);
    url.searchParams.set("s", s);
    window.history.replaceState(null, "", url);
    setScenario(s);
  };

  // ---------------------------------------------------------------- selection

  useEffect(() => {
    if (!ws || !sel) {
      setReport(null);
      setSource(null);
      return;
    }
    let cancelled = false;
    if (sel.kind === "belief") {
      api.belief(ws, sel.id).then((r) => {
        if (cancelled) return;
        setReport(r);
        setSource(null);
        const nodes = new Set<string>([r.id]);
        r.verdict.clusters.forEach((c) => [...c.members, ...c.roots, ...c.dead_roots].forEach((x) => nodes.add(x)));
        const edges = new Set<string>();
        r.paths.forEach((p) => p.nodes.forEach((n, i) => i > 0 && edges.add(`${p.nodes[i - 1]}>${n}`)));
        setHighlight({ nodes, edges, focus: r.id });
      });
    } else {
      api.source(ws, sel.id).then((s) => {
        if (cancelled) return;
        setSource(s);
        setReport(null);
        const nodes = new Set<string>([s.id]);
        const edges = new Set<string>();
        graph.edges.forEach((e) => {
          if (e.source === s.id || e.target === s.id) {
            nodes.add(e.source);
            nodes.add(e.target);
            edges.add(`${e.source}>${e.target}`);
          }
        });
        setHighlight({ nodes, edges, focus: s.id });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [ws, sel, graph.edges]);

  const selectNode = (n: GraphNode | null) => {
    if (!n) {
      setSel(null);
      setHighlight(null);
      return;
    }
    if (n.label === "Belief") setSel({ kind: "belief", id: n.id });
    else if (n.label === "Source") setSel({ kind: "source", id: n.id });
  };

  const titles = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n.name])), [graph.nodes]);
  const sourceClaims = useMemo(() => {
    if (!source) return [];
    return graph.edges
      .filter((e) => e.source === source.id && (e.type === "SUPPORTS" || e.type === "CONTRADICTS"))
      .map((e) => ({ id: e.target, name: titles.get(e.target) ?? e.target, type: e.type }));
  }, [source, graph.edges, titles]);

  // ---------------------------------------------------------------- actions

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4200);
  };

  const highlightStep = useCallback((s: Step) => {
    const h = s.highlight;
    if (!h) return;
    setHighlight({
      nodes: new Set(h.nodes ?? []),
      edges: new Set((h.edges ?? []).map(([a, b]) => `${a}>${b}`)),
      focus: h.focus,
    });
  }, []);

  const onAsk = async (question: string) => {
    if (!ws) return;
    const id = ++turnId.current;
    setBusy(true);
    setSel(null);
    setLeft("ask");
    setTurns((t) => [...t, { id, question, echo: { steps: [], done: false }, plain: compare ? { steps: [], done: false } : undefined }]);
    const update = (mode: "echo" | "plain", fn: (r: Turn["echo"]) => Turn["echo"]) =>
      setTurns((ts) => ts.map((t) => (t.id !== id ? t : { ...t, [mode]: fn((mode === "echo" ? t.echo : t.plain)!) })));
    const seenNodes = new Set<string>();
    const seenEdges = new Set<string>();
    const runMode = (mode: "echo" | "plain") =>
      ask(ws, question, mode, (e) => {
        update(mode, (r) => applyEvent(r, e));
        if (mode === "echo" && e.type === "step_result" && e.tool === "inspect_belief") {
          e.highlight?.nodes?.forEach((n) => seenNodes.add(n));
          e.highlight?.edges?.forEach(([a, b]) => seenEdges.add(`${a}>${b}`));
        }
        if (mode === "echo" && e.type === "answer" && seenNodes.size) {
          setHighlight({ nodes: new Set(seenNodes), edges: new Set(seenEdges) });
        }
        if (mode === "echo" && e.type === "step_result" && e.highlight?.nodes?.length) {
          setHighlight({
            nodes: new Set(e.highlight.nodes),
            edges: new Set((e.highlight.edges ?? []).map(([a, b]) => `${a}>${b}`)),
            focus: e.highlight.focus,
          });
        }
      }).catch((err) => update(mode, (r) => ({ ...r, error: String(err.message ?? err), done: true })));
    await Promise.all([runMode("echo"), compare ? runMode("plain") : Promise.resolve()]);
    setBusy(false);
    refresh(ws).catch(() => undefined);
  };

  const retract = async (id: string, restore = false) => {
    if (!ws) return;
    setBusy(true);
    try {
      const r = await api.retract(ws, id, restore);
      setLastRescore({ source: id, ms: r.ms, rescored: r.rescored });
      setSel({ kind: "source", id });
      await refresh(ws);
      const moved = r.rescored.filter((x) => x.before.status !== x.after.status).length;
      flash(
        `${restore ? "Restored" : "Retracted"} ${titles.get(id) ?? id}. ${r.rescored.length} beliefs rescored in ${r.ms} ms, ${moved} changed status.`,
      );
    } catch (e) {
      flash(`Could not update source: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!ws) return;
    setBusy(true);
    await api.reset(ws);
    setTurns([]);
    setSel(null);
    setHighlight(null);
    setLastRescore(null);
    await refresh(ws);
    setBusy(false);
    flash("Workspace reset to the original scenario.");
  };

  const scen = info?.scenario ?? scenarios.find((s) => s.id === scenario) ?? null;
  const suggested = scen?.suggested ?? ["What do I know so far, and how well is it supported?"];
  const stats = info?.stats;

  // ---------------------------------------------------------------- render

  if (fatal) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-8">
          <WarningCircle size={28} className="text-bad" />
          <h1 className="mt-4 font-display text-xl font-semibold">{fatal}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Start the backend with <code className="font-mono text-text">docker compose up</code>, or set{" "}
            <code className="font-mono text-text">NEXT_PUBLIC_API_URL</code> to a running Echo API. A free-tier host may also be
            waking up, which takes about a minute.
          </p>
          <button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-accent px-5 py-2 text-[13px] font-medium text-accent-ink">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const scenarioTabs = [...scenarios.map((s) => ({ id: s.id, title: s.title })), { id: BLANK, title: "Your memory" }];

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-4">
        <Wordmark />
        <div className="scrollbar-thin flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
          {scenarioTabs.map((s) => (
            <button
              key={s.id}
              onClick={() => switchScenario(s.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] transition-colors ${scenario === s.id ? "bg-surface-3 text-text" : "text-faint hover:text-muted"}`}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className="ml-auto hidden items-center gap-5 font-mono text-[11.5px] text-faint xl:flex">
          {stats && (
            <>
              <span><span className="text-text">{stats.sources}</span> sources</span>
              <span><span className="text-text">{stats.beliefs}</span> beliefs</span>
              <span><span className="text-accent">{stats.echoes}</span> echoes caught</span>
              <span><span className="text-text">{stats.lineage_edges}</span> lineage edges</span>
            </>
          )}
          {health && (
            <span className="rounded-full border border-line px-2 py-0.5" title={health.llm ? "Agent runs on an LLM with tool calling" : "No LLM key configured; the built-in reasoner answers"}>
              {health.llm ? health.llm_model : "built-in reasoner"}
            </span>
          )}
        </div>
        <button
          onClick={reset}
          disabled={busy || !ws}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] text-muted hover:text-text disabled:opacity-40 xl:ml-0"
        >
          <ArrowCounterClockwise size={13} /> Reset
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[400px_minmax(0,1fr)_380px] lg:overflow-hidden">
        {/* left: agent + tools */}
        <aside className="order-2 flex min-h-[70dvh] flex-col border-line lg:order-1 lg:min-h-0 lg:border-r">
          <div className="flex shrink-0 gap-1 border-b border-line px-3 pt-3">
            {(
              [
                ["ask", "Agent", ChatCircleText],
                ["ingest", "Add source", Plus],
                ["cypher", "Cypher", Code],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setLeft(k)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-[12.5px] font-medium ${left === k ? "border-accent text-text" : "border-transparent text-faint hover:text-muted"}`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {left === "ask" && (
              <AskPanel
                turns={turns}
                busy={busy || loading}
                suggested={suggested}
                compare={compare}
                setCompare={setCompare}
                onAsk={onAsk}
                titles={titles}
                onCite={(id) => setSel({ kind: "source", id })}
                onHighlight={highlightStep}
              />
            )}
            {left === "ingest" && ws && (
              <IngestPanel
                ws={ws}
                onDone={(r) => {
                  refresh(ws);
                  flash(`Ingested with ${r.edges.length} lineage edges and ${r.claims.length} claims.`);
                }}
              />
            )}
            {left === "cypher" && ws && <CypherConsole ws={ws} />}
          </div>
        </aside>

        {/* center: graph */}
        <main className="relative order-1 h-[58dvh] min-h-[360px] overflow-hidden lg:order-2 lg:h-auto">
          <div className="absolute inset-0 [background-image:radial-gradient(var(--line)_1px,transparent_1px)] [background-size:22px_22px]" />
          {loading ? (
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="skeleton mx-auto size-16 rounded-full" />
                <div className="mt-4 font-mono text-[12px] text-faint">Cloning a private FalkorDB graph for you</div>
              </div>
            </div>
          ) : (
            <GraphView
              nodes={graph.nodes}
              edges={graph.edges}
              highlight={highlight}
              selected={sel?.id ?? null}
              onSelect={selectNode}
              showOwners={showOwners}
              showAgent={showAgent}
              fitKey={ws ?? ""}
            />
          )}
          <Legend showOwners={showOwners} setShowOwners={setShowOwners} showAgent={showAgent} setShowAgent={setShowAgent} />
          {highlight && (
            <button
              onClick={() => {
                setHighlight(null);
                setSel(null);
              }}
              className="absolute right-4 top-4 rounded-full border border-line bg-surface/90 px-3 py-1 text-[11.5px] text-muted backdrop-blur hover:text-text"
            >
              Clear focus
            </button>
          )}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="absolute bottom-4 left-1/2 w-[min(560px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-line-strong bg-surface px-4 py-3 text-[12.5px] text-text shadow-[0_12px_40px_rgb(0_0_0/0.35)]"
                role="status"
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* right: inspector / overview */}
        <aside className="order-3 min-h-[60dvh] border-line lg:min-h-0 lg:border-l">
          <div className="scrollbar-thin h-full overflow-y-auto">
            {sel?.kind === "belief" && report ? (
              <BeliefInspector report={report} onSelectSource={(id) => setSel({ kind: "source", id })} onBack={() => setSel(null)} />
            ) : sel?.kind === "source" && source ? (
              <SourceInspector
                source={source}
                onBack={() => setSel(null)}
                onRetract={(restore) => retract(source.id, restore)}
                busy={busy}
                lastRescore={lastRescore}
                supports={sourceClaims}
                onSelectBelief={(id) => setSel({ kind: "belief", id })}
              />
            ) : sel ? (
              <div className="space-y-3 p-5">
                <div className="skeleton h-5 w-24 rounded" />
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-40 rounded-xl" />
              </div>
            ) : (
              <Overview
                beliefs={beliefs}
                origins={origins}
                rings={rings}
                loading={loading}
                onSelectBelief={(id) => setSel({ kind: "belief", id })}
                onSelectSource={(id) => setSel({ kind: "source", id })}
                onRetract={(id) => retract(id)}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Legend({
  showOwners,
  setShowOwners,
  showAgent,
  setShowAgent,
}: {
  showOwners: boolean;
  setShowOwners: (b: boolean) => void;
  showAgent: boolean;
  setShowAgent: (b: boolean) => void;
}) {
  const item = (swatch: React.ReactNode, label: string) => (
    <div className="flex items-center gap-2">
      <span className="grid w-4 place-items-center">{swatch}</span>
      {label}
    </div>
  );
  return (
    <div className="absolute bottom-4 left-4 hidden space-y-1.5 rounded-xl border border-line bg-surface/90 p-3 text-[11px] text-muted backdrop-blur md:block">
      {item(<span className="size-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />, "Origin")}
      {item(<span className="size-2.5 rounded-full border border-muted" />, "Source")}
      {item(<span className="size-2.5 border border-agent" />, "Agent note")}
      {item(<span className="size-3 rounded-[3px] border border-ok bg-ok/20" />, "Belief, colored by verdict")}
      {item(<span className="h-px w-4 bg-accent" />, "Copied from / cites")}
      <div className="mt-2 space-y-1 border-t border-line pt-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showOwners} onChange={(e) => setShowOwners(e.target.checked)} className="accent-[var(--accent)]" />
          Domains and authors
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showAgent} onChange={(e) => setShowAgent(e.target.checked)} className="accent-[var(--accent)]" />
          Agent memory
        </label>
      </div>
    </div>
  );
}
