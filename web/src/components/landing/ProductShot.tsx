"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

const CALLOUTS = [
  { n: "01", title: "The agent shows its work", body: "Every tool call streams in with the Cypher it ran and how long FalkorDB took." },
  { n: "02", title: "The graph follows along", body: "Whatever the agent inspects lights up, from each echo back to the post it came from." },
  { n: "03", title: "Proof, not a score", body: "Six sources, one origin, two against. Even the plain agent's own note is shown with zero weight." },
];

/** The studio in a browser frame that tilts flat as it scrolls into view. */
export function ProductShot() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 16, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.92, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 60, 0]);

  return (
    <div ref={ref} className="[perspective:1600px]">
      <motion.div style={{ rotateX, scale, y, transformOrigin: "50% 0%" }} className="relative">
        <div
          aria-hidden
          className="absolute -inset-x-10 -top-10 bottom-1/3 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_30%,var(--accent-soft),transparent)] blur-2xl"
        />
        <div className="overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)]">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="mx-auto rounded-md bg-surface-2 px-3 py-0.5 font-mono text-[11px] text-faint">echo / studio</span>
          </div>
          <Image
            src="/shots/studio.webp"
            alt="Echo studio: the agent's tool calls on the left, the lineage graph in the middle, and the belief inspector showing 6 sources collapsing into 1 origin"
            width={2880}
            height={1800}
            sizes="(min-width: 1280px) 1216px, 100vw"
            className="h-auto w-full"
            priority={false}
          />
        </div>
      </motion.div>
      <ol className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
        {CALLOUTS.map((c, i) => (
          <motion.li
            key={c.n}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-line pt-5"
          >
            <div className="font-mono text-xs text-accent">{c.n}</div>
            <h3 className="mt-2 font-display text-lg font-medium">{c.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.body}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
