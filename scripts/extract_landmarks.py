"""Extract RAW MediaPipe hand landmarks from letter photos.

Only raw landmarks are produced here. Normalization, features, medoids and rule drafts are
computed by `scripts/build-letters.ts`, which reuses the app's own TypeScript code.

Sources (unpacked into scripts/data/, git-ignored):
  kaggle  croped_{train,test}_01_06_cv/.../<Буква>/*.jpg   tight hand crops from many people
  rsl     dataset_rsl/<Буква>/Image_<unix time>.jpg         video frames of one person, with a
                                                            MediaPipe skeleton drawn on top

Output: scripts/landmarks/<source>.json — one record per line:
  { letter, source, file, signer, handedness, score, width, height, variant, landmarks: [[x,y,z]*21] }
Landmarks are normalized (0..1) to the ORIGINAL image (padding/mirroring is undone), unmirrored,
exactly like HandFrame.landmarks in the browser. `width`/`height` are needed for aspect correction.

Usage:
  py -3.11 -m venv scripts/.venv
  scripts/.venv/Scripts/python -m pip install -r scripts/requirements.txt
  scripts/.venv/Scripts/python scripts/extract_landmarks.py [--source kaggle|rsl|all]
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import re
import sys
import unicodedata
import urllib.request
from dataclasses import dataclass
from typing import Callable, Iterator

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT_DIR = os.path.join(HERE, "landmarks")
MODEL_PATH = os.path.join(HERE, "models", "hand_landmarker.task")
# Same model as the browser (src/config.ts HAND_MODEL_URL).
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)

# Detector confidences are lower than in the app: a photo gets no second chance from tracking,
# and the result is filtered by MIN_SCORE below anyway.
DETECTION_CONFIDENCE = 0.3
MIN_SCORE = 0.5  # handedness score, same field the app compares with MIN_HAND_SCORE
# Tight crops cut the fingertips, so MediaPipe extrapolates landmarks a bit beyond the edge.
# A point further out than this (fraction of the image side) means the hand is really cut off.
OUT_OF_FRAME_MARGIN = 0.15
WRIST_MARGIN = 0.05  # the wrist itself must be (almost) inside the image
LOW_RATE = 0.6  # letters below this detection rate are flagged in the report
RSL_STRIDE = 5  # rsl is ~25 fps video: keep every Nth frame, neighbours are near-identical

LETTER_RE = re.compile(r"^[А-ЯЁ]$")


@dataclass
class Item:
    letter: str
    file: str  # path relative to scripts/data, forward slashes
    signer: str


@dataclass
class Detection:
    landmarks: list[list[float]]
    handedness: str
    score: float


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def read_image(path: str) -> np.ndarray | None:
    # cv2.imread cannot open non-ASCII paths on Windows.
    data = np.fromfile(path, np.uint8)
    return cv2.imdecode(data, cv2.IMREAD_COLOR) if data.size else None


# ---------------------------------------------------------------- sources


def kaggle_signer(name: str) -> str:
    m = re.match(r"^(\d+)_", name)
    if m:
        return f"tg-{m.group(1)}"  # Telegram sender id: one id = one person
    if name.upper().startswith("IMG_"):
        return "kaggle-img"  # one continuous camera roll (IMG_0001..IMG_9999)
    if LETTER_RE.match(nfc(os.path.splitext(name)[0])):
        return "kaggle-named"  # А.jpeg, Б.jpeg… — one series by one person
    return "unknown"


def kaggle_items(skipped: list[str]) -> Iterator[Item]:
    seen: set[str] = set()
    for split in ("croped_train_01_06_cv", "croped_test_01_06_cv"):
        base = os.path.join(DATA, split, split)
        if not os.path.isdir(base):
            continue
        for folder in sorted(os.listdir(base)):
            letter = nfc(folder)
            for name in sorted(os.listdir(os.path.join(base, folder))):
                rel = f"{split}/{split}/{folder}/{name}"
                stem = nfc(os.path.splitext(name)[0])
                # Ё.jpeg inside Е/, Й.jpeg inside И/: the label is ambiguous, skip.
                if LETTER_RE.match(stem) and stem != letter:
                    skipped.append(f"{rel}: имя файла «{stem}» ≠ папка «{letter}»")
                    continue
                digest = hashlib.md5(open(os.path.join(DATA, rel), "rb").read()).hexdigest()
                if digest in seen:
                    skipped.append(f"{rel}: точный дубликат")
                    continue
                seen.add(digest)
                yield Item(letter, rel, kaggle_signer(name))


def rsl_items(skipped: list[str]) -> Iterator[Item]:
    base = os.path.join(DATA, "dataset_rsl")
    if not os.path.isdir(base):
        return
    for folder in sorted(os.listdir(base)):
        names = sorted(os.listdir(os.path.join(base, folder)))
        for i, name in enumerate(names):
            if i % RSL_STRIDE:
                continue
            yield Item(nfc(folder), f"dataset_rsl/{folder}/{name}", "rsl-1")
    skipped.append(f"dataset_rsl: взят каждый {RSL_STRIDE}-й кадр видео")


# ---------------------------------------------------------------- preprocessing


@dataclass
class Variant:
    name: str
    image: np.ndarray
    # maps a landmark of the processed image back to the original image: (x, y, z) -> (x, y, z)
    back: Callable[[float, float, float], tuple[float, float, float]]
    mirrored: bool = False


def edge_color(img: np.ndarray) -> list[int]:
    edge = np.concatenate([img[0], img[-1], img[:, 0], img[:, -1]])
    return [int(c) for c in np.median(edge, axis=0)]


def padded(img: np.ndarray, frac: float, name: str) -> Variant:
    """Adds a border so the palm detector sees context around a tight crop."""
    h, w = img.shape[:2]
    p = int(max(h, w) * frac)
    out = cv2.copyMakeBorder(img, p, p, p, p, cv2.BORDER_CONSTANT, value=edge_color(img))
    pw, ph = w + 2 * p, h + 2 * p
    # z is scaled like x (by image width), so it is rescaled with the width.
    return Variant(name, out, lambda x, y, z: ((x * pw - p) / w, (y * ph - p) / h, z * pw / w))


def mirrored(v: Variant) -> Variant:
    back = v.back
    return Variant(v.name + "+mirror", cv2.flip(v.image, 1), lambda x, y, z: back(1 - x, y, z), True)


def scaled(img: np.ndarray, k: float) -> Variant:
    out = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_AREA if k < 1 else cv2.INTER_CUBIC)
    return Variant(f"scale{k:g}", out, lambda x, y, z: (x, y, z))


def erase_drawn_skeleton(img: np.ndarray) -> np.ndarray:
    """dataset_rsl frames have red dots, white bones and a magenta frame burned in.
    The palm detector fails on them (~3%), so the drawing is masked and inpainted."""
    b, g, r = (img[:, :, i].astype(int) for i in range(3))
    red = (r > 150) & (g < 90) & (b < 90)
    magenta = (r > 150) & (b > 150) & (g < 100)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, np.ones((9, 9), np.uint8))
    saturation = img.max(axis=2).astype(int) - img.min(axis=2)
    white = (tophat > 25) & (saturation < 60) & (gray > 150)
    mask = ((red | magenta | white) * 255).astype(np.uint8)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2)
    return cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA)


def identity(img: np.ndarray, name: str = "orig") -> Variant:
    return Variant(name, img, lambda x, y, z: (x, y, z))


def variants(source: str, img: np.ndarray) -> Iterator[Variant]:
    """Attempts in order of measured success rate; the first detection wins."""
    if source == "rsl":
        clean = erase_drawn_skeleton(img)
        first = [identity(clean, "clean"), padded(clean, 0.3, "clean+pad30")]
    else:
        first = [padded(img, 0.5, "pad50"), identity(img), padded(img, 0.25, "pad25")]
    yield from first
    yield from (mirrored(v) for v in first)
    base = first[0].image if source == "rsl" else img
    for k in (0.5, 1.5):
        yield scaled(base, k)


# ---------------------------------------------------------------- detection


def ensure_model() -> None:
    if os.path.exists(MODEL_PATH):
        return
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    print(f"Скачиваю модель {MODEL_URL}")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)


def create_landmarker() -> vision.HandLandmarker:
    ensure_model()
    return vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=vision.RunningMode.IMAGE,
            num_hands=1,
            min_hand_detection_confidence=DETECTION_CONFIDENCE,
            min_hand_presence_confidence=DETECTION_CONFIDENCE,
        )
    )


def detect(lm: vision.HandLandmarker, v: Variant) -> Detection | None:
    rgb = np.ascontiguousarray(cv2.cvtColor(v.image, cv2.COLOR_BGR2RGB))
    res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not res.hand_landmarks:
        return None
    cat = res.handedness[0][0]
    label = "Left" if cat.category_name == "Left" else "Right"
    if v.mirrored:  # a mirror image shows the other hand
        label = "Right" if label == "Left" else "Left"
    points = [[round(c, 5) for c in v.back(p.x, p.y, p.z)] for p in res.hand_landmarks[0]]
    return Detection(points, label, round(cat.score, 4))


def reject_reason(d: Detection) -> str | None:
    if len(d.landmarks) != 21:
        return "не 21 точка"
    if d.score < MIN_SCORE:
        return "низкий score"
    wx, wy, _ = d.landmarks[0]
    if not (-WRIST_MARGIN <= wx <= 1 + WRIST_MARGIN and -WRIST_MARGIN <= wy <= 1 + WRIST_MARGIN):
        return "запястье вне кадра"
    lo, hi = -OUT_OF_FRAME_MARGIN, 1 + OUT_OF_FRAME_MARGIN
    if any(not (lo <= x <= hi and lo <= y <= hi) for x, y, _ in d.landmarks):
        return "рука обрезана"
    return None


# ---------------------------------------------------------------- main


def run(source: str, lm: vision.HandLandmarker) -> None:
    skipped: list[str] = []
    items = list(kaggle_items(skipped) if source == "kaggle" else rsl_items(skipped))
    if not items:
        print(f"[{source}] нет данных в {DATA} — пропускаю")
        return

    records: list[dict] = []
    total = collections.Counter[str]()
    found = collections.Counter[str]()
    reasons = collections.Counter[str]()
    by_variant = collections.Counter[str]()
    hands: dict[str, collections.Counter[str]] = collections.defaultdict(collections.Counter)

    for n, it in enumerate(items, 1):
        total[it.letter] += 1
        img = read_image(os.path.join(DATA, it.file))
        if img is None:
            reasons["не читается"] += 1
            continue
        last_reason = "рука не найдена"
        for v in variants(source, img):
            d = detect(lm, v)
            if d is None:
                continue
            last_reason = reject_reason(d) or ""
            if last_reason:
                continue  # a different preprocessing may still give a clean detection
            h, w = img.shape[:2]
            records.append({
                "letter": it.letter, "source": source, "file": it.file, "signer": it.signer,
                "handedness": d.handedness, "score": d.score, "width": w, "height": h,
                "variant": v.name, "landmarks": d.landmarks,
            })
            found[it.letter] += 1
            by_variant[v.name] += 1
            hands[it.letter][d.handedness] += 1
            break
        if last_reason:
            reasons[last_reason] += 1
        if n % 200 == 0:
            print(f"  [{source}] {n}/{len(items)}", file=sys.stderr)

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{source}.json")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("[\n")
        f.write(",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in records))
        f.write("\n]\n")

    print(f"\n=== {source}: {len(records)}/{len(items)} ({len(records) / len(items):.0%}) → {os.path.relpath(out, HERE)}")
    print(f"{'буква':5} {'найдено':>8} {'всего':>6} {'%':>5}  Right/Left")
    for letter in sorted(total, key=lambda s: "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".index(s)):
        rate = found[letter] / total[letter]
        flag = "  ⚠ < 60%" if rate < LOW_RATE else ""
        hc = hands[letter]
        print(f"{letter:5} {found[letter]:8} {total[letter]:6} {rate:5.0%}  {hc['Right']}/{hc['Left']}{flag}")
    print("причины пропусков:", dict(reasons.most_common()))
    print("сработавшая предобработка:", dict(by_variant.most_common()))
    for s in skipped:
        print("пропущено:", s)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["kaggle", "rsl", "all"], default="all")
    args = ap.parse_args()
    lm = create_landmarker()
    for source in (["kaggle", "rsl"] if args.source == "all" else [args.source]):
        run(source, lm)


if __name__ == "__main__":
    main()
