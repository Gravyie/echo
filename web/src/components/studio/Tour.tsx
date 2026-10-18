"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/*
 * A first-visit spotlight tour of the studio: dims the page, cuts out one region at a time
 * ([data-tour="..."]) and explains what it is. Keyboard: ← → to move, Esc to close.
 */

export interface TourStep {
  target: string;
  title: string;
  body: string;
}

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 6;
const EASE = [0.22, 1, 0.36, 1] as const;

function element(target: string): HTMLElement | null {
  // the first matching element that is actually laid out (some targets exist twice, for desktop and mobile)
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function measure(target: string): Rect | null {
  const el = element(target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const x = Math.max(4, r.left - PAD);
  const y = Math.max(4, r.top - PAD);
  return { x, y, w: Math.min(window.innerWidth - 4, r.right + PAD) - x, h: Math.min(window.innerHeight - 4, r.bottom + PAD) - y };
}

export function Tour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 1440, h: 900 });

  const visible = open ? steps.filter((s) => element(s.target)) : steps;
  const step = visible[Math.min(i, visible.length - 1)];

  const update = useCallback(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    if (step) setRect(measure(step.target));
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    if (step) element(step.target)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    update();
    const t = window.setTimeout(update, 350);
    return () => window.clearTimeout(t);
  }, [open, step, update]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", update);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, visible.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, update, onClose, visible.length]);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  if (!open || !step) return null;
  const last = i >= visible.length - 1;

  // Place the card beside the spotlight where there is room: right, left, below, above.
  const CW = 340;
  const CH = 190;
  let cx = 16;
  let cy = 16;
  if (rect) {
    if (rect.x + rect.w + CW + 24 < vp.w) {
      cx = rect.x + rect.w + 16;
      cy = Math.min(Math.max(16, rect.y + 24), vp.h - CH - 16);
    } else if (rect.x - CW - 24 > 0) {
      cx = rect.x - CW - 16;
      cy = Math.min(Math.max(16, rect.y + 24), vp.h - CH - 16);
    } else if (rect.y + rect.h + CH + 24 < vp.h) {
      cx = Math.min(Math.max(16, rect.x + 16), vp.w - CW - 16);
      cy = rect.y + rect.h + 14;
    } else {
      cx = Math.min(Math.max(16, rect.x + 16), vp.w - CW - 16);
      cy = Math.max(16, rect.y - CH - 14);
    }
    // a region filling most of the screen: float the card inside it
    if (rect.w > vp.w * 0.7 && rect.h > vp.h * 0.6) {
      cx = rect.x + 28;
      cy = rect.y + rect.h - CH - 28;
    }
  }

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Studio tour">
        <svg className="absolute inset-0 h-full w-full" onClick={onClose}>
          <defs>
            <mask id="tour-cut">
              <rect width="100%" height="100%" fill="white" />
              {rect && (
                <motion.rect
                  rx={12}
                  fill="black"
                  initial={false}
                  animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }}
                  transition={{ duration: 0.5, ease: EASE }}
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgb(10 10 9 / 0.58)" mask="url(#tour-cut)" />
          {rect && (
            <motion.rect
              rx={12}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              initial={false}
              animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }}
              transition={{ duration: 0.5, ease: EASE }}
            />
          )}
        </svg>

        <motion.div
          key={step.target}
          className="absolute w-[340px] max-w-[calc(100vw-32px)] rounded-xl border border-line bg-surface p-5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.5)]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, left: cx, top: cy }}
          transition={{ duration: 0.45, ease: EASE }}
          style={{ left: cx, top: cy }}
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">
              {i + 1} / {visible.length}
            </span>
            <button onClick={onClose} className="text-[12px] text-faint hover:text-text">
              Skip
            </button>
          </div>
          <h3 className="display mt-3 text-[24px] leading-tight">{step.title}</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{step.body}</p>
          <div className="mt-5 flex items-center justify-between">
            <div className="flex gap-1">
              {visible.map((s, j) => (
                <span key={s.target} className={`h-1 rounded-full transition-all ${j === i ? "w-5 bg-accent" : "w-2 bg-line-strong"}`} />
              ))}
            </div>
            <div className="flex gap-2">
              {i > 0 && (
                <button onClick={() => setI(i - 1)} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] text-muted hover:text-text">
                  Back
                </button>
              )}
              <button
                onClick={() => (last ? onClose() : setI(i + 1))}
                className="rounded-md bg-text px-3.5 py-1.5 text-[12.5px] font-medium text-bg active:scale-[0.98]"
              >
                {last ? "Start exploring" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
