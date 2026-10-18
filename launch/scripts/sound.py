"""Original score and sound effects, synthesised (no samples, no licences). Writes public/sfx/*.wav."""
import numpy as np, soundfile as sf, pathlib
SR = 48000
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "sfx"
rng = np.random.default_rng(7)

def t(sec): return np.arange(int(sec * SR)) / SR
def env(n, a, d, sus=1.0, r=None):
    e = np.ones(n) * sus
    ai = int(a * SR); di = int(d * SR)
    e[:ai] = np.linspace(0, 1, ai) if ai else e[:ai]
    if r: ri = int(r * SR); e[-ri:] *= np.linspace(1, 0, ri)
    return e
def lp(x, k=0.02):  # one-pole low-pass
    y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)): acc += k * (x[i] - acc); y[i] = acc
    return y
def echo(x, delay=0.38, fb=0.45, n=4):
    out = np.copy(x); d = int(delay * SR)
    out = np.concatenate([out, np.zeros(d * n)])
    for k in range(1, n + 1): out[d * k:d * k + len(x)] += x * (fb ** k)
    return out
def stereo(x, w=0.0):
    return np.stack([x * (1 - w), x * (1 + w)], axis=1)
def norm(x, peak=0.9): return x / (np.abs(x).max() + 1e-9) * peak
def save(name, x, peak=0.9):
    if x.ndim == 1: x = stereo(x)
    sf.write(OUT / f"{name}.wav", norm(x, peak), SR)

# --- echo tone: a soft bell with three repeats (open and close)
tt = t(1.6)
bell = (np.sin(2*np.pi*660*tt) + 0.5*np.sin(2*np.pi*990*tt) + 0.25*np.sin(2*np.pi*1320*tt)) * np.exp(-tt*3.2)
save("echo_tone", echo(bell, 0.42, 0.5, 3), 0.6)

# --- thump: soft heartbeat-ish low hit
tt = t(0.45)
f = 70 * np.exp(-tt * 9) + 42
th = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-tt * 9)
save("thump", th, 0.85)

# --- tick: crisp UI click
tt = t(0.06)
tk = (rng.standard_normal(len(tt)) * np.exp(-tt * 140)) + 0.6*np.sin(2*np.pi*2400*tt)*np.exp(-tt*90)
save("tick", tk, 0.45)

# --- riser: filtered noise sweep up (2.2 s)
tt = t(2.2); n = rng.standard_normal(len(tt))
k = np.linspace(0.004, 0.25, len(tt)); y = np.zeros_like(n); acc = 0
for i in range(len(n)): acc += k[i] * (n[i] - acc); y[i] = acc
y *= np.linspace(0, 1, len(tt)) ** 2
y += 0.25 * np.sin(2*np.pi*np.cumsum(np.linspace(110, 440, len(tt)))/SR) * np.linspace(0, 1, len(tt))**3
save("riser", y, 0.55)

# --- whoosh: band noise swell and fall (0.9 s)
tt = t(0.9); n = rng.standard_normal(len(tt))
e = np.sin(np.pi * np.linspace(0, 1, len(tt))) ** 2
save("whoosh", lp(n, 0.06) * e, 0.6)

# --- hit: deep impact with a short tail
tt = t(2.4)
f = 55 * np.exp(-tt * 4) + 38
hit = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-tt * 2.2) + 0.3 * lp(rng.standard_normal(len(tt)), 0.05) * np.exp(-tt * 6)
save("hit", echo(hit, 0.3, 0.3, 2), 0.95)

# --- pad bed: slow evolving A-minor chords (130 s), warm and quiet
dur = 130; tt = t(dur)
chords = [[110, 164.81, 220, 261.63, 329.63], [87.31, 130.81, 174.61, 220, 261.63], [130.81, 196, 261.63, 329.63, 392], [98, 146.83, 196, 246.94, 293.66]]
pad = np.zeros(len(tt)); seg = 8.0
for ci in range(int(dur / seg) + 1):
    ch = chords[ci % 4]; s0 = int(ci * seg * SR); s1 = min(len(tt), int((ci + 1) * seg * SR) + int(2 * SR))
    if s0 >= len(tt): break
    local = tt[s0:s1] - tt[s0]
    e = np.minimum(1, local / 2.0) * np.minimum(1, (local[-1] - local + 1e-9) / 2.0)
    for j, fr in enumerate(ch):
        pad[s0:s1] += (0.22 / (1 + j * 0.35)) * np.sin(2*np.pi*fr*local + j) * (0.8 + 0.2*np.sin(2*np.pi*0.1*local + j)) * e
pad = lp(pad, 0.08)
padL = pad + 0.6 * np.concatenate([np.zeros(int(0.31*SR)), pad[:-int(0.31*SR)]])
padR = pad + 0.6 * np.concatenate([np.zeros(int(0.47*SR)), pad[:-int(0.47*SR)]])
sf.write(OUT / "pad.wav", norm(np.stack([padL, padR], 1), 0.5), SR)

# --- pulse: 100 bpm soft kick + shaker, 32 bars (loopable), for "how it works" onwards
bpm = 100; beat = 60 / bpm; dur = beat * 4 * 16; tt = t(dur); pulse = np.zeros(len(tt))
kk = t(0.35); kick = np.sin(2*np.pi*np.cumsum(60*np.exp(-kk*14)+45)/SR) * np.exp(-kk*10)
sh = rng.standard_normal(int(0.05*SR)) * np.exp(-t(0.05)*80)
for b in range(int(dur / beat)):
    s = int(b * beat * SR); pulse[s:s+len(kick)] += kick[:len(pulse)-s] * 0.9
    for h in (0.5,):
        s2 = int((b + h) * beat * SR)
        if s2 + len(sh) < len(pulse): pulse[s2:s2+len(sh)] += lp(sh, 0.5) * 0.18
bass_notes = [55, 43.65, 65.41, 49]
for bar in range(16):
    fr = bass_notes[bar % 4]; s = int(bar * 4 * beat * SR); n = int(4 * beat * SR); local = t(4 * beat)[:min(n, len(pulse)-s)]
    pulse[s:s+len(local)] += 0.35 * np.sin(2*np.pi*fr*local) * (1 - np.exp(-local*20)) * np.exp(-local*0.4)
sf.write(OUT / "pulse.wav", norm(stereo(pulse), 0.7), SR)
print("ok", sorted(p.name for p in OUT.iterdir()))
