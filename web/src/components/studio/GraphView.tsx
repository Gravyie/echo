"use client";

import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import { forceCollide } from "d3-force";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode, Status } from "@/lib/api";

/*
 * The memory as an Obsidian-style graph: small circles on an organic layout, hairline links, labels that
 * fade in with zoom, and a hover that lights up a node's neighbourhood while everything else recedes.
 * Colour carries the meaning: origins glow ember, beliefs take their verdict colour, the rest stays quiet.
 */

export interface Highlight {
  nodes: Set<string>;
  edges: Set<string>; // "a>b", in the stored edge direction
  focus?: string;
}

type N = NodeObject &
  GraphNode & { deg: number; origin: boolean; r: number; isNote: boolean; stub: boolean };
type L = LinkObject & GraphEdge & { key: string; lineage: boolean };

const LINEAGE = new Set(["CITES", "COPIED_FROM", "DERIVED_FROM"]);
const STATUS_VAR: Record<Status, string> = {
  VERIFIED: "--ok",
  SINGLE_ORIGIN: "--single",
  CONTESTED: "--contested",
  DISPUTED: "--bad",
  UNSUPPORTED: "--gone",
  RETRACTED: "--gone",
};

type Pal = Record<"bg" | "surface" | "text" | "muted" | "faint" | "line" | "accent" | "agent" | "gone" | "bad", string> & {
  status: Record<Status, string>;
  sans: string;
  mono: string;
  dark: boolean;
};

function readPalette(): Pal {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    bg: v("--bg"),
    surface: v("--surface"),
    text: v("--text"),
    muted: v("--muted"),
    faint: v("--faint"),
    line: v("--line-strong"),
    accent: v("--accent"),
    agent: v("--agent"),
    gone: v("--gone"),
    bad: v("--bad"),
    status: Object.fromEntries(Object.entries(STATUS_VAR).map(([k, n]) => [k, v(n)])) as Record<Status, string>,
    sans: v("--font-geist") || "sans-serif",
    mono: v("--font-geist-mono") || "monospace",
    dark: document.documentElement.dataset.theme === "dark",
  };
}

