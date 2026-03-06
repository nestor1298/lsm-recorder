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
// Calibrated from rigget_V16.glb baked animations:
//   "S" (fist): PIP≈-85°, DIP≈-70°, MCP≈-28°  → total ≈ 183°
//   "A" (fist): PIP≈-70°, DIP≈-70°, MCP≈-28°  → total ≈ 168°
// The model's bones require larger angles than the 2D SVG visualization.

const DEG2RAD = Math.PI / 180;

const FLEXION_RAD: Record<FlexionLevel, number> = {
  EXTENDED: 0,
  CURVED:  60 * DEG2RAD,    // mild curl
  BENT:    120 * DEG2RAD,   // firm curl
  CLOSED:  180 * DEG2RAD,   // full fist
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
 * Distribute a flexion angle across MCP, PIP, DIP.
 * Based on rigget_V16.glb animation data:
 *   MCP ≈ 15%, PIP ≈ 47%, DIP ≈ 38% (from "S" fist pose)
 * Returns [mcpFlex, pipFlex, dipFlex] in radians.
 */
function distributeCurl(flexion: FlexionLevel): [number, number, number] {
  const total = FLEXION_RAD[flexion];
  return [total * 0.15, total * 0.47, total * 0.38];
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
 * Calibrated from rigget_V16.glb animations:
 *   "S" (opposed fist): rThumb1 dX=-41° dY=-8° dZ=11°
 *   "L" (extended): rThumb1 dX=4° dY=-24° dZ=7°
 *   "1" (tucked): rThumb1 dX=-25° dY=-11° dZ=11°
 */
function buildThumbPose(
  opposition: ThumbOpposition,
  flexion: FlexionLevel,
  thumbContact: boolean,
): ThumbPose {
  const totalCurl = FLEXION_RAD[flexion];

  // Opposition: how much the thumb rotates to face the fingers
  // From GLB data, opposition is primarily X-rotation + Y-rotation on rThumb1
  let cmcOpposition = 0;
  let cmcRotation = 0;

  if (opposition === "OPPOSED") {
    cmcOpposition = -40 * DEG2RAD;  // X-rotation (curl toward palm)
    cmcRotation = -8 * DEG2RAD;     // Y-rotation
  } else if (opposition === "CROSSED") {
    cmcOpposition = -50 * DEG2RAD;
    cmcRotation = -20 * DEG2RAD;
  }
  // PARALLEL: both stay 0 (thumb alongside palm)

  // Distribute curl: MCP 40%, IP 60% (from animation data)
  let mcpFlex = totalCurl * 0.40;
  let ipFlex = totalCurl * 0.60;

  // Thumb contact: bring tip closer
  if (thumbContact) {
    ipFlex += 15 * DEG2RAD;
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
