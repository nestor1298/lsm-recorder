/**
 * arm_ik.ts — Anatomically-constrained arm IK solver
 *
 * 4-stage pipeline:
 *   Stage 1: Clavicle pre-rotation (subtle shrug / protraction)
 *   Stage 2: Shoulder aiming (aim + twist correction + anatomical clamp)
 *   Stage 3: Elbow bend (hinge-only, 0–150°)
 *   Stage 4: Wrist orientation (handled in AvatarModel)
 *
 * Uses law of cosines for joint angles, adaptive pole target for natural
 * elbow direction, and anatomical limits on all joints.
 */

import * as THREE from "three";

// ── Constants ───────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;

// Clinical ROM limits (ref: WikEM Range of Motion by Joint)
const MAX_ELBOW_FLEX = 140 * DEG2RAD;  // elbow flexion (clinical: 140°)

// Shoulder anatomical limits (Euler YXZ decomposition)
// Note: Clinical max is 180° for flexion/abduction but this includes scapulothoracic
// contribution. Glenohumeral-only ROM is ~120°. We use 150° as a compromise to
// avoid gimbal lock instability in Euler decomposition near ±180° (causes joint flipping).
const SHOULDER_SWING_MIN = -50 * DEG2RAD;  // extension / backward (clinical: 50°)
const SHOULDER_SWING_MAX = 150 * DEG2RAD;  // flexion / forward (glenohumeral ~120°, capped for Euler stability)
const SHOULDER_ELEV_MIN = -50 * DEG2RAD;   // adduction below horizontal (clinical: 50°)
const SHOULDER_ELEV_MAX = 150 * DEG2RAD;   // abduction (glenohumeral ~120°, capped for Euler stability)
const SHOULDER_TWIST_MIN = -90 * DEG2RAD;  // internal rotation (clinical: 90°)
const SHOULDER_TWIST_MAX = 90 * DEG2RAD;   // external rotation (clinical: 90°)

// Clavicle ranges
const CLAV_SHRUG_MAX = 18 * DEG2RAD;
const CLAV_DEPRESS_MAX = -5 * DEG2RAD;
const CLAV_PROTRACT_MAX = 12 * DEG2RAD;

// ── Types ────────────────────────────────────────────────────────

export interface ArmLengths {
  upperArm: number;
  foreArm: number;
}

export interface NaturalIKResult {
  clavicleQuat: THREE.Quaternion;
  upperArmQuat: THREE.Quaternion;
  foreArmQuat: THREE.Quaternion;
}

// ── Reusable temp objects (module-scope, avoid per-frame allocs) ──

const _reachDir = new THREE.Vector3();
const _localDir = new THREE.Vector3();
const _bindDir = new THREE.Vector3();
const _aimQuat = new THREE.Quaternion();
const _twistQuat = new THREE.Quaternion();
const _currentPole = new THREE.Vector3();
const _desiredPole = new THREE.Vector3();
const _projCurrent = new THREE.Vector3();
const _projDesired = new THREE.Vector3();
const _parentWorldQuat = new THREE.Quaternion();
const _clavWorldPos = new THREE.Vector3();
const _shoulderWorldPos = new THREE.Vector3();
const _clavDeltaEuler = new THREE.Euler();
const _clavDeltaQuat = new THREE.Quaternion();
const _elbowEuler = new THREE.Euler();
const _elbowDelta = new THREE.Quaternion();
const _clampEuler = new THREE.Euler();
const _clampDelta = new THREE.Quaternion();
const _crossTmp = new THREE.Vector3();
const _posA = new THREE.Vector3();
const _posB = new THREE.Vector3();
const _shoulderLocalOffset = new THREE.Vector3();
const _clavParentWorldQ = new THREE.Quaternion();

// ── Measure arm lengths at init ────────────────────────────────

export function measureArmLengths(
  upperArmBone: THREE.Bone,
  foreArmBone: THREE.Bone,
  handBone: THREE.Bone,
): ArmLengths {
  upperArmBone.updateWorldMatrix(true, false);
  foreArmBone.updateWorldMatrix(true, false);
  handBone.updateWorldMatrix(true, false);

  upperArmBone.getWorldPosition(_posA);
  foreArmBone.getWorldPosition(_posB);
  const upperLen = _posA.distanceTo(_posB);

  foreArmBone.getWorldPosition(_posA);
  handBone.getWorldPosition(_posB);
  const foreLen = _posA.distanceTo(_posB);

  return { upperArm: upperLen, foreArm: foreLen };
}

// ── Utility ─────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

// ── Stage 1: Clavicle Pre-Rotation ──────────────────────────────

