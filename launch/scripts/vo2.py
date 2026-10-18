"""Narration v2 (Kokoro, local, free). Each clip: (caption, spoken). Writes public/vo2/NN.wav + src/timeline2.json."""
import json, pathlib, sys, soundfile as sf
from kokoro_onnx import Kokoro

TTS = pathlib.Path(sys.argv[1])  # dir with kokoro-v1.0.onnx + voices-v1.0.bin
ROOT = pathlib.Path(__file__).resolve().parent.parent
UB = "Oobermensh-un"
CLIPS = [
    ("We are Ubermenschen, and today we are launching Echo.", f"We are {UB}, and today, we are launching Echo."),
    ("Think about an agent doing research, comparing products, or helping you make a decision.", None),
    ("It reads, remembers, and builds on what it finds.", None),
    ("But what happens when five sources repeat the same claim?", None),
    ("The agent might remember five confirmations when there's really only one original source.", None),
    ("That's the problem we wanted to solve.", None),
    ("Echo traces those connections, separates repeated information from independent support, and helps agents understand what their beliefs are actually based on.", None),
    ("Here's how it works.", None),
    ("Ask the agent a question.", None),
    ("Compare its answer with a plain memory.", None),
    ("Open a belief, trace its sources back to their origins, and inspect the evidence behind those connections.", None),
    ("And when a source gets retracted, Echo checks the beliefs that depended on it and updates their verdicts.", None),
    ("We built this on FalkorDB because Echo needs to do more than store sources.", "We built this on Falkor D B, because Echo needs to do more than store sources."),
    ("It needs to understand how they connect, follow those relationships, and trace evidence across the graph.", None),
    ("And you can make it work with your own setup.", None),
    ("Configure your model, connect Echo to your agent workflow, and access its tools through the API or MCP.", "Configure your model, connect Echo to your agent workflow, and access its tools through the A P I, or M C P."),
    ("If you're a researcher, trace claims back to their origins.", None),
    ("If you're building agents, inspect their memory and check the evidence behind their decisions.", None),
    ("And if you're using agents to make decisions, see whether their confidence comes from independent evidence, or the same claim repeated over and over.", None),
    ("Echo doesn't promise that every claim is true.", None),
    ("It helps you understand where the evidence comes from, and whether those sources are actually independent.", None),
    ("Because better agents need more than better answers.", None),
    ("They need memory they can check.", None),
    ("We're excited to see what you build with Echo.", None),
    ("We're Ubermenschen, and this is Echo.", f"We're {UB}. And this, is Echo."),
]
k = Kokoro(str(TTS / "kokoro-v1.0.onnx"), str(TTS / "voices-v1.0.bin"))
out = []
for i, (cap, spoken) in enumerate(CLIPS):
    a, sr = k.create(spoken or cap, voice="af_heart", speed=0.98, lang="en-us")
    f = ROOT / "public" / "vo2" / f"{i:02d}.wav"
    sf.write(f, a, sr)
    out.append({"text": cap, "file": f"vo2/{i:02d}.wav", "seconds": round(len(a) / sr, 3)})
(ROOT / "src" / "timeline2.json").write_text(json.dumps({"engine": "kokoro af_heart", "lines": out}, indent=1))
print(round(sum(l["seconds"] for l in out), 1), "s narration,", len(out), "clips")
