"""Procedural sound design and music (no third-party recordings → no rights issue).

Everything is synthesised with numpy/scipy: an orchestral-like pad score that
follows the mood of each scene, plus discreet SFX (city, blast, train, wind,
ear ringing, heartbeat). A licensed music file can replace the score
(config: music.mode = "file").
"""
import numpy as np
from scipy import signal

from .util import SR, read_audio

RNG = np.random.default_rng(1945)


def db(x):
    return 10 ** (x / 20)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def noise(n):
    return RNG.standard_normal(n).astype(np.float32)


def brown(n):
    b = np.cumsum(noise(n))
    b = hp(b, 20)
    return b / (np.abs(b).max() + 1e-9)


def norm(x, peak=1.0):
    return x / (np.abs(x).max() + 1e-9) * peak


def fades(x, fin=0.3, fout=0.5):
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a) ** 2
    if b:
        x[-b:] *= np.linspace(1, 0, b) ** 2
    return x


def reverb(x, seconds=2.6, mix=0.35):
    n = int(seconds * SR)
    ir = noise(n) * np.exp(-np.linspace(0, 7, n))
    ir = lp(ir, 5000)
    wet = signal.fftconvolve(x, ir)[: len(x)]
    return x * (1 - mix) + norm(wet, np.abs(x).max() + 1e-9) * mix


# ------------------------------------------------------------------ SFX
def sfx_city(d):
    n = int(d * SR)
    rumble = lp(brown(n), 350) * 0.8
    murmur = bp(noise(n), 250, 1800) * 0.25
    lfo = 0.7 + 0.3 * np.sin(2 * np.pi * 0.23 * np.arange(n) / SR + 1.3)
    steps = np.zeros(n, np.float32)
    for t in np.arange(0.3, d, 0.52):
        k = int((t + RNG.uniform(-0.03, 0.03)) * SR)
        m = min(n - k, int(0.05 * SR))
        if m > 0:
            steps[k:k + m] += noise(m) * np.exp(-np.linspace(0, 9, m)) * 0.25
    steps = bp(steps, 300, 3000)
    return fades(norm(rumble + murmur * lfo + steps), 0.4, 0.6)


def sfx_bell(d=2.5):
    t = np.arange(int(d * SR)) / SR
    x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * r)
            for f, a, r in [(1180, 1, 2.2), (2290, .5, 3), (3390, .25, 4), (1185, .6, 2.0)])
    x = np.concatenate([x, 0.6 * x[: int(1.2 * SR)]])[: len(t)] if d > 1.5 else x
    return norm(lp(x, 4000)) * 0.9


def sfx_explosion(d=5.0):
    n = int(d * SR)
    t = np.arange(n) / SR
    crack = hp(noise(n), 900) * np.exp(-t * 28)
    body = noise(n) * np.exp(-t * 0.9)
    # sweep the low-pass down: bright blast fading into a distant rumble
    out = np.zeros(n, np.float32)
    seg = int(0.05 * SR)
    for k in range(0, n, seg):
        f = 3500 * np.exp(-k / SR * 1.6) + 120
        out[k:k + seg] = lp(body[max(0, k - 2000):k + seg], f)[-len(body[k:k + seg]):]
    sub_f = 58 * np.exp(-t * 0.5) + 26
    sub = np.sin(2 * np.pi * np.cumsum(sub_f) / SR) * np.exp(-t * 0.8)
    x = 0.35 * crack + 0.9 * norm(out) + 0.9 * sub
    return fades(norm(reverb(x, 3.0, 0.3)), 0.004, 1.2)


def sfx_rumble(d=4.0):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = lp(brown(n), 140) * (1 - np.exp(-t * 3)) * np.exp(-t * 0.5)
    return fades(norm(x), 0.3, 1.5)


def sfx_boom(d=3.0):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(45 * np.exp(-t * 0.7) + 30) / SR) * np.exp(-t * 1.4)
    x += 0.3 * lp(noise(n), 200) * np.exp(-t * 2)
    return norm(reverb(x, 2.5, 0.35))


def sfx_wind(d):
    n = int(d * SR)
    x = noise(n)
    out = np.zeros(n, np.float32)
    seg = int(0.1 * SR)
    for k in range(0, n, seg):
        c = 500 + 250 * np.sin(2 * np.pi * 0.17 * k / SR) + 120 * np.sin(2 * np.pi * 0.41 * k / SR)
        out[k:k + seg] = bp(x[max(0, k - 4000):k + seg], c * 0.6, c * 1.6)[-len(x[k:k + seg]):]
    amp = 0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * np.arange(n) / SR) ** 2
    return fades(norm(out * amp + 0.4 * lp(brown(n), 200)), 0.8, 0.8)