function computeClavicleRotation(
  targetWorldPos: THREE.Vector3,
  clavWorldPos: THREE.Vector3,
  bindClavicle: THREE.Quaternion,
  isLeftArm: boolean,
): THREE.Quaternion {
  const sign = isLeftArm ? 1 : -1;

  // Direction from clavicle to target
  _reachDir.copy(targetWorldPos).sub(clavWorldPos).normalize();

  // Elevation: how high the target is
  const elevation = Math.asin(clamp(_reachDir.y, -1, 1));

  // Forward component
  const forwardness = Math.max(0, _reachDir.z);

  // Cross-body: target on opposite side of midline
  const crossBody = Math.max(0, -_reachDir.x * sign);

  // Elevation shrug: activates above 60°
  let shrug = 0;
  if (elevation > 60 * DEG2RAD) {
    const t = clamp((elevation - 60 * DEG2RAD) / (110 * DEG2RAD), 0, 1);
    shrug = smoothstep(t) * CLAV_SHRUG_MAX;
  } else if (elevation < -30 * DEG2RAD) {
    const t = clamp((-elevation - 30 * DEG2RAD) / (60 * DEG2RAD), 0, 1);
    shrug = -smoothstep(t) * (-CLAV_DEPRESS_MAX);
  }

  // Protraction: forward and cross-body reach
  const protractionFactor = clamp(forwardness * 0.8 + crossBody * 1.2, 0, 1);
  const protract = smoothstep(protractionFactor) * CLAV_PROTRACT_MAX;

  // Build delta (small rotations on Y and Z)
  _clavDeltaEuler.set(
    0,
    shrug * sign,
    protract * sign,
    "XYZ",
  );
  _clavDeltaQuat.setFromEuler(_clavDeltaEuler);

  return bindClavicle.clone().multiply(_clavDeltaQuat);
}

// ── Stage 2 helper: Adaptive Pole Target ─────────────────────────

function computeAdaptivePole(
  targetWorldPos: THREE.Vector3,
  shoulderWorldPos: THREE.Vector3,
  isLeftArm: boolean,
  out: THREE.Vector3,
): void {
  _reachDir.copy(targetWorldPos).sub(shoulderWorldPos).normalize();
  const sign = isLeftArm ? 1 : -1;

  const elevation = Math.asin(clamp(_reachDir.y, -1, 1));
  const forward = _reachDir.z;
  const lateral = _reachDir.x * sign; // positive = away from body center

  if (elevation > 1.22) {
    // Nearly overhead (>70°): elbow drops down, slightly forward
    out.set(sign * 0.15, -0.95, 0.25);
  } else if (elevation > 0.52) {
    // High reach (30–70°): smooth blend from back→down
    const t = smoothstep((elevation - 0.52) / 0.70);
    out.set(
      sign * lerp(0.35, 0.15, t),
      lerp(-0.55, -0.95, t),
      lerp(-0.45, 0.25, t),
    );
  } else if (elevation < -0.35) {
    // Reaching down: elbow goes up and back
    out.set(sign * 0.25, 0.65, -0.55);
  } else if (lateral < -0.4) {
    // Reaching across body: elbow flares outward
    out.set(sign * 0.85, -0.35, -0.25);
  } else if (forward > 0.6) {
    // Reaching forward: elbow back and out
    out.set(sign * 0.45, -0.45, -0.75);
  } else {
    // Default neutral: elbow back, down, slightly out
    out.set(sign * 0.30, -0.70, -0.40);
  }

  out.normalize();
}

// ── Stage 2 helper: Anatomical shoulder clamp ────────────────────

function clampShoulderRotation(
  quat: THREE.Quaternion,
  bindQuat: THREE.Quaternion,
  isLeftArm: boolean,
): void {
  // Extract delta from bind
  _clampDelta.copy(quat).multiply(bindQuat.clone().invert());

  // Decompose into YXZ Euler (swing-elevation-twist)
  _clampEuler.setFromQuaternion(_clampDelta, "YXZ");

  const sign = isLeftArm ? 1 : -1;

  // Clamp elevation (X)
  _clampEuler.x = clamp(_clampEuler.x, SHOULDER_ELEV_MIN, SHOULDER_ELEV_MAX);

  // Clamp horizontal swing (Y) — sign-dependent for left vs right
  const yNorm = _clampEuler.y * sign;
  _clampEuler.y = clamp(yNorm, SHOULDER_SWING_MIN, SHOULDER_SWING_MAX) * sign;

  // Clamp axial twist (Z)
  const zNorm = _clampEuler.z * sign;
  _clampEuler.z = clamp(zNorm, SHOULDER_TWIST_MIN, SHOULDER_TWIST_MAX) * sign;

  // Reconstruct
  _clampDelta.setFromEuler(_clampEuler);
  quat.copy(_clampDelta).multiply(bindQuat);
}

