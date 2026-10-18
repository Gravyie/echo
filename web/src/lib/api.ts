export const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type Status = "VERIFIED" | "SINGLE_ORIGIN" | "CONTESTED" | "DISPUTED" | "UNSUPPORTED" | "RETRACTED";

export interface Belief {
  id: string;
  statement: string;
  subject: string | null;
  status: Status | null;
  mentions: number | null;
  sources: number | null;
  origins: number | null;
  against_origins: number | null;
  confidence: number | null;
  echo: boolean | null;
  plain_confidence: number | null;
  plain_status: string | null;
  updated_at?: string | null;
  similarity?: number;
}

export interface GraphNode {
  id: string;
  label: "Source" | "Owner" | "Belief" | "Entity" | "Agent" | "Episode";
  name: string;
  kind: string | null;
  url: string | null;
  retracted: boolean | null;
  status: Status | null;
  origins: number | null;
  sources: number | null;
  echo: boolean | null;
  published_at: string | null;
  author: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  method: string | null;
  evidence: string | null;
}

export interface Cluster {
  stance: "supports" | "contradicts";
  members: string[];
  roots: string[];
  dead_roots: string[];
  shared_owners: string[];
  weight: number;
  reason: string;
}

export interface CypherEntry {
  cypher: string;
  params: Record<string, unknown>;
  ms: number;
  rows: number;
}

export interface Report {
  id: string;
  statement: string;
  subject: string | null;
  verdict: {
    mentions: number;
    sources: number;
    origins: number;
    against_origins: number;
    confidence: number;
    status: Status;
    echo: boolean;
    echo_ratio: number | null;
    plain_confidence: number;
    plain_status: string;
    clusters: Cluster[];
  };
  sources: Record<string, { id: string; kind: string; title: string; url: string | null; retracted: boolean; owners: string[]; weight: number }>;
  quotes: { source: string; stance: string; quote: string }[];
  paths: { from: string; to: string; nodes: string[]; hops: { type: string; method: string; evidence: string }[] }[];
  cypher: CypherEntry[];
}

export interface SourceDetail {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  author: string | null;
  published_at: string | null;
  text: string | null;
  retracted: boolean | null;
  retract_reason: string | null;
  owners: { id: string; name: string; kind: string }[];
}

export interface Scenario {
  id: string;
  title: string;
  question: string;
  suggested: string[];
  retract_hint: string;
  sources: number;
}

export interface Rescore {
  belief: string;
  statement: string | null;
  before: { status: Status | null; confidence: number | null; origins: number | null };
  after: { status: Status; confidence: number; origins: number };
}

export interface Origin {
  id: string;
  title: string;
  url: string | null;
  kind: string;
  retracted: boolean | null;
  score: number;
  beliefs: number;
  dependents: number;
}

export interface WorkspaceInfo {
  workspace: string;
  meta: { scenario: string | null; title: string };
  scenario: Scenario | null;
  stats: { sources: number; beliefs: number; mentions: number; echoes: number; verified: number; lineage_edges: number };
}

export type AgentEvent =
  | { type: "start"; mode: string; llm: boolean }
  | { type: "notice"; text: string }
  | { type: "step"; tool: string; args: Record<string, unknown>; at?: number }
  | { type: "step_result"; tool: string; summary: string; highlight: { nodes?: string[]; edges?: string[][]; focus?: string }; cypher: CypherEntry[]; at?: number }
  | { type: "answer"; text: string; beliefs: string[]; episode: string; note: string | null; seconds: number }
  | { type: "error"; text: string };

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    let msg = `${r.status}`;
    try {
      const b = await r.json();
      msg = b.detail ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

export const api = {
  health: () => j<{ ok: boolean; llm: boolean; llm_model: string | null; embeddings: string }>("/api/health"),
  scenarios: () => j<Scenario[]>("/api/scenarios"),
  createWorkspace: (scenario: string | null) =>
    j<{ workspace: string }>("/api/workspaces", { method: "POST", body: JSON.stringify({ scenario }) }),
  workspace: (ws: string) => j<WorkspaceInfo>(`/api/w/${ws}`),
  reset: (ws: string) => j<{ ok: boolean }>(`/api/w/${ws}/reset`, { method: "POST" }),
  graph: (ws: string) => j<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/api/w/${ws}/graph`),
  beliefs: (ws: string) => j<Belief[]>(`/api/w/${ws}/beliefs`),
  belief: (ws: string, id: string) => j<Report>(`/api/w/${ws}/beliefs/${encodeURIComponent(id)}`),
  source: (ws: string, id: string) => j<SourceDetail>(`/api/w/${ws}/sources/${encodeURIComponent(id)}`),
  origins: (ws: string) => j<{ origins: Origin[]; cypher: CypherEntry[] }>(`/api/w/${ws}/origins`),
  rings: (ws: string) =>
    j<{ rings: { id: number; sources: string[]; titles: string[]; networks: string[] }[]; cypher: CypherEntry[] }>(`/api/w/${ws}/rings`),
  episodes: (ws: string) =>
    j<{ id: string; agent: string; question: string; answer: string; mode: string; at: string; beliefs: string[] }[]>(`/api/w/${ws}/episodes`),
  retract: (ws: string, id: string, restore = false, reason = "") =>
    j<{ rescored: Rescore[]; ms: number; cypher: CypherEntry[] }>(`/api/w/${ws}/sources/${encodeURIComponent(id)}/retract`, {
      method: "POST",
      body: JSON.stringify({ restore, reason }),
    }),
  ingest: (ws: string, body: { url?: string; text?: string; title?: string; author?: string }) =>
    j<{ source: string; edges: { rel: string; src: string; dst: string; method: string; evidence: string }[]; rescored: Rescore[]; extraction: string; claims: { statement: string; stance: string }[] }>(
      `/api/w/${ws}/ingest`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  cypher: (ws: string, cypher: string) =>
    j<{ rows: Record<string, unknown>[]; cypher: CypherEntry[] }>(`/api/w/${ws}/cypher`, { method: "POST", body: JSON.stringify({ cypher }) }),
};

/** POST /ask and stream server-sent events back. */
export async function ask(ws: string, question: string, mode: "echo" | "plain", onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  const r = await fetch(`${API}/api/w/${ws}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ question, mode }),
    signal,
  });
  if (!r.ok || !r.body) throw new Error(`ask failed: ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i).replace(/^\r?\n\r?\n/, "");
      const data = chunk
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) {
        try {
          onEvent(JSON.parse(data));
        } catch {}
      }
    }
  }
}

export const STATUS_META: Record<Status, { label: string; color: string; hint: string }> = {
  VERIFIED: { label: "Verified", color: "var(--ok)", hint: "Two or more independent origins" },
  SINGLE_ORIGIN: { label: "Single origin", color: "var(--single)", hint: "Every source traces back to one origin" },
  CONTESTED: { label: "Contested", color: "var(--contested)", hint: "Independent origins disagree" },
  DISPUTED: { label: "Disputed", color: "var(--bad)", hint: "Independent evidence outweighs support" },
  UNSUPPORTED: { label: "Unsupported", color: "var(--gone)", hint: "Only the agent's own notes support it" },
  RETRACTED: { label: "Retracted", color: "var(--gone)", hint: "Its origin was retracted" },
};
