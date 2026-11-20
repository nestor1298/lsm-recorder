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
Uso: .venv-lexicon/bin/python -I scripts/voces/personas.py [--roles]
     (--roles rehace solo roles y condición desde la caché)
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


# ── Roles y condición auditiva ─────────────────────────────────

# Roles que el programa usa para varias personas a la vez (no son de una sola)
ROLES_COMUNES = {"CONDUCTORA", "CONDUCTOR", "INVITADA", "INVITADO", "INVITADAS", "INVITADOS"}
# Antes de SORDO/OYENTE, estas palabras dicen que no se habla de la persona
# («COMUNIDAD SORDA», «TEATRO SORDO», «PERSONA SORDOCIEGA», «PADRES SORDOS»)
NO_PERSONA = {"COMUNIDAD", "TEATRO", "PERSONA", "PERSONAS", "LOS", "LAS", "LA", "EL", "DE", "CULTURA", "MUNDO",
              "PADRES", "PADRE", "MADRE", "HIJOS", "HIJO", "HIJA", "FAMILIA", "Y"}
ROL_MIN_S = 4.0       # un rótulo de persona dura ~7 s; menos es ruido del OCR o texto a medio escribir


def texto_de_rol(t: str) -> bool:
    """¿Puede ser un rol? Los rótulos de tema traen «:», comillas o comas (y a veces
    un nombre: «EL ARTE QUE HABLA: …», «JUAN PABLO, DEPORTISTA…»)."""
    if any(c in t for c in ':"“”,;0123456789'):
        return False
    palabras = t.split()
    return 0 < len(palabras) <= 8 and all(len(w.strip(".")) >= 1 and w.strip(".").isalpha() for w in palabras)


def generalizar(rol: str | None) -> str | None:
    """Quita el lugar o la empresa del final («… EN TLAJOMULCO», «… EN JABIL»): con
    el seudónimo, eso bastaría para reconocer a la persona."""
    if not rol:
        return rol
    ws = rol.split()
    if len(ws) >= 3 and ws[-2] == "EN":
        ws = ws[:-2]
    return " ".join(ws)


def condicion_de(rol: str | None) -> str | None:
    """Condición auditiva solo si el rótulo la dice de la persona misma."""
    if not rol:
        return None
    if "INTÉRPRET" in rol or "INTERPRET" in rol:
        return "intérprete"
    ws = rol.split()
    for k, w in enumerate(ws):
        previa = ws[k - 1] if k else ""
        if previa in NO_PERSONA:
            continue
        if w.startswith("SORD"):
            return "sorda"
        if w.startswith("OYENTE"):
            return "oyente"
    return None


def poner_roles(eps: list[dict], participantes: dict) -> None:
    """Rol por episodio: el rótulo en pantalla mientras la persona sale sola en cuadro.

    - el rótulo se escribe letra por letra: un texto cuenta para el más largo que
      empieza igual;
    - se descartan textos que no parecen rol (`texto_de_rol`) o que duran poco;
    - en tomas de dos o abiertas, un rótulo propio (no CONDUCTORA, INVITADO…)
      cuenta solo para quien no es fija del programa;
    - un rótulo que sale sobre dos o más personas del episodio es de tema, no de
      persona (salvo CONDUCTORA, INVITADO…);
    - se quita el lugar o la empresa del final (`generalizar`);
    - quien sale en 3 episodios o más lleva su rol más común en todos (las
      conductoras no cambian de rol aunque un episodio no tenga su rótulo)."""
    fijas = {pid for pid, q in participantes.items() if len(q["episodios"]) >= 3}
    for e in eps:
        vid = e["youtube_id"]
        sub = os.path.join(CACHE, "subtitulos", vid + ".json")
        rotulos = json.load(open(sub, encoding="utf-8"))["rotulos"] if os.path.exists(sub) else []
        textos = [r["rol"] for r in rotulos]
        completo = {t: max((o for o in textos if o.startswith(t)), key=len) for t in textos}
        dura = {}
        for r in rotulos:
            dura[completo[r["rol"]]] = dura.get(completo[r["rol"]], 0) + r["t1"] - r["t0"]
        votos = {}            # persona → texto → segundos
        for r in rotulos:
            t = completo[r["rol"]]
            if not texto_de_rol(t) or dura[t] < ROL_MIN_S:
                continue
            for p in e["pistas"]:
                if not p.get("persona"):
                    continue
                solapa = min(r["t1"], p["t1"]) - max(r["t0"], p["t0"])
                # cuando sale sola; en tomas de dos se cuela el rótulo de la otra, así que
                # ahí solo cuenta para quien no es fija del programa (la invitada)
                sola = e["tomas"][p["toma"]]["tipo"] == "primer_plano"
                if solapa > 1.0 and (sola or (t not in ROLES_COMUNES and p["persona"] not in fijas)):
                    votos.setdefault(p["persona"], {}).setdefault(t, 0)
                    votos[p["persona"]][t] += solapa
        quienes = {}
        for pid, vs in votos.items():
            for t in vs:
                quienes.setdefault(t, set()).add(pid)
        for pid, vs in votos.items():
            vs = {t: v for t, v in vs.items() if t in ROLES_COMUNES or len(quienes[t]) == 1}
            if pid in participantes and vid in participantes[pid]["episodios"]:
                participantes[pid]["episodios"][vid]["rol"] = generalizar(max(vs, key=vs.get)) if vs else None
    for q in participantes.values():
        roles = [ep["rol"] for ep in q["episodios"].values() if ep["rol"]]
        q["rol"] = max(set(roles), key=roles.count) if roles else None
        if len(q["episodios"]) >= 3 and q["rol"]:
            for ep in q["episodios"].values():
                ep["rol"] = q["rol"]
        q["condicion"] = condicion_de(q["rol"])
        q["condicion_fuente"] = "rótulo del programa" if q["condicion"] else None


def guardar(eps: list[dict], participantes: dict) -> None:
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
        print(q["id"], q["seudonimo"], q["rol"], q["condicion"], f"{q['en_pantalla_s'] / 60:.1f} min",
              f"{len(q['episodios'])} episodios", {k: v["rol"] for k, v in q["episodios"].items()})


def solo_roles() -> None:
    """Rehace roles y condición desde la caché (sin volver a ver las caras)."""
    eps = []
    for f in sorted(os.listdir(os.path.join(CACHE, "personas"))):
        if f.endswith(".json") and "." not in f[:-5]:
            eps.append(json.load(open(os.path.join(CACHE, "personas", f), encoding="utf-8")))
    participantes = {q["id"]: q for q in json.load(open(os.path.join(DATA, "participantes.json"), encoding="utf-8"))["participantes"]}
    for q in participantes.values():
        for ep in q["episodios"].values():
            ep["rol"] = None
    poner_roles(eps, participantes)
    guardar(eps, participantes)


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
    for q in participantes.values():
        q["en_pantalla_s"] = round(q["en_pantalla_s"], 1)
    poner_roles(eps, participantes)

    guardar(eps, participantes)


if __name__ == "__main__":
    solo_roles() if "--roles" in sys.argv else main()
