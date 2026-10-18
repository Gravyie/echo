import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadNews } from "@remotion/google-fonts/Newsreader";
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import timeline from "./timeline.json";

const { fontFamily: SERIF } = loadNews("normal", { weights: ["300", "400"] });
loadNews("italic", { weights: ["400"] });
const { fontFamily: SANS } = loadGeist();
const { fontFamily: MONO } = loadMono();

const FPS = 30;
const C = { paper: "#f4f3ef", ink: "#141413", night: "#0e0e0d", ember: "#e0501a", emberSoft: "#ffb08a", ok: "#5fc48f", bad: "#ee6b5b", muted: "#a6a59f", faint: "#73726d" };
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/* ------------------------------------------------------------------ timing from the narration */

const LEAD = 30; // 1 s before the first line
const GAP = 12;
const EXTRA_BEFORE: Record<number, number> = { 2: 10, 9: 14, 11: 10, 12: 16 };
const lines = timeline.lines.map((l) => ({ ...l, frames: Math.ceil(l.seconds * FPS) }));
const starts: number[] = [];
lines.reduce((t, l, i) => {
  const s = t + (EXTRA_BEFORE[i] ?? 0);
  starts.push(s);
  return s + l.frames + GAP;
}, LEAD);
const TAIL = 3.2 * FPS;
export const totalFrames = starts[starts.length - 1] + lines[lines.length - 1].frames + TAIL;

// scene blocks: [first line, component]
type Block = { from: number; to: number; C: React.FC<{ d: number }> };
const X = 12; // crossfade frames

/* ------------------------------------------------------------------ building blocks */

const ease = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

function Fade({ d, children }: { d: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const o = Math.min(ease(f, 0, X), ease(f, d - 2, d + X - 2, 1, 0));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

/** Slow camera move across a painting (our b-roll). */
function Painting({ src, d, from = 1.08, to = 1.18, x = [0, -3], y = [0, -2], dim = 0.25, blur = 0 }: { src: string; d: number; from?: number; to?: number; x?: number[]; y?: number[]; dim?: number; blur?: number }) {
  const f = useCurrentFrame();
  const t = interpolate(f, [0, d + X], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: C.night }}>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${from + (to - from) * t}) translate(${x[0] + (x[1] - x[0]) * t}%, ${y[0] + (y[1] - y[0]) * t}%)`,
          filter: blur ? `blur(${blur}px)` : undefined,
        }}
      />
      <AbsoluteFill style={{ background: `rgba(10,10,9,${dim})` }} />
    </AbsoluteFill>
  );
}

/** The echo-trail mark: an origin, its repeats rippling out. */
function Mark({ size = 120, t = 1 }: { size?: number; t?: number }) {
  const rings = [0.75, 0.45, 0.22];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      {rings.map((o, i) => {
        const k = Math.min(1, Math.max(0, t * 3 - i * 0.6));
        const cx = 9.2 + (4.4 * (i + 1)) * k;
        return <circle key={i} cx={cx} cy={16} r={6.4} fill="none" stroke={C.paper} strokeWidth={1.7} opacity={o * k} />;
      })}
      <circle cx={9.2} cy={16} r={6.4} fill={C.ember} />
    </svg>
  );
}

function Kinetic({ text, at = 0, size = 150, italic = false, color = C.paper, y = 0 }: { text: string; at?: number; size?: number; italic?: boolean; color?: string; y?: number }) {
  const f = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: SERIF, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.02em", color, fontStyle: italic ? "italic" : "normal", fontWeight: 400, transform: `translateY(${y}px)` }}>
      {words.map((w, i) => {
        const s = at + i * 4;
        return (
          <span key={i} style={{ display: "inline-block", marginRight: "0.24em", opacity: ease(f, s, s + 14), transform: `translateY(${ease(f, s, s + 18, 26, 0)}px)`, filter: `blur(${ease(f, s, s + 14, 8, 0)}px)` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
}

/** Product footage in a floating browser window with a gentle 3D settle. */
function Window({ src, d, startFrom = 0, rate = 1, zoom = 1, origin = "50% 50%", zoomTo, label = "meetecho.vercel.app/studio", width = 1320 }: { src: string; d: number; startFrom?: number; rate?: number; zoom?: number; origin?: string; zoomTo?: number; label?: string; width?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: f, fps, config: { damping: 200 }, durationInFrames: 34 });
  const z = zoomTo ? zoom + (zoomTo - zoom) * ease(f, 8, d, 0, 1) : zoom;
  const h = (width * 9) / 16;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2400, paddingBottom: 200 }}>
      <div
        style={{
          width,
          borderRadius: 18,
          overflow: "hidden",
          background: C.paper,
          boxShadow: "0 60px 140px -40px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.08)",
          transform: `translateY(${(1 - rise) * 80}px) rotateX(${(1 - rise) * 10}deg) scale(${0.94 + rise * 0.06})`,
        }}
      >
        <div style={{ height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", borderBottom: "1px solid rgba(20,20,19,0.08)", background: "#fbfbf9" }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 11, height: 11, borderRadius: 99, background: "rgba(20,20,19,0.14)" }} />
          ))}
          <span style={{ margin: "0 auto", fontFamily: MONO, fontSize: 15, color: "#8a8984", transform: "translateX(-28px)" }}>{label}</span>
        </div>
        <div style={{ width, height: h, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${z})`, transformOrigin: origin }}>
            <OffthreadVideo src={staticFile(src)} startFrom={Math.round(startFrom * fps)} playbackRate={rate} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Tag({ children, at = 0, tone = "ember" }: { children: React.ReactNode; at?: number; tone?: "ember" | "plain" | "ok" | "bad" }) {
  const f = useCurrentFrame();
  const col = tone === "ember" ? C.ember : tone === "ok" ? C.ok : tone === "bad" ? C.bad : C.paper;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 20px",
        borderRadius: 999,
        border: `1.5px solid ${col}`,
        color: col,
        background: "rgba(14,14,13,0.55)",
        backdropFilter: "blur(8px)",
        fontFamily: MONO,
        fontSize: 22,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        opacity: ease(f, at, at + 12),
        transform: `translateY(${ease(f, at, at + 16, 14, 0)}px)`,
      }}
    >
      {children}
    </span>
  );
}

