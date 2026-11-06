#!/usr/bin/env python3
"""Per-frame landmarks for each downloaded Wikisigns video.

Batch twin of src/lib/vision/phon/analyze_video.ts: same MediaPipe tasks
(HandLandmarker ×2 hands, PoseLandmarker, FaceLandmarker with
blendshapes), same thresholds and the same sampling (12 fps, 8–72
frames). Adds what the browser analyzer does not keep: hand/pose world
landmarks, the face transformation matrix (head pitch/yaw/roll) and a
fixed subset of face-mesh points (FACEMARKS).

Writes data/wikisigns-lsm/_frames/<youtube_id>.json (raw, not committed);
build.ts turns these into the lexicon.

Usage: .venv-lexicon/bin/python -I scripts/wikisigns/extract.py [ids...]
"""

import json
import math
import os
import sys
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python import vision

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data", "wikisigns-lsm")
VIDEOS = os.path.join(DATA, "_videos")
FRAMES = os.path.join(DATA, "_frames")
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
    return hand, pose, face


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

    hand, pose, face = make_landmarkers()
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
                if pr.pose_landmarks:
                    f["pose"] = pts(pr.pose_landmarks[0], vis=True)
                    f["pose_world"] = pts(pr.pose_world_landmarks[0])
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
        hand.close(); pose.close(); face.close(); cap.release()

    return {
        "schema": "wikisigns-lsm-frames/1",
        "video": {"width": w, "height": h, "fps": r(fps, 3), "frame_count": n_total,
                  "duration_ms": int(round(duration * 1000))},
        "sampling": {"target_fps": TARGET_FPS, "max_frames": MAX_FRAMES, "frames": len(frames)},
        "models": {k: os.path.basename(v) for k, v in MODEL_URLS.items()},
        "facemark_groups": FACEMARKS,
        "facemark_index": FACEMARK_IDX,
        "frames": frames,
    }


def main() -> None:
    os.makedirs(FRAMES, exist_ok=True)
    ids = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(VIDEOS) if f.endswith(".mp4"))
    todo = [i for i in ids if not os.path.exists(os.path.join(FRAMES, i + ".json"))]
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
