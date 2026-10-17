"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, CaretDown, Prohibit, ArrowCounterClockwise } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { STATUS_META, type Report, type Rescore, type SourceDetail, type Status } from "@/lib/api";
import { CypherBlock } from "../CypherBlock";

export function StatusPill({ status, small }: { status: Status | null; small?: boolean }) {
  if (!status) return null;
  const m = STATUS_META[status];
  return (
    <span
      title={m.hint}
      className={`inline-flex items-center rounded-full border font-medium ${small ? "px-1.5 py-[1px] text-[10.5px]" : "px-2.5 py-0.5 text-[12px]"}`}
      style={{ color: m.color, borderColor: `color-mix(in srgb, ${m.color} 40%, transparent)`, background: `color-mix(in srgb, ${m.color} 10%, transparent)` }}
    >
      {m.label}
    </span>
  );
}

const REL_LABEL: Record<string, string> = { CITES: "cites", COPIED_FROM: "copied from", DERIVED_FROM: "derived from" };

function humanReason(r: string, title: (id: string) => string) {
  if (!r || r === "independent") return r === "independent" ? "No shared ancestor or owner with any other source." : "";
  const anc = new Set<string>();
  const own = new Set<string>();
  for (const part of r.split("; ")) {
    const m = part.match(/^(shared ancestor|same owner) (.*)$/);
    if (!m) continue;
    for (const x of m[2].split(", ")) (m[1] === "same owner" ? own : anc).add(m[1] === "same owner" ? x.replace(/^[a-z]+:/, "") : title(x));
  }
  const out = [];
  if (anc.size) out.push(`They trace back to ${[...anc].slice(0, 3).join(", ")}.`);
  if (own.size) out.push(`Same owner or fingerprint: ${[...own].slice(0, 3).join(", ")}.`);
  return out.join(" ");
}

