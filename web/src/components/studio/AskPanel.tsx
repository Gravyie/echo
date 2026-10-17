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
      return { ...run, llm: e.llm };
    case "notice":
      return { ...run, notice: e.text };
    case "step":
      return { ...run, steps: [...run.steps, { tool: e.tool, args: e.args }] };
    case "step_result": {
      const steps = run.steps.slice();
      const i = steps.length - 1;
      if (i >= 0) steps[i] = { ...steps[i], summary: e.summary, cypher: e.cypher, highlight: e.highlight };
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

function StepRow({ s, onHighlight }: { s: Step; onHighlight: (s: Step) => void }) {
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
            <span className="text-[12.5px] font-medium text-text">{TOOL_LABEL[s.tool] ?? s.tool}</span>
            <span className="truncate font-mono text-[11px] text-faint">{arg}</span>
          </button>
          {s.summary && <div className="mt-0.5 text-[12px] leading-snug text-muted">{s.summary}</div>}
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
    <div className={`rounded-xl border ${echo ? "border-accent/35 bg-surface" : "border-line bg-surface/60"}`}>
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-semibold ${echo ? "text-accent" : "text-muted"}`}>
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
            <StepRow key={i} s={s} onHighlight={onHighlight} />
          ))}
        </ol>
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
}: {
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
          <div className="pt-2">
            <h2 className="font-display text-xl font-semibold tracking-tight">Ask the research agent</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              The same agent answers twice: once with Echo, once with a plain memory that counts mentions. Watch the graph as it
              works.
            </p>
            <div className="mt-5 space-y-2">
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
              <div className="ml-6 rounded-xl bg-surface-3 px-3.5 py-2.5 text-[13.5px] text-text">{t.question}</div>
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
            className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink transition-transform active:scale-95 disabled:opacity-40"
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
