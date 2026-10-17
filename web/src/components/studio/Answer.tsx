"use client";

import ReactMarkdown from "react-markdown";
import { Children, isValidElement, type ReactNode } from "react";

/** Markdown answer where [[source-id]] citations become clickable chips. */
export function Answer({ text, onCite, titles }: { text: string; onCite: (id: string) => void; titles: Map<string, string> }) {
  const withChips = (children: ReactNode): ReactNode =>
    Children.map(children, (child) => {
      if (typeof child === "string") {
        const parts = child.split(/(\[\[[^\]]+\]\])/g);
        return parts.map((p, i) => {
          const m = p.match(/^\[\[([^\]]+)\]\]$/);
          if (!m) return p;
          // Models sometimes prefix a belief id wrongly (s:x for b:x); resolve to whatever node exists.
          const raw = m[1].trim();
          const bare = raw.replace(/^[a-z]+:/, "");
          const id = [raw, `b:${bare}`, bare].find((k) => titles.has(k));
          if (!id) return <span key={`${raw}-${i}`} className="font-mono text-[11px] text-faint">{bare}</span>;
          const t = titles.get(id);
          const belief = id.startsWith("b:");
          const label = t ? (t.length > 26 ? t.slice(0, 25) + "…" : t) : id;
          return (
            <button
              key={`${id}-${i}`}
              onClick={() => onCite(id)}
              title={t ?? id}
              className={`mx-0.5 inline-flex ${belief ? "rounded-[3px] border-dashed" : ""} max-w-[16rem] translate-y-[-1px] items-center truncate rounded-md border border-line-strong bg-surface-3 px-1.5 py-[1px] align-middle font-mono text-[10.5px] text-muted transition-colors hover:border-accent hover:text-accent`}
            >
              {label}
            </button>
          );
        });
      }
      if (isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
        return child;
      }
      return child;
    });

  return (
    <div className="prose-echo text-[13.5px] text-muted">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p>{withChips(children)}</p>,
          li: ({ children }) => <li>{withChips(children)}</li>,
          strong: ({ children }) => <strong>{withChips(children)}</strong>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
