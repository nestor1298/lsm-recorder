/**
 * arm_fk.ts — Forward Kinematics for manual arm joint control
 *
 * Instead of computing joint angles from a target position (IK),
 * this module applies user-specified angles directly to each bone
 * in the arm chain. Each joint uses the same Euler convention as
 * the existing IK solver (arm_ik.ts) for consistency.
 *
 * Clinical ROM limits from WikEM Range of Motion by Joint.
 */

import * as THREE from "three";

// ── Types ────────────────────────────────────────────────────────

/**
 * Manual joint angles for the entire arm chain (9 DOF).
 * All values in degrees. Zero = bind pose.
 */
export interface ArmJointAngles {
  // Clavicle (2 DOF)
  clavShrug: number;       // -5 to 18° (depression / elevation)
  clavProtract: number;    // 0 to 12° (protraction)

  // Shoulder (3 DOF — YXZ Euler matching clampShoulderRotation)
  shoulderSwing: number;   // -50 to 150° (extension / flexion, Y-axis)
  shoulderElev: number;    // -50 to 150° (adduction / abduction, X-axis)
  shoulderTwist: number;   // -90 to 90° (internal / external rotation, Z-axis)

  // Elbow + Forearm (2 DOF on ForeArm bone)
  elbowFlex: number;       // 0 to 140° (flexion, X-axis hinge)
  forearmTwist: number;    // -80 to 80° (supination / pronation, Y-axis)

  // Wrist (2 DOF on Hand bone)
  wristFlex: number;       // -60 to 60° (extension / flexion, X-axis)
  wristDeviation: number;  // -20 to 30° (radial / ulnar deviation, Z-axis)
}

/**
 * ROM limits and UI metadata for each joint angle.
 */
export interface ROMLimit {
  min: number;
  max: number;
  label: string;
  group: string;
}

export const ARM_ROM_LIMITS: Record<keyof ArmJointAngles, ROMLimit> = {
  clavShrug:      { min: -5,  max: 18,  label: "Elevación / Depresión",  group: "Clavícula" },
  clavProtract:   { min: 0,   max: 12,  label: "Protracción",            group: "Clavícula" },
  shoulderSwing:  { min: -50, max: 150, label: "Flexión / Extensión",    group: "Hombro" },
  shoulderElev:   { min: -50, max: 150, label: "Abducción / Aducción",   group: "Hombro" },
  shoulderTwist:  { min: -90, max: 90,  label: "Rot. Interna / Externa", group: "Hombro" },
  elbowFlex:      { min: 0,   max: 140, label: "Flexión",                group: "Codo" },
  forearmTwist:   { min: -80, max: 80,  label: "Supinación / Pronación", group: "Antebrazo" },
  wristFlex:      { min: -60, max: 60,  label: "Extensión / Flexión",    group: "Muñeca" },
  wristDeviation: { min: -20, max: 30,  label: "Desv. Radial / Ulnar",  group: "Muñeca" },
};

/**
 * Ordered list of joint keys for consistent iteration in the UI.
 */
export const ARM_JOINT_ORDER: (keyof ArmJointAngles)[] = [
  "clavShrug", "clavProtract",
  "shoulderSwing", "shoulderElev", "shoulderTwist",
  "elbowFlex",
  "forearmTwist",
  "wristFlex", "wristDeviation",
];

/**
 * Returns all angles at zero (bind pose).
 */
export function defaultArmAngles(): ArmJointAngles {
  return {
    clavShrug: 0,
    clavProtract: 0,
    shoulderSwing: 0,
    shoulderElev: 0,
    shoulderTwist: 0,
    elbowFlex: 0,
    forearmTwist: 0,
    wristFlex: 0,
    wristDeviation: 0,
  };
}

// ── FK State (shared via ref, read by UI outside Canvas) ────────

/**
 * Real-time state written by AvatarModel each frame when in FK mode.
 * Plain arrays instead of THREE objects so it can cross the Canvas boundary.
 */
