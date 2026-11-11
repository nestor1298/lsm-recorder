#!/usr/bin/env python3
"""Per-frame landmarks for each downloaded Wikisigns video.

Batch twin of src/lib/vision/phon/analyze_video.ts: same MediaPipe tasks
(HandLandmarker ×2 hands, PoseLandmarker, FaceLandmarker with
blendshapes), same thresholds and the same sampling (12 fps, 8–72
frames). Adds what the browser analyzer does not keep: hand/pose world
landmarks, the face transformation matrix (head pitch/yaw/roll) and a
fixed subset of face-mesh points (FACEMARKS).

Pose-guided hand recovery (schema 2): MediaPipe's palm detector sees the
whole frame shrunk to 192 px, so a ~40 px hand at 360p often vanishes.
When the pose sees a raised wrist with no hand near it, the frame is
cropped around that wrist (along the forearm), enlarged to 256 px and
searched again. On 30 hard videos this cut lost hands from 24 % to 15 %
and raised frames with both hands from 62 % to 78 %. Each hand records
where it came from in `hand_src` ("det" or "crop").

Writes data/wikisigns-lsm/_frames/<youtube_id>.json (raw, not committed);
build.ts turns these into the lexicon.

Usage: .venv-lexicon/bin/python -I scripts/wikisigns/extract.py [--force] [--shard i/n] [ids...]
"""

import json
import math
import os
import numpy as np
import sys
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python import vision

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data", "wikisigns-lsm")
VIDEOS = os.path.join(DATA, "_videos")
FRAMES = os.environ.get("LEXICON_FRAMES_DIR") or os.path.join(DATA, "_frames")
MODELS = os.path.join(DATA, "_cache", "models")

MODEL_URLS = {
    "hand": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    # full (not lite): offline batch, accuracy over speed
    "pose": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    "face": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
}

TARGET_FPS = 12
MAX_FRAMES = 72
MIN_FRAMES = 8

# Face-mesh indices kept per frame (MediaPipe 478-point topology).
# Grouped by the articulators the RNM matrix talks about.
FACEMARKS = {
    "brow_right": [70, 63, 105, 66, 107],
    "brow_left": [300, 293, 334, 296, 336],
    "eye_right": [33, 160, 158, 133, 153, 144],
    "eye_left": [263, 387, 385, 362, 380, 373],
    "iris_right": [468],
    "iris_left": [473],
    "nose": [168, 6, 4, 1, 98, 327],
    "lips_outer": [61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91],
    "lips_inner": [78, 81, 13, 311, 308, 402, 14, 178],
    "cheeks": [50, 280, 205, 425],
    "jaw": [234, 172, 136, 150, 152, 379, 365, 397, 454],
    "forehead": [10, 109, 338],
}
FACEMARK_IDX = [i for grp in FACEMARKS.values() for i in grp]


def model(name: str) -> str:
    os.makedirs(MODELS, exist_ok=True)
    path = os.path.join(MODELS, os.path.basename(MODEL_URLS[name]))
    if not os.path.exists(path):
        urllib.request.urlretrieve(MODEL_URLS[name], path + ".tmp")
        os.replace(path + ".tmp", path)
    return path


def make_landmarkers():
    mode = vision.RunningMode.VIDEO
    hand = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model("hand")), running_mode=mode,
        num_hands=2, min_hand_detection_confidence=0.3,
        min_hand_presence_confidence=0.3, min_tracking_confidence=0.3))
    pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model("pose")), running_mode=mode,
        num_poses=1))
    face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model("face")), running_mode=mode,
        num_faces=1, output_face_blendshapes=True,
        output_facial_transformation_matrixes=True))
    crop = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model("hand")), running_mode=vision.RunningMode.IMAGE,
        num_hands=1, min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3))
    return hand, pose, face, crop


# Recorte guiado por la pose
CROP_PX = 256          # lado del recorte ampliado
CROP_SIDE = 0.9        # lado del recorte, en anchos de hombro
CROP_AHEAD = 0.6       # centro: muñeca + 0.6 × (muñeca − codo)
NEAR_WRIST = 0.35      # una mano «es» de esa muñeca a menos de esto (anchos de hombro)


