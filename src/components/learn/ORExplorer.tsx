"use client";

import { useState } from "react";

type PalmFacing = "UP" | "DOWN" | "FORWARD" | "BACK" | "LEFT" | "RIGHT";
type FingerPointing = "UP" | "DOWN" | "FORWARD" | "BACK" | "LEFT" | "RIGHT";

interface OrientationState {
  palm: PalmFacing;
  fingers: FingerPointing;
}

const PALM_DIRECTIONS: { value: PalmFacing; label: string; rotation: string; icon: string }[] = [
  { value: "UP", label: "Arriba", rotation: "rotate-0", icon: "\u2191" },
  { value: "DOWN", label: "Abajo", rotation: "rotate-180", icon: "\u2193" },
  { value: "FORWARD", label: "Frente", rotation: "rotate-0", icon: "\u2192" },
  { value: "BACK", label: "Atr\u00e1s", rotation: "rotate-180", icon: "\u2190" },
  { value: "LEFT", label: "Izquierda", rotation: "-rotate-90", icon: "\u2190" },
  { value: "RIGHT", label: "Derecha", rotation: "rotate-90", icon: "\u2192" },
];

const FINGER_DIRECTIONS: { value: FingerPointing; label: string; icon: string }[] = [
  { value: "UP", label: "Arriba", icon: "\u2191" },
  { value: "DOWN", label: "Abajo", icon: "\u2193" },
  { value: "FORWARD", label: "Frente", icon: "\u2197" },
  { value: "BACK", label: "Atr\u00e1s", icon: "\u2199" },
  { value: "LEFT", label: "Izquierda", icon: "\u2190" },
  { value: "RIGHT", label: "Derecha", icon: "\u2192" },
];

/** Simple 3D-ish hand orientation visualization */
function OrientationDiagram({ palm, fingers }: OrientationState) {
  // Map palm direction to visual transform
  const palmTransforms: Record<PalmFacing, { rx: number; ry: number }> = {
    UP: { rx: -60, ry: 0 },
    DOWN: { rx: 60, ry: 0 },
    FORWARD: { rx: 0, ry: 0 },
    BACK: { rx: 0, ry: 180 },
    LEFT: { rx: 0, ry: -45 },
    RIGHT: { rx: 0, ry: 45 },
  };

  const fingerRotations: Record<FingerPointing, number> = {
    UP: 0,
    DOWN: 180,
    FORWARD: -30,
    BACK: 150,
    LEFT: -90,
    RIGHT: 90,
  };

  const t = palmTransforms[palm];
  const fingerAngle = fingerRotations[fingers];

  return (
    <div className="flex items-center justify-center py-4">
      <div className="relative h-48 w-48">
        {/* Reference axes */}
        <svg viewBox="0 0 200 200" className="absolute inset-0">
          {/* Grid */}
          <line x1="100" y1="20" x2="100" y2="180" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
          <line x1="20" y1="100" x2="180" y2="100" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />

          {/* Labels */}
          <text x="100" y="14" textAnchor="middle" fontSize="9" fill="#9ca3af">arriba</text>
          <text x="100" y="194" textAnchor="middle" fontSize="9" fill="#9ca3af">abajo</text>
          <text x="12" y="103" textAnchor="start" fontSize="9" fill="#9ca3af">izq</text>
          <text x="188" y="103" textAnchor="end" fontSize="9" fill="#9ca3af">der</text>

          {/* Hand representation */}
          <g transform={`translate(100,100) rotate(${fingerAngle})`}>
            {/* Palm */}
            <ellipse
              cx="0"
              cy="10"
              rx="28"
              ry="32"
              fill={palm === "FORWARD" ? "#c7d2fe" : "#fde8d0"}
              stroke={palm === "FORWARD" ? "#818cf8" : "#d4a574"}
              strokeWidth="2"
              style={{
                transform: `perspective(200px) rotateX(${t.rx}deg) rotateY(${t.ry}deg)`,
                transformOrigin: "center",
              }}
            />

            {/* Fingers */}
            {[-16, -8, 0, 8, 14].map((offset, i) => (
              <rect
                key={i}
                x={offset - 4}
                y={-42 - (i === 2 ? 6 : i === 1 || i === 3 ? 4 : 0)}
                width={8}
                height={i === 0 ? 18 : 22}
                rx={4}
                fill={palm === "FORWARD" ? "#a5b4fc" : "#fde8d0"}
                stroke={palm === "FORWARD" ? "#818cf8" : "#d4a574"}
                strokeWidth="1.5"
              />
            ))}

            {/* Direction arrow */}
            <line x1="0" y1="-55" x2="0" y2="-70" stroke="#4f46e5" strokeWidth="2.5" markerEnd="url(#arrow)" />
          </g>

          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 Z" fill="#4f46e5" />
            </marker>
          </defs>
        </svg>
      </div>
    </div>
  );
}

export default function ORExplorer() {
  const [orientation, setOrientation] = useState<OrientationState>({
    palm: "FORWARD",
    fingers: "UP",
  });

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="rounded-xl bg-violet-50 p-3">
        <p className="text-xs leading-relaxed text-violet-700">
          Orientation describes <b>where the palm faces</b> and <b>where the fingers point</b>.
          These two parameters define the hand&apos;s spatial orientation in 3D space relative to the signer&apos;s body.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Visual */}
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white">
          <OrientationDiagram {...orientation} />
          <div className="border-t border-gray-100 px-4 py-2 text-center">
            <span className="text-xs text-gray-400">
              Palm: <b className="text-violet-600">{orientation.palm.toLowerCase()}</b>
              {" | "}
              Fingers: <b className="text-violet-600">{orientation.fingers.toLowerCase()}</b>
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Palm facing */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Palm Facing
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PALM_DIRECTIONS.map((dir) => (
                <button
                  key={dir.value}
                  onClick={() => setOrientation((o) => ({ ...o, palm: dir.value }))}
                  className={`rounded-lg px-2 py-2 text-center text-xs font-medium transition-all ${
                    orientation.palm === dir.value
                      ? "bg-violet-600 text-white shadow-md"
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
              Fingers Pointing
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {FINGER_DIRECTIONS.map((dir) => (
                <button
                  key={dir.value}
                  onClick={() => setOrientation((o) => ({ ...o, fingers: dir.value }))}
                  className={`rounded-lg px-2 py-2 text-center text-xs font-medium transition-all ${
                    orientation.fingers === dir.value
                      ? "bg-violet-600 text-white shadow-md"
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
              LSM-PN Notation
            </p>
            <p className="font-mono text-sm text-emerald-400">
              OR: palm={orientation.palm.toLowerCase()}, fingers={orientation.fingers.toLowerCase()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
