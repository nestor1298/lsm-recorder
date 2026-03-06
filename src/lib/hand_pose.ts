/**
 * hand_pose.ts — Pure data layer: CMEntry → bone rotation targets
 *
 * Converts LSM-PN handshape configurations into target Euler rotations
 * for each bone in the rigget_V16.glb rigged hand model.
 *
 * Bone hierarchy (from GLB):
 *   rHand (root)
 *   ├── rThumb1 → rThumb2 → rThumb3 → rThumb4__
 *   ├── rCarpal1 → rIndex1 → rIndex2 → rIndex3 → rIndex4
 *   ├── rCarpal2 → rMid1 → rMid2 → rMid3 → rMid4
 *   ├── rCarpal3 → rRing1 → rRing2 → rRing3 → rRing4
 *   └── rCarpal4 → rPinky1 → rPinky2 → rPinky3 → rPinky4
 */

import type { CMEntry, FlexionLevel, ThumbOpposition } from "./types";

// ── Bone name constants ─────────────────────────────────────────

export const FINGER_BONES = {
  index:  { carpal: "rCarpal1", bones: ["rIndex1", "rIndex2", "rIndex3"] },
  middle: { carpal: "rCarpal2", bones: ["rMid1",   "rMid2",   "rMid3"]   },
  ring:   { carpal: "rCarpal3", bones: ["rRing1",  "rRing2",  "rRing3"]  },
  pinky:  { carpal: "rCarpal4", bones: ["rPinky1", "rPinky2", "rPinky3"] },
} as const;

export const THUMB_BONES = ["rThumb1", "rThumb2", "rThumb3"] as const;

export type FingerName = keyof typeof FINGER_BONES;

// ── Flexion angle mapping (degrees → radians) ──────────────────
// Source: HandVisualization.tsx lines 11-16

const DEG2RAD = Math.PI / 180;

const FLEXION_RAD: Record<FlexionLevel, number> = {
  EXTENDED: 0,
  CURVED:  25 * DEG2RAD,   // 0.436 rad
  BENT:    55 * DEG2RAD,   // 0.960 rad
  CLOSED:  80 * DEG2RAD,   // 1.396 rad
};

// ── Types ───────────────────────────────────────────────────────

/** Rotation deltas (in radians) to apply on top of bind-pose for one finger */
export interface FingerPose {
  /** Carpal bone Y-rotation for lateral spread */
  carpalSpread: number;
  /** MCP (Digit1) X-rotation for primary curl */
  mcpFlex: number;
  /** PIP (Digit2) X-rotation for mid curl */
  pipFlex: number;
  /** DIP (Digit3) X-rotation for distal curl */
  dipFlex: number;
}

/** Rotation deltas for the thumb */
export interface ThumbPose {
  /** rThumb1 Z-rotation for opposition/abduction */
  cmcOpposition: number;
  /** rThumb1 Y-rotation for opposition */
  cmcRotation: number;
  /** rThumb2 X-rotation for MCP curl */
  mcpFlex: number;
  /** rThumb3 X-rotation for IP curl */
  ipFlex: number;
}

/** Complete hand pose — rotation deltas for all bones */
export interface HandPose {
  index: FingerPose;
  middle: FingerPose;
  ring: FingerPose;
  pinky: FingerPose;
  thumb: ThumbPose;
}

// ── Conversion logic ────────────────────────────────────────────

/**
 * Distribute a flexion angle across MCP (40%), PIP (35%), DIP (25%).
 * Returns [mcpFlex, pipFlex, dipFlex] in radians.
 */
function distributeCurl(flexion: FlexionLevel): [number, number, number] {
  const total = FLEXION_RAD[flexion];
  return [total * 0.4, total * 0.35, total * 0.25];
}

/** Spread angles per finger (radians), applied to carpal bone Y-axis */
const SPREAD_ANGLES: Record<FingerName, number> = {
  index:  -0.15,
  middle: -0.05,
  ring:    0.05,
  pinky:   0.15,
};

/**
 * Build a FingerPose from a FlexionLevel and spread/selection state.
 */