export function BeliefInspector({
  report,
  onSelectSource,
  onBack,
}: {
  report: Report;
  onSelectSource: (id: string) => void;
  onBack: () => void;
}) {
  const v = report.verdict;
  const [showCypher, setShowCypher] = useState(false);
  const title = (id: string) => report.sources[id]?.title || id;
  const sup = v.clusters.filter((c) => c.stance === "supports");
  const con = v.clusters.filter((c) => c.stance === "contradicts");
  return (
    <div className="space-y-6 p-5">
      <button onClick={onBack} className="flex items-center gap-1 text-[12px] text-faint hover:text-text">
        <ArrowLeft size={12} /> All beliefs
      </button>
      <div>
        <div className="flex items-center gap-2">
          <StatusPill status={v.status} />
          {report.subject && <span className="font-mono text-[11px] text-faint">{report.subject}</span>}
        </div>
        <h2 className="mt-3 font-display text-[19px] font-medium leading-snug tracking-tight">{report.statement}</h2>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-line bg-surface p-4">
        <div>
          <div className="font-display text-4xl font-semibold tabular-nums text-muted">{v.sources}</div>
          <div className="text-[11.5px] text-faint">{v.sources === 1 ? "source says it" : "sources say it"}</div>
        </div>
        <ArrowRight size={18} className="text-faint" />
        <div>
          <div className="font-display text-4xl font-semibold tabular-nums" style={{ color: v.origins > 1 ? "var(--ok)" : "var(--accent)" }}>
            {v.origins}
          </div>
          <div className="text-[11.5px] text-faint">independent {v.origins === 1 ? "origin" : "origins"}</div>
        </div>
        <div className="col-span-3 mt-1 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3 text-[12px]">
          <span className="text-muted">
            Echo confidence <span className="font-mono text-text">{Math.round(v.confidence * 100)}%</span>
            {v.against_origins > 0 && <span className="text-bad"> · {v.against_origins} against</span>}
          </span>
          <span className="text-faint">
            Plain memory: <span className="font-mono">{v.plain_status}</span> ({Math.round(v.plain_confidence * 100)}%)
          </span>
        </div>
      </div>

      {[
        { label: "Supporting origins", list: sup },
        { label: "Contradicting origins", list: con },
      ].map(
        (g) =>
          g.list.length > 0 && (
            <section key={g.label}>
              <h3 className="text-[12px] font-semibold text-muted">{g.label}</h3>
              <div className="mt-2.5 space-y-2.5">
                {g.list.map((c, i) => (
                  <div key={i} className={`rounded-xl border p-3.5 ${c.weight > 0 ? "border-line bg-surface" : "border-dashed border-line opacity-70"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-medium text-faint">
                          {c.weight > 0
                            ? c.roots.length > 1
                              ? "Origin: a citation loop, counted once"
                              : "Origin"
                            : c.dead_roots.length
                              ? "Origin retracted"
                              : "No evidential weight"}
                        </div>
                        {(c.roots.length ? c.roots : c.dead_roots).map((r) => (
                          <button key={r} onClick={() => onSelectSource(r)} className="mt-0.5 block w-full truncate text-left text-[13px] font-medium text-accent hover:underline">
                            {title(r)}
                          </button>
                        ))}
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-faint">w {c.weight.toFixed(2)}</span>
                    </div>
                    {c.members.length > 1 && (
                      <>
                        <div className="mt-3 text-[10.5px] font-medium text-faint">{c.members.length} sources collapse into it</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.members.map((m) => (
                            <button
                              key={m}
                              onClick={() => onSelectSource(m)}
                              className={`max-w-full truncate rounded-md border border-line px-1.5 py-0.5 font-mono text-[10.5px] hover:border-accent hover:text-accent ${report.sources[m]?.retracted ? "text-gone line-through" : "text-muted"}`}
                            >
                              {title(m)}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-[11.5px] leading-snug text-faint">{humanReason(c.reason, title)}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ),
      )}

      {report.paths.length > 0 && (
        <section>
          <h3 className="text-[12px] font-semibold text-muted">How the copies trace back</h3>
          <ol className="mt-2.5 space-y-3">
            {report.paths.map((p, i) => (
              <li key={i} className="text-[12px]">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  {p.nodes.map((n, j) => (
                    <span key={j} className="flex items-center gap-1.5">
                      {j > 0 && (
                        <span className="font-mono text-[10.5px] text-accent">
                          {REL_LABEL[p.hops[j - 1]?.type] ?? p.hops[j - 1]?.type} ({p.hops[j - 1]?.method})
                        </span>
                      )}
                      <button onClick={() => onSelectSource(n)} className="text-text hover:text-accent">
                        {title(n).length > 30 ? title(n).slice(0, 29) + "…" : title(n)}
                      </button>
                    </span>
                  ))}
                </div>
                {p.hops[0]?.evidence && <div className="mt-1 text-[11px] leading-snug text-faint">{p.hops.map((h) => h.evidence).join(" · ")}</div>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <button onClick={() => setShowCypher((s) => !s)} className="flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-text">
          <CaretDown size={11} className={showCypher ? "rotate-180" : ""} /> Cypher behind this verdict ({report.cypher.length})
        </button>
        {showCypher && (
          <div className="mt-2.5 space-y-2">
            {report.cypher.map((c, i) => (
              <div key={i}>
                <div className="mb-1 font-mono text-[10.5px] text-faint">
                  {c.ms} ms · {c.rows} rows
                </div>
                <CypherBlock code={c.cypher.replace(/ (MATCH|OPTIONAL MATCH|WITH|RETURN|WHERE|CALL)\b/g, "\n$1")} compact />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function SourceInspector({
  source,
  onBack,
  onRetract,
  busy,
  lastRescore,
  supports,
  onSelectBelief,
}: {
  source: SourceDetail;
  onBack: () => void;
  onRetract: (restore: boolean) => void;
  busy: boolean;
  lastRescore: { source: string; ms: number; rescored: Rescore[] } | null;
  supports: { id: string; name: string; type: string }[];
  onSelectBelief: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const diff = lastRescore?.source === source.id ? lastRescore : null;
  const canRetract = source.kind !== "stub" && source.kind !== "ident";
  return (
    <div className="space-y-6 p-5">
      <button onClick={onBack} className="flex items-center gap-1 text-[12px] text-faint hover:text-text">
        <ArrowLeft size={12} /> Back
      </button>
      <div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-faint">
          <span className="rounded border border-line px-1.5 py-[1px]">{source.kind}</span>
          {source.published_at && <span>{source.published_at}</span>}
          {source.retracted && <span className="text-bad">retracted</span>}
        </div>
        <h2 className={`mt-3 font-display text-[19px] font-medium leading-snug tracking-tight ${source.retracted ? "text-gone line-through" : ""}`}>
          {source.title}
        </h2>
        {source.author && <div className="mt-1 text-[12.5px] text-muted">{source.author}</div>}
        {source.url && (
          <div className="mt-1 flex items-center gap-1 break-all font-mono text-[11px] text-faint">
            {source.url}
            <ArrowUpRight size={11} className="shrink-0" />
          </div>
        )}
      </div>

      {canRetract && (
        <button
          disabled={busy}
          onClick={() => onRetract(!!source.retracted)}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-transform active:scale-[0.98] disabled:opacity-50 ${
            source.retracted ? "border border-line-strong text-text hover:bg-surface-2" : "bg-bad text-white"
          }`}
        >
          {source.retracted ? <ArrowCounterClockwise size={15} /> : <Prohibit size={15} />}
          {source.retracted ? "Restore this source" : "Retract this source"}
        </button>
      )}

      {diff && (
        <section>
          <h3 className="text-[12px] font-semibold text-muted">
            {diff.rescored.length} {diff.rescored.length === 1 ? "belief" : "beliefs"} rescored in {diff.ms} ms
          </h3>
          <div className="mt-2.5 space-y-2">
            {diff.rescored.map((r, i) => (
              <motion.button
                key={r.belief}
                onClick={() => onSelectBelief(r.belief)}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="block w-full rounded-xl border border-line bg-surface p-3 text-left hover:border-accent/40"
              >
                <div className="text-[12.5px] leading-snug text-text">{r.statement}</div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusPill status={r.before.status} small />
                  <ArrowRight size={11} className="text-faint" />
                  <StatusPill status={r.after.status} small />
                  <span className="ml-auto font-mono text-[11px] text-faint">
                    {r.before.origins ?? 0}→{r.after.origins} origins
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {supports.length > 0 && (
        <section>
          <h3 className="text-[12px] font-semibold text-muted">Claims in this source</h3>
          <div className="mt-2 space-y-1.5">
            {supports.map((b) => (
              <button key={b.id} onClick={() => onSelectBelief(b.id)} className="flex w-full items-start gap-2 text-left text-[12.5px] leading-snug text-muted hover:text-text">
                <span className={`mt-[3px] font-mono text-[10px] ${b.type === "CONTRADICTS" ? "text-bad" : "text-ok"}`}>
                  {b.type === "CONTRADICTS" ? "against" : "for"}
                </span>
                {b.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {source.owners.length > 0 && (
        <section>
          <h3 className="text-[12px] font-semibold text-muted">Owners and fingerprints</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {source.owners.map((o) => (
              <span key={o.id} className={`rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] ${o.kind === "network" ? "border-bad/40 text-bad" : "border-line text-muted"}`}>
                {o.kind}: {o.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {source.text && (
        <section>
          <h3 className="text-[12px] font-semibold text-muted">Text</h3>
          <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-muted">{source.text}</p>
        </section>
      )}
    </div>
  );
}
