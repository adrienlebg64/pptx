#!/usr/bin/env python3
"""Générateur automatique de vidéos TikTok documentaires.

Usage :
    python generate.py                       # production complète avec config.json
    python generate.py --config autre.json   # autre projet
    python generate.py --preview             # quelques images fixes seulement (rapide)
    python generate.py --new script.txt dossier_images  # crée un config.json de départ

Tout le contenu (images, texte, recadrages, mouvements, sons) est dans le JSON :
aucun changement de code n'est nécessaire pour une nouvelle vidéo.
"""
import argparse
import json
import platform
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))


def check_environment():
    from engine.util import FFMPEG, FFPROBE, log, run
    log(f"Python {platform.python_version()} ({platform.system()})")
    log(run([FFMPEG, "-version"], capture=True).splitlines()[0])
    if not FFPROBE:
        log("ffprobe introuvable : le contrôle qualité sera limité.")
    import importlib
    for mod in ("numpy", "cv2", "PIL", "scipy", "soundfile"):
        m = importlib.import_module(mod)
        log(f"  {mod:10s} {getattr(m, '__version__', '?')}")
    for mod in ("edge_tts", "sherpa_onnx"):
        try:
            m = importlib.import_module(mod)
            log(f"  {mod:10s} {getattr(m, '__version__', 'ok')}")
        except ImportError:
            log(f"  {mod:10s} absent")


