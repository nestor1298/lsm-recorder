/**
 * MiniHand — SVG hand thumbnail for CM handshape display.
 *
 * Each finger is drawn as a filled tapered silhouette (one continuous path)
 * with thin dividing lines at the joint boundaries. The entire finger fill
 * uses the flexion-state color:
 *   EXTENDED = green, CURVED = yellow, BENT = orange, CLOSED = red.
 * Non-selected fingers are gray at reduced opacity.
 */

import type { CMEntry, FlexionLevel } from "@/lib/types";

// ── Color constants ─────────────────────────────────────────────────

export const FLEXION_COLOR: Record<FlexionLevel, string> = {
  EXTENDED: "#22c55e",
  CURVED: "#eab308",
  BENT: "#f97316",
  CLOSED: "#ef4444",
};

/** Darker variant for joint lines and outlines */
function darken(hex: string, amount = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - amount;
  return `#${Math.round(r * f).toString(16).padStart(2, "0")}${Math.round(g * f).toString(16).padStart(2, "0")}${Math.round(b * f).toString(16).padStart(2, "0")}`;
}

// ── Curl angles ─────────────────────────────────────────────────────

const CURL_DEG: Record<FlexionLevel, number> = {
  EXTENDED: 0,
  CURVED: 25,
  BENT: 55,
  CLOSED: 80,
};

const RAD = Math.PI / 180;

// ── Finger silhouette geometry ──────────────────────────────────────

interface JointPoint {
  x: number;
  y: number;
  angle: number; // direction in degrees
  halfW: number; // half-width at this joint
}

/**
 * Compute the center-line points (base, MCP/PIP junction, PIP/DIP junction, tip)
 * and half-widths at each point along the finger.
 */
function fingerCenterline(
  baseX: number,
  baseY: number,
  spreadAngle: number,
  flexion: FlexionLevel,
): JointPoint[] {
  const curl = CURL_DEG[flexion] * RAD;
  const LENS = [9, 7.5, 5.5];
  const HALF_WIDTHS = [2.4, 2.1, 1.7, 1.2]; // base, MCP/PIP, PIP/DIP, tip

  const points: JointPoint[] = [];
  let x = baseX;
  let y = baseY;
  let a = spreadAngle - 90; // degrees, pointing upward

  // Base point
  points.push({ x, y, angle: a, halfW: HALF_WIDTHS[0] });

  for (let i = 0; i < 3; i++) {
    if (i > 0) a += curl * (180 / Math.PI) * (i === 1 ? 0.45 : 0.55);

    const len = LENS[i];
    x += Math.cos(a * RAD) * len;
    y += Math.sin(a * RAD) * len;

    points.push({ x, y, angle: a, halfW: HALF_WIDTHS[i + 1] });
  }

  return points;
}

/**
 * Build a filled SVG path for the finger silhouette.
 * Traces left side (base→tip) then right side (tip→base) to form a closed shape.
 */
function fingerSilhouettePath(pts: JointPoint[]): string {
  // For each point, compute left and right edge positions
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];

  for (const pt of pts) {
    // Perpendicular to direction (90° counterclockwise)
    const perpAngle = (pt.angle - 90) * RAD;
    const lx = pt.x + Math.cos(perpAngle) * pt.halfW;
    const ly = pt.y + Math.sin(perpAngle) * pt.halfW;
    const rx = pt.x - Math.cos(perpAngle) * pt.halfW;
    const ry = pt.y - Math.sin(perpAngle) * pt.halfW;
    left.push({ x: lx, y: ly });
    right.push({ x: rx, y: ry });
  }

  // Build path: left side forward, rounded tip, right side backward
  const tip = pts[pts.length - 1];
  const tipPerp = (tip.angle - 90) * RAD;
  const tipFwd = tip.angle * RAD;
  const tipLen = tip.halfW * 0.8;

  // Tip arc control point (extends slightly past the tip)
  const tipCtrlX = tip.x + Math.cos(tipFwd) * tipLen;
  const tipCtrlY = tip.y + Math.sin(tipFwd) * tipLen;

  let d = `M ${left[0].x.toFixed(1)},${left[0].y.toFixed(1)}`;
  // Left edge (base to near-tip)
  for (let i = 1; i < left.length; i++) {
    d += ` L ${left[i].x.toFixed(1)},${left[i].y.toFixed(1)}`;
  }
  // Rounded tip
  d += ` Q ${tipCtrlX.toFixed(1)},${tipCtrlY.toFixed(1)} ${right[right.length - 1].x.toFixed(1)},${right[right.length - 1].y.toFixed(1)}`;
  // Right edge (tip to base)
  for (let i = right.length - 2; i >= 0; i--) {
    d += ` L ${right[i].x.toFixed(1)},${right[i].y.toFixed(1)}`;
  }
  d += " Z";

  return d;
}

/**
 * Build joint divider lines (thin lines across the finger at joint boundaries).
 * Returns lines for joints 1 and 2 (MCP/PIP and PIP/DIP boundaries).
 */
