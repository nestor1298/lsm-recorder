/**
 * avatar_hand_bones.ts — Mixamo avatar bone mapping + mirror utilities
 *
 * Maps the abstract HandPose (from hand_pose.ts) to Mixamo skeleton bones
 * in wscharacter.glb, and provides mirroring for two-hand symmetric signs.
 *
 * Bone name correspondence:
 *   Mixamo LeftHandIndex1  ≈ rCarpal1 (carpal spread Y-rot)
 *   Mixamo LeftHandIndex2  ≈ rIndex1  (MCP flexion X-rot)
 *   Mixamo LeftHandIndex3  ≈ rIndex2  (PIP flexion X-rot)
 *   Mixamo LeftHandIndex4  ≈ rIndex3  (DIP flexion X-rot)
 */

import type { FingerName } from "./hand_pose";

// ── Finger bone mapping ────────────────────────────────────────

export interface AvatarFingerChain {
  carpal: string;
  bones: [string, string, string]; // MCP, PIP, DIP
}

export const AVATAR_FINGER_BONES: Record<FingerName, AvatarFingerChain> = {
  index:  { carpal: "LeftHandIndex1",  bones: ["LeftHandIndex2",  "LeftHandIndex3",  "LeftHandIndex4"] },
  middle: { carpal: "LeftHandMiddle1", bones: ["LeftHandMiddle2", "LeftHandMiddle3", "LeftHandMiddle4"] },
  ring:   { carpal: "LeftHandRing1",   bones: ["LeftHandRing2",   "LeftHandRing3",   "LeftHandRing4"] },
  pinky:  { carpal: "LeftHandPinky1",  bones: ["LeftHandPinky2",  "LeftHandPinky3",  "LeftHandPinky4"] },
};

export const AVATAR_THUMB_BONES = [
  "LeftHandThumb1",
  "LeftHandThumb2",
  "LeftHandThumb3",
] as const;

// ── Arm chain ─────────────────────────────────────────────────

export interface ArmChain {
  shoulder: string;
  upperArm: string;
  foreArm: string;
  hand: string;
}

export const ARM_CHAINS: Record<"left" | "right", ArmChain> = {
  left: {
    shoulder: "LeftShoulder",
    upperArm: "LeftArm",
    foreArm: "LeftForeArm",
    hand: "LeftHand",
  },
  right: {
    shoulder: "RightShoulder",
    upperArm: "RightArm",
    foreArm: "RightForeArm",
    hand: "RightHand",
  },
};

// ── Mirror utilities (for two-hand symmetric signs) ────────────

/**
 * Swap "Left" ↔ "Right" in a Mixamo bone name.
 */
export function mirrorBoneName(name: string): string {
  if (name.startsWith("Left")) return "Right" + name.slice(4);
  if (name.startsWith("Right")) return "Left" + name.slice(5);
  return name;
}

/**
 * Mirror a UB offset: negate the X component (left ↔ right).
 */
export function mirrorUBOffset(offset: [number, number, number]): [number, number, number] {
  return [-offset[0], offset[1], offset[2]];
}

/**
 * Mirror an orientation: swap LEFT ↔ RIGHT palm/finger directions.
 */
export function mirrorOrientation(or: { palm: string; fingers: string }): {
  palm: string;
  fingers: string;
} {
  function swapLR(dir: string): string {
    if (dir === "LEFT") return "RIGHT";
    if (dir === "RIGHT") return "LEFT";
    return dir;
  }
  return {
    palm: swapLR(or.palm),
    fingers: swapLR(or.fingers),
  };
}

/**
 * Get the right-side finger bone names (for secondary hand in symmetric mode).
 */
export function getRightFingerBones(): Record<FingerName, AvatarFingerChain> {
  const result = {} as Record<FingerName, AvatarFingerChain>;
  for (const [name, chain] of Object.entries(AVATAR_FINGER_BONES)) {
    result[name as FingerName] = {
      carpal: mirrorBoneName(chain.carpal),
      bones: chain.bones.map(mirrorBoneName) as [string, string, string],
    };
  }
  return result;
}

export const AVATAR_RIGHT_THUMB_BONES = AVATAR_THUMB_BONES.map(mirrorBoneName) as unknown as [string, string, string];
