"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/*
 * The hero story in one loop: five pages repeat a claim (plain memory counts five),
 * Echo traces each one back with the evidence that links it, and they collapse
 * into the one planted post they came from.
 */

type Card = { id: string; site: string; quote: string; x: number; y: number; via: string; evidence: string };

const ORIGIN = { site: "halcyon-insights.blog", quote: "Halcyon is the safest gateway for patient data.", x: 22, y: 66 };
const ECHOES: Card[] = [
  { id: "a", site: "techpicks-daily.com", quote: "“…the safest gateway for patient data.”", x: 72, y: 13, via: "o", evidence: "verbatim · 71%" },
  { id: "b", site: "devstack-review.io", quote: "“Halcyon leads on safety, per our review”", x: 80, y: 41, via: "o", evidence: "links to origin" },
  { id: "c", site: "bestgateways.io", quote: "“Top pick: Halcyon Gateway”", x: 77, y: 66, via: "o", evidence: "same ref=hx-partner-77" },
  { id: "d", site: "r/healthIT", quote: "“everyone says Halcyon is safest”", x: 43, y: 32, via: "a", evidence: "links to techpicks" },
  { id: "e", site: "medium.com/@aria", quote: "“99.982% uptime, zero leaks”", x: 57, y: 90, via: "o", evidence: "same figures 99.982%" },
];
const POS: Record<string, { x: number; y: number }> = { o: ORIGIN, ...Object.fromEntries(ECHOES.map((e) => [e.id, e])) };

// phase 0: echoes appear · 1: lineage traced · 2: collapsed into one origin
const DURATIONS = [3200, 3600, 4200];

export function CollapseViz() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [shown, setShown] = useState(0);
  // The story is laid out on a fixed 600×520 stage and scaled to fit, so it reads the same on a phone.
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setK(Math.min(1.15, e.contentRect.width / 600, e.contentRect.height / 520)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) {
      setPhase(1);
      setShown(5);
      return;
    }
    let p = 0;
    let timers: number[] = [];
    const run = () => {
      setPhase(p);
      if (p === 0) {
        setShown(0);
        timers = ECHOES.map((_, i) => window.setTimeout(() => setShown(i + 1), 250 + i * 450));
      }
      timers.push(
        window.setTimeout(() => {
          p = (p + 1) % 3;
          run();
        }, DURATIONS[p]),
      );
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const collapsed = phase === 2;
  const traced = phase >= 1;

  return (
    <div ref={box} className="relative h-full w-full">
    <div
      className="absolute left-1/2 top-1/2 h-[520px] w-[600px] select-none"
      style={{ transform: `translate(-50%, -50%) scale(${k})` }}
    >
      {/* ambient dot field */}
      <div
        aria-hidden
        className="absolute inset-[-8%] opacity-60 [background-image:radial-gradient(var(--line-strong)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_72%)]"
      />

      {/* the counter: plain memory's count, then Echo's */}
      <div className="absolute left-0 top-0 z-20" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={collapsed ? "echo" : "plain"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
              {collapsed ? "Echo counts origins" : "Plain memory counts mentions"}
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className={`font-display text-6xl font-semibold tabular-nums ${collapsed ? "text-accent" : "text-text"}`}>
                {collapsed ? 1 : shown}
              </span>
              <span className="font-mono text-sm text-muted">
                {collapsed ? "independent origin" : shown === 1 ? "source says it is safest" : "sources say it is safest"}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* lineage edges */}
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="edge" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {ECHOES.map((e, i) => {
          const t = POS[e.via];
          return (
            <motion.line
              key={e.id}
              x1={t.x}
              y1={t.y}
              x2={e.x}
              y2={e.y}
              stroke="url(#edge)"
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={e.via === "o" ? undefined : "4 4"}
              initial={false}
              animate={{ pathLength: traced && !collapsed ? 1 : 0, opacity: traced && !collapsed ? 1 : 0 }}
              transition={{ duration: 0.7, delay: traced && !collapsed ? i * 0.22 : 0, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
      </svg>

      {/* evidence tags, mid-edge */}
      {ECHOES.map((e, i) => {
        const t = POS[e.via];
        return (
          <motion.div
            key={`ev-${e.id}`}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-accent/30 bg-bg/90 px-2 py-0.5 font-mono text-[10.5px] text-accent backdrop-blur"
            style={{ left: `${(t.x + e.x) / 2}%`, top: `${(t.y + e.y) / 2}%` }}
            initial={false}
            animate={{ opacity: phase === 1 ? 1 : 0, scale: phase === 1 ? 1 : 0.9 }}
            transition={{ duration: 0.35, delay: phase === 1 ? 0.5 + i * 0.22 : 0 }}
          >
            {e.evidence}
          </motion.div>
        );
      })}

      {/* echo cards */}
      {ECHOES.map((e, i) => {
        const visible = i < shown;
        return (
          <motion.div
            key={e.id}
            className="absolute z-10 w-[210px]"
            initial={false}
            animate={{
              left: collapsed ? `${ORIGIN.x}%` : `${e.x}%`,
              top: collapsed ? `${ORIGIN.y}%` : `${e.y}%`,
              opacity: visible && !collapsed ? 1 : 0,
              scale: collapsed ? 0.4 : visible ? 1 : 0.92,
            }}
            transition={{ type: "spring", stiffness: 120, damping: 20, delay: collapsed ? i * 0.06 : 0 }}
            style={{ x: "-50%", y: "-50%" }}
          >
            <div
              className={`rounded-xl border bg-surface/95 px-3 py-2.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur transition-colors duration-500 ${
                traced ? "border-accent/40" : "border-line-strong"
              }`}
            >
              <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted">
                <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${traced ? "bg-accent" : "bg-faint"}`} />
                {e.site}
              </div>
              <div className="mt-1 truncate text-[12.5px] text-text/90">{e.quote}</div>
            </div>
          </motion.div>
        );
      })}

      {/* the origin */}
      <motion.div
        className="absolute z-20 w-[250px]"
        style={{ left: `${ORIGIN.x}%`, top: `${ORIGIN.y}%`, x: "-50%", y: "-50%" }}
        initial={false}
        animate={{ opacity: traced ? 1 : 0.0, scale: collapsed ? 1.06 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          aria-hidden
          className="absolute inset-[-40%] -z-10 rounded-full bg-[radial-gradient(closest-side,var(--accent),transparent)]"
          animate={{ opacity: collapsed ? 0.32 : traced ? 0.14 : 0 }}
          transition={{ duration: 0.8 }}
        />
        <div className="rounded-xl border border-accent/60 bg-surface px-3.5 py-3">
          <div className="flex items-center justify-between gap-2 font-mono text-[10.5px]">
            <span className="flex items-center gap-1.5 text-accent">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              {ORIGIN.site}
            </span>
            <span className="text-faint">origin</span>
          </div>
          <div className="mt-1.5 text-[13px] leading-snug text-text">{ORIGIN.quote}</div>
          <div className="mt-2 font-mono text-[10.5px] text-faint">planted post · ref=hx-partner-77</div>
        </div>
        <AnimatePresence>
          {collapsed && (
            <motion.div
              className="mt-3 flex flex-wrap items-center gap-2"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <span className="rounded-full border border-bad/50 bg-bad/10 px-2.5 py-1 font-mono text-[11px] font-medium text-bad">
                DISPUTED
              </span>
              <span className="font-mono text-[11px] text-muted">5 sources → 1 origin · 2 against</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
    </div>
  );
}