def sfx_train(d):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = np.zeros(n, np.float32)
    rate = 3.6  # chuffs per second
    for i, tc in enumerate(np.arange(0.05, d, 1 / rate)):
        k = int(tc * SR)
        m = min(n - k, int(0.22 * SR))
        acc = 1.0 if i % 4 == 0 else 0.6
        x[k:k + m] += noise(m) * np.exp(-np.linspace(0, 6, m)) * acc
    chuff = bp(x, 150, 1400)
    clack = np.zeros(n, np.float32)
    for tc in np.arange(0.4, d, 1.15):
        for off in (0, 0.13):
            k = int((tc + off) * SR)
            m = min(n - k, int(0.03 * SR))
            if m > 0:
                clack[k:k + m] += noise(m) * np.exp(-np.linspace(0, 10, m))
    clack = bp(clack, 1500, 6000) * 0.4
    wd = min(1.6, d)
    tw = t[: int(wd * SR)]
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * tw)
    whistle = sum(np.sin(2 * np.pi * f * vib * tw) / (j + 1) for j, f in enumerate((440, 554, 659)))
    whistle *= np.minimum(1, tw / 0.15) * np.minimum(1, (wd - tw) / 0.4)
    w = np.zeros(n, np.float32)
    w[int(0.3 * SR): int(0.3 * SR) + len(whistle)] = whistle[: max(0, n - int(0.3 * SR))] * 0.18
    x = lp(norm(chuff) + clack + lp(brown(n), 120) * 0.5 + w, 4500)
    return fades(norm(reverb(x, 1.5, 0.2)), 0.6, 0.8)


def sfx_ring(d=3.5):
    t = np.arange(int(d * SR)) / SR
    x = np.sin(2 * np.pi * 3950 * t) + 0.5 * np.sin(2 * np.pi * 3957 * t)
    return fades(norm(x) * np.exp(-t * 0.6), 0.02, 1.0)


def sfx_heartbeat(d):
    n = int(d * SR)
    x = np.zeros(n, np.float32)
    beat = int(0.12 * SR)
    tb = np.arange(beat) / SR
    thump = np.sin(2 * np.pi * 52 * tb) * np.exp(-tb * 30)
    for tc in np.arange(0.2, d - 0.3, 0.92):
        for off, a in ((0, 1), (0.24, 0.7)):
            k = int((tc + off) * SR)
            x[k:k + beat] += thump[: len(x[k:k + beat])] * a
    return fades(norm(lp(x, 200)), 0.6, 0.4)


def sfx_riser(d=1.6):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = bp(noise(n), 400, 6000) * (t / d) ** 3
    return fades(norm(reverb(x, 1.2, 0.3)), 0.0, 0.05)


SFX = {"city": sfx_city, "bell": sfx_bell, "explosion": sfx_explosion, "rumble": sfx_rumble,
       "boom": sfx_boom, "wind": sfx_wind, "train": sfx_train, "ring": sfx_ring,
       "heartbeat": sfx_heartbeat, "riser": sfx_riser}
BED = {"city", "wind", "train", "heartbeat"}  # these span the whole scene


# ------------------------------------------------------------------ music
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(name):
    letter, acc, octave = name[0], name[1:-1], int(name[-1])
    semis = NOTE[letter] + acc.count("#") - acc.count("b")
    return 440 * 2 ** ((semis + 12 * (octave - 4) - 9) / 12)


CHORDS = {  # mood -> chord progression (bass + voicing)
    "calm": [["D2", "A2", "F3", "A3", "E4"], ["Bb1", "F2", "D3", "F3", "A3"]],
    "tension": [["D2", "A2", "D3", "F3", "C4"], ["Bb1", "F2", "Db3", "F3", "Bb3"]],
    "impact": [["D1", "D2", "A2"]],
    "silence": [["D1", "D2"]],
    "somber": [["G1", "D2", "Bb2", "D3", "G3"], ["D2", "A2", "D3", "F3", "A3"]],
    "hope": [["Bb1", "F2", "D3", "F3", "C4"], ["F1", "C2", "A2", "C3", "F3"], ["C2", "G2", "E3", "G3", "D4"], ["D2", "A2", "D3", "F3", "A3"]],
}
LEVEL = {"calm": 0.55, "tension": 0.8, "impact": 0.0, "silence": 0.0, "somber": 0.7, "hope": 0.9}


def pad_voice(f, n, bright):
    t = np.arange(n) / SR
    x = np.zeros(n, np.float32)
    for det in (-0.12, 0.0, 0.11):  # detuned ensemble = string-like
        ff = f * 2 ** (det / 12)
        ph = RNG.uniform(0, 2 * np.pi)
        for h in range(1, 10):
            if ff * h > 6000:
                break
            x += np.sin(2 * np.pi * ff * h * t + ph * h) / h ** (2.2 - bright)
    return x


