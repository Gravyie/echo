import { Fragment } from "react";

const KW = /\b(MATCH|OPTIONAL|MERGE|CREATE|SET|WITH|WHERE|RETURN|DISTINCT|CALL|YIELD|UNWIND|ORDER BY|LIMIT|AND|OR|NOT|IN|AS|DELETE|DESC|ON|COUNT|collect|count|shortestPath|coalesce|vecf32)\b/g;

/** Tiny Cypher highlighter: keywords, labels/rel types, strings, params, comments. */
export function highlightCypher(code: string) {
  return code.split("\n").map((line, li) => {
    const comment = line.indexOf("//");
    const body = comment >= 0 ? line.slice(0, comment) : line;
    const parts: React.ReactNode[] = [];
    const re = /('[^']*'|\$\w+|:[A-Z_|]+[A-Za-z_|]*|\b[A-Z][A-Z_]{1,}\b|\b(?:collect|count|shortestPath|coalesce|vecf32)\b|\d+(?:\.\.\d+)?)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      if (m.index > last) parts.push(body.slice(last, m.index));
      const tok = m[0];
      let cls = "text-text";
      if (tok.startsWith("'")) cls = "text-ok";
      else if (tok.startsWith("$")) cls = "text-contested";
      else if (tok.startsWith(":")) cls = "text-accent";
      else if (/^\d/.test(tok)) cls = "text-single";
      else if (KW.test(tok)) cls = "text-single font-medium";
      KW.lastIndex = 0;
      parts.push(
        <span key={`${li}-${m.index}`} className={cls}>
          {tok}
        </span>,
      );
      last = m.index + tok.length;
    }
    if (last < body.length) parts.push(body.slice(last));
    return (
      <Fragment key={li}>
        <span className="text-muted">{parts}</span>
        {comment >= 0 && <span className="text-faint">{line.slice(comment)}</span>}
        {"\n"}
      </Fragment>
    );
  });
}

export function CypherBlock({ code, title, compact, lang = "FalkorDB · Cypher" }: { code: string; title?: string; compact?: boolean; lang?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {title && (
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="font-mono text-xs text-faint">{title}</span>
          <span className="font-mono text-xs text-faint">{lang}</span>
        </div>
      )}
      <pre className={`scrollbar-thin overflow-x-auto font-mono leading-relaxed ${compact ? "p-3 text-[11.5px]" : "p-5 text-[13px]"}`}>
        <code>{highlightCypher(code)}</code>
      </pre>
    </div>
  );
}
