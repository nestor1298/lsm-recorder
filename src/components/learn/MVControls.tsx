"use client";

import { useState, useEffect } from "react";

type ContourType = "STRAIGHT" | "ARC" | "CIRCLE" | "ZIGZAG" | "SEVEN";
type LocalType = "WIGGLE" | "CIRCULAR" | "TWIST" | "SCRATCH" | "NOD" | "OSCILLATE" | "RELEASE" | "FLATTEN" | "PROGRESSIVE" | "VIBRATE" | "RUB";
type PlaneType = "HORIZONTAL" | "VERTICAL" | "SAGITTAL" | "OBLIQUE";

const CONTOUR_MOVEMENTS: { type: ContourType; label: string; path: string; description: string }[] = [
  { type: "STRAIGHT", label: "Recto", path: "M 30,100 L 170,100", description: "Trayectoria directa del punto A al B." },
  { type: "ARC", label: "Arco", path: "M 30,120 Q 100,30 170,120", description: "Trayectoria curva en arco." },
  { type: "CIRCLE", label: "Círculo", path: "M 100,40 A 50,50 0 1,1 100,39.9", description: "Trayectoria circular." },
  { type: "ZIGZAG", label: "Zigzag", path: "M 30,100 L 60,50 L 100,120 L 140,50 L 170,100", description: "Trayectoria angular alternante." },
  { type: "SEVEN", label: "Siete", path: "M 40,50 L 160,50 L 100,140", description: "Forma de 7." },
];

const LOCAL_MOVEMENTS: { type: LocalType; label: string; icon: string; description: string }[] = [
  { type: "WIGGLE", label: "Meneo", icon: "∼", description: "Alternancia rápida de dedos" },
  { type: "CIRCULAR", label: "Circular", icon: "⟳", description: "Movimiento circular de muñeca" },
  { type: "TWIST", label: "Giro", icon: "↻", description: "Pronación/supinación del antebrazo" },
  { type: "SCRATCH", label: "Raspar", icon: "≡", description: "Rascado con las yemas" },
  { type: "NOD", label: "Flexionar", icon: "⤵", description: "Flexión/extensión de muñeca" },
  { type: "OSCILLATE", label: "Oscilar", icon: "⇄", description: "Oscilación de lado a lado" },
  { type: "RELEASE", label: "Soltar", icon: "↗", description: "Dedos se abren desde cerrado" },
  { type: "FLATTEN", label: "Aplanar", icon: "▭", description: "Dedos se aplanan juntos" },
  { type: "PROGRESSIVE", label: "Progresivo", icon: "…", description: "Cierre secuencial de dedos" },
  { type: "VIBRATE", label: "Vibrar", icon: "≈", description: "Temblor de alta frecuencia" },
  { type: "RUB", label: "Frotar", icon: "⇆", description: "Movimiento de frotamiento" },
];

const PLANES: { type: PlaneType; label: string; color: string; description: string }[] = [
  { type: "HORIZONTAL", label: "Horizontal", color: "#3b82f6", description: "Paralelo al suelo" },
  { type: "VERTICAL", label: "Vertical", color: "#8b5cf6", description: "Paralelo al frente" },
  { type: "SAGITTAL", label: "Sagital", color: "#10b981", description: "Perpendicular al señante" },
  { type: "OBLIQUE", label: "Oblicuo", color: "#f59e0b", description: "Plano diagonal" },
];

interface MVControlsProps {
  onMovementChange?: (mv: { contour: string; local: string | null; plane: string }) => void;
  /** Pre-select values (used by sign builder) */
  defaultContour?: string;
  defaultLocal?: string | null;
  defaultPlane?: string;
  className?: string;
}

export default function MVControls({ onMovementChange, defaultContour, defaultLocal, defaultPlane, className = "" }: MVControlsProps) {
  const [activeContour, setActiveContour] = useState<ContourType>((defaultContour as ContourType) ?? "STRAIGHT");
  const [activePlane, setActivePlane] = useState<PlaneType>((defaultPlane as PlaneType) ?? "VERTICAL");
  const [activeLocal, setActiveLocal] = useState<LocalType | null>((defaultLocal as LocalType) ?? null);

  // Propagate movement state to parent
  useEffect(() => {
    onMovementChange?.({ contour: activeContour, local: activeLocal, plane: activePlane });
  }, [activeContour, activeLocal, activePlane, onMovementChange]);

  const contour = CONTOUR_MOVEMENTS.find((c) => c.type === activeContour)!;
  const plane = PLANES.find((p) => p.type === activePlane)!;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Contour */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-800">
          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">1</span>
          Contorno
        </h4>
        {/* Animated SVG */}
        <div className="mb-2 rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-1">
          <svg viewBox="0 0 200 150" className="w-full" style={{ maxHeight: 140 }}>
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
            <circle r="5" fill="#3b82f6">
              <animateMotion dur="2s" repeatCount="indefinite" path={contour.path} />
            </circle>
            <text x="100" y="145" textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="600">
              {contour.label}
            </text>
          </svg>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CONTOUR_MOVEMENTS.map((c) => (
            <button
              key={c.type}
              onClick={() => setActiveContour(c.type)}
              className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-all ${
                activeContour === c.type
                  ? "bg-sky-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-gray-500">{contour.description}</p>
      </div>

      {/* Local Movements */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-800">
          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">2</span>
          Movimientos Locales
        </h4>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {LOCAL_MOVEMENTS.map((lm) => (
            <button
              key={lm.type}
              onClick={() => setActiveLocal(activeLocal === lm.type ? null : lm.type)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition-all ${
                activeLocal === lm.type
                  ? "bg-sky-600 text-white shadow-md"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span className="text-base">{lm.icon}</span>
              <span className="text-[9px] font-medium leading-tight">{lm.label}</span>
            </button>
          ))}
        </div>
        {activeLocal && (
          <p className="mt-1 text-[10px] text-gray-500">
            <b>{LOCAL_MOVEMENTS.find((l) => l.type === activeLocal)?.label}:</b>{" "}
            {LOCAL_MOVEMENTS.find((l) => l.type === activeLocal)?.description}
          </p>
        )}
      </div>

      {/* Planes */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-800">
          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">3</span>
          Planos
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {PLANES.map((p) => (
            <button
              key={p.type}
              onClick={() => setActivePlane(p.type)}
              className={`rounded-lg border-2 px-2 py-2 text-center text-[10px] font-medium transition-all ${
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
        <p className="mt-1 text-[10px] text-gray-500">{plane.description}</p>
      </div>

      {/* Notation output */}
      <div className="rounded-xl bg-gray-900 p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
          Notación LSM-PN
        </p>
        <p className="font-mono text-sm text-emerald-400">
          MV: contorno={activeContour.toLowerCase()}, plano={activePlane.toLowerCase()}
          {activeLocal ? `, local=${activeLocal.toLowerCase()}` : ""}
        </p>
      </div>
    </div>
  );
}
