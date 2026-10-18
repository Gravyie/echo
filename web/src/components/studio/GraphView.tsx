"use client";

import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import { forceCollide } from "d3-force";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode, Status } from "@/lib/api";

export interface Highlight {
  nodes: Set<string>;
  edges: Set<string>; // "a>b"
  focus?: string;
}

type N = NodeObject & GraphNode & { isRoot?: boolean; dependents?: number };
type L = LinkObject & GraphEdge & { key: string };

/** A label queued during the node pass and drawn last, on top, with overlap culling. */
interface Label {
  x: number;
  y: number;
  lines: { text: string; font: string; color: string }[];
  prio: number;
  size: number;
}

const LINEAGE = new Set(["CITES", "COPIED_FROM", "DERIVED_FROM"]);
const STATUS_VAR: Record<Status, string> = {
  VERIFIED: "--ok",
  SINGLE_ORIGIN: "--single",
  CONTESTED: "--contested",
  DISPUTED: "--bad",
  UNSUPPORTED: "--gone",
  RETRACTED: "--gone",
};

function readPalette() {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    bg: v("--bg"),
    surface: v("--surface-2"),
    text: v("--text"),
    muted: v("--muted"),
    faint: v("--faint"),
    line: v("--line-strong"),
    accent: v("--accent"),
    ok: v("--ok"),
    bad: v("--bad"),
    single: v("--single"),
    owner: v("--owner"),
    agent: v("--agent"),
    gone: v("--gone"),
    mono: v("--font-geist-mono") || "monospace",
    dark: document.documentElement.dataset.theme === "dark",
    sans: v("--font-geist") || "sans-serif",
    status: Object.fromEntries(Object.entries(STATUS_VAR).map(([k, n]) => [k, v(n)])) as Record<Status, string>,
  };
}

function alpha(color: string, a: number) {
  if (color.startsWith("#") && color.length === 7) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return color;
}

