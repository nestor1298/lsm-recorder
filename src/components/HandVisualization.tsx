"use client";

import type { CMEntry, FlexionLevel } from "@/lib/types";

interface HandVisualizationProps {
  cm: CMEntry | null;
  size?: number;
}

// Map flexion to finger curl angles (degrees from straight)
const FLEXION_ANGLE: Record<FlexionLevel, number> = {
  EXTENDED: 0,
  CURVED: 25,
  BENT: 55,
  CLOSED: 80,
};

const FLEXION_COLOR: Record<FlexionLevel, string> = {
  EXTENDED: "#22c55e",
  CURVED: "#eab308",
  BENT: "#f97316",
  CLOSED: "#ef4444",
};

// Finger base positions (palm-relative, from index to pinky)
const FINGER_BASES = [
  { x: 130, y: 160, label: "Index", key: "index" as const },
  { x: 155, y: 145, label: "Middle", key: "middle" as const },
  { x: 175, y: 155, label: "Ring", key: "ring" as const },
  { x: 192, y: 170, label: "Pinky", key: "pinky" as const },
];

const FINGER_ANGLES = [-25, -12, 3, 18]; // degrees from vertical
const SEGMENT_LENGTH = 28;

function getFingerPoints(
  baseX: number,
  baseY: number,
  angle: number,
  flexion: FlexionLevel
) {
  const curlDeg = FLEXION_ANGLE[flexion];
  const curlRad = (curlDeg * Math.PI) / 180;
  const baseRad = ((angle - 90) * Math.PI) / 180;

  const points: { x: number; y: number }[] = [{ x: baseX, y: baseY }];

  // MCP joint
  let currentAngle = baseRad;
  let x = baseX + Math.cos(currentAngle) * SEGMENT_LENGTH;
  let y = baseY + Math.sin(currentAngle) * SEGMENT_LENGTH;
  points.push({ x, y });

  // PIP joint
  currentAngle += curlRad * 0.5;
  x += Math.cos(currentAngle) * (SEGMENT_LENGTH * 0.9);
  y += Math.sin(currentAngle) * (SEGMENT_LENGTH * 0.9);
  points.push({ x, y });

  // DIP/tip
  currentAngle += curlRad * 0.5;
  x += Math.cos(currentAngle) * (SEGMENT_LENGTH * 0.7);
  y += Math.sin(currentAngle) * (SEGMENT_LENGTH * 0.7);
  points.push({ x, y });

  return points;
}

function getThumbPoints(
  cm: CMEntry
): { x: number; y: number }[] {
  const baseX = 108;
  const baseY = 200;
  const isOpposed = cm.thumb_opposition === "OPPOSED";
  const curlDeg = FLEXION_ANGLE[cm.thumb_flexion];

  // Thumb angles differ based on opposition
  const baseAngleDeg = isOpposed ? -140 : -110;
  const baseRad = (baseAngleDeg * Math.PI) / 180;
  const curlRad = (curlDeg * Math.PI) / 180;

  const points: { x: number; y: number }[] = [{ x: baseX, y: baseY }];

  let currentAngle = baseRad;
  let x = baseX + Math.cos(currentAngle) * 25;
  let y = baseY + Math.sin(currentAngle) * 25;
  points.push({ x, y });

  currentAngle += curlRad * 0.6;
  x += Math.cos(currentAngle) * 20;
  y += Math.sin(currentAngle) * 20;
  points.push({ x, y });

  return points;
}

export default function HandVisualization({ cm, size = 280 }: HandVisualizationProps) {
  if (!cm) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50"
        style={{ width: size, height: size }}
      >
        <span className="text-sm text-gray-400">Select a CM</span>
      </div>
    );
  }

  const scale = size / 280;
  const fingerStates: FlexionLevel[] = [cm.index, cm.middle, cm.ring, cm.pinky];
  const thumbPoints = getThumbPoints(cm);

  return (
    <div className="relative">
      <svg
        width={size}
        height={size}
        viewBox="0 0 280 280"
        className="rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white"
      >
        {/* Palm */}
        <ellipse
          cx="158"
          cy="210"
          rx="52"
          ry="58"
          fill="#fde8d0"
          stroke="#d4a574"
          strokeWidth="1.5"
        />

        {/* Wrist */}
        <rect
          x="125"
          y="250"
          width="66"
          height="30"
          rx="8"
          fill="#fde8d0"
          stroke="#d4a574"
          strokeWidth="1.5"
        />

        {/* Fingers */}
        {FINGER_BASES.map((finger, i) => {
          const flexion = fingerStates[i];
          const isSelected = cm.selected_fingers.includes(i + 1);
          const points = getFingerPoints(
            finger.x,
            finger.y,
            FINGER_ANGLES[i],
            flexion
          );
          const color = FLEXION_COLOR[flexion];

          return (
            <g key={finger.key}>
              {/* Finger segments */}
              {points.slice(0, -1).map((pt, j) => (
                <line
                  key={j}
                  x1={pt.x}
                  y1={pt.y}
                  x2={points[j + 1].x}
                  y2={points[j + 1].y}
                  stroke={isSelected ? color : "#ccc"}
                  strokeWidth={isSelected ? 10 : 7}
                  strokeLinecap="round"
                  opacity={isSelected ? 1 : 0.5}
                />
              ))}
              {/* Joints */}
              {points.map((pt, j) => (
                <circle
                  key={`j${j}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={j === 0 ? 5 : 4}
                  fill={isSelected ? color : "#ddd"}
                  stroke="white"
                  strokeWidth="1"
                />
              ))}
              {/* Selection indicator */}
              {isSelected && (
                <circle
                  cx={points[points.length - 1].x}
                  cy={points[points.length - 1].y}
                  r="6"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  opacity="0.6"
                />
              )}
            </g>
          );
        })}

        {/* Thumb */}
        <g>
          {thumbPoints.slice(0, -1).map((pt, j) => (
            <line
              key={j}
              x1={pt.x}
              y1={pt.y}
              x2={thumbPoints[j + 1].x}
              y2={thumbPoints[j + 1].y}
              stroke={FLEXION_COLOR[cm.thumb_flexion]}
              strokeWidth={10}
              strokeLinecap="round"
            />
          ))}
          {thumbPoints.map((pt, j) => (
            <circle
              key={`t${j}`}
              cx={pt.x}
              cy={pt.y}
              r={j === 0 ? 5 : 4}
              fill={FLEXION_COLOR[cm.thumb_flexion]}
              stroke="white"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* Spread indicator */}
        {cm.spread === "SPREAD" && (
          <text x="140" y="20" textAnchor="middle" className="text-xs" fill="#7c3aed" fontWeight="bold">
            SPREAD
          </text>
        )}

        {/* Interaction indicator */}
        {cm.interaction === "CROSSED" && (
          <text x="140" y="35" textAnchor="middle" className="text-xs" fill="#d97706" fontWeight="bold">
            CROSSED
          </text>
        )}
        {cm.interaction === "STACKED" && (
          <text x="140" y="35" textAnchor="middle" className="text-xs" fill="#d97706" fontWeight="bold">
            STACKED
          </text>
        )}

        {/* CM label */}
        <text x="240" y="270" textAnchor="end" fontSize="11" fill="#6b7280">
          CM #{cm.cm_id}
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {(["EXTENDED", "CURVED", "BENT", "CLOSED"] as FlexionLevel[]).map((level) => (
          <div key={level} className="flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: FLEXION_COLOR[level] }}
            />
            <span className="text-[10px] text-gray-500">{level.toLowerCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