function Eyebrow({ children, at = 0, color = C.muted }: { children: React.ReactNode; at?: number; color?: string }) {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: MONO, fontSize: 20, letterSpacing: "0.18em", textTransform: "uppercase", color, opacity: ease(f, at, at + 14) }}>
      <span style={{ width: 10, height: 10, background: C.ember }} />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ scenes */

const Opening: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const l1 = starts[1] - starts[0];
  return (
    <AbsoluteFill>
      <Painting src="img/sky.jpg" d={d} from={1.18} to={1.06} x={[2, -1]} y={[2, 0]} dim={interpolate(f, [0, l1, d], [0.55, 0.38, 0.45])} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(10,10,9,0.75) 0%, rgba(10,10,9,0.25) 60%, rgba(10,10,9,0) 100%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36, opacity: ease(f, 6, 30), transform: `translateY(${ease(f, 6, 40, 30, 0)}px)` }}>
          <Mark size={170} t={ease(f, 10, 70)} />
          <div style={{ fontFamily: SERIF, fontSize: 210, lineHeight: 1, color: C.paper, letterSpacing: "-0.03em" }}>Echo</div>
        </div>
        <div style={{ marginTop: 40, maxWidth: 1100 }}>
          <Kinetic text="Memory that knows where every belief came from." at={l1 + 4} size={64} color="rgba(244,243,239,0.92)" />
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", right: 60, bottom: 50, fontFamily: MONO, fontSize: 15, color: "rgba(244,243,239,0.45)", opacity: ease(f, 20, 40) }}>
        J. W. Waterhouse, Echo and Narcissus, 1903
      </div>
    </AbsoluteFill>
  );
};

