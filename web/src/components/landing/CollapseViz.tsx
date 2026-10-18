"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/*
 * The hero story as one calm loop.
 *   1. mentions: five pages repeat the claim; plain memory's count climbs to five
 *   2. trace:    Echo follows each page back; every row shows the evidence that links it to the origin
 *   3. collapse: the copies fold into the one planted post; the count becomes one, with a verdict
 * Laid out on a fixed stage (wide or tall) and scaled to fit, so it reads the same at any size.
 */

const SOURCES = [
  { site: "techpicks-daily.com", quote: "“…the safest gateway for patient data.”", evidence: "verbatim · 71%" },
  { site: "devstack-review.io", quote: "“Halcyon leads on safety, per our review”", evidence: "links to origin" },
  { site: "bestgateways.io", quote: "“Top pick: Halcyon Gateway”", evidence: "same ref=hx-partner-77" },
  { site: "r/healthIT", quote: "“everyone says Halcyon is safest”", evidence: "links to a copy" },
  { site: "medium.com/@aria", quote: "“99.982% uptime, zero leaks”", evidence: "same figures" },
];

type Phase = 0 | 1 | 2 | 3; // 0 mentions, 1 trace, 2 collapse, 3 fade-out (reset)
const TIMING: Record<Phase, number> = { 0: 3000, 1: 3800, 2: 5200, 3: 700 };
const EASE = [0.22, 1, 0.36, 1] as const;

// Two stage geometries: wide for desktop, tall for phones.
const WIDE = { w: 980, h: 440, rowX: 0, rowW: 400, rowY: (i: number) => 96 + i * 66, rowH: 54, origin: { x: 640, y: 168, w: 320, h: 132 } };
const TALL = { w: 460, h: 760, rowX: 30, rowW: 400, rowY: (i: number) => 112 + i * 64, rowH: 52, origin: { x: 70, y: 540, w: 320, h: 132 } };
type Geo = typeof WIDE;

function curve(g: Geo, i: number, wide: boolean) {
  const y = g.rowY(i) + g.rowH / 2;
  if (wide) {
    const x1 = g.rowX + g.rowW;
    const x2 = g.origin.x;
    const y2 = g.origin.y + g.origin.h / 2;
    return `M ${x1} ${y} C ${x1 + 110} ${y}, ${x2 - 110} ${y2}, ${x2} ${y2}`;
  }
  // tall: from the bottom of the list, fan down into the origin
  const x1 = g.rowX + 40 + i * 80;
  const y1 = g.rowY(4) + g.rowH;
  const x2 = g.origin.x + g.origin.w / 2;
  const y2 = g.origin.y;
  return `M ${x1} ${y1} C ${x1} ${y1 + 60}, ${x2} ${y2 - 60}, ${x2} ${y2}`;
}