def music_score(scenes, total):
    n = int(total * SR) + SR
    out = np.zeros(n, np.float32)
    chord_len = 3.2
    for sc in scenes:
        mood = sc.get("mood", "calm")
        s0, s1 = sc["start"], sc["end"]
        prog = CHORDS[mood]
        t = s0
        while t < s1 - 0.05:
            d = min(chord_len, s1 - t)
            k0 = int(t * SR)
            m = int((d + 1.6) * SR)  # tails overlap → legato
            chord = prog[int((t / chord_len)) % len(prog)]
            bright = 0.5 if mood == "hope" else 0.2
            x = sum(pad_voice(hz(nm), m, bright) * (1.2 if i == 0 else 0.6) for i, nm in enumerate(chord))
            env = np.minimum(1, np.arange(m) / (0.9 * SR)) * np.minimum(1, (m - np.arange(m)) / (1.5 * SR))
            seg = lp(x * env, 1800 if mood != "hope" else 3200) * LEVEL[mood]
            out[k0:k0 + m] += seg[: len(out[k0:k0 + m])]
            t += d
        if mood == "hope":  # sparse piano-like notes for the emotional ending
            for j, nm in enumerate(["A4", "F4", "D5", "C5", "A4", "F4"]):
                tc = s0 + 0.4 + j * 1.25
                if tc > s1:
                    break
                k0 = int(tc * SR)
                m = int(2.5 * SR)
                tt = np.arange(m) / SR
                f = hz(nm)
                p = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt) + 0.1 * np.sin(6 * np.pi * f * tt))
                p *= np.exp(-tt * 1.6) * np.minimum(1, tt / 0.005)
                out[k0:k0 + m] += p[: len(out[k0:k0 + m])] * 0.9
    drone = lp(brown(n), 90) * 0.5 + np.sin(2 * np.pi * hz("D1") * np.arange(n) / SR) * 0.25
    # drone follows the scene levels (drops out on silence)
    lvl = np.zeros(n, np.float32)
    for sc in scenes:
        lvl[int(sc["start"] * SR):int(sc["end"] * SR)] = 0 if sc.get("mood") in ("silence",) else 1
    lvl = lp(lvl, 1.5, 1)
    out = reverb(out, 3.2, 0.4) + drone * lvl * 0.6
    return norm(out[: int(total * SR)], 0.9)


# ------------------------------------------------------------------ mix
def envelope(x, attack=0.02, release=0.35):
    a = np.abs(x)
    hop = 441
    frames = a[: len(a) // hop * hop].reshape(-1, hop).max(1)
    env = np.zeros_like(frames)
    ca, cr = np.exp(-hop / (attack * SR)), np.exp(-hop / (release * SR))
    v = 0.0
    for i, f in enumerate(frames):
        v = ca * v + (1 - ca) * f if f > v else cr * v + (1 - cr) * f
        env[i] = v
    env = np.repeat(env, hop)
    return np.pad(env, (0, len(x) - len(env)), mode="edge")


def mix(tl, cfg, root):
    total = tl["duration"]
    n = int(total * SR)
    voice = tl["voice"][:n]
    voice = np.pad(voice, (0, n - len(voice)))
    voice = voice / (np.abs(voice).max() + 1e-9) * db(-3)
    mcfg = cfg["music"]
    if mcfg.get("mode") == "file" and mcfg.get("file"):
        music = read_audio(f"{root}/{mcfg['file']}")
        music = np.resize(music, n) if len(music) < n else music[:n]
        music = fades(norm(music, 0.9), 1.0, 2.0)
    elif mcfg.get("mode") == "none":
        music = np.zeros(n, np.float32)
    else:
        music = music_score(tl["scenes"], total)
    # sidechain ducking under the narration
    env = envelope(voice)
    duck = 1 - (1 - db(-float(mcfg.get("duck_db", 7)))) * np.clip(env / (env.max() * 0.25 + 1e-9), 0, 1)
    music = music * duck * db(float(mcfg.get("gain_db", -20)))
    sfx = np.zeros(n, np.float32)
    unmasked = np.zeros(n, np.float32)  # ear ringing stays audible during the silence
    silence_mask = np.ones(n, np.float32)
    for sc in tl["scenes"]:
        s0, s1 = sc["start"], sc["end"]
        for fx in sc.get("sfx", []):
            kind = fx["type"]
            if kind in BED:
                d = s1 - s0 + 0.6
                x = SFX[kind](d)
                k0 = int(max(0, s0 - 0.3) * SR)
            else:
                at = s1 + fx["at_end"] if "at_end" in fx else s0 + fx.get("at", 0)
                x = SFX[kind]()
                k0 = int(at * SR)
            if fx.get("muted"):  # muffled, distant: the "silence" after the second blast
                x = lp(x, 180) * 0.6
            seg = x * db(fx.get("gain_db", -20))
            dst = unmasked if kind == "ring" else sfx
            dst[k0:k0 + len(seg)] += seg[: len(dst[k0:k0 + len(seg)])]
        if sc.get("mood") == "silence":
            # brief silence: everything except voice/ring dips right after the flash
            k0, k1 = int(s0 * SR), int((s0 + 0.95) * SR)
            silence_mask[k0:k1] = 0.15
    silence_mask = lp(silence_mask, 6, 1).astype(np.float32)
    sfx_duck = 1 - (1 - db(-float(mcfg.get("sfx_duck_db", 0)))) * np.clip(env / (env.max() * 0.25 + 1e-9), 0, 1)
    bed = (music + sfx * sfx_duck) * silence_mask + unmasked
    full = voice + bed
    return voice, full / max(1.0, np.abs(full).max() / 0.98)
