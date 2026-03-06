"use client";

import { useState } from "react";

type ContourType = "STRAIGHT" | "ARC" | "CIRCLE" | "ZIGZAG" | "SEVEN";
type LocalType = "WIGGLE" | "CIRCULAR" | "TWIST" | "SCRATCH" | "NOD" | "OSCILLATE" | "RELEASE" | "FLATTEN" | "PROGRESSIVE" | "VIBRATE" | "RUB";
type PlaneType = "HORIZONTAL" | "VERTICAL" | "SAGITTAL" | "OBLIQUE";

interface MovementPath {
  type: ContourType;
  label: string;
  spanish: string;
  path: string;
  description: string;
}

const CONTOUR_MOVEMENTS: MovementPath[] = [
  {
    type: "STRAIGHT",
    label: "Recto",
    spanish: "Movimiento en l\u00ednea recta",
    path: "M 30,100 L 170,100",
    description: "A direct path from point A to B, the most common contour in LSM signs.",
  },
  {
    type: "ARC",
    label: "Arco",
    spanish: "Movimiento en arco",
    path: "M 30,120 Q 100,30 170,120",
    description: "A curved arc path, often seen in signs that trace over body regions.",
  },
  {
    type: "CIRCLE",
    label: "C\u00edrculo",
    spanish: "Movimiento circular",
    path: "M 100,40 A 50,50 0 1,1 100,39.9",
    description: "A circular or elliptical path, common in signs meaning repetition or continuity.",
  },
  {
    type: "ZIGZAG",
    label: "Zigzag",
    spanish: "Movimiento en zigzag",
    path: "M 30,100 L 60,50 L 100,120 L 140,50 L 170,100",
    description: "An angular alternating path, used in signs depicting irregular or chaotic motion.",
  },
  {
    type: "SEVEN",
    label: "Siete",
    spanish: "Movimiento en forma de 7",
    path: "M 40,50 L 160,50 L 100,140",
    description: "A path shaped like the number 7 \u2014 horizontal then diagonal descent.",
  },
];

const LOCAL_MOVEMENTS: { type: LocalType; label: string; icon: string; description: string }[] = [
  { type: "WIGGLE", label: "Meneo", icon: "\u223c", description: "Rapid finger alternation" },
  { type: "CIRCULAR", label: "Circular", icon: "\u27f3", description: "Wrist circular motion" },
  { type: "TWIST", label: "Giro", icon: "\u21bb", description: "Forearm pronation/supination" },
  { type: "SCRATCH", label: "Raspar", icon: "\u2261", description: "Fingertips scratching" },
  { type: "NOD", label: "Flexionar", icon: "\u2935", description: "Wrist flexion/extension" },
  { type: "OSCILLATE", label: "Oscilar", icon: "\u21c4", description: "Side-to-side oscillation" },
  { type: "RELEASE", label: "Soltar", icon: "\u2197", description: "Fingers open from closed" },
  { type: "FLATTEN", label: "Aplanar", icon: "\u25ad", description: "Fingers flatten together" },
  { type: "PROGRESSIVE", label: "Progresivo", icon: "\u2026", description: "Sequential finger closing" },
  { type: "VIBRATE", label: "Vibrar", icon: "\u2248", description: "High-frequency tremor" },
  { type: "RUB", label: "Frotar", icon: "\u21c6", description: "Rubbing contact motion" },
];

const PLANES: { type: PlaneType; label: string; color: string; description: string }[] = [
  { type: "HORIZONTAL", label: "Horizontal", color: "#3b82f6", description: "Movement parallel to the ground (table plane)" },
  { type: "VERTICAL", label: "Vertical", color: "#8b5cf6", description: "Movement parallel to the signer\u2019s front (wall plane)" },
  { type: "SAGITTAL", label: "Sagittal", color: "#10b981", description: "Movement perpendicular to the signer (depth plane)" },
  { type: "OBLIQUE", label: "Oblique", color: "#f59e0b", description: "Movement in a diagonal plane combining two axes" },
];

