"use client";

import type { FaceState } from "./RNMControls";

/**
 * Cara SVG animada para los rasgos no manuales (RNM).
 * El avatar 3D (lexsi.glb) no tiene blendshapes faciales, así que este
 * diagrama es la vista canónica de cejas y boca; la cabeza sí se anima
 * por huesos en el avatar.
 */
export default function FaceDiagram({ eyebrows, mouth, head }: FaceState) {
  // Eyebrow positions
  const browY = eyebrows === "RAISED" ? 52 : eyebrows === "FURROWED" ? 60 : 56;
  const browCurve =
    eyebrows === "FURROWED" ? 4 : eyebrows === "RAISED" ? -4 : 0;

  // Mouth shapes
  const mouthPaths: Record<FaceState["mouth"], string> = {
    NEUTRAL: "M 80,135 Q 100,138 120,135",
    OPEN: "M 80,132 Q 100,148 120,132",
    CLOSED: "M 82,135 L 118,135",
    ROUNDED: "M 90,130 Q 88,140 100,142 Q 112,140 110,130 Q 100,128 90,130",
    STRETCHED: "M 72,133 Q 100,140 128,133",
  };

  // Head tilt
  const headRotation: Record<FaceState["head"], number> = {
    NONE: 0,
    NOD: 5,
    SHAKE: 0,
    TILT_LEFT: -12,
    TILT_RIGHT: 12,
    TILT_BACK: -8,
    TILT_DOWN: 8,
  };

  const headLabels: Record<FaceState["head"], string> = {
    NONE: "",
    NOD: "\u2195 Asentir",
    SHAKE: "\u2194 Negar",
    TILT_LEFT: "Inclinar izq.",
    TILT_RIGHT: "Inclinar der.",
    TILT_BACK: "Inclinar atrás",
    TILT_DOWN: "Inclinar abajo",
  };

  return (
    <svg viewBox="0 0 200 200" className="w-full" style={{ maxHeight: 280 }}>
      <g transform={`rotate(${headRotation[head]}, 100, 100)`}>
        {/* Head shape */}
        <ellipse
          cx="100"
          cy="100"
          rx="55"
          ry="68"
          fill="#fef3c7"
          stroke="#d4a574"
          strokeWidth="2"
        />

        {/* Hair */}
        <path
          d="M 48,70 Q 50,30 100,28 Q 150,30 152,70"
          fill="none"
          stroke="#92400e"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Eyebrows */}
        <path
          d={`M 70,${browY} Q 80,${browY - 6 + browCurve} 90,${browY}`}
          fill="none"
          stroke="#78350f"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          {eyebrows !== "NEUTRAL" && (
            <animate
              attributeName="d"
              values={
                eyebrows === "RAISED"
                  ? `M 70,${browY + 2} Q 80,${browY - 4} 90,${browY + 2};M 70,${browY} Q 80,${browY - 6 + browCurve} 90,${browY};M 70,${browY + 2} Q 80,${browY - 4} 90,${browY + 2}`
                  : `M 70,${browY - 2} Q 80,${browY - 2 + browCurve} 90,${browY - 2};M 70,${browY} Q 80,${browY - 6 + browCurve} 90,${browY};M 70,${browY - 2} Q 80,${browY - 2 + browCurve} 90,${browY - 2}`
              }
              dur="1.5s"
              repeatCount="indefinite"
            />
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
            <animate
              attributeName="d"
              values={
                eyebrows === "RAISED"
                  ? `M 110,${browY + 2} Q 120,${browY - 4} 130,${browY + 2};M 110,${browY} Q 120,${browY - 6 + browCurve} 130,${browY};M 110,${browY + 2} Q 120,${browY - 4} 130,${browY + 2}`
                  : `M 110,${browY - 2} Q 120,${browY - 2 + browCurve} 130,${browY - 2};M 110,${browY} Q 120,${browY - 6 + browCurve} 130,${browY};M 110,${browY - 2} Q 120,${browY - 2 + browCurve} 130,${browY - 2}`
              }
              dur="1.5s"
              repeatCount="indefinite"
            />
          )}
        </path>

        {/* Eyes */}
        <ellipse
          cx="80"
          cy="72"
          rx="8"
          ry="6"
          fill="white"
          stroke="#78350f"
          strokeWidth="1.5"
        />
        <ellipse
          cx="120"
          cy="72"
          rx="8"
          ry="6"
          fill="white"
          stroke="#78350f"
          strokeWidth="1.5"
        />
        <circle cx="80" cy="72" r="3" fill="#1e293b" />
        <circle cx="120" cy="72" r="3" fill="#1e293b" />

        {/* Nose */}
        <path
          d="M 100,82 L 96,98 Q 100,101 104,98 Z"
          fill="none"
          stroke="#d4a574"
          strokeWidth="1.5"
        />

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
        <ellipse
          cx="45"
          cy="85"
          rx="6"
          ry="12"
          fill="#fef3c7"
          stroke="#d4a574"
          strokeWidth="1.5"
        />
        <ellipse
          cx="155"
          cy="85"
          rx="6"
          ry="12"
          fill="#fef3c7"
          stroke="#d4a574"
          strokeWidth="1.5"
        />
      </g>

      {/* Head movement indicator */}
      {head !== "NONE" && (
        <g>
          <text
            x="100"
            y="190"
            textAnchor="middle"
            fontSize="10"
            fill="#2B5BF7"
            fontWeight="600"
          >
            {headLabels[head]}
          </text>
        </g>
      )}
    </svg>
  );
}
