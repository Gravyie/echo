"use client";

import { ArrowSquareOut, Check, Copy } from "@phosphor-icons/react";
import { useState } from "react";
import { API } from "@/lib/api";
import { Sheet } from "./Sheet";

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="ink overflow-hidden rounded-lg border border-line">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[10.5px] text-faint">{label ?? "shell"}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setOk(true);
            setTimeout(() => setOk(false), 1400);
          }}
          className="flex items-center gap-1 font-mono text-[10.5px] text-muted hover:text-text"
        >
          {ok ? <Check size={12} /> : <Copy size={12} />} {ok ? "copied" : "copy"}
        </button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-3 font-mono text-[11.5px] leading-relaxed text-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const b64 = (s: string) => (typeof window === "undefined" ? "" : window.btoa(s));

export function ConnectSheet({ open, onClose, ws }: { open: boolean; onClose: () => void; ws: string | null }) {
  const url = `${API}/mcp/${ws ? `?workspace=${ws}` : ""}`;
  const [tab, setTab] = useState("claude-code");
  const cursorLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=echo&config=${encodeURIComponent(b64(JSON.stringify({ url })))}`;
  const vscodeLink = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: "echo", type: "http", url }))}`;

  const TABS: { id: string; label: string; body: React.ReactNode }[] = [
    {
      id: "claude-code",
      label: "Claude Code",
      body: (
        <>
          <p>One command. Your agent can then check any claim against this memory before trusting it.</p>
          <CopyBlock code={`claude mcp add --transport http echo "${url}"`} />
        </>
      ),
    },
    {
      id: "cursor",
      label: "Cursor",
      body: (
        <>
          <a href={cursorLink} className="inline-flex items-center gap-1.5 rounded-md bg-text px-3.5 py-2 text-[12.5px] font-medium text-bg">
            Add to Cursor <ArrowSquareOut size={13} />
          </a>
          <p>Or add it to <code>~/.cursor/mcp.json</code>:</p>
          <CopyBlock label="mcp.json" code={JSON.stringify({ mcpServers: { echo: { url } } }, null, 2)} />
        </>
      ),
    },
    {
      id: "claude-desktop",
      label: "Claude Desktop",
      body: (
        <>
          <p>
            Settings → Connectors → <b>Add custom connector</b>, name it Echo and paste this URL:
          </p>
          <CopyBlock label="connector URL" code={url} />
          <p>Older versions: bridge it in <code>claude_desktop_config.json</code>.</p>
          <CopyBlock label="claude_desktop_config.json" code={JSON.stringify({ mcpServers: { echo: { command: "npx", args: ["-y", "mcp-remote", url] } } }, null, 2)} />
        </>
      ),
    },
    {
      id: "vscode",
      label: "VS Code",
      body: (
        <>
          <a href={vscodeLink} className="inline-flex items-center gap-1.5 rounded-md bg-text px-3.5 py-2 text-[12.5px] font-medium text-bg">
            Install in VS Code <ArrowSquareOut size={13} />
          </a>
          <p>Or in <code>.vscode/mcp.json</code>:</p>
          <CopyBlock label=".vscode/mcp.json" code={JSON.stringify({ servers: { echo: { type: "http", url } } }, null, 2)} />
        </>
      ),
    },
    {
      id: "windsurf",
      label: "Windsurf",
      body: (
        <>
          <p>
            Add to <code>~/.codeium/windsurf/mcp_config.json</code>:
          </p>
          <CopyBlock label="mcp_config.json" code={JSON.stringify({ mcpServers: { echo: { serverUrl: url } } }, null, 2)} />
        </>
      ),
    },
    {
      id: "langgraph",
      label: "LangGraph",
      body: (
        <>
          <p>Load Echo's tools into any LangChain or LangGraph agent with the MCP adapters.</p>
          <CopyBlock
            label="python"
            code={`# pip install langchain-mcp-adapters langgraph
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

client = MultiServerMCPClient({
    "echo": {"url": "${url}", "transport": "streamable_http"},
})
tools = await client.get_tools()   # echo_recall, echo_check, echo_ingest, ...
agent = create_react_agent("openai:gpt-5", tools)`}
          />
        </>
      ),
    },
    {
      id: "openai-agents",
      label: "OpenAI Agents",
      body: (
        <>
          <CopyBlock
            label="python"
            code={`# pip install openai-agents
from agents import Agent, Runner
from agents.mcp import MCPServerStreamableHttp

async with MCPServerStreamableHttp(params={"url": "${url}"}) as echo:
    agent = Agent(name="researcher", mcp_servers=[echo],
                  instructions="Check claims with echo_check before you rely on them.")
    result = await Runner.run(agent, "Which gateway is safest for patient data?")`}
          />
        </>
      ),
    },
    {
      id: "rest",
      label: "REST",
      body: (
        <>
          <p>Everything the studio does is a plain HTTP call.</p>
          <CopyBlock
            label="add a source"
            code={`curl -X POST ${API}/api/w/${ws ?? "<memory>"}/ingest \\
  -H 'content-type: application/json' \\
  -d '{"url": "https://example.com/article"}'`}
          />
          <CopyBlock label="check a belief" code={`curl ${API}/api/w/${ws ?? "<memory>"}/beliefs`} />
          <CopyBlock
            label="ask the agent (server-sent events)"
            code={`curl -N -X POST ${API}/api/w/${ws ?? "<memory>"}/ask \\
  -H 'content-type: application/json' \\
  -d '{"question": "What do I know, and how well is it supported?"}'`}
          />
        </>
      ),
    },
  ];

  const cur = TABS.find((t) => t.id === tab) ?? TABS[0];
  return (
    <Sheet open={open} onClose={onClose} title="Connect your agent" eyebrow="Integrations" width={600}>
      <p className="text-[13px] leading-relaxed text-muted">
        Echo is an MCP server. Point any agent at it and the independence check becomes a tool the model can call. This URL is
        scoped to the memory you have open, so your agent reads and writes the same graph you see here.
      </p>
      <div className="mt-4">
        <CopyBlock label="MCP endpoint (streamable HTTP)" code={url} />
      </div>
      <div className="scrollbar-thin mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px shrink-0 border-b-2 px-2.5 pb-2 text-[12.5px] ${tab === t.id ? "border-accent text-text" : "border-transparent text-faint hover:text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-5 space-y-3 text-[13px] leading-relaxed text-muted [&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[11.5px]">
        {cur.body}
      </div>
      <div className="mt-8 border-t border-line pt-5">
        <div className="text-[12.5px] font-medium text-text">Tools your agent gets</div>
        <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-[11.5px] text-muted sm:grid-cols-2">
          {["echo_recall", "echo_check", "echo_ingest", "echo_remember", "echo_retract", "echo_load_bearing", "echo_cypher"].map((t) => (
            <li key={t}>
              <span className="text-accent">{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
