"use client";

import { CheckCircle, DownloadSimple, Eye, EyeSlash, Key, ShieldCheck, Trash, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { api, type Provider } from "@/lib/api";
import { DEFAULT_MODEL, getModel, modelHeaders, setModel, type ModelPref } from "@/lib/prefs";
import { Field, inputCls, Sheet } from "./Sheet";

type Test = { state: "idle" | "busy" | "ok" | "fail"; text?: string };

export function SettingsSheet({
  open,
  onClose,
  ws,
  title,
  minOrigins,
  owned,
  onChanged,
  onImported,
  onDeleted,
  flash,
}: {
  open: boolean;
  onClose: () => void;
  ws: string | null;
  title: string;
  minOrigins: number;
  owned: boolean;
  onChanged: () => void;
  onImported: (ws: string, title: string) => void;
  onDeleted: () => void;
  flash: (m: string) => void;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [def, setDef] = useState<{ model: string; available: boolean } | null>(null);
  const [m, setM] = useState<ModelPref>(DEFAULT_MODEL);
  const [show, setShow] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [test, setTest] = useState<Test>({ state: "idle" });
  const [name, setName] = useState(title);
  const [policy, setPolicy] = useState(minOrigins);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setM(getModel());
    setName(title);
    setPolicy(minOrigins);
    setTest({ state: "idle" });
    api.providers().then((r) => {
      setProviders(r.providers);
      setDef(r.default);
    }).catch(() => undefined);
  }, [open, title, minOrigins]);

  const p = providers.find((x) => x.id === m.provider);
  const update = (patch: Partial<ModelPref>) => {
    setM((cur) => ({ ...cur, ...patch }));
    setTest({ state: "idle" });
  };
  const pick = (id: string) => {
    const np = providers.find((x) => x.id === id);
    setModels([]);
    update({ provider: id, model: np?.models[0] ?? "", base: "" });
  };

  const runTest = async () => {
    setTest({ state: "busy" });
    try {
      const r = await api.testModel(modelHeaders(m));
      setTest(r.ok ? { state: "ok", text: `${r.model} answered in ${r.ms} ms` } : { state: "fail", text: r.error });
    } catch (e) {
      setTest({ state: "fail", text: (e as Error).message });
    }
  };
  const fetchModels = async () => {
    try {
      const r = await api.listModels(modelHeaders(m));
      setModels(r.models);
      if (!m.model && r.models[0]) update({ model: r.models[0] });
    } catch (e) {
      setTest({ state: "fail", text: (e as Error).message });
    }
  };
  const save = () => {
    setModel(m.provider === "echo" ? DEFAULT_MODEL : m);
    flash(m.provider === "echo" ? "Using Echo's default model." : `Agent now runs on ${m.model} (${p?.label}). Your key stays in this browser.`);
  };

  const savePolicy = async () => {
    if (!ws) return;
    setBusy(true);
    try {
      const r = await api.updateSettings(ws, { min_origins: policy });
      const moved = (r.rescored ?? []).filter((x) => x.before.status !== x.after.status).length;
      flash(`Policy set to ${policy} independent ${policy === 1 ? "origin" : "origins"}. ${r.rescored?.length ?? 0} beliefs rescored in ${r.ms} ms, ${moved} changed.`);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const rename = async () => {
    if (!ws || !name.trim()) return;
    await api.updateSettings(ws, { title: name.trim() });
    flash("Memory renamed.");
    onChanged();
  };
  const exportIt = async () => {
    if (!ws) return;
    const data = await api.exportMemory(ws);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(title || ws).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.echo.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importIt = async (f: File) => {
    setBusy(true);
    try {
      const data = JSON.parse(await f.text());
      const r = await api.importMemory({ ...data, title: data.title ?? f.name.replace(/\.echo\.json$|\.json$/, "") });
      onImported(r.workspace, data.title ?? "Imported memory");
      flash(`Imported ${data.sources?.length ?? 0} sources into a new memory.`);
      onClose();
    } catch (e) {
      flash(`Could not import: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!ws || !confirm(`Delete “${title}”? This removes its graph from the server.`)) return;
    await api.deleteMemory(ws);
    onDeleted();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Settings" eyebrow="Studio">
      {/* ---------------------------------------------------------------- model */}
      <section>
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          <Key size={15} className="text-accent" /> Model
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          The agent and claim extraction run on any OpenAI-compatible model. The free default needs nothing; bring your own key
          for your provider of choice. Keys stay in this browser and are sent only with your requests, never stored on the server.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {[{ id: "echo", label: "Echo default" }, ...providers].map((x) => (
            <button
              key={x.id}
              onClick={() => pick(x.id)}
              className={`rounded-md border px-2.5 py-2 text-left text-[12px] transition-colors ${
                m.provider === x.id ? "border-accent bg-accent-soft text-text" : "border-line text-muted hover:border-line-strong hover:text-text"
              }`}
            >
              {x.id === "custom" ? "Custom endpoint" : x.label}
              {x.id === "echo" && <span className="block font-mono text-[10px] text-faint">free · {def?.model ?? "Groq"}</span>}
            </button>
          ))}
        </div>

        {m.provider !== "echo" && (
          <div className="mt-5 space-y-4">
            {m.provider === "custom" && (
              <Field label="Base URL" hint="Any https endpoint that speaks the OpenAI chat-completions API (vLLM, LM Studio behind a tunnel, Fireworks, Mistral…).">
                <input className={`${inputCls} font-mono`} value={m.base} onChange={(e) => update({ base: e.target.value })} placeholder="https://api.example.com/v1" />
              </Field>
            )}
            <Field
              label="API key"
              hint={p?.keys ? <>Get one at <a className="underline underline-offset-2 hover:text-text" href={p.keys} target="_blank" rel="noreferrer">{p.keys.replace(/^https:\/\//, "")}</a></> : undefined}
            >
              <div className="relative">
                <input
                  className={`${inputCls} pr-9 font-mono`}
                  type={show ? "text" : "password"}
                  autoComplete="off"
                  value={m.key}
                  onChange={(e) => update({ key: e.target.value })}
                  placeholder="Paste your key"
                />
                <button onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-text" aria-label={show ? "Hide key" : "Show key"}>
                  {show ? <EyeSlash size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
            <Field label="Model" hint={m.provider === "anthropic" ? "Uses Anthropic's OpenAI-compatible endpoint." : undefined}>
              <div className="flex gap-2">
                <input className={`${inputCls} font-mono`} list="echo-models" value={m.model} onChange={(e) => update({ model: e.target.value })} placeholder="model id" />
                <datalist id="echo-models">
                  {[...(p?.models ?? []), ...models].map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
                <button onClick={fetchModels} disabled={!m.key} className="shrink-0 rounded-md border border-line-strong px-3 text-[12px] text-muted hover:text-text disabled:opacity-40">
                  List models
                </button>
              </div>
            </Field>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          <button onClick={save} className="rounded-md bg-text px-4 py-2 text-[12.5px] font-medium text-bg active:scale-[0.98]">
            Save model
          </button>
          {m.provider !== "echo" && (
            <button onClick={runTest} disabled={test.state === "busy" || !m.key} className="rounded-md border border-line-strong px-4 py-2 text-[12.5px] text-text hover:bg-surface-2 disabled:opacity-40">
              {test.state === "busy" ? "Testing…" : "Test connection"}
            </button>
          )}
        </div>
        {test.state === "ok" && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ok">
            <CheckCircle size={14} /> {test.text}
          </p>
        )}
        {test.state === "fail" && (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] text-bad">
            <WarningCircle size={14} className="mt-px shrink-0" /> <span className="break-all">{test.text}</span>
          </p>
        )}
      </section>

      {/* ---------------------------------------------------------------- policy */}
      <section className="mt-9 border-t border-line pt-7">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          <ShieldCheck size={15} className="text-accent" /> Trust policy
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          How many independent origins this memory needs before it calls a belief verified. Stricter for clinical or legal work,
          looser for exploration. Every belief is rescored when you change it.
        </p>
        <div className="mt-4 flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setPolicy(n)}
              className={`grid size-10 place-items-center rounded-md border font-mono text-[14px] ${policy === n ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-text"}`}
            >
              {n}
            </button>
          ))}
          <span className="ml-2 text-[12px] text-faint">{policy === 1 ? "one origin is enough" : `${policy} independent origins`}</span>
        </div>
        <button onClick={savePolicy} disabled={busy || !ws || policy === minOrigins} className="mt-4 rounded-md bg-text px-4 py-2 text-[12.5px] font-medium text-bg disabled:opacity-40">
          Apply and rescore
        </button>
      </section>

      {/* ---------------------------------------------------------------- memory */}
      <section className="mt-9 border-t border-line pt-7">
        <h3 className="text-[14px] font-semibold">This memory</h3>
        {owned && (
          <div className="mt-4 flex gap-2">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-label="Memory name" />
            <button onClick={rename} className="shrink-0 rounded-md border border-line-strong px-3 text-[12px] text-text hover:bg-surface-2">
              Rename
            </button>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={exportIt} disabled={!ws} className="flex items-center justify-center gap-1.5 rounded-md border border-line-strong py-2 text-[12.5px] text-text hover:bg-surface-2">
            <DownloadSimple size={14} /> Export JSON
          </button>
          <button onClick={() => file.current?.click()} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-md border border-line-strong py-2 text-[12.5px] text-text hover:bg-surface-2">
            <UploadSimple size={14} /> Import JSON
          </button>
          <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importIt(e.target.files[0])} />
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
          The hosted demo keeps memories you build for 30 days. Export to keep one for good, or self-host Echo in one container.
        </p>
        {owned && (
          <button onClick={del} className="mt-4 flex items-center gap-1.5 text-[12px] text-bad hover:underline">
            <Trash size={13} /> Delete this memory
          </button>
        )}
      </section>
    </Sheet>
  );
}