const Repeat: React.FC<{ d: number }> = ({ d }) => (
  <AbsoluteFill>
    <Painting src="img/grove.jpg" d={d} from={1.05} to={1.16} x={[2, -3]} dim={0.45} />
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px" }}>
      <Eyebrow at={2}>The problem</Eyebrow>
      <div style={{ marginTop: 30 }}>
        <Kinetic text="Every repeat" at={6} size={170} />
        <Kinetic text="feels like proof." at={20} size={170} italic color={C.emberSoft} />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

const SITES = ["techpicks-daily.com", "devstack-review.io", "bestgateways.io", "r/healthIT", "medium.com/@aria"];
const Five: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const merge = ease(f, d * 0.55, d * 0.85);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Painting src="img/grove.jpg" d={d} dim={0.72} blur={6} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 160px", gap: 140 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {SITES.map((s, i) => {
            const a = 6 + i * 7;
            return (
              <div
                key={s}
                style={{
                  width: 560,
                  padding: "20px 26px",
                  borderRadius: 14,
                  background: "rgba(251,251,249,0.96)",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  fontFamily: MONO,
                  fontSize: 22,
                  color: "#55554f",
                  opacity: ease(f, a, a + 12) * (1 - merge * 0.75),
                  transform: `translate(${ease(f, a, a + 16, -30, 0) + merge * 240}px, ${merge * (2 - i) * 70}px) scale(${1 - merge * 0.25})`,
                  boxShadow: "0 20px 50px -24px rgba(0,0,0,0.6)",
                }}
              >
                <span style={{ width: 12, height: 12, borderRadius: 99, background: f > d * 0.4 ? C.ember : "#c8c7c1" }} />
                {s}
                <span style={{ marginLeft: "auto", fontFamily: SANS, fontSize: 21, color: C.ink }}>“…the safest gateway”</span>
              </div>
            );
          })}
        </div>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 200, color: C.paper, lineHeight: 0.9, opacity: ease(f, 10, 24) }}>
            {merge > 0.5 ? 1 : Math.min(5, Math.max(0, Math.floor((f - 4) / 7) + 1))}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 34, color: C.muted, marginTop: 16, opacity: ease(f, 14, 28) }}>
            {merge > 0.5 ? (
              <span style={{ color: C.emberSoft }}>planted post, copied five times</span>
            ) : (
              "sources say it's the safest"
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Collapse: React.FC<{ d: number }> = ({ d }) => (
  <AbsoluteFill>
    <Painting src="img/sky.jpg" d={d} from={1.25} to={1.32} dim={0.6} blur={10} />
    <Window src="rec/hero.mp4" d={d} startFrom={4.6} zoom={1.32} origin="50% 66%" label="meetecho.vercel.app" />
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 132 }}>
      <Tag at={Math.round(d * 0.45)}>count origins, not repeats</Tag>
    </AbsoluteFill>
  </AbsoluteFill>
);

const Ask: React.FC<{ d: number }> = ({ d }) => (
  <AbsoluteFill>
    <Painting src="img/grove.jpg" d={d} dim={0.62} blur={10} />
    <Window src="rec/ask.mp4" d={d} startFrom={0.4} rate={2.6} zoom={1.0} zoomTo={1.18} origin="12% 40%" />
  </AbsoluteFill>
);

const Caught: React.FC<{ d: number }> = ({ d }) => (
  <AbsoluteFill>
    <Painting src="img/grove.jpg" d={d} from={1.2} to={1.25} dim={0.62} blur={10} />
    <Window src="rec/ask.mp4" d={d} startFrom={27} rate={0.6} zoom={1.7} zoomTo={1.9} origin="0% 52%" />
    <AbsoluteFill style={{ flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 18, paddingBottom: 132 }}>
      <Tag at={10} tone="bad">plain memory: CONFIRMED by 5 sources</Tag>
      <Tag at={Math.round(d * 0.45)}>Echo: 5 sources → 1 origin</Tag>
    </AbsoluteFill>
  </AbsoluteFill>
);

const Lineage: React.FC<{ d: number }> = ({ d }) => (
  <AbsoluteFill>
    <Painting src="img/grove.jpg" d={d} dim={0.55} blur={10} />
    <Window src="rec/lineage.mp4" d={d} startFrom={2.2} zoom={1.0} zoomTo={1.28} origin="62% 50%" />
  </AbsoluteFill>
);

const Retract: React.FC<{ d: number }> = ({ d }) => (
  <AbsoluteFill>
    <Painting src="img/grove.jpg" d={d} from={1.15} to={1.22} dim={0.55} blur={10} />
    <Window src="rec/retract.mp4" d={d} startFrom={0.6} zoom={1.0} zoomTo={1.35} origin="88% 30%" />
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 132 }}>
      <Tag at={Math.round(d * 0.55)}>every downstream belief, rescored</Tag>
    </AbsoluteFill>
  </AbsoluteFill>
);

