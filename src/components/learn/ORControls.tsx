"use client";

import { useState, useEffect } from "react";

type PalmFacing = "UP" | "DOWN" | "FORWARD" | "BACK" | "LEFT" | "RIGHT";
type FingerPointing = "UP" | "DOWN" | "FORWARD" | "BACK" | "LEFT" | "RIGHT";

const PALM_DIRECTIONS: { value: PalmFacing; label: string; icon: string }[] = [
  { value: "UP", label: "Arriba", icon: "↑" },
  { value: "DOWN", label: "Abajo", icon: "↓" },
  { value: "FORWARD", label: "Frente", icon: "→" },
  { value: "BACK", label: "Atrás", icon: "←" },
  { value: "LEFT", label: "Izquierda", icon: "←" },
  { value: "RIGHT", label: "Derecha", icon: "→" },
];

const FINGER_DIRECTIONS: { value: FingerPointing; label: string; icon: string }[] = [
  { value: "UP", label: "Arriba", icon: "↑" },
  { value: "DOWN", label: "Abajo", icon: "↓" },
  { value: "FORWARD", label: "Frente", icon: "↗" },
  { value: "BACK", label: "Atrás", icon: "↙" },
  { value: "LEFT", label: "Izquierda", icon: "←" },
  { value: "RIGHT", label: "Derecha", icon: "→" },
];

interface ORControlsProps {
  onOrientationChange: (orientation: { palm: string; fingers: string }) => void;
  className?: string;
}

export default function ORControls({ onOrientationChange, className = "" }: ORControlsProps) {
  const [palm, setPalm] = useState<PalmFacing>("FORWARD");
  const [fingers, setFingers] = useState<FingerPointing>("UP");

  useEffect(() => {
    onOrientationChange({ palm, fingers });
  }, [palm, fingers, onOrientationChange]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Palm facing */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
          Dirección de la Palma
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {PALM_DIRECTIONS.map((dir) => (
            <button
              key={dir.value}
              onClick={() => setPalm(dir.value)}
              className={`rounded-lg px-2 py-2 text-center text-xs font-medium transition-all ${
                palm === dir.value
                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/25"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="text-lg">{dir.icon}</span>
              <br />
              {dir.label}
            </button>
          ))}
        </div>
      </div>

      {/* Finger pointing */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
          Dirección de los Dedos
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {FINGER_DIRECTIONS.map((dir) => (
            <button
              key={dir.value}
              onClick={() => setFingers(dir.value)}
              className={`rounded-lg px-2 py-2 text-center text-xs font-medium transition-all ${
                fingers === dir.value
                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/25"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="text-lg">{dir.icon}</span>
              <br />
              {dir.label}
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
          OR: palma={palm.toLowerCase()}, dedos={fingers.toLowerCase()}
        </p>
      </div>
    </div>
  );
}
