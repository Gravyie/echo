"""Narration: one clip per line. Groq Orpheus when available (accept its terms in the Groq console), else macOS `say`.
Writes public/vo/NN.wav and src/timeline.json ({lines: [{text, file, seconds}]})."""
import json, os, subprocess, sys, urllib.request, wave, contextlib, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
LINES = [
    "Today, we're launching Echo.",
    "Memory for AI agents that knows where every belief came from.",
    "Agents trust a claim more, each time they read it.",
    "But five pages saying the same thing can be one planted post, copied five times.",
    "Echo traces every claim back to its origin, and counts independent origins, not repeats.",
    "Ask your agent anything. It recalls what it knows, checks each belief's independence, and shows its work.",
    "Plain memory recommends the planted vendor. Echo sees five sources, one origin, and doesn't.",
    "Open the lineage, and see the proof. Every copy, every link, every shared figure.",
    "Retract the planted post, and everything built on it is rescored in milliseconds.",
    "Under the hood, it's FalkorDB. Every verdict is a graph traversal. PageRank finds the origins your beliefs rest on. And every memory is its own graph.",
    "Bring your own model. Set your own trust policy. And connect Echo to Claude Code, Cursor, or any agent over MCP.",
    "On our benchmark, plain memory stated seventeen of eighteen poisoned claims as fact. Echo stated one.",
    "Echo. Count origins, not mentions.",
]
VOICE = os.environ.get("VOICE", "troy")

def key():
    for line in (ROOT.parent / ".env").read_text().splitlines():
        if line.startswith("GROQ_API_KEY="):
            return line.split("=", 1)[1].strip()

def groq(text, out):
    req = urllib.request.Request("https://api.groq.com/openai/v1/audio/speech", method="POST",
        data=json.dumps({"model": "canopylabs/orpheus-v1-english", "voice": VOICE, "input": text, "response_format": "wav"}).encode(),
        headers={"Authorization": f"Bearer {key()}", "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        out.write_bytes(r.read())

def say(text, out):
    aiff = out.with_suffix(".aiff")
    subprocess.run(["say", "-v", os.environ.get("SAY_VOICE", "Samantha"), "-r", "172", "-o", str(aiff), text], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(aiff), "-ar", "48000", str(out)], check=True)
    aiff.unlink()

engine = "groq"
KEEP = "--keep" in sys.argv  # use recordings already in public/vo (your own voice); only measure them
lines = []
for i, t in enumerate(LINES):
    out = ROOT / "public" / "vo" / f"{i:02d}.wav"
    if KEEP and out.exists():
        engine = "recorded"
    try:
        if engine == "groq":
            groq(t, out)
    except Exception as e:
        print("groq tts unavailable, using macOS say:", str(e)[:120]); engine = "say"
    if engine == "say" and not (KEEP and out.exists()):
        say(t, out)
    with contextlib.closing(wave.open(str(out))) as w:
        secs = w.getnframes() / w.getframerate()
    lines.append({"text": t, "file": f"vo/{i:02d}.wav", "seconds": round(secs, 3)})
(ROOT / "src").mkdir(exist_ok=True)
(ROOT / "src" / "timeline.json").write_text(json.dumps({"engine": engine, "lines": lines}, indent=1))
print(engine, round(sum(l["seconds"] for l in lines), 1), "s of narration")
