/**
 * MiniHand — Refined SVG hand thumbnail for CM handshape display.
 *
 * Renders an anatomical palm silhouette with capsule-shaped finger segments
 * that curl based on FlexionLevel. Color-coded:
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

/** Slightly darker shade for knuckle dots */
function darken(hex: string, amount = 0.25): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - amount;
  return `#${Math.round(r * f).toString(16).padStart(2, "0")}${Math.round(g * f).toString(16).padStart(2, "0")}${Math.round(b * f).toString(16).padStart(2, "0")}`;
}

// ── Flexion curl angles (degrees per segment) ───────────────────────

const CURL_DEG: Record<FlexionLevel, number> = {
  EXTENDED: 0,
  CURVED: 25,
  BENT: 55,
  CLOSED: 80,
};

// ── Finger geometry ─────────────────────────────────────────────────

const DEG = Math.PI / 180;

interface SegmentData {
  cx: number;
  cy: number;
  angle: number; // degrees
  len: number;
  w: number;
  color: string;
  opacity: number;
}

/** Compute capsule segments for one finger. */
function fingerSegments(
  baseX: number,
  baseY: number,
  spreadAngle: number,
  flexion: FlexionLevel,
  selected: boolean,
): { segments: SegmentData[]; joints: { x: number; y: number }[] } {
  const curl = CURL_DEG[flexion] * DEG;
  const color = selected ? FLEXION_COLOR[flexion] : "#d4d4d4";
  const opacity = selected ? 1 : 0.3;

  const LENS = [9, 7.5, 5.5];
  const WIDTHS = [4.2, 3.6, 3];

  const segments: SegmentData[] = [];
  const joints: { x: number; y: number }[] = [];

  let x = baseX;
  let y = baseY;
  let a = spreadAngle - 90; // start pointing upward

  for (let i = 0; i < 3; i++) {
    // Apply curl: MCP gets none, PIP and DIP share curl
    if (i > 0) a += curl * (i === 1 ? 0.45 : 0.55);

    const len = LENS[i];
    const w = WIDTHS[i];

    segments.push({ cx: x, cy: y, angle: a, len, w, color, opacity });

    // Move to next joint
    const endX = x + Math.cos(a * DEG) * len;
    const endY = y + Math.sin(a * DEG) * len;

    if (i < 2) {
      joints.push({ x: endX, y: endY });
    }

    x = endX;
    y = endY;
  }

  return { segments, joints };
}

/** Compute thumb capsule segments. */
function thumbSegments(
  opposition: string,
  flexion: FlexionLevel,
): { segments: SegmentData[]; joints: { x: number; y: number }[] } {
  const color = FLEXION_COLOR[flexion];
  const curl = CURL_DEG[flexion] * DEG;

  // Thumb position and angle based on opposition
  const configs: Record<string, { x: number; y: number; angle: number }> = {
    PARALLEL: { x: 19, y: 34, angle: -140 },
    OPPOSED: { x: 21, y: 33, angle: -115 },
    CROSSED: { x: 22, y: 32, angle: -100 },
  };
  const cfg = configs[opposition] ?? configs.PARALLEL;

  const LENS = [7.5, 6];
  const WIDTHS = [4.5, 3.5];

  const segments: SegmentData[] = [];
  const joints: { x: number; y: number }[] = [];

  let x = cfg.x;
  let y = cfg.y;
  let a = cfg.angle;

  for (let i = 0; i < 2; i++) {
    if (i > 0) a += curl * 0.6;

    segments.push({
      cx: x,
      cy: y,
      angle: a,
      len: LENS[i],
      w: WIDTHS[i],
      color,
      opacity: 1,
    });

    const endX = x + Math.cos(a * DEG) * LENS[i];
    const endY = y + Math.sin(a * DEG) * LENS[i];

    if (i === 0) joints.push({ x: endX, y: endY });

    x = endX;
    y = endY;
  }

  return { segments, joints };
}

// ── Component ───────────────────────────────────────────────────────

interface MiniHandProps {
  cm: CMEntry;
  size?: number;
  className?: string;
}

export function MiniHand({ cm, size = 64, className }: MiniHandProps) {
  const fingerStates: FlexionLevel[] = [cm.index, cm.middle, cm.ring, cm.pinky];

  // Finger base positions (dorsal view, left hand)
  const BASES = [
    { x: 25, y: 27, angle: -24 }, // Index
    { x: 30, y: 24, angle: -10 }, // Middle
    { x: 35.5, y: 25.5, angle: 4 }, // Ring
    { x: 40, y: 28.5, angle: 17 }, // Pinky
  ];

  // Build all finger data
  const allFingers = BASES.map((base, i) => {
    const selected = cm.selected_fingers.includes(i + 1);
    return fingerSegments(base.x, base.y, base.angle, fingerStates[i], selected);
  });

  const thumb = thumbSegments(cm.thumb_opposition, cm.thumb_flexion);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`flex-shrink-0 ${className ?? ""}`}
    >
      {/* Palm — anatomical silhouette */}
      <path
        d="M 23,50 C 21,46 19.5,40 20,34 Q 20.5,30 23,27 L 26,26 L 31,24.5 L 37,25.5 L 41,28 Q 43.5,30 44,34 C 44.5,40 43,46 41,50 Q 38,52 32,52 Q 26,52 23,50 Z"
        fill="#fde8d0"
        stroke="#d4a574"
        strokeWidth="0.6"
      />

      {/* Thumb segments */}
      {thumb.segments.map((seg, i) => (
        <rect
          key={`th-${i}`}
          x={-seg.w / 2}
          y={0}
          width={seg.w}
          height={seg.len}
          rx={seg.w / 2}
          ry={seg.w / 2}
          fill={seg.color}
          opacity={seg.opacity}
          transform={`translate(${seg.cx.toFixed(1)},${seg.cy.toFixed(1)}) rotate(${seg.angle.toFixed(1)})`}
        />
      ))}
      {/* Thumb knuckle dots */}
      {thumb.joints.map((j, i) => (
        <circle
          key={`thj-${i}`}
          cx={j.x.toFixed(1)}
          cy={j.y.toFixed(1)}
          r={1.8}
          fill={darken(FLEXION_COLOR[cm.thumb_flexion])}
        />
      ))}

      {/* Finger segments */}
      {allFingers.map((finger, fi) => {
        const selected = cm.selected_fingers.includes(fi + 1);
        return finger.segments.map((seg, si) => (
          <rect
            key={`f${fi}-${si}`}
            x={-seg.w / 2}
            y={0}
            width={seg.w}
            height={seg.len}
            rx={seg.w / 2}
            ry={seg.w / 2}
            fill={seg.color}
            opacity={seg.opacity}
            transform={`translate(${seg.cx.toFixed(1)},${seg.cy.toFixed(1)}) rotate(${seg.angle.toFixed(1)})`}
          />
        ));
      })}

      {/* Knuckle dots (selected fingers only) */}
      {allFingers.map((finger, fi) => {
        const selected = cm.selected_fingers.includes(fi + 1);
        if (!selected) return null;
        const color = darken(FLEXION_COLOR[fingerStates[fi]]);
        return finger.joints.map((j, ji) => (
          <circle
            key={`j${fi}-${ji}`}
            cx={j.x.toFixed(1)}
            cy={j.y.toFixed(1)}
            r={1.5}
            fill={color}
          />
        ));
      })}
    </svg>
  );
}
