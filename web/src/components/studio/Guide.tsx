"use client";

import { Check, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";

export type GuideKey = "asked" | "opened" | "lineage" | "retracted" | "loop";

export interface GuideStep {
  key: GuideKey;
  title: string;
  body: string;
  cta: string;
  run: () => void;
  disabled?: boolean;
}

/** The demo path, with a button that does each step for you. Done steps tick themselves off. */
export function Guide({
  steps,
  done,
  onClose,
  compact,
}: {
  steps: GuideStep[];
  done: Record<GuideKey, boolean>;
  onClose: () => void;
  compact?: boolean;
}) {
  const next = steps.find((s) => !done[s.key]);
  const count = steps.filter((s) => done[s.key]).length;
  if (compact) {
    if (!next) return null;
    const i = steps.indexOf(next);
    return (
      <motion.div
        key={next.key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 pl-3.5 shadow-card"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-accent font-mono text-[10.5px] text-accent">{i + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            Next · {count}/{steps.length}
          </div>
          <div className="truncate text-[13px] font-medium text-text">{next.title}</div>
        </div>
        <button
          onClick={next.run}
          disabled={next.disabled}
          className="shrink-0 rounded-md bg-text px-3 py-1.5 text-[12px] font-medium text-bg transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {next.cta}
        </button>
        <button onClick={onClose} aria-label="Hide guide" className="grid size-6 shrink-0 place-items-center rounded-md text-faint hover:text-text">
          <X size={12} />
        </button>
      </motion.div>
    );
  }
  return (
    <div className="rounded-xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <span className="eyebrow">Start here</span>
          <div className="mt-1 text-[12px] text-muted">
            {count === steps.length ? "You've seen the whole story." : `${count} of ${steps.length} done. Each button does the step for you.`}
          </div>
        </div>
        <button onClick={onClose} aria-label="Hide guide" className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-text">
          <X size={14} />
        </button>
      </div>
      <ol className="divide-y divide-line">
        {steps.map((s, i) => {
          const isDone = done[s.key];
          const isNext = next?.key === s.key;
          return (
            <li key={s.key} className={`flex gap-3 px-4 py-3 ${isNext ? "bg-accent-soft/60" : ""}`}>
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${
                  isDone ? "border-ok bg-ok text-white" : isNext ? "border-accent text-accent" : "border-line-strong text-faint"
                }`}
              >
                {isDone ? <Check size={11} weight="bold" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-[13px] font-medium ${isDone ? "text-muted" : "text-text"}`}>{s.title}</div>
                <AnimatePresence initial={false}>
                  {isNext && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{s.body}</p>
                      <button
                        onClick={s.run}
                        disabled={s.disabled}
                        className="mt-2.5 rounded-md bg-text px-3 py-1.5 text-[12px] font-medium text-bg transition-transform active:scale-[0.98] disabled:opacity-40"
                      >
                        {s.cta}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A compact progress pill for the header. */
export function GuidePill({ count, total, onClick }: { count: number; total: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-[12px] text-muted hover:text-text">
      <span className="flex gap-0.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1.5 w-3 rounded-full ${i < count ? "bg-ok" : "bg-line-strong"}`} />
        ))}
      </span>
      Guide
    </button>
  );
}
