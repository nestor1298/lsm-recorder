#!/usr/bin/env python3
"""Second hand pass over the MediaPipe frames with RTMW (whole body, 133 points).

MediaPipe looks for hands one at a time, so it loses them when they blur,
overlap, cross or turn edge-on, and with crossed arms its pose wrists swap
sides. RTMW sees the whole upper body at once: it knows which hand hangs
from which arm. On 30 hard videos it found 98 % of the expected hands
(MediaPipe: 53 %) and, where the two disagreed about a hand's side, RTMW
was the right one.

Only the frames that need it get the second pass (≈8 % of the corpus):
a raised wrist with no hand near it, or both wrists raised and close or
crossed. For each such frame:
  1. RTMW runs on a torso-and-arms box taken from the MediaPipe pose;
  2. every MediaPipe hand that matches an RTMW hand gets that side in
     `hand_side` ("l" / "r" = signer's left / right): build.ts then trusts
     it over the nearest pose wrist;
  3. every RTMW hand with no MediaPipe match is added: first MediaPipe is
     tried again on a crop around it (hand_src "rtmw3d", real 3D shape);
     failing that, RTMW's 2D points go in (hand_src "rtmw", z = 0, a flat
     world hand at shoulder scale). 2D hands count for location, movement
     and two-handedness but never for handshape or orientation.

The frames file keeps schema 2 and gains an "rtmw" block (what was done).
Usage: .venv-lexicon/bin/python -I scripts/wikisigns/rtmw_hands.py [--force] [--shard i/n] [ids...]
Needs: pip install rtmlib onnxruntime (on top of extract.py's packages).
"""

import json
import math
import os
import sys
import time

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision
from rtmlib import RTMPose
from rtmlib.tools.file import download_checkpoint

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data", "wikisigns-lsm")
VIDEOS = os.path.join(DATA, "_videos")
FRAMES = os.environ.get("LEXICON_FRAMES_DIR") or os.path.join(DATA, "_frames")
MODELS = os.path.join(DATA, "_cache", "models")

RTMW_URL = ("https://download.openmmlab.com/mmpose/v1/projects/rtmw/onnx_sdk/"
            "rtmw-dw-x-l_simcc-cocktail14_270e-384x288_20231122.zip")
RTMW_INPUT = (288, 384)

# Which frames get the second pass (same thresholds as extract.py)
RAISE_VIS = 0.7      # pose wrist visibility
NEAR_WRIST = 0.35    # a hand "is" at a wrist closer than this (shoulder widths)
WRISTS_CLOSE = 0.45  # both wrists closer than this → hands may overlap
# RTMW hands
KP_MIN = 3.0         # RTMW SimCC score of a reliable point (≈1 when absent, 4–7 when clear)
KP_COUNT = 12        # reliable points needed to accept a hand
MATCH = 0.3          # MediaPipe and RTMW hand centroids closer than this are the same hand
# MediaPipe again, on a crop around the RTMW hand
CROP_PAD = 1.6       # crop side = this × hand extent …
CROP_MIN = 0.6       # … but at least this many shoulder widths
CROP_PX = 256
CROP_WRIST = 0.25    # MediaPipe wrist within this of RTMW's (shoulder widths)
CROP_ERR = 0.35      # mean point error below this × hand size


def r(v: float, n: int = 4) -> float:
    return round(float(v), n)


def shoulder_px(p, w):
    return abs(p[11][0] - p[12][0]) * w


def needs_pass(f, w, h) -> bool:
    p = f.get("pose")
    if not p:
        return False
    sw = shoulder_px(p, w)
    if sw < 5:
        return False
    hip_y = (p[23][1] + p[24][1]) / 2
    hands = f.get("hands") or []
    up = [wi for wi in (15, 16) if p[wi][3] >= RAISE_VIS and p[wi][1] < min(0.95, hip_y)]
    for wi in up:
        if not any(math.hypot((hh[0][0] - p[wi][0]) * w, (hh[0][1] - p[wi][1]) * h) / sw < NEAR_WRIST for hh in hands):
            return True
    if len(up) == 2:
        dw = math.hypot((p[15][0] - p[16][0]) * w, (p[15][1] - p[16][1]) * h) / sw
        crossed = (p[15][0] - p[16][0]) * (p[11][0] - p[12][0]) < 0
        return dw < WRISTS_CLOSE or crossed
    return False


