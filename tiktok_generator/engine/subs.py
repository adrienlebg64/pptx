"""Subtitle grouping (2-5 words), SRT export and TikTok-style sprite rendering."""
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PUNCT_END = re.compile(r"[,;:…!?.]$")
# a group should not end on these (they belong with the next word)
STOP = {"à", "a", "au", "aux", "de", "du", "des", "le", "la", "les", "un", "une", "et", "en", "est",
        "il", "son", "sa", "ses", "pour", "par", "sur", "que", "ce", "cette", "mais", "puis", "dans",
        "vient", "jusqu'en", "d'", "l'", "qu'", "chez", "très", "plus", "tout", "toute", "contre"}


def clean(w):
    return re.sub(r"^[«“\"(]+|[»”\")…,;:!?.]+$", "", w).lower()


def group_words(words, min_w=2, max_w=5, max_chars=24):
    """Split one line's [(word, t0, t1)] into readable groups (dynamic programming):
    2-`max_w` words, breaks on punctuation, never ends on a function word."""
    n = len(words)

    def cost(a, b):
        g = [w for w, _, _ in words[a:b]]
        k, c = len(g), len(" ".join(g))
        if k > max_w or c > max_chars + 10:
            return 1e9
        last = b == n
        pen = 1.0 + max(0, c - max_chars) ** 2 * 0.6 + max(0, 9 - c) ** 2 * 0.15
        if k < min_w and not (last and a == 0):
            pen += 2.5 if PUNCT_END.search(g[-1]) and c >= 6 else 9
        if not last and clean(g[-1]) in STOP:
            pen += 10
        if not last and not PUNCT_END.search(g[-1]):
            pen += 1.2
        pen += 6 * sum(1 for w in g[:-1] if PUNCT_END.search(w))
        return pen

    best = [0.0] + [1e18] * n
    prev = [0] * (n + 1)
    for b in range(1, n + 1):
        for a in range(max(0, b - max_w), b):
            v = best[a] + cost(a, b)
            if v < best[b]:
                best[b], prev[b] = v, a
    cuts, b = [], n
    while b > 0:
        cuts.append((prev[b], b))
        b = prev[b]
    return [words[a:b] for a, b in reversed(cuts)]


def build_cues(timeline, scfg):
    """Return cues: dict(text, words, start, end, burn)."""
    cues = []
    for sc in timeline["scenes"]:
        burn = sc.get("burn_subtitles", True)
        for ln in sc["lines"]:
            gs = group_words(ln["words"], scfg["min_words"], scfg["max_words"], scfg["max_chars"])
            for j, g in enumerate(gs):
                start = g[0][1]
                end = gs[j + 1][0][1] if j + 1 < len(gs) else ln["end"] + 0.25
                cues.append({"words": [w for w, _, _ in g], "start": start, "end": end, "burn": burn})
    for a, b in zip(cues, cues[1:]):  # never overlap
        a["end"] = min(a["end"], b["start"])
    for c in cues:
        c["text"] = " ".join(c["words"])
    return cues


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(cues, path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for i, c in enumerate(cues, 1):
            f.write(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n\n")


def load_font(scfg, root, size):
    for p in [scfg["font"], *scfg.get("font_fallbacks", [])]:
        path = Path(p) if Path(p).is_absolute() else Path(root) / p
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size)


def render_sprite(words, scfg, font):
    """RGBA numpy sprite of a cue: white text, black outline, yellow keywords,
    soft drop shadow. Wraps to two balanced lines when too wide."""
    keys = {k.lower() for k in scfg["keywords"]}
    stroke = int(scfg["stroke"])
    space = font.getlength(" ")
    widths = [font.getlength(w) for w in words]
    lines = [list(range(len(words)))]
    if sum(widths) + space * (len(words) - 1) > scfg["max_width"] and len(words) > 1:
        best = min(range(1, len(words)), key=lambda k: abs(sum(widths[:k]) - sum(widths[k:])))
        lines = [list(range(best)), list(range(best, len(words)))]
    asc, desc = font.getmetrics()
    lh = int((asc + desc) * 1.08)
    W = int(max(sum(widths[i] for i in ln) + space * (len(ln) - 1) for ln in lines)) + 4 * stroke + 40
    H = lh * len(lines) + 4 * stroke + 40
    txt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow = Image.new("L", (W, H), 0)
    d, ds = ImageDraw.Draw(txt), ImageDraw.Draw(shadow)
    for li, ln in enumerate(lines):
        lw = sum(widths[i] for i in ln) + space * (len(ln) - 1)
        x = (W - lw) / 2
        y = 20 + 2 * stroke + li * lh
        for i in ln:
            col = tuple(scfg["highlight_color"]) if clean(words[i]) in keys else tuple(scfg["color"])
            d.text((x, y), words[i], font=font, fill=col + (255,), stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
            ds.text((x, y + 6), words[i], font=font, fill=170, stroke_width=stroke + 2)
            x += widths[i] + space
    shadow = shadow.filter(ImageFilter.GaussianBlur(9))
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base.putalpha(shadow)
    base.alpha_composite(txt)
    return np.asarray(base).copy()


def render_label(text, font, opacity=0.85):
    W = int(font.getlength(text)) + 40
    asc, desc = font.getmetrics()
    H = asc + desc + 30
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).text((20, 17), text, font=font, fill=200)
    img.putalpha(sh.filter(ImageFilter.GaussianBlur(4)))
    ImageDraw.Draw(img).text((20, 15), text, font=font, fill=(255, 255, 255, int(255 * opacity)))
    return np.asarray(img).copy()
