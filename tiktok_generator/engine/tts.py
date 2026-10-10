"""Text-to-speech with automatic fallback: edge-tts -> Piper (sherpa-onnx) -> pyttsx3.

Each narration line is synthesised separately so that pauses and scene timing
are fully controlled, then trimmed, pitch-adjusted and cached.
"""
import asyncio
import hashlib
import os
import re
import tarfile
from pathlib import Path

import numpy as np

from .util import FFMPEG, SR, download, ffmpeg_has_filter, log, read_audio, run, write_wav

PIPER_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-{name}.tar.bz2"


def spoken_text(text, pronunciations):
    """Apply the pronunciation dictionary word by word (keeps punctuation)."""
    def repl(m):
        w = m.group(0)
        return pronunciations.get(w, w)
    return re.sub(r"[\wÀ-ÿ'-]+", repl, text)


class Voice:
    def __init__(self, cfg, root, cache_dir):
        self.cfg = cfg
        self.root = Path(root)
        self.cache = Path(cache_dir)
        self.cache.mkdir(parents=True, exist_ok=True)
        self.engine = None
        self._piper = None
        self._has_rubberband = ffmpeg_has_filter("rubberband")
        order = {"auto": ["edge", "piper", "pyttsx3"]}.get(cfg["engine"], [cfg["engine"]])
        for name in order:
            try:
                getattr(self, f"_probe_{name}")()
                self.engine = name
                break
            except Exception as e:  # try the next engine
                log(f"Moteur TTS '{name}' indisponible: {str(e).splitlines()[0][:160]}")
        if not self.engine:
            raise RuntimeError("Aucun moteur de synthèse vocale disponible.")
        log(f"Moteur TTS retenu: {self.engine}")

    # ---------- engine probes ----------
    def _probe_edge(self):
        import edge_tts  # noqa: F401
        test = self.cache / "_edge_probe.mp3"
        self._edge_save("Bonjour.", test)
        if not test.exists() or test.stat().st_size < 500:
            raise RuntimeError("edge-tts n'a renvoyé aucun audio")

    def _probe_piper(self):
        import sherpa_onnx
        name = self.cfg["piper_model"]
        d = self.root / "models" / f"vits-piper-{name}"
        if not (d / f"{name}.onnx").exists():
            arc = download(PIPER_URL.format(name=name), self.root / "models" / f"{name}.tar.bz2")
            with tarfile.open(arc) as t:
                t.extractall(self.root / "models", filter="data")
            arc.unlink()
        mc = sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=str(d / f"{name}.onnx"), tokens=str(d / "tokens.txt"),
                data_dir=str(d / "espeak-ng-data")),
            num_threads=max(1, (os.cpu_count() or 2) - 1))
        self._piper = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=mc))

    def _probe_pyttsx3(self):
        import pyttsx3
        self._pyttsx3 = pyttsx3.init()
        for v in self._pyttsx3.getProperty("voices"):
            if "fr" in (v.id + v.name).lower():
                self._pyttsx3.setProperty("voice", v.id)
                break

    # ---------- synthesis ----------
    def _edge_save(self, text, path):
        import edge_tts
        proxy = os.environ.get("HTTPS_PROXY") or None
        com = edge_tts.Communicate(text, self.cfg["edge_voice"], rate=self.cfg["edge_rate"],
                                   pitch=self.cfg["edge_pitch"], proxy=proxy)
        asyncio.run(asyncio.wait_for(com.save(str(path)), timeout=60))

    def _raw(self, text, path):
        if self.engine == "edge":
            mp3 = path.with_suffix(".mp3")
            self._edge_save(text, mp3)
            return read_audio(mp3)
        if self.engine == "piper":
            a = self._piper.generate(text, sid=0, speed=float(self.cfg["piper_speed"]))
            x = np.asarray(a.samples, dtype=np.float32)
            if a.sample_rate != SR:
                tmp = path.with_suffix(".src.wav")
                write_wav(tmp, x, a.sample_rate)
                x = read_audio(tmp)
                tmp.unlink()
            return x
        tmp = path.with_suffix(".sapi.wav")
        self._pyttsx3.save_to_file(text, str(tmp))
        self._pyttsx3.runAndWait()
        return read_audio(tmp)

    def _pitch(self, src, dst):
        st = float(self.cfg.get("pitch_semitones", 0))
        # edge-tts already lowers pitch natively
        if abs(st) < 0.05 or self.engine == "edge":
            run([FFMPEG, "-y", "-v", "error", "-i", src, dst])
            return
        ratio = 2 ** (st / 12)
        if self._has_rubberband:
            af = f"rubberband=pitch={ratio:.5f}:formant=preserved"
        else:
            af = f"asetrate={SR * ratio:.0f},aresample={SR},atempo={1 / ratio:.5f}"
        run([FFMPEG, "-y", "-v", "error", "-i", src, "-af", af, "-ar", SR, dst])

    def synth(self, text):
        """Return a trimmed mono float32 array for `text` (cached)."""
        key = hashlib.sha1(f"{self.engine}|{text}|{sorted(self.cfg.items())}".encode()).hexdigest()[:16]
        out = self.cache / f"line_{key}.wav"
        if not out.exists():
            raw = self.cache / f"raw_{key}.wav"
            write_wav(raw, self._raw(text, raw))
            self._pitch(raw, out)
        x = read_audio(out)
        return trim_silence(x)


def trim_silence(x, thresh_db=-42, pad=0.04):
    env = np.abs(x)
    thr = 10 ** (thresh_db / 20) * max(env.max(), 1e-6)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * SR))
    b = min(len(x), idx[-1] + int(pad * 1.5 * SR))
    y = x[a:b].copy()
    f = int(0.01 * SR)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y
