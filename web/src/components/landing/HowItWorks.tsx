"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CypherBlock } from "../CypherBlock";

const STEPS = [
  {
    title: "Link",
    body:
      "Every source Echo stores gets edges back toward where it came from. Hyperlinks and shared CVE or DOI identifiers become CITES. Verbatim passages, paraphrased sentences and shared precise figures become COPIED_FROM. Domains, authors, affiliate tags and analytics IDs become owners. The agent's own notes are DERIVED_FROM what it read.",
    code: `// a new page that reuses two precise figures
MATCH (a:Source {id:$copier}), (b:Source {id:$original})
MERGE (a)-[r:COPIED_FROM]->(b)
SET r.method = 'shared-specifics',
    r.evidence = 'same precise figures: 1,284, 99.982%'`,
  },
  {
    title: "Collapse",
    body:
      "To judge a belief, Echo walks each supporting source up its lineage in one variable-length traversal. Sources that share an ancestor or an owner fold into one origin cluster. Retracted nodes block the walk. A citation loop counts as a single origin.",
    code: `MATCH (b:Belief {id:$id})<-[:SUPPORTS]-(:Observation)
      <-[:YIELDED]-(s:Source)
MATCH (s)-[:CITES|COPIED_FROM|DERIVED_FROM*0..8]->(a:Source)
WITH DISTINCT a
OPTIONAL MATCH (a)-[:CITES|COPIED_FROM|DERIVED_FROM]->(up)
OPTIONAL MATCH (a)-[:PUBLISHED_BY]->(w:Owner)
RETURN a.id, collect(DISTINCT up.id), collect(DISTINCT w.id)`,
  },
  {
    title: "Decide",
    body:
      "Confidence comes from independent origins, scored with the same rule a plain memory uses on raw mentions. Only two or more origins make a belief VERIFIED. Retract a source and every belief downstream of it is rescored in the same request.",
    code: `// retraction: rescore only what leaned on the source
MATCH (s:Source {id:$id}) SET s.retracted = true
WITH s
MATCH (s)<-[:CITES|COPIED_FROM|DERIVED_FROM*0..8]-(d:Source)
      -[:YIELDED]->(:Observation)-[:SUPPORTS|CONTRADICTS]->(b:Belief)
RETURN DISTINCT b.id`,
  },
];

function Step({ i, onActive, children }: { i: number; onActive: (i: number) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive(i);
  }, [inView, i, onActive]);
  return (
    <div ref={ref} className="min-h-[52vh] py-10 md:py-16">
      {children}
    </div>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16">
      <div>
        {STEPS.map((s, i) => (
          <Step key={s.title} i={i} onActive={setActive}>
            <div className={`transition-opacity duration-500 ${active === i ? "opacity-100" : "md:opacity-35"}`}>
              <div className="font-mono text-sm text-accent">{s.title.toLowerCase()}()</div>
              <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">{s.title}</h3>
              <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-muted">{s.body}</p>
              <div className="mt-6 md:hidden">
                <CypherBlock code={s.code} />
              </div>
            </div>
          </Step>
        ))}
      </div>
      <div className="hidden md:block">
        <div className="sticky top-28">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <CypherBlock code={STEPS[active].code} title={`${STEPS[active].title.toLowerCase()}.cypher`} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