export function CollapseViz() {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 980, h: 440 });
  const [phase, setPhase] = useState<Phase>(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) {
      setPhase(1);
      setShown(5);
      return;
    }
    let p: Phase = 0;
    const timers: number[] = [];
    const run = () => {
      setPhase(p);
      if (p === 0) {
        setShown(0);
        SOURCES.forEach((_, i) => timers.push(window.setTimeout(() => setShown(i + 1), 200 + i * 420)));
      }
      timers.push(
        window.setTimeout(() => {
          p = ((p + 1) % 4) as Phase;
          run();
        }, TIMING[p]),
      );
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const wide = size.w >= 620;
  const g = wide ? WIDE : TALL;
  const k = Math.min(1.1, size.w / g.w, size.h / g.h);
  const traced = phase === 1;
  const collapsed = phase === 2;
  const hidden = phase === 3;
  const ox = g.origin.x;
  const oy = g.origin.y;
  // The finale sits dead centre: the count above, the origin card, the verdict below.
  const fx = (g.w - g.origin.w) / 2;
  const fy = (g.h - g.origin.h) / 2 + 26;

  return (
    <div ref={box} className="relative h-full w-full select-none overflow-hidden">
      <motion.div
        className="absolute left-1/2 top-1/2"
        style={{ width: g.w, height: g.h, x: "-50%", y: "-50%", scale: k }}
        animate={{ opacity: hidden ? 0 : 1 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {/* the count */}
        <motion.div
          className="absolute top-0"
          style={{ left: g.rowX }}
          aria-live="polite"
          initial={false}
          animate={{ opacity: collapsed ? 0 : 1, y: collapsed ? -8 : 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={traced ? "trace" : "plain"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="flex items-end gap-4"
            >
              <span className="display text-[76px] leading-[0.8] tabular-nums text-text">{collapsed ? 5 : shown}</span>
              <span className="pb-1">
                <span className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                  {traced || collapsed ? "Echo traces each one back" : "Plain memory counts mentions"}
                </span>
                <span className="mt-1 block text-[15px] text-muted">{shown === 1 ? "source says Halcyon is safest" : "sources say Halcyon is safest"}</span>
              </span>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* lineage curves */}
        <svg className="absolute inset-0 overflow-visible" width={g.w} height={g.h} aria-hidden>
          <defs>
            <linearGradient id="fan" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0.95" />
            </linearGradient>
          </defs>
          {SOURCES.map((_, i) => (
            <motion.path
              key={i}
              d={curve(g, i, wide)}
              fill="none"
              stroke={wide ? "url(#fan)" : "var(--accent)"}
              strokeWidth={1.6}
              strokeLinecap="round"
              initial={false}
              animate={{ pathLength: traced || collapsed ? 1 : 0, opacity: traced ? 1 : 0 }}
              transition={{
                pathLength: { duration: traced ? 0.9 : 0.01, delay: traced ? 0.15 + i * 0.18 : 0, ease: EASE },
                opacity: { duration: 0.4, delay: traced ? 0.15 + i * 0.18 : 0 },
              }}
            />
          ))}
          {traced &&
            !reduce &&
            SOURCES.map((_, i) => (
              <circle key={`p${i}`} r={2.6} fill="var(--accent)" opacity={0}>
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="1.6s" begin={`${1.1 + i * 0.18}s`} repeatCount="indefinite" />
                <animateMotion dur="1.6s" begin={`${1.1 + i * 0.18}s`} repeatCount="indefinite" path={curve(g, i, wide)} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
              </circle>
            ))}
        </svg>

        {/* source rows */}
        {SOURCES.map((s, i) => {
          const visible = i < shown;
          const y = g.rowY(i);
          return (
            <motion.div
              key={s.site}
              className="absolute"
              style={{ left: g.rowX, top: y, width: g.rowW, height: g.rowH }}
              initial={false}
              animate={
                collapsed
                  ? { x: fx - g.rowX + (g.origin.w - g.rowW) / 2, y: fy + (g.origin.h - g.rowH) / 2 - y, scale: 0.8, opacity: 0 }
                  : { x: 0, y: visible ? 0 : 8, scale: 1, opacity: visible ? 1 : 0 }
              }
              transition={{ duration: collapsed ? 0.9 : 0.55, delay: collapsed ? i * 0.07 : 0, ease: EASE }}
            >
              <div
                className={`flex h-full items-center gap-3 rounded-lg border bg-surface px-3.5 shadow-card transition-colors duration-500 ${
                  traced ? "border-accent/45" : "border-line"
                }`}
              >
                <span className={`size-2 shrink-0 rounded-full transition-colors duration-500 ${traced ? "bg-accent" : "bg-line-strong"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[11px] text-muted">{s.site}</div>
                  <div className="truncate text-[13.5px] text-text">{s.quote}</div>
                </div>
                <motion.span
                  className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10.5px] text-accent"
                  initial={false}
                  animate={{ opacity: traced ? 1 : 0, x: traced ? 0 : 6 }}
                  transition={{ duration: 0.45, delay: traced ? 0.6 + i * 0.18 : 0, ease: EASE }}
                >
                  {s.evidence}
                </motion.span>
              </div>
            </motion.div>
          );
        })}

        {/* the origin */}
        <motion.div
          className="absolute"
          style={{ left: ox, top: oy, width: g.origin.w }}
          initial={false}
          animate={{
            opacity: phase === 0 && shown < 5 ? 0.35 : 1,
            x: collapsed ? fx - ox : 0,
            y: collapsed ? fy - oy : 0,
            scale: collapsed ? 1.06 : 1,
          }}
          transition={{ duration: 1.0, ease: EASE }}
        >
          <AnimatePresence>
            {collapsed && (
              <motion.div
                className="absolute inset-x-0 -top-[112px] flex items-end justify-center gap-4"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.75, duration: 0.6, ease: EASE }}
              >
                <span className="display text-[104px] leading-[0.78] text-accent">1</span>
                <span className="pb-1.5">
                  <span className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Echo counts origins</span>
                  <span className="mt-1 block text-[17px] text-text">independent origin</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            aria-hidden
            className="absolute -inset-12 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,var(--accent),transparent)] blur-xl"
            animate={{ opacity: collapsed ? 0.34 : traced ? 0.12 : 0, scale: collapsed ? 1.15 : 1 }}
            transition={{ duration: 0.9, ease: EASE }}
          />
          <div className={`rounded-xl border bg-surface p-4 shadow-card transition-colors duration-500 ${phase >= 1 ? "border-accent" : "border-line"}`}>
            <div className="flex items-center justify-between font-mono text-[10.5px]">
              <span className="flex items-center gap-2 text-accent">
                <span className="size-2 rounded-full bg-accent" />
                halcyon-insights.blog
              </span>
              <span className="uppercase tracking-[0.14em] text-faint">origin</span>
            </div>
            <div className="mt-2 text-[15px] leading-snug text-text">Halcyon is the safest gateway for patient data.</div>
            <div className="mt-2.5 font-mono text-[10.5px] text-faint">planted post · ref=hx-partner-77</div>
          </div>
          <AnimatePresence>
            {collapsed && (
              <motion.div
                className="mt-4 flex items-center justify-center gap-2.5"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 1.0, duration: 0.5, ease: EASE }}
              >
                <span className="rounded-full bg-bad/10 px-2.5 py-1 font-mono text-[10.5px] font-medium tracking-wider text-bad">DISPUTED</span>
                <span className="font-mono text-[11.5px] text-muted">
                  5 sources → <span className="text-accent">1 origin</span> · 2 against
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}