/** Any CSS colour (hex or rgb[a]) with a new alpha. */
function alpha(color: string, a: number) {
  if (color.startsWith("#")) {
    const h = color.length === 4 ? color.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : color;
    const n = parseInt(h.slice(1, 7), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(/[\s,/]+/).filter(Boolean);
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}

type Lbl = { x: number; y: number; lines: { t: string; font: string; color: string }[]; fs: number; a: number; prio: number };

const short = (s: string, n = 34) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const label = (n: N) =>
  n.label === "Belief" ? n.name : n.label === "Owner" ? n.name : n.url ? n.url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : n.name.replace(/^(url|id):/, "");

export function GraphView({
  nodes,
  edges,
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
  const fg = useRef<ForceGraphMethods<N, L>>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [pal, setPal] = useState<Pal | null>(null);
  const [hover, setHover] = useState<N | null>(null);
  const fitted = useRef("");
  const labels = useRef<Lbl[]>([]);
  // Smoothly animated focus amount (0 = everything at full strength, 1 = focus mode), Obsidian-style.
  const fade = useRef({ v: 0, target: 0 });

  useEffect(() => {
    setPal(readPalette());
    const obs = new MutationObserver(() => setPal(readPalette()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------------------------------------------------------------- data */

  const positions = useRef(new Map<string, { x: number; y: number }>());
  const data = useMemo(() => {
    const keep = (n: GraphNode) =>
      n.label === "Belief" ||
      (n.label === "Source" && (showAgent || n.kind !== "agent")) ||
      (n.label === "Owner" && (n.kind === "network" || showOwners));
    const ns = nodes.filter(keep);
    const ids = new Set(ns.map((n) => n.id));
    const ls = edges.filter(
      (e) => ids.has(e.source) && ids.has(e.target) && (LINEAGE.has(e.type) || e.type === "SUPPORTS" || e.type === "CONTRADICTS" || e.type === "PUBLISHED_BY"),
    );
    const deg = new Map<string, number>();
    const hasUp = new Set<string>();
    const hasDown = new Set<string>();
    ls.forEach((e) => {
      deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
      deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
      if (LINEAGE.has(e.type)) {
        hasUp.add(e.source);
        hasDown.add(e.target);
      }
    });
    // Owners with a single source say nothing; keep only fingerprints that tie sources together.
    const keepIds = new Set(ns.filter((n) => n.label !== "Owner" || (deg.get(n.id) ?? 0) > 1).map((n) => n.id));
    const out: N[] = ns
      .filter((n) => keepIds.has(n.id))
      .map((n) => {
        const d = deg.get(n.id) ?? 0;
        const isNote = n.label === "Source" && n.kind === "agent";
        const stub = n.kind === "stub" || n.kind === "ident";
        const origin = n.label === "Source" && !isNote && !hasUp.has(n.id) && hasDown.has(n.id);
        const r = n.label === "Belief" ? 4.5 + Math.sqrt(n.sources ?? 1) * 1.7 : n.label === "Owner" ? 2.2 : stub ? 2.6 : 2.8 + Math.sqrt(d) * 0.9 + (origin ? 1.6 : 0);
        const p = positions.current.get(n.id);
        return { ...n, deg: d, origin, r, isNote, stub, ...(p ? { x: p.x, y: p.y } : {}) } as N;
      });
    return {
      nodes: out,
      links: ls
        .filter((e) => keepIds.has(e.source) && keepIds.has(e.target))
        .map((e) => ({ ...e, key: `${e.source}>${e.target}`, lineage: LINEAGE.has(e.type) }) as L),
    };
  }, [nodes, edges, showOwners, showAgent]);

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    data.links.forEach((l) => {
      const s = typeof l.source === "object" ? (l.source as N).id : (l.source as string);
      const t = typeof l.target === "object" ? (l.target as N).id : (l.target as string);
      m.set(s, (m.get(s) ?? new Set()).add(t));
      m.set(t, (m.get(t) ?? new Set()).add(s));
    });
    return m;
  }, [data]);

  /* ---------------------------------------------------------------- forces */

  useEffect(() => {
    const f = fg.current;
    if (!f) return;
    const link = f.d3Force("link") as unknown as { distance: (fn: (l: L) => number) => { strength: (fn: (l: L) => number) => void } } | undefined;
    link?.distance((l) => (l.lineage ? 44 : l.type === "PUBLISHED_BY" ? 26 : 70)).strength((l) => (l.lineage ? 0.7 : l.type === "PUBLISHED_BY" ? 0.4 : 0.18));
    const charge = f.d3Force("charge") as unknown as { strength: (n: number) => void; distanceMax: (n: number) => void } | undefined;
    charge?.strength(-110);
    charge?.distanceMax(320);
    f.d3Force("collide", forceCollide<N>((n) => n.r + (n.label === "Belief" ? 14 : 8)).strength(0.9) as never);
    f.d3ReheatSimulation();
  }, [data, pal]);

  /* ---------------------------------------------------------------- focus */

  // What is lit: the hovered node and its neighbours, else the agent's/user's highlight, else everything.
  const focus = useMemo(() => {
    if (hover) {
      const ns = new Set([hover.id, ...(neighbours.get(hover.id) ?? [])]);
      return { nodes: ns, edges: null as Set<string> | null, anchor: hover.id };
    }
    if (highlight?.nodes.size) return { nodes: new Set([...highlight.nodes, ...(selected ? [selected] : [])]), edges: highlight.edges, anchor: highlight.focus ?? null };
    if (selected) return { nodes: new Set([selected, ...(neighbours.get(selected) ?? [])]), edges: null, anchor: selected };
    return null;
  }, [hover, highlight, selected, neighbours]);
  fade.current.target = focus ? 1 : 0;

  const lit = (id: string) => !focus || focus.nodes.has(id);
  const edgeLit = (l: L, s: string, t: string) => {
    if (!focus) return true;
    if (focus.edges && focus.edges.has(l.key)) return true;
    return focus.nodes.has(s) && focus.nodes.has(t) && (!focus.anchor || s === focus.anchor || t === focus.anchor || !!focus.edges);
  };

  /* ---------------------------------------------------------------- drawing */

  const drawNode = useCallback(
    (node: N, ctx: CanvasRenderingContext2D, scale: number) => {
      if (!pal || node.x == null || node.y == null) return;
      positions.current.set(node.id, { x: node.x, y: node.y });
      const f = fade.current.v;
      const on = lit(node.id);
      const a = on ? 1 : 1 - 0.85 * f;
      const x = node.x;
      const y = node.y;
      const isSel = node.id === selected || node.id === focus?.anchor;
      const color =
        node.label === "Belief"
          ? node.status
            ? pal.status[node.status]
            : pal.faint
          : node.retracted
            ? pal.gone
            : node.isNote
              ? pal.agent
              : node.origin
                ? pal.accent
                : node.label === "Owner"
                  ? pal.bad
                  : pal.muted;

      ctx.save();
      ctx.globalAlpha = a;
      // soft glow: origins, beliefs with echoes, and whatever is in focus
      if ((node.origin && !node.retracted) || (on && focus && f > 0.05) || isSel) {
        const gr = node.r * (isSel ? 4.2 : 3.2);
        const g = ctx.createRadialGradient(x, y, node.r * 0.6, x, y, gr);
        g.addColorStop(0, alpha(color, pal.dark ? 0.38 : 0.24));
        g.addColorStop(1, alpha(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, gr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, node.r, 0, Math.PI * 2);
      if (node.stub || node.retracted) {
        ctx.fillStyle = pal.bg;
        ctx.fill();
        ctx.lineWidth = 1.2 / Math.max(scale, 0.8);
        ctx.strokeStyle = color;
        ctx.stroke();
      } else {
        ctx.fillStyle = node.label === "Source" && !node.origin && !node.isNote ? (pal.dark ? "#8f8e88" : "#a3a29b") : color;
        ctx.fill();
      }
      if (node.label === "Belief") {
        // an echo: more sources than origins. A thin outer ring says "this was repeated".
        if (node.echo) {
          ctx.beginPath();
          ctx.arc(x, y, node.r + 2.6, 0, Math.PI * 2);
          ctx.lineWidth = 1 / Math.max(scale, 0.8);
          ctx.strokeStyle = alpha(color, 0.7);
          ctx.setLineDash([2, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      if (isSel) {
        ctx.beginPath();
        ctx.arc(x, y, node.r + 4, 0, Math.PI * 2);
        ctx.lineWidth = 1.4 / Math.max(scale, 0.8);
        ctx.strokeStyle = color;
        ctx.stroke();
      }

      // Labels fade in with zoom (Obsidian's behaviour); beliefs and origins earlier, focused nodes always.
      const threshold = node.label === "Belief" ? 0.55 : node.origin ? 0.9 : node.label === "Owner" ? 2.2 : 1.6;
      const zoomA = Math.max(0, Math.min(1, (scale - threshold) / 0.35));
      const forced = (focus && on && f > 0.3) || isSel;
      const la = forced ? Math.max(zoomA, f) : zoomA * (on ? 1 : 0.15);
      if (la > 0.02) {
        const fs = (node.label === "Belief" ? 11.5 : 10.5) / Math.max(scale, 0.75);
        const lines = [
          {
            t: short(label(node), node.label === "Belief" ? 40 : 30),
            font: `${node.label === "Belief" ? 500 : 400} ${fs}px ${node.label === "Belief" ? pal.sans : pal.mono}`,
            color: node.label === "Belief" ? pal.text : node.origin ? pal.accent : pal.muted,
          },
        ];
        if (node.label === "Belief" && node.echo && (scale > 1.1 || forced))
          lines.push({ t: `${node.sources} sources → ${node.origins} origin${node.origins === 1 ? "" : "s"}`, font: `500 ${fs * 0.86}px ${pal.mono}`, color });
        labels.current.push({
          x,
          y: y + node.r + 3.5 / Math.max(scale, 0.75),
          lines,
          fs,
          a: a * la,
          prio: (isSel ? 100 : 0) + (forced ? 50 : 0) + (node.label === "Belief" ? 20 : node.origin ? 15 : 0) + node.deg,
        });
      }
      ctx.restore();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pal, focus, selected],
  );

  const linkColor = useCallback(
    (l: L) => {
      if (!pal) return "transparent";
      const s = typeof l.source === "object" ? (l.source as N).id : (l.source as string);
      const t = typeof l.target === "object" ? (l.target as N).id : (l.target as string);
      const f = fade.current.v;
      const on = edgeLit(l, s, t);
      const base = l.lineage ? (pal.dark ? 0.55 : 0.6) : l.type === "CONTRADICTS" ? 0.4 : l.type === "PUBLISHED_BY" ? 0.35 : pal.dark ? 0.2 : 0.22;
      const a = on ? (focus ? Math.min(1, base + 0.35 * f) : base) : base * (1 - 0.88 * f);
      const c = l.lineage ? pal.accent : l.type === "CONTRADICTS" ? pal.bad : l.type === "PUBLISHED_BY" ? pal.bad : pal.line;
      return alpha(c, a);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pal, focus],
  );

  /* ---------------------------------------------------------------- camera */

  // Fit the whole graph once per workspace, once the layout has settled a little.
  useEffect(() => {
    if (!fitKey || fitted.current === fitKey) return;
    const t = window.setTimeout(() => {
      fitted.current = fitKey;
      fg.current?.zoomToFit(600, size.w < 600 ? 30 : 60);
    }, 450);
    return () => window.clearTimeout(t);
  }, [fitKey, data, size.w]);

  // Glide to whatever the agent (or the user) is inspecting.
  useEffect(() => {
    const f = fg.current;
    if (!f || !highlight?.nodes.size) return;
    const t = window.setTimeout(() => f.zoomToFit(700, size.w < 600 ? 40 : 90, (n: N) => highlight.nodes.has(n.id)), 120);
    return () => window.clearTimeout(t);
  }, [highlight, size.w]);

  // Re-frame when the canvas size changes (panels, window).
  useEffect(() => {
    if (!fitted.current) return;
    const t = window.setTimeout(() => {
      const h = highlight;
      fg.current?.zoomToFit(400, 60, h?.nodes.size ? (n: N) => h.nodes.has(n.id) : undefined);
    }, 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  return (
    <div ref={wrap} className="absolute inset-0" style={{ cursor: hover ? "pointer" : "grab" }}>
      {pal && (
        <ForceGraph2D<N, L>
          ref={fg}
          width={size.w}
          height={size.h}
          graphData={data}
          nodeId="id"
          backgroundColor="rgba(0,0,0,0)"
          autoPauseRedraw={false}
          onRenderFramePost={(ctx, scale) => {
            // Labels last, on top, highest priority first; a label that would overlap one already drawn is skipped.
            if (!pal) return;
            const placed: number[][] = [];
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.lineJoin = "round";
            for (const lb of labels.current.sort((p, q) => q.prio - p.prio)) {
              let w = 0;
              lb.lines.forEach((l) => {
                ctx.font = l.font;
                w = Math.max(w, ctx.measureText(l.t).width);
              });
              const h = lb.lines.length * lb.fs * 1.25;
              const box = [lb.x - w / 2 - 2 / scale, lb.y, lb.x + w / 2 + 2 / scale, lb.y + h];
              if (lb.prio < 100 && placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) continue;
              placed.push(box);
              lb.lines.forEach((l, i) => {
                ctx.font = l.font;
                ctx.globalAlpha = lb.a;
                ctx.lineWidth = 3 / scale;
                ctx.strokeStyle = alpha(pal.bg, 0.9);
                ctx.strokeText(l.t, lb.x, lb.y + i * lb.fs * 1.25);
                ctx.fillStyle = l.color;
                ctx.fillText(l.t, lb.x, lb.y + i * lb.fs * 1.25);
              });
            }
            ctx.restore();
          }}
          onRenderFramePre={() => {
            labels.current = [];
            // ease the focus fade every frame (~160 ms)
            const fd = fade.current;
            fd.v += (fd.target - fd.v) * 0.18;
            if (Math.abs(fd.target - fd.v) < 0.002) fd.v = fd.target;
          }}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node, color, ctx) => {
            if (node.x == null || node.y == null) return;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r + 4, 0, Math.PI * 2);
            ctx.fill();
          }}
          nodeLabel={() => ""}
          linkColor={linkColor}
          linkWidth={(l) => {
            const s = typeof l.source === "object" ? (l.source as N).id : (l.source as string);
            const t = typeof l.target === "object" ? (l.target as N).id : (l.target as string);
            const hot = !!focus && edgeLit(l, s, t);
            return (l.lineage ? 1.1 : 0.7) + (hot ? 0.8 * fade.current.v : 0);
          }}
          linkLineDash={(l) => (l.type === "CONTRADICTS" || l.type === "PUBLISHED_BY" ? [3, 3] : l.type === "CITES" ? [4, 2] : null)}
          linkDirectionalArrowLength={(l) => (l.lineage ? 3 : 0)}
          linkDirectionalArrowRelPos={0.94}
          linkDirectionalParticles={(l) => (highlight?.edges.has(l.key) ? 2 : 0)}
          linkDirectionalParticleWidth={2.2}
          linkDirectionalParticleSpeed={0.008}
          linkDirectionalParticleColor={() => pal.accent}
          onNodeHover={(n) => setHover(n ?? null)}
          onNodeClick={(n) => onSelect(n)}
          onBackgroundClick={() => onSelect(null)}
          onNodeDragEnd={(n) => {
            n.fx = undefined;
            n.fy = undefined;
          }}
          warmupTicks={60}
          cooldownTicks={240}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.35}
          minZoom={0.3}
          maxZoom={6}
          enableNodeDrag
        />
      )}
    </div>
  );
}
