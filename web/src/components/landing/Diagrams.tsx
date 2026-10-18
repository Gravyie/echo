"use client";

import { motion, useReducedMotion } from "motion/react";

/*
 * Small dot-matrix diagrams for the three ways repetition passes for evidence.
 * Mono-labelled boxes, hairline edges, and a pulse travelling the way the claim spread.
 */

const W = 300;
const H = 150;

function Box({ x, y, w = 74, label, hot }: { x: number; y: number; w?: number; label: string; hot?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={20} fill={hot ? "var(--accent)" : "var(--surface)"} stroke={hot ? "var(--accent)" : "var(--line-strong)"} />
      <text
        x={x + w / 2}
        y={y + 13.5}
        textAnchor="middle"
        fontSize="7.5"
        letterSpacing="1.2"
        fontFamily="var(--font-geist-mono)"
        fill={hot ? "var(--accent-ink)" : "var(--muted)"}
      >
        {label}
      </text>
    </g>
  );
}

function DotField({ x, y, cols, rows, lit = [] }: { x: number; y: number; cols: number; rows: number; lit?: number[] }) {
  const dots = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      dots.push(<circle key={i} cx={x + c * 9} cy={y + r * 9} r={1.6} fill={lit.includes(i) ? "var(--accent)" : "var(--line-strong)"} />);
    }
  return <g>{dots}</g>;
}

function Pulse({ d, delay = 0, dur = 2.4 }: { d: string; delay?: number; dur?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <circle r={2.4} fill="var(--accent)">
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={d} />
    </circle>
  );
}

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <motion.svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-[340px]"
      role="img"
      aria-label={label}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.8 }}
    >
      {children}
    </motion.svg>
  );
}

/** One planted post, copied out to five pages. */
export function PlantedDiagram() {
  const ys = [8, 38, 68, 98, 128];
  return (
    <Frame label="One planted post spreads to five pages">
      <Box x={6} y={65} w={86} label="PLANTED POST" hot />
      {ys.map((y, i) => {
        const d = `M92 75 C 140 75, 150 ${y + 10}, 196 ${y + 10}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="var(--line-strong)" />
            <Pulse d={d} delay={i * 0.35} />
            <Box x={196} y={y} w={56} label={`COPY ${i + 1}`} />
          </g>
        );
      })}
      <DotField x={262} y={12} cols={4} rows={14} lit={[2, 9, 22, 31, 44, 53]} />
    </Frame>
  );
}

/** A wiki cites a paper that copied the wiki. */
export function LoopDiagram() {
  const top = "M120 46 C 150 10, 200 10, 222 40";
  const bottom = "M222 104 C 200 140, 150 140, 120 108";
  return (
    <Frame label="A citation loop: two pages citing each other">
      <DotField x={10} y={14} cols={8} rows={14} lit={[19, 27, 35, 43]} />
      <Box x={86} y={66} w={70} label="WIKI EDIT" hot />
      <Box x={196} y={66} w={70} label="LOCAL PAPER" />
      <path d={top} fill="none" stroke="var(--line-strong)" markerEnd="url(#arrowA)" />
      <path d={bottom} fill="none" stroke="var(--line-strong)" markerEnd="url(#arrowA)" />
      <Pulse d={`${top} L 222 104 ${bottom.slice(1)}`} dur={3.2} />
      <text x={171} y={78} textAnchor="middle" fontSize="7" fontFamily="var(--font-geist-mono)" fill="var(--faint)">
        cites
      </text>
      <defs>
        <marker id="arrowA" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="var(--line-strong)" />
        </marker>
      </defs>
    </Frame>
  );
}

/** The agent re-reads its own summary as fresh evidence. */
export function SelfEchoDiagram() {
  const out = "M84 75 L 150 75";
  const back = "M190 66 C 190 20, 50 20, 46 64";
  return (
    <Frame label="An agent's own note counted as new evidence">
      <Box x={10} y={65} w={74} label="AGENT" />
      <Box x={150} y={65} w={74} label="ITS OWN NOTE" hot />
      <path d={out} fill="none" stroke="var(--line-strong)" />
      <path d={back} fill="none" stroke="var(--accent)" strokeDasharray="3 3" />
      <Pulse d={`${out} L 190 66 ${back.slice(1)}`} dur={2.8} />
      <text x={118} y={30} textAnchor="middle" fontSize="7" fontFamily="var(--font-geist-mono)" fill="var(--accent)">
        read back as a new source
      </text>
      <DotField x={238} y={12} cols={6} rows={14} lit={[14, 15, 20, 21]} />
    </Frame>
  );
}