def raised_wrists(pose_lms, w: int, h: int):
    """Muñecas visibles, en cuadro y por encima de la cadera: (índice, codo, x, y, ancho de hombros)."""
    p = pose_lms
    sw = abs(p[11].x - p[12].x) * w
    hip_y = (p[23].y + p[24].y) / 2
    if sw < 5:
        return []
    out = []
    for wi, ei in ((15, 13), (16, 14)):
        if p[wi].visibility < 0.7 or p[wi].y > 0.95 or p[wi].y > hip_y:
            continue
        out.append((wi, ei, p[wi].x * w, p[wi].y * h, sw))
    return out


def crop_hand(crop, rgb, pose_lms, wi: int, ei: int, x: float, y: float, sw: float, w: int, h: int):
    """Busca una mano en un recorte ampliado alrededor de la muñeca `wi`."""
    ex, ey = pose_lms[ei].x * w, pose_lms[ei].y * h
    cx, cy = x + CROP_AHEAD * (x - ex), y + CROP_AHEAD * (y - ey)
    side = max(64, int(CROP_SIDE * sw))
    x0, y0 = int(cx - side / 2), int(cy - side / 2)
    pad = cv2.copyMakeBorder(rgb, side, side, side, side, cv2.BORDER_CONSTANT, value=0)
    c = pad[y0 + side:y0 + 2 * side, x0 + side:x0 + 2 * side]
    if c.size == 0:
        return None
    c = np.ascontiguousarray(cv2.resize(c, (CROP_PX, CROP_PX), interpolation=cv2.INTER_CUBIC))
    res = crop.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=c))
    for k, lms in enumerate(res.hand_landmarks):
        # del recorte al cuadro completo (coordenadas normalizadas de la imagen)
        full = [[r((x0 + l.x * side) / w), r((y0 + l.y * side) / h), r(l.z * side / w)] for l in lms]
        if math.hypot(full[0][0] * w - x, full[0][1] * h - y) / sw < NEAR_WRIST:
            world = pts(res.hand_world_landmarks[k]) if res.hand_world_landmarks else []
            return full, world
    return None


def r(v: float, n: int = 4) -> float:
    return round(float(v), n)


def pts(lms, vis: bool = False):
    if vis:
        return [[r(q.x), r(q.y), r(q.z), r(getattr(q, "visibility", 0) or 0, 2)] for q in lms]
    return [[r(q.x), r(q.y), r(q.z)] for q in lms]


def head_euler(m) -> list[float]:
    """Pitch, yaw, roll (degrees) from the 4×4 facial transformation matrix."""
    R = [[m[i][j] for j in range(3)] for i in range(3)]
    sy = math.hypot(R[0][0], R[1][0])
    if sy > 1e-6:
        pitch = math.atan2(R[2][1], R[2][2])
        yaw = math.atan2(-R[2][0], sy)
        roll = math.atan2(R[1][0], R[0][0])
    else:
        pitch, yaw, roll = math.atan2(-R[1][2], R[1][1]), math.atan2(-R[2][0], sy), 0.0
    return [r(math.degrees(a), 2) for a in (pitch, yaw, roll)]


