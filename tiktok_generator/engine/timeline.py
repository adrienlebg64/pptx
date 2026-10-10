"""Builds the master timeline from the real narration audio.

Every scene lasts exactly as long as its narration lines (+ pauses), so images
change on sentence boundaries and never cut a phrase. Word timings inside a
line are estimated from syllable weights, then snapped to the pauses that are
actually audible in the synthesised audio (commas, ellipses).
"""
import re

import numpy as np

from .tts import spoken_text
from .util import SR

VOWELS = re.compile(r"[aeiouyàâäéèêëîïôöùûüœæ]+", re.I)


def syllables(word):
    return max(1, len(VOWELS.findall(word)))


def internal_pauses(x, min_len=0.09, thresh_db=-38):
    """Return centre times (s) of silent gaps inside a line, longest first."""
    hop = int(0.01 * SR)
    frames = np.abs(x[: len(x) // hop * hop]).reshape(-1, hop).max(1)
    thr = 10 ** (thresh_db / 20) * max(frames.max(), 1e-6)
    silent = frames < thr
    gaps, start = [], None
    for i, s in enumerate(silent):
        if s and start is None:
            start = i
        elif not s and start is not None:
            if (i - start) * 0.01 >= min_len and start > 5 and i < len(frames) - 5:
                gaps.append(((start + i) / 2 * 0.01, (i - start) * 0.01, start * 0.01, i * 0.01))
            start = None
    return sorted(gaps, key=lambda g: -g[1])


def align_words(text, audio, pronunciations):
    """Return [(word, t0, t1)] relative to the start of the line audio."""
    words = text.split()
    spoken = [spoken_text(w, pronunciations) for w in words]
    weights = np.array([sum(syllables(s) for s in sp.split()) + 0.35 for sp in spoken], float)
    dur = len(audio) / SR
    # chunks separated by punctuation that usually produces a pause
    breaks = [i for i, w in enumerate(words[:-1]) if re.search(r"[,;:…!?.]$", w)]
    gaps = internal_pauses(audio)
    anchors = []  # (word_index_after_break, gap_start, gap_end)
    if breaks and len(gaps) >= len(breaks):
        chosen = sorted(gaps[: len(breaks)], key=lambda g: g[0])
        anchors = [(b + 1, g[2], g[3]) for b, g in zip(breaks, chosen)]
    # build segments [w0, w1) with time spans
    segs, w0, t0 = [], 0, 0.0
    for wi, gs, ge in anchors:
        segs.append((w0, wi, t0, gs))
        w0, t0 = wi, ge
    segs.append((w0, len(words), t0, dur))
    out = []
    for a, b, s, e in segs:
        w = weights[a:b]
        edges = s + np.concatenate([[0], np.cumsum(w)]) / w.sum() * (e - s)
        out += [(words[k], float(edges[k - a]), float(edges[k - a + 1])) for k in range(a, b)]
    return out


def build(cfg, voice):
    vcfg = cfg["voice"]
    pron = cfg.get("pronunciations", {})
    t = float(vcfg.get("lead_in", 0.15))
    scenes, clips = [], []
    for i, sc in enumerate(cfg["scenes"]):
        start = 0.0 if i == 0 else t
        t += float(sc.get("lead_in", 0))
        lines = []
        for ln in sc.get("lines", []):
            audio = voice.synth(spoken_text(ln["text"], pron))
            d = len(audio) / SR
            words = [(w, t + a, t + b) for w, a, b in align_words(ln["text"], audio, pron)]
            lines.append({"text": ln["text"], "start": t, "end": t + d, "words": words})
            clips.append((t, audio))
            t += d + float(ln.get("pause", 0.4)) * float(vcfg.get("pause_scale", 1.0))
        t += float(sc.get("hold", 0))
        if not lines:
            t += float(sc.get("duration", 3.0))
        scenes.append({**sc, "index": i, "start": start, "end": t, "lines": lines})
    total = t + float(vcfg.get("tail", 0.2))
    scenes[-1]["end"] = total
    voice_track = np.zeros(int(total * SR) + SR, np.float32)
    for st, a in clips:
        k = int(st * SR)
        voice_track[k:k + len(a)] += a
    return {"scenes": scenes, "duration": total, "voice": voice_track[: int(total * SR)]}
