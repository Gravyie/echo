"use client";

import { ArrowUp, CaretDown, CheckCircle, Database, Graph, MagnifyingGlass, Sparkle, Warning } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { AgentEvent, CypherEntry } from "@/lib/api";
import { Answer } from "./Answer";
import { CypherBlock } from "../CypherBlock";

export interface Step {
  tool: string;
  args: Record<string, unknown>;
  summary?: string;
  cypher?: CypherEntry[];
  highlight?: { nodes?: string[]; edges?: string[][]; focus?: string };
  t0?: number;
  ms?: number;
}
export interface Run {
  steps: Step[];
  answer?: string;
  notice?: string;
  error?: string;
  done: boolean;
  seconds?: number;
  note?: string | null;
  llm?: boolean;
  t0?: number;
}
export interface Turn {
  id: number;
  question: string;
  echo: Run;
  plain?: Run;
}

export function applyEvent(run: Run, e: AgentEvent): Run {
  switch (e.type) {
    case "start":
      return { ...run, llm: e.llm, t0: 0 };
    case "notice":
      return { ...run, notice: e.text };
    case "step":
      return { ...run, steps: [...run.steps, { tool: e.tool, args: e.args, t0: e.at }] };
    case "step_result": {
      const steps = run.steps.slice();
      const i = steps.length - 1;
      if (i >= 0) steps[i] = { ...steps[i], summary: e.summary, cypher: e.cypher, highlight: e.highlight, ms: e.at != null && steps[i].t0 != null ? e.at - steps[i].t0 : undefined };
      return { ...run, steps };
    }
    case "answer":
      return { ...run, answer: e.text, done: true, seconds: e.seconds, note: e.note };
    case "error":
      return { ...run, error: e.text, done: true };
  }
}

const TOOL_LABEL: Record<string, string> = {
  recall_beliefs: "Recall beliefs",
  search_memory: "Search memory",
  inspect_belief: "Check independence",
  load_bearing_origins: "Rank load-bearing origins",
  query_graph: "Query the graph",
};
const TOOL_ICON: Record<string, typeof Graph> = {
  recall_beliefs: MagnifyingGlass,
  search_memory: MagnifyingGlass,
  inspect_belief: Graph,
  load_bearing_origins: Sparkle,
  query_graph: Database,
};

function StepRow({ s, onHighlight, run }: { s: Step; onHighlight: (s: Step) => void; run: Run }) {
  const [open, setOpen] = useState(false);
  const Icon = TOOL_ICON[s.tool] ?? Graph;
  const arg = (s.args.belief_id as string) ?? (s.args.query as string) ?? (s.args.cypher as string) ?? "";
  return (
    <li className="group">
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ${s.summary ? "bg-surface-3 text-accent" : "skeleton"}`}>
          {s.summary && <Icon size={12} weight="bold" />}
        </span>
        <div className="min-w-0 flex-1">
          <button className="flex w-full items-center gap-1.5 text-left" onClick={() => (s.highlight ? onHighlight(s) : undefined)}>
            <span className="shrink-0 whitespace-nowrap text-[12.5px] font-medium text-text">{TOOL_LABEL[s.tool] ?? s.tool}</span>
            <span className="truncate font-mono text-[11px] text-faint">{arg}</span>
          </button>
          {s.summary && <div className="mt-0.5 text-[12px] leading-snug text-muted">{s.summary}</div>}
          {s.t0 != null && run.t0 != null && (
            <Waterfall start={s.t0 - run.t0} ms={s.ms} total={Math.max(1, (run.seconds ?? 0) * 1000, ...run.steps.map((x) => (x.t0 ?? 0) - run.t0! + (x.ms ?? 0)))} />
          )}
          {!!s.cypher?.length && (
            <button onClick={() => setOpen((o) => !o)} className="mt-1 flex items-center gap-1 font-mono text-[10.5px] text-faint hover:text-text">
              <CaretDown size={10} className={open ? "rotate-180" : ""} />
              {s.cypher.length} Cypher {s.cypher.length === 1 ? "query" : "queries"} ·{" "}
              {s.cypher.reduce((a, c) => a + c.ms, 0).toFixed(1)} ms
            </button>
          )}
          {open && (
            <div className="mt-2 space-y-2">
              {s.cypher!.map((c, i) => (
                <CypherBlock key={i} code={c.cypher.replace(/ (MATCH|OPTIONAL MATCH|WITH|RETURN|CALL|WHERE|SET|MERGE)\b/g, "\n$1")} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** Where this step sat in the run, LangSmith-style: offset and duration on one timeline. */
function Waterfall({ start, ms, total }: { start: number; ms?: number; total: number }) {
  const left = Math.min(100, (start / total) * 100);
  const width = ms == null ? 2 : Math.max(1.5, (ms / total) * 100);
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="relative h-1 flex-1 bg-surface-3">
        <div className={`absolute inset-y-0 ${ms == null ? "skeleton" : "bg-accent/70"}`} style={{ left: `${left}%`, width: `${Math.min(100 - left, width)}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[10px] text-faint">{ms == null ? "…" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}</span>
    </div>
  );
}

/** Pull "echo: 5 sources, 1 origin" findings out of the independence checks. */
function caught(run: Run, titles: Map<string, string>) {
  const out: { id: string; title: string; sources: number; origins: number }[] = [];
  for (const s of run.steps) {
    if (s.tool !== "inspect_belief" || !s.summary) continue;
    const m = s.summary.match(/echo: (\d+) sources?, (\d+) origins?/);
    const id = String(s.args.belief_id ?? "");
    if (m && !out.some((o) => o.id === id)) out.push({ id, title: titles.get(id) ?? id, sources: +m[1], origins: +m[2] });
  }
  return out;
}

