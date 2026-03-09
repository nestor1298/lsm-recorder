/**
 * sign_playback.ts — Pure playback timeline engine
 *
 * Computes which segment is active at a given elapsed time,
 * and interpolates movement positions between holds.
 * No React/R3F dependencies — pure logic.
 */

import type { SignConstruction, Segment, HoldSegment, MovementSegment } from "./sign_types";

// ── Configuration ────────────────────────────────────────────────

export interface PlaybackConfig {
  /** Duration of each hold segment in ms */
  holdDuration: number;
  /** Duration of each movement segment in ms */
  movementDuration: number;
}

export const DEFAULT_PLAYBACK_CONFIG: PlaybackConfig = {
  holdDuration: 800,
  movementDuration: 600,
};

// ── Playback frame ──────────────────────────────────────────────

export interface PlaybackFrame {
  /** Index into sign.segments */
  segmentIndex: number;
  /** Type of the active segment */
  segmentType: "D" | "M";
  /** Progress within this segment: 0 = start, 1 = end */
  progress: number;
  /** For M segments: index of the D hold we're coming from */
  fromHoldIdx?: number;
  /** For M segments: index of the D hold we're going to */
  toHoldIdx?: number;
  /** For M segments: interpolation factor (0 = at fromHold, 1 = at toHold) */
  ubInterpolation?: number;
  /** Whether playback has finished (past all segments) */
  finished: boolean;
}

// ── Core functions ──────────────────────────────────────────────

/**
 * Compute the total duration of the sign playback in ms.
 */
export function computeTotalDuration(
  sign: SignConstruction,
  config: PlaybackConfig = DEFAULT_PLAYBACK_CONFIG,
): number {
  let total = 0;
  for (const seg of sign.segments) {
    total += seg.type === "D" ? config.holdDuration : config.movementDuration;
  }
  return total;
}

/**
 * Get the playback frame for a given elapsed time.
 */
export function getPlaybackFrame(
  sign: SignConstruction,
  elapsedMs: number,
  config: PlaybackConfig = DEFAULT_PLAYBACK_CONFIG,
): PlaybackFrame {
  const segments = sign.segments;
  if (segments.length === 0) {
    return { segmentIndex: 0, segmentType: "D", progress: 0, finished: true };
  }

  let cumulative = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const dur = seg.type === "D" ? config.holdDuration : config.movementDuration;
    const segStart = cumulative;
    const segEnd = cumulative + dur;

    if (elapsedMs < segEnd) {
      const progress = Math.max(0, Math.min(1, (elapsedMs - segStart) / dur));
      const frame: PlaybackFrame = {
        segmentIndex: i,
        segmentType: seg.type,
        progress,
        finished: false,
      };

      // For movement segments, find adjacent holds
      if (seg.type === "M") {
        const fromIdx = findPreviousHold(segments, i);
        const toIdx = findNextHold(segments, i);
        frame.fromHoldIdx = fromIdx;
        frame.toHoldIdx = toIdx;
        // Smooth ease-in-out for movement interpolation
        frame.ubInterpolation = smoothStep(progress);
      }

      return frame;
    }

    cumulative = segEnd;
  }

  // Past all segments — finished
  return {
    segmentIndex: segments.length - 1,
    segmentType: segments[segments.length - 1].type,
    progress: 1,
    finished: true,
  };
}

// ── Movement interpolation ──────────────────────────────────────

/**
 * Interpolate a UB world position between two holds based on movement contour
 * and movement plane.
 *
 * Contour deviations are computed as 2D (u, v) offsets and projected onto 3D
 * based on the plane parameter (VERTICAL, HORIZONTAL, SAGITTAL, OBLIQUE).
 *
 * @param fromPos  World position of the "from" UB
 * @param toPos    World position of the "to" UB
 * @param contour  Movement contour type (STRAIGHT, ARC, CIRCLE, etc.)
 * @param plane    Movement plane (VERTICAL, HORIZONTAL, SAGITTAL, OBLIQUE)
 * @param t        Interpolation factor 0..1
 * @returns        [x, y, z] interpolated position
 */
export function interpolateMovementPosition(
  fromPos: [number, number, number],
  toPos: [number, number, number],
  contour: string,
  plane: string,
  t: number,
): [number, number, number] {
  // Linear interpolation base
  const lx = fromPos[0] + (toPos[0] - fromPos[0]) * t;
  const ly = fromPos[1] + (toPos[1] - fromPos[1]) * t;
  const lz = fromPos[2] + (toPos[2] - fromPos[2]) * t;

  if (contour === "STRAIGHT") return [lx, ly, lz];

  // Path length for scaling offsets
  const dx = toPos[0] - fromPos[0];
  const dy = toPos[1] - fromPos[1];
  const dz = toPos[2] - fromPos[2];
  const pathLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const scale = Math.max(pathLen * 0.5, 0.05);

  // Compute 2D contour deviation (u = primary/lateral, v = secondary/lift)
  let u = 0, v = 0;

  switch (contour) {
    case "ARC":
      v = 4 * t * (1 - t) * scale * 0.6;
      break;

    case "CIRCLE": {
      const angle = t * Math.PI * 2;
      const r = scale * 0.4;
      u = Math.cos(angle) * r - r;
      v = Math.sin(angle) * r;
      break;
    }

    case "ZIGZAG":
      u = Math.sin(t * 3 * Math.PI) * scale * 0.3;
      break;

    case "SEVEN":
      if (t < 0.4) {
        const p = t / 0.4;
        u = p * scale * 0.4;
      } else {
        const p = (t - 0.4) / 0.6;
        u = scale * 0.4 * (1 - p);
        v = -p * scale * 0.5;
      }
      break;
  }

  // Project (u, v) offset based on movement plane
  let ox = 0, oy = 0, oz = 0;
  switch (plane) {
    case "VERTICAL":   ox = u; oy = v; break;
    case "HORIZONTAL": ox = u; oz = v; break;
    case "SAGITTAL":   oz = u; oy = v; break;
    case "OBLIQUE":    ox = u * 0.7; oy = v * 0.7; oz = u * 0.5; break;
    default:           ox = u; oy = v; break;
  }

  return [lx + ox, ly + oy, lz + oz];
}

// ── Helpers ──────────────────────────────────────────────────────

function findPreviousHold(segments: Segment[], fromIdx: number): number | undefined {
  for (let i = fromIdx - 1; i >= 0; i--) {
    if (segments[i].type === "D") return i;
  }
  return undefined;
}

function findNextHold(segments: Segment[], fromIdx: number): number | undefined {
  for (let i = fromIdx + 1; i < segments.length; i++) {
    if (segments[i].type === "D") return i;
  }
  return undefined;
}

/** Hermite smooth-step for nice easing */
function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Extract the hold data for a given segment index.
 * Returns null if the index is out of bounds or not a hold segment.
 */
export function getHoldAtIndex(
  sign: SignConstruction,
  index: number | undefined,
): HoldSegment | null {
  if (index === undefined || index < 0 || index >= sign.segments.length) return null;
  const seg = sign.segments[index];
  return seg.type === "D" ? seg : null;
}

/**
 * Get the movement segment data at a given index.
 */
export function getMovementAtIndex(
  sign: SignConstruction,
  index: number,
): MovementSegment | null {
  if (index < 0 || index >= sign.segments.length) return null;
  const seg = sign.segments[index];
  return seg.type === "M" ? seg : null;
}