function short(s: string, n = 28) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

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
  const [pal, setPal] = useState<ReturnType<typeof readPalette> | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const labels = useRef<Label[]>([]);
  const fitted = useRef(false);
  useEffect(() => {
    fitted.current = false; // fit the whole graph once per workspace
  }, [fitKey]);

  useEffect(() => {
    setPal(readPalette());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setPal(readPalette());
    mq.addEventListener("change", on);
    const obs = new MutationObserver(on);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", on);
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const keep = (n: GraphNode) =>
      (showOwners || n.label !== "Owner" || n.kind === "network") && (showAgent || (n.label !== "Agent" && n.label !== "Episode" && n.kind !== "agent"));
    const ns = nodes.filter(keep);
    const ids = new Set(ns.map((n) => n.id));
    const ls = edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.type !== "RAN");
    const hasUp = new Set(ls.filter((e) => LINEAGE.has(e.type)).map((e) => e.source));
    const downCount = new Map<string, number>();
    ls.filter((e) => LINEAGE.has(e.type)).forEach((e) => downCount.set(e.target, (downCount.get(e.target) ?? 0) + 1));
    const out: N[] = ns.map((n) => {
      const p = positions.current.get(n.id);
      return {
        ...n,
        isRoot: n.label === "Source" && n.kind !== "agent" && !hasUp.has(n.id) && (downCount.get(n.id) ?? 0) > 0,
        dependents: downCount.get(n.id) ?? 0,
        ...(p ? { x: p.x, y: p.y } : {}),
      } as N;
    });
    return {
      nodes: out,
      links: ls.map((e) => ({ ...e, key: `${e.source}>${e.target}` }) as L),
    };
  }, [nodes, edges, showOwners, showAgent]);

  useEffect(() => {
    const f = fg.current;
    if (!f) return;
    const link = f.d3Force("link") as unknown as { distance: (fn: (l: L) => number) => { strength: (fn: (l: L) => number) => void } } | undefined;
    link
      ?.distance((l) => (LINEAGE.has(l.type) ? 62 : l.type === "PUBLISHED_BY" ? 26 : l.type === "ABOUT" ? 80 : 110))
      .strength((l) => (LINEAGE.has(l.type) ? 0.9 : l.type === "PUBLISHED_BY" ? 0.7 : 0.25));
    const charge = f.d3Force("charge") as unknown as { strength: (fn: (n: N) => number) => void } | undefined;
    charge?.strength((n: N) => (n.label === "Belief" ? -340 : n.label === "Entity" ? -180 : -200));
    f.d3Force(
      "collide",
      forceCollide<N>((n) => (n.label === "Belief" ? 34 : n.label === "Entity" ? 30 : n.label === "Owner" ? 8 : 14)).strength(0.9) as never,
    );

    f.d3ReheatSimulation();
  }, [data]);

  const lit = useCallback(
    (id: string) => !highlight || highlight.nodes.size === 0 || highlight.nodes.has(id) || id === selected,
    [highlight, selected],
  );

  const drawNode = useCallback(
    (node: N, ctx: CanvasRenderingContext2D, scale: number) => {
      if (!pal || node.x == null || node.y == null) return;
      positions.current.set(node.id, { x: node.x, y: node.y });
      const on = lit(node.id);
      const dim = on ? 1 : 0.22;
      const isSel = node.id === selected || node.id === highlight?.focus;
      const x = node.x;
      const y = node.y;
      ctx.save();
      ctx.globalAlpha = dim;

      if (node.label === "Belief") {
        const c = node.status ? pal.status[node.status] : pal.faint;
        const r = 7 + Math.min(6, (node.sources ?? 1) * 0.8);
        ctx.fillStyle = alpha(c, 0.18);
        ctx.strokeStyle = c;
        ctx.lineWidth = isSel ? 2.4 : 1.6;
        ctx.beginPath();
        ctx.roundRect(x - r, y - r, r * 2, r * 2, 4);
        ctx.fill();
        ctx.stroke();
        if (on) {
          const fs = 11 / Math.max(scale, 0.9);
          const lines = [{ text: short(node.name, 30), font: `500 ${fs}px ${pal.sans}`, color: pal.text }];
          if (node.echo)
            lines.push({
              text: `${node.sources} sources → ${node.origins} origin${node.origins === 1 ? "" : "s"}`,
              font: `600 ${fs * 0.88}px ${pal.mono}`,
              color: c,
            });
          labels.current.push({ x, y: y + r + 4, lines, size: fs, prio: isSel ? 100 : highlight?.nodes.has(node.id) ? 60 : node.echo ? 40 : 30 });
        }
      } else if (node.label === "Source") {
        const kind = node.kind ?? "web";
        const r = kind === "stub" || kind === "ident" ? 4 : 5.5;
        if (node.isRoot && !node.retracted) {
          const g = ctx.createRadialGradient(x, y, r, x, y, r * 4.2);
          g.addColorStop(0, alpha(pal.accent, pal.dark ? 0.45 : 0.22));
          g.addColorStop(1, alpha(pal.accent, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r * 4.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = node.isRoot ? pal.accent : pal.surface;
        ctx.strokeStyle = node.retracted
          ? pal.gone
          : kind === "agent"
            ? pal.agent
            : kind === "doc"
              ? pal.single
              : node.isRoot
                ? pal.accent
                : pal.muted;
        ctx.lineWidth = isSel ? 2.6 : 1.4;
        if (kind === "stub" || kind === "ident") ctx.setLineDash([2, 2]);
        ctx.beginPath();
        if (kind === "agent") ctx.rect(x - r, y - r, r * 2, r * 2);
        else ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        if (node.retracted) {
          ctx.strokeStyle = pal.bad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x - r - 2, y - r - 2);
          ctx.lineTo(x + r + 2, y + r + 2);
          ctx.stroke();
        }
        if (scale > 1.8 || isSel || node.id === hover || (highlight?.nodes.has(node.id) && highlight.nodes.size < 14) || node.isRoot) {
          const fs = 10.5 / Math.max(scale, 0.9);
          const label = node.url ? node.url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : node.name;
          labels.current.push({
            x,
            y: y + r + 3,
            size: fs,
            prio: isSel || node.id === hover ? 90 : node.isRoot ? 50 : 20,
            lines: [{ text: short(label, 28), font: `${fs}px ${pal.mono}`, color: node.isRoot ? pal.accent : pal.muted }],
          });
        }
      } else if (node.label === "Owner") {
        const r = 2.6;
        ctx.fillStyle = node.kind === "network" ? pal.bad : pal.owner;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.fill();
        if (node.kind === "network" && (scale > 1.1 || node.id === hover || highlight?.nodes.has(node.id))) {
          const fs = 9 / Math.max(scale, 0.9);
          labels.current.push({ x, y: y + 4, size: fs, prio: node.id === hover ? 90 : 10, lines: [{ text: short(node.name, 24), font: `${fs}px ${pal.mono}`, color: pal.bad }] });
        }
      } else if (node.label === "Entity") {
        ctx.fillStyle = alpha(pal.faint, 0.75);
        ctx.font = `600 ${9 / Math.max(scale, 0.9)}px ${pal.mono}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.letterSpacing = "1px";
        ctx.fillText(node.name.toUpperCase(), x, y);
      } else {
        ctx.fillStyle = pal.agent;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    [pal, lit, selected, highlight, hover],
  );

  const linkColor = useCallback(
    (l: L) => {
      if (!pal) return "transparent";
      const s = typeof l.source === "object" ? (l.source as N).id : (l.source as string);
      const t = typeof l.target === "object" ? (l.target as N).id : (l.target as string);
      const hot = highlight?.edges.has(`${s}>${t}`);
      const on = lit(s) && lit(t);
      const a = hot ? 1 : on ? 0.55 : 0.07;
      if (LINEAGE.has(l.type)) return alpha(l.type === "DERIVED_FROM" ? pal.agent : pal.accent, a);
      if (l.type === "SUPPORTS") return alpha(pal.ok, a * 0.6);
      if (l.type === "CONTRADICTS") return alpha(pal.bad, a * 0.8);
      return alpha(pal.faint, a * 0.5);
    },
    [pal, highlight, lit],
  );

  const drawLabels = useCallback(
    (ctx: CanvasRenderingContext2D, scale: number) => {
      if (!pal) return;
      const placed: [number, number, number, number][] = [];
      const pad = 3 / scale;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const lb of labels.current.sort((a, b) => b.prio - a.prio)) {
        const widths = lb.lines.map((l) => {
          ctx.font = l.font;
          return ctx.measureText(l.text).width;
        });
        const w = Math.max(...widths) + pad * 2;
        const h = lb.lines.length * lb.size * 1.25 + pad;
        const box: [number, number, number, number] = [lb.x - w / 2, lb.y - pad / 2, lb.x + w / 2, lb.y + h];
        if (lb.prio < 90 && placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) continue;
        placed.push(box);
        ctx.fillStyle = alpha(pal.bg, 0.82);
        ctx.beginPath();
        ctx.roundRect(box[0], box[1], w, h, 3 / scale);
        ctx.fill();
        lb.lines.forEach((l, i) => {
          ctx.font = l.font;
          ctx.fillStyle = l.color;
          ctx.fillText(l.text, lb.x, lb.y + i * lb.size * 1.25);
        });
      }
      ctx.restore();
      labels.current = [];
    },
    [pal],
  );

  const keyOf = (l: L) => {
    const s = typeof l.source === "object" ? (l.source as N).id : (l.source as string);
    const t = typeof l.target === "object" ? (l.target as N).id : (l.target as string);
    return `${s}>${t}`;
  };

  // Frame whatever the agent (or the user) is looking at.
  useEffect(() => {
    const f = fg.current;
    if (!f || !highlight || highlight.nodes.size === 0) return;
    const t = window.setTimeout(() => f.zoomToFit(700, 130, (n: N) => highlight.nodes.has(n.id)), 80);
    return () => window.clearTimeout(t);
  }, [highlight, size.w, size.h]);

  return (
    <div ref={wrap} className="absolute inset-0">
      {pal && (
        <ForceGraph2D<N, L>
          ref={fg}
          width={size.w}
          height={size.h}
          graphData={data}
          nodeId="id"
          backgroundColor="rgba(0,0,0,0)"
          nodeCanvasObject={drawNode}
          onRenderFramePre={() => {
            labels.current = [];
          }}
          onRenderFramePost={drawLabels}
          nodePointerAreaPaint={(node, color, ctx) => {
            if (node.x == null || node.y == null) return;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.label === "Belief" ? 13 : 8, 0, Math.PI * 2);
            ctx.fill();
          }}
          nodeLabel={() => ""}
          linkColor={linkColor}
          linkWidth={(l) => (highlight?.edges.has(keyOf(l)) ? 2.4 : LINEAGE.has(l.type) ? 1.4 : 0.7)}
          linkLineDash={(l) => (l.type === "CITES" ? [4, 3] : l.type === "DERIVED_FROM" ? [1, 3] : null)}
          linkDirectionalArrowLength={(l) => (LINEAGE.has(l.type) ? 4 : 0)}
          linkDirectionalArrowRelPos={0.92}
          linkDirectionalParticles={(l) => (highlight?.edges.has(keyOf(l)) ? 3 : 0)}
          linkDirectionalParticleWidth={2.6}
          linkDirectionalParticleSpeed={0.012}
          linkDirectionalParticleColor={() => pal.accent}
          onNodeClick={(n) => onSelect(n)}
          onBackgroundClick={() => onSelect(null)}
          onNodeHover={(n) => setHover(n?.id ?? null)}
          cooldownTicks={180}
          d3VelocityDecay={0.32}
          onEngineStop={() => {
            if (!fitted.current && !highlight) {
              fitted.current = true;
              fg.current?.zoomToFit(600, 110);
            } else if (highlight && highlight.nodes.size > 0) {
              // new nodes (the agent's notes) reheat the layout: re-frame what is in focus once it settles
              fg.current?.zoomToFit(500, 130, (n: N) => highlight.nodes.has(n.id));
            }
          }}
          enableNodeDrag
          maxZoom={3.2}
          minZoom={0.3}
        />
      )}
    </div>
  );
}