def extract(video_path: str) -> dict:
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n_total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = n_total / fps if n_total > 0 else 0.0
    if duration <= 0:
        raise RuntimeError("video sin duración")

    count = min(MAX_FRAMES, max(MIN_FRAMES, round(duration * TARGET_FPS)))
    step = duration / count
    wanted = [min(n_total - 1, int(round(min(duration - 0.01, i * step) * fps))) for i in range(count)]

    hand, pose, face, crop = make_landmarkers()
    frames = []
    try:
        idx, k = 0, 0
        last_ts = -1
        while k < len(wanted):
            ok, bgr = cap.read()
            if not ok:
                break
            while k < len(wanted) and wanted[k] == idx:
                ts = max(last_ts + 1, int(round(idx / fps * 1000)) + 1)
                last_ts = ts
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                hr = hand.detect_for_video(image, ts)
                pr = pose.detect_for_video(image, ts)
                fr = face.detect_for_video(image, ts)
                f = {
                    "t": ts,
                    "hands": [pts(x) for x in hr.hand_landmarks],
                    "hands_world": [pts(x) for x in (hr.hand_world_landmarks or [])],
                    "handedness_raw": [c[0].category_name for c in (hr.handedness or [])],
                }
                f["hand_src"] = ["det"] * len(f["hands"])
                if pr.pose_landmarks:
                    pl = pr.pose_landmarks[0]
                    f["pose"] = pts(pl, vis=True)
                    f["pose_world"] = pts(pr.pose_world_landmarks[0])
                    for wi, ei, x, y, sw in raised_wrists(pl, w, h):
                        if any(math.hypot(hh[0][0] * w - x, hh[0][1] * h - y) / sw < NEAR_WRIST for hh in f["hands"]):
                            continue
                        got = crop_hand(crop, rgb, pl, wi, ei, x, y, sw, w, h)
                        if got:
                            f["hands"].append(got[0])
                            f["hands_world"].append(got[1])
                            f["handedness_raw"].append("crop")
                            f["hand_src"].append("crop")
                if fr.face_landmarks:
                    mesh = fr.face_landmarks[0]
                    f["facemarks"] = [[r(mesh[i].x), r(mesh[i].y), r(mesh[i].z)] for i in FACEMARK_IDX]
                if fr.face_blendshapes:
                    f["blendshapes"] = {c.category_name: r(c.score, 3)
                                        for c in fr.face_blendshapes[0] if c.category_name != "_neutral"}
                if fr.facial_transformation_matrixes:
                    f["head"] = head_euler(fr.facial_transformation_matrixes[0])
                frames.append(f)
                k += 1
            idx += 1
    finally:
        hand.close(); pose.close(); face.close(); crop.close(); cap.release()

    return {
        "schema": "wikisigns-lsm-frames/2",
        "video": {"width": w, "height": h, "fps": r(fps, 3), "frame_count": n_total,
                  "duration_ms": int(round(duration * 1000))},
        "sampling": {"target_fps": TARGET_FPS, "max_frames": MAX_FRAMES, "frames": len(frames)},
        "hand_recovery": {"crop_px": CROP_PX, "crop_side_sw": CROP_SIDE, "crop_ahead": CROP_AHEAD,
                          "near_wrist_sw": NEAR_WRIST},
        "models": {k: os.path.basename(v) for k, v in MODEL_URLS.items()},
        "facemark_groups": FACEMARKS,
        "facemark_index": FACEMARK_IDX,
        "frames": frames,
    }


def main() -> None:
    os.makedirs(FRAMES, exist_ok=True)
    args = sys.argv[1:]
    force = "--force" in args
    shard = None
    if "--shard" in args:
        k = args.index("--shard")
        i, n = (int(x) for x in args[k + 1].split("/"))
        shard = (i, n)
        del args[k:k + 2]
    args = [a for a in args if a != "--force"]
    ids = args or sorted(f[:-4] for f in os.listdir(VIDEOS) if f.endswith(".mp4"))
    if shard:
        ids = ids[shard[0]::shard[1]]

    def done(i: str) -> bool:
        path = os.path.join(FRAMES, i + ".json")
        if not os.path.exists(path):
            return False
        if not force:
            return True
        with open(path) as fh:  # con --force solo se rehace lo que no es esquema 2
            return '"schema":"wikisigns-lsm-frames/2"' in fh.read(80)

    todo = [i for i in ids if not done(i)]
    print(f"{len(ids)} videos, {len(todo)} to extract", flush=True)
    for n, vid in enumerate(todo, 1):
        src = os.path.join(VIDEOS, vid + ".mp4")
        out = os.path.join(FRAMES, vid + ".json")
        try:
            data = extract(src)
        except Exception as e:
            data = {"schema": "wikisigns-lsm-frames/1", "error": str(e)}
        with open(out + ".tmp", "w") as f:
            json.dump(data, f, separators=(",", ":"))
        os.replace(out + ".tmp", out)
        if n % 20 == 0 or n == len(todo):
            print(f"[{n}/{len(todo)}] {vid}", flush=True)


if __name__ == "__main__":
    main()