// ── Main solver: solveArmIKNatural ───────────────────────────────

/**
 * Anatomically-constrained arm IK solver.
 *
 * 4-stage pipeline: clavicle → shoulder → elbow → (wrist handled externally)
 *
 * @param targetWorldPos   World position to reach (UB target)
 * @param lengths          Arm segment lengths
 * @param clavicleBone     LeftShoulder / RightShoulder bone
 * @param upperArmBone     LeftArm / RightArm bone
 * @param foreArmBone      LeftForeArm / RightForeArm bone
 * @param bindClavicle     Bind-pose quaternion for clavicle
 * @param bindUpperArm     Bind-pose quaternion for upper arm
 * @param bindForeArm      Bind-pose quaternion for forearm
 * @param isLeftArm        true for left arm, false for right
 */
export function solveArmIKNatural(
  targetWorldPos: THREE.Vector3,
  lengths: ArmLengths,
  clavicleBone: THREE.Bone,
  upperArmBone: THREE.Bone,
  foreArmBone: THREE.Bone,
  bindClavicle: THREE.Quaternion,
  bindUpperArm: THREE.Quaternion,
  bindForeArm: THREE.Quaternion,
  isLeftArm: boolean,
): NaturalIKResult {
  const { upperArm: a, foreArm: b } = lengths;
  const totalReach = a + b;

  // ── STAGE 1: Clavicle ──────────────────────────────────────────

  // Get clavicle world position (from its parent — doesn't change with clavicle rotation)
  clavicleBone.updateWorldMatrix(true, false);
  clavicleBone.getWorldPosition(_clavWorldPos);

  const clavicleQuat = computeClavicleRotation(
    targetWorldPos, _clavWorldPos, bindClavicle, isLeftArm,
  );

  // Compute shifted shoulder world position after clavicle rotation
  // (mathematically, without mutating the bone)
  _shoulderLocalOffset.copy(upperArmBone.position); // bone-local offset from parent

  // Get clavicle's parent world quaternion
  if (clavicleBone.parent) {
    clavicleBone.parent.getWorldQuaternion(_clavParentWorldQ);
  } else {
    _clavParentWorldQ.identity();
  }

  // New shoulder world pos = clavWorldPos + rotate(localOffset, clavQuat * parentQ)
  _shoulderWorldPos.copy(_shoulderLocalOffset)
    .applyQuaternion(clavicleQuat)
    .applyQuaternion(_clavParentWorldQ)
    .add(_clavWorldPos);

  // ── STAGE 2: Shoulder (Upper Arm) ──────────────────────────────

  // Direction and distance from shoulder to target
  _reachDir.copy(targetWorldPos).sub(_shoulderWorldPos);
  let d = _reachDir.length();

  // Clamp to reachable range
  const minReach = Math.abs(a - b) + 0.01;
  d = clamp(d, minReach, totalReach * 0.98);

  // Law of cosines → elbow angle
  const cosBeta = (a * a + b * b - d * d) / (2 * a * b);
  const beta = Math.acos(clamp(cosBeta, -1, 1));

  // Target direction in upper arm's parent-local space
  _reachDir.normalize();
  _localDir.copy(_reachDir);

  // The upper arm's parent is now effectively the clavicle with its new rotation.
  // Compute the effective parent world quaternion: clavParentWorldQ * clavicleQuat
  _parentWorldQuat.copy(_clavParentWorldQ).multiply(clavicleQuat);
  _localDir.applyQuaternion(_parentWorldQuat.clone().invert());

  // Bind direction: where -Y points in bind pose (bone "down" axis)
  _bindDir.set(0, -1, 0).applyQuaternion(bindUpperArm);

  // Step A: Shortest-arc aim rotation
  _aimQuat.setFromUnitVectors(_bindDir, _localDir);

  // Step B: Twist correction using adaptive pole target
  computeAdaptivePole(targetWorldPos, _shoulderWorldPos, isLeftArm, _desiredPole);
  // Transform pole to parent-local space
  _desiredPole.applyQuaternion(_parentWorldQuat.clone().invert());

  // Current elbow direction: bone's local Z rotated by (aim * bind)
  _currentPole.set(0, 0, 1)
    .applyQuaternion(bindUpperArm)
    .applyQuaternion(_aimQuat);

  // Project both onto the plane perpendicular to localDir
  const dotCurrent = _currentPole.dot(_localDir);
  _projCurrent.copy(_currentPole).addScaledVector(_localDir, -dotCurrent);

  const dotDesired = _desiredPole.dot(_localDir);
  _projDesired.copy(_desiredPole).addScaledVector(_localDir, -dotDesired);

  if (_projCurrent.lengthSq() > 0.0001 && _projDesired.lengthSq() > 0.0001) {
    _projCurrent.normalize();
    _projDesired.normalize();

    // Signed angle from current to desired around localDir
    let twistAngle = Math.acos(clamp(_projCurrent.dot(_projDesired), -1, 1));

    // Sign via cross product
    _crossTmp.crossVectors(_projCurrent, _projDesired);
    if (_crossTmp.dot(_localDir) < 0) twistAngle = -twistAngle;

    // Apply twist on top of aim
    _twistQuat.setFromAxisAngle(_localDir, twistAngle);
    _aimQuat.premultiply(_twistQuat);
  }

  // Compose: aim × bind
  const upperArmQuat = _aimQuat.clone().multiply(bindUpperArm.clone());

  // Step C: Anatomical clamp
  clampShoulderRotation(upperArmQuat, bindUpperArm, isLeftArm);

  // ── STAGE 3: Elbow (Hinge Joint) ──────────────────────────────

  // Only X-axis rotation, clamped to [0, 150°]
  const elbowBend = clamp(Math.PI - beta, 0, MAX_ELBOW_FLEX);
  _elbowEuler.set(elbowBend, 0, 0, "XYZ");
  _elbowDelta.setFromEuler(_elbowEuler);
  const foreArmQuat = bindForeArm.clone().multiply(_elbowDelta);

  return { clavicleQuat, upperArmQuat, foreArmQuat };
}

