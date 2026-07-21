"use client";

import { useState } from "react";
import FaceDiagram from "./FaceDiagram";
import type { FaceState } from "./RNMControls";




const EYEBROW_OPTIONS: { value: FaceState["eyebrows"]; label: string }[] = [
  { value: "NEUTRAL", label: "Normal" },
  { value: "RAISED", label: "Levantadas" },
  { value: "FURROWED", label: "Fruncidas" },
];

const MOUTH_OPTIONS: { value: FaceState["mouth"]; label: string }[] = [
  { value: "NEUTRAL", label: "Normal" },
  { value: "OPEN", label: "Abierta" },
  { value: "CLOSED", label: "Cerrada" },
  { value: "ROUNDED", label: "Redondeada" },
  { value: "STRETCHED", label: "Estirada" },
];

const HEAD_OPTIONS: { value: FaceState["head"]; label: string }[] = [
  { value: "NONE", label: "Sin movimiento" },
  { value: "NOD", label: "Asentir" },
  { value: "SHAKE", label: "Negar" },
  { value: "TILT_LEFT", label: "Inclinar izq." },
  { value: "TILT_RIGHT", label: "Inclinar der." },
  { value: "TILT_BACK", label: "Inclinar atrás" },
  { value: "TILT_DOWN", label: "Inclinar abajo" },
];

export default function RNMExplorer() {
  const [face, setFace] = useState<FaceState>({
    eyebrows: "NEUTRAL",
    mouth: "NEUTRAL",
    head: "NONE",
  });

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="rounded-xl bg-rose-50 p-3">
        <p className="text-xs leading-relaxed text-rose-700">
          Los rasgos no manuales (RNM) son expresiones faciales, movimientos de
          cabeza y posturas corporales que portan significado gramatical en la
          Lengua de Señas Mexicana (LSM). Pueden indicar <b>preguntas</b>, <b>negación</b>,
          <b>énfasis</b> y <b>tono emocional</b>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Face diagram */}
        <div className="rounded-2xl border border-gray-200 bg-gold-tint/40">
          <FaceDiagram {...face} />
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Eyebrows */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Cejas
            </label>
            <div className="flex gap-1.5">
              {EYEBROW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setFace((f) => ({ ...f, eyebrows: opt.value }))
                  }
                  className={`flex-1 rounded-lg py-2 text-center text-xs font-medium transition-all ${
                    face.eyebrows === opt.value
                      ? "bg-rose-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mouth */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Boca
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MOUTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFace((f) => ({ ...f, mouth: opt.value }))}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    face.mouth === opt.value
                      ? "bg-rose-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Head movement */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Movimiento de cabeza
            </label>
            <div className="flex flex-wrap gap-1.5">
              {HEAD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFace((f) => ({ ...f, head: opt.value }))}
                  className={`rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                    face.head === opt.value
                      ? "bg-rose-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notation output */}
          <div className="rounded-xl bg-gray-900 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Notación LSM-PN
            </p>
            <p className="font-mono text-sm text-green">
              RNM: cejas={face.eyebrows.toLowerCase()}, boca=
              {face.mouth.toLowerCase()}
              {face.head !== "NONE"
                ? `, cabeza=${face.head.toLowerCase()}`
                : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
