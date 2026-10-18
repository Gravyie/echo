"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CypherBlock } from "../CypherBlock";

const STEPS = [
  {
    n: "01",
    title: "Link",
    body:
      "Every source gets edges back toward where it came from. Hyperlinks and shared CVE or DOI identifiers become CITES. Verbatim passages, paraphrased sentences and shared precise figures become COPIED_FROM. Domains, authors, affiliate tags and analytics IDs become owners. The agent's own notes are DERIVED_FROM what it read. Each edge keeps its evidence.",
    code: `// a new page that reuses two precise figures
MATCH (a:Source {id:$copier}), (b:Source {id:$original})
MERGE (a)-[r:COPIED_FROM]->(b)
SET r.method = 'shared-specifics',
    r.evidence = 'same precise figures: 1,284, 99.982%'`,
  },
  {
    n: "02",
    title: "Collapse",
    body:
      "To judge a belief, Echo walks every supporting source up its lineage in one variable-length traversal. Sources that share an ancestor or an owner fold into one origin. A retracted source blocks the walk, and a citation loop counts once.",
    code: `MATCH (s:Source) WHERE s.id IN $supporting
MATCH (s)-[:CITES|COPIED_FROM|DERIVED_FROM*0..8]->(a:Source)
WITH DISTINCT a
OPTIONAL MATCH (a)-[:CITES|COPIED_FROM|DERIVED_FROM]->(up:Source)
OPTIONAL MATCH (a)-[:PUBLISHED_BY]->(w:Owner)
RETURN a.id, a.retracted, collect(DISTINCT up.id), collect(DISTINCT w.id)`,
  },
  {
    n: "03",
    title: "Decide",
    body:
      "Confidence comes from independent origins, scored with the same rule a plain memory applies to raw mentions. Only two or more origins make a belief VERIFIED. Retract a source and every belief downstream of it is rescored in the same request.",
    code: `// retraction: find every belief that leaned on the source
MATCH (s:Source) WHERE s.id IN $retracted
MATCH (s)<-[:CITES|COPIED_FROM|DERIVED_FROM*0..8]-(d:Source)
      -[:YIELDED]->(:Observation)-[:SUPPORTS|CONTRADICTS]->(b:Belief)
RETURN DISTINCT b.id`,
  },
];

const ADVANCE_MS = 7000;

/** Three steps, one Cypher panel. Advances on its own until the visitor picks a step. */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const running = auto && !paused && inView && !reduce;

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % STEPS.length), ADVANCE_MS);
    return () => window.clearTimeout(t);
  }, [running, active]);

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <ol className="border-t border-line">
        {STEPS.map((s, i) => {
          const on = active === i;
          return (
            <li key={s.title} className="border-b border-line">
              <button
                onClick={() => {
                  setActive(i);
                  setAuto(false);
                }}
                aria-expanded={on}
                className="group relative w-full py-5 text-left"
              >
                <div className="flex items-baseline gap-4">
                  <span className={`font-mono text-[11px] ${on ? "text-accent" : "text-faint"}`}>{s.n}</span>
                  <span className={`display text-[30px] leading-none transition-colors ${on ? "text-text" : "text-faint group-hover:text-muted"}`}>{s.title}</span>
                </div>
                <motion.div
                  className="overflow-hidden"
                  initial={false}
                  animate={{ height: on ? "auto" : 0, opacity: on ? 1 : 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="max-w-[52ch] pl-[30px] pt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
                  <div className="mt-5 md:hidden">
                    <CypherBlock code={s.code} />
                  </div>
                </motion.div>
                {on && (
                  <span className="absolute inset-x-0 -bottom-px h-px overflow-hidden">
                    <motion.span
                      key={`${i}-${running}`}
                      className="block h-full bg-accent"
                      initial={{ width: running ? "0%" : "100%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: running ? ADVANCE_MS / 1000 : 0, ease: "linear" }}
                    />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="hidden md:block">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <CypherBlock code={STEPS[active].code} title={`${STEPS[active].title.toLowerCase()}.cypher`} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
