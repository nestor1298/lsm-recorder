#!/usr/bin/env python3
"""VOCES EN SEÑAS (Jalisco TV): lista de episodios y descarga local.

Lee la lista de reproducción del programa, guarda el índice de episodios
(sin títulos: traen nombres reales de las personas invitadas) y baja cada
video en 1080p con audio a data/voces-en-senas/_videos/<id>.mp4, que no
se versiona (el programa tiene todos los derechos reservados).

Se reanuda donde se quedó (--download-archive).
Uso: python3 -I scripts/voces/fetch.py [--solo-indice] [ids...]
"""

import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data", "voces-en-senas")
VIDEOS = os.path.join(DATA, "_videos")
CACHE = os.path.join(DATA, "_cache")
PLAYLIST = "https://www.youtube.com/playlist?list=PLc4hgy6279jENUfnkzDZtVq_k_VCc1eMI"
# 1080p H.264 (MediaPipe/OpenCV lo leen sin problema) + audio AAC
FORMATO = "137+140/bv*[height<=1080][vcodec^=avc1]+ba[ext=m4a]/b[height<=1080]"


def indice() -> list[dict]:
    out = subprocess.run(
        ["yt-dlp", "--no-warnings", "--flat-playlist", "--print",
         "%(id)s\t%(duration)s", PLAYLIST],
        capture_output=True, text=True, check=True,
    ).stdout
    eps = []
    for line in out.splitlines():
        vid, dur = line.split("\t")
        eps.append({"youtube_id": vid, "duration_s": int(float(dur)) if dur not in ("NA", "") else None,
                    "url": f"https://www.youtube.com/watch?v={vid}"})
    return eps


def main() -> None:
    os.makedirs(VIDEOS, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    args = sys.argv[1:]
    eps = indice()
    # fecha de publicación (no viene en la lista plana)
    for e in eps:
        e["upload_date"] = subprocess.run(
            ["yt-dlp", "--no-warnings", "--skip-download", "--print", "%(upload_date)s", e["url"]],
            capture_output=True, text=True,
        ).stdout.strip() or None
    eps.sort(key=lambda e: e["upload_date"] or "")
    with open(os.path.join(DATA, "episodes.json"), "w", encoding="utf-8") as f:
        json.dump({"program": "VOCES EN SEÑAS", "channel": "Jalisco TV (@jaliscotvmx)",
                   "playlist": PLAYLIST, "license": "Todos los derechos reservados (YouTube estándar)",
                   "episodes": eps}, f, ensure_ascii=False, indent=1)
    print(f"{len(eps)} episodios en el índice", flush=True)
    if "--solo-indice" in args:
        return
    ids = [a for a in args if not a.startswith("--")] or [e["youtube_id"] for e in eps]
    batch = os.path.join(CACHE, "batch.txt")
    with open(batch, "w") as f:
        f.write("\n".join(f"https://www.youtube.com/watch?v={i}" for i in ids) + "\n")
    subprocess.run([
        "yt-dlp", "--no-warnings", "--no-progress", "--ignore-errors",
        "-f", FORMATO, "--merge-output-format", "mp4",
        # en trozos: YouTube limita la velocidad de las descargas de un solo bloque
        "--http-chunk-size", "10M", "--concurrent-fragments", "4",
        "-o", os.path.join(VIDEOS, "%(id)s.%(ext)s"),
        "--download-archive", os.path.join(CACHE, "archive.txt"),
        "--sleep-requests", "1", "--sleep-interval", "2", "--max-sleep-interval", "5",
        "-a", batch,
    ], check=False)


if __name__ == "__main__":
    main()
