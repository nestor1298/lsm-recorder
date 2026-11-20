#!/usr/bin/env python3
"""Personas de VOCES EN SEÑAS: tomas, caras seguidas y seudónimos.

Por episodio:
  1. cortes de cámara (diferencia entre miniaturas a 10 cuadros/s);
  2. caras a 2 cuadros/s (SCRFD) con su vector ArcFace, en memoria;
  3. dentro de cada toma, las caras se encadenan por solapamiento (pistas).
En todo el corpus:
  4. las pistas se agrupan por parecido de cara: cada grupo es una persona
     y recibe un seudónimo fijo (P01 · Ahuehuete, …), por orden de aparición;
  5. el rol sale de los rótulos (CONDUCTORA, INVITADO, …) que estaban en
     pantalla cuando esa persona salía sola en cuadro.

Nunca se guardan rostros, nombres ni vectores: solo el número de persona,
cuándo y dónde aparece en cada toma, y su rol.

Salida: data/voces-en-senas/_cache/personas/<id>.json (tomas y pistas) y
data/voces-en-senas/participantes.json (seudónimos, roles, apariciones).
Uso: .venv-lexicon/bin/python -I scripts/voces/personas.py
"""

import json
import os
import sys
import time

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from caras import Caras  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data", "voces-en-senas")
VIDEOS = os.path.join(DATA, "_videos")
CACHE = os.path.join(DATA, "_cache")

CORTE_FPS = 10
CARA_FPS = 2
CORTE = 0.30          # diferencia media de miniaturas (0..1) que cuenta como corte
MISMA = 0.40          # parecido de cara (coseno) para ser la misma persona
UNIR = 0.45           # dos grupos se unen si sus centros se parecen más que esto
MIN_PISTA_S = 1.5     # pistas más cortas no deciden personas
SEUDONIMOS = ["Ahuehuete", "Biznaga", "Cempasúchil", "Colibrí", "Copal", "Jacaranda", "Maguey", "Mezquite",
              "Nopal", "Ocelote", "Pitaya", "Quetzal", "Tule", "Xoconostle", "Zenzontle", "Ceiba",
              "Huizache", "Tejón", "Ajolote", "Guaje", "Tabachín", "Cacomixtle", "Huaje", "Axolote",
              "Capulín", "Zapote", "Tecolote", "Mamey", "Guayabo", "Cuitlacoche"]


def iou(a, b) -> float:
    x0, y0 = max(a[0], b[0]), max(a[1], b[1])
    x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    i = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i
    return i / u if u > 0 else 0.0


def episodio(vid: str, caras: Caras):
    cap = cv2.VideoCapture(os.path.join(VIDEOS, vid + ".mp4"))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    paso_corte = max(1, round(fps / CORTE_FPS))
    paso_cara = max(1, round(fps / CARA_FPS))
    cortes = [0.0]
    previa = None
    muestras = []      # (t, [caras])
    i = 0
    while cap.grab():
        if i % paso_corte == 0 or i % paso_cara == 0:
            ok, img = cap.retrieve()
            if not ok:
                break
            t = i / fps
            if i % paso_corte == 0:
                mini = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (64, 36), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
                if previa is not None and np.abs(mini - previa).mean() > CORTE * 0.25 and t - cortes[-1] > 0.6:
                    cortes.append(round(t, 2))
                previa = mini
            if i % paso_cara == 0:
                ds = caras.detectar(img)
                for d in ds:
                    d["vector"] = caras.vector(img, d["puntos"])
                    del d["puntos"]
                muestras.append((round(t, 2), ds))
        i += 1
    cap.release()
    dur = i / fps
    cortes.append(round(dur, 2))
    tomas = [{"t0": a, "t1": b} for a, b in zip(cortes[:-1], cortes[1:])]

    # pistas: dentro de una toma, cada cara sigue a la más solapada de la muestra anterior
    pistas = []
    abiertas = []
    toma_de = lambda t: next(k for k, tm in enumerate(tomas) if tm["t0"] <= t < tm["t1"] or k == len(tomas) - 1)
    for t, ds in muestras:
        k = toma_de(t)
        abiertas = [p for p in abiertas if p["toma"] == k and t - p["t1"] <= 1.6]
        usadas = set()
        for d in sorted(ds, key=lambda d: -d["puntaje"]):
            mejor = max(((iou(d["caja"], p["cajas"][-1]), p) for p in abiertas if id(p) not in usadas), default=(0, None), key=lambda x: x[0])
            if mejor[1] is not None and mejor[0] > 0.3:
                p = mejor[1]
            else:
                p = {"toma": k, "t0": t, "t1": t, "cajas": [], "vectores": []}
                pistas.append(p)
                abiertas.append(p)
            usadas.add(id(p))
            p["t1"] = t
            p["cajas"].append(d["caja"])
            p["vectores"].append(d["vector"])
    for p in pistas:
        p["t1"] = round(p["t1"] + 1 / CARA_FPS, 2)
        v = np.mean(p.pop("vectores"), axis=0)
        p["vector"] = v / (np.linalg.norm(v) + 1e-9)
        c = np.median(np.array(p.pop("cajas")), axis=0)
        p["caja"] = [round(float(c[0] / W), 4), round(float(c[1] / H), 4), round(float(c[2] / W), 4), round(float(c[3] / H), 4)]
        p["alto_cara"] = round(float((c[3] - c[1]) / H), 3)
    # tipo de toma: cuántas caras y qué tan grandes
    for k, tm in enumerate(tomas):
        ps = [p for p in pistas if p["toma"] == k and p["t1"] - p["t0"] >= 1.0]
        alto = max((p["alto_cara"] for p in ps), default=0)
        tm["caras"] = len(ps)
        tm["tipo"] = "sin_caras" if not ps else "primer_plano" if len(ps) == 1 and alto > 0.16 else "dos" if len(ps) == 2 else "abierta"
    return {"youtube_id": vid, "duracion_s": round(dur, 2), "ancho": W, "alto": H, "tomas": tomas, "pistas": pistas}


