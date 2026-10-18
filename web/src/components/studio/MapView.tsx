"use client";

import dagre from "@dagrejs/dagre";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { STATUS_META, type GraphEdge, type GraphNode } from "@/lib/api";
export interface Highlight {
  nodes: Set<string>;
  edges: Set<string>; // "a>b", in the stored edge direction
  focus?: string;
}

/*
 * The whole memory as a readable map.
 * Sources are laid out by lineage (origins left, copies to the right of what they copied), sources that
 * share an origin sit in one labelled "family" box, and beliefs line up in a column on the right next to
 * the sources that support them. Hover lights up a neighbourhood; agent steps move the camera.
 */

const LINEAGE = new Set(["CITES", "COPIED_FROM", "DERIVED_FROM"]);
const SRC_W = 228;
const SRC_H = 70;
const STUB_W = 176;
const STUB_H = 34;
const BEL_W = 264;
const BEL_H = 104;
const NOTE_W = 200;
const NOTE_H = 50;

// Room for the floating toolbar (top) and the zoom controls / minimap (bottom right).
const FIT_PAD = { top: "84px", bottom: "36px", left: "28px", right: "28px" } as const;
const FOCUS_PAD = { top: "96px", bottom: "48px", left: "48px", right: "48px" } as const;

const METHOD: Record<string, string> = {
  verbatim: "verbatim copy",
  paraphrase: "paraphrase",
  "shared-specifics": "same figures",
  hyperlink: "links to",
  identifier: "same identifier",
  "agent-note": "agent note",
};

type Chip = { text: string; tone: "net" | "plain" };
type SourceData = {
  g: GraphNode;
  site: string;
  origin: boolean;
  copies: number;
  chips: Chip[];
  dim: boolean;
  active: boolean;
  selected: boolean;
};
type BeliefData = { g: GraphNode; dim: boolean; active: boolean; selected: boolean };
type FamilyData = { label: string; echo: boolean; dim: boolean; w: number; h: number };

function site(n: GraphNode) {
  if (n.url) return n.url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return n.kind === "doc" ? "document" : n.kind === "user" ? "your note" : n.kind ?? "source";
}

const fade = (dim: boolean) => `transition-opacity duration-300 ${dim ? "opacity-[0.18]" : "opacity-100"}`;
const ring = (on: boolean) => (on ? "ring-2 ring-accent/50 ring-offset-2 ring-offset-bg" : "");

