"use client";

import { X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

/** A right-hand slide-over panel. Esc or the backdrop closes it. */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[rgb(10_10_9/0.35)] backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute inset-y-0 right-0 flex max-w-full flex-col border-l border-line bg-surface shadow-[0_0_80px_-20px_rgb(0_0_0/0.4)]"
            style={{ width }}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between border-b border-line px-6 py-5">
              <div>
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                <h2 className="display mt-2 text-[28px] leading-none">{title}</h2>
              </div>
              <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-text">
                <X size={16} />
              </button>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-text">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1.5 block text-[11.5px] leading-relaxed text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-[13px] text-text placeholder:text-faint focus:border-accent/60 focus:outline-none";
