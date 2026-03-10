/**
 * orientation.ts — Shared orientation → quaternion logic
 *
 * Extracted from RiggedHand.tsx so both RiggedHand (explore mode)
 * and AvatarModel (build mode) can use the same rotation math.
 *
 * Also provides SplitOrientation for anatomically distributing rotation
 * across the shoulder, forearm, and wrist using clinical ROM limits
 * (ref: WikEM Range of Motion by Joint).
 */

import * as THREE from "three";

const DEG = Math.PI / 180;

// ── Clinical ROM constants (WikEM) ──────────────────────────────

// Forearm pronation / supination
export const FOREARM_PRONATION_MAX = 80 * DEG;
export const FOREARM_SUPINATION_MAX = 80 * DEG;

// Shoulder internal / external rotation (used for orientation overflow)
export const SHOULDER_INT_ROT_MAX = 90 * DEG;
export const SHOULDER_EXT_ROT_MAX = 90 * DEG;

// Wrist
export const WRIST_FLEX_MAX = 60 * DEG;     // palmar flexion
export const WRIST_EXT_MAX = 60 * DEG;      // dorsiflexion
export const WRIST_RADIAL_MAX = 20 * DEG;   // radial deviation (toward thumb)
export const WRIST_ULNAR_MAX = 30 * DEG;    // ulnar deviation (toward pinky)

/**
 * Palm direction → base rotation (which way the palm surface faces).
 * Euler angles in degrees: [rx, ry, rz].
 */
export const PALM_EULER: Record<string, [number, number, number]> = {
  FORWARD: [0, 0, 0],
  BACK:    [0, 180, 0],
  UP:      [-90, 0, 0],
  DOWN:    [90, 0, 0],
  LEFT:    [0, -90, 0],
  RIGHT:   [0, 90, 0],
};

/**
 * Finger direction → Z-axis roll on top of palm rotation (degrees).
 */
export const FINGER_ROLL: Record<string, number> = {
  UP:      0,
  DOWN:    180,
  LEFT:    -90,
  RIGHT:   90,
  FORWARD: -45,
  BACK:    135,
};

// ── SplitOrientation types ────────────────────────────────────────

/**
 * Orientation split into anatomical components using clinical ROM cascading:
 *
 *  1. forearmTwist:  Axial Y-rotation (pronation/supination), clamped to ±80°
 *  2. shoulderTwist: Additional axial rotation overflow for the shoulder (±90°)
 *  3. fullOrient:    Complete orientation delta — applied to the hand bone with
 *                    forearm+shoulder counter-rotation (handled in animateArmIK)
 *
 * The hand's target quaternion is computed at application time as:
 *   targetHand = inv(totalAxialTwist) * bindHand * fullOrient
 * where totalAxialTwist = forearmTwist composed with shoulderTwist contribution.
 */
export interface SplitOrientation {
  forearmTwist: THREE.Quaternion;
  shoulderTwist: number;   // radians, positive = internal rotation
  fullOrient: THREE.Quaternion;
}

// ── Reusable temp objects (module-level, not per-frame allocated) ──
const _palmEuler = new THREE.Euler();
const _palmQuat = new THREE.Quaternion();
const _fingerQuat = new THREE.Quaternion();
const _fingerEuler = new THREE.Euler();
const _fullQuat = new THREE.Quaternion();
const _twistQuat = new THREE.Quaternion();

/**
 * Compute a quaternion that represents the combined palm + finger orientation.
 * First applies palm rotation, then finger roll on top.
 */
export function orientationToQuat(palm: string, fingers: string): THREE.Quaternion {
  const [rx, ry, rz] = PALM_EULER[palm] ?? PALM_EULER.FORWARD;
  _palmEuler.set(rx * DEG, ry * DEG, rz * DEG, "XYZ");
  _palmQuat.setFromEuler(_palmEuler);

  const roll = FINGER_ROLL[fingers] ?? 0;
  _fingerEuler.set(0, 0, roll * DEG, "XYZ");
  _fingerQuat.setFromEuler(_fingerEuler);

  // Compose: first apply palm rotation, then finger roll on top
  return new THREE.Quaternion().copy(_palmQuat).multiply(_fingerQuat);
}

// ── Swing-Twist Decomposition ────────────────────────────────────

/**
 * Extract the twist component of a quaternion around a given axis.
 *
 * Given quaternion q and axis a, decomposes q = swing * twist
 * where twist is a rotation purely around a, and swing is the remainder.
 *
 * Returns the twist quaternion (normalized).
 */
function extractTwist(
  q: THREE.Quaternion,
  axis: THREE.Vector3,
  outTwist: THREE.Quaternion,
): void {
  // Project the quaternion's vector part onto the twist axis
  const dot = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  outTwist.set(axis.x * dot, axis.y * dot, axis.z * dot, q.w);

  const len = outTwist.length();
  if (len < 1e-6) {
    outTwist.identity();
  } else {
    outTwist.x /= len;
    outTwist.y /= len;
    outTwist.z /= len;
    outTwist.w /= len;
  }
}