const SourceNode = memo(function SourceNode({ data }: NodeProps<Node<SourceData>>) {
  const { g, origin } = data;
  const agent = g.kind === "agent";
  const gone = !!g.retracted;
  const border = gone ? "border-line-strong" : agent ? "border-agent/60 border-dashed" : origin ? "border-accent" : data.active ? "border-accent/50" : "border-line-strong";
  return (
    <div className={`${fade(data.dim)} ${ring(data.selected)} rounded-lg`} style={{ width: agent ? NOTE_W : SRC_W }}>
      <Handle type="target" position={Position.Left} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-line-strong" />
      <div className={`rounded-lg border bg-surface px-3 py-2 shadow-card ${border} ${gone ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-1.5 font-mono text-[10px] leading-none">
          <span className={`size-1.5 shrink-0 rounded-full ${gone ? "bg-gone" : agent ? "bg-agent" : origin ? "bg-accent" : "bg-faint"}`} />
          <span className={`min-w-0 flex-1 truncate ${origin && !gone && !agent ? "text-accent" : "text-muted"}`}>{agent ? "agent note" : data.site}</span>
          {gone ? (
            <span className="text-bad">retracted</span>
          ) : agent ? (
            <span className="text-agent">weight 0</span>
          ) : origin ? (
            <span className="tracking-wider text-accent">ORIGIN</span>
          ) : null}
        </div>
        <div className={`mt-1.5 line-clamp-2 text-[12px] leading-snug ${gone ? "text-faint line-through" : "text-text"}`}>{g.name}</div>
        {(data.chips.length > 0 || data.copies > 0) && !agent && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {data.chips.slice(0, 2).map((c) => (
              <span
                key={c.text}
                className={`max-w-full truncate rounded px-1 py-px font-mono text-[9px] ${c.tone === "net" ? "bg-bad/10 text-bad" : "bg-surface-3 text-muted"}`}
              >
                {c.text}
              </span>
            ))}
            {data.copies > 0 && (
              <span className="ml-auto font-mono text-[9px] text-faint">
                {data.copies} {data.copies === 1 ? "copy" : "copies"}
              </span>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-line-strong" />
    </div>
  );
});

const StubNode = memo(function StubNode({ data }: NodeProps<Node<SourceData>>) {
  return (
    <div className={`${fade(data.dim)} ${ring(data.selected)} rounded-full`} style={{ width: STUB_W }}>
      <Handle type="target" position={Position.Left} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-line-strong" />
      <div
        className={`flex h-[34px] items-center gap-1.5 rounded-full border border-dashed bg-surface px-3 font-mono text-[10px] ${data.origin ? "border-accent text-accent" : "border-line-strong text-muted"}`}
      >
        <span className="truncate">{data.g.name.replace(/^(url|id):/, "")}</span>
        {data.origin && <span className="ml-auto shrink-0 tracking-wider">ORIGIN</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-line-strong" />
    </div>
  );
});

const BeliefNode = memo(function BeliefNode({ data }: NodeProps<Node<BeliefData>>) {
  const { g } = data;
  const meta = g.status ? STATUS_META[g.status] : null;
  const sources = g.sources ?? 0;
  const origins = g.origins ?? 0;
  return (
    <div className={`${fade(data.dim)} ${ring(data.selected)} rounded-xl`} style={{ width: BEL_W }}>
      <Handle type="target" position={Position.Left} className="!size-2 !min-h-0 !min-w-0 !border-0" style={{ background: meta?.color ?? "var(--faint)" }} />
      <div
        className="rounded-xl border-[1.5px] bg-surface px-3.5 py-2.5 shadow-card"
        style={{ borderColor: meta ? `color-mix(in srgb, ${meta.color} ${data.active ? 90 : 55}%, transparent)` : "var(--line-strong)" }}
      >
        <div className="flex items-center justify-between gap-2">
          {meta && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}>
              {meta.label}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted">
            {sources} src → <span className="text-accent">{origins}</span>
          </span>
        </div>
        <div className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-text">{g.name}</div>
        {/* sources as dots, independent origins filled: the echo at a glance */}
        <div className="mt-2 flex items-center gap-[3px]" aria-hidden>
          {Array.from({ length: Math.min(sources, 12) }, (_, i) => (
            <span key={i} className={`size-[7px] rounded-full ${i < origins ? "" : "border border-line-strong"}`} style={i < origins ? { background: meta?.color ?? "var(--accent)" } : undefined} />
          ))}
        </div>
      </div>
    </div>
  );
});

const FamilyNode = memo(function FamilyNode({ data }: NodeProps<Node<FamilyData>>) {
  return (
    <div
      className={`pointer-events-none rounded-2xl border border-dashed transition-opacity duration-300 ${data.echo ? "border-accent/40 bg-accent-soft/40" : "border-line-strong bg-surface-2/40"} ${data.dim ? "opacity-30" : "opacity-100"}`}
      style={{ width: data.w, height: data.h }}
    >
      <span className={`absolute -top-2.5 left-3 rounded-full px-2 font-mono text-[9.5px] uppercase tracking-[0.12em] ${data.echo ? "bg-bg text-accent" : "bg-bg text-faint"}`}>
        {data.label}
      </span>
    </div>
  );
});

const nodeTypes = { source: SourceNode, stub: StubNode, belief: BeliefNode, family: FamilyNode };

/* ------------------------------------------------------------------ layout */

type Layout = {
  nodes: Node[];
  edges: Edge[];
  columns: { x: number; label: string }[];
  top: number;
  adj: Map<string, Set<string>>;
  edgeKeysOf: Map<string, Set<string>>;
};

function layout(all: GraphNode[], allEdges: GraphEdge[], showOwners: boolean, showAgent: boolean): Layout {
  const byId = new Map(all.map((n) => [n.id, n]));
  const isNote = (n: GraphNode) => n.label === "Source" && n.kind === "agent";
  const sources = all.filter((n) => n.label === "Source" && !isNote(n));
  const notes = showAgent ? all.filter(isNote) : [];
  const beliefs = all.filter((n) => n.label === "Belief");
  const keep = new Set([...sources, ...notes, ...beliefs].map((n) => n.id));

  const lineage = allEdges.filter((e) => LINEAGE.has(e.type) && keep.has(e.source) && keep.has(e.target));
  const claims = allEdges.filter((e) => (e.type === "SUPPORTS" || e.type === "CONTRADICTS") && keep.has(e.source) && keep.has(e.target));
  const owners = allEdges.filter((e) => e.type === "PUBLISHED_BY");

  // upstream / downstream among sources
  const ups = new Map<string, string[]>();
  const downs = new Map<string, number>();
  lineage.forEach((e) => {
    ups.set(e.source, [...(ups.get(e.source) ?? []), e.target]);
    downs.set(e.target, (downs.get(e.target) ?? 0) + 1);
  });

  // families: sources joined by lineage or a shared network fingerprint (how Echo collapses them)
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  sources.forEach((s) => parent.set(s.id, s.id));
  lineage.filter((e) => parent.has(e.source) && parent.has(e.target)).forEach((e) => union(e.source, e.target));
  const netOf = new Map<string, string[]>();
  owners.forEach((e) => {
    const o = byId.get(e.target);
    if (o?.kind === "network" && parent.has(e.source)) netOf.set(o.id, [...(netOf.get(o.id) ?? []), e.source]);
  });
  netOf.forEach((ms) => ms.slice(1).forEach((m) => union(ms[0], m)));
  const families = new Map<string, string[]>();
  sources.forEach((s) => families.set(find(s.id), [...(families.get(find(s.id)) ?? []), s.id]));

  const isOrigin = (id: string) => !(ups.get(id)?.length) && (downs.get(id) ?? 0) > 0;
  const chipsOf = (id: string): Chip[] =>
    owners
      .filter((e) => e.source === id)
      .map((e) => byId.get(e.target))
      .filter((o): o is GraphNode => !!o && (o.kind === "network" || showOwners))
      .map((o) => ({ text: o.kind === "network" ? o.name : `${o.kind}: ${o.name}`, tone: o.kind === "network" ? "net" : "plain" }));

  // dagre over sources only: copies sit to the right of what they copied
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({ rankdir: "LR", ranksep: 76, nodesep: 14, marginx: 30, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));
  const famIds: string[] = [];
  families.forEach((members, root) => {
    if (members.length < 2) return;
    const fid = `fam:${root}`;
    famIds.push(fid);
    g.setNode(fid, { padding: 16 });
  });
  sources.forEach((s) => {
    const stub = s.kind === "stub" || s.kind === "ident";
    g.setNode(s.id, { width: stub ? STUB_W : SRC_W, height: stub ? STUB_H : SRC_H });
    const members = families.get(find(s.id))!;
    if (members.length >= 2) g.setParent(s.id, `fam:${find(s.id)}`);
  });
  lineage.filter((e) => parent.has(e.source) && parent.has(e.target)).forEach((e) => g.setEdge(e.target, e.source));
  dagre.layout(g);

  const nodes: Node[] = [];
  let maxRight = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  const pos = new Map<string, { x: number; y: number }>();
  sources.forEach((s) => {
    const p = g.node(s.id);
    const stub = s.kind === "stub" || s.kind === "ident";
    const w = stub ? STUB_W : SRC_W;
    const h = stub ? STUB_H : SRC_H;
    pos.set(s.id, { x: p.x, y: p.y });
    maxRight = Math.max(maxRight, p.x + w / 2);
    minY = Math.min(minY, p.y - h / 2);
    maxY = Math.max(maxY, p.y + h / 2);
    nodes.push({
      id: s.id,
      type: stub ? "stub" : "source",
      position: { x: p.x - w / 2, y: p.y - h / 2 },
      width: w,
      height: h,
      data: { g: s, site: site(s), origin: isOrigin(s.id) || (stub && (downs.get(s.id) ?? 0) > 0), copies: downs.get(s.id) ?? 0, chips: chipsOf(s.id) } as unknown as Record<string, unknown>,
      zIndex: 2,
    });
  });
  if (!sources.length) {
    maxRight = 0;
    minY = 0;
    maxY = 200;
  }

  famIds.forEach((fid) => {
    const f = g.node(fid) as unknown as { x: number; y: number; width: number; height: number };
    const members = families.get(fid.slice(4))!;
    const origins = members.filter((m) => isOrigin(m) || !(ups.get(m)?.length)).length;
    // every member cites another: a citation loop, which Echo counts as one origin
    const loop = origins === 0;
    nodes.push({
      id: fid,
      type: "family",
      position: { x: f.x - f.width / 2, y: f.y - f.height / 2 },
      width: f.width,
      height: f.height,
      data: {
        label: loop ? `citation loop · ${members.length} sources · 1 origin` : `${origins} ${origins === 1 ? "origin" : "origins"} · ${members.length} sources`,
        echo: members.length > Math.max(1, origins),
        w: f.width,
        h: f.height,
      } as unknown as Record<string, unknown>,
      selectable: false,
      draggable: false,
      zIndex: 0,
    });
  });

  // a column for the agent's notes, then the beliefs, each placed beside what it relates to
  // Stack items in a column near their anchors without overlap, then pull the column back up if it overflows.
  const place = (items: GraphNode[], _x: number, h: number, gap: number, anchor: (n: GraphNode) => number) => {
    const sorted = items.map((n) => ({ n, y: anchor(n) - h / 2 })).sort((a, b) => a.y - b.y);
    let cursor = -Infinity;
    sorted.forEach((it) => {
      it.y = Math.max(it.y, cursor + gap);
      cursor = it.y + h;
    });
    const overflow = cursor - Math.max(maxY, minY + sorted.length * (h + gap));
    if (overflow > 0 && sorted.length) {
      const room = sorted[0].y - minY;
      const up = Math.min(overflow, Math.max(0, room));
      sorted.forEach((it) => (it.y -= up));
    }
    return sorted;
  };
  const meanY = (ids: string[]) => {
    const ys = ids.map((id) => pos.get(id)?.y).filter((v): v is number => v != null);
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : (minY + maxY) / 2;
  };
  const noteX = maxRight + 64;
  const beliefX = noteX + (notes.length ? NOTE_W + 56 : 0);
  place(notes, noteX, NOTE_H, 14, (n) => meanY([...(ups.get(n.id) ?? []), ...claims.filter((e) => e.source === n.id).map((e) => e.target)])).forEach(({ n, y }) => {
    pos.set(n.id, { x: noteX + NOTE_W / 2, y: y + NOTE_H / 2 });
    nodes.push({ id: n.id, type: "source", position: { x: noteX, y }, width: NOTE_W, height: NOTE_H, data: { g: n, site: "", origin: false, copies: 0, chips: [] } as unknown as Record<string, unknown>, zIndex: 2 });
  });
  place(beliefs, beliefX, BEL_H, 16, (b) => meanY(claims.filter((e) => e.target === b.id).map((e) => e.source))).forEach(({ n, y }) => {
    nodes.push({ id: n.id, type: "belief", position: { x: beliefX, y }, width: BEL_W, height: BEL_H, data: { g: n } as unknown as Record<string, unknown>, zIndex: 3 });
    maxY = Math.max(maxY, y + BEL_H);
  });

  // edges keep their original direction in the id (it matches the agent's highlight keys)
  const edges: Edge[] = [
    ...lineage.map(
      (e) =>
        ({
          id: `${e.source}>${e.target}`,
          source: e.target,
          target: e.source,
          type: "default",
          data: { kind: "lineage", label: METHOD[e.method ?? ""] ?? e.method ?? "" },
          zIndex: 1,
        }) as Edge,
    ),
    ...claims.map(
      (e) =>
        ({
          id: `${e.source}>${e.target}`,
          source: e.source,
          target: e.target,
          type: "default",
          data: { kind: e.type === "CONTRADICTS" ? "contra" : "support", label: e.type === "CONTRADICTS" ? "contradicts" : "" },
          zIndex: 1,
        }) as Edge,
    ),
  ];

  const adj = new Map<string, Set<string>>();
  const edgeKeysOf = new Map<string, Set<string>>();
  const link = (a: string, b: string, k: string) => {
    adj.set(a, (adj.get(a) ?? new Set()).add(b));
    adj.set(b, (adj.get(b) ?? new Set()).add(a));
    edgeKeysOf.set(a, (edgeKeysOf.get(a) ?? new Set()).add(k));
    edgeKeysOf.set(b, (edgeKeysOf.get(b) ?? new Set()).add(k));
  };
  [...lineage, ...claims].forEach((e) => link(e.source, e.target, `${e.source}>${e.target}`));

  const ranks = [...new Set(sources.filter((s) => s.kind !== "stub" && s.kind !== "ident").map((s) => Math.round(g.node(s.id).x)))].sort((a, b) => a - b);
  const columns = [
    ...(ranks.length ? [{ x: ranks[0], label: "Origins" }] : []),
    ...(ranks.length > 1 ? [{ x: ranks[1], label: "Copies & citations" }] : []),
    ...(notes.length ? [{ x: noteX + NOTE_W / 2, label: "Agent notes" }] : []),
    ...(beliefs.length ? [{ x: beliefX + BEL_W / 2, label: "Beliefs" }] : []),
  ];
  return { nodes, edges, columns, top: Math.min(minY, ...nodes.map((n) => n.position.y)) - 56, adj, edgeKeysOf };
}

/* ------------------------------------------------------------------ view */

function Flow({
  nodes: graphNodes,
  edges: graphEdges,
  highlight,
  selected,
  onSelect,
  showOwners,
  showAgent,
  fitKey,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  highlight: Highlight | null;
  selected: string | null;
  onSelect: (n: GraphNode | null) => void;
  showOwners: boolean;
  showAgent: boolean;
  fitKey?: string;
}) {
  const rf = useReactFlow();
  const ready = true; // nodes are measured within a frame; the timers below give them that frame
  const [hover, setHover] = useState<string | null>(null);
  // SVG fill attributes can't resolve CSS variables, so the minimap gets concrete colours from the theme.
  const [pal, setPal] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = (k: string) => cs.getPropertyValue(k).trim();
      setPal({ accent: v("--accent"), line: v("--line-strong"), ok: v("--ok"), bad: v("--bad"), single: v("--single"), contested: v("--contested"), gone: v("--gone"), surface: v("--surface"), bg: v("--bg") });
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  const L = useMemo(() => layout(graphNodes, graphEdges, showOwners, showAgent), [graphNodes, graphEdges, showOwners, showAgent]);
  const byId = useMemo(() => new Map(graphNodes.map((n) => [n.id, n])), [graphNodes]);

  // What is in focus: the agent's highlight, else the hovered or selected node and its neighbours.
  const focus = useMemo(() => {
    const anchor = hover ?? (highlight?.nodes.size ? null : selected);
    if (highlight?.nodes.size && !hover) return { nodes: highlight.nodes, edges: highlight.edges };
    if (!anchor) return null;
    const nodes = new Set([anchor, ...(L.adj.get(anchor) ?? [])]);
    return { nodes, edges: L.edgeKeysOf.get(anchor) ?? new Set<string>() };
  }, [hover, highlight, selected, L]);

  const nodes = useMemo(
    () =>
      L.nodes.map((n) => {
        if (n.type === "family") return { ...n, data: { ...n.data, dim: !!focus } };
        const on = !focus || focus.nodes.has(n.id);
        return { ...n, data: { ...n.data, dim: !on, active: !!focus && on, selected: n.id === selected } };
      }),
    [L, focus, selected],
  );

  const edges = useMemo(
    () =>
      L.edges.map((e) => {
        const kind = (e.data as { kind: string }).kind;
        const label = (e.data as { label: string }).label;
        const hot = !!focus && focus.edges.has(e.id);
        const faded = !!focus && !hot;
        const color = kind === "lineage" ? "var(--accent)" : kind === "contra" ? "var(--bad)" : "var(--ok)";
        const base = kind === "lineage" ? 0.75 : kind === "contra" ? 0.45 : 0.22;
        return {
          ...e,
          animated: hot && kind === "lineage",
          label: hot && label ? label : undefined,
          labelStyle: { fill: color, fontSize: 10, fontFamily: "var(--font-geist-mono)" },
          labelBgStyle: { fill: "var(--bg)" },
          labelBgPadding: [4, 2] as [number, number],
          style: {
            stroke: color,
            strokeOpacity: faded ? 0.06 : hot ? 1 : base,
            strokeWidth: hot ? 2 : kind === "lineage" ? 1.5 : 1.1,
            strokeDasharray: kind === "contra" ? "5 4" : kind === "lineage" && label === "links to" ? "6 4" : undefined,
          },
          markerEnd: kind === "lineage" || hot ? { type: MarkerType.ArrowClosed, color, width: 14, height: 14 } : undefined,
        } as Edge;
      }),
    [L, focus],
  );

  // Fit the whole memory once per workspace (and when its shape changes a lot).
  const lastFit = useRef("");
  useEffect(() => {
    const sig = `${fitKey}|${L.nodes.length}`;
    if (!ready || sig === lastFit.current || highlight?.nodes.size) return;
    const t = window.setTimeout(() => {
      lastFit.current = sig; // only once it has actually happened (a re-render can cancel the timer)
      rf.fitView({ padding: FIT_PAD, duration: 500, maxZoom: 1.1 });
    }, 180);
    return () => window.clearTimeout(t);
  }, [fitKey, L, rf, highlight, ready]);

  // Re-frame when the canvas changes size (panels expanded or collapsed, window resized).
  const box = useRef<HTMLDivElement>(null);
  const focusRef = useRef(highlight);
  focusRef.current = highlight;
  useEffect(() => {
    const el = box.current?.parentElement;
    if (!el) return;
    let t = 0;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) return void (first = false);
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const h = focusRef.current;
        const ids = h?.nodes.size ? [...h.nodes].map((id) => ({ id })) : undefined;
        rf.fitView({ nodes: ids, padding: ids ? FOCUS_PAD : FIT_PAD, duration: 400, maxZoom: 1.15 });
      }, 120);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [rf]);

  // Move the camera to whatever the agent (or the user) is inspecting.
  useEffect(() => {
    if (!ready || !highlight?.nodes.size) return;
    const ids = [...highlight.nodes].filter((id) => L.nodes.some((n) => n.id === id)).map((id) => ({ id }));
    if (!ids.length) return;
    const t = window.setTimeout(() => rf.fitView({ nodes: ids, padding: FOCUS_PAD, duration: 700, maxZoom: 1.15 }), 60);
    return () => window.clearTimeout(t);
  }, [highlight, L, rf, ready]);

  return (
    <>
    <div ref={box} className="hidden" />
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: FIT_PAD, maxZoom: 1.1 }}
      nodesConnectable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      minZoom={0.15}
      maxZoom={2}
      onNodeMouseEnter={(_, n) => n.type !== "family" && setHover(n.id)}
      onNodeMouseLeave={() => setHover(null)}
      onNodeClick={(_, n) => {
        if (n.type === "family") return;
        const g = byId.get(n.id);
        if (g && !n.id.startsWith("url:") && !n.id.startsWith("id:")) onSelect(g);
      }}
      onPaneClick={() => onSelect(null)}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--line-strong)" />
      <ViewportPortal>
        {L.columns.map((c) => (
          <div
            key={c.label}
            className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint"
            style={{ transform: `translate(${c.x}px, ${L.top}px) translateX(-50%)` }}
          >
            {c.label}
          </div>
        ))}
      </ViewportPortal>
      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        className="!bottom-0 !right-12 !rounded-lg !border !border-line !bg-surface"
        maskColor={pal.bg ? `color-mix(in srgb, ${pal.bg} 72%, transparent)` : undefined}
        bgColor={pal.surface}
        nodeColor={(n) => {
          if (n.type === "family") return "transparent";
          if (n.type === "belief") {
            const st = (n.data as BeliefData).g.status;
            return st === "VERIFIED" ? pal.ok : st === "DISPUTED" ? pal.bad : st === "SINGLE_ORIGIN" ? pal.single : st === "CONTESTED" ? pal.contested : pal.gone;
          }
          return (n.data as SourceData).origin ? pal.accent : pal.line;
        }}
        nodeStrokeWidth={0}
        style={{ width: 150, height: 100 }}
      />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
    </>
  );
}

export function MapView(props: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  highlight: Highlight | null;
  selected: string | null;
  onSelect: (n: GraphNode | null) => void;
  showOwners: boolean;
  showAgent: boolean;
  fitKey?: string;
}) {
  return (
    <div className="absolute inset-0">
      <ReactFlowProvider>
        <Flow {...props} />
      </ReactFlowProvider>
    </div>
  );
}
