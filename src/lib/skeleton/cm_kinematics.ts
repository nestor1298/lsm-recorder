/**
 * cm_kinematics.ts — CM (configuración manual) → ángulos por falange.
 *
 * Reusa la tabla ya calibrada de src/lib/hand_pose.ts (construida para el
 * avatar Lexsi): EXTENDED 0° / CURVED 80° / BENT 160° / CLOSED 260°
 * distribuidos MCP 35% · PIP 40% · DIP 25%, pulgar con oposición y
 * contacto, separación lateral y cupping metacarpiano. Si hay que
 * recalibrar, se recalibra ALLÍ (una sola tabla para avatar y esqueleto).
 */

import type { CMEntry } from "@/lib/types";
import {
  cmEntryToHandPose,
  RESTING_POSE,
  type HandPose,
  type FingerPose,
  type ThumbPose,
} from "@/lib/hand_pose";

export type { HandPose, FingerPose, ThumbPose };
export { RESTING_POSE };

/** Ángulos de mano para una CM del inventario. */
export function fingerAnglesFromCM(cm: CMEntry): HandPose {
  return cmEntryToHandPose(cm);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lerpFinger(a: FingerPose, b: FingerPose, t: number): FingerPose {
  return {
    carpalSpread: lerp(a.carpalSpread, b.carpalSpread, t),
    carpalFlex: lerp(a.carpalFlex, b.carpalFlex, t),
    mcpFlex: lerp(a.mcpFlex, b.mcpFlex, t),
    pipFlex: lerp(a.pipFlex, b.pipFlex, t),
    dipFlex: lerp(a.dipFlex, b.dipFlex, t),
  };
}

/**
 * Interpolación entre dos poses de mano (osc-CM, cambios progresivos,
 * transiciones entre segmentos con CM distinta).
 */
export function lerpHandPose(a: HandPose, b: HandPose, t: number): HandPose {
  return {
    index: lerpFinger(a.index, b.index, t),
    middle: lerpFinger(a.middle, b.middle, t),
    ring: lerpFinger(a.ring, b.ring, t),
    pinky: lerpFinger(a.pinky, b.pinky, t),
    thumb: {
      cmcOpposition: lerp(a.thumb.cmcOpposition, b.thumb.cmcOpposition, t),
      cmcRotation: lerp(a.thumb.cmcRotation, b.thumb.cmcRotation, t),
      mcpFlex: lerp(a.thumb.mcpFlex, b.thumb.mcpFlex, t),
      ipFlex: lerp(a.thumb.ipFlex, b.thumb.ipFlex, t),
    },
  };
}