def torso_box(p, w, h):
    """Torso and arms from the MediaPipe pose, in pixels (x0, y0, x1, y1)."""
    sw = shoulder_px(p, w)
    idx = (0, 11, 12, 13, 14, 15, 16, 19, 20)
    xs = [p[i][0] * w for i in idx]
    ys = [p[i][1] * h for i in idx]
    y1 = max(max(ys) + 0.5 * sw, (p[23][1] + p[24][1]) / 2 * h)
    return [min(xs) - 0.6 * sw, min(ys) - 0.9 * sw, max(xs) + 0.6 * sw, y1]


def good_points(hand):
    return [q for q in hand if q[2] >= KP_MIN and 0 <= q[0] <= 1 and 0 <= q[1] <= 1]


def crop_3d(lm, rgb, hand, sw, w, h):
    """MediaPipe on a crop around an RTMW hand: (image points, world points) or None."""
    good = good_points(hand)
    xs = [q[0] * w for q in good]
    ys = [q[1] * h for q in good]
    side = max(CROP_PAD * max(max(xs) - min(xs), max(ys) - min(ys)), CROP_MIN * sw)
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    si = max(16, int(side))
    x0, y0 = int(cx - si / 2), int(cy - si / 2)
    pad = cv2.copyMakeBorder(rgb, si, si, si, si, cv2.BORDER_CONSTANT, value=0)
    c = np.ascontiguousarray(cv2.resize(pad[y0 + si:y0 + 2 * si, x0 + si:x0 + 2 * si], (CROP_PX, CROP_PX),
                                        interpolation=cv2.INTER_CUBIC))
    res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=c))
    rt = np.array([[q[0] * w, q[1] * h] for q in hand])
    ok = np.array([q[2] >= KP_MIN for q in hand])
    size = max(np.ptp(rt[ok][:, 0]), np.ptp(rt[ok][:, 1]), 1.0)
    for k, lms in enumerate(res.hand_landmarks):
        full = np.array([[x0 + l.x * si, y0 + l.y * si] for l in lms])
        err = np.mean(np.linalg.norm(full[ok] - rt[ok], axis=1)) / size
        if np.linalg.norm(full[0] - rt[0]) / sw < CROP_WRIST and err < CROP_ERR:
            img = [[r((x0 + l.x * si) / w), r((y0 + l.y * si) / h), r(l.z * si / w)] for l in lms]
            world = [[r(q.x), r(q.y), r(q.z)] for q in res.hand_world_landmarks[k]] if res.hand_world_landmarks else []
            return img, world
    return None


def flat_world(img, f, w, h):
    """World points for a 2D hand: flat (z = 0), centred, at the shoulder's metres-per-pixel."""
    p, pw = f.get("pose"), f.get("pose_world")
    if not p or not pw:
        return []
    m = math.dist(pw[11], pw[12])
    px = math.hypot((p[11][0] - p[12][0]) * w, (p[11][1] - p[12][1]) * h)
    if px < 5 or m <= 0:
        return []
    s = m / px
    cx = sum(q[0] for q in img) / len(img)
    cy = sum(q[1] for q in img) / len(img)
    return [[r((q[0] - cx) * w * s), r((q[1] - cy) * h * s), 0.0] for q in img]


def merge(f, rt, lm, rgb, w, h, st):
    """Adds RTMW's view of the hands to one frame (in place)."""
    p = f["pose"]
    sw = shoulder_px(p, w)
    hands = f["hands"]
    n_mp = len(hands)
    f.setdefault("hand_src", ["det"] * n_mp)
    f.setdefault("handedness_raw", [])
    side_of = [None] * n_mp
    sides = {s: rt[s] for s in ("l", "r") if len(good_points(rt[s])) >= KP_COUNT}
    cen = lambda pts: np.mean([[q[0] * w, q[1] * h] for q in pts], 0)
    pairs = []
    for hi in range(n_mp):
        c = cen(hands[hi])
        for s, hd in sides.items():
            pairs.append((float(np.linalg.norm(c - cen(good_points(hd))) / sw), hi, s))
    used = set()
    for d, hi, s in sorted(pairs):
        if d >= MATCH or side_of[hi] or s in used:
            continue
        side_of[hi] = s
        used.add(s)
        st["hinted"] += 1
        # ¿la muñeca de la pose más cercana decía el lado contrario?
        near = min((15, 16), key=lambda wi: math.hypot((hands[hi][0][0] - p[wi][0]) * w, (hands[hi][0][1] - p[wi][1]) * h))
        if (near == 15) != (s == "l"):
            st["side_fixed"] += 1
    for s, hd in sides.items():
        if s in used:
            continue
        got = crop_3d(lm, rgb, hd, sw, w, h)
        if got:
            img, world, src = got[0], got[1], "rtmw3d"
            st["added_3d"] += 1
        else:
            img = [[r(q[0]), r(q[1]), 0.0] for q in hd]
            world, src = flat_world(img, f, w, h), "rtmw"
            st["added_2d"] += 1
        hands.append(img)
        f["hands_world"].append(world)
        f["handedness_raw"].append(src)
        f["hand_src"].append(src)
        side_of.append(s)
    f["hand_side"] = side_of