/**
 * Extract the signed angle (in radians) from a twist quaternion.
 * Assumes the quaternion is a rotation around a single axis.
 * Returns angle in [-π, π].
 */
function twistAngle(q: THREE.Quaternion): number {
  // Ensure shortest path (w > 0)
  const w = q.w < 0 ? -q.w : q.w;
  const y = q.w < 0 ? -q.y : q.y;

  const halfAngle = Math.acos(Math.min(1, w));
  const angle = halfAngle * 2;

  // Sign from the Y component (twist axis is Y)
  return y >= 0 ? angle : -angle;
}

/**
 * Create a Y-axis twist quaternion from a signed angle.
 */
function yTwistFromAngle(angle: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(_twistAxis, angle);
}

// ── Main split function ──────────────────────────────────────────

/** The forearm twist axis: bone-local Y (bones point down along -Y) */
const _twistAxis = new THREE.Vector3(0, 1, 0);

/**
 * Split an orientation (palm + finger direction) into anatomical components
 * using clinical ROM cascading.
 *
 * Algorithm:
 *   1. Compute the full orientation quaternion
 *   2. Swing-twist decompose around the forearm's long axis (Y)
 *   3. Cascade the Y-twist across joints by ROM capacity:
 *      a. Forearm absorbs up to ±80° (pronation/supination)
 *      b. Shoulder absorbs overflow up to ±90° (internal/external rotation)
 *   4. Swing component (non-Y rotation) goes to the hand bone
 *      (wrist flex/extension ±60°, radial/ulnar deviation 20°/30°)
 *
 * @param palm    Palm direction code (UP, DOWN, FORWARD, BACK, LEFT, RIGHT)
 * @param fingers Finger direction code
 * @returns SplitOrientation with forearmTwist, shoulderTwist, and fullOrient
 */
export function orientationToSplitQuats(
  palm: string,
  fingers: string,
): SplitOrientation {
  // 1. Full orientation delta
  const fullOrient = orientationToQuat(palm, fingers);

  // 2. Extract the Y-twist component via swing-twist decomposition
  _fullQuat.copy(fullOrient);
  extractTwist(_fullQuat, _twistAxis, _twistQuat);

  const totalTwist = twistAngle(_twistQuat);

  // 3. Cascade Y-twist across joints by ROM capacity
  //    Forearm gets as much as it can handle (±80°)
  const forearmMax = totalTwist >= 0 ? FOREARM_PRONATION_MAX : FOREARM_SUPINATION_MAX;
  const forearmAngle = Math.sign(totalTwist) * Math.min(Math.abs(totalTwist), forearmMax);
  const forearmTwist = yTwistFromAngle(forearmAngle);

  //    Shoulder absorbs overflow (±90°)
  const remainder = totalTwist - forearmAngle;
  const shoulderMax = remainder >= 0 ? SHOULDER_INT_ROT_MAX : SHOULDER_EXT_ROT_MAX;
  const shoulderTwist = Math.sign(remainder) * Math.min(Math.abs(remainder), shoulderMax);

  // 4. fullOrient is stored as-is — the hand compensation for both forearm
  //    and shoulder twist propagation is done at application time in animateArmIK
  return { forearmTwist, shoulderTwist, fullOrient };
}

/**
 * Blend two SplitOrientations by slerping/lerping each component independently.
 */
export function blendSplitOrientations(
  from: SplitOrientation,
  to: SplitOrientation,
  t: number,
): SplitOrientation {
  return {
    forearmTwist: new THREE.Quaternion().copy(from.forearmTwist).slerp(to.forearmTwist, t),
    shoulderTwist: from.shoulderTwist + (to.shoulderTwist - from.shoulderTwist) * t,
    fullOrient: new THREE.Quaternion().copy(from.fullOrient).slerp(to.fullOrient, t),
  };
}

/**
 * Clamp a wrist rotation quaternion to clinical ROM limits.
 *
 * Decomposes the delta (from bind pose) into Euler XYZ:
 *   X = flexion(+)/extension(-) — clamped to [-60°, +60°]
 *   Z = ulnar(+)/radial(-) deviation — clamped to [-20°, +30°]
 *   Y = remaining pronation component — left unclamped (handled by forearm+shoulder)
 */
export function clampWristRotation(
  quat: THREE.Quaternion,
  bindQuat: THREE.Quaternion,
): void {
  // Extract delta from bind pose
  const delta = quat.clone().multiply(bindQuat.clone().invert());
  const euler = new THREE.Euler().setFromQuaternion(delta, "XYZ");

  // Clamp flexion/extension (X-axis)
  euler.x = Math.max(-WRIST_EXT_MAX, Math.min(WRIST_FLEX_MAX, euler.x));

  // Clamp radial/ulnar deviation (Z-axis)
  euler.z = Math.max(-WRIST_RADIAL_MAX, Math.min(WRIST_ULNAR_MAX, euler.z));

  // Reconstruct
  delta.setFromEuler(euler);
  quat.copy(delta).multiply(bindQuat);
}
