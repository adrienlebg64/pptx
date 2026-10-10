"""Image preparation: crop storyboard borders/labels, AI upscale, colour harmony,
and build a high-resolution "plate" that the virtual camera moves across."""
import hashlib
from pathlib import Path

import cv2
import numpy as np

from .util import download, log

SR_MODELS = {
    "edsr": ("EDSR_x4.pb", "https://raw.githubusercontent.com/Saafke/EDSR_Tensorflow/master/models/EDSR_x4.pb"),
    "fsrcnn": ("FSRCNN_x4.pb", "https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x4.pb"),
}
PLATE_H = 2400  # plate height in px (output is 1920: leaves room for zooms)


def imread(path):
    data = np.fromfile(str(path), np.uint8)  # unicode-safe on Windows
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"Image illisible: {path}")
    return img


class Upscaler:
    def __init__(self, method, root):
        self.method, self.sr = "lanczos", None
        if method not in SR_MODELS:
            return
        name, url = SR_MODELS[method]
        path = Path(root) / "models" / name
        try:
            if not path.exists():
                download(url, path)
            self.sr = cv2.dnn_superres.DnnSuperResImpl_create()
            self.sr.readModel(str(path))
            self.sr.setModel(method, 4)
            self.method = method
        except Exception as e:
            log(f"Super-résolution {method} indisponible ({e}); repli sur Lanczos.")
            self.sr = None
        log(f"Mise à l'échelle: {self.method}")

    def __call__(self, img):
        if self.sr is not None:
            try:
                return self.sr.upsample(img)
            except Exception as e:
                log(f"Échec super-résolution ({e}); repli sur Lanczos.")
        return cv2.resize(img, None, fx=4, fy=4, interpolation=cv2.INTER_LANCZOS4)


def crop(img, c):
    h, w = img.shape[:2]
    return img[c.get("top", 0): h - c.get("bottom", 0), c.get("left", 0): w - c.get("right", 0)]


def lab_stats(img):
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    return lab.reshape(-1, 3).mean(0), lab.reshape(-1, 3).std(0)


def harmonize(img, target, strength):
    """Partial Reinhard colour transfer toward the series' average look."""
    if strength <= 0:
        return img
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    m, s = lab.reshape(-1, 3).mean(0), lab.reshape(-1, 3).std(0) + 1e-6
    tm, ts = target
    k = np.array([strength * 0.6, strength, strength])  # keep luminance intent (night/flash)
    nm = m + (tm - m) * k
    ns = s + (ts - s) * k
    lab = (lab - m) / s * ns + nm
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def grade(img, contrast):
    """Gentle filmic S-curve, slightly cooler shadows / warmer highlights."""
    x = np.arange(256, dtype=np.float32) / 255
    lut = np.clip(0.5 + (x - 0.5) * contrast, 0, 1)
    lut = lut * 0.85 + lut * lut * (3 - 2 * lut) * 0.15  # soft toe and shoulder
    b = np.clip(lut + 0.012 * (1 - x) - 0.01 * x, 0, 1)
    r = np.clip(lut - 0.008 * (1 - x) + 0.012 * x, 0, 1)
    luts = [(b * 255).astype(np.uint8), (lut * 255).astype(np.uint8), (r * 255).astype(np.uint8)]
    return cv2.merge([cv2.LUT(ch, l) for ch, l in zip(cv2.split(img), luts)])


def sharpen(img, amount=0.35, sigma=1.4):
    blur = cv2.GaussianBlur(img, (0, 0), sigma)
    return cv2.addWeighted(img, 1 + amount, blur, -amount, 0)


def landscape_plate(img, out_w, out_h, fg_scale=1.12, fg_cx=0.5):
    """Wide image on a 9:16 canvas: blurred, darkened fill behind the full frame,
    with feathered edges (no black bars, nothing important cropped)."""
    pw, ph = int(PLATE_H * out_w / out_h), PLATE_H
    h, w = img.shape[:2]
    sc = max(pw / w, ph / h)
    bg = cv2.resize(img, (int(w * sc) + 1, int(h * sc) + 1), interpolation=cv2.INTER_AREA)
    y0, x0 = (bg.shape[0] - ph) // 2, (bg.shape[1] - pw) // 2
    bg = bg[y0:y0 + ph, x0:x0 + pw]
    bg = cv2.GaussianBlur(bg, (0, 0), 45)
    bg = (bg.astype(np.float32) * 0.42).astype(np.uint8)
    fw = int(pw * fg_scale)
    fh = int(h * fw / w)
    fg = cv2.resize(img, (fw, fh), interpolation=cv2.INTER_LANCZOS4)
    x0 = int(np.clip(fg_cx * fw - pw / 2, 0, fw - pw))
    fg = fg[:, x0:x0 + pw]
    top = (ph - fh) // 2
    feather = int(fh * 0.16)
    mask = np.ones((fh, 1), np.float32)
    ramp = np.linspace(0, 1, feather) ** 1.5
    mask[:feather, 0] = ramp
    mask[-feather:, 0] = ramp[::-1]
    region = bg[top:top + fh].astype(np.float32)
    bg[top:top + fh] = (region * (1 - mask[..., None]) + fg.astype(np.float32) * mask[..., None]).astype(np.uint8)
    return bg


def prepare_plates(cfg, root, cache_dir):
    vcfg = cfg["video"]
    out_w, out_h = vcfg["width"], vcfg["height"]
    img_dir = Path(root) / cfg["project"]["images_dir"]
    cache = Path(cache_dir)
    cache.mkdir(parents=True, exist_ok=True)
    up = None
    ups = []
    for sc in cfg["scenes"]:
        path = img_dir / sc["image"]
        if not path.exists():
            raise FileNotFoundError(f"Image manquante: {path}")
        raw = crop(imread(path), sc.get("crop", {}))
        key = hashlib.sha1(raw.tobytes() + vcfg.get("upscale", "edsr").encode()).hexdigest()[:16]
        cp = cache / f"up_{key}.png"
        if cp.exists():
            big = imread(cp)
        else:
            up = up or Upscaler(vcfg.get("upscale", "edsr"), root)
            log(f"Mise à l'échelle {sc['image']} {raw.shape[1]}x{raw.shape[0]} -> x4")
            big = up(raw)
            cv2.imencode(".png", big)[1].tofile(str(cp))
        ups.append(big)
    stats = [lab_stats(u) for u in ups]
    target = (np.mean([s[0] for s in stats], 0), np.mean([s[1] for s in stats], 0))
    plates = []
    for sc, big in zip(cfg["scenes"], ups):
        img = harmonize(big, target, float(vcfg.get("color_harmonize", 0.3)))
        img = grade(img, float(vcfg.get("contrast", 1.05)))
        if sc.get("layout") == "landscape" or big.shape[1] > big.shape[0]:
            plate = landscape_plate(img, out_w, out_h, float(sc.get("fg_scale", 1.12)),
                                    float(sc.get("fg_center_x", 0.5)))
        else:
            h, w = img.shape[:2]
            s = PLATE_H / h
            plate = cv2.resize(img, (int(w * s), PLATE_H), interpolation=cv2.INTER_LANCZOS4)
        plates.append(sharpen(plate))
    return plates