function buildFingerPose(
  flexion: FlexionLevel,
  spread: boolean,
  fingerName: FingerName,
  distalOverride: string | null,
): FingerPose {
  const [mcpFlex, pipFlex, dipFlex] = distributeCurl(flexion);

  let finalDip = dipFlex;
  if (distalOverride === "d-") {
    finalDip += 0.4; // extra distal flexion
  }

  return {
    carpalSpread: spread ? SPREAD_ANGLES[fingerName] : 0,
    mcpFlex,
    pipFlex,
    dipFlex: finalDip,
  };
}

/**
 * Build a ThumbPose from opposition and flexion.
 * Reference: HandVisualization.tsx line 78: -140° opposed vs -110° parallel.
 */
function buildThumbPose(
  opposition: ThumbOpposition,
  flexion: FlexionLevel,
  thumbContact: boolean,
): ThumbPose {
  const totalCurl = FLEXION_RAD[flexion];

  // Opposition: how much the thumb rotates to face the fingers
  let cmcOpposition = 0;
  let cmcRotation = 0;

  if (opposition === "OPPOSED") {
    cmcOpposition = 0.6;   // Z-axis abduction
    cmcRotation = -0.5;    // Y-axis rotation toward fingers
  } else if (opposition === "CROSSED") {
    cmcOpposition = 0.4;
    cmcRotation = -0.8;
  }
  // PARALLEL: both stay 0 (thumb alongside palm)

  // Distribute curl: MCP 55%, IP 45% (thumb has 2 phalanges)
  let mcpFlex = totalCurl * 0.55;
  let ipFlex = totalCurl * 0.45;

  // Thumb contact: bring tip closer
  if (thumbContact) {
    ipFlex += 0.3;
  }

  return { cmcOpposition, cmcRotation, mcpFlex, ipFlex };
}

// ── Main conversion function ────────────────────────────────────

/**
 * Convert a CMEntry into target bone rotation deltas for all fingers.
 */
export function cmEntryToHandPose(cm: CMEntry): HandPose {
  const isSpread = cm.spread === "SPREAD";
  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  const cmFlexions: Record<FingerName, FlexionLevel> = {
    index: cm.index,
    middle: cm.middle,
    ring: cm.ring,
    pinky: cm.pinky,
  };

  const fingers: Record<FingerName, FingerPose> = {} as Record<FingerName, FingerPose>;

  for (const name of fingerNames) {
    const fingerNum = { index: 1, middle: 2, ring: 3, pinky: 4 }[name];
    const isSelected = cm.selected_fingers.includes(fingerNum);

    let flexion: FlexionLevel;
    if (isSelected) {
      flexion = cmFlexions[name];
    } else {
      // Non-selected: closed into palm, unless non_selected_above
      flexion = cm.non_selected_above ? "EXTENDED" : "CLOSED";
    }

    // Only apply distal override to selected fingers
    const distal = isSelected ? cm.distal_override : null;
    fingers[name] = buildFingerPose(flexion, isSpread, name, distal);
  }

  const thumb = buildThumbPose(cm.thumb_opposition, cm.thumb_flexion, cm.thumb_contact);

  return {
    index: fingers.index,
    middle: fingers.middle,
    ring: fingers.ring,
    pinky: fingers.pinky,
    thumb,
  };
}

/** Resting pose — slight natural curl (~10°) */
export const RESTING_POSE: HandPose = {
  index:  { carpalSpread: 0, mcpFlex: 0.07, pipFlex: 0.06, dipFlex: 0.04 },
  middle: { carpalSpread: 0, mcpFlex: 0.07, pipFlex: 0.06, dipFlex: 0.04 },
  ring:   { carpalSpread: 0, mcpFlex: 0.07, pipFlex: 0.06, dipFlex: 0.04 },
  pinky:  { carpalSpread: 0, mcpFlex: 0.07, pipFlex: 0.06, dipFlex: 0.04 },
  thumb:  { cmcOpposition: 0, cmcRotation: 0, mcpFlex: 0.05, ipFlex: 0.04 },
};
