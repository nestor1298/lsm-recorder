"""Caras para los seudónimos: detector SCRFD y reconocedor ArcFace (InsightFace buffalo_s).

Todo corre en el equipo. Los vectores de cara solo viven en memoria mientras
se agrupan las personas; nunca se escriben a disco. Modelos en
data/voces-en-senas/_cache/models/buffalo_s/ (licencia de InsightFace: solo
investigación no comercial).
"""

import os

import cv2
import numpy as np
import onnxruntime as ort

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELOS = os.path.join(ROOT, "data", "voces-en-senas", "_cache", "models", "buffalo_s")
TAM_DET = 640
# plantilla de 5 puntos de ArcFace (112 × 112)
PLANTILLA = np.array([[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366],
                      [41.5493, 92.3655], [70.7299, 92.2041]], dtype=np.float32)


def _sesion(nombre: str) -> ort.InferenceSession:
    return ort.InferenceSession(os.path.join(MODELOS, nombre), providers=["CPUExecutionProvider"])


class Caras:
    def __init__(self, umbral: float = 0.5):
        self.det = _sesion("det_500m.onnx")
        self.rec = _sesion("w600k_mbf.onnx")
        self.umbral = umbral
        self._centros: dict[int, np.ndarray] = {}

    def _anclas(self, paso: int) -> np.ndarray:
        if paso not in self._centros:
            n = TAM_DET // paso
            c = np.stack(np.mgrid[:n, :n][::-1], axis=-1).astype(np.float32).reshape(-1, 2) * paso
            self._centros[paso] = np.repeat(c, 2, axis=0)   # 2 anclas por celda
        return self._centros[paso]

    def detectar(self, bgr: np.ndarray) -> list[dict]:
        """Caras: caja [x0, y0, x1, y1] en píxeles, 5 puntos y puntaje."""
        h, w = bgr.shape[:2]
        k = TAM_DET / max(h, w)
        lienzo = np.zeros((TAM_DET, TAM_DET, 3), np.uint8)
        lienzo[: int(h * k), : int(w * k)] = cv2.resize(bgr, (int(w * k), int(h * k)))
        blob = cv2.dnn.blobFromImage(lienzo, 1 / 128, (TAM_DET, TAM_DET), (127.5, 127.5, 127.5), swapRB=True)
        outs = self.det.run(None, {self.det.get_inputs()[0].name: blob})
        cajas, puntos, puntajes = [], [], []
        for i, paso in enumerate((8, 16, 32)):
            s = outs[i][:, 0]
            b = outs[i + 3] * paso
            kp = outs[i + 6] * paso
            a = self._anclas(paso)
            ok = s >= self.umbral
            if not ok.any():
                continue
            a, b, kp, s = a[ok], b[ok], kp[ok], s[ok]
            cajas.append(np.stack([a[:, 0] - b[:, 0], a[:, 1] - b[:, 1], a[:, 0] + b[:, 2], a[:, 1] + b[:, 3]], 1))
            puntos.append(np.stack([np.stack([a[:, 0] + kp[:, 2 * j], a[:, 1] + kp[:, 2 * j + 1]], 1) for j in range(5)], 1))
            puntajes.append(s)
        if not cajas:
            return []
        cajas = np.concatenate(cajas) / k
        puntos = np.concatenate(puntos) / k
        puntajes = np.concatenate(puntajes)
        keep = cv2.dnn.NMSBoxes([[float(x0), float(y0), float(x1 - x0), float(y1 - y0)] for x0, y0, x1, y1 in cajas],
                                puntajes.tolist(), self.umbral, 0.4)
        return [{"caja": cajas[i].tolist(), "puntos": puntos[i], "puntaje": float(puntajes[i])} for i in np.array(keep).reshape(-1)]

    def vector(self, bgr: np.ndarray, puntos: np.ndarray) -> np.ndarray:
        """Vector ArcFace (512, normalizado) de una cara alineada con sus 5 puntos."""
        m, _ = cv2.estimateAffinePartial2D(puntos.astype(np.float32), PLANTILLA, method=cv2.LMEDS)
        cara = cv2.warpAffine(bgr, m, (112, 112), borderValue=0)
        blob = cv2.dnn.blobFromImage(cara, 1 / 127.5, (112, 112), (127.5, 127.5, 127.5), swapRB=True)
        v = self.rec.run(None, {self.rec.get_inputs()[0].name: blob})[0][0]
        return v / (np.linalg.norm(v) + 1e-9)