def detect_images(cfg):
    from engine.util import log
    img_dir = ROOT / cfg["project"]["images_dir"]
    found = sorted(p.name for p in img_dir.glob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
    log(f"{len(found)} images détectées dans {img_dir}: {', '.join(found)}")
    missing = [s["image"] for s in cfg["scenes"] if s["image"] not in found]
    if missing:
        sys.exit(f"Images manquantes : {missing}")


def process_voice(raw_wav, out_wav):
    """Warm documentary voice: rumble cut, low-mid body, gentle de-harsh, compression."""
    from engine.util import FFMPEG, run
    af = ("highpass=f=70,equalizer=f=140:t=q:w=1.0:g=2.5,equalizer=f=3200:t=q:w=1.5:g=1.0,"
          "equalizer=f=7000:t=q:w=2:g=-2.5,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,"
          "aecho=0.85:0.5:28|47:0.08|0.05")
    run([FFMPEG, "-y", "-v", "error", "-i", raw_wav, "-af", af, "-ar", "44100", "-c:a", "pcm_f32le", out_wav])


def build_context(cfg, tl, cues, plates):
    from engine.subs import load_font, render_label, render_sprite
    vcfg, scfg = cfg["video"], cfg["subtitles"]
    xf = float(vcfg.get("crossfade", 0.45))
    scenes = tl["scenes"]

    def half(k):
        if k <= 0 or k >= len(scenes):
            return 0.0
        kind = scenes[k].get("transition_in", "crossfade")
        return 0.0 if kind == "cut" else xf / 2 * (1.8 if kind == "dip" else 1)

    for k, sc in enumerate(scenes):
        sc["vis_start"] = sc["start"] - half(k)
        sc["vis_end"] = sc["end"] + half(k + 1)
    font = load_font(scfg, ROOT, int(scfg["size"]))
    for i, c in enumerate(cues):
        c["sprite"] = render_sprite(c["words"], scfg, font)[..., [2, 1, 0, 3]]  # RGBA -> BGRA
        c["fade_out"] = i + 1 == len(cues) or cues[i + 1]["start"] - c["end"] > 0.05
    ctx = {"W": vcfg["width"], "H": vcfg["height"], "fps": vcfg["fps"], "duration": tl["duration"],
           "scenes": [{k: v for k, v in sc.items() if k != "lines"} for sc in scenes], "plates": plates,
           "xf": xf, "grain": float(vcfg.get("grain", 4)), "vignette": float(vcfg.get("vignette", 0.25)),
           "cues": cues, "sub_y": float(scfg["center_y"])}
    dis = vcfg.get("ai_disclaimer")
    if dis and dis.get("text"):
        lf = load_font({**scfg, "font": "assets/fonts/Inter-SemiBold.otf"}, ROOT, 36)
        ctx["disclaimer"] = {"sprite": render_label(dis["text"], lf)[..., [2, 1, 0, 3]],
                             "start": dis.get("start", 0), "end": dis.get("end", 4)}
    return ctx


def write_description(cfg, path):
    d = cfg["description"]
    txt = f"{d['text']}\n\n{' '.join(d['hashtags'])}\n"
    if d.get("note"):
        txt += f"\n{d['note']}\n"
    Path(path).write_text(txt, encoding="utf-8")


def quality_control(cfg, video, out_dir, cues):
    """ffprobe checks + black-frame detection + preview captures and contact sheet."""
    import cv2
    import numpy as np
    from engine.util import FFMPEG, FFPROBE, log, run
    qc = out_dir / "controle_qualite"
    qc.mkdir(exist_ok=True)
    report = []
    ok = True
    if FFPROBE:
        info = json.loads(run([FFPROBE, "-v", "error", "-show_streams", "-show_format", "-of", "json", video], capture=True))
        v = next(s for s in info["streams"] if s["codec_type"] == "video")
        a = [s for s in info["streams"] if s["codec_type"] == "audio"]
        dur = float(info["format"]["duration"])
        num, den = map(int, v["r_frame_rate"].split("/"))
        lo, hi = cfg["project"]["target_duration"]
        checks = [
            (f"Durée {dur:.2f} s (cible {lo}-{hi} s)", lo <= dur <= hi),
            (f"Résolution {v['width']}x{v['height']}", (v["width"], v["height"]) == (cfg["video"]["width"], cfg["video"]["height"])),
            (f"Images/s {num / den:g}", abs(num / den - cfg["video"]["fps"]) < 0.01),
            (f"Vidéo {v['codec_name']} / {v.get('pix_fmt')}", v["codec_name"] == "h264"),
            (f"Audio {a[0]['codec_name'] if a else 'absent'}", bool(a) and a[0]["codec_name"] == "aac"),
        ]
        for label, good in checks:
            report.append(f"[{'OK' if good else 'ÉCHEC'}] {label}")
            ok &= good
    out = run([FFMPEG, "-v", "info", "-i", video, "-vf", "blackdetect=d=0.1:pic_th=0.92:pix_th=0.08",
               "-an", "-f", "null", "-"], capture=True)
    blacks = [l for l in out.splitlines() if "black_start" in l]
    report.append(f"[{'OK' if not blacks else 'ÉCHEC'}] Écrans noirs détectés : {len(blacks)}")
    ok &= not blacks
    vol = run([FFMPEG, "-v", "info", "-i", video, "-af", "volumedetect", "-vn", "-f", "null", "-"], capture=True)
    for l in vol.splitlines():
        if "mean_volume" in l or "max_volume" in l:
            report.append("      " + l.split("]")[-1].strip())
    # captures: one per scene + a few on subtitles
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS)
    times = sorted({round(t, 2) for t in cfg["_qc_times"]})
    thumbs = []
    for t in times:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
        good, fr = cap.read()
        if not good:
            continue
        cv2.imwrite(str(qc / f"capture_{t:05.2f}s.jpg"), fr, [cv2.IMWRITE_JPEG_QUALITY, 90])
        th = cv2.resize(fr, (270, 480), interpolation=cv2.INTER_AREA)
        cv2.putText(th, f"{t:.1f}s", (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        thumbs.append(th)
        if fr.mean() < 8:
            report.append(f"[ÉCHEC] Image quasi noire à {t:.2f}s")
            ok = False
    cap.release()
    cols = 6
    while len(thumbs) % cols:
        thumbs.append(np.zeros_like(thumbs[0]))
    sheet = np.vstack([np.hstack(thumbs[r:r + cols]) for r in range(0, len(thumbs), cols)])
    cv2.imwrite(str(qc / "planche_contact.jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 88])
    burned = sum(1 for c in cues if c["burn"])
    report.append(f"[OK] Sous-titres incrustés : {burned} groupes ; SRT : {len(cues)} entrées")
    (qc / "rapport.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    for line in report:
        log(line)
    return ok


def new_project(script_path, images_dir, out_cfg):
    """Create a starter config: one paragraph of the script per image, in order."""
    paras = [p.strip() for p in Path(script_path).read_text(encoding="utf-8").split("\n\n") if p.strip()]
    imgs = sorted(p.name for p in Path(images_dir).glob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
    base = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    motions = [
        {"from": [1.0, 0.5, 0.55], "to": [1.12, 0.5, 0.48]},
        {"from": [1.14, 0.38, 0.5], "to": [1.14, 0.62, 0.5]},
        {"from": [1.15, 0.5, 0.42], "to": [1.02, 0.5, 0.5]},
        {"from": [1.12, 0.5, 0.62], "to": [1.12, 0.5, 0.4]},
    ]
    base["project"]["images_dir"] = str(Path(images_dir).resolve())
    base["scenes"] = []
    for k, img in enumerate(imgs):
        text = paras[k] if k < len(paras) else ""
        base["scenes"].append({"image": img, "crop": {}, "motion": motions[k % len(motions)],
                               "parallax": {"mode": "ground", "amount": 10}, "mood": "calm", "sfx": [],
                               "lines": [{"text": s.strip(), "pause": 0.4} for s in text.split("\n") if s.strip()],
                               **({} if text else {"duration": 3.0})})
    Path(out_cfg).write_text(json.dumps(base, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Configuration créée : {out_cfg} ({len(imgs)} scènes). Ajustez crop/motion/sfx puis lancez la génération.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=str(ROOT / "config.json"))
    ap.add_argument("--preview", action="store_true", help="génère seulement des images de contrôle")
    ap.add_argument("--fast", action="store_true", help="encodage rapide (brouillon)")
    ap.add_argument("--remux", action="store_true",
                    help="refait seulement l'audio/sous-titres et les remonte sur la vidéo existante")
    ap.add_argument("--new", nargs=2, metavar=("SCRIPT_TXT", "IMAGES_DIR"), help="crée un nouveau config")
    ap.add_argument("--out-config", default="config_nouveau.json")
    args = ap.parse_args()
    if args.new:
        return new_project(*args.new, args.out_config)

    import cv2
    from engine import imaging, render, sound, subs, timeline
    from engine.tts import Voice
    from engine.util import FFMPEG, ensure_dir, log, loudnorm, read_audio, run, write_wav

    check_environment()
    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    detect_images(cfg)
    out = ensure_dir(ROOT / cfg["project"]["output_dir"])
    sub_dir = ensure_dir(ROOT / cfg["project"]["subtitles_dir"])
    cache = ensure_dir(ROOT / "cache")
    work = ensure_dir(cache / "work")

    # 1. narration + timeline driven by the real audio
    voice = Voice(cfg["voice"], ROOT, cache / "tts")
    tl = timeline.build(cfg, voice)
    log(f"Durée totale calculée : {tl['duration']:.2f} s")
    for sc in tl["scenes"]:
        log(f"  {sc['image']}: {sc['start']:6.2f}s → {sc['end']:6.2f}s ({sc['end'] - sc['start']:.2f}s)")

    # 2. voice processing, narration export, mix
    write_wav(work / "voice_raw.wav", tl["voice"])
    process_voice(work / "voice_raw.wav", work / "voice_proc.wav")
    tl["voice"] = read_audio(work / "voice_proc.wav")
    loudnorm(work / "voice_proc.wav", out / cfg["project"]["narration_name"], cfg["mix"]["voice_lufs"],
             cfg["mix"]["true_peak"], ("-c:a", "libmp3lame", "-b:a", "192k"))
    log(f"Narration : {out / cfg['project']['narration_name']}")
    _, full = sound.mix(tl, cfg, ROOT)
    write_wav(work / "mix.wav", full)
    loudnorm(work / "mix.wav", work / "mix_norm.wav", cfg["mix"]["final_lufs"], cfg["mix"]["true_peak"])

    # 3. subtitles
    cues = subs.build_cues(tl, cfg["subtitles"])
    srt = out / cfg["project"]["srt_name"]
    subs.write_srt(cues, srt)
    shutil.copy(srt, sub_dir / srt.name)
    log(f"Sous-titres : {srt} ({len(cues)} entrées)")

    # 4. images → plates
    plates = imaging.prepare_plates(cfg, ROOT, cache / "plates")
    ctx = build_context(cfg, tl, cues, plates)
    cfg["_qc_times"] = [(s["start"] + s["end"]) / 2 for s in tl["scenes"]] + \
                       [s["start"] + 0.05 for s in tl["scenes"] if s.get("flash")] + \
                       [c["start"] + 0.3 for c in cues[::6]]

    if args.preview:
        prev = ensure_dir(out / "apercu")
        for t, fr in zip(cfg["_qc_times"], render.render_stills(ctx, cfg["_qc_times"])):
            cv2.imwrite(str(prev / f"apercu_{t:05.2f}s.jpg"), fr)
        log(f"Aperçus écrits dans {prev}")
        return

    # 5. render + encode
    video = out / cfg["project"]["video_name"]
    if args.remux and video.exists():
        tmp = video.with_suffix(".remux.mp4")
        run([FFMPEG, "-y", "-v", "error", "-i", video, "-i", work / "mix_norm.wav", "-map", "0:v", "-map", "1:a",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", tmp])
        tmp.replace(video)
        write_description(cfg, out / cfg["project"]["description_name"])
        quality_control(cfg, video, out, cues)
        return
    render.render_video(ctx, work / "mix_norm.wav", video, crf=cfg["video"]["crf"],
                        preset="veryfast" if args.fast else cfg["video"]["preset"],
                        maxrate=cfg["video"].get("maxrate", "9M"))
    write_description(cfg, out / cfg["project"]["description_name"])

    # 6. QC
    ok = quality_control(cfg, video, out, cues)
    log(("Terminé ✔ " if ok else "Terminé avec avertissements ⚠ ") + str(video))


if __name__ == "__main__":
    main()
