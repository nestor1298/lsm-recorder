"use client";

import { useState, useEffect } from "react";

export type EyebrowPos = "NEUTRAL" | "RAISED" | "FURROWED";
export type MouthShape = "NEUTRAL" | "OPEN" | "CLOSED" | "ROUNDED" | "STRETCHED";
export type HeadMov = "NONE" | "NOD" | "SHAKE" | "TILT_LEFT" | "TILT_RIGHT" | "TILT_BACK" | "TILT_DOWN";

export interface FaceState {
  eyebrows: EyebrowPos;
  mouth: MouthShape;
  head: HeadMov;
}

const EYEBROW_OPTIONS: { value: EyebrowPos; label: string }[] = [
  { value: "NEUTRAL", label: "Normal" },
  { value: "RAISED", label: "Levantadas" },
  { value: "FURROWED", label: "Fruncidas" },
];

const MOUTH_OPTIONS: { value: MouthShape; label: string }[] = [
  { value: "NEUTRAL", label: "Normal" },
  { value: "OPEN", label: "Abierta" },
  { value: "CLOSED", label: "Cerrada" },
  { value: "ROUNDED", label: "Redondeada" },
  { value: "STRETCHED", label: "Estirada" },
];

const HEAD_OPTIONS: { value: HeadMov; label: string }[] = [
  { value: "NONE", label: "Ninguno" },
  { value: "NOD", label: "Asentir" },
  { value: "SHAKE", label: "Negar" },
  { value: "TILT_LEFT", label: "Izq." },
  { value: "TILT_RIGHT", label: "Der." },
  { value: "TILT_BACK", label: "Atrás" },
  { value: "TILT_DOWN", label: "Abajo" },
];

interface RNMControlsProps {
  onFaceChange?: (face: FaceState) => void;
  /** Pre-select face state (used by sign builder) */
  defaultFace?: FaceState;
  className?: string;
}

export default function RNMControls({ onFaceChange, defaultFace, className = "" }: RNMControlsProps) {
  const [face, setFace] = useState<FaceState>(defaultFace ?? {
    eyebrows: "NEUTRAL",
    mouth: "NEUTRAL",
    head: "NONE",
  });

  // Propagate face state to parent
  useEffect(() => {
    onFaceChange?.(face);
  }, [face, onFaceChange]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Three control groups side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Eyebrows */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Cejas
          </label>
          <div className="flex gap-1.5">
            {EYEBROW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFace((f) => ({ ...f, eyebrows: opt.value }))}
                className={`flex-1 rounded-lg py-1.5 text-center text-[10px] font-medium transition-all ${
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
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Boca
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MOUTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFace((f) => ({ ...f, mouth: opt.value }))}
                className={`rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all ${
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
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Cabeza
          </label>
          <div className="flex flex-wrap gap-1">
            {HEAD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFace((f) => ({ ...f, head: opt.value }))}
                className={`rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all ${
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
      </div>

      {/* Notation output */}
      <div className="rounded-xl bg-gray-900 p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
          Notación LSM-PN
        </p>
        <p className="font-mono text-sm text-emerald-400">
          RNM: cejas={face.eyebrows.toLowerCase()}, boca={face.mouth.toLowerCase()}
          {face.head !== "NONE" ? `, cabeza=${face.head.toLowerCase()}` : ""}
        </p>
      </div>
    </div>
  );
}
