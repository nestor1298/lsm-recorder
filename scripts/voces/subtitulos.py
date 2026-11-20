#!/usr/bin/env python3
"""Subtítulos quemados y rótulos de VOCES EN SEÑAS, con OCR de Apple Vision (local).

El programa no trae subtítulos en YouTube: van dentro de la imagen, abajo
al centro (o arriba, cuando un rótulo ocupa la parte de abajo). Se
muestrean 5 cuadros por segundo; solo cuando cambia el texto blanco de las
franjas se corre el OCR. Las tarjetas iguales seguidas se juntan, y las
tarjetas se unen en oraciones por la puntuación.

Los rótulos («NOMBRE / CONDUCTORA») dan el rol de quien está en cuadro; el
nombre se descarta y nunca se guarda.

Salida: data/voces-en-senas/_cache/subtitulos/<id>.json
Uso: .venv-voces/bin/python -I scripts/voces/subtitulos.py [--force] [ids...]
"""

import json
import os
import re
import sys
import time

import cv2
import numpy as np
from ocrmac import ocrmac
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data", "voces-en-senas")
VIDEOS = os.path.join(DATA, "_videos")
OUT = os.path.join(DATA, "_cache", "subtitulos")

MUESTRA_FPS = 5
# franjas (fracciones de la imagen): abajo y arriba, sin el logo de la izquierda
ABAJO = (0.80, 0.985, 0.12, 0.90)
ARRIBA = (0.015, 0.14, 0.12, 0.90)
BLANCO = 205           # umbral del texto blanco
CAMBIO = 0.18          # fracción de píxeles de texto distintos para correr el OCR
MIN_TEXTO = 40         # píxeles blancos mínimos para que haya texto
ROLES = ("CONDUCTORA", "CONDUCTOR", "INVITADA", "INVITADO", "INTÉRPRETE", "INTERPRETE",
         "INTÉRPRETE DE LSM", "INTÉRPRETE LSM", "COCONDUCTORA", "COCONDUCTOR", "PANELISTA")
LOGO = re.compile(r"^(VOCES?|SE[ÑN]AS\.?|EN|PROGRAMA PARA LA COMUNIDAD SORDA)$", re.I)


def mascara(img, franja):
    h, w = img.shape[:2]
    y0, y1, x0, x1 = franja
    c = img[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    g = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY)
    m = (g > BLANCO).astype(np.uint8)
    return cv2.resize(m, (240, 24), interpolation=cv2.INTER_AREA) > 0


def ocr(img):
    rgb = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    return ocrmac.OCR(rgb, language_preference=["es-ES"], recognition_level="accurate").recognize()


LETRERO = "PROGRAMAPARALACOMUNIDADSORDA"


def sin_letrero(t: str) -> str:
    """Quita del inicio un pedazo del letrero «PROGRAMA PARA LA COMUNIDAD SORDA».

    Cuando el subtítulo sube a la parte de arriba comparte renglón con el
    letrero animado, y el OCR los lee juntos («COMUNIDADSORY cuando…»). Se
    busca el prefijo de letras más largo (4+), casi todo en mayúsculas, que
    sea un pedazo del letrero; solo la primera letra puede estar mal leída
    («SOMUNIDA…»).
    """
    letras = [(i, c) for i, c in enumerate(t) if c.isalpha()]
    mejor = 0
    for k in range(min(len(letras), len(LETRERO)), 3, -1):
        orig = [c for _, c in letras[:k]]
        if sum(c.isupper() for c in orig) < 0.75 * k:
            continue
        p = "".join(c.upper() for c in orig)
        if any(p[1:] == LETRERO[j + 1:j + k] for j in range(len(LETRERO) - k + 1)):
            mejor = k
            break
    if not mejor:
        return t
    resto = t[letras[mejor - 1][0] + 1:].lstrip(" ,.:;-")
    # «SLa Regional»: una mayúscula suelta pegada a la siguiente palabra
    if len(resto) > 2 and resto[0].isupper() and resto[1].isupper() and resto[2].islower():
        resto = resto[1:]
    # «s ¿Y tu…»: letra suelta que no es palabra (y, o, a, e, u sí lo son)
    if len(resto) > 2 and resto[0].isalpha() and resto[1] == " " and resto[0].lower() not in "yoaeu":
        resto = resto[2:]
    return resto


