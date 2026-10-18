"use client";

import {
  ArrowCounterClockwise,
  ArrowsInSimple,
  ArrowsOutSimple,
  ChatCircleText,
  Code,
  Graph as GraphIcon,
  Plus,
  Question,
  TreeStructure,
  WarningCircle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mark, ThemeToggle } from "../Brand";
import Link from "next/link";
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
import { MapView, type Highlight } from "./MapView";
import { Guide, GuidePill, type GuideKey, type GuideStep } from "./Guide";
import { LineageView } from "./LineageView";
import { Tour, type TourStep } from "./Tour";

const TOUR: TourStep[] = [
  {
    target: "scenarios",
    title: "Pick a story",
    body: "Two prepared memories: a vendor claim planted across five sites, and a citation loop with no attacker. “Your memory” starts empty for your own pages.",
  },
  {
    target: "agent",
    title: "The research agent",
    body: "Ask anything. The same agent answers twice: with Echo, and with a plain memory that counts mentions. Each tool call streams in with the Cypher it ran.",
  },
  {
    target: "canvas",
    title: "Memory as a graph",
    body: "Sources are circles, beliefs are squares coloured by verdict, and the lines are copies and citations. Origins glow. Click anything to inspect it.",
  },
  {
    target: "views",
    title: "Map or Lineage",
    body: "Lineage draws one belief's proof left to right: the origins, the copies that carried the claim, and the belief, with the evidence on every edge.",
  },
  {
    target: "beliefs",
    title: "Beliefs and verdicts",
    body: "Each belief shows sources → independent origins, its verdict, and what a plain memory would say. Load-bearing ranks origins with PageRank; Rings finds coordinated sites.",
  },
  {
    target: "guide",
    title: "Start here",
    body: "The guide walks you through the whole story in five steps, with a button that does each one for you.",
  },
];
import { BeliefInspector, SourceInspector } from "./Inspector";
import { Overview } from "./Overview";
import { CypherConsole, IngestPanel } from "./Tools";
import { EXAMPLES, loadExamples } from "@/lib/examples";

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
  const [waking, setWaking] = useState(false);
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
  const [view, setView] = useState<"map" | "lineage">("map");
  const [tourOpen, setTourOpen] = useState(false);
  // Full-width canvas: hides both side panels to explore the map or a lineage.
  const [expanded, setExpanded] = useState(false);

  // The lineage view stays on the last belief opened, even while a source is inspected (e.g. right after a retraction).
  const [lineageId, setLineageId] = useState<string | null>(null);
  const [lineage, setLineage] = useState<Report | null>(null);
  const pendingTop = useRef(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const [done, setDone] = useState<Record<GuideKey, boolean>>({ asked: false, opened: false, lineage: false, retracted: false, loop: false });

  useEffect(() => {
    try {
      const v = JSON.parse(storageGet("echo.guide") ?? "null");
      if (v) setDone((d) => ({ ...d, ...v }));
    } catch {}
    if (storageGet("echo.guide.hidden") === "1") setGuideOpen(false);
  }, []);
  const mark = useCallback((k: GuideKey) => {
    setDone((d) => {
      if (d[k]) return d;
      const n = { ...d, [k]: true };
      storageSet("echo.guide", JSON.stringify(n));
      return n;
    });
  }, []);
  useEffect(() => {
    if (!loading && !fatal && storageGet("echo.tour.done") !== "1") {
      const t = window.setTimeout(() => setTourOpen(true), 600);
      return () => window.clearTimeout(t);
    }
  }, [loading, fatal]);
  const closeTour = useCallback(() => {
    setTourOpen(false);
    storageSet("echo.tour.done", "1");
  }, []);

  const toggleGuide = (open: boolean) => {
    setGuideOpen(open);
    storageSet("echo.guide.hidden", open ? "0" : "1");
  };

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
      setLineageId(null);
      setLineage(null);
      const key = `echo.ws.${scenario}`;
      let w = storageGet(key);
      try {
        // A free host may be asleep. Wait for it (up to ~2 minutes) before giving up.
        for (let i = 0; ; i++) {
          try {
            setHealth(await api.health());
            break;
          } catch {
            if (cancelled || i >= 40) throw new Error("unreachable");
            setWaking(true);
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
        setWaking(false);
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
        if (scenario === "citogenesis") mark("loop");
      } catch {
        if (!cancelled) setFatal(`Can't reach the Echo API at ${API}.`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenario, refresh, mark]);

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
        setLineageId(r.id);
        setLineage(r);
        if (r.verdict.echo) mark("opened");
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
  }, [ws, sel, graph.edges, mark]);

  useEffect(() => {
    if (view === "lineage" && lineage) mark("lineage");
  }, [view, lineage, mark]);

  // Keep the pinned lineage fresh when the graph changes (new notes, retractions).
  useEffect(() => {
    if (!ws || !lineageId) return;
    let cancelled = false;
    api.belief(ws, lineageId).then((r) => !cancelled && setLineage(r)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ws, lineageId, graph]);

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
    mark("asked");
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
      if (!restore) mark("retracted");
      const moved = r.rescored.filter((x) => x.before.status !== x.after.status).length;
      flash(
        `${restore ? "Restored" : "Retracted"} ${titles.get(id) ?? id}. ${r.rescored.length} ${r.rescored.length === 1 ? "belief" : "beliefs"} rescored in ${r.ms} ms, ${moved} changed status.`,
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

  // After the example pages land: open the belief they corroborate, straight in the lineage view.
  const afterExamples = async () => {
    if (!ws) return;
    await refresh(ws);
    const bs = await api.beliefs(ws);
    const top = [...bs].sort((a, b) => (b.sources ?? 0) - (a.sources ?? 0))[0];
    if (top) {
      setSel({ kind: "belief", id: top.id });
      setView("lineage");
      flash(`“${top.statement}” has ${top.sources} sources but ${top.origins} independent ${top.origins === 1 ? "origin" : "origins"}: the news site copied the first lab.`);
    }
  };
  const [exStep, setExStep] = useState<number | null>(null);
  const runExamples = async () => {
    if (!ws) return;
    try {
      await loadExamples(ws, setExStep);
      await afterExamples();
    } catch (e) {
      flash(`Could not load the examples: ${(e as Error).message}`);
    } finally {
      setExStep(null);
    }
  };

  const scen = info?.scenario ?? scenarios.find((s) => s.id === scenario) ?? null;
  const suggested = scen?.suggested ?? ["What do I know so far, and how well is it supported?"];
  const stats = info?.stats;

  // ---------------------------------------------------------------- render

  const scenarioTabs = [...scenarios.map((s) => ({ id: s.id, title: s.title })), { id: BLANK, title: "Your memory" }];

  // The belief with the widest gap between sources and origins: the one the story is about.
  const topEcho = [...beliefs]
    .filter((b) => b.echo)
    .sort((a, b) => (b.sources ?? 0) - (b.origins ?? 0) - ((a.sources ?? 0) - (a.origins ?? 0)))[0];
  const openTop = () => {
    if (topEcho) setSel({ kind: "belief", id: topEcho.id });
  };
  const halcyon = scenarios.find((x) => x.id === "halcyon");
  const guideSteps: GuideStep[] = [
    {
      key: "asked",
      title: "Ask the agent",
      body: "It answers twice on the same sources: once with a plain memory that counts mentions, once with Echo.",
      cta: "Ask the hospital question",
      disabled: busy || loading,
      run: () => {
        if (scenario !== "halcyon") switchScenario("halcyon");
        else onAsk(halcyon?.question ?? suggested[0]);
      },
    },
    {
      key: "opened",
      title: "Open the disputed belief",
      body: "Five pages call Halcyon the safest gateway. See how many independent origins they really have.",
      cta: "Open it",
      disabled: !topEcho,
      run: openTop,
    },
    {
      key: "lineage",
      title: "Trace its lineage",
      body: "Origins on the left, the copies that carried the claim in the middle, the belief on the right. Every edge shows its evidence.",
      cta: "Show the lineage",
      run: () => {
        if (!sel || sel.kind !== "belief") openTop();
        setView("lineage");
      },
    },
    {
      key: "retracted",
      title: "Retract the planted post",
      body: "Say your security team flags it. Every belief built on it is rescored in the same request.",
      cta: "Retract it",
      disabled: busy || !scen?.retract_hint,
      run: () => scen?.retract_hint && retract(scen.retract_hint),
    },
    {
      key: "loop",
      title: "Try the circular citation",
      body: "No attacker this time: a wiki cites a newspaper that copied the wiki. Echo counts the loop once.",
      cta: "Open that scenario",
      run: () => {
        pendingTop.current = true;
        switchScenario("citogenesis");
      },
    },
  ];
  // The lineage diagram carries the verdict itself, so it gets the inspector's column while a belief is open.
  const wide = view === "lineage" && !!lineage && sel?.kind !== "source";
  // After the guide switches scenario, open that scenario's headline belief in the lineage view.
  useEffect(() => {
    if (pendingTop.current && !loading && topEcho) {
      pendingTop.current = false;
      setSel({ kind: "belief", id: topEcho.id });
      setView("lineage");
    }
  }, [loading, topEcho]);
  const doneCount = guideSteps.filter((g) => done[g.key]).length;
  const guide = <Guide steps={guideSteps} done={done} onClose={() => toggleGuide(false)} />;

  if (fatal) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-8">
          <WarningCircle size={28} className="text-bad" />
          <h1 className="display mt-4 text-2xl">{fatal}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Start the backend with <code className="font-mono text-text">docker compose up</code>, or set{" "}
            <code className="font-mono text-text">NEXT_PUBLIC_API_URL</code> to a running Echo API. A free-tier host may also be
            waking up, which takes about a minute.
          </p>
          <button onClick={() => window.location.reload()} className="mt-6 rounded-md bg-text px-4 py-2 text-[13px] font-medium text-bg">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <Tour steps={TOUR} open={tourOpen} onClose={closeTour} />
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Mark size={28} />
          <span className="display text-[21px] leading-none">Echo</span>
        </Link>
        <span className="text-line-strong">/</span>
        <div data-tour="scenarios" className="scrollbar-thin flex gap-0.5 overflow-x-auto rounded-lg border border-line bg-bg p-0.5">
          {scenarioTabs.map((s) => (
            <button
              key={s.id}
              onClick={() => switchScenario(s.id)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[12.5px] transition-colors ${
                scenario === s.id ? "bg-surface text-text shadow-card" : "text-faint hover:text-muted"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className="ml-auto hidden items-center gap-4 font-mono text-[11px] text-faint 2xl:flex">
          {stats && (
            <>
              <span><span className="text-text">{stats.sources}</span> sources</span>
              <span><span className="text-text">{stats.beliefs}</span> beliefs</span>
              <span><span className="text-accent">{stats.echoes}</span> echoes caught</span>
              <span><span className="text-text">{stats.lineage_edges}</span> lineage edges</span>
            </>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 2xl:ml-3">
          <button
            onClick={() => setTourOpen(true)}
            className="hidden items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] text-muted hover:text-text md:flex"
          >
            <Question size={13} /> Tour
          </button>
          <span className="hidden lg:block" data-tour="guide">
            <GuidePill count={doneCount} total={guideSteps.length} onClick={() => toggleGuide(!guideOpen)} />
          </span>
          {health && (
            <span
              className="hidden rounded-md border border-line px-2 py-1.5 font-mono text-[11px] text-muted xl:block"
              title={health.llm ? "Agent runs on an LLM with tool calling" : "No LLM key configured; the built-in reasoner answers"}
            >
              {health.llm ? health.llm_model : "built-in reasoner"}
            </span>
          )}
          <ThemeToggle />
          <button
            onClick={reset}
            disabled={busy || !ws}
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] text-muted hover:text-text disabled:opacity-40"
          >
            <ArrowCounterClockwise size={13} /> Reset
          </button>
        </div>
      </header>

      <div className={`grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:overflow-hidden ${
          expanded ? "lg:grid-cols-[minmax(0,1fr)]" : wide ? "lg:grid-cols-[380px_minmax(0,1fr)]" : "lg:grid-cols-[380px_minmax(0,1fr)_370px]"
        }`}>
        {/* left: agent + tools */}
        <aside data-tour="agent" className={`order-2 flex min-h-[70dvh] flex-col border-line bg-surface lg:order-1 lg:min-h-0 lg:border-r ${expanded ? "lg:hidden" : ""}`}>
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
                onCite={(id) => setSel(id.startsWith("b:") ? { kind: "belief", id } : { kind: "source", id })}
                onHighlight={highlightStep}
                intro={guideOpen ? <div data-tour="guide">{guide}</div> : null}
              />
            )}
            {left === "ingest" && ws && (
              <IngestPanel
                ws={ws}
                onDone={(r) => {
                  refresh(ws);
                  flash(
                    `Added with ${r.edges.length} lineage ${r.edges.length === 1 ? "edge" : "edges"} and ${r.claims.length} ${r.claims.length === 1 ? "claim" : "claims"}.`,
                  );
                }}
                onExamples={afterExamples}
              />
            )}
            {left === "cypher" && ws && <CypherConsole ws={ws} />}
          </div>
        </aside>

        {/* center: graph */}
        <main data-tour="canvas" className="relative order-1 h-[62dvh] min-h-[380px] overflow-hidden bg-bg lg:order-2 lg:h-auto">

          {loading ? (
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="skeleton mx-auto size-14 rounded-full" />
                <div className="mt-4 font-mono text-[12px] text-faint">
                  {waking ? "Waking the API. Free hosting sleeps when idle; this takes up to a minute." : "Cloning a private FalkorDB graph for you"}
                </div>
              </div>
            </div>
          ) : view === "lineage" ? (
            <LineageView
              report={lineage}
              beliefs={beliefs}
              onPick={(id) => setSel({ kind: "belief", id })}
              onSelectSource={(id) => setSel({ kind: "source", id })}
            />
          ) : (
            <MapView
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

          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
            <div data-tour="views" className="flex rounded-lg border border-line bg-surface p-0.5 shadow-card">
              {(
                [
                  ["map", "Map", GraphIcon],
                  ["lineage", "Lineage", TreeStructure],
                ] as const
              ).map(([k, label, Icon]) => (
                <button
                  key={k}
                  onClick={() => setView(k)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    view === k ? "bg-text text-bg" : "text-muted hover:text-text"
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setExpanded((e) => !e)}
              aria-pressed={expanded}
              title={expanded ? "Show the panels" : "Expand the canvas"}
              className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] text-muted shadow-card hover:text-text lg:flex"
            >
              {expanded ? <ArrowsInSimple size={13} /> : <ArrowsOutSimple size={13} />}
              {expanded ? "Panels" : "Expand"}
            </button>
            {highlight && view === "map" && (
              <button
                onClick={() => {
                  setHighlight(null);
                  setSel(null);
                }}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] text-muted shadow-card hover:text-text"
              >
                Clear focus
              </button>
            )}
          </div>

          {!loading && graph.nodes.length === 0 && (
            <div className="absolute inset-0 z-10 grid place-items-center p-6">
              <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center shadow-card">
                <span className="eyebrow">Your memory</span>
                <h3 className="display mt-3 text-[26px] leading-tight">This memory is empty.</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                  Add pages and Echo links each one back to where it came from. Start with three example pages, or add your own.
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    onClick={runExamples}
                    disabled={exStep !== null}
                    className="rounded-md bg-text py-2.5 text-[13px] font-medium text-bg active:scale-[0.98] disabled:opacity-60"
                  >
                    {exStep !== null ? `Reading ${EXAMPLES[exStep].author}… (${exStep + 1}/${EXAMPLES.length})` : "Load example pages"}
                  </button>
                  <button onClick={() => setLeft("ingest")} className="rounded-md border border-line-strong py-2.5 text-[13px] text-text hover:bg-surface-2">
                    Add your own page
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === "map" && <Legend showOwners={showOwners} setShowOwners={setShowOwners} showAgent={showAgent} setShowAgent={setShowAgent} />}

          {guideOpen && !loading && turns.length > 0 && (
            <div className="absolute bottom-3 left-3 z-10 w-[min(440px,calc(100%-1.5rem))]">
              <Guide steps={guideSteps} done={done} onClose={() => toggleGuide(false)} compact />
            </div>
          )}

          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute left-1/2 top-14 z-20 w-[min(520px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-line bg-text px-4 py-3 text-[12.5px] text-bg shadow-card"
                role="status"
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* right: inspector / overview */}
        <aside data-tour="beliefs" className={`order-3 min-h-[60dvh] border-line bg-surface lg:min-h-0 lg:border-l ${wide || expanded ? "lg:hidden" : ""}`}>
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
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="grid w-3.5 place-items-center">{swatch}</span>
      {label}
    </span>
  );
  const toggle = (on: boolean, set: (b: boolean) => void, label: string) => (
    <button
      onClick={() => set(!on)}
      aria-pressed={on}
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 transition-colors ${
        on ? "border-accent/50 bg-accent-soft text-accent" : "border-line-strong text-faint hover:text-text"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 hidden max-w-[calc(100%-330px)] justify-end xl:flex">
      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-x-3.5 gap-y-1.5 rounded-lg border border-line bg-surface/90 px-3 py-1.5 text-[11px] text-muted shadow-card backdrop-blur">
        {item(<span className="h-2.5 w-3.5 rounded-[3px] border border-accent bg-surface" />, "Origin")}
        {item(<span className="h-2.5 w-3.5 rounded-[3px] border border-line-strong bg-surface" />, "Copy")}
        {item(<span className="h-2.5 w-3.5 rounded-[3px] border border-dashed border-accent/50 bg-accent-soft" />, "Family")}
        {item(<span className="h-px w-3.5 bg-accent" />, "Copied / cites")}
        {item(<span className="h-px w-3.5 bg-ok" />, "Supports")}
        {item(<span className="h-0 w-3.5 border-t border-dashed border-bad" />, "Contradicts")}
        <span className="h-3 w-px bg-line-strong" />
        {toggle(showOwners, setShowOwners, "Owner tags")}
        {toggle(showAgent, setShowAgent, "Agent memory")}
      </div>
    </div>
  );
}
