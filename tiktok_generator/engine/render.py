"""Frame renderer: virtual camera over each plate (eased keyframes, 2.5D parallax),
clean transitions, explosion flashes, animated subtitles, grain and vignette.
Frames are piped straight into ffmpeg (H.264 + AAC)."""
import math
import os
import subprocess
from multiprocessing import Pool

import cv2
import numpy as np

from .util import FFMPEG, log

CTX = {}


def smooth(p):
    return 0.5 - 0.5 * math.cos(math.pi * min(1.0, max(0.0, p)))


def ease_out_back(p, s=1.6):
    p = min(1.0, max(0.0, p)) - 1
    return 1 + (s + 1) * p ** 3 + s * p ** 2


def _init(ctx):
    global CTX
    CTX = ctx
    W, H = ctx["W"], ctx["H"]
    gy, gx = np.mgrid[0:H, 0:W].astype(np.float32)
    CTX["gx"], CTX["gy"] = gx, gy
    CTX["ground"] = np.clip((gy / H - 0.2) / 0.8, 0, 1) ** 1.3
    r = np.sqrt(((gx - W / 2) / (W / 2)) ** 2 * 0.6 + ((gy - H / 2) / (H / 2)) ** 2 * 0.6)
    vig = 1 - ctx["vignette"] * np.clip(r, 0, 1.3) ** 2.2
    CTX["vig"] = np.repeat((np.clip(vig, 0, 1) * 255).astype(np.uint8)[..., None], 3, 2)
    rng = np.random.default_rng(7)
    CTX["grain"] = [cv2.resize(rng.normal(0, ctx["grain"], (H // 2, W // 2)).astype(np.float32), (W, H))
                    .astype(np.int16)[..., None] for _ in range(10)]


def camera_frame(i, t):
    """Render scene i at absolute time t (may be slightly outside its range)."""
    c = CTX
    sc = c["scenes"][i]
    plate = c["plates"][i]
    W, H = c["W"], c["H"]
    Hp, Wp = plate.shape[:2]
    p = (t - sc["vis_start"]) / (sc["vis_end"] - sc["vis_start"])
    e = smooth(p)
    (z0, x0, y0), (z1, x1, y1) = sc["motion"]["from"], sc["motion"]["to"]
    zoom, fx, fy = z0 + (z1 - z0) * e, x0 + (x1 - x0) * e, y0 + (y1 - y0) * e
    hmax = min(Hp, Wp * H / W) * 0.965
    wh = hmax / zoom
    ww = wh * W / H
    s = wh / H
    cx = min(max(fx * Wp, ww / 2), Wp - ww / 2)
    cy = min(max(fy * Hp, wh / 2), Hp - wh / 2)
    # explosion: short decaying camera shake
    if sc.get("flash"):
        tf = t - sc["start"]
        if 0 <= tf < 1.5:
            a = 10 * math.exp(-tf / 0.3)
            cx += a * s * math.sin(tf * 57)
            cy += a * s * math.cos(tf * 43)
    gx, gy = c["gx"], c["gy"]
    mx = cx + (gx - W / 2) * s
    my = cy + (gy - H / 2) * s
    par = sc.get("parallax")
    if par:
        q = 2 * e - 1
        amt = float(par.get("amount", 12))
        if par.get("mode") == "subject":
            fpx, fpy = par["focus"]
            sx, sy = (fpx * Wp - cx) / s + W / 2, (fpy * Hp - cy) / s + H / 2
            depth = np.exp(-((gx - sx) ** 2 + (gy - sy) ** 2) / (2 * 330.0 ** 2))
        else:
            depth = c["ground"]
        depth = depth - 0.5
        pan = np.array([(x1 - x0) * Wp, (y1 - y0) * Hp])
        norm_pan = np.linalg.norm(pan)
        if norm_pan > 1:
            dx, dy = pan / norm_pan
            mx = mx + amt * q * depth * dx * s
            my = my + amt * q * depth * dy * s
        if abs(z1 - z0) > 0.01:  # push-in: near layers grow faster
            k = amt / (W / 2) * q * np.sign(z1 - z0)
            mx = mx - (gx - W / 2) * k * depth * s
            my = my - (gy - H / 2) * k * depth * s
    frame = cv2.remap(plate, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_CUBIC,
                      borderMode=cv2.BORDER_REFLECT101)
    return frame


def flash_amount(t):
    c = CTX
    f = 0.0
    for sc in c["scenes"]:
        if not sc.get("flash"):
            continue
        tf = t - sc["start"]
        if -0.1 <= tf < 0:
            f = max(f, 0.55 * (1 + tf / 0.1))
        elif 0 <= tf < 1.5:
            f = max(f, 0.9 * math.exp(-tf / 0.22))
    return f


def composite(dst, sprite, cx, cy, scale, alpha):
    if alpha <= 0.01:
        return
    if abs(scale - 1) > 0.005:
        sprite = cv2.resize(sprite, None, fx=scale, fy=scale, interpolation=cv2.INTER_LINEAR)
    h, w = sprite.shape[:2]
    x0, y0 = int(cx - w / 2), int(cy - h / 2)
    H, W = dst.shape[:2]
    sx0, sy0 = max(0, -x0), max(0, -y0)
    x0c, y0c = max(0, x0), max(0, y0)
    x1c, y1c = min(W, x0 + w), min(H, y0 + h)
    if x1c <= x0c or y1c <= y0c:
        return
    sp = sprite[sy0:sy0 + (y1c - y0c), sx0:sx0 + (x1c - x0c)].astype(np.float32)
    a = sp[..., 3:4] / 255 * alpha
    roi = dst[y0c:y1c, x0c:x1c].astype(np.float32)
    dst[y0c:y1c, x0c:x1c] = (roi * (1 - a) + sp[..., :3] * a).astype(np.uint8)


def render_frame(n):
    c = CTX
    t = n / c["fps"]
    scenes = c["scenes"]
    i = max(k for k, sc in enumerate(scenes) if sc["start"] <= t or k == 0)
    frame = camera_frame(i, t)
    # transitions with the neighbouring scene
    for j, k in ((i, i + 1), (i - 1, i)):
        if j < 0 or k >= len(scenes):
            continue
        b = scenes[k]["start"]
        kind = scenes[k].get("transition_in", "crossfade")
        if kind == "cut":
            continue
        half = c["xf"] / 2 * (1.8 if kind == "dip" else 1)
        if b - half <= t < b + half:
            a = smooth((t - (b - half)) / (2 * half))
            other = camera_frame(k if j == i else j, t)
            A, B = (frame, other) if j == i else (other, frame)
            frame = cv2.addWeighted(A, 1 - a, B, a, 0)
            if kind == "dip":
                dim = 1 - 0.7 * math.sin(math.pi * a)
                frame = cv2.convertScaleAbs(frame, alpha=dim)
    f = flash_amount(t)
    if f > 0.003:
        white = np.full_like(frame, (240, 250, 255))
        frame = cv2.addWeighted(frame, 1 - f, white, f, 0)
    # look: vignette + film grain
    frame = cv2.multiply(frame, c["vig"], scale=1 / 255)
    frame = np.clip(frame.astype(np.int16) + c["grain"][n % len(c["grain"])], 0, 255).astype(np.uint8)
    # AI disclaimer (top, outside TikTok's top bar)
    dis = c.get("disclaimer")
    if dis is not None and dis["start"] <= t < dis["end"]:
        a = min(1, (t - dis["start"]) / 0.4, (dis["end"] - t) / 0.5)
        composite(frame, dis["sprite"], c["W"] / 2, c["H"] * 0.135, 1.0, a)
    # subtitles
    for cue in c["cues"]:
        if cue["burn"] and cue["start"] <= t < cue["end"]:
            ti = t - cue["start"]
            a = min(1.0, ti / 0.09)
            if cue.get("fade_out") and cue["end"] - t < 0.12:
                a *= (cue["end"] - t) / 0.12
            sc = 0.86 + 0.14 * ease_out_back(ti / 0.17)
            composite(frame, cue["sprite"], c["W"] / 2, c["H"] * c["sub_y"], sc, a)
            break
    return frame.tobytes()


def render_video(ctx, audio_path, out_path, crf=18, preset="slow", maxrate="9M"):
    W, H, fps = ctx["W"], ctx["H"], ctx["fps"]
    nframes = int(round(ctx["duration"] * fps))
    cmd = [FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps),
           "-i", "-", "-i", str(audio_path), "-map", "0:v", "-map", "1:a",
           "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-maxrate", maxrate, "-bufsize", "18M", "-profile:v", "high", "-level", "4.2",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", str(out_path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    workers = max(1, min(8, (os.cpu_count() or 2) - 1))
    log(f"Rendu de {nframes} images ({W}x{H} @ {fps} fps) avec {workers} processus…")
    with Pool(workers, initializer=_init, initargs=(ctx,)) as pool:
        for k, buf in enumerate(pool.imap(render_frame, range(nframes), chunksize=4)):
            proc.stdin.write(buf)
            if k % (fps * 5) == 0:
                log(f"  {k / fps:5.1f}s / {ctx['duration']:.1f}s")
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg a échoué pendant l'encodage")


def render_stills(ctx, times):
    """Render individual frames (for quick previews / QC) in-process."""
    _init(ctx)
    return [np.frombuffer(render_frame(int(t * ctx["fps"])), np.uint8).reshape(ctx["H"], ctx["W"], 3) for t in times]
