"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

/*
 * The hero story in one loop: five pages repeat a claim (plain memory counts five),
 * their lineage is traced back, and they collapse into the one post they came from.
 */

type Echo = { label: string; x: number; y: number; via: number | null };

const ECHOES: Echo[] = [
  { label: "techpicks-daily.com", x: 0.7, y: 0.3, via: null },
  { label: "devstack-review.io", x: 0.86, y: 0.52, via: null },
  { label: "bestgateways.io", x: 0.76, y: 0.76, via: null },
  { label: "r/healthIT", x: 0.95, y: 0.2, via: 0 },
  { label: "medium.com/@aria", x: 0.5, y: 0.9, via: null },
];
const ORIGIN = { x: 0.22, y: 0.56, label: "halcyon-insights.blog" };
const LOOP = 10.5;

function css(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));
const clamp = (t: number) => Math.max(0, Math.min(1, t));

export function CollapseViz() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const caption = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d")!;
    let raf = 0;
    let w = 0;
    let h = 0;
    const colors = { text: "", muted: "", faint: "", accent: "", line: "", bad: "", surface: "", mono: "monospace" };
    const readColors = () => {
      colors.text = css("--text");
      colors.muted = css("--muted");
      colors.faint = css("--faint");
      colors.accent = css("--accent");
      colors.line = css("--line-strong");
      colors.bad = css("--bad");
      colors.surface = css("--surface-2");
      colors.mono = css("--font-jetbrains") || "ui-monospace, monospace";
    };
    const resize = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readColors();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", readColors);

    const P = (p: { x: number; y: number }) => ({ x: p.x * w, y: p.y * h });
    const o = P(ORIGIN);
    let lastPhase = "";

    const setText = (count: string, cap: string, phase: string) => {
      if (phase === lastPhase) return;
      lastPhase = phase;
      if (counter.current) counter.current.textContent = count;
      if (caption.current) caption.current.textContent = cap;
    };

    const draw = (time: number) => {
      const t = reduce ? 8 : (time / 1000) % LOOP;
      ctx.clearRect(0, 0, w, h);
      const appear = (i: number) => ease((t - 0.3 - i * 0.35) / 0.5);
      const trace = (i: number) => ease((t - 2.6 - i * 0.25) / 0.9);
      const collapse = ease((t - 5.4) / 1.6);
      const fadeOut = 1 - ease((t - 9.6) / 0.8);

      const pos = ECHOES.map((e) => {
        const p = P(e);
        return { x: p.x + (o.x - p.x) * collapse, y: p.y + (o.y - p.y) * collapse };
      });

      // lineage edges, drawn from each echo back toward its upstream
      ECHOES.forEach((e, i) => {
        const tr = trace(i);
        if (tr <= 0) return;
        const a = pos[i];
        const b = e.via !== null ? pos[e.via] : o;
        const x = a.x + (b.x - a.x) * tr;
        const y = a.y + (b.y - a.y) * tr;
        ctx.strokeStyle = colors.accent;
        ctx.globalAlpha = 0.75 * fadeOut * (1 - collapse * 0.6);
        ctx.lineWidth = 1.4;
        ctx.setLineDash(e.via !== null ? [4, 4] : []);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
        // a pulse travelling upstream
        if (tr < 1 || collapse < 0.05) {
          const k = ((time / 1000) * 0.6 + i * 0.2) % 1;
          const px = a.x + (b.x - a.x) * k * tr;
          const py = a.y + (b.y - a.y) * k * tr;
          ctx.fillStyle = colors.accent;
          ctx.globalAlpha = 0.9 * fadeOut;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;

      // origin: grows a halo as echoes collapse into it
      const oa = ease((t - 2.4) / 0.6) * fadeOut;
      if (oa > 0) {
        const halo = 18 + 26 * collapse;
        const g = ctx.createRadialGradient(o.x, o.y, 4, o.x, o.y, halo * 2.2);
        g.addColorStop(0, colors.accent);
        g.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.28 * oa * (0.4 + collapse);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, halo * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = oa;
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 9 + 5 * collapse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1;
        for (let r = 1; r <= 3; r++) {
          ctx.globalAlpha = oa * 0.35 * (1 - r / 4) * (0.5 + collapse);
          ctx.beginPath();
          ctx.arc(o.x, o.y, (14 + 5 * collapse) * r * 1.35, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = oa;
        ctx.fillStyle = colors.text;
        ctx.font = `500 12px ${colors.mono}`;
        ctx.textAlign = "center";
        ctx.fillText(ORIGIN.label, o.x, o.y + 40 + 10 * collapse);
        ctx.fillStyle = colors.faint;
        ctx.font = `11px ${colors.mono}`;
        ctx.fillText("planted post · ref=hx-partner-77", o.x, o.y + 56 + 10 * collapse);
      }

      // echo nodes
      ECHOES.forEach((e, i) => {
        const a = appear(i) * fadeOut * (1 - collapse);
        if (a <= 0.01) return;
        const p = pos[i];
        ctx.globalAlpha = a;
        ctx.fillStyle = colors.surface;
        ctx.strokeStyle = trace(i) > 0 ? colors.accent : colors.muted;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = colors.muted;
        ctx.font = `12px ${colors.mono}`;
        ctx.textAlign = p.x > w * 0.7 ? "right" : "center";
        ctx.fillText(e.label, p.x + (p.x > w * 0.7 ? -14 : 0), p.y + (p.x > w * 0.7 ? 4 : -16));
      });
      ctx.globalAlpha = 1;

      const shown = ECHOES.filter((_, i) => appear(i) > 0.5).length;
      if (t < 2.6) setText(`${shown}`, shown === 1 ? "source says it is safest" : "sources say it is safest", `a${shown}`);
      else if (t < 5.4) setText("5", "sources, tracing where they came from", "trace");
      else setText("1", "independent origin", "one");

      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mq.removeEventListener("change", readColors);
    };
  }, [reduce]);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
      <div className="absolute left-0 top-0 flex items-baseline gap-3" aria-live="polite">
        <span ref={counter} className="font-display text-6xl font-semibold tabular-nums text-text">
          5
        </span>
        <span ref={caption} className="font-mono text-sm text-muted">
          sources say it is safest
        </span>
      </div>
    </div>
  );
}
