"use client";

import { Prohibit } from "@phosphor-icons/react";
import { useState } from "react";
import type { Belief, Origin } from "@/lib/api";
import { StatusPill } from "./Inspector";

type Tab = "beliefs" | "origins" | "rings";

export function Overview({
  beliefs,
  origins,
  rings,
  onSelectBelief,
  onSelectSource,
  onRetract,
  loading,
}: {
  beliefs: Belief[];
  origins: Origin[];
  rings: { id: number; sources: string[]; titles: string[]; networks: string[] }[];
  onSelectBelief: (id: string) => void;
  onSelectSource: (id: string) => void;
  onRetract: (id: string) => void;
  loading: boolean;
}) {
  const [tab, setTab] = useState<Tab>("beliefs");
  const sorted = [...beliefs].sort((a, b) => (b.sources ?? 0) - (b.origins ?? 0) - ((a.sources ?? 0) - (a.origins ?? 0)) || (b.sources ?? 0) - (a.sources ?? 0));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-1 border-b border-line px-3 pt-3">
        {(
          [
            ["beliefs", `Beliefs ${beliefs.length || ""}`],
            ["origins", "Load-bearing"],
            ["rings", `Rings ${rings.length || ""}`],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-2.5 pb-2.5 text-[12.5px] font-medium transition-colors ${tab === k ? "border-accent text-text" : "border-transparent text-faint hover:text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-[68px] rounded-xl" />
            ))}
          </div>
        )}
        {!loading && tab === "beliefs" && (
          <>
            {sorted.length === 0 && (
              <div className="rounded-xl border border-dashed border-line p-6 text-center text-[13px] text-muted">
                Memory is empty. Add a source from the left panel and Echo will extract its claims and lineage.
              </div>
            )}
            <ul className="space-y-2">
              {sorted.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => onSelectBelief(b.id)}
                    className="w-full rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] leading-snug text-text">{b.statement}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusPill status={b.status} small />
                          <span className="truncate font-mono text-[10.5px] text-faint">plain: {b.plain_status}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-[15px] tabular-nums">
                          <span className="text-muted">{b.sources ?? 0}</span>
                          <span className="text-faint">→</span>
                          <span className={(b.origins ?? 0) >= 2 ? "text-ok" : "text-accent"}>{b.origins ?? 0}</span>
                        </div>
                        <div className="text-[10px] text-faint">src → origin</div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {!loading && tab === "origins" && (
          <>
            <p className="mb-3 px-1 text-[11.5px] leading-relaxed text-faint">
              PageRank over the lineage graph. Blast radius is how many beliefs lean on the origin.
            </p>
            <ul className="space-y-2">
              {origins.map((o) => (
                <li key={o.id} className="rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-start gap-3">
                    <button onClick={() => onSelectSource(o.id)} className="min-w-0 flex-1 text-left">
                      <div className={`truncate text-[12.5px] font-medium ${o.retracted ? "text-gone line-through" : "text-text"}`}>{o.title}</div>
                      <div className="mt-1 font-mono text-[10.5px] text-faint">
                        rank {o.score.toFixed(3)} · {o.dependents} dependents
                      </div>
                    </button>
                    <div className="text-right">
                      <div className="font-mono text-[15px] text-accent">{o.beliefs}</div>
                      <div className="text-[10px] text-faint">beliefs</div>
                    </div>
                  </div>
                  {!o.retracted && o.kind !== "ident" && o.kind !== "stub" && (
                    <button
                      onClick={() => onRetract(o.id)}
                      className="mt-2.5 flex items-center gap-1 text-[11.5px] text-faint hover:text-bad"
                    >
                      <Prohibit size={12} /> Retract and rescore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {!loading && tab === "rings" && (
          <>
            <p className="mb-3 px-1 text-[11.5px] leading-relaxed text-faint">
              Label propagation over copies and shared fingerprints (affiliate tags, analytics IDs) finds sites that move together.
            </p>
            {rings.length === 0 && <div className="px-1 text-[12.5px] text-muted">No coordinated groups of three or more sites found.</div>}
            {rings.map((r) => (
              <div key={r.id} className="mb-2 rounded-xl border border-bad/30 bg-bad/5 p-3.5">
                <div className="text-[12.5px] font-medium text-text">{r.sources.length} sites move together</div>
                <div className="mt-2 space-y-1">
                  {r.sources.map((s, i) => (
                    <button key={s} onClick={() => onSelectSource(s)} className="block truncate text-left text-[12px] text-muted hover:text-text">
                      {r.titles[i]}
                    </button>
                  ))}
                </div>
                {r.networks.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {r.networks.map((n) => (
                      <span key={n} className="rounded-md border border-bad/40 px-1.5 py-0.5 font-mono text-[10.5px] text-bad">
                        {n.replace(/^net:/, "")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
