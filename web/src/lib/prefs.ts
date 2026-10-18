/*
 * Per-browser preferences: the model to use and the memories you own.
 * API keys live only here (localStorage) and travel only with your own requests, in headers the API
 * uses for that one request. The Echo server never stores them.
 */

export type ModelPref = { provider: string; model: string; key: string; base: string };
export type OwnMemory = { ws: string; title: string; created: number };

const MODEL_KEY = "echo.model";
const MEMS_KEY = "echo.memories";
const ACTIVE_KEY = "echo.ws.blank";

function read<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

export const DEFAULT_MODEL: ModelPref = { provider: "echo", model: "", key: "", base: "" };
export const getModel = (): ModelPref => ({ ...DEFAULT_MODEL, ...read<Partial<ModelPref>>(MODEL_KEY, {}) });
export const setModel = (m: ModelPref) => {
  write(MODEL_KEY, m);
  window.dispatchEvent(new Event("echo:model"));
};

/** Headers that carry the visitor's model choice (none for the free default). */
export function modelHeaders(m: ModelPref = getModel()): Record<string, string> {
  if (!m.provider || m.provider === "echo") return {};
  const h: Record<string, string> = { "x-echo-llm-provider": m.provider };
  if (m.model) h["x-echo-llm-model"] = m.model;
  if (m.key) h["x-echo-llm-key"] = m.key;
  if (m.base) h["x-echo-llm-base"] = m.base;
  return h;
}

export const getMemories = (): OwnMemory[] => read<OwnMemory[]>(MEMS_KEY, []);
export const setMemories = (m: OwnMemory[]) => write(MEMS_KEY, m);
export function rememberMemory(ws: string, title: string) {
  const all = getMemories().filter((m) => m.ws !== ws);
  setMemories([{ ws, title, created: Date.now() }, ...all].slice(0, 30));
}
export const activeMemory = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
};
export const setActiveMemory = (ws: string) => {
  try {
    localStorage.setItem(ACTIVE_KEY, ws);
  } catch {}
};
