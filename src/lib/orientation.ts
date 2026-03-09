/**
 * orientation.ts — Shared orientation → quaternion logic
 *
 * Extracted from RiggedHand.tsx so both RiggedHand (explore mode)
 * and AvatarModel (build mode) can use the same rotation math.
 *
 * Also provides SplitOrientation for anatomically distributing rotation
 * between the forearm (pronation/supination) and the hand (wrist flex/dev).
 */

import * as THREE from "three";

const DEG = Math.PI / 180;

// ── Anatomical wrist constants ────────────────────────────────────
export const WRIST_FLEX_MAX = 80 * DEG;    // palmar flexion
export const WRIST_EXT_MAX = 70 * DEG;     // dorsal extension
export const WRIST_RADIAL_MAX = 20 * DEG;  // radial deviation (toward thumb)
export const WRIST_ULNAR_MAX = 30 * DEG;   // ulnar deviation (toward pinky)

/** Fraction of axial twist that the forearm absorbs (vs. hand) */
const FOREARM_TWIST_FRACTION = 0.25;

/** Max forearm pronation/supination from neutral (±85°) */
const FOREARM_TWIST_MAX = 85 * DEG;

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
 * Orientation split into two anatomical components:
 *  - forearmTwist: Axial Y-rotation (pronation/supination) applied to the forearm bone
 *  - fullOrient:   Complete orientation delta — applied to the hand bone with
 *                  forearm-twist counter-rotation (handled in animateArmIK)
 *
 * The hand's target quaternion is computed at application time as:
 *   targetHand = inv(forearmTwist) * bindHand * fullOrient
 * This compensates for the forearm twist propagating through the parent→child
 * bone hierarchy, ensuring the final hand world rotation is correct.
 */
export interface SplitOrientation {
  forearmTwist: THREE.Quaternion;
  fullOrient: THREE.Quaternion;
}

// ── Reusable temp objects (module-level, not per-frame allocated) ──
const _palmEuler = new THREE.Euler();
const _palmQuat = new THREE.Quaternion();
const _fingerQuat = new THREE.Quaternion();
const _fingerEuler = new THREE.Euler();
const _fullQuat = new THREE.Quaternion();
const _twistQuat = new THREE.Quaternion();
const _forearmPartial = new THREE.Quaternion();
const _identityQuat = new THREE.Quaternion();

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
  // twist = normalize(q.w, projection of (q.x,q.y,q.z) onto axis)
  const dot = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  outTwist.set(axis.x * dot, axis.y * dot, axis.z * dot, q.w);

  const len = outTwist.length();
  if (len < 1e-6) {
    // No twist component — identity
    outTwist.identity();
  } else {
    outTwist.x /= len;
    outTwist.y /= len;
    outTwist.z /= len;
    outTwist.w /= len;
  }
}

/**
 * Clamp a twist quaternion's angle to ±maxAngle.
 *
 * Assumes twistQuat is a rotation around a single axis.
 * Uses 2*acos(w) to get the angle, clamps, and reconstructs.
 */
function clampTwistAngle(twistQuat: THREE.Quaternion, maxAngle: number): void {
  // Ensure w is positive (shortest path)
  if (twistQuat.w < 0) {
    twistQuat.x = -twistQuat.x;
    twistQuat.y = -twistQuat.y;
    twistQuat.z = -twistQuat.z;
    twistQuat.w = -twistQuat.w;
  }

  const halfAngle = Math.acos(Math.min(1, twistQuat.w));
  const angle = halfAngle * 2;

  if (angle > maxAngle) {
    // Clamp to maxAngle
    const clampedHalf = maxAngle / 2;
    const sinHalf = Math.sin(clampedHalf);
    // Extract axis direction from existing vector part
    const axisLen = Math.sqrt(
      twistQuat.x * twistQuat.x +
      twistQuat.y * twistQuat.y +
      twistQuat.z * twistQuat.z,
    );
    if (axisLen > 1e-6) {
      const scale = sinHalf / axisLen;
      twistQuat.x *= scale;
      twistQuat.y *= scale;
      twistQuat.z *= scale;
      twistQuat.w = Math.cos(clampedHalf);
    }
  }
}

/**
 * Slerp a quaternion toward identity by a factor (1 = full, 0 = identity).
 * Used to take a "fraction" of a rotation.
 */
function slerpFraction(q: THREE.Quaternion, fraction: number, out: THREE.Quaternion): void {
  _identityQuat.identity();
  out.copy(_identityQuat).slerp(q, fraction);
}

// ── Main split function ──────────────────────────────────────────

/** The forearm twist axis: bone-local Y (bones point down along -Y) */
const _twistAxis = new THREE.Vector3(0, 1, 0);

/**
 * Split an orientation (palm + finger direction) into forearm twist + hand local rotation.
 *
 * Algorithm:
 *   1. Compute the full orientation quaternion
 *   2. Swing-twist decompose around the forearm's long axis (Y)
 *   3. Forearm gets FOREARM_TWIST_FRACTION (60%) of the twist, clamped to ±85°
 *   4. Hand gets the remaining twist + all swing
 *
 * @param palm    Palm direction code (UP, DOWN, FORWARD, BACK, LEFT, RIGHT)
 * @param fingers Finger direction code
 * @returns SplitOrientation with forearmTwist and fullOrient quaternions
 */
export function orientationToSplitQuats(
  palm: string,
  fingers: string,
): SplitOrientation {
  // 1. Full orientation delta
  const fullOrient = orientationToQuat(palm, fingers); // already returns a new Quaternion

  // 2. Extract the Y-twist component via swing-twist decomposition
  _fullQuat.copy(fullOrient);
  extractTwist(_fullQuat, _twistAxis, _twistQuat);

  // 3. Forearm absorbs a fraction of the Y-twist
  slerpFraction(_twistQuat, FOREARM_TWIST_FRACTION, _forearmPartial);

  // Clamp forearm twist to anatomical limits (±85°)
  clampTwistAngle(_forearmPartial, FOREARM_TWIST_MAX);

  const forearmTwist = _forearmPartial.clone();

  // 4. fullOrient is stored as-is — the hand compensation (counter-rotating
  //    for the parent forearm twist) is done at application time in animateArmIK:
  //    targetHand = inv(forearmTwist) * bindHand * fullOrient
  return { forearmTwist, fullOrient };
}

/**
 * Blend two SplitOrientations by slerping each component independently.
 */
export function blendSplitOrientations(
  from: SplitOrientation,
  to: SplitOrientation,
  t: number,
): SplitOrientation {
  return {
    forearmTwist: new THREE.Quaternion().copy(from.forearmTwist).slerp(to.forearmTwist, t),
    fullOrient: new THREE.Quaternion().copy(from.fullOrient).slerp(to.fullOrient, t),
  };
}

/**
 * Clamp a wrist rotation quaternion to anatomical limits.
 *
 * Decomposes the delta (from bind pose) into Euler XYZ:
 *   X = flexion(+)/extension(-) — clamped to [-70°, +80°]
 *   Z = ulnar(+)/radial(-) deviation — clamped to [-20°, +30°]
 *   Y = remaining pronation component — left unclamped (handled by forearm)
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