export default function MVExplorer() {
  const [activeContour, setActiveContour] = useState<ContourType>("STRAIGHT");
  const [activePlane, setActivePlane] = useState<PlaneType>("VERTICAL");
  const [activeLocal, setActiveLocal] = useState<LocalType | null>(null);

  const contour = CONTOUR_MOVEMENTS.find((c) => c.type === activeContour)!;
  const plane = PLANES.find((p) => p.type === activePlane)!;

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="rounded-xl bg-sky-50 p-3">
        <p className="text-xs leading-relaxed text-sky-700">
          Movement (MV) describes <b>how the hand travels</b> through signing space.
          It has three sub-parameters: <b>contour</b> (path shape), <b>local movement</b> (internal motion),
          and <b>plane</b> (spatial dimension).
        </p>
      </div>

      {/* Contour Movements */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">1</span>
          Contour Movements
          <span className="text-xs font-normal text-gray-400">(5 types)</span>
        </h4>

        <div className="grid gap-3 md:grid-cols-[1fr,200px]">
          {/* Animation */}
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-2">
            <svg viewBox="0 0 200 150" className="w-full" style={{ maxHeight: 200 }}>
              {/* Path */}
              <path
                d={contour.path}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="8,4"
              >
                <animate attributeName="stroke-dashoffset" values="0;-24" dur="1s" repeatCount="indefinite" />
              </path>

              {/* Moving dot */}
              <circle r="6" fill="#3b82f6">
                <animateMotion dur="2s" repeatCount="indefinite" path={contour.path} />
              </circle>

              {/* Label */}
              <text x="100" y="145" textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="600">
                {contour.label}
              </text>
            </svg>
          </div>

          {/* Selector */}
          <div className="flex flex-col gap-1.5">
            {CONTOUR_MOVEMENTS.map((c) => (
              <button
                key={c.type}
                onClick={() => setActiveContour(c.type)}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-all ${
                  activeContour === c.type
                    ? "bg-sky-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {c.label}
                <span className="ml-1 opacity-60">({c.type.toLowerCase()})</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">{contour.description}</p>
      </div>

      {/* Local Movements */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">2</span>
          Local Movements
          <span className="text-xs font-normal text-gray-400">(11 types)</span>
        </h4>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {LOCAL_MOVEMENTS.map((lm) => (
            <button
              key={lm.type}
              onClick={() => setActiveLocal(activeLocal === lm.type ? null : lm.type)}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center transition-all ${
                activeLocal === lm.type
                  ? "bg-sky-600 text-white shadow-md"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span className="text-xl">{lm.icon}</span>
              <span className="text-[10px] font-medium">{lm.label}</span>
            </button>
          ))}
        </div>
        {activeLocal && (
          <p className="mt-2 text-xs text-gray-500">
            <b>{LOCAL_MOVEMENTS.find((l) => l.type === activeLocal)?.label}:</b>{" "}
            {LOCAL_MOVEMENTS.find((l) => l.type === activeLocal)?.description}
          </p>
        )}
      </div>

      {/* Planes */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">3</span>
          Movement Planes
          <span className="text-xs font-normal text-gray-400">(4 types)</span>
        </h4>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {PLANES.map((p) => (
            <button
              key={p.type}
              onClick={() => setActivePlane(p.type)}
              className={`rounded-xl border-2 px-3 py-3 text-center text-xs font-medium transition-all ${
                activePlane === p.type ? "text-white shadow-md" : "bg-white text-gray-600"
              }`}
              style={
                activePlane === p.type
                  ? { backgroundColor: p.color, borderColor: p.color }
                  : { borderColor: `${p.color}30` }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">{plane.description}</p>
      </div>

      {/* Notation output */}
      <div className="rounded-xl bg-gray-900 p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
          LSM-PN Notation
        </p>
        <p className="font-mono text-sm text-emerald-400">
          MV: contour={activeContour.toLowerCase()}, plane={activePlane.toLowerCase()}
          {activeLocal ? `, local=${activeLocal.toLowerCase()}` : ""}
        </p>
      </div>
    </div>
  );
}
