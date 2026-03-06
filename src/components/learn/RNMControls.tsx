"use client";

import { useState } from "react";

type EyebrowPos = "NEUTRAL" | "RAISED" | "FURROWED";
type MouthShape = "NEUTRAL" | "OPEN" | "CLOSED" | "ROUNDED" | "STRETCHED";
type HeadMov = "NONE" | "NOD" | "SHAKE" | "TILT_LEFT" | "TILT_RIGHT" | "TILT_BACK" | "TILT_DOWN";

interface FaceState {
  eyebrows: EyebrowPos;
  mouth: MouthShape;
  head: HeadMov;
}

/** Animated SVG face showing non-manual markers */
function FaceDiagram({ eyebrows, mouth, head }: FaceState) {
  const browY = eyebrows === "RAISED" ? 52 : eyebrows === "FURROWED" ? 60 : 56;
  const browCurve = eyebrows === "FURROWED" ? 4 : eyebrows === "RAISED" ? -4 : 0;

  const mouthPaths: Record<MouthShape, string> = {
    NEUTRAL: "M 80,135 Q 100,138 120,135",
    OPEN: "M 80,132 Q 100,148 120,132",
    CLOSED: "M 82,135 L 118,135",
    ROUNDED: "M 90,130 Q 88,140 100,142 Q 112,140 110,130 Q 100,128 90,130",
    STRETCHED: "M 72,133 Q 100,140 128,133",
  };

  const headRotation: Record<HeadMov, number> = {
    NONE: 0, NOD: 5, SHAKE: 0, TILT_LEFT: -12, TILT_RIGHT: 12, TILT_BACK: -8, TILT_DOWN: 8,
  };

  const headLabels: Record<HeadMov, string> = {
    NONE: "", NOD: "↕ Asentir", SHAKE: "↔ Negar",
    TILT_LEFT: "Inclinar izq.", TILT_RIGHT: "Inclinar der.",
    TILT_BACK: "Inclinar atrás", TILT_DOWN: "Inclinar abajo",
  };

  return (
    <svg viewBox="0 0 200 200" className="w-full" style={{ maxHeight: 220 }}>
      <g transform={`rotate(${headRotation[head]}, 100, 100)`}>
        <ellipse cx="100" cy="100" rx="55" ry="68" fill="#fef3c7" stroke="#d4a574" strokeWidth="2" />
        <path d="M 48,70 Q 50,30 100,28 Q 150,30 152,70" fill="none" stroke="#92400e" strokeWidth="6" strokeLinecap="round" />
        <path
          d={`M 70,${browY} Q 80,${browY - 6 + browCurve} 90,${browY}`}
          fill="none" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"
        >
          {eyebrows !== "NEUTRAL" && (
            <animate attributeName="d" values={
              eyebrows === "RAISED"
                ? `M 70,${browY + 2} Q 80,${browY - 4} 90,${browY + 2};M 70,${browY} Q 80,${browY - 6 + browCurve} 90,${browY};M 70,${browY + 2} Q 80,${browY - 4} 90,${browY + 2}`
                : `M 70,${browY - 2} Q 80,${browY - 2 + browCurve} 90,${browY - 2};M 70,${browY} Q 80,${browY - 6 + browCurve} 90,${browY};M 70,${browY - 2} Q 80,${browY - 2 + browCurve} 90,${browY - 2}`
            } dur="1.5s" repeatCount="indefinite" />
          )}
        </path>
        <path
          d={`M 110,${browY} Q 120,${browY - 6 + browCurve} 130,${browY}`}
          fill="none" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"
        >
          {eyebrows !== "NEUTRAL" && (
            <animate attributeName="d" values={
              eyebrows === "RAISED"
                ? `M 110,${browY + 2} Q 120,${browY - 4} 130,${browY + 2};M 110,${browY} Q 120,${browY - 6 + browCurve} 130,${browY};M 110,${browY + 2} Q 120,${browY - 4} 130,${browY + 2}`
                : `M 110,${browY - 2} Q 120,${browY - 2 + browCurve} 130,${browY - 2};M 110,${browY} Q 120,${browY - 6 + browCurve} 130,${browY};M 110,${browY - 2} Q 120,${browY - 2 + browCurve} 130,${browY - 2}`
            } dur="1.5s" repeatCount="indefinite" />
          )}
        </path>
        <ellipse cx="80" cy="72" rx="8" ry="6" fill="white" stroke="#78350f" strokeWidth="1.5" />
        <ellipse cx="120" cy="72" rx="8" ry="6" fill="white" stroke="#78350f" strokeWidth="1.5" />
        <circle cx="80" cy="72" r="3" fill="#1e293b" />
        <circle cx="120" cy="72" r="3" fill="#1e293b" />
        <path d="M 100,82 L 96,98 Q 100,101 104,98 Z" fill="none" stroke="#d4a574" strokeWidth="1.5" />
        <path
          d={mouthPaths[mouth]}
          fill={mouth === "OPEN" || mouth === "ROUNDED" ? "#dc2626" : "none"}
          stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" fillOpacity={0.3}
        />
        <ellipse cx="45" cy="85" rx="6" ry="12" fill="#fef3c7" stroke="#d4a574" strokeWidth="1.5" />
        <ellipse cx="155" cy="85" rx="6" ry="12" fill="#fef3c7" stroke="#d4a574" strokeWidth="1.5" />
      </g>
      {head !== "NONE" && (
        <text x="100" y="190" textAnchor="middle" fontSize="10" fill="#6366f1" fontWeight="600">
          {headLabels[head]}
        </text>
      )}
    </svg>
  );
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
  className?: string;
}

export default function RNMControls({ className = "" }: RNMControlsProps) {
  const [face, setFace] = useState<FaceState>({
    eyebrows: "NEUTRAL",
    mouth: "NEUTRAL",
    head: "NONE",
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Face diagram */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-b from-amber-50/50 to-white">
        <FaceDiagram {...face} />
      </div>

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
