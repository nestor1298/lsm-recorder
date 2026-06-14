import type { HandLandmarks } from "./types";

// HUD hand indicator (pure logic): which side "lights up".
// Ported from signa-play (apps/app/lib/vision/handIndicator.ts).
//
// MediaPipe web (no dev build) doesn't expose handedness — side is inferred
// from the wrist (landmark 0) x in the UN-mirrored frame: a front camera puts
// the user's RIGHT hand at x < 0.5 (the mirror is applied later in CSS). With
// two hands detected, both light up without guessing.

export interface HandsLit {
  left: boolean;
  right: boolean;
}

export function handsLit(hands: HandLandmarks[]): HandsLit {
  const valid = hands.filter((h) => h.length > 0);
  if (valid.length === 0) return { left: false, right: false };
  if (valid.length >= 2) return { left: true, right: true };
  const isRight = valid[0][0].x < 0.5;
  return { left: !isRight, right: isRight };
}