def agrupar(pistas: list[dict]) -> list[int]:
    """Grupos por parecido de cara: centroides acumulados y luego unión de centros parecidos."""
    orden = sorted(range(len(pistas)), key=lambda i: -(pistas[i]["t1"] - pistas[i]["t0"]))
    centros, peso, grupo = [], [], [-1] * len(pistas)
    for i in orden:
        p = pistas[i]
        if p["t1"] - p["t0"] < MIN_PISTA_S:
            continue
        sims = [float(p["vector"] @ (c / np.linalg.norm(c))) for c in centros]
        j = int(np.argmax(sims)) if sims else -1
        if j >= 0 and sims[j] > MISMA:
            centros[j] = centros[j] + p["vector"] * (p["t1"] - p["t0"])
            peso[j] += p["t1"] - p["t0"]
            grupo[i] = j
        else:
            centros.append(p["vector"] * (p["t1"] - p["t0"]))
            peso.append(p["t1"] - p["t0"])
            grupo[i] = len(centros) - 1
    # unir grupos cuyos centros se parecen
    padre = list(range(len(centros)))
    raiz = lambda a: a if padre[a] == a else raiz(padre[a])
    cn = [c / np.linalg.norm(c) for c in centros]
    for a in range(len(cn)):
        for b in range(a + 1, len(cn)):
            if float(cn[a] @ cn[b]) > UNIR:
                padre[raiz(b)] = raiz(a)
    # pistas cortas: al grupo más parecido si se parece lo suficiente
    for i, p in enumerate(pistas):
        if grupo[i] < 0 and cn:
            sims = [float(p["vector"] @ c) for c in cn]
            j = int(np.argmax(sims))
            if sims[j] > MISMA + 0.05:
                grupo[i] = j
    return [raiz(g) if g >= 0 else -1 for g in grupo]


