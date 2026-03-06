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
  // Eyebrow positions
  const browY = eyebrows === "RAISED" ? 52 : eyebrows === "FURROWED" ? 60 : 56;
  const browCurve = eyebrows === "FURROWED" ? 4 : eyebrows === "RAISED" ? -4 : 0;

  // Mouth shapes
  const mouthPaths: Record<MouthShape, string> = {
    NEUTRAL: "M 80,135 Q 100,138 120,135",
    OPEN: "M 80,132 Q 100,148 120,132",
    CLOSED: "M 82,135 L 118,135",
    ROUNDED: "M 90,130 Q 88,140 100,142 Q 112,140 110,130 Q 100,128 90,130",
    STRETCHED: "M 72,133 Q 100,140 128,133",
  };

  // Head tilt
  const headRotation: Record<HeadMov, number> = {
    NONE: 0,
    NOD: 5,
    SHAKE: 0,
    TILT_LEFT: -12,
    TILT_RIGHT: 12,
    TILT_BACK: -8,
    TILT_DOWN: 8,
  };

  return (
    <svg viewBox="0 0 200 200" className="w-full" style={{ maxHeight: 280 }}>
      <g transform={`rotate(${headRotation[head]}, 100, 100)`}>
        {/* Head shape */}
        <ellipse cx="100" cy="100" rx="55" ry="68" fill="#fef3c7" stroke="#d4a574" strokeWidth="2" />

        {/* Hair */}
        <path d="M 48,70 Q 50,30 100,28 Q 150,30 152,70" fill="none" stroke="#92400e" strokeWidth="6" strokeLinecap="round" />

        {/* Eyebrows */}
        <path
          d={`M 70,${browY} Q 80,${browY - 6 + browCurve} 90,${browY}`}
          fill="none"
          stroke="#78350f"
          strokeWidth="2.5"
          strokeLinecap="round"
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
          fill="none"
          stroke="#78350f"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          {eyebrows !== "NEUTRAL" && (
            <animate attributeName="d" values={
              eyebrows === "RAISED"
                ? `M 110,${browY + 2} Q 120,${browY - 4} 130,${browY + 2};M 110,${browY} Q 120,${browY - 6 + browCurve} 130,${browY};M 110,${browY + 2} Q 120,${browY - 4} 130,${browY + 2}`
                : `M 110,${browY - 2} Q 120,${browY - 2 + browCurve} 130,${browY - 2};M 110,${browY} Q 120,${browY - 6 + browCurve} 130,${browY};M 110,${browY - 2} Q 120,${browY - 2 + browCurve} 130,${browY - 2}`
            } dur="1.5s" repeatCount="indefinite" />
          )}
        </path>

        {/* Eyes */}
        <ellipse cx="80" cy="72" rx="8" ry="6" fill="white" stroke="#78350f" strokeWidth="1.5" />
        <ellipse cx="120" cy="72" rx="8" ry="6" fill="white" stroke="#78350f" strokeWidth="1.5" />
        <circle cx="80" cy="72" r="3" fill="#1e293b" />
        <circle cx="120" cy="72" r="3" fill="#1e293b" />

        {/* Nose */}
        <path d="M 100,82 L 96,98 Q 100,101 104,98 Z" fill="none" stroke="#d4a574" strokeWidth="1.5" />

        {/* Mouth */}
        <path
          d={mouthPaths[mouth]}
          fill={mouth === "OPEN" || mouth === "ROUNDED" ? "#dc2626" : "none"}
          stroke="#b91c1c"
          strokeWidth="2"
          strokeLinecap="round"
          fillOpacity={0.3}
        />

        {/* Ears */}
        <ellipse cx="45" cy="85" rx="6" ry="12" fill="#fef3c7" stroke="#d4a574" strokeWidth="1.5" />
        <ellipse cx="155" cy="85" rx="6" ry="12" fill="#fef3c7" stroke="#d4a574" strokeWidth="1.5" />
      </g>

      {/* Head movement indicator */}
      {head !== "NONE" && (
        <g>
          <text x="100" y="190" textAnchor="middle" fontSize="10" fill="#6366f1" fontWeight="600">
            {head === "NOD" ? "\u2195 Nod" : head === "SHAKE" ? "\u2194 Shake" : `Tilt ${head.replace("TILT_", "").toLowerCase()}`}
          </text>
        </g>
      )}
    </svg>
  );
}

const EYEBROW_OPTIONS: { value: EyebrowPos; label: string; spanish: string }[] = [
  { value: "NEUTRAL", label: "Neutral", spanish: "Normal" },
  { value: "RAISED", label: "Raised", spanish: "Levantadas" },
  { value: "FURROWED", label: "Furrowed", spanish: "Frun\u0327idas" },
];

const MOUTH_OPTIONS: { value: MouthShape; label: string; spanish: string }[] = [
  { value: "NEUTRAL", label: "Neutral", spanish: "Normal" },
  { value: "OPEN", label: "Open", spanish: "Abierta" },
  { value: "CLOSED", label: "Closed", spanish: "Cerrada" },
  { value: "ROUNDED", label: "Rounded", spanish: "Redondeada" },
  { value: "STRETCHED", label: "Stretched", spanish: "Estirada" },
];

const HEAD_OPTIONS: { value: HeadMov; label: string; spanish: string }[] = [
  { value: "NONE", label: "None", spanish: "Sin movimiento" },
  { value: "NOD", label: "Nod", spanish: "Asentir" },
  { value: "SHAKE", label: "Shake", spanish: "Negar" },
  { value: "TILT_LEFT", label: "Tilt Left", spanish: "Inclinaci\u00f3n izq." },
  { value: "TILT_RIGHT", label: "Tilt Right", spanish: "Inclinaci\u00f3n der." },
  { value: "TILT_BACK", label: "Tilt Back", spanish: "Inclinaci\u00f3n atr\u00e1s" },
  { value: "TILT_DOWN", label: "Tilt Down", spanish: "Inclinaci\u00f3n abajo" },
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
          Non-manual markers (RNM) are facial expressions, head movements, and body postures that carry
          grammatical meaning in sign language. They can indicate <b>questions</b>, <b>negation</b>,
          <b>emphasis</b>, and <b>emotional tone</b>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Face diagram */}
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-amber-50/50 to-white">
          <FaceDiagram {...face} />
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Eyebrows */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Eyebrows / Cejas
            </label>
            <div className="flex gap-1.5">
              {EYEBROW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFace((f) => ({ ...f, eyebrows: opt.value }))}
                  className={`flex-1 rounded-lg py-2 text-center text-xs font-medium transition-all ${
                    face.eyebrows === opt.value
                      ? "bg-rose-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.spanish}
                </button>
              ))}
            </div>
          </div>

          {/* Mouth */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Mouth / Boca
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
                  {opt.spanish}
                </button>
              ))}
            </div>
          </div>

          {/* Head movement */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Head Movement / Movimiento de cabeza
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
                  {opt.spanish}
                </button>
              ))}
            </div>
          </div>

          {/* Notation output */}
          <div className="rounded-xl bg-gray-900 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              LSM-PN Notation
            </p>
            <p className="font-mono text-sm text-emerald-400">
              RNM: eyebrows={face.eyebrows.toLowerCase()}, mouth={face.mouth.toLowerCase()}
              {face.head !== "NONE" ? `, head=${face.head.toLowerCase()}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