def leer(img):
    """OCR del cuadro: (subtítulo, rol del rótulo o None)."""
    subt, rotulo = [], []
    for texto, conf, (x, y, bw, bh) in ocr(img):
        t = texto.strip()
        if not t or LOGO.match(t) or conf < 0.3:
            continue
        cx = x + bw / 2
        arriba = y > 0.8          # Vision mide y desde abajo
        abajo = y + bh < 0.2
        if not (arriba or abajo):
            continue              # texto del escenario, no subtítulo
        mayus = t.upper() == t and re.search(r"[A-ZÁÉÍÓÚÑ]", t)
        if abajo and x < 0.3 and cx < 0.45 and mayus and x > 0.15:
            rotulo.append((y, t.upper().strip(" .")))
            continue
        # los subtítulos van en altas y bajas; lo que es todo mayúsculas es el
        # letrero animado «PROGRAMA PARA LA COMUNIDAD SORDA» o texto del set
        if arriba and x < 0.32:
            t = sin_letrero(t)
        if 0.2 < cx < 0.8 and re.search(r"[a-záéíóúñü]", t) and x > 0.15:
            subt.append((-(y + bh), x, t))   # de arriba abajo, de izquierda a derecha
    subt.sort()
    # rótulo: arriba el nombre (se tira) y abajo lo que hace la persona
    # («CONDUCTORA», «INVITADO», «ACTOR DE TEATRO»…)
    rol = None
    if len(rotulo) >= 2:
        rol = min(rotulo)[1]
    elif rotulo and rotulo[0][1] in ROLES:
        rol = rotulo[0][1]
    return " ".join(s[2] for s in subt).strip(), rol


def normal(t: str) -> str:
    return re.sub(r"\W+", " ", t.lower()).strip()


def procesar(vid: str) -> dict:
    cap = cv2.VideoCapture(os.path.join(VIDEOS, vid + ".mp4"))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    paso = max(1, round(fps / MUESTRA_FPS))
    estados = []          # (t, subtítulo, rol)
    previo = None
    leido = ("", None)
    i = 0
    ocrs = 0
    while True:
        ok = cap.grab()
        if not ok:
            break
        if i % paso == 0:
            ok, img = cap.retrieve()
            if not ok:
                break
            m = np.concatenate([mascara(img, ABAJO), mascara(img, ARRIBA)])
            hay = int(m.sum()) >= MIN_TEXTO
            if not hay:
                leido = ("", None)
            elif previo is None or (m ^ previo).sum() / max(1, (m | previo).sum()) > CAMBIO:
                leido = leer(img)
                ocrs += 1
            previo = m
            estados.append((round(i / fps, 2), leido[0], leido[1]))
        i += 1
    cap.release()
    dt = paso / fps

    # tarjetas: mismo texto seguido (tolerando un hueco de una muestra)
    tarjetas = []
    for t, s, _ in estados:
        if not s:
            continue
        if tarjetas and normal(tarjetas[-1]["texto"]) == normal(s) and t - tarjetas[-1]["t1"] <= 2 * dt + 1e-6:
            tarjetas[-1]["t1"] = round(t + dt, 2)
        else:
            tarjetas.append({"t0": t, "t1": round(t + dt, 2), "texto": s})
    # tarjetas de un solo cuadro suelen ser lecturas en plena transición
    tarjetas = [c for c in tarjetas if c["t1"] - c["t0"] > dt * 1.5]

    # oraciones: se juntan tarjetas hasta un final de oración
    oraciones, cur = [], []
    for c in tarjetas:
        cur.append(c)
        if re.search(r"[.?!…]\"?$", c["texto"]) or (len(cur) > 1 and c["t0"] - cur[-2]["t1"] > 2.0):
            oraciones.append(cur)
            cur = []
    if cur:
        oraciones.append(cur)
    ors = [{"t0": o[0]["t0"], "t1": o[-1]["t1"], "texto": re.sub(r"\s+", " ", " ".join(c["texto"] for c in o)).strip(),
            "tarjetas": len(o)} for o in oraciones]

    # rótulos: intervalos con su rol
    rotulos = []
    for t, _, r in estados:
        if not r:
            continue
        if rotulos and rotulos[-1]["rol"] == r and t - rotulos[-1]["t1"] <= 2 * dt + 1e-6:
            rotulos[-1]["t1"] = round(t + dt, 2)
        else:
            rotulos.append({"t0": t, "t1": round(t + dt, 2), "rol": r})
    return {"youtube_id": vid, "muestreo_fps": MUESTRA_FPS, "ocr_llamadas": ocrs,
            "tarjetas": tarjetas, "oraciones": ors, "rotulos": rotulos}


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    args = sys.argv[1:]
    force = "--force" in args
    ids = [a for a in args if not a.startswith("--")] or sorted(
        f[:-4] for f in os.listdir(VIDEOS) if f.endswith(".mp4") and "." not in f[:-4])
    for vid in ids:
        dst = os.path.join(OUT, vid + ".json")
        if os.path.exists(dst) and not force:
            continue
        t0 = time.time()
        r = procesar(vid)
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(r, f, ensure_ascii=False, indent=1)
        print(f"{vid}: {len(r['tarjetas'])} tarjetas, {len(r['oraciones'])} oraciones, "
              f"{len(r['rotulos'])} rótulos, {r['ocr_llamadas']} OCR, {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