def main() -> None:
    os.makedirs(os.path.join(CACHE, "personas"), exist_ok=True)
    eps_meta = json.load(open(os.path.join(DATA, "episodes.json"), encoding="utf-8"))["episodes"]
    fecha = {e["youtube_id"]: e.get("upload_date") or "" for e in eps_meta}
    ids = sorted((f[:-4] for f in os.listdir(VIDEOS) if f.endswith(".mp4") and "." not in f[:-4]), key=lambda v: fecha.get(v, ""))
    caras = Caras()
    eps = []
    for vid in ids:
        t0 = time.time()
        e = episodio(vid, caras)
        eps.append(e)
        tipos = {}
        for tm in e["tomas"]:
            tipos[tm["tipo"]] = tipos.get(tm["tipo"], 0) + tm["t1"] - tm["t0"]
        print(f"{vid}: {len(e['tomas'])} tomas, {len(e['pistas'])} pistas, "
              f"{ {k: round(v) for k, v in tipos.items()} } s, {time.time() - t0:.0f}s", flush=True)

    todas = [(e, p) for e in eps for p in e["pistas"]]
    grupos = agrupar([p for _, p in todas])
    # tiempo en pantalla por grupo; los grupos con poco tiempo son público o tomas de apoyo
    tiempo = {}
    for (e, p), g in zip(todas, grupos):
        if g >= 0:
            tiempo[g] = tiempo.get(g, 0) + p["t1"] - p["t0"]
    validos = [g for g, s in tiempo.items() if s >= 20]
    # seudónimo por orden de primera aparición
    primera = {}
    for (e, p), g in zip(todas, grupos):
        if g in validos and g not in primera:
            primera[g] = (fecha.get(e["youtube_id"], ""), p["t0"])
    nombre = {g: (f"P{k + 1:02d}", SEUDONIMOS[k % len(SEUDONIMOS)]) for k, g in enumerate(sorted(validos, key=lambda g: primera[g]))}

    # roles: rótulo en pantalla mientras la persona sale sola en cuadro
    votos = {}
    for e in eps:
        sub = os.path.join(CACHE, "subtitulos", e["youtube_id"] + ".json")
        rotulos = json.load(open(sub, encoding="utf-8"))["rotulos"] if os.path.exists(sub) else []
        for r in rotulos:
            for (e2, p), g in zip(todas, grupos):
                if e2 is not e or g not in nombre:
                    continue
                tm = e["tomas"][p["toma"]]
                solapa = min(r["t1"], p["t1"]) - max(r["t0"], p["t0"])
                # solo cuando sale sola: en tomas de dos se cuela el rótulo de la otra
                if solapa > 1.0 and tm["tipo"] == "primer_plano":
                    clave = (g, e["youtube_id"])
                    votos.setdefault(clave, {}).setdefault(r["rol"], 0)
                    votos[clave][r["rol"]] += solapa

    participantes = {}
    for (e, p), g in zip(todas, grupos):
        if g not in nombre:
            p["persona"] = None
            continue
        pid, seud = nombre[g]
        p["persona"] = pid
        q = participantes.setdefault(pid, {"id": pid, "seudonimo": seud, "episodios": {}, "en_pantalla_s": 0.0})
        q["en_pantalla_s"] += p["t1"] - p["t0"]
        ep = q["episodios"].setdefault(e["youtube_id"], {"en_pantalla_s": 0.0, "rol": None})
        ep["en_pantalla_s"] = round(ep["en_pantalla_s"] + p["t1"] - p["t0"], 1)
    for (g, vid), vs in votos.items():
        # el rótulo se escribe letra por letra: «ACTOR PROFESIONAL DE TEA…» cuenta
        # para el texto completo más largo que empieza igual
        juntos = {}
        for k, v in vs.items():
            largo = max((o for o in vs if o.startswith(k)), key=len)
            juntos[largo] = juntos.get(largo, 0) + v
        pid = nombre[g][0]
        participantes[pid]["episodios"][vid]["rol"] = max(juntos, key=juntos.get)
    for q in participantes.values():
        q["en_pantalla_s"] = round(q["en_pantalla_s"], 1)
        roles = [ep["rol"] for ep in q["episodios"].values() if ep["rol"]]
        q["rol"] = max(set(roles), key=roles.count) if roles else None
        # condición auditiva, solo si el rótulo del programa la dice
        texto = " ".join(roles)
        q["condicion"] = ("sorda" if "SORD" in texto else "intérprete" if "INTÉRPRET" in texto or "INTERPRET" in texto
                          else "oyente" if "OYENTE" in texto else None)
        q["condicion_fuente"] = "rótulo del programa" if q["condicion"] else None

    for e in eps:
        for p in e["pistas"]:
            p.pop("vector", None)       # los vectores no salen de la memoria
        with open(os.path.join(CACHE, "personas", e["youtube_id"] + ".json"), "w", encoding="utf-8") as f:
            json.dump(e, f, ensure_ascii=False)
    out = sorted(participantes.values(), key=lambda q: q["id"])
    with open(os.path.join(DATA, "participantes.json"), "w", encoding="utf-8") as f:
        json.dump({"nota": "Seudónimos asignados por parecido de cara, calculado en el equipo; no se guardan rostros, "
                           "nombres ni vectores. El rol sale de los rótulos del programa.",
                   "participantes": out}, f, ensure_ascii=False, indent=1)
    for q in out:
        print(q["id"], q["seudonimo"], q["rol"], f"{q['en_pantalla_s'] / 60:.1f} min", f"{len(q['episodios'])} episodios",
              {k: v["rol"] for k, v in q["episodios"].items()})


if __name__ == "__main__":
    main()
