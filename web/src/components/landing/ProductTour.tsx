"use client";

import Image, { type StaticImageData } from "next/image";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useRef, useState } from "react";
import f1 from "@/assets/tour-1.webp";
import f2 from "@/assets/tour-2.webp";
import f3 from "@/assets/tour-3.webp";
import f4 from "@/assets/tour-4.webp";

/*
 * The studio, filmed. The frame stays pinned while the page scrolls; at each step a camera glides
 * and zooms onto the part of the product that matters, with a ring around it.
 * Coordinates are fractions of the 1440×900 capture.
 */

type Frame = {
  img: StaticImageData;
  title: string;
  body: string;
  zoom: number;
  cx: number;
  cy: number;
  ring: { x: number; y: number; w: number; h: number };
};

const FRAMES: Frame[] = [
  {
    img: f1,
    title: "The agent shows its work",
    body: "Ask a question and every tool call streams in: semantic recall from the vector index, then an independence check per belief, with the Cypher it ran and how long FalkorDB took.",
    zoom: 1.8,
    cx: 0.13,
    cy: 0.45,
    ring: { x: 0.008, y: 0.228, w: 0.25, h: 0.44 },
  },
  {
    img: f2,
    title: "It says what it caught",
    body: "Five pages call Halcyon the safest gateway. Echo finds they trace back to one origin, so the claim stays disputed, and the agent recommends the vendor with independent support.",
    zoom: 1.8,
    cx: 0.13,
    cy: 0.75,
    ring: { x: 0.008, y: 0.712, w: 0.25, h: 0.09 },
  },
  {
    img: f3,
    title: "The proof, as a diagram",
    body: "Lineage reads left to right: the planted post, the copies that carried the claim, the belief. Every edge says why: verbatim copy, link, same figures. The plain agent's own note carries zero weight.",
    zoom: 1.35,
    cx: 0.63,
    cy: 0.52,
    ring: { x: 0.295, y: 0.315, w: 0.675, h: 0.41 },
  },
  {
    img: f4,
    title: "Retract, and watch it fall",
    body: "Flag the planted post and every belief built on it is rescored in the same request. Disputed becomes retracted, one origin becomes zero, in milliseconds.",
    zoom: 1.7,
    cx: 0.88,
    cy: 0.58,
    ring: { x: 0.752, y: 0.39, w: 0.244, h: 0.37 },
  },
];

const EASE = [0.65, 0, 0.35, 1] as const;

function Camera({ i, reduce }: { i: number; reduce: boolean }) {
  const f = FRAMES[i];
  const k = reduce ? 1 : f.zoom;
  const cx = Math.min(Math.max(f.cx, 0.5 / k), 1 - 0.5 / k);
  const cy = Math.min(Math.max(f.cy, 0.5 / k), 1 - 0.5 / k);
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-bg">
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ scale: k, x: `${k * (0.5 - cx) * 100}%`, y: `${k * (0.5 - cy) * 100}%` }}
        transition={{ duration: reduce ? 0 : 1.15, ease: EASE }}
      >
        <AnimatePresence initial={false}>
          <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <Image src={f.img} alt="" placeholder="blur" fill sizes="(min-width: 1024px) 900px, 100vw" className="object-cover" />
          </motion.div>
        </AnimatePresence>
        <motion.div
          key={`ring-${i}`}
          className="pointer-events-none absolute rounded-[6px]"
          style={{
            left: `${f.ring.x * 100}%`,
            top: `${f.ring.y * 100}%`,
            width: `${f.ring.w * 100}%`,
            height: `${f.ring.h * 100}%`,
            boxShadow: `0 0 0 ${1.6 / k}px var(--accent), 0 0 0 ${6 / k}px var(--accent-soft)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: reduce ? 0 : 0.9 }}
        />
      </motion.div>
    </div>
  );
}

function Chrome({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_40px_100px_-40px_rgb(18_18_18/0.45)]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="size-2 rounded-full bg-line-strong" />
        <span className="size-2 rounded-full bg-line-strong" />
        <span className="size-2 rounded-full bg-line-strong" />
        <span className="mx-auto font-mono text-[11px] text-faint">{label}</span>
      </div>
      {children}
    </div>
  );
}

export function ProductTour() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(FRAMES.length - 1, Math.max(0, Math.floor(v * FRAMES.length)))));

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (span * (i + 0.5)) / FRAMES.length, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <>
      {/* desktop: pinned frame, steps drive the camera */}
      <div ref={ref} className="relative hidden lg:block" style={{ height: `${FRAMES.length * 85}vh` }}>
        <div className="sticky top-16 grid h-[calc(100dvh-4rem)] grid-cols-[300px_minmax(0,1fr)] items-center gap-12">
          <ol className="space-y-1">
            {FRAMES.map((f, i) => (
              <li key={f.title}>
                <button onClick={() => jump(i)} className="group w-full border-l-2 py-3 pl-5 text-left transition-colors" style={{ borderColor: i === active ? "var(--accent)" : "var(--line)" }}>
                  <span className={`font-mono text-[11px] ${i === active ? "text-accent" : "text-faint"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={`display mt-1 block text-[22px] leading-tight transition-colors ${i === active ? "text-text" : "text-faint group-hover:text-muted"}`}>{f.title}</span>
                  <motion.span
                    className="block overflow-hidden text-[14px] leading-relaxed text-muted"
                    initial={false}
                    animate={{ height: i === active ? "auto" : 0, opacity: i === active ? 1 : 0, marginTop: i === active ? 8 : 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {f.body}
                  </motion.span>
                </button>
              </li>
            ))}
          </ol>
          <Chrome label="echo / studio">
            <Camera i={active} reduce={reduce} />
          </Chrome>
        </div>
      </div>

      {/* mobile and tablet: one framed shot per step */}
      <div className="space-y-14 lg:hidden">
        {FRAMES.map((f, i) => (
          <div key={f.title}>
            <span className="font-mono text-[11px] text-accent">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="display mt-1 text-[24px] leading-tight">{f.title}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{f.body}</p>
            <div className="mt-5">
              <Chrome label="echo / studio">
                <Camera i={i} reduce={reduce} />
              </Chrome>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