const CYPHER = [
  "MATCH (s:Source) WHERE s.id IN $supporting",
  "MATCH (s)-[:CITES|COPIED_FROM*0..8]->(a:Source)",
  "RETURN a.id, collect(DISTINCT a.owner)",
  "",
  "CALL algo.pageRank('Source', null)",
  "GRAPH.COPY echo__tpl echo__your-memory",
];
const Falkor: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const chars = Math.floor(ease(f, 8, d * 0.8, 0, CYPHER.join("\n").length));
  let left = chars;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill style={{ opacity: 0.55 }}>
        <OffthreadVideo src={staticFile("rec/map.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "invert(1) hue-rotate(180deg) saturate(1.4) brightness(0.9)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(14,14,13,0.96) 0%, rgba(14,14,13,0.85) 48%, rgba(14,14,13,0.2) 100%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 150px" }}>
        <Eyebrow at={2} color={C.muted}>Built on FalkorDB</Eyebrow>
        <div style={{ marginTop: 26 }}>
          <Kinetic text="Every verdict" at={6} size={110} />
          <Kinetic text="is a traversal." at={16} size={110} italic color={C.emberSoft} />
        </div>
        <pre style={{ marginTop: 44, fontFamily: MONO, fontSize: 26, lineHeight: 1.6, color: "#d6d4cc", minHeight: 260 }}>
          {CYPHER.map((line, i) => {
            const n = Math.max(0, Math.min(line.length, left));
            left -= line.length + 1;
            const shown = line.slice(0, n);
            return (
              <div key={i}>
                {shown.split(/(MATCH|WHERE|RETURN|CALL|IN|collect|DISTINCT|GRAPH\.COPY)/).map((p, j) => (
                  <span key={j} style={{ color: /^(MATCH|WHERE|RETURN|CALL|IN|collect|DISTINCT|GRAPH\.COPY)$/.test(p) ? "#8fa8cc" : p.startsWith("$") ? "#d8b45a" : undefined }}>
                    {p.split(/(:[A-Z_|]+[A-Za-z_|]*)/).map((q, k) => (
                      <span key={k} style={{ color: q.startsWith(":") ? C.ember : undefined }}>{q}</span>
                    ))}
                  </span>
                ))}
                {n < line.length && n > 0 && <span style={{ background: C.ember, color: C.ember }}>_</span>}
              </div>
            );
          })}
        </pre>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 150px 175px", flexDirection: "row", flexWrap: "wrap", alignContent: "flex-end", alignItems: "flex-end", gap: 12 }}>
        {["variable-length paths", "shortestPath", "PageRank", "label propagation", "vector index", "a graph per memory"].map((t, i) => (
          <Tag key={t} at={Math.round(d * 0.35) + i * 6} tone="plain">
            {t}
          </Tag>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const PROVIDERS = ["Groq", "OpenAI", "Anthropic", "Gemini", "OpenRouter", "NVIDIA NIM", "Together"];
const AGENTS = ["Claude Code", "Cursor", "Claude Desktop", "VS Code", "Windsurf", "LangGraph"];
const Product: React.FC<{ d: number }> = ({ d }) => (
  <AbsoluteFill>
    <Painting src="img/grove.jpg" d={d} from={1.1} to={1.2} dim={0.62} blur={10} />
    <AbsoluteFill style={{ transform: "translateX(-180px) scale(0.86)" }}>
      <Window src="rec/settings.mp4" d={d} startFrom={0.5} rate={1.5} />
    </AbsoluteFill>
    <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "center", paddingRight: 70, gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
        <Eyebrow at={4}>Your model</Eyebrow>
        {PROVIDERS.map((p, i) => (
          <Tag key={p} at={8 + i * 4} tone="plain">
            {p}
          </Tag>
        ))}
        <div style={{ height: 14 }} />
        <Eyebrow at={Math.round(d * 0.5)}>Your agent</Eyebrow>
        {AGENTS.slice(0, 4).map((p, i) => (
          <Tag key={p} at={Math.round(d * 0.5) + 4 + i * 4}>
            {p}
          </Tag>
        ))}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

const Numbers: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  const n1 = Math.round(ease(f, 6, 40, 0, 17));
  const n2 = Math.round(ease(f, d * 0.55, d * 0.55 + 20, 0, 1));
  const col = (label: string, n: number, color: string, at: number, foot: string) => (
    <div style={{ opacity: ease(f, at, at + 14), flex: 1 }}>
      <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 20 }}>
        <span style={{ fontFamily: SERIF, fontSize: 300, lineHeight: 0.85, color }}>{n}</span>
        <span style={{ fontFamily: SERIF, fontSize: 90, color: C.faint }}>/ 18</span>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 30, color: C.paper, marginTop: 22 }}>{foot}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.night, padding: "0 170px", justifyContent: "center" }}>
      <Eyebrow at={0}>30 scenarios · same scoring rule</Eyebrow>
      <div style={{ display: "flex", gap: 120, marginTop: 50 }}>
        {col("Plain memory", n1, C.bad, 4, "poisoned claims stated as fact")}
        {col("Echo", n2, C.ok, Math.round(d * 0.5), "and it still trusts 12 of 12 genuine ones")}
      </div>
    </AbsoluteFill>
  );
};

