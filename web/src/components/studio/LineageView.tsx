"use client";

import dagre from "@dagrejs/dagre";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import { STATUS_META, type Belief, type Report } from "@/lib/api";

/*
 * The proof for one belief, drawn the way the claim travelled:
 * origins on the left, the copies and citations that carry it in the middle, the belief on the right.
 * Every edge is labelled with the evidence Echo found for it.
 */

type SourceData = {
  kind: "source";
  title: string;
  site: string;
  origin: boolean;
  retracted: boolean;
  agent: boolean;
  against: boolean;
  weight: number;
  cluster: number;
};
type BeliefData = { kind: "belief"; report: Report };
type Data = SourceData | BeliefData;

const METHOD_LABEL: Record<string, string> = {
  verbatim: "verbatim copy",
  paraphrase: "paraphrase",
  "shared-specifics": "same figures",
  hyperlink: "links to",
  identifier: "same identifier",
  "agent-note": "agent note",
};

function site(url: string | null | undefined, id: string) {
  if (url) return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (id.startsWith("id:")) return id.split(":").slice(1, 2).join("").toUpperCase();
  return id;
}

function SourceNode({ data, selected }: NodeProps<Node<SourceData>>) {
  const tone = data.retracted
    ? "border-line-strong opacity-60"
    : data.agent
      ? "border-agent/60 border-dashed"
      : data.origin
      ? data.against
        ? "border-ok/70"
        : "border-accent"
      : "border-line-strong";
  return (
    <div
      className={`w-[230px] rounded-lg border bg-surface px-3 py-2.5 shadow-card transition-shadow ${tone} ${selected ? "ring-2 ring-accent/40" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-line-strong" />
      <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
        <span className={`truncate ${data.origin && !data.retracted && !data.agent ? (data.against ? "text-ok" : "text-accent") : "text-muted"}`}>
          {data.agent ? "agent note" : data.site}
        </span>
        {data.retracted ? (
          <span className="shrink-0 text-bad">retracted</span>
        ) : data.agent ? (
          <span className="shrink-0 text-agent">weight 0</span>
        ) : data.origin ? (
          <span className={`shrink-0 uppercase tracking-wider ${data.against ? "text-ok" : "text-accent"}`}>origin</span>
        ) : null}
      </div>
      <div className={`mt-1 line-clamp-2 text-[12px] leading-snug ${data.retracted ? "text-faint line-through" : "text-text"}`}>{data.title}</div>
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-line-strong" />
    </div>
  );
}

function BeliefNode({ data }: NodeProps<Node<BeliefData>>) {
  const v = data.report.verdict;
  const meta = STATUS_META[v.status];
  return (
    <div className="w-[270px] rounded-lg border-2 bg-surface px-4 py-3 shadow-card" style={{ borderColor: meta.color }}>
      <Handle type="target" position={Position.Left} className="!size-2 !border-0" style={{ background: meta.color }} />
      <div className="flex items-center justify-between">
        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}>
          {meta.label}
        </span>
        <span className="font-mono text-[10.5px] text-faint">belief</span>
      </div>
      <div className="mt-2 text-[13px] font-medium leading-snug text-text">{data.report.statement}</div>
      <div className="mt-2.5 flex items-baseline gap-2 border-t border-line pt-2 font-mono text-[11px] text-muted">
        <span>
          <span className="text-text">{v.sources}</span> sources
        </span>
        <span className="text-faint">→</span>
        <span>
          <span className="text-accent">{v.origins}</span> {v.origins === 1 ? "origin" : "origins"}
        </span>
        {v.against_origins > 0 && (
          <span className="ml-auto text-bad">
            {v.against_origins} against
          </span>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { source: SourceNode, belief: BeliefNode };

function layout(report: Report): { nodes: Node<Data>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 16, ranksep: 96, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  const info = new Map<string, SourceData>();
  const edges: Edge[] = [];
  const seenEdge = new Set<string>();
  const addEdge = (from: string, to: string, label: string, kind: "copy" | "owner" | "supports" | "contradicts") => {
    const id = `${from}>${to}`;
    if (seenEdge.has(id) || from === to) return;
    seenEdge.add(id);
    const color = kind === "supports" ? "var(--ok)" : kind === "contradicts" ? "var(--bad)" : kind === "owner" ? "var(--owner)" : "var(--accent)";
    edges.push({
      id,
      source: from,
      target: to,
      label,
      type: "smoothstep",
      animated: kind === "copy",
      style: { stroke: color, strokeWidth: kind === "copy" ? 1.6 : 1.2, strokeDasharray: kind === "owner" || kind === "contradicts" ? "4 3" : undefined },
      labelStyle: { fill: kind === "copy" ? "var(--accent)" : "var(--muted)", fontSize: 10, fontFamily: "var(--font-geist-mono)" },
      labelBgStyle: { fill: "var(--bg)" },
      labelBgPadding: [4, 2],
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
    });
  };

  const touch = (id: string, ci: number, against: boolean) => {
    const s = report.sources[id];
    const existing = info.get(id);
    const roots = new Set(report.verdict.clusters.flatMap((c) => c.roots));
    info.set(id, {
      kind: "source",
      title: s?.title ?? id.replace(/^(url|id):/, ""),
      site: site(s?.url, id),
      origin: roots.has(id),
      retracted: !!s?.retracted,
      agent: s?.kind === "agent" || id.startsWith("note:"),
      against,
      weight: s?.weight ?? 0,
      cluster: existing?.cluster ?? ci,
    });
  };

  report.verdict.clusters.forEach((c, ci) => {
    const against = c.stance === "contradicts";
    [...c.members, ...c.roots, ...c.dead_roots].forEach((id) => touch(id, ci, against));
    // Each supporting/contradicting source feeds the belief.
    c.members.forEach((m) => addEdge(m, report.id, against ? "contradicts" : "", against ? "contradicts" : "supports"));
  });

  // Copy / citation hops, drawn upstream → downstream (the way the claim travelled).
  report.paths.forEach((p) =>
    p.hops.forEach((h, i) => {
      const down = p.nodes[i];
      const up = p.nodes[i + 1];
      if (!info.has(up)) touch(up, 0, false);
      if (!info.has(down)) touch(down, 0, false);
      addEdge(up, down, METHOD_LABEL[h.method] ?? h.method, "copy");
    }),
  );

  // Sources folded in by a shared owner (no copy path): tie them to their cluster's root.
  report.verdict.clusters.forEach((c) => {
    if (!c.shared_owners.length || !c.roots.length) return;
    const root = c.roots[0];
    c.members.forEach((m) => {
      if (m === root) return;
      const linked = edges.some((e) => e.target === m && e.source !== report.id && e.id !== `${m}>${report.id}`);
      if (!linked) addEdge(root, m, `same ${c.shared_owners[0].split(":").slice(0, 2).join(" ")}`, "owner");
    });
  });

  info.forEach((_, id) => g.setNode(id, { width: 230, height: 64 }));
  g.setNode(report.id, { width: 270, height: 112 });
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const nodes: Node<Data>[] = [
    ...[...info.entries()].map(([id, data]) => {
      const p = g.node(id);
      return { id, type: "source", position: { x: p.x - 115, y: p.y - 32 }, data } as Node<Data>;
    }),
    (() => {
      const p = g.node(report.id);
      return { id: report.id, type: "belief", position: { x: p.x - 135, y: p.y - 56 }, data: { kind: "belief", report } } as Node<Data>;
    })(),
  ];
  return { nodes, edges };
}

function Flow({ report, onSelectSource }: { report: Report; onSelectSource: (id: string) => void }) {
  const { nodes, edges } = useMemo(() => layout(report), [report]);
  const rf = useReactFlow();
  useEffect(() => {
    const t = window.setTimeout(() => rf.fitView({ padding: 0.12, duration: 500, maxZoom: 1.2 }), 30);
    return () => window.clearTimeout(t);
  }, [report, rf]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesConnectable={false}
      edgesFocusable={false}
      minZoom={0.2}
      maxZoom={1.8}
      fitView
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, n) => {
        if (n.type === "source" && !n.id.startsWith("url:") && !n.id.startsWith("id:")) onSelectSource(n.id);
      }}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--line-strong)" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

export function LineageView({
  report,
  beliefs,
  onPick,
  onSelectSource,
}: {
  report: Report | null;
  beliefs: Belief[];
  onPick: (id: string) => void;
  onSelectSource: (id: string) => void;
}) {
  if (!report) {
    const ranked = [...beliefs].sort((a, b) => (b.sources ?? 0) - (b.origins ?? 0) - ((a.sources ?? 0) - (a.origins ?? 0))).slice(0, 5);
    return (
      <div className="dots grid h-full place-items-center p-6">
        <div className="w-full max-w-md">
          <span className="eyebrow">Lineage</span>
          <h3 className="display mt-3 text-[28px] leading-tight">Pick a belief to trace where it came from.</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            The diagram reads left to right: the origins, the copies and citations that carried the claim, and the belief they
            add up to.
          </p>
          <div className="mt-5 divide-y divide-line border-y border-line">
            {ranked.map((b) => (
              <button key={b.id} onClick={() => onPick(b.id)} className="group flex w-full items-center gap-3 py-3 text-left">
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-text group-hover:text-accent">{b.statement}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {b.sources} → <span className="text-accent">{b.origins}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full">
      <ReactFlowProvider>
        <Flow report={report} onSelectSource={onSelectSource} />
      </ReactFlowProvider>
    </div>
  );
}
