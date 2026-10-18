"use client";

import { Play } from "@phosphor-icons/react";
import { useState } from "react";
import { api, type Rescore } from "@/lib/api";
import { EXAMPLES, loadExamples } from "@/lib/examples";
import { StatusPill } from "./Inspector";

type IngestResult = Awaited<ReturnType<typeof api.ingest>>;

export function IngestPanel({
  ws,
  onDone,
  onExamples,
}: {
  ws: string;
  onDone: (r: IngestResult) => void;
  onExamples?: () => void;
}) {
  const [mode, setMode] = useState<"url" | "text" | "file">("url");
  const [progress, setProgress] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<IngestResult | null>(null);
  const [exStep, setExStep] = useState<number | null>(null);

  const examples = async () => {
    setErr(null);
    setRes(null);
    try {
      await loadExamples(ws, setExStep);
      onExamples?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setExStep(null);
    }
  };

  // Several URLs (one per line) are read in order, so later copies link back to earlier originals.
  const urls = url
    .split(/\s+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  const go = async () => {
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      if (mode === "url" && urls.length > 1) {
        const failed: string[] = [];
        let last: IngestResult | null = null;
        for (let i = 0; i < urls.length; i++) {
          setProgress(`Reading ${i + 1} of ${urls.length}: ${urls[i].replace(/^https?:\/\//, "").slice(0, 40)}`);
          try {
            last = await api.ingest(ws, { url: urls[i] });
            onDone(last);
          } catch {
            failed.push(urls[i]);
          }
        }
        if (last) setRes(last);
        if (failed.length) setErr(`Could not read ${failed.length} of ${urls.length}: ${failed.join(", ")}`);
        return;
      }
      const r = await api.ingest(ws, mode === "url" ? { url: urls[0] ?? url } : { text, title, url: url || undefined });
      setRes(r);
      onDone(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const files = async (list: FileList | File[]) => {
    const arr = [...list].filter((f) => /\.(pdf|md|markdown|txt|html?)$/i.test(f.name));
    if (!arr.length) {
      setErr("Drop .pdf, .md, .txt or .html files.");
      return;
    }
    setBusy(true);
    setErr(null);
    setRes(null);
    const failed: string[] = [];
    try {
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i];
        setProgress(`Reading ${f.name} (${i + 1} of ${arr.length})`);
        if (f.size > 8_000_000) {
          failed.push(`${f.name} (over 8 MB)`);
          continue;
        }
        const buf = new Uint8Array(await f.arrayBuffer());
        let bin = "";
        for (let j = 0; j < buf.length; j += 0x8000) bin += String.fromCharCode(...buf.subarray(j, j + 0x8000));
        try {
          const r = await api.ingestFile(ws, f.name, btoa(bin));
          setRes(r);
          onDone(r);
        } catch (e) {
          failed.push(`${f.name} (${(e as Error).message})`);
        }
      }
      if (failed.length) setErr(`Skipped: ${failed.join("; ")}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="scrollbar-thin h-full space-y-4 overflow-y-auto p-4">
      <div>
        <h2 className="display text-[24px] leading-tight">Add a source</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Echo extracts the claims, matches them to beliefs already in memory, and infers lineage against every stored source.
        </p>
      </div>
      <div className="rounded-xl border border-line bg-surface p-3.5">
        <div className="text-[13px] font-medium text-text">Try it with three example pages</div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          A lab test, a news site that reuses its figures, and an independent lab. Watch Echo fold the copy into its origin.
        </p>
        <button
          onClick={examples}
          disabled={exStep !== null || busy}
          className="mt-3 w-full rounded-md border border-line-strong py-2 text-[12.5px] font-medium text-text transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {exStep !== null ? `Reading ${EXAMPLES[exStep].author}… (${exStep + 1}/${EXAMPLES.length})` : "Load the examples"}
        </button>
      </div>
      <div className="flex gap-1 rounded-lg bg-surface-2 p-1 text-[12px]">
        {(["url", "file", "text"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-md py-1.5 ${mode === m ? "bg-surface text-text shadow-card" : "text-faint hover:text-muted"}`}>
            {m === "url" ? "URLs" : m === "file" ? "Files" : "Paste text"}
          </button>
        ))}
      </div>
      {mode === "text" && (
        <div className="space-y-1.5">
          <label htmlFor="ing-title" className="text-[12px] text-muted">Title</label>
          <input id="ing-title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] text-text focus:border-accent/60 focus:outline-none" />
        </div>
      )}
      {mode === "file" && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            files(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center transition-colors ${
            drag ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-surface-2"
          }`}
        >
          <span className="text-[13px] font-medium text-text">Drop files, or click to choose</span>
          <span className="mt-1 text-[11.5px] text-faint">PDF, Markdown, text or HTML · up to 8 MB each</span>
          <input type="file" multiple accept=".pdf,.md,.markdown,.txt,.html,.htm" className="hidden" onChange={(e) => e.target.files && files(e.target.files)} />
        </label>
      )}
      {mode !== "file" && (
        <div className="space-y-1.5">
          <label htmlFor="ing-url" className="text-[12px] text-muted">{mode === "url" ? "Page URLs, one per line" : "URL (optional)"}</label>
          {mode === "url" ? (
            <textarea
              id="ing-url"
              rows={4}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={"https://example.com/original-report\nhttps://news.example/rewrite"}
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono text-[12px] leading-relaxed text-text placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
          ) : (
            <input
              id="ing-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono text-[12.5px] text-text placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
          )}
        </div>
      )}
      {mode === "text" && (
        <div className="space-y-1.5">
          <label htmlFor="ing-text" className="text-[12px] text-muted">Text</label>
          <textarea id="ing-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] text-text focus:border-accent/60 focus:outline-none" />
        </div>
      )}
      {mode !== "file" && <button
        disabled={busy || (mode === "url" ? !urls.length : !text)}
        onClick={go}
        className="w-full rounded-md bg-text py-2.5 text-[13px] font-medium text-bg transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "Reading and linking…" : mode === "url" && urls.length > 1 ? `Add ${urls.length} pages` : "Ingest into memory"}
      </button>}
      {progress && <p className="font-mono text-[11.5px] text-muted">{progress}</p>}
      {err && <p className="text-[12.5px] text-bad">{err}</p>}
      {res && (
        <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5 text-[12.5px]">
          <div className="text-muted">
            {res.claims.length} {res.claims.length === 1 ? "claim" : "claims"} via {res.extraction === "llm" ? "the LLM" : "the offline extractor"},{" "}
            {res.edges.length} lineage {res.edges.length === 1 ? "edge" : "edges"}
          </div>
          {res.edges.length > 0 && (
            <ul className="space-y-1 font-mono text-[11px] text-faint">
              {res.edges.slice(0, 8).map((e, i) => (
                <li key={i} className="truncate">
                  <span className="text-accent">{e.rel}</span> ({e.method}) → {e.dst}
                </li>
              ))}
            </ul>
          )}
          {res.rescored.map((r: Rescore) => (
            <div key={r.belief} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-text">{r.statement}</span>
              <StatusPill status={r.after.status} small />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SAMPLES = [
  {
    label: "Echoes",
    q: "MATCH (b:Belief) WHERE b.sources > b.origins\nRETURN b.statement AS belief, b.sources AS sources, b.origins AS origins\nORDER BY b.sources DESC",
  },
  {
    label: "Copy chains",
    q: "MATCH p=(s:Source)-[:CITES|COPIED_FROM*1..4]->(o:Source)\nWHERE NOT (o)-[:CITES|COPIED_FROM]->()\nRETURN s.title AS source, length(p) AS hops, o.title AS origin\nORDER BY hops DESC LIMIT 15",
  },
  {
    label: "Shared fingerprints",
    q: "MATCH (s:Source)-[:PUBLISHED_BY]->(w:Owner {kind:'network'})\nRETURN w.name AS fingerprint, collect(s.title) AS sites",
  },
  {
    label: "PageRank",
    q: "CALL algo.pageRank('Source', null) YIELD node, score\nRETURN node.title AS source, round(score * 1000) / 1000 AS rank\nORDER BY rank DESC LIMIT 8",
  },
];

export function CypherConsole({ ws }: { ws: string }) {
  const [q, setQ] = useState(SAMPLES[0].q);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.cypher(ws, q);
      setRows(r.rows);
      setMs(r.cypher[0]?.ms ?? null);
    } catch (e) {
      setErr((e as Error).message);
      setRows(null);
    } finally {
      setBusy(false);
    }
  };
  const cols = rows?.length ? Object.keys(rows[0]) : [];
  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <h2 className="display text-[24px] leading-tight">Query the memory</h2>
      <p className="mt-1 text-[12.5px] text-muted">Read-only Cypher against this workspace's FalkorDB graph. Writes are rejected.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SAMPLES.map((s) => (
          <button key={s.label} onClick={() => setQ(s.q)} className="rounded-full border border-line px-2.5 py-1 text-[11.5px] text-muted hover:border-accent/50 hover:text-text">
            {s.label}
          </button>
        ))}
      </div>
      <label htmlFor="cy" className="sr-only">Cypher query</label>
      <textarea
        id="cy"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        spellCheck={false}
        rows={6}
        className="mt-3 w-full rounded-xl border border-line-strong bg-surface p-3 font-mono text-[12px] leading-relaxed text-text focus:border-accent/60 focus:outline-none"
      />
      <button onClick={run} disabled={busy} className="mt-2 flex items-center justify-center gap-1.5 rounded-md bg-text py-2 text-[13px] font-medium text-bg active:scale-[0.98] disabled:opacity-50">
        <Play size={13} weight="fill" /> Run
      </button>
      {err && <p className="mt-3 font-mono text-[11.5px] text-bad">{err}</p>}
      {rows && (
        <div className="scrollbar-thin mt-3 min-h-0 flex-1 overflow-auto rounded-xl border border-line">
          <div className="border-b border-line px-3 py-1.5 font-mono text-[10.5px] text-faint">
            {rows.length} rows{ms != null && ` · ${ms} ms`}
          </div>
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="text-faint">
              <tr>{cols.map((c) => <th key={c} className="px-3 py-1.5 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line align-top text-muted">
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-1.5">
                      {typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
