/**
 * orientation.ts — Shared orientation → quaternion logic
 *
 * Extracted from RiggedHand.tsx so both RiggedHand (explore mode)
 * and AvatarModel (build mode) can use the same rotation math.
 */

import * as THREE from "three";

const DEG = Math.PI / 180;

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

// Reusable temp objects (module-level, not per-frame allocated)
const _palmEuler = new THREE.Euler();
const _palmQuat = new THREE.Quaternion();
const _fingerQuat = new THREE.Quaternion();
const _fingerEuler = new THREE.Euler();

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