export interface ArmFKState {
  centroidWorldPos: [number, number, number];
  ubWorldPos: [number, number, number] | null;
  distanceToUB: number;
  reached: boolean;
  handWorldQuat: [number, number, number, number]; // x, y, z, w
}

/**
 * A captured pose snapshot taken when the hand centroid reaches the UB target.
 */
export interface CapturedPose {
  ubCode: string;
  angles: ArmJointAngles;
  handWorldQuat: [number, number, number, number];
  distanceToUB: number;
  timestamp: number;
}

// ── Reusable temp objects ────────────────────────────────────────

const _clavEuler = new THREE.Euler();
const _clavDelta = new THREE.Quaternion();
const _shoulderEuler = new THREE.Euler();
const _shoulderDelta = new THREE.Quaternion();
const _forearmEuler = new THREE.Euler();
const _forearmDelta = new THREE.Quaternion();
const _wristEuler = new THREE.Euler();
const _wristDelta = new THREE.Quaternion();

const DEG = Math.PI / 180;

// ── Forward Kinematics ──────────────────────────────────────────

/**
 * Apply manual joint angles to the arm bone chain.
 *
 * Each joint's rotation is a delta applied on top of the bind-pose
 * quaternion, using the same Euler conventions as the IK solver:
 *
 *   Clavicle:  XYZ — Y = shrug, Z = protraction
 *   Shoulder:  YXZ — Y = swing, X = elevation, Z = twist
 *   Forearm:   XYZ — X = elbow flex, Y = pronation/supination
 *   Wrist:     XYZ — X = flexion, Z = deviation
 *
 * @param angles    Joint angles in degrees (0 = bind pose)
 * @param refs      Live bone references
 * @param bind      Bind-pose quaternion snapshots
 * @param isLeftArm true for left arm
 */
export function applyArmFK(
  angles: ArmJointAngles,
  refs: {
    clavicle: THREE.Bone;
    upperArm: THREE.Bone;
    foreArm: THREE.Bone;
    hand: THREE.Bone;
  },
  bind: {
    clavicle: THREE.Quaternion;
    upperArm: THREE.Quaternion;
    foreArm: THREE.Quaternion;
    hand: THREE.Quaternion;
  },
  isLeftArm: boolean,
): void {
  const sign = isLeftArm ? 1 : -1;

  // ── Clavicle: XYZ delta ──
  _clavEuler.set(
    0,
    angles.clavShrug * DEG * sign,
    angles.clavProtract * DEG * sign,
    "XYZ",
  );
  _clavDelta.setFromEuler(_clavEuler);
  refs.clavicle.quaternion.copy(bind.clavicle).multiply(_clavDelta);

  // ── Shoulder: YXZ delta ──
  _shoulderEuler.set(
    angles.shoulderElev * DEG,           // X: elevation / abduction
    angles.shoulderSwing * DEG * sign,   // Y: swing / flexion
    angles.shoulderTwist * DEG * sign,   // Z: axial twist
    "YXZ",
  );
  _shoulderDelta.setFromEuler(_shoulderEuler);
  refs.upperArm.quaternion.copy(bind.upperArm).multiply(_shoulderDelta);

  // ── Forearm: X = elbow flex, Y = pronation/supination ──
  _forearmEuler.set(
    angles.elbowFlex * DEG,
    angles.forearmTwist * DEG,
    0,
    "XYZ",
  );
  _forearmDelta.setFromEuler(_forearmEuler);
  refs.foreArm.quaternion.copy(bind.foreArm).multiply(_forearmDelta);

  // ── Wrist: X = flex/ext, Z = radial/ulnar deviation ──
  _wristEuler.set(
    angles.wristFlex * DEG,
    0,
    angles.wristDeviation * DEG,
    "XYZ",
  );
  _wristDelta.setFromEuler(_wristEuler);
  refs.hand.quaternion.copy(bind.hand).multiply(_wristDelta);
}