function RunCard({
  run,
  kind,
  titles,
  onCite,
  onHighlight,
}: {
  run: Run;
  kind: "echo" | "plain";
  titles: Map<string, string>;
  onCite: (id: string) => void;
  onHighlight: (s: Step) => void;
}) {
  const [stepsOpen, setStepsOpen] = useState(kind === "echo");
  const echo = kind === "echo";
  return (
    <div className={`rounded-xl border bg-surface ${echo ? "border-accent/40 shadow-card" : "border-line"}`}>
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="flex items-center gap-2">
          <span className={`size-1.5 ${echo ? "bg-accent" : "bg-faint"}`} />
          <span className={`text-[12.5px] font-semibold ${echo ? "text-text" : "text-muted"}`}>
            {echo ? "Echo memory" : "Plain memory"}
          </span>
          <span className="text-[11px] text-faint">{echo ? "counts independent origins" : "counts mentions"}</span>
        </div>
        <button onClick={() => setStepsOpen((o) => !o)} className="flex items-center gap-1 text-[11px] text-faint hover:text-text">
          {run.steps.length} steps <CaretDown size={10} className={stepsOpen ? "rotate-180" : ""} />
        </button>
      </div>
      {stepsOpen && run.steps.length > 0 && (
        <ol className="mt-3 space-y-3 border-b border-line px-4 pb-3.5">
          {run.steps.map((s, i) => (
            <StepRow key={i} s={s} onHighlight={onHighlight} run={run} />
          ))}
        </ol>
      )}
      {echo && run.done && caught(run, titles).length > 0 && (
        <div className="mx-4 mt-3.5 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">What Echo caught</div>
          <ul className="mt-1.5 space-y-1">
            {caught(run, titles).map((c) => (
              <li key={c.id}>
                <button onClick={() => onCite(c.id)} className="group flex w-full items-baseline gap-2 text-left text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate text-text group-hover:underline">{c.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    {c.sources} sources → <span className="text-accent">{c.origins}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="px-4 py-3.5">
        {run.notice && <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-contested"><Warning size={12} /> {run.notice}</div>}
        {run.error && <div className="text-[13px] text-bad">{run.error}</div>}
        {run.answer ? (
          <Answer text={run.answer} onCite={onCite} titles={titles} />
        ) : !run.error ? (
          <div className="space-y-2">
            <div className="skeleton h-3 w-11/12 rounded" />
            <div className="skeleton h-3 w-9/12 rounded" />
            <div className="skeleton h-3 w-10/12 rounded" />
          </div>
        ) : null}
        {run.done && run.note && (
          <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-[11px] text-faint">
            <CheckCircle size={12} className={echo ? "text-agent" : "text-faint"} />
            {echo ? "Saved to memory, linked to the sources it read" : "Saved to memory as a new source"}
            {run.seconds != null && <span className="ml-auto font-mono">{run.seconds}s</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function AskPanel({
  turns,
  busy,
  suggested,
  compare,
  setCompare,
  onAsk,
  titles,
  onCite,
  onHighlight,
  intro,
}: {
  intro?: React.ReactNode;
  turns: Turn[];
  busy: boolean;
  suggested: string[];
  compare: boolean;
  setCompare: (b: boolean) => void;
  onAsk: (q: string) => void;
  titles: Map<string, string>;
  onCite: (id: string) => void;
  onHighlight: (s: Step) => void;
}) {
  const [q, setQ] = useState("");
  const reduce = useReducedMotion();
  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    onAsk(t);
    setQ("");
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {turns.length === 0 && (
          <div className="space-y-5 pt-1">
            {intro}
            <div>
            <h2 className="display text-[24px] leading-tight">Ask the research agent</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              The same agent answers twice: once with Echo, once with a plain memory that counts mentions. Watch the graph as it
              works.
            </p>
            </div>
            <div className="space-y-2">
              {suggested.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  disabled={busy}
                  className="block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-left text-[13px] text-text transition-colors hover:border-accent/50 hover:bg-surface-2 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t) => (
            <motion.div
              key={t.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              <div className="ml-8 rounded-xl rounded-tr-sm bg-text px-3.5 py-2.5 text-[13.5px] text-bg">{t.question}</div>
              <RunCard run={t.echo} kind="echo" titles={titles} onCite={onCite} onHighlight={onHighlight} />
              {t.plain && <RunCard run={t.plain} kind="plain" titles={titles} onCite={onCite} onHighlight={onHighlight} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="border-t border-line p-3">
        {turns.length > 0 && (
          <div className="scrollbar-thin mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {suggested.slice(1).map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => submit(s)}
                className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11.5px] text-muted hover:border-accent/50 hover:text-text disabled:opacity-40"
              >
                {s.length > 44 ? s.slice(0, 43) + "…" : s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
          className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 focus-within:border-accent/60"
        >
          <label htmlFor="ask" className="sr-only">
            Question for the agent
          </label>
          <textarea
            id="ask"
            rows={1}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(q);
              }
            }}
            placeholder="Ask about anything in memory"
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[13.5px] text-text placeholder:text-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !q.trim()}
            aria-label="Ask"
            className="grid size-8 place-items-center rounded-lg bg-text text-bg transition-transform active:scale-95 disabled:opacity-40"
          >
            <ArrowUp size={16} weight="bold" />
          </button>
        </form>
        <label className="mt-2 flex cursor-pointer items-center gap-2 px-1 text-[11.5px] text-faint">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="accent-[var(--accent)]" />
          Also ask with plain memory, for comparison
        </label>
      </div>
    </div>
  );
}
