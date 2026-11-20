#!/usr/bin/env python3
"""Transcribe el audio de cada episodio a oraciones con tiempos.

El programa no trae subtítulos en YouTube: el texto escrito sale de la voz
(la persona oyente que conduce o la intérprete que voicea a quien seña).
Whisper large-v3-turbo (MLX, local) en español, con tiempo por palabra; las
palabras se juntan en oraciones por la puntuación y por pausas largas.

Salida: data/voces-en-senas/_cache/asr/<id>.json (crudo de Whisper) y
data/voces-en-senas/_cache/oraciones/<id>.json.
Uso: .venv-voces/bin/python -I scripts/voces/transcribe.py [ids...]
"""

import json
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data", "voces-en-senas")
VIDEOS = os.path.join(DATA, "_videos")
ASR = os.path.join(DATA, "_cache", "asr")
ORACIONES = os.path.join(DATA, "_cache", "oraciones")
MODELO = "mlx-community/whisper-large-v3-turbo"
PAUSA_S = 1.2        # una pausa así corta la oración aunque no haya punto
MAX_S = 14.0         # oraciones más largas se cortan en la pausa más grande


def audio(vid: str) -> str:
    wav = os.path.join(DATA, "_cache", "audio", vid + ".wav")
    if not os.path.exists(wav):
        os.makedirs(os.path.dirname(wav), exist_ok=True)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", os.path.join(VIDEOS, vid + ".mp4"),
                        "-vn", "-ac", "1", "-ar", "16000", wav], check=True)
    return wav


def oraciones(words: list[dict]) -> list[dict]:
    out, cur = [], []

    def cerrar():
        if not cur:
            return
        texto = re.sub(r"\s+", " ", "".join(w["word"] for w in cur)).strip()
        if texto:
            out.append({"t0": round(cur[0]["start"], 2), "t1": round(cur[-1]["end"], 2), "texto": texto,
                        "palabras": [{"w": w["word"].strip(), "t0": round(w["start"], 2), "t1": round(w["end"], 2),
                                      "p": round(w.get("probability", 0), 3)} for w in cur]})
        cur.clear()

    for i, w in enumerate(words):
        if cur and w["start"] - cur[-1]["end"] > PAUSA_S:
            cerrar()
        cur.append(w)
        fin = re.search(r"[.?!¿¡…]\s*$", w["word"]) is not None
        if fin or (cur[-1]["end"] - cur[0]["start"] > MAX_S and re.search(r"[,;:]\s*$", w["word"])):
            cerrar()
    cerrar()
    return out


def main() -> None:
    import mlx_whisper

    os.makedirs(ASR, exist_ok=True)
    os.makedirs(ORACIONES, exist_ok=True)
    ids = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(VIDEOS) if f.endswith(".mp4"))
    for vid in ids:
        crudo = os.path.join(ASR, vid + ".json")
        if not os.path.exists(crudo):
            r = mlx_whisper.transcribe(audio(vid), path_or_hf_repo=MODELO, language="es",
                                       word_timestamps=True, condition_on_previous_text=False)
            with open(crudo, "w", encoding="utf-8") as f:
                json.dump(r, f, ensure_ascii=False)
        with open(crudo, encoding="utf-8") as f:
            r = json.load(f)
        words = [w for s in r.get("segments", []) for w in s.get("words", [])]
        ors = oraciones(words)
        with open(os.path.join(ORACIONES, vid + ".json"), "w", encoding="utf-8") as f:
            json.dump({"youtube_id": vid, "modelo": MODELO, "oraciones": ors}, f, ensure_ascii=False, indent=1)
        print(f"{vid}: {len(ors)} oraciones, {len(words)} palabras", flush=True)


if __name__ == "__main__":
    main()