// ── Forearm twist composition ────────────────────────────────────

const _twistResult = new THREE.Quaternion();

/**
 * Compose an axial pronation/supination twist onto the IK-solved forearm quaternion.
 *
 * The IK solver produces foreArmQuat = bindForeArm * elbowDelta (pure X-rotation).
 * We add the orientation Y-twist on the right side (in bone-local space, after
 * the elbow bend): result = foreArmQuat * twistQuat.
 *
 * This works because the twist is a pure Y-rotation extracted along the bone's
 * long axis, and multiplying on the right applies it in the bone's local frame
 * (i.e., pronation/supination happens around the forearm's own long axis,
 * regardless of elbow bend angle).
 *
 * @param foreArmQuat    IK-solved forearm quaternion (bind + elbow bend)
 * @param twistQuat      Axial Y-twist from SplitOrientation.forearmTwist
 * @returns New forearm quaternion with twist composed
 */
export function composeForearmTwist(
  foreArmQuat: THREE.Quaternion,
  twistQuat: THREE.Quaternion,
): THREE.Quaternion {
  _twistResult.copy(foreArmQuat).multiply(twistQuat);
  return _twistResult.clone();
}

// ── Shoulder twist for orientation support ───────────────────────

const _shoulderTwistEuler = new THREE.Euler();
const _shoulderTwistDelta = new THREE.Quaternion();
const _shoulderTwistResult = new THREE.Quaternion();

/**
 * Add an orientation-driven axial twist to the IK-solved upper arm quaternion.
 *
 * The IK solver positions the arm without considering hand orientation.
 * When the target orientation requires more axial rotation than the forearm
 * can provide (±80°), the shoulder contributes internal/external rotation.
 *
 * This decomposes the IK-solved shoulder into YXZ Euler, adds the twist
 * to the Z component (axial twist), re-clamps, and reconstructs.
 *
 * @param upperArmQuat  IK-solved upper arm quaternion (modified in place)
 * @param bindUpperArm  Bind-pose quaternion for the upper arm
 * @param twistAngle    Additional twist in radians (+ = internal, - = external)
 * @param isLeftArm     true for left arm
 */
export function composeShoulderTwist(
  upperArmQuat: THREE.Quaternion,
  bindUpperArm: THREE.Quaternion,
  twistAngleRad: number,
  isLeftArm: boolean,
): THREE.Quaternion {
  if (Math.abs(twistAngleRad) < 0.001) {
    return upperArmQuat.clone();
  }

  // Extract delta from bind pose
  _shoulderTwistDelta.copy(upperArmQuat).multiply(bindUpperArm.clone().invert());
  _shoulderTwistEuler.setFromQuaternion(_shoulderTwistDelta, "YXZ");

  const sign = isLeftArm ? 1 : -1;

  // Add orientation-driven twist to Z component
  _shoulderTwistEuler.z += twistAngleRad * sign;

  // Re-clamp to shoulder ROM limits
  const zNorm = _shoulderTwistEuler.z * sign;
  _shoulderTwistEuler.z = clamp(zNorm, SHOULDER_TWIST_MIN, SHOULDER_TWIST_MAX) * sign;

  // Reconstruct
  _shoulderTwistDelta.setFromEuler(_shoulderTwistEuler);
  _shoulderTwistResult.copy(_shoulderTwistDelta).multiply(bindUpperArm);
  return _shoulderTwistResult.clone();
}