function jointDividers(pts: JointPoint[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  // Joint dividers at points 1 (MCP/PIP) and 2 (PIP/DIP)
  for (let i = 1; i <= 2; i++) {
    if (i >= pts.length) break;
    const pt = pts[i];
    const perpAngle = (pt.angle - 90) * RAD;
    const w = pt.halfW + 0.3; // slightly wider than finger edge
    lines.push({
      x1: pt.x + Math.cos(perpAngle) * w,
      y1: pt.y + Math.sin(perpAngle) * w,
      x2: pt.x - Math.cos(perpAngle) * w,
      y2: pt.y - Math.sin(perpAngle) * w,
    });
  }
  return lines;
}

// ── Thumb ───────────────────────────────────────────────────────────

function thumbCenterline(
  opposition: string,
  flexion: FlexionLevel,
): JointPoint[] {
  const curl = CURL_DEG[flexion] * RAD;

  const configs: Record<string, { x: number; y: number; angle: number }> = {
    PARALLEL: { x: 19, y: 34, angle: -140 },
    OPPOSED: { x: 21, y: 33, angle: -115 },
    CROSSED: { x: 22, y: 32, angle: -100 },
  };
  const cfg = configs[opposition] ?? configs.PARALLEL;

  const LENS = [7.5, 6];
  const HALF_WIDTHS = [2.6, 2.2, 1.5];

  const points: JointPoint[] = [];
  let x = cfg.x;
  let y = cfg.y;
  let a = cfg.angle;

  points.push({ x, y, angle: a, halfW: HALF_WIDTHS[0] });

  for (let i = 0; i < 2; i++) {
    if (i > 0) a += curl * (180 / Math.PI) * 0.6;
    x += Math.cos(a * RAD) * LENS[i];
    y += Math.sin(a * RAD) * LENS[i];
    points.push({ x, y, angle: a, halfW: HALF_WIDTHS[i + 1] });
  }

  return points;
}

// ── Component ───────────────────────────────────────────────────────

interface MiniHandProps {
  cm: CMEntry;
  size?: number;
  className?: string;
}

export function MiniHand({ cm, size = 64, className }: MiniHandProps) {
  const fingerStates: FlexionLevel[] = [cm.index, cm.middle, cm.ring, cm.pinky];

  const BASES = [
    { x: 25, y: 27, angle: -24 },   // Index
    { x: 30, y: 24, angle: -10 },   // Middle
    { x: 35.5, y: 25.5, angle: 4 }, // Ring
    { x: 40, y: 28.5, angle: 17 },  // Pinky
  ];

  // Compute finger geometry
  const fingers = BASES.map((base, i) => {
    const pts = fingerCenterline(base.x, base.y, base.angle, fingerStates[i]);
    const selected = cm.selected_fingers.includes(i + 1);
    return { pts, selected, state: fingerStates[i] };
  });

  // Thumb geometry
  const thumbPts = thumbCenterline(cm.thumb_opposition, cm.thumb_flexion);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`flex-shrink-0 ${className ?? ""}`}
    >
      {/* Palm silhouette */}
      <path
        d="M 23,50 C 21,46 19.5,40 20,34 Q 20.5,30 23,27 L 26,26 L 31,24.5 L 37,25.5 L 41,28 Q 43.5,30 44,34 C 44.5,40 43,46 41,50 Q 38,52 32,52 Q 26,52 23,50 Z"
        fill="#fde8d0"
        stroke="#d4a574"
        strokeWidth="0.6"
      />

      {/* Thumb — filled silhouette */}
      <path
        d={fingerSilhouettePath(thumbPts)}
        fill={FLEXION_COLOR[cm.thumb_flexion]}
        stroke={darken(FLEXION_COLOR[cm.thumb_flexion])}
        strokeWidth="0.4"
      />
      {/* Thumb joint divider */}
      {jointDividers(thumbPts).map((line, i) => (
        <line
          key={`thd-${i}`}
          x1={line.x1.toFixed(1)} y1={line.y1.toFixed(1)}
          x2={line.x2.toFixed(1)} y2={line.y2.toFixed(1)}
          stroke={darken(FLEXION_COLOR[cm.thumb_flexion], 0.4)}
          strokeWidth="0.6"
        />
      ))}

      {/* Fingers — filled silhouettes */}
      {fingers.map((finger, fi) => {
        const color = finger.selected
          ? FLEXION_COLOR[finger.state]
          : "#d4d4d4";
        const strokeColor = finger.selected
          ? darken(FLEXION_COLOR[finger.state])
          : "#b0b0b0";
        const opacity = finger.selected ? 1 : 0.3;

        return (
          <g key={`f${fi}`} opacity={opacity}>
            {/* Finger outline fill */}
            <path
              d={fingerSilhouettePath(finger.pts)}
              fill={color}
              stroke={strokeColor}
              strokeWidth="0.4"
            />
            {/* Joint dividers (selected fingers only) */}
            {finger.selected &&
              jointDividers(finger.pts).map((line, ji) => (
                <line
                  key={`jd${fi}-${ji}`}
                  x1={line.x1.toFixed(1)} y1={line.y1.toFixed(1)}
                  x2={line.x2.toFixed(1)} y2={line.y2.toFixed(1)}
                  stroke={darken(FLEXION_COLOR[finger.state], 0.4)}
                  strokeWidth="0.6"
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}
