import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, ease, Eyebrow, Fade, Kinetic, Mark, MONO, Painting, SANS, SERIF, Tag, Window } from "./Launch";
import timeline from "./timeline2.json";

/*
 * Echo launch film v2: narrated by Kokoro (af_heart), original synthesised score and sound design.
 * Every scene is timed from the narration clips in timeline2.json.
 */

const FPS = 30;
const LEAD = 42;
const GAP = 9;
// extra air before a line (by clip index): breaths at section changes
const AIR: Record<number, number> = { 1: 12, 3: 14, 5: 16, 6: 26, 7: 14, 12: 18, 14: 14, 16: 12, 19: 22, 21: 14, 23: 18, 24: 10 };
const lines = timeline.lines.map((l) => ({ ...l, frames: Math.ceil(l.seconds * FPS) }));
const starts: number[] = [];
lines.reduce((t, l, i) => {
  const s = t + (AIR[i] ?? 0);
  starts.push(s);
  return s + l.frames + GAP;
}, LEAD);
const end = (i: number) => starts[i] + lines[i].frames;
const TAIL = 4.2 * FPS;
export const totalFrames2 = end(lines.length - 1) + TAIL;
const X = 12;

/* ------------------------------------------------------------------ scenes */

const Opening: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const name = starts[0] - 0 + 34; // "Echo" lands on "...launching Echo"
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill style={{ opacity: ease(f, 20, 70) }}>
        <Painting src="img/sky.jpg" d={d} from={1.22} to={1.1} x={[2, -1]} dim={0.55} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ opacity: ease(f, 10, 30) * (1 - ease(f, name + 6, name + 22) * 0.0) }}>
          <Eyebrow at={10} color="rgba(244,243,239,0.75)">
            Ubermenschen
          </Eyebrow>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 34, marginTop: 34, opacity: ease(f, name, name + 18), transform: `translateY(${ease(f, name, name + 28, 26, 0)}px)` }}>
          <Mark size={170} t={ease(f, name + 4, name + 60)} />
          <div style={{ fontFamily: SERIF, fontSize: 220, lineHeight: 1, color: C.paper, letterSpacing: "-0.03em" }}>Echo</div>
        </div>
        <div style={{ marginTop: 26, fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: C.emberSoft, opacity: ease(f, name + 26, name + 46) }}>
          memory that knows where it came from
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const USES = [
  { k: "Research", claim: "“Compound K cuts relapse by 40%”", n: "14 sources" },
  { k: "Comparing products", claim: "“Halcyon is the safest LLM gateway”", n: "5 sources" },
  { k: "Making a decision", claim: "“The supplier passed its audit”", n: "4 sources" },
];
const Uses: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const l2 = starts[2] - starts[1];
  return (
    <AbsoluteFill>
      <Painting src="img/grove.jpg" d={d} dim={0.66} blur={8} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 150px" }}>
        <Eyebrow at={2}>An agent at work</Eyebrow>
        <div style={{ display: "flex", gap: 28, marginTop: 40 }}>
          {USES.map((u, i) => {
            const a = 8 + i * 12;
            return (
              <div
                key={u.k}
                style={{
                  flex: 1,
                  borderRadius: 18,
                  padding: "30px 32px",
                  background: "rgba(251,251,249,0.96)",
                  boxShadow: "0 30px 70px -30px rgba(0,0,0,0.7)",
                  opacity: ease(f, a, a + 14),
                  transform: `translateY(${ease(f, a, a + 22, 40, 0)}px)`,
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.14em", textTransform: "uppercase", color: C.ember }}>{u.k}</div>
                <div style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.12, color: C.ink, marginTop: 16 }}>{u.claim}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
                  {[0, 1, 2, 3, 4].map((j) => (
                    <span key={j} style={{ width: 14, height: 14, borderRadius: 99, background: "#c8c7c1", opacity: ease(f, l2 + 4 + j * 4 + i * 3, l2 + 14 + j * 4 + i * 3) }} />
                  ))}
                  <span style={{ marginLeft: 10, fontFamily: MONO, fontSize: 18, color: "#8a8984", opacity: ease(f, l2 + 20, l2 + 34) }}>{u.n}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 56, display: "flex", gap: 30, fontFamily: SERIF, fontSize: 64, color: C.paper }}>
          {["reads.", "remembers.", "builds on it."].map((w, i) => (
            <span key={w} style={{ opacity: ease(f, l2 + i * 10, l2 + 14 + i * 10), transform: `translateY(${ease(f, l2 + i * 10, l2 + 18 + i * 10, 20, 0)}px)`, fontStyle: i === 2 ? "italic" : "normal", color: i === 2 ? C.emberSoft : C.paper }}>
              {w}
            </span>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SITES = ["techpicks-daily.com", "devstack-review.io", "bestgateways.io", "r/healthIT", "medium.com/@aria"];
/** "Five confirmations… one original source": the count climbs with heartbeats, then every line runs back to one post. */
const Problem: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const l4 = starts[4] - starts[3];
  const beats = [10, 26, 38, 47, 53]; // accelerating
  const n = beats.filter((b) => f >= b).length;
  const traced = ease(f, l4 + 20, l4 + 60);
  const ox = 1380;
  const oy = 470;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Painting src="img/grove.jpg" d={d} dim={0.8} blur={10} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {SITES.map((_, i) => {
          const y = 250 + i * 118 + 38;
          const len = 1;
          return (
            <path
              key={i}
              d={`M 760 ${y} C 1000 ${y}, 1100 ${oy + 60}, ${ox} ${oy + 60}`}
              fill="none"
              stroke={C.ember}
              strokeWidth={2.2}
              pathLength={len}
              strokeDasharray={len}
              strokeDashoffset={len * (1 - Math.min(1, Math.max(0, traced * 1.4 - i * 0.1)))}
              opacity={0.9}
            />
          );
        })}
      </svg>
      {SITES.map((s, i) => {
        const a = beats[i];
        return (
          <div
            key={s}
            style={{
              position: "absolute",
              left: 160,
              top: 250 + i * 118,
              width: 600,
              height: 76,
              borderRadius: 14,
              background: "rgba(251,251,249,0.97)",
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "0 24px",
              fontFamily: MONO,
              fontSize: 21,
              color: "#55554f",
              opacity: ease(f, a, a + 8),
              transform: `scale(${ease(f, a, a + 8, 1.06, 1)})`,
              boxShadow: "0 20px 50px -24px rgba(0,0,0,0.7)",
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: 99, background: traced > 0.2 ? C.ember : "#5fc48f" }} />
            {s}
            <span style={{ marginLeft: "auto", fontFamily: SANS, fontSize: 20, color: C.ink }}>“…the safest gateway”</span>
          </div>
        );
      })}
      {/* plain memory's tally */}
      <div style={{ position: "absolute", left: 900, top: 230, opacity: 1 - traced }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>Plain memory</div>
        <div style={{ fontFamily: SERIF, fontSize: 240, lineHeight: 1, color: C.paper }}>{n}</div>
        <div
          style={{
            display: "inline-block",
            marginTop: 10,
            padding: "10px 22px",
            border: `3px solid ${C.ok}`,
            color: C.ok,
            fontFamily: MONO,
            fontSize: 30,
            letterSpacing: "0.12em",
            transform: `rotate(-6deg) scale(${ease(f, 58, 66, 1.6, 1)})`,
            opacity: ease(f, 58, 64),
          }}
        >
          CONFIRMED ×{n}
        </div>
      </div>
      {/* the one original */}
      <div
        style={{
          position: "absolute",
          left: ox,
          top: oy,
          width: 400,
          borderRadius: 16,
          padding: "22px 26px",
          background: C.paper,
          border: `2px solid ${C.ember}`,
          boxShadow: `0 0 120px -10px ${C.ember}`,
          opacity: ease(f, l4 + 40, l4 + 60),
          transform: `scale(${ease(f, l4 + 40, l4 + 70, 0.9, 1)})`,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 17, color: C.ember, letterSpacing: "0.1em" }}>ONE ORIGINAL SOURCE</div>
        <div style={{ fontFamily: SANS, fontSize: 24, color: C.ink, marginTop: 10, lineHeight: 1.3 }}>A planted post: “Halcyon is the safest gateway.”</div>
      </div>
    </AbsoluteFill>
  );
};

const Statement: React.FC<{ d: number }> = () => (
  <AbsoluteFill style={{ background: C.night, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
    <Kinetic text="Repetition" at={4} size={170} />
    <Kinetic text="isn't evidence." at={14} size={170} italic color={C.emberSoft} />
  </AbsoluteFill>
);

const Turn: React.FC<{ d: number }> = ({ d }) => (
  <AbsoluteFill>
    <Painting src="img/sky.jpg" d={d} from={1.2} to={1.3} dim={0.6} blur={10} />
    <Window src="rec/hero.mp4" d={d} startFrom={3.9} zoom={1.32} origin="50% 66%" label="meetecho.vercel.app" width={1220} />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-end", paddingBottom: 132, flexDirection: "row", gap: 16 }}>
      <Tag at={Math.round(d * 0.25)} tone="plain">
        traces connections
      </Tag>
      <Tag at={Math.round(d * 0.45)} tone="plain">
        separates repeats from independent support
      </Tag>
      <Tag at={Math.round(d * 0.65)}>shows what a belief rests on</Tag>
    </AbsoluteFill>
  </AbsoluteFill>
);

const Title: React.FC<{ d: number; text: string; italic?: string }> = ({ text, italic }) => (
  <AbsoluteFill style={{ background: C.paper, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
    <Kinetic text={text} at={2} size={150} color={C.ink} />
    {italic && <Kinetic text={italic} at={10} size={150} italic color={C.ember} />}
  </AbsoluteFill>
);

const Clip: React.FC<{ d: number; src: string; startFrom?: number; rate?: number; zoom?: number; zoomTo?: number; origin?: string; bg?: string; tags?: [string, "ember" | "plain" | "ok" | "bad", number][] }> = ({
  d,
  src,
  startFrom = 0,
  rate = 1,
  zoom = 1,
  zoomTo,
  origin,
  bg = "img/grove.jpg",
  tags = [],
}) => (
  <AbsoluteFill>
    <Painting src={bg} d={d} dim={0.64} blur={10} />
    <Window src={src} d={d} startFrom={startFrom} rate={rate} zoom={zoom} zoomTo={zoomTo} origin={origin} width={1220} />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-end", paddingBottom: 132, flexDirection: "row", gap: 16 }}>
      {tags.map(([t, tone, at]) => (
        <Tag key={t} at={Math.round(d * at)} tone={tone}>
          {t}
        </Tag>
      ))}
    </AbsoluteFill>
  </AbsoluteFill>
);

const CYPHER = [
  "// every verdict is a traversal",
  "MATCH (s:Source)-[:CITES|COPIED_FROM*0..8]->(origin)",
  "// the proof, hop by hop",
  "WITH shortestPath((copy)-[*1..8]->(origin)) AS proof",
  "// what everything rests on",
  "CALL algo.pageRank('Source', null)",
];
const Falkor: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const l13 = starts[13] - starts[12];
  const total = CYPHER.join("\n").length;
  const chars = Math.floor(ease(f, l13 - 10, d * 0.92, 0, total));
  let left = chars;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill style={{ opacity: 0.85 }}>
        <OffthreadVideo src={staticFile("rec/mapdark.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(1.45) saturate(1.2)", transform: `translateX(16%) scale(${1.35 + 0.1 * (f / d)})` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(14,14,13,0.97) 0%, rgba(14,14,13,0.85) 42%, rgba(14,14,13,0) 75%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 150px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: ease(f, 4, 22), transform: `translateY(${ease(f, 4, 26, 16, 0)}px)` }}>
          <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.16em", color: C.muted }}>BUILT ON</span>
          <Img src={staticFile("img/falkordb.svg")} style={{ height: 64 }} />
        </div>
        <div style={{ marginTop: 34 }}>
          <Kinetic text="Not just storing sources." at={12} size={92} />
          <Kinetic text="Following how they connect." at={l13} size={92} italic color={C.emberSoft} />
        </div>
        <pre style={{ marginTop: 40, fontFamily: MONO, fontSize: 25, lineHeight: 1.6, color: "#d6d4cc", minHeight: 250 }}>
          {CYPHER.map((line, i) => {
            const n = Math.max(0, Math.min(line.length, left));
            left -= line.length + 1;
            const shown = line.slice(0, n);
            const comment = shown.startsWith("//");
            return (
              <div key={i} style={{ color: comment ? "#73726d" : undefined }}>
                {comment
                  ? shown
                  : shown.split(/(MATCH|WITH|CALL|AS|shortestPath)/).map((p, j) => (
                      <span key={j} style={{ color: /^(MATCH|WITH|CALL|AS|shortestPath)$/.test(p) ? "#8fa8cc" : undefined }}>
                        {p.split(/(:[A-Z_|]+[A-Za-z_|]*)/).map((q, k) => (
                          <span key={k} style={{ color: q.startsWith(":") ? C.ember : undefined }}>{q}</span>
                        ))}
                      </span>
                    ))}
              </div>
            );
          })}
        </pre>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const PROVIDERS = ["Groq", "OpenAI", "Anthropic", "Gemini", "OpenRouter", "NVIDIA NIM", "Together", "any OpenAI-compatible"];
const CLIENTS = ["Claude Code", "Cursor", "OpenCode", "VS Code", "Windsurf", "LangGraph", "OpenAI Agents"];
const TOOLS = ["echo_recall", "echo_check", "echo_ingest", "echo_remember", "echo_retract", "echo_load_bearing", "echo_cypher"];
const Setup: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const l15 = starts[15] - starts[14];
  const third = (starts[15] + lines[15].frames - starts[14] - l15) / 3;
  const s1 = l15;
  const s2 = l15 + third;
  const s3 = l15 + 2 * third;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Painting src="img/sky.jpg" d={d} from={1.1} to={1.2} dim={0.72} blur={12} />
      {/* "your own setup" */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - ease(f, s1 - 6, s1 + 6) }}>
        <Kinetic text="Your setup." at={4} size={170} />
      </AbsoluteFill>
      {/* models */}
      <AbsoluteFill style={{ padding: "150px 150px", opacity: ease(f, s1, s1 + 10) }}>
        <AbsoluteFill style={{ transform: "translateX(-200px) scale(0.84)", opacity: f < s1 ? 0 : 1 }}>
          {f >= s1 - 2 && <Window src="rec/settings.mp4" d={d - s1} startFrom={0.3} rate={1.35} />}
        </AbsoluteFill>
        <div style={{ position: "absolute", right: 90, top: 140, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 11 }}>
          <Eyebrow at={s1 + 2}>Your model</Eyebrow>
          {PROVIDERS.map((p, i) => (
            <Tag key={p} at={s1 + 6 + i * 3} tone="plain">
              {p}
            </Tag>
          ))}
        </div>
      </AbsoluteFill>
      {/* clients + tools: a terminal */}
      <AbsoluteFill style={{ background: "rgba(14,14,13,0.92)", opacity: ease(f, s2, s2 + 10), padding: "0 150px", justifyContent: "center" }}>
        <Eyebrow at={s2 + 2}>Your agent, over MCP or the API</Eyebrow>
        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          {CLIENTS.map((c, i) => (
            <Tag key={c} at={s2 + 4 + i * 3}>
              {c}
            </Tag>
          ))}
        </div>
        <div style={{ marginTop: 40, borderRadius: 16, background: "#151514", border: "1px solid rgba(255,255,250,0.1)", padding: "26px 32px", fontFamily: MONO, fontSize: 25, color: "#d6d4cc", lineHeight: 1.7 }}>
          <div style={{ color: C.muted }}>
            <span style={{ color: C.ember }}>$</span> claude mcp add --transport http echo https://echo-memory.onrender.com/mcp/
          </div>
          <div style={{ opacity: ease(f, s3 - 6, s3 + 4) }}>
            <span style={{ color: C.ok }}>✓</span> echo connected · 7 tools
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 26px", marginTop: 10 }}>
            {TOOLS.map((t, i) => (
              <span key={t} style={{ color: C.ember, opacity: ease(f, s3 + i * 4, s3 + i * 4 + 8) }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Role: React.FC<{ d: number; role: string; line: string; children: React.ReactNode }> = ({ d, role, line, children }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Painting src="img/grove.jpg" d={d} dim={0.7} blur={12} />
      <AbsoluteFill style={{ transform: "translateX(230px) scale(0.78)" }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 0 120px 110px", width: 640 }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.16em", textTransform: "uppercase", color: C.ember, opacity: ease(f, 2, 14) }}>If you're</div>
        <div style={{ fontFamily: SERIF, fontSize: 92, lineHeight: 1, color: C.paper, marginTop: 10, opacity: ease(f, 4, 18), transform: `translateY(${ease(f, 4, 22, 20, 0)}px)` }}>{role}</div>
        <div style={{ fontFamily: SANS, fontSize: 30, lineHeight: 1.35, color: C.muted, marginTop: 22, opacity: ease(f, 12, 26) }}>{line}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Terminal: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const rows: [string, string, number][] = [
    ["→", "echo_recall(\"safest LLM gateway\")", 8],
    ["←", "6 beliefs · top: “Halcyon is the safest…” 5 sources → 1 origin", 22],
    ["→", "echo_check(\"b:halcyon-safest\")", 40],
    ["←", "DISPUTED · 1 independent origin for, 2 against", 54],
    ["←", "collapsed: verbatim copy · links to origin · same ref=hx-partner-77", 64],
    ["", "agent: “Don't rely on this. It's one planted post, repeated.”", 84],
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 100 }}>
      <div style={{ width: 1320, borderRadius: 18, background: "#151514", border: "1px solid rgba(255,255,250,0.1)", boxShadow: "0 60px 140px -40px rgba(0,0,0,0.8)", overflow: "hidden" }}>
        <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 18px", gap: 8, borderBottom: "1px solid rgba(255,255,250,0.08)" }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 11, height: 11, borderRadius: 99, background: "rgba(255,255,250,0.18)" }} />
          ))}
          <span style={{ margin: "0 auto", fontFamily: MONO, fontSize: 15, color: C.faint }}>your agent · mcp: echo</span>
        </div>
        <div style={{ padding: "30px 36px", fontFamily: MONO, fontSize: 27, lineHeight: 1.75 }}>
          {rows.map(([dir, text, at], i) => (
            <div key={i} style={{ opacity: ease(f, at, at + 8), color: dir === "→" ? C.ember : dir === "←" ? "#d6d4cc" : C.ok }}>
              <span style={{ display: "inline-block", width: 40, color: C.faint }}>{dir}</span>
              {text}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Honest: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const l20 = starts[20] - starts[19];
  return (
    <AbsoluteFill>
      <Painting src="img/sky.jpg" d={d} from={1.05} to={1.12} dim={0.58} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px" }}>
        <Kinetic text="Not “true” or “false”." at={4} size={110} />
        <div style={{ marginTop: 18 }}>
          <Kinetic text="Where it came from." at={l20} size={110} italic color={C.emberSoft} />
          <Kinetic text="Whether it's independent." at={l20 + 34} size={110} italic color={C.emberSoft} />
        </div>
        <div style={{ marginTop: 50, display: "flex", gap: 70, opacity: ease(f, l20 + 60, l20 + 80) }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.14em", color: C.muted }}>PLAIN MEMORY</div>
            <div style={{ fontFamily: SERIF, fontSize: 84, color: C.bad, lineHeight: 1.05 }}>17 / 18</div>
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.14em", color: C.muted }}>ECHO</div>
            <div style={{ fontFamily: SERIF, fontSize: 84, color: C.ok, lineHeight: 1.05 }}>1 / 18</div>
          </div>
          <div style={{ alignSelf: "flex-end", paddingBottom: 14, fontFamily: SANS, fontSize: 24, color: C.muted, maxWidth: 420 }}>
            poisoned claims stated as fact, across 30 benchmark scenarios
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Vision: React.FC<{ d: number }> = ({ d }) => {
  const l22 = starts[22] - starts[21];
  return (
    <AbsoluteFill style={{ background: C.night, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Kinetic text="Better answers aren't enough." at={4} size={96} color={C.muted} />
      <div style={{ marginTop: 30 }}>
        <Kinetic text="Memory they can check." at={l22} size={170} italic color={C.paper} />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: 0 }}>{d}</div>
    </AbsoluteFill>
  );
};

const Close: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const l24 = starts[24] - starts[23];
  return (
    <AbsoluteFill>
      <Painting src="img/sky.jpg" d={d} from={1.04} to={1.14} x={[-1, 1]} dim={0.5} />
      <AbsoluteFill style={{ background: "radial-gradient(60% 60% at 50% 50%, rgba(10,10,9,0.2), rgba(10,10,9,0.72))" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ opacity: 1 - ease(f, l24 - 10, l24)}}>
          <Kinetic text="We're excited to see what you build." at={4} size={78} />
        </div>
        <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", opacity: ease(f, l24, l24 + 16) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <Mark size={140} t={ease(f, l24 + 30, l24 + 90)} />
            <div style={{ fontFamily: SERIF, fontSize: 180, color: C.paper, letterSpacing: "-0.03em", lineHeight: 1 }}>Echo</div>
          </div>
          <div style={{ marginTop: 24, fontFamily: SERIF, fontStyle: "italic", fontSize: 54, color: C.emberSoft, opacity: ease(f, l24 + 20, l24 + 36) }}>Count origins, not mentions.</div>
          <div style={{ marginTop: 48, fontFamily: MONO, fontSize: 30, color: C.paper, opacity: ease(f, l24 + 36, l24 + 52) }}>meetecho.vercel.app</div>
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 18, opacity: ease(f, l24 + 50, l24 + 66) }}>
            <span style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.16em", color: "rgba(244,243,239,0.6)" }}>UBERMENSCHEN · BUILT ON</span>
            <Img src={staticFile("img/falkordb.svg")} style={{ height: 30 }} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ edit */

type Block = { from: number; C: React.FC<{ d: number }> };
const BLOCKS: Block[] = [
  { from: 0, C: Opening },
  { from: 1, C: Uses },
  { from: 3, C: Problem },
  { from: 5, C: Statement },
  { from: 6, C: Turn },
  { from: 7, C: ({ d }) => <Title d={d} text="Here's how" italic="it works." /> },
  { from: 8, C: ({ d }) => <Clip d={d} src="rec/ask.mp4" startFrom={0.4} rate={2.6} zoomTo={1.15} origin="12% 40%" /> },
  {
    from: 9,
    C: ({ d }) => (
      <Clip
        d={d}
        src="rec/compare.mp4"
        startFrom={1.2}
        zoom={1.55}
        zoomTo={1.7}
        origin="0% 40%"
        tags={[
          ["plain memory: “Halcyon, confirmed by 5 sources”", "bad", 0.15],
          ["Echo: 5 sources → 1 origin", "ember", 0.6],
        ]}
      />
    ),
  },
  { from: 10, C: ({ d }) => <Clip d={d} src="rec/lineage.mp4" startFrom={1.6} zoomTo={1.28} origin="62% 50%" bg="img/sky.jpg" tags={[["verbatim copy · links to · same figures", "plain", 0.55]]} /> },
  { from: 11, C: ({ d }) => <Clip d={d} src="rec/retract.mp4" startFrom={0.4} zoomTo={1.35} origin="88% 30%" tags={[["every dependent belief, rescored", "ember", 0.55]]} /> },
  { from: 12, C: Falkor },
  { from: 14, C: Setup },
  { from: 16, C: ({ d }) => <Role d={d} role="a researcher" line="Trace claims back to their origins."><Window src="rec/examples.mp4" d={d} startFrom={0.8} rate={1.25} /></Role> },
  { from: 17, C: ({ d }) => <Role d={d} role="building agents" line="Inspect their memory. Check the evidence behind every decision."><Terminal d={d} /></Role> },
  {
    from: 18,
    C: ({ d }) => (
      <Role d={d} role="deciding with agents" line="See whether confidence comes from independent evidence, or one claim repeated.">
        <Window src="rec/compare.mp4" d={d} startFrom={6.5} zoom={1.45} origin="0% 30%" />
      </Role>
    ),
  },
  { from: 19, C: Honest },
  { from: 21, C: Vision },
  { from: 23, C: Close },
];

function Caption({ text, d }: { text: string; d: number }) {
  const f = useCurrentFrame();
  const o = Math.min(ease(f, 0, 6), ease(f, d - 6, d, 1, 0));
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, background: "linear-gradient(180deg, rgba(10,10,9,0) 0%, rgba(10,10,9,0.78) 70%)", opacity: o }} />
      <div style={{ position: "relative", opacity: o, maxWidth: 1400, marginBottom: 34, textAlign: "center", fontFamily: SANS, fontSize: 30, lineHeight: 1.35, color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>{text}</div>
    </AbsoluteFill>
  );
}

/** A sound effect at an absolute frame. */
const Sfx = ({ at, src, vol = 1 }: { at: number; src: string; vol?: number }) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={150}>
    <Audio src={staticFile(`sfx/${src}.wav`)} volume={vol} />
  </Sequence>
);

export const Launch2: React.FC = () => {
  const blockStart = (i: number) => (i === 0 ? 0 : starts[BLOCKS[i].from] - 8);
  const s = (i: number) => starts[i];
  const pulseIn = s(7) - 6;
  const pulseOut = s(19) - 20;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {BLOCKS.map((b, i) => {
        const start = blockStart(i);
        const next = i < BLOCKS.length - 1 ? blockStart(i + 1) : totalFrames2;
        const d = next - start;
        return (
          <Sequence key={i} from={start} durationInFrames={d + X} premountFor={40}>
            <Fade d={d}>
              <b.C d={d} />
            </Fade>
          </Sequence>
        );
      })}

      {/* narration + captions */}
      {lines.map((l, i) => (
        <Sequence key={`vo${i}`} from={starts[i]} durationInFrames={l.frames + 4}>
          <Audio src={staticFile(l.file)} />
          {i !== 0 && i !== 5 && i !== 24 && <Caption text={l.text} d={l.frames + 4} />}
        </Sequence>
      ))}

      {/* score */}
      <Audio
        src={staticFile("sfx/pad.wav")}
        volume={(f) =>
          interpolate(f, [0, 60, s(3), s(5), s(5) + 30, s(6), totalFrames2 - 120, totalFrames2], [0, 0.42, 0.42, 0.18, 0.05, 0.4, 0.4, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <Sequence from={pulseIn} durationInFrames={pulseOut - pulseIn + 60}>
        <Audio
          src={staticFile("sfx/pulse.wav")}
          loop
          volume={(f) => interpolate(f, [0, 30, pulseOut - pulseIn - 10, pulseOut - pulseIn + 50], [0, 0.42, 0.42, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      </Sequence>

      {/* sound design */}
      <Sfx at={6} src="echo_tone" vol={0.7} />
      {[10, 26, 38, 47, 53].map((b) => (
        <Sfx key={b} at={s(3) - 8 + b} src="thump" vol={0.85} />
      ))}
      <Sfx at={s(6) - 66} src="riser" vol={0.7} />
      <Sfx at={s(6) - 8} src="hit" vol={0.9} />
      <Sfx at={s(6) + 34} src="whoosh" vol={0.4} />
      <Sfx at={s(7) - 10} src="whoosh" vol={0.55} />
      <Sfx at={s(8) + 6} src="tick" vol={0.6} />
      <Sfx at={s(10) + 12} src="tick" vol={0.6} />
      <Sfx at={s(10) + 60} src="tick" vol={0.6} />
      <Sfx at={s(11) + 30} src="tick" vol={0.6} />
      <Sfx at={s(11) + 70} src="tick" vol={0.6} />
      <Sfx at={s(12) - 10} src="whoosh" vol={0.5} />
      <Sfx at={s(14) - 6} src="whoosh" vol={0.45} />
      <Sfx at={s(16) - 10} src="whoosh" vol={0.35} />
      <Sfx at={s(17) - 10} src="whoosh" vol={0.35} />
      <Sfx at={s(18) - 10} src="whoosh" vol={0.35} />
      <Sfx at={s(22) - 6} src="hit" vol={0.75} />
      <Sfx at={s(24) - 4} src="echo_tone" vol={0.75} />
    </AbsoluteFill>
  );
};
