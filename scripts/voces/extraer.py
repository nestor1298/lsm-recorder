#!/usr/bin/env python3
"""Pose, manos y gestos de la cara de cada persona, cuadro a cuadro (12/s).

Como extract.py del léxico, pero con varias personas en cuadro:
  - MediaPipe Pose (hasta 3 cuerpos), Hand (hasta 6 manos) y Face (hasta 3
    caras, con blendshapes y matriz de la cabeza);
  - cada cuerpo se liga a la persona (seudónimo) cuya cara seguida en esa
    toma contiene su nariz (personas.py);
  - las manos se buscan además en un recorte ampliado alrededor de cada
    muñeca levantada (en tomas abiertas la mano mide ~70 px de 1920 y el
    detector de cuadro completo la pierde); cada mano se asigna a la muñeca
    más cercana de su cuerpo;
  - de la cara se guardan solo los blendshapes y el ángulo de la cabeza:
    nada de la malla de puntos (es lo que más identifica a una persona).

Salida: data/voces-en-senas/_frames/<id>.json (no se versiona).
Uso: .venv-lexicon/bin/python -I scripts/voces/extraer.py [--shard i/n] [--force] [ids...]
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

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts", "wikisigns"))
from extract import CROP_AHEAD, CROP_PX, CROP_SIDE, head_euler, model, pts, r  # noqa: E402

DATA = os.path.join(ROOT, "data", "voces-en-senas")
VIDEOS = os.path.join(DATA, "_videos")
FRAMES = os.path.join(DATA, "_frames")
CACHE = os.path.join(DATA, "_cache")
FPS = 12
LIMITE_S = float(os.environ.get("VOCES_LIMITE_S", "inf"))   # para pruebas: corta el episodio aquí
CERCA_MUNECA = 0.5     # una mano es de una muñeca a menos de esto (anchos de hombro)


def landmarkers():
    v = vision.RunningMode.VIDEO
    pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model("pose")), running_mode=v, num_poses=3,
        min_pose_detection_confidence=0.4, min_pose_presence_confidence=0.4, min_tracking_confidence=0.4))
    face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model("face")), running_mode=v, num_faces=3,
        output_face_blendshapes=True, output_facial_transformation_matrixes=True))
    crop = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model("hand")), running_mode=vision.RunningMode.IMAGE,
        num_hands=2, min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3))
    return pose, face, crop


def mano_en_recorte(crop, rgb, pl, wi, ei, w, h, sw):
    """Mano de la muñeca `wi` en un recorte ampliado (como crop_hand del léxico)."""
    x, y = pl[wi].x * w, pl[wi].y * h
    ex, ey = pl[ei].x * w, pl[ei].y * h
    cx, cy = x + CROP_AHEAD * (x - ex), y + CROP_AHEAD * (y - ey)
    side = max(48, int(CROP_SIDE * sw))
    x0, y0 = int(cx - side / 2), int(cy - side / 2)
    pad = cv2.copyMakeBorder(rgb, side, side, side, side, cv2.BORDER_CONSTANT, value=0)
    c = pad[y0 + side:y0 + 2 * side, x0 + side:x0 + 2 * side]
    if c.size == 0:
        return None
    c = np.ascontiguousarray(cv2.resize(c, (CROP_PX, CROP_PX), interpolation=cv2.INTER_CUBIC))
    res = crop.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=c))
    best = None
    for k, lms in enumerate(res.hand_landmarks):
        full = [[r((x0 + l.x * side) / w), r((y0 + l.y * side) / h), r(l.z * side / w)] for l in lms]
        d = math.hypot(full[0][0] * w - x, full[0][1] * h - y) / sw
        if d < CERCA_MUNECA and (best is None or d < best[0]):
            world = pts(res.hand_world_landmarks[k]) if res.hand_world_landmarks else []
            best = (d, full, world)
    return best


def persona_de(nariz, t, pistas, toma):
    """La pista de cara (y su persona) que contiene la nariz del cuerpo, en esta toma.

    Se guarda el índice de la pista: no cambia si se vuelven a agrupar las
    personas (el seudónimo se resuelve al armar el corpus)."""
    mejor = None
    for n, p in enumerate(pistas):
        if p["toma"] != toma or not (p["t0"] - 0.6 <= t <= p["t1"] + 0.6):
            continue
        x0, y0, x1, y1 = p["caja"]
        mx, my = (x1 - x0) * 0.35, (y1 - y0) * 0.35
        if x0 - mx <= nariz[0] <= x1 + mx and y0 - my <= nariz[1] <= y1 + my:
            d = math.hypot(nariz[0] - (x0 + x1) / 2, nariz[1] - (y0 + y1) / 2)
            if mejor is None or d < mejor[0]:
                mejor = (d, n, p["persona"])
    return (mejor[1], mejor[2]) if mejor else (None, None)


def procesar(vid: str) -> dict:
    per = json.load(open(os.path.join(CACHE, "personas", vid + ".json"), encoding="utf-8"))
    tomas, pistas = per["tomas"], per["pistas"]
    cap = cv2.VideoCapture(os.path.join(VIDEOS, vid + ".mp4"))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    paso = fps / FPS
    pose, face, crop = landmarkers()
    frames = []
    i, k, sig = 0, 0, 0.0
    toma = 0
    try:
        while cap.grab():
            if i + 0.5 >= sig:
                sig += paso
                t = i / fps
                if t > LIMITE_S:
                    break
                while toma < len(tomas) - 1 and t >= tomas[toma]["t1"]:
                    toma += 1
                if tomas[toma]["tipo"] == "sin_caras":
                    i += 1
                    continue
                ok, bgr = cap.retrieve()
                if not ok:
                    break
                ts = int(round(t * 1000))
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                pr = pose.detect_for_video(img, ts)
                fr = face.detect_for_video(img, ts)
                caras = []
                for j, fl in enumerate(fr.face_landmarks or []):
                    caras.append({"nariz": (fl[1].x, fl[1].y),
                                  "bs": {c.category_name: r(c.score, 3) for c in fr.face_blendshapes[j] if c.category_name != "_neutral"}
                                  if fr.face_blendshapes else None,
                                  "head": head_euler(fr.facial_transformation_matrixes[j]) if fr.facial_transformation_matrixes else None})
                gente = []
                for j, pl in enumerate(pr.pose_landmarks or []):
                    sw = abs(pl[11].x - pl[12].x) * w
                    if sw < 12:
                        continue
                    pista, quien = persona_de((pl[0].x, pl[0].y), t, pistas, toma)
                    p = {"pista": pista, "persona": quien, "pose": pts(pl, vis=True), "pose_world": pts(pr.pose_world_landmarks[j]),
                         "hands": [], "hands_world": [], "hand_src": [], "hand_wrist": []}
                    hip_y = (pl[23].y + pl[24].y) / 2
                    for wi, ei in ((15, 13), (16, 14)):
                        if pl[wi].visibility < 0.5 or pl[wi].y > 0.98 or pl[wi].y > hip_y + 0.02:
                            continue
                        got = mano_en_recorte(crop, rgb, pl, wi, ei, w, h, sw)
                        if got:
                            p["hands"].append(got[1])
                            p["hands_world"].append(got[2])
                            p["hand_src"].append("crop")
                            p["hand_wrist"].append(wi)
                    # gestos de la cara: la cara más cercana a la nariz del cuerpo
                    if caras:
                        c = min(caras, key=lambda c: math.hypot(c["nariz"][0] - pl[0].x, c["nariz"][1] - pl[0].y))
                        if math.hypot(c["nariz"][0] - pl[0].x, c["nariz"][1] - pl[0].y) * w < sw * 0.6:
                            p["blendshapes"] = c["bs"]
                            p["head"] = c["head"]
                    gente.append(p)
                frames.append({"t": ts, "toma": toma, "gente": gente})
                k += 1
            i += 1
    finally:
        pose.close(); face.close(); crop.close(); cap.release()
    return {"schema": "voces-en-senas-frames/1", "youtube_id": vid,
            "video": {"width": w, "height": h, "fps": r(fps, 3)}, "muestreo_fps": FPS,
            "nota": "Sin malla de la cara: solo blendshapes y ángulo de la cabeza.", "frames": frames}


def main() -> None:
    os.makedirs(FRAMES, exist_ok=True)
    args = sys.argv[1:]
    force = "--force" in args
    shard = None
    if "--shard" in args:
        k = args.index("--shard")
        shard = tuple(int(x) for x in args[k + 1].split("/"))
        del args[k:k + 2]
    ids = [a for a in args if not a.startswith("--")] or sorted(
        f[:-5] for f in os.listdir(os.path.join(CACHE, "personas")) if f.endswith(".json"))
    if shard:
        ids = ids[shard[0]::shard[1]]
    for vid in ids:
        dst = os.path.join(FRAMES, vid + ".json")
        if os.path.exists(dst) and not force:
            continue
        t0 = time.time()
        d = procesar(vid)
        with open(dst + ".tmp", "w") as f:
            json.dump(d, f, separators=(",", ":"))
        os.replace(dst + ".tmp", dst)
        n = sum(len(f["gente"]) for f in d["frames"])
        manos = sum(len(p["hands"]) for f in d["frames"] for p in f["gente"])
        print(f"{vid}: {len(d['frames'])} cuadros, {n} cuerpos, {manos} manos, {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
