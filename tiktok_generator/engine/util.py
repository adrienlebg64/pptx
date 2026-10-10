"""Shared helpers: ffmpeg discovery, subprocess, audio I/O, downloads."""
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44100


def log(msg):
    print(f"[tiktok] {msg}", flush=True)


def find_ffmpeg():
    """Return (ffmpeg, ffprobe) paths. Falls back to imageio-ffmpeg's binary."""
    ff = shutil.which("ffmpeg")
    fp = shutil.which("ffprobe")
    if ff is None:
        try:
            import imageio_ffmpeg
            ff = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            sys.exit("FFmpeg introuvable. Installez-le (winget install Gyan.FFmpeg) "
                     "ou `pip install imageio-ffmpeg`.")
    return ff, fp


FFMPEG, FFPROBE = find_ffmpeg()


def run(cmd, capture=False):
    res = subprocess.run([str(c) for c in cmd], capture_output=True, text=True,
                         encoding="utf-8", errors="replace")
    if res.returncode != 0:
        raise RuntimeError(f"Commande échouée: {' '.join(map(str, cmd))}\n{res.stderr[-3000:]}")
    return (res.stdout + res.stderr) if capture else None


def ffmpeg_has_filter(name):
    out = subprocess.run([FFMPEG, "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    return any(line.split()[1:2] == [name] for line in out.splitlines() if len(line.split()) > 1)


def read_audio(path, sr=SR):
    """Decode any audio file to mono float32 at `sr` (through ffmpeg)."""
    tmp = Path(str(path) + f".{sr}.wav")
    run([FFMPEG, "-y", "-v", "error", "-i", path, "-ac", "1", "-ar", sr, "-c:a", "pcm_f32le", tmp])
    x, _ = sf.read(tmp, dtype="float32")
    tmp.unlink(missing_ok=True)
    return x


def write_wav(path, x, sr=SR):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, np.asarray(x, dtype=np.float32), sr, subtype="FLOAT")


def download(url, dest):
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    log(f"Téléchargement {url}")
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f)
    tmp.replace(dest)
    return dest


def loudnorm(src, dst, lufs, tp=-1.5, extra_args=()):
    """Two-pass EBU R128 loudness normalisation with ffmpeg."""
    out = run([FFMPEG, "-hide_banner", "-i", src, "-af",
               f"loudnorm=I={lufs}:TP={tp}:LRA=11:print_format=json", "-f", "null", "-"], capture=True)
    stats = json.loads(out[out.rindex("{"):out.rindex("}") + 1])
    af = (f"loudnorm=I={lufs}:TP={tp}:LRA=11:measured_I={stats['input_i']}:"
          f"measured_TP={stats['input_tp']}:measured_LRA={stats['input_lra']}:"
          f"measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}:linear=true")
    run([FFMPEG, "-y", "-v", "error", "-i", src, "-af", af, "-ar", SR, *extra_args, dst])


def ensure_dir(p):
    Path(p).mkdir(parents=True, exist_ok=True)
    return Path(p)


def env_flag(name):
    return os.environ.get(name, "").lower() in ("1", "true", "yes")
