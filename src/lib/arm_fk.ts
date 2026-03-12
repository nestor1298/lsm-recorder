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

// ── Auto-solve types ─────────────────────────────────────────────

/**
 * Request to auto-solve FK angles for a list of UB codes.
 * Processed inside AvatarModel useFrame which has access to bones.
 */
export interface AutoSolveRequest {
  codes: string[];
  /** Called when all codes are solved */
  onComplete: (results: CapturedPose[]) => void;
  /** Called each frame with current count of solved codes */
  onProgress?: (count: number) => void;
}

/**
 * Single coordinate descent pass.
 *
 * For each joint, sweeps its ROM range to find the angle that minimises
 * the distance between the hand centroid and a world-space target.
 * Runs multiple refinement passes (narrowing the search window).
 */
function coordinateDescentPass(
  applyAndMeasure: (angles: ArmJointAngles) => number,
  startAngles: ArmJointAngles,
  samples: number,
  iterations: number,
): { angles: ArmJointAngles; distance: number } {
  const angles = { ...startAngles };

  // Joints ordered by impact (shoulder/elbow first, wrist last)
  const JOINTS: (keyof ArmJointAngles)[] = [
    "shoulderSwing", "shoulderElev", "elbowFlex",
    "shoulderTwist", "clavShrug", "clavProtract",
    "forearmTwist", "wristFlex", "wristDeviation",
  ];

  for (let iter = 0; iter < iterations; iter++) {
    for (const joint of JOINTS) {
      const rom = ARM_ROM_LIMITS[joint];
      let bestVal = angles[joint];
      let bestDist = applyAndMeasure(angles);

      // First iteration: sweep full range. Later: narrow around current best.
      const fullRange = rom.max - rom.min;
      const range = iter === 0 ? fullRange : Math.max(8, fullRange / (iter * 2));
      const center = iter === 0 ? (rom.min + rom.max) / 2 : angles[joint];
      const lo = Math.max(rom.min, center - range / 2);
      const hi = Math.min(rom.max, center + range / 2);

      for (let s = 0; s <= samples; s++) {
        const val = Math.round(lo + (hi - lo) * (s / samples));
        angles[joint] = val;
        const dist = applyAndMeasure(angles);
        if (dist < bestDist) {
          bestDist = dist;
          bestVal = val;
        }
      }
      angles[joint] = bestVal;

      // Early exit if already very close
      if (bestDist < 0.015) break;
    }
  }

  const finalDist = applyAndMeasure(angles);
  return { angles, distance: finalDist };
}

/**
 * Multi-restart coordinate descent FK solver.
 *
 * Tries multiple strategic starting configurations and keeps the best
 * result. This avoids local minima that plague single-start solvers
 * when the arm needs to reach varied body locations.
 *
 * Starting configurations:
 *   - T-pose (all zeros)
 *   - Arm forward + elbow bent (reaching toward face/head)
 *   - Arm down + elbow bent (reaching toward torso)
 *   - Arm across chest (reaching contralateral side)
 *   - Arm raised high (reaching above head)
 *
 * @param applyAndMeasure Function that applies angles, updates matrices,
 *                        and returns the distance to the target.
 * @param startAngles     Optional starting angles (skips multi-restart)
 * @returns               Best angles found and the final distance
 */
export function solveFKCoordinateDescent(
  applyAndMeasure: (angles: ArmJointAngles) => number,
  startAngles?: ArmJointAngles,
): { angles: ArmJointAngles; distance: number } {
  // If explicit start given, run a single pass
  if (startAngles) {
    return coordinateDescentPass(applyAndMeasure, startAngles, 36, 6);
  }

  // Strategic starting configurations
  const STARTS: ArmJointAngles[] = [
    // 1. T-pose (default)
    defaultArmAngles(),
    // 2. Arm forward + elbow bent (reaching head/face)
    { ...defaultArmAngles(), shoulderSwing: 90, elbowFlex: 90, shoulderElev: 30 },
    // 3. Arm up high (reaching top of head)
    { ...defaultArmAngles(), shoulderSwing: 130, shoulderElev: 60, elbowFlex: 60 },
    // 4. Arm down alongside body, elbow bent (reaching torso/hip)
    { ...defaultArmAngles(), shoulderSwing: -30, shoulderElev: -40, elbowFlex: 90 },
    // 5. Arm across chest (reaching contralateral side)
    { ...defaultArmAngles(), shoulderSwing: 60, shoulderElev: -40, elbowFlex: 110, shoulderTwist: 45 },
    // 6. Arm forward + low (reaching abdomen/waist)
    { ...defaultArmAngles(), shoulderSwing: 40, shoulderElev: -30, elbowFlex: 120 },
  ];

  let bestResult = { angles: defaultArmAngles(), distance: Infinity };

  for (const start of STARTS) {
    const result = coordinateDescentPass(applyAndMeasure, start, 36, 7);
    if (result.distance < bestResult.distance) {
      bestResult = result;
    }
    // Early exit if we found a very good solution
    if (bestResult.distance < 0.02) break;
  }

  return bestResult;
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
 *   Clavicle:  XYZ — Y = protraction, Z = shrug (elevation)
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
  // Mixamo LeftShoulder bone extends horizontally (≈+X).
  // Local Z-axis ≈ forward → rotation around Z tilts the shoulder up/down (elevation).
  // Local Y-axis ≈ up     → rotation around Y swings it forward/back (protraction).
  _clavEuler.set(
    0,
    angles.clavProtract * DEG * sign,   // Y = protraction (forward/back)
    angles.clavShrug * DEG * sign,      // Z = elevation/depression (up/down)
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

  // ── Forearm: X = elbow flex (negated for Mixamo), Y = pronation/supination ──
  _forearmEuler.set(
    -angles.elbowFlex * DEG,
    -angles.forearmTwist * DEG * sign,
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