def strip(ff):
    """Undo a previous pass (for --force)."""
    for f in ff["frames"]:
        src = f.get("hand_src") or []
        keep = [i for i in range(len(f.get("hands") or [])) if not (i < len(src) and src[i].startswith("rtmw"))]
        for k in ("hands", "hands_world", "handedness_raw", "hand_src"):
            if k in f:
                f[k] = [f[k][i] for i in keep if i < len(f[k])]
        f.pop("hand_side", None)
    ff.pop("rtmw", None)


def process(path, pose_model, lm):
    with open(path) as fh:
        ff = json.load(fh)
    if ff.get("error") or not ff.get("frames"):
        return None
    if "rtmw" in ff:
        strip(ff)
    w, h = ff["video"]["width"], ff["video"]["height"]
    vid = os.path.basename(path)[:-5]
    frames = ff["frames"]
    todo = [j for j, f in enumerate(frames) if needs_pass(f, w, h)]
    st = {"model": os.path.basename(RTMW_URL)[:-4], "frames": len(todo), "hinted": 0, "side_fixed": 0,
          "added_3d": 0, "added_2d": 0}
    if todo:
        cap = cv2.VideoCapture(os.path.join(VIDEOS, vid + ".mp4"))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        want = {}
        for j in todo:
            want.setdefault(int(round((frames[j]["t"] - 1) * fps / 1000)), []).append(j)
        idx, last = 0, max(want)
        try:
            while idx <= last:
                ok, bgr = cap.read()
                if not ok:
                    break
                for j in want.get(idx, []):
                    f = frames[j]
                    k, s = pose_model(bgr, bboxes=[torso_box(f["pose"], w, h)])
                    k, s = k[0], s[0]
                    hand = lambda a: [[r(k[i][0] / w), r(k[i][1] / h), r(s[i], 2)] for i in range(a, a + 21)]
                    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                    merge(f, {"l": hand(91), "r": hand(112)}, lm, rgb, w, h, st)
                idx += 1
        finally:
            cap.release()
    ff["rtmw"] = st
    with open(path + ".tmp", "w") as fh:
        json.dump(ff, fh, separators=(",", ":"))
    os.replace(path + ".tmp", path)
    return st


def main() -> None:
    args = sys.argv[1:]
    force = "--force" in args
    shard = None
    if "--shard" in args:
        k = args.index("--shard")
        shard = tuple(int(x) for x in args[k + 1].split("/"))
        del args[k:k + 2]
    args = [a for a in args if a != "--force"]
    ids = args or sorted(f[:-5] for f in os.listdir(FRAMES) if f.endswith(".json"))
    if shard:
        ids = ids[shard[0]::shard[1]]

    def done(i):
        with open(os.path.join(FRAMES, i + ".json")) as fh:
            return '"rtmw":' in fh.read()

    todo = [i for i in ids if os.path.exists(os.path.join(FRAMES, i + ".json")) and (force or not done(i))]
    print(f"{len(ids)} videos, {len(todo)} to pass", flush=True)
    if not todo:
        return
    os.makedirs(MODELS, exist_ok=True)
    onnx = download_checkpoint(RTMW_URL, dst_dir=MODELS)
    pose_model = RTMPose(onnx, model_input_size=RTMW_INPUT, to_openpose=False, backend="onnxruntime", device="cpu")
    lm = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=os.path.join(MODELS, "hand_landmarker.task")),
        running_mode=vision.RunningMode.IMAGE, num_hands=2,
        min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3))
    tot = {}
    t0 = time.time()
    try:
        for n, vid in enumerate(todo, 1):
            st = process(os.path.join(FRAMES, vid + ".json"), pose_model, lm)
            for k, v in (st or {}).items():
                if isinstance(v, int):
                    tot[k] = tot.get(k, 0) + v
            if n % 25 == 0 or n == len(todo):
                print(f"[{n}/{len(todo)}] {time.time() - t0:.0f}s {tot}", flush=True)
    finally:
        lm.close()


if __name__ == "__main__":
    main()