const End: React.FC<{ d: number }> = ({ d }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Painting src="img/sky.jpg" d={d} from={1.05} to={1.12} x={[-1, 1]} dim={0.5} />
      <AbsoluteFill style={{ background: "radial-gradient(60% 60% at 50% 50%, rgba(10,10,9,0.25), rgba(10,10,9,0.7))" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: ease(f, 0, 20) }}>
          <Mark size={130} t={ease(f, 4, 60)} />
          <div style={{ fontFamily: SERIF, fontSize: 170, color: C.paper, letterSpacing: "-0.03em", lineHeight: 1 }}>Echo</div>
        </div>
        <div style={{ marginTop: 30 }}>
          <Kinetic text="Count origins, not mentions." at={10} size={62} italic color={C.emberSoft} />
        </div>
        <div style={{ marginTop: 54, fontFamily: MONO, fontSize: 30, color: C.paper, opacity: ease(f, 40, 56), letterSpacing: "0.02em" }}>meetecho.vercel.app</div>
        <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 18, color: "rgba(244,243,239,0.55)", opacity: ease(f, 50, 66), letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Built on FalkorDB · Graph Hacks 2026
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BLOCKS: Block[] = [
  { from: 0, to: 1, C: Opening },
  { from: 2, to: 2, C: Repeat },
  { from: 3, to: 3, C: Five },
  { from: 4, to: 4, C: Collapse },
  { from: 5, to: 5, C: Ask },
  { from: 6, to: 6, C: Caught },
  { from: 7, to: 7, C: Lineage },
  { from: 8, to: 8, C: Retract },
  { from: 9, to: 9, C: Falkor },
  { from: 10, to: 10, C: Product },
  { from: 11, to: 11, C: Numbers },
  { from: 12, to: 12, C: End },
];

/* ------------------------------------------------------------------ captions */

function Caption({ text, d }: { text: string; d: number }) {
  const f = useCurrentFrame();
  const o = Math.min(ease(f, 0, 6), ease(f, d - 6, d, 1, 0));
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, background: "linear-gradient(180deg, rgba(10,10,9,0) 0%, rgba(10,10,9,0.78) 70%)", opacity: o }} />
      <div style={{ position: "relative", opacity: o, maxWidth: 1400, marginBottom: 34, textAlign: "center", fontFamily: SANS, fontSize: 30, lineHeight: 1.35, color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
        {text}
      </div>
    </AbsoluteFill>
  );
}

export const Launch: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {BLOCKS.map((b, i) => {
        const start = i === 0 ? 0 : starts[b.from] - 8;
        const next = i < BLOCKS.length - 1 ? starts[BLOCKS[i + 1].from] - 8 : totalFrames;
        const d = next - start;
        return (
          <Sequence key={i} from={start} durationInFrames={d + X} premountFor={30}>
            <Fade d={d}>
              <b.C d={d} />
            </Fade>
          </Sequence>
        );
      })}
      {lines.map((l, i) => (
        <Sequence key={`vo${i}`} from={starts[i]} durationInFrames={l.frames + 4}>
          <Audio src={staticFile(l.file)} />
          {i !== 12 && i !== 0 && <Caption text={l.text} d={l.frames + 4} />}
        </Sequence>
      ))}
      <Audio src={staticFile("music.mp3")} volume={(f) => interpolate(f, [0, 40, totalFrames - 90, totalFrames], [0, 0.55, 0.55, 0], { extrapolateRight: "clamp" })} />
    </AbsoluteFill>
  );
};
