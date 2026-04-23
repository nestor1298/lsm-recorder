"use client";

import { useRef, useMemo, useCallback, useState } from "react";
import { useFrame, useLoader, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneWithSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { UB_LOCATIONS, REGION_COLORS } from "@/lib/ub_inventory";
import { UB_BONE_MAP } from "@/lib/ub_bone_map";
import type { CMEntry } from "@/lib/types";
import {
  cmEntryToHandPose,
  RESTING_POSE,
  type HandPose,
  type FingerPose,
  type ThumbPose,
  type FingerName,
} from "@/lib/hand_pose";
import {
  orientationToSplitQuats,
  blendSplitOrientations,
  clampWristRotation,
  type SplitOrientation,
} from "@/lib/orientation";
import {
  AVATAR_FINGER_BONES,
  AVATAR_THUMB_BONES,
  ARM_CHAINS,
  mirrorBoneName,
  mirrorUBOffset,
  mirrorOrientation,
  getRightFingerBones,
  AVATAR_RIGHT_THUMB_BONES,
} from "@/lib/avatar_hand_bones";
import { measureArmLengths, solveArmIKNatural, composeForearmTwist, composeShoulderTwist, type ArmLengths } from "@/lib/arm_ik";
import { applyArmFK, solveFKCoordinateDescent, type ArmJointAngles, type ArmFKState, type AutoSolveRequest, type CapturedPose } from "@/lib/arm_fk";
import { UB_FK_PRESETS } from "@/lib/ub_fk_presets";
import { interpolateMovementPosition } from "@/lib/sign_playback";

const AVATAR_PATH = "/models/lexsi.glb";

// ── Types ────────────────────────────────────────────────────────

// ── Movement interpolation data (passed during M segments) ──────

export interface MovementInterpolation {
  /** Smooth-stepped interpolation factor 0..1 */
  t: number;
  /** UB code of the "from" hold */
  fromUBCode: string | null;
  /** UB code of the "to" hold */
  toUBCode: string | null;
  /** CM entry of the "from" hold */
  fromCM: CMEntry | null;
  /** CM entry of the "to" hold */
  toCM: CMEntry | null;
  /** Orientation of the "from" hold */
  fromOrientation: { palm: string; fingers: string };
  /** Orientation of the "to" hold */
  toOrientation: { palm: string; fingers: string };
  /** Movement contour: STRAIGHT, ARC, CIRCLE, ZIGZAG, SEVEN */
  contour: string;
  /** Movement plane: VERTICAL, HORIZONTAL, SAGITTAL, OBLIQUE */
  plane: string;
  /** Local movement: WIGGLE, TWIST, etc. */
  local: string | null;
  /** Hand mode during this movement */
  handMode: "dominant" | "both_symmetric";
}

export interface UBTarget {
  code: string;
  region: string;
  name: string;
  /** SVG coordinates from the 200×280 body diagram */
  x: number;
  y: number;
}

export interface RNMTarget {
  eyebrows: "NEUTRAL" | "RAISED" | "FURROWED";
  mouth: "NEUTRAL" | "OPEN" | "CLOSED" | "ROUNDED" | "STRETCHED";
  head: "NONE" | "NOD" | "SHAKE" | "TILT_LEFT" | "TILT_RIGHT" | "TILT_BACK" | "TILT_DOWN";
}

interface AvatarModelProps {
  ubLocation?: UBTarget | null;
  rnm?: RNMTarget | null;
  autoRotate?: boolean;
  /** Show all 80 UB points as interactive spheres */
  showAllUBPoints?: boolean;
  /** Selected UB code for point cloud highlighting (separate from IK target) */
  selectedUBCode?: string | null;
  /** Filter spheres by region */
  ubRegionFilter?: string | null;
  /** Callback when a UB sphere is clicked */
  onUBClick?: (code: string) => void;
  /** Current CM entry for dominant hand finger posing */
  cm?: CMEntry | null;
  /** Orientation for wrist rotation */
  orientation?: { palm: string; fingers: string };
  /** Hand mode: dominant only or both symmetric */
  handMode?: "dominant" | "both_symmetric";
  /** Movement interpolation data (during M segment playback) */
  movementInterp?: MovementInterpolation | null;
  /** Manual FK joint angles — when provided, bypasses IK for left arm */
  armAngles?: ArmJointAngles | null;
  /** Shared ref for FK state reporting (centroid pos, UB distance, etc.) */
  armFKStateRef?: React.MutableRefObject<ArmFKState | null>;
  /** Auto-solve request: solve FK for a batch of UB codes */
  autoSolveRequest?: AutoSolveRequest | null;
}

// ── Bone lookup helpers ─────────────────────────────────────────

function buildBoneMap(root: THREE.Object3D): Map<string, THREE.Bone> {
  const map = new Map<string, THREE.Bone>();
  root.traverse((child) => {
    if ((child as THREE.Bone).isBone) {
      // Store both the original name and a stripped name (without "mixamorig:" prefix)
      // so that our Mixamo bone constants (e.g. "LeftArm") work with any FBX variant
      map.set(child.name, child as THREE.Bone);
      const stripped = child.name.replace(/^mixamorig:/, "");
      if (stripped !== child.name) {
        map.set(stripped, child as THREE.Bone);
      }
    }
  });
  return map;
}

// ── Compute UB world position from bone ──────────────────────────

const _boneWorldPos = new THREE.Vector3();
const _offsetVec = new THREE.Vector3();
const _boneWorldScale = new THREE.Vector3();

function computeUBWorldPosition(
  code: string,
  boneMap: Map<string, THREE.Bone>,
): THREE.Vector3 | null {
  const anchor = UB_BONE_MAP[code];
  if (!anchor) return null;
  const bone = boneMap.get(anchor.boneName);
  if (!bone) return null;

  bone.updateWorldMatrix(true, false);
  bone.getWorldPosition(_boneWorldPos);

  // Offsets are in model space but bone positions are in scene-scaled
  // world space (the scene is auto-scaled by 2.5/maxDim). Multiply
  // the offset by the bone's world scale so it matches.
  bone.getWorldScale(_boneWorldScale);
  _offsetVec.set(
    anchor.offset[0] * _boneWorldScale.x,
    anchor.offset[1] * _boneWorldScale.y,
    anchor.offset[2] * _boneWorldScale.z,
  );
  return _boneWorldPos.clone().add(_offsetVec);
}

const _surfaceOffsetDir = new THREE.Vector3();

/**
 * Compute UB world position with an outward surface offset.
 *
 * The hand centroid (average of all finger bones) sits at the palm center.
 * When the centroid reaches the UB surface point, the fingers extend
 * through the mesh. This function pushes the target point outward along
 * the approximate surface normal so the hand touches without penetrating.
 *
 * For Head-anchored points the bone→UB vector has a large vertical (Y)
 * component (because face points sit above the Head bone origin), but the
 * actual face surface normal is mostly in the XZ plane. We dampen Y by
 * 0.3× so the offset pushes the target primarily *forward* from the face
 * rather than *upward*.
 *
 * @param surfaceOffset Distance in world units to push outward (e.g. 0.08 = 8cm)
 */
function computeUBWorldPositionWithSurfaceOffset(
  code: string,
  boneMap: Map<string, THREE.Bone>,
  surfaceOffset: number,
): THREE.Vector3 | null {
  const anchor = UB_BONE_MAP[code];
  if (!anchor) return null;
  const bone = boneMap.get(anchor.boneName);
  if (!bone) return null;

  bone.updateWorldMatrix(true, false);
  bone.getWorldPosition(_boneWorldPos);

  // Scale offset by scene scale (auto-scaled by 2.5/maxDim)
  bone.getWorldScale(_boneWorldScale);
  _offsetVec.set(
    anchor.offset[0] * _boneWorldScale.x,
    anchor.offset[1] * _boneWorldScale.y,
    anchor.offset[2] * _boneWorldScale.z,
  );
  const ubPos = _boneWorldPos.clone().add(_offsetVec);

  // Compute approximate outward direction
  const offsetLen = _offsetVec.length();
  if (offsetLen > 0.001) {
    _surfaceOffsetDir.copy(_offsetVec);

    if (anchor.boneName === "Head") {
      _surfaceOffsetDir.y *= 0.3;
      if (_surfaceOffsetDir.lengthSq() < 0.001) {
        _surfaceOffsetDir.set(0, 1, 0);
      }
    }

    _surfaceOffsetDir.normalize();
    // Surface offset also needs to be in world-scaled space
    ubPos.addScaledVector(_surfaceOffsetDir, surfaceOffset * _boneWorldScale.x);
  }

  return ubPos;
}

/**
 * Compute a UB world position with a mirrored offset (for right-hand targets).
 */
function computeUBWorldPositionMirrored(
  code: string,
  boneMap: Map<string, THREE.Bone>,
): THREE.Vector3 | null {
  const anchor = UB_BONE_MAP[code];
  if (!anchor) return null;

  // Mirror the bone name (Left↔Right) and the X offset
  const mirroredBone = mirrorBoneName(anchor.boneName);
  const bone = boneMap.get(mirroredBone) ?? boneMap.get(anchor.boneName);
  if (!bone) return null;

  bone.updateWorldMatrix(true, false);
  bone.getWorldPosition(_boneWorldPos);

  // Scale offset by scene scale
  bone.getWorldScale(_boneWorldScale);
  const mirrored = mirrorUBOffset(anchor.offset);
  _offsetVec.set(
    mirrored[0] * _boneWorldScale.x,
    mirrored[1] * _boneWorldScale.y,
    mirrored[2] * _boneWorldScale.z,
  );
  return _boneWorldPos.clone().add(_offsetVec);
}

// ── UB Point — individual interactive sphere ─────────────────────

interface UBPointProps {
  code: string;
  region: string;
  isSelected: boolean;
  boneMap: Map<string, THREE.Bone>;
  onClick: (code: string) => void;
  /** If true, render this point mirrored on the opposite side (Left↔Right) */
  mirrored?: boolean;
}

function UBPoint({ code, region, isSelected, boneMap, onClick, mirrored = false }: UBPointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = REGION_COLORS[region] ?? "#ffffff";

  useFrame(() => {
    if (!meshRef.current) return;
    const pos = mirrored
      ? computeUBWorldPositionMirrored(code, boneMap)
      : computeUBWorldPosition(code, boneMap);
    if (!pos) return;

    meshRef.current.position.copy(pos);
    if (glowRef.current) glowRef.current.position.copy(pos);

    // Pulse animation for selected
    if (isSelected) {
      const t = Date.now() * 0.003;
      const scale = 1 + Math.sin(t) * 0.3;
      if (glowRef.current) glowRef.current.scale.setScalar(scale);
    }
  });

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onClick(code);
    },
    [code, onClick],
  );

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  const radius = isSelected ? 0.045 : hovered ? 0.038 : 0.028;
  const emissiveIntensity = isSelected ? 2.5 : hovered ? 1.8 : 1.2;

  return (
    <>
      {/* Glow ring for selected */}
      {isSelected && (
        <mesh ref={glowRef} renderOrder={0}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.25}
            emissive={color}
            emissiveIntensity={0.6}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      )}
      {/* Main sphere — rendered on top of avatar mesh */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        renderOrder={1}
      >
        <sphereGeometry args={[radius, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={isSelected ? 1 : hovered ? 0.9 : 0.7}
          depthTest={false}
        />
      </mesh>
    </>
  );
}

// ── UB Point Cloud — renders filtered UB locations ───────────────

interface UBPointCloudProps {
  boneMap: Map<string, THREE.Bone>;
  selectedCode: string | null;
  regionFilter: string | null;
  onMarkerClick: (code: string) => void;
}

// Regions that are on the left arm and should be mirrored to the right
const MIRRORED_REGIONS = new Set(["ARM", "FOREARM", "HAND"]);

function UBPointCloud({ boneMap, selectedCode, regionFilter, onMarkerClick }: UBPointCloudProps) {
  const filteredLocations = useMemo(() => {
    if (!regionFilter) return UB_LOCATIONS;
    return UB_LOCATIONS.filter((loc) => loc.region === regionFilter);
  }, [regionFilter]);

  return (
    <>
      {filteredLocations.map((loc) => (
        <UBPoint
          key={loc.code}
          code={loc.code}
          region={loc.region}
          isSelected={selectedCode === loc.code}
          boneMap={boneMap}
          onClick={onMarkerClick}
        />
      ))}
      {/* Mirror arm/forearm/hand points on the opposite side */}
      {filteredLocations
        .filter((loc) => MIRRORED_REGIONS.has(loc.region))
        .map((loc) => (
          <UBPoint
            key={`${loc.code}_R`}
            code={loc.code}
            region={loc.region}
            isSelected={selectedCode === loc.code}
            boneMap={boneMap}
            onClick={onMarkerClick}
            mirrored
          />
        ))}
    </>
  );
}

// ── Neutral arms-down pose helper ────────────────────────────────
// Slerps arm bones from bind (T-pose) toward a natural arms-down stance.
// Uses a small delta on upperArm to rotate the arm downward (≈ -75° on local Z).

const _neutralEuler = new THREE.Euler();
const _neutralDelta = new THREE.Quaternion();
const _neutralTarget = new THREE.Quaternion();

function poseArmDown(
  refs: { clavicle: THREE.Bone; upperArm: THREE.Bone; foreArm: THREE.Bone; hand: THREE.Bone },
  bind: { clavicle: THREE.Quaternion; upperArm: THREE.Quaternion; foreArm: THREE.Quaternion; hand: THREE.Quaternion },
  isLeftArm: boolean,
  factor: number,
) {
  const sign = isLeftArm ? 1 : -1;

  // Clavicle: slight depression (≈ -3°)
  _neutralEuler.set(0, 0, -3 * (Math.PI / 180) * sign, "XYZ");
  _neutralDelta.setFromEuler(_neutralEuler);
  _neutralTarget.copy(bind.clavicle).multiply(_neutralDelta);
  refs.clavicle.quaternion.slerp(_neutralTarget, factor * 3);

  // Upper arm: rotate down from T-pose using YXZ (Mixamo shoulder convention)
  // Positive X = adduction (arm DOWN from T-pose toward body)
  _neutralEuler.set(
    88 * (Math.PI / 180),             // X: adduction → bring arm down from T-pose
    5 * (Math.PI / 180) * sign,       // Y: slight forward swing
    0,                                // Z: no axial twist
    "YXZ",
  );
  _neutralDelta.setFromEuler(_neutralEuler);
  _neutralTarget.copy(bind.upperArm).multiply(_neutralDelta);
  refs.upperArm.quaternion.slerp(_neutralTarget, factor * 3);

  // Forearm: slight bend at elbow (≈ 8°)
  _neutralEuler.set(-8 * (Math.PI / 180), 0, 0, "XYZ");
  _neutralDelta.setFromEuler(_neutralEuler);
  _neutralTarget.copy(bind.foreArm).multiply(_neutralDelta);
  refs.foreArm.quaternion.slerp(_neutralTarget, factor * 3);

  // Hand: return to bind pose
  refs.hand.quaternion.slerp(bind.hand, factor * 3);
}

// ── Pose arm from FK preset (smooth slerp) ──────────────────────

const _fkEuler = new THREE.Euler();
const _fkDelta = new THREE.Quaternion();
const _fkTarget = new THREE.Quaternion();

/**
 * Smoothly blend the arm toward a pre-computed FK preset.
 * Works like poseArmDown but uses arbitrary ArmJointAngles.
 */
function poseArmPreset(
  angles: ArmJointAngles,
  refs: { clavicle: THREE.Bone; upperArm: THREE.Bone; foreArm: THREE.Bone; hand: THREE.Bone },
  bind: { clavicle: THREE.Quaternion; upperArm: THREE.Quaternion; foreArm: THREE.Quaternion; hand: THREE.Quaternion },
  isLeftArm: boolean,
  factor: number,
) {
  const DEG = Math.PI / 180;
  const sign = isLeftArm ? 1 : -1;
  const rate = factor * 3;               // smooth convergence rate (matches poseArmDown)

  // Clavicle: 2 DOF — (shrug around Z, protraction around Y)
  _fkEuler.set(
    0,
    angles.clavProtract * DEG * sign,
    angles.clavShrug * DEG * sign,
    "XYZ",
  );
  _fkDelta.setFromEuler(_fkEuler);
  _fkTarget.copy(bind.clavicle).multiply(_fkDelta);
  refs.clavicle.quaternion.slerp(_fkTarget, rate);

  // Upper Arm: 3 DOF — YXZ matching FK/IK shoulder convention
  _fkEuler.set(
    angles.shoulderElev * DEG,            // X: adduction/abduction
    angles.shoulderSwing * DEG * sign,    // Y: flexion/extension
    angles.shoulderTwist * DEG * sign,    // Z: int/ext rotation
    "YXZ",
  );
  _fkDelta.setFromEuler(_fkEuler);
  _fkTarget.copy(bind.upperArm).multiply(_fkDelta);
  refs.upperArm.quaternion.slerp(_fkTarget, rate);

  // Forearm: 2 DOF — (elbow flex on X, supination on Y)
  _fkEuler.set(
    -angles.elbowFlex * DEG,             // X: flexion (negative = bend)
    angles.forearmTwist * DEG * sign,     // Y: pro/supination
    0,
    "XYZ",
  );
  _fkDelta.setFromEuler(_fkEuler);
  _fkTarget.copy(bind.foreArm).multiply(_fkDelta);
  refs.foreArm.quaternion.slerp(_fkTarget, rate);

  // Hand: 2 DOF — (wrist flex on X, ulnar deviation on Z)
  _fkEuler.set(
    -angles.wristFlex * DEG,             // X: wrist flexion
    0,
    angles.wristDeviation * DEG * sign,  // Z: radial/ulnar
    "XYZ",
  );
  _fkDelta.setFromEuler(_fkEuler);
  _fkTarget.copy(bind.hand).multiply(_fkDelta);
  refs.hand.quaternion.slerp(_fkTarget, rate);
}

/**
 * Apply orientation (palm/finger direction) on top of FK-preset arm pose.
 *
 * poseArmPreset positions the arm to reach a UB point but does not
 * handle hand orientation. This function composes the orientation's
 * forearm twist and hand rotation onto the bones AFTER the preset
 * has been applied, using the same split-orientation system as IK.
 */
const _orientForearm = new THREE.Quaternion();
const _orientHand = new THREE.Quaternion();

function applyOrientationOverFK(
  orient: SplitOrientation,
  refs: { clavicle: THREE.Bone; upperArm: THREE.Bone; foreArm: THREE.Bone; hand: THREE.Bone },
  bind: { clavicle: THREE.Quaternion; upperArm: THREE.Quaternion; foreArm: THREE.Quaternion; hand: THREE.Quaternion },
  isLeftArm: boolean,
  factor: number,
) {
  const rate = factor * 3;

  // Compose forearm twist onto current forearm quaternion
  _orientForearm.copy(refs.foreArm.quaternion).multiply(orient.forearmTwist);
  refs.foreArm.quaternion.slerp(_orientForearm, rate);

  // Compose hand orientation: undo forearm twist propagation, apply full orient
  // targetHand = inv(forearmTwist) * bindHand * fullOrient
  _orientHand.copy(orient.forearmTwist).invert()
    .multiply(bind.hand)
    .multiply(orient.fullOrient);
  clampWristRotation(_orientHand, bind.hand);
  refs.hand.quaternion.slerp(_orientHand, rate);
}

// ── Temp animation variables ─────────────────────────────────────

const _headEuler = new THREE.Euler();
const _headQuat = new THREE.Quaternion();
const _neckEuler = new THREE.Euler();
const _neckQuat = new THREE.Quaternion();
const _poseEuler = new THREE.Euler();
const _poseDelta = new THREE.Quaternion();

// ── applyPose: rotation delta on top of bind pose ───────────────

function applyPose(
  bone: THREE.Bone,
  bindQuat: THREE.Quaternion,
  dx: number,
  dy: number,
  dz: number,
) {
  _poseEuler.set(dx, dy, dz, "XYZ");
  _poseDelta.setFromEuler(_poseEuler);
  bone.quaternion.copy(bindQuat).multiply(_poseDelta);
}

// ── Morph target index mapping ──────────────────────────────────

type MorphMap = Record<string, number>;

function buildMorphMap(mesh: THREE.Mesh): MorphMap {
  const dict = mesh.morphTargetDictionary;
  if (!dict) return {};
  return dict;
}

// ── RNM state → morph target weights ────────────────────────────

function rnmToMorphWeights(
  rnm: RNMTarget,
  morphMap: MorphMap,
): Record<number, number> {
  const w: Record<number, number> = {};

  function set(name: string, value: number) {
    if (name in morphMap) {
      w[morphMap[name]] = value;
    }
  }

  // ── Eyebrows ──
  switch (rnm.eyebrows) {
    case "RAISED":
      set("browInnerUpL", 0.9);
      set("browInnerUpR", 0.9);
      set("browOuterUpL", 0.7);
      set("browOuterUpR", 0.7);
      set("eyeWidenUpperL", 0.4);
      set("eyeWidenUpperR", 0.4);
      break;
    case "FURROWED":
      set("browInnerDnL", 0.8);
      set("browInnerDnR", 0.8);
      set("browSqueezeL", 0.7);
      set("browSqueezeR", 0.7);
      set("eyeSquintL", 0.3);
      set("eyeSquintR", 0.3);
      break;
  }

  // ── Mouth ──
  switch (rnm.mouth) {
    case "OPEN":
      set("jawOpen", 0.7);
      set("lipFunnelerLower", 0.2);
      break;
    case "CLOSED":
      set("lipCloseLower", 0.8);
      set("lipCloseUpper", 0.8);
      set("lipPresserL", 0.5);
      set("lipPresserR", 0.5);
      break;
    case "ROUNDED":
      set("lipPucker", 0.8);
      set("lipFunnelerLower", 0.6);
      set("lipFunnelerUpper", 0.5);
      set("jawOpen", 0.15);
      break;
    case "STRETCHED":
      set("lipWidenL", 0.7);
      set("lipWidenR", 0.7);
      set("lipSmileOpenL", 0.5);
      set("lipSmileOpenR", 0.5);
      set("lipCornerUpL", 0.4);
      set("lipCornerUpR", 0.4);
      set("cheekUpL", 0.3);
      set("cheekUpR", 0.3);
      break;
  }

  return w;
}

// ── Finger + Thumb animation state (mutable for useFrame) ────────

interface AnimState {
  index: FingerPose;
  middle: FingerPose;
  ring: FingerPose;
  pinky: FingerPose;
  thumb: ThumbPose;
}

function createAnimState(): AnimState {
  return {
    index: { ...RESTING_POSE.index },
    middle: { ...RESTING_POSE.middle },
    ring: { ...RESTING_POSE.ring },
    pinky: { ...RESTING_POSE.pinky },
    thumb: { ...RESTING_POSE.thumb },
  };
}

// ── Finger bone refs + bind poses for one hand ───────────────────

interface HandBoneRefs {
  fingers: Record<FingerName, {
    carpal: THREE.Bone;
    bones: [THREE.Bone, THREE.Bone, THREE.Bone];
  }>;
  thumb: [THREE.Bone, THREE.Bone, THREE.Bone];
  armChain: {
    clavicle: THREE.Bone;
    upperArm: THREE.Bone;
    foreArm: THREE.Bone;
    hand: THREE.Bone;
  };
}

interface HandBindPoses {
  fingers: Record<FingerName, {
    carpal: THREE.Quaternion;
    bones: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
  }>;
  thumb: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
  armChain: {
    clavicle: THREE.Quaternion;
    upperArm: THREE.Quaternion;
    foreArm: THREE.Quaternion;
    hand: THREE.Quaternion;
  };
}

function collectHandBones(
  boneMap: Map<string, THREE.Bone>,
  side: "left" | "right",
): HandBoneRefs | null {
  const fingerMapping = side === "left" ? AVATAR_FINGER_BONES : getRightFingerBones();
  const thumbBoneNames = side === "left" ? AVATAR_THUMB_BONES : AVATAR_RIGHT_THUMB_BONES;
  const chain = ARM_CHAINS[side];

  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  const fingers = {} as HandBoneRefs["fingers"];

  for (const name of fingerNames) {
    const cfg = fingerMapping[name];
    const carpal = boneMap.get(cfg.carpal);
    const b0 = boneMap.get(cfg.bones[0]);
    const b1 = boneMap.get(cfg.bones[1]);
    const b2 = boneMap.get(cfg.bones[2]);
    if (!carpal || !b0 || !b1 || !b2) return null;
    fingers[name] = { carpal, bones: [b0, b1, b2] };
  }

  const t0 = boneMap.get(thumbBoneNames[0]);
  const t1 = boneMap.get(thumbBoneNames[1]);
  const t2 = boneMap.get(thumbBoneNames[2]);
  if (!t0 || !t1 || !t2) return null;

  const clavicle = boneMap.get(chain.shoulder);
  const upperArm = boneMap.get(chain.upperArm);
  const foreArm = boneMap.get(chain.foreArm);
  const hand = boneMap.get(chain.hand);
  if (!clavicle || !upperArm || !foreArm || !hand) return null;

  return {
    fingers,
    thumb: [t0, t1, t2],
    armChain: { clavicle, upperArm, foreArm, hand },
  };
}

function snapshotHandBindPoses(refs: HandBoneRefs): HandBindPoses {
  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  const fingers = {} as HandBindPoses["fingers"];

  for (const name of fingerNames) {
    const f = refs.fingers[name];
    fingers[name] = {
      carpal: f.carpal.quaternion.clone(),
      bones: [
        f.bones[0].quaternion.clone(),
        f.bones[1].quaternion.clone(),
        f.bones[2].quaternion.clone(),
      ],
    };
  }

  return {
    fingers,
    thumb: [
      refs.thumb[0].quaternion.clone(),
      refs.thumb[1].quaternion.clone(),
      refs.thumb[2].quaternion.clone(),
    ],
    armChain: {
      clavicle: refs.armChain.clavicle.quaternion.clone(),
      upperArm: refs.armChain.upperArm.quaternion.clone(),
      foreArm: refs.armChain.foreArm.quaternion.clone(),
      hand: refs.armChain.hand.quaternion.clone(),
    },
  };
}

// ── Hand centroid: average position of all hand bones ────────────

const _centroidPos = new THREE.Vector3();
const _wristPos = new THREE.Vector3();
const _handDirVec = new THREE.Vector3();
const _handWorldQ = new THREE.Quaternion();

/**
 * Compute the distance from the wrist bone to the centroid of all
 * hand bones, measured along the hand's extension direction (-Y).
 *
 * Called once at bind-pose time. The returned value is used to offset
 * the IK target so that the palm center (not the wrist joint) reaches
 * the UB point.
 */
function computeHandCentroidDistance(refs: HandBoneRefs): number {
  const hand = refs.armChain.hand;
  hand.updateWorldMatrix(true, true);

  hand.getWorldPosition(_wristPos);

  // Hand's extension direction in world space (bone -Y)
  hand.getWorldQuaternion(_handWorldQ);
  _handDirVec.set(0, -1, 0).applyQuaternion(_handWorldQ);

  let totalProjection = 0;
  let count = 0;

  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  for (const name of fingerNames) {
    const finger = refs.fingers[name];
    // Carpal
    finger.carpal.getWorldPosition(_centroidPos);
    totalProjection += _centroidPos.clone().sub(_wristPos).dot(_handDirVec);
    count++;
    // MCP, PIP, DIP
    for (const bone of finger.bones) {
      bone.getWorldPosition(_centroidPos);
      totalProjection += _centroidPos.clone().sub(_wristPos).dot(_handDirVec);
      count++;
    }
  }

  // Thumb
  for (const bone of refs.thumb) {
    bone.getWorldPosition(_centroidPos);
    totalProjection += _centroidPos.clone().sub(_wristPos).dot(_handDirVec);
    count++;
  }

  // Average projection along hand extension = centroid distance from wrist
  return count > 0 ? totalProjection / count : 0.06;
}

/**
 * Compute the average world position of all hand bones (centroid).
 * Used by FK mode to measure distance to UB target.
 */
const _centroidWorldTmp = new THREE.Vector3();

function computeHandCentroidWorldPos(refs: HandBoneRefs): THREE.Vector3 {
  const centroid = new THREE.Vector3();
  let count = 0;

  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  for (const name of fingerNames) {
    const finger = refs.fingers[name];
    finger.carpal.getWorldPosition(_centroidWorldTmp);
    centroid.add(_centroidWorldTmp);
    count++;
    for (const bone of finger.bones) {
      bone.getWorldPosition(_centroidWorldTmp);
      centroid.add(_centroidWorldTmp);
      count++;
    }
  }
  for (const bone of refs.thumb) {
    bone.getWorldPosition(_centroidWorldTmp);
    centroid.add(_centroidWorldTmp);
    count++;
  }

  return centroid.divideScalar(count);
}

// ── Animate fingers on one hand ──────────────────────────────────

function animateFingers(
  anim: AnimState,
  targetPose: HandPose,
  refs: HandBoneRefs,
  bindPoses: HandBindPoses,
  factor: number,
) {
  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];

  for (const name of fingerNames) {
    const s = anim[name];
    const t = targetPose[name];
    s.carpalSpread += (t.carpalSpread - s.carpalSpread) * factor;
    s.carpalFlex += (t.carpalFlex - s.carpalFlex) * factor;
    s.mcpFlex += (t.mcpFlex - s.mcpFlex) * factor;
    s.pipFlex += (t.pipFlex - s.pipFlex) * factor;
    s.dipFlex += (t.dipFlex - s.dipFlex) * factor;

    const boneRefs = refs.fingers[name];
    const bind = bindPoses.fingers[name];

    // Mixamo FBX: finger bones flex with positive X toward palm
    applyPose(boneRefs.carpal, bind.carpal, s.carpalFlex, -s.carpalSpread, 0);
    applyPose(boneRefs.bones[0], bind.bones[0], s.mcpFlex, 0, 0);      // MCP
    applyPose(boneRefs.bones[1], bind.bones[1], s.pipFlex, 0, 0);      // PIP
    applyPose(boneRefs.bones[2], bind.bones[2], s.dipFlex, 0, 0);      // DIP
  }

  // Thumb — Mixamo uses flipped X/Y for opposition
  const ts = anim.thumb;
  const tt = targetPose.thumb;
  ts.cmcOpposition += (tt.cmcOpposition - ts.cmcOpposition) * factor;
  ts.cmcRotation += (tt.cmcRotation - ts.cmcRotation) * factor;
  ts.mcpFlex += (tt.mcpFlex - ts.mcpFlex) * factor;
  ts.ipFlex += (tt.ipFlex - ts.ipFlex) * factor;

  applyPose(refs.thumb[0], bindPoses.thumb[0], -ts.cmcOpposition, -ts.cmcRotation, 0);
  applyPose(refs.thumb[1], bindPoses.thumb[1], ts.mcpFlex, 0, 0);
  applyPose(refs.thumb[2], bindPoses.thumb[2], ts.ipFlex, 0, 0);
}

// ── Blend hand poses for movement interpolation ─────────────────

function blendHandPoses(from: HandPose, to: HandPose, t: number): HandPose {
  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  const result = {} as Record<FingerName, FingerPose>;
  for (const name of fingerNames) {
    const f = from[name];
    const tt = to[name];
    result[name] = {
      carpalSpread: f.carpalSpread + (tt.carpalSpread - f.carpalSpread) * t,
      carpalFlex: f.carpalFlex + (tt.carpalFlex - f.carpalFlex) * t,
      mcpFlex: f.mcpFlex + (tt.mcpFlex - f.mcpFlex) * t,
      pipFlex: f.pipFlex + (tt.pipFlex - f.pipFlex) * t,
      dipFlex: f.dipFlex + (tt.dipFlex - f.dipFlex) * t,
    };
  }
  return {
    index: result.index,
    middle: result.middle,
    ring: result.ring,
    pinky: result.pinky,
    thumb: {
      cmcOpposition: from.thumb.cmcOpposition + (to.thumb.cmcOpposition - from.thumb.cmcOpposition) * t,
      cmcRotation: from.thumb.cmcRotation + (to.thumb.cmcRotation - from.thumb.cmcRotation) * t,
      mcpFlex: from.thumb.mcpFlex + (to.thumb.mcpFlex - from.thumb.mcpFlex) * t,
      ipFlex: from.thumb.ipFlex + (to.thumb.ipFlex - from.thumb.ipFlex) * t,
    },
  };
}

// ── Blend split orientations for movement segments ───────────────

function blendSplitOrients(
  from: { palm: string; fingers: string },
  to: { palm: string; fingers: string },
  t: number,
): SplitOrientation {
  const fromSplit = orientationToSplitQuats(from.palm, from.fingers);
  const toSplit = orientationToSplitQuats(to.palm, to.fingers);
  return blendSplitOrientations(fromSplit, toSplit, t);
}

// ── Pre-allocated scratch vectors for movement interpolation ────

const _fromPosVec = new THREE.Vector3();
const _toPosVec = new THREE.Vector3();
const _interpPosVec = new THREE.Vector3();

// ── Apply local movement overlays ───────────────────────────────

function applyLocalMovement(
  refs: HandBoneRefs,
  local: string,
  t: number,
  elapsedTime: number,
) {
  const wrist = refs.armChain.hand;
  switch (local) {
    case "WIGGLE":
      // Sequential finger wave
      for (const [i, name] of (["index", "middle", "ring", "pinky"] as FingerName[]).entries()) {
        const wave = Math.sin(elapsedTime * 10 + i * 1.2) * 0.3;
        refs.fingers[name].bones[2].rotateX(wave);
      }
      break;
    case "TWIST":
      wrist.rotateZ(Math.sin(elapsedTime * 3) * 0.4);
      break;
    case "CIRCULAR":
      wrist.rotateX(Math.sin(elapsedTime * 3) * 0.15);
      wrist.rotateZ(Math.cos(elapsedTime * 3) * 0.15);
      break;
    case "NOD":
      wrist.rotateX(Math.sin(elapsedTime * 3) * 0.3);
      break;
    case "SCRATCH":
      // Rapid DIP flexion on all fingers
      for (const name of ["index", "middle", "ring", "pinky"] as FingerName[]) {
        refs.fingers[name].bones[2].rotateX(Math.sin(elapsedTime * 14) * 0.2);
      }
      break;
    case "OSCILLATE":
      wrist.rotateY(Math.sin(elapsedTime * 4) * 0.25);
      break;
    case "RELEASE":
      // Cyclic finger open/close
      for (const name of ["index", "middle", "ring", "pinky"] as FingerName[]) {
        const cycle = Math.sin(elapsedTime * 3) * 0.5 + 0.5; // 0..1
        refs.fingers[name].bones[0].rotateX(cycle * 0.4);
        refs.fingers[name].bones[1].rotateX(cycle * 0.3);
      }
      break;
    case "FLATTEN":
      // MCP closing
      for (const name of ["index", "middle", "ring", "pinky"] as FingerName[]) {
        refs.fingers[name].bones[0].rotateX(Math.sin(elapsedTime * 3) * 0.3);
      }
      break;
    case "PROGRESSIVE":
      // Sequential finger closure with phase offset
      for (const [i, name] of (["index", "middle", "ring", "pinky"] as FingerName[]).entries()) {
        const phase = Math.max(0, Math.sin(elapsedTime * 2.5 - i * 0.6));
        refs.fingers[name].bones[0].rotateX(phase * 0.5);
        refs.fingers[name].bones[1].rotateX(phase * 0.4);
      }
      break;
    case "VIBRATE":
      // High-frequency jitter on wrist
      wrist.rotateX(Math.sin(elapsedTime * 25) * 0.02);
      wrist.rotateY(Math.cos(elapsedTime * 25) * 0.02);
      break;
    case "RUB":
      // Subtle finger oscillation
      for (const name of ["index", "middle", "ring", "pinky"] as FingerName[]) {
        refs.fingers[name].bones[2].rotateX(Math.sin(elapsedTime * 8) * 0.1);
      }
      break;
  }
}

// ── Animate arm IK for one hand (anatomically constrained) ──────

// Scratch vectors for centroid offset and rest pose
const _shoulderPosIK = new THREE.Vector3();
const _reachDirIK = new THREE.Vector3();
const _adjustedTarget = new THREE.Vector3();
const _restTarget = new THREE.Vector3();
const _handWorldPosDbg = new THREE.Vector3();
const _shoulderYTwist = new THREE.Quaternion();
const _totalAxialTwist = new THREE.Quaternion();
const _yAxisUp = new THREE.Vector3(0, 1, 0);

/** Debug info filled by animateArmIK for rendering debug spheres */
interface DebugIKInfo {
  ikTarget: THREE.Vector3;       // green: centroid-adjusted IK target
  ubTarget: THREE.Vector3;       // blue: raw UB target
  handWorldPos: THREE.Vector3;   // red: actual hand bone world pos
  active: boolean;
}

function animateArmIK(
  targetWorldPos: THREE.Vector3 | null,
  refs: HandBoneRefs,
  bindPoses: HandBindPoses,
  armLengths: ArmLengths,
  factor: number,
  isLeftArm: boolean,
  splitOrient: SplitOrientation | null,
  centroidDist: number,
  debugInfo?: DebugIKInfo,
) {
  // ── Determine effective IK target ───────────────────────────────
  let ikTarget: THREE.Vector3;
  let ikFactor: number;
  let orient: SplitOrientation | null;

  if (targetWorldPos) {
    // Offset the target so the hand CENTROID (not wrist) reaches the UB point.
    // The centroid is centroidDist past the wrist along the reach direction.
    // Pull the target back toward the shoulder by that amount.
    refs.armChain.upperArm.getWorldPosition(_shoulderPosIK);
    _reachDirIK.copy(targetWorldPos).sub(_shoulderPosIK).normalize();
    _adjustedTarget.copy(targetWorldPos).addScaledVector(_reachDirIK, -centroidDist);
    ikTarget = _adjustedTarget;
    ikFactor = factor;
    orient = splitOrient;

    // Fill debug info
    if (debugInfo) {
      debugInfo.ubTarget.copy(targetWorldPos);
      debugInfo.ikTarget.copy(ikTarget);
      debugInfo.active = true;
    }
  } else {
    // No UB target → arms-down rest pose via IK
    // Position beside the hip: below clavicle, slightly to the side + forward
    refs.armChain.clavicle.updateWorldMatrix(true, false);
    refs.armChain.clavicle.getWorldPosition(_restTarget);
    const sign = isLeftArm ? 1 : -1;
    _restTarget.x += sign * 0.12;
    _restTarget.y -= 0.55;
    _restTarget.z += 0.06;
    ikTarget = _restTarget;
    ikFactor = factor * 0.5; // slower convergence for natural transition
    orient = null;

    if (debugInfo) debugInfo.active = false;
  }

  // ── Solve IK ────────────────────────────────────────────────────
  const { clavicleQuat, upperArmQuat, foreArmQuat } = solveArmIKNatural(
    ikTarget,
    armLengths,
    refs.armChain.clavicle,
    refs.armChain.upperArm,
    refs.armChain.foreArm,
    bindPoses.armChain.clavicle,
    bindPoses.armChain.upperArm,
    bindPoses.armChain.foreArm,
    isLeftArm,
  );

  // Slerp clavicle toward IK target
  refs.armChain.clavicle.quaternion.slerp(clavicleQuat, ikFactor * 2);

  if (orient) {
    // Apply shoulder twist for orientation support (overflow from forearm ROM)
    const adjustedUpperArm = composeShoulderTwist(
      upperArmQuat,
      bindPoses.armChain.upperArm,
      orient.shoulderTwist,
      isLeftArm,
    );
    refs.armChain.upperArm.quaternion.slerp(adjustedUpperArm, ikFactor * 2);

    // Compose forearm pronation/supination twist onto IK-solved forearm
    const finalForeArm = composeForearmTwist(foreArmQuat, orient.forearmTwist);
    refs.armChain.foreArm.quaternion.slerp(finalForeArm, ikFactor * 2);

    // Hand: compensate for BOTH shoulder twist AND forearm twist propagating
    // through the bone hierarchy. Both are Y-axis rotations, so compose:
    //   totalAxialTwist = shoulderTwistQuat * forearmTwist
    //   targetHand = inv(totalAxialTwist) * bindHand * fullOrient
    _shoulderYTwist.setFromAxisAngle(_yAxisUp, orient.shoulderTwist);
    _totalAxialTwist.copy(_shoulderYTwist).multiply(orient.forearmTwist);
    const targetHandQuat = _totalAxialTwist.clone().invert()
      .multiply(bindPoses.armChain.hand)
      .multiply(orient.fullOrient);

    // Clamp wrist to clinical ROM (flex ±60°, radial/ulnar 20°/30°)
    clampWristRotation(targetHandQuat, bindPoses.armChain.hand);

    refs.armChain.hand.quaternion.slerp(targetHandQuat, ikFactor * 2);
  } else {
    // No orientation — just use IK results, hand returns to bind
    refs.armChain.upperArm.quaternion.slerp(upperArmQuat, ikFactor * 2);
    refs.armChain.foreArm.quaternion.slerp(foreArmQuat, ikFactor * 2);
    refs.armChain.hand.quaternion.slerp(bindPoses.armChain.hand, ikFactor);
  }

  // Capture hand world position for debug rendering
  if (debugInfo && debugInfo.active) {
    refs.armChain.hand.updateWorldMatrix(true, false);
    refs.armChain.hand.getWorldPosition(debugInfo.handWorldPos);
  }
}

// ── Debug sphere component ──────────────────────────────────────
// Uses useFrame to continuously sync with the mutated Vector3 ref,
// since R3F only copies the position prop on mount/reconciliation.

function DebugSphere({ position, color }: { position: THREE.Vector3; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(position);
    }
  });
  return (
    <mesh ref={meshRef} renderOrder={10}>
      <sphereGeometry args={[0.04, 12, 12]} />
      <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
    </mesh>
  );
}

// ── Main component ──────────────────────────────────────────────

export default function AvatarModel({
  ubLocation,
  rnm,
  autoRotate = false,
  showAllUBPoints = false,
  selectedUBCode: selectedUBCodeProp = null,
  ubRegionFilter = null,
  onUBClick,
  cm,
  orientation,
  handMode = "dominant",
  movementInterp,
  armAngles,
  armFKStateRef,
  autoSolveRequest,
}: AvatarModelProps) {
  // Load GLB model
  const gltf = useLoader(GLTFLoader, AVATAR_PATH, (loader) => {
    // MeshoptDecoder only needed for meshopt-compressed models (original wscharacter.glb)
    if (AVATAR_PATH.includes("wscharacter.glb") && !AVATAR_PATH.includes("_new")) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
  });
  const groupRef = useRef<THREE.Group>(null);

  // Clone the scene
  const clonedScene = useMemo(() => {
    const clone = cloneWithSkeleton(gltf.scene);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Ensure double-sided rendering
        const fixMaterial = (mat: THREE.Material): THREE.Material => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.side = THREE.DoubleSide;
          }
          return mat;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(fixMaterial);
        } else {
          mesh.material = fixMaterial(mesh.material);
        }
      }
    });

    // Center and scale
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = 2.5 / maxDim;

    clone.scale.setScalar(s);
    clone.position.set(-center.x * s, -center.y * s, -center.z * s);

    return clone;
  }, [gltf.scene]);

  // Build full bone map for O(1) lookup
  const boneMap = useMemo(() => buildBoneMap(clonedScene), [clonedScene]);

  // Find skinned mesh with morph targets
  const skinnedMeshRef = useRef<THREE.Mesh | null>(null);
  useMemo(() => {
    skinnedMeshRef.current = null;
    clonedScene.traverse((child) => {
      if (
        (child as THREE.Mesh).isMesh &&
        (child as THREE.Mesh).morphTargetInfluences &&
        (child as THREE.Mesh).morphTargetInfluences!.length > 0
      ) {
        skinnedMeshRef.current = child as THREE.Mesh;
      }
    });
  }, [clonedScene]);

  // Build morph target name → index mapping
  const morphMap = useMemo<MorphMap>(() => {
    if (!skinnedMeshRef.current) return {};
    return buildMorphMap(skinnedMeshRef.current);
  }, [clonedScene]); // eslint-disable-line react-hooks/exhaustive-deps

  // Named bone references for head/neck animation
  const bones = useMemo(
    () => ({
      head: boneMap.get("Head") ?? null,
      neck: boneMap.get("Neck") ?? null,
    }),
    [boneMap],
  );

  // Store bind-pose quaternions for head/neck
  const bindPoses = useMemo(
    () => ({
      head: bones.head?.quaternion.clone() ?? new THREE.Quaternion(),
      neck: bones.neck?.quaternion.clone() ?? new THREE.Quaternion(),
    }),
    [bones],
  );

  // ── Hand bone refs + bind poses ──

  const leftHandRefs = useMemo(() => collectHandBones(boneMap, "left"), [boneMap]);
  const rightHandRefs = useMemo(() => collectHandBones(boneMap, "right"), [boneMap]);

  const leftHandBindPoses = useMemo(
    () => (leftHandRefs ? snapshotHandBindPoses(leftHandRefs) : null),
    [leftHandRefs],
  );
  const rightHandBindPoses = useMemo(
    () => (rightHandRefs ? snapshotHandBindPoses(rightHandRefs) : null),
    [rightHandRefs],
  );

  // ── Arm lengths (measured once) ──

  const leftArmLengths = useMemo<ArmLengths | null>(() => {
    if (!leftHandRefs) return null;
    return measureArmLengths(
      leftHandRefs.armChain.upperArm,
      leftHandRefs.armChain.foreArm,
      leftHandRefs.armChain.hand,
    );
  }, [leftHandRefs]);

  const rightArmLengths = useMemo<ArmLengths | null>(() => {
    if (!rightHandRefs) return null;
    return measureArmLengths(
      rightHandRefs.armChain.upperArm,
      rightHandRefs.armChain.foreArm,
      rightHandRefs.armChain.hand,
    );
  }, [rightHandRefs]);

  // ── Hand centroid distance (measured once at bind pose) ──

  const leftCentroidDist = useMemo<number>(() => {
    if (!leftHandRefs) return 0.06; // fallback ~6cm
    return computeHandCentroidDistance(leftHandRefs);
  }, [leftHandRefs]);

  const rightCentroidDist = useMemo<number>(() => {
    if (!rightHandRefs) return 0.06;
    return computeHandCentroidDistance(rightHandRefs);
  }, [rightHandRefs]);

  // ── Debug IK state (for rendering debug spheres) ──
  const debugIK = useRef<DebugIKInfo>({
    ikTarget: new THREE.Vector3(),
    ubTarget: new THREE.Vector3(),
    handWorldPos: new THREE.Vector3(),
    active: false,
  });

  // ── Animation state refs (mutable) ──

  const leftAnimState = useRef<AnimState>(createAnimState());
  const rightAnimState = useRef<AnimState>(createAnimState());

  // ── Computed targets ──

  const targetPose = useMemo<HandPose>(() => {
    return cm ? cmEntryToHandPose(cm) : RESTING_POSE;
  }, [cm]);

  const targetSplitOrient = useMemo<SplitOrientation | null>(() => {
    if (!orientation) return null;
    return orientationToSplitQuats(orientation.palm, orientation.fingers);
  }, [orientation]);

  // Mirror orientation for symmetric mode
  const mirroredSplitOrient = useMemo<SplitOrientation | null>(() => {
    if (!orientation) return null;
    const mirrored = mirrorOrientation(orientation);
    return orientationToSplitQuats(mirrored.palm, mirrored.fingers);
  }, [orientation]);

  // Compute target morph weights from RNM state
  const targetMorphWeights = useMemo(() => {
    if (!rnm) return {};
    return rnmToMorphWeights(rnm, morphMap);
  }, [rnm, morphMap]);

  // Selected UB code (from props or 3D click)
  // Use explicit selectedUBCode prop if provided, otherwise fall back to ubLocation
  const selectedUBCode = selectedUBCodeProp ?? ubLocation?.code ?? null;

  // Handle 3D sphere click → propagate to parent
  const handleUBMarkerClick = useCallback(
    (code: string) => {
      onUBClick?.(code);
    },
    [onUBClick],
  );

  // ── Auto-solve processing (incremental FK solver — 1 code per frame) ──
  const autoSolveProcessedRef = useRef<AutoSolveRequest | null>(null);
  const autoSolveIndexRef = useRef(0);
  const autoSolveResultsRef = useRef<CapturedPose[]>([]);
  const autoSolveDoneRef = useRef(false);

  // Animation loop
  useFrame((rs, delta) => {
    if (!groupRef.current) return;

    // ─ AUTO-SOLVE: Process one UB code per frame to avoid freezing ─
    if (
      autoSolveRequest &&
      leftHandRefs &&
      leftHandBindPoses &&
      boneMap.size > 0
    ) {
      // New request: initialize
      if (autoSolveRequest !== autoSolveProcessedRef.current) {
        autoSolveProcessedRef.current = autoSolveRequest;
        autoSolveIndexRef.current = 0;
        autoSolveResultsRef.current = [];
        autoSolveDoneRef.current = false;
      }

      // Skip if already finalized (waiting for React to clear the request)
      if (!autoSolveDoneRef.current) {
        const idx = autoSolveIndexRef.current;
        if (idx < autoSolveRequest.codes.length) {
          const code = autoSolveRequest.codes[idx];

          const armRefs = {
            clavicle: leftHandRefs.armChain.clavicle,
            upperArm: leftHandRefs.armChain.upperArm,
            foreArm: leftHandRefs.armChain.foreArm,
            hand: leftHandRefs.armChain.hand,
          };
          const armBind = {
            clavicle: leftHandBindPoses.armChain.clavicle,
            upperArm: leftHandBindPoses.armChain.upperArm,
            foreArm: leftHandBindPoses.armChain.foreArm,
            hand: leftHandBindPoses.armChain.hand,
          };

          // Use surface-offset target so the hand touches the surface
          // instead of the centroid penetrating through the mesh.
          // 0.08 = 8cm outward along approximate surface normal.
          const ubWorldPos = computeUBWorldPositionWithSurfaceOffset(code, boneMap, 0.08);
          if (ubWorldPos) {
            const applyAndMeasure = (testAngles: ArmJointAngles): number => {
              applyArmFK(testAngles, armRefs, armBind, true);
              leftHandRefs.armChain.clavicle.updateWorldMatrix(true, true);
              const centroid = computeHandCentroidWorldPos(leftHandRefs);
              return centroid.distanceTo(ubWorldPos);
            };

            const { angles: solvedAngles, distance } = solveFKCoordinateDescent(applyAndMeasure);

            // Read hand world quaternion
            leftHandRefs.armChain.hand.getWorldQuaternion(_handWorldQ);

            autoSolveResultsRef.current.push({
              ubCode: code,
              angles: { ...solvedAngles },
              handWorldQuat: [_handWorldQ.x, _handWorldQ.y, _handWorldQ.z, _handWorldQ.w],
              distanceToUB: distance,
              timestamp: Date.now(),
            });

            // Restore bind pose after each solve
            armRefs.clavicle.quaternion.copy(armBind.clavicle);
            armRefs.upperArm.quaternion.copy(armBind.upperArm);
            armRefs.foreArm.quaternion.copy(armBind.foreArm);
            armRefs.hand.quaternion.copy(armBind.hand);
          }

          autoSolveIndexRef.current = idx + 1;

          // Report progress
          if (autoSolveRequest.onProgress) {
            autoSolveRequest.onProgress(autoSolveResultsRef.current.length);
          }
        } else {
          // All codes processed — finalize
          autoSolveDoneRef.current = true;
          const results = [...autoSolveResultsRef.current];
          autoSolveRequest.onComplete(results);
        }
      }
    }

    const clampedDelta = Math.min(delta, 0.05);
    const factor = 1 - Math.pow(1 - 0.08, clampedDelta * 60);
    const t = rs.clock.elapsedTime;

    // ─ RNM: Morph target animation (blendshapes) ─
    if (skinnedMeshRef.current?.morphTargetInfluences) {
      const influences = skinnedMeshRef.current.morphTargetInfluences;
      for (let i = 0; i < influences.length; i++) {
        const target = targetMorphWeights[i] ?? 0;
        influences[i] += (target - influences[i]) * factor * 3;
        if (Math.abs(influences[i]) < 0.001) influences[i] = 0;
      }
    }

    // ─ RNM: Head & Neck bone animation ─
    if (rnm && bones.head && bones.neck) {
      let headRx = 0,
        headRy = 0,
        headRz = 0;
      let neckRx = 0,
        neckRy = 0,
        neckRz = 0;

      switch (rnm.head) {
        case "NOD":
          headRx = Math.sin(t * 3) * 0.25;
          neckRx = Math.sin(t * 3) * 0.1;
          break;
        case "SHAKE":
          headRy = Math.sin(t * 4) * 0.3;
          neckRy = Math.sin(t * 4) * 0.1;
          break;
        case "TILT_LEFT":
          headRz = 0.25;
          neckRz = 0.08;
          break;
        case "TILT_RIGHT":
          headRz = -0.25;
          neckRz = -0.08;
          break;
        case "TILT_BACK":
          headRx = -0.3;
          neckRx = -0.1;
          break;
        case "TILT_DOWN":
          headRx = 0.3;
          neckRx = 0.1;
          break;
      }

      _headEuler.set(headRx, headRy, headRz, "XYZ");
      _headQuat.setFromEuler(_headEuler);
      _headQuat.premultiply(bindPoses.head);
      bones.head.quaternion.slerp(_headQuat, factor * 3);

      _neckEuler.set(neckRx, neckRy, neckRz, "XYZ");
      _neckQuat.setFromEuler(_neckEuler);
      _neckQuat.premultiply(bindPoses.neck);
      bones.neck.quaternion.slerp(_neckQuat, factor * 3);
    } else if (bones.head && bones.neck) {
      bones.head.quaternion.slerp(bindPoses.head, factor);
      bones.neck.quaternion.slerp(bindPoses.neck, factor);
    }

    // ─ Determine effective hand mode ─
    const effectiveHandMode = movementInterp?.handMode ?? handMode;

    // ─ UB BROWSE MODE ─
    if (showAllUBPoints && leftHandRefs && leftHandBindPoses) {
      // If a UB point is selected, articulate the arm toward it using FK preset
      const browseFKPreset = ubLocation ? UB_FK_PRESETS[ubLocation.code] : null;
      if (browseFKPreset) {
        poseArmPreset(browseFKPreset, leftHandRefs.armChain, leftHandBindPoses.armChain, true, factor);
        animateFingers(leftAnimState.current, targetPose, leftHandRefs, leftHandBindPoses, factor);
      } else {
        poseArmDown(leftHandRefs.armChain, leftHandBindPoses.armChain, true, factor);
        animateFingers(leftAnimState.current, RESTING_POSE, leftHandRefs, leftHandBindPoses, factor);
      }
      debugIK.current.active = false;

      if (rightHandRefs && rightHandBindPoses) {
        poseArmDown(rightHandRefs.armChain, rightHandBindPoses.armChain, false, factor);
        animateFingers(rightAnimState.current, RESTING_POSE, rightHandRefs, rightHandBindPoses, factor);
      }
    }
    // ─ LEFT ARM: FK mode (manual joint angles) ─
    else if (armAngles && leftHandRefs && leftHandBindPoses) {
      // Check if all FK angles are at default (zero) — use arms-down pose instead of T-pose
      const fkHasInput = Object.values(armAngles).some((v) => v !== 0);

      if (!fkHasInput) {
        // All sliders at zero → same arms-down neutral as other modes
        poseArmDown(leftHandRefs.armChain, leftHandBindPoses.armChain, true, factor);
        animateFingers(leftAnimState.current, targetPose, leftHandRefs, leftHandBindPoses, factor);
        debugIK.current.active = false;
      } else {
      // 1. Apply FK angles directly to arm bones
      applyArmFK(
        armAngles,
        {
          clavicle: leftHandRefs.armChain.clavicle,
          upperArm: leftHandRefs.armChain.upperArm,
          foreArm: leftHandRefs.armChain.foreArm,
          hand: leftHandRefs.armChain.hand,
        },
        {
          clavicle: leftHandBindPoses.armChain.clavicle,
          upperArm: leftHandBindPoses.armChain.upperArm,
          foreArm: leftHandBindPoses.armChain.foreArm,
          hand: leftHandBindPoses.armChain.hand,
        },
        true, // isLeftArm
      );

      // 2. Animate fingers normally
      animateFingers(leftAnimState.current, targetPose, leftHandRefs, leftHandBindPoses, factor);

      // 3. Force full world matrix update from clavicle down through fingers
      leftHandRefs.armChain.clavicle.updateWorldMatrix(true, true);

      // 4. Compute FK state, debug spheres, and write to shared ref
      const centroidPos = computeHandCentroidWorldPos(leftHandRefs);
      const ubWorldPos = ubLocation ? computeUBWorldPosition(ubLocation.code, boneMap) : null;
      const dist = ubWorldPos ? centroidPos.distanceTo(ubWorldPos) : Infinity;

      leftHandRefs.armChain.hand.getWorldQuaternion(_handWorldQ);

      if (armFKStateRef) {
        armFKStateRef.current = {
          centroidWorldPos: [centroidPos.x, centroidPos.y, centroidPos.z],
          ubWorldPos: ubWorldPos ? [ubWorldPos.x, ubWorldPos.y, ubWorldPos.z] : null,
          distanceToUB: dist,
          reached: dist < 0.05, // 5cm threshold
          handWorldQuat: [_handWorldQ.x, _handWorldQ.y, _handWorldQ.z, _handWorldQ.w],
        };
      }

      // Debug spheres: Blue=UB (if selected), Green=centroid (always in FK mode)
      debugIK.current.ikTarget.copy(centroidPos);
      debugIK.current.active = true;
      if (ubWorldPos) {
        debugIK.current.ubTarget.copy(ubWorldPos);
      } else {
        // No UB selected — hide blue sphere by placing it far off-screen
        debugIK.current.ubTarget.set(0, -100, 0);
      }

      } // end fkHasInput else

    } else if (leftHandRefs && leftHandBindPoses) {
    // ─ LEFT ARM: Finger posing + Arm IK (dominant hand) ─
      if (movementInterp && movementInterp.fromUBCode && movementInterp.toUBCode) {
        // ── MOVEMENT SEGMENT: Smooth interpolation ──
        const mt = movementInterp.t;

        // 1. Blend finger pose between from/to CM
        const fromPose = movementInterp.fromCM ? cmEntryToHandPose(movementInterp.fromCM) : RESTING_POSE;
        const toPose = movementInterp.toCM ? cmEntryToHandPose(movementInterp.toCM) : RESTING_POSE;
        const blendedPose = blendHandPoses(fromPose, toPose, mt);
        animateFingers(leftAnimState.current, blendedPose, leftHandRefs, leftHandBindPoses, factor);

        // 2. Interpolate UB world position along contour path
        if (leftArmLengths) {
          const fromPos = computeUBWorldPosition(movementInterp.fromUBCode, boneMap);
          const toPos = computeUBWorldPosition(movementInterp.toUBCode, boneMap);

          if (fromPos && toPos) {
            const fromArr: [number, number, number] = [fromPos.x, fromPos.y, fromPos.z];
            const toArr: [number, number, number] = [toPos.x, toPos.y, toPos.z];
            const interpArr = interpolateMovementPosition(
              fromArr, toArr,
              movementInterp.contour,
              movementInterp.plane,
              mt,
            );
            _interpPosVec.set(interpArr[0], interpArr[1], interpArr[2]);

            // 3. Blend split orientation between from/to
            const blendedSplitOrient = blendSplitOrients(
              movementInterp.fromOrientation,
              movementInterp.toOrientation,
              mt,
            );

            animateArmIK(
              _interpPosVec,
              leftHandRefs,
              leftHandBindPoses,
              leftArmLengths,
              factor,
              true,
              blendedSplitOrient,
              leftCentroidDist,
              debugIK.current,
            );

            // 4. Apply local movement overlays (after IK)
            if (movementInterp.local) {
              applyLocalMovement(leftHandRefs, movementInterp.local, mt, t);
            }
          }
        }
      } else {
        // ── HOLD SEGMENT: Static position ──
        animateFingers(
          leftAnimState.current,
          targetPose,
          leftHandRefs,
          leftHandBindPoses,
          factor,
        );

        if (ubLocation) {
          const fkPreset = UB_FK_PRESETS[ubLocation.code];
          if (fkPreset) {
            // Use pre-computed FK angles for this UB point
            poseArmPreset(
              fkPreset,
              leftHandRefs.armChain,
              leftHandBindPoses.armChain,
              true,
              factor,
            );
            // Apply OR orientation on top of FK preset (palm/finger direction)
            if (targetSplitOrient) {
              applyOrientationOverFK(
                targetSplitOrient,
                leftHandRefs.armChain,
                leftHandBindPoses.armChain,
                true,
                factor,
              );
            }
            debugIK.current.active = false;
          } else if (leftArmLengths) {
            // No preset — fall back to IK
            const ubTarget = computeUBWorldPosition(ubLocation.code, boneMap);
            if (ubTarget) {
              animateArmIK(
                ubTarget,
                leftHandRefs,
                leftHandBindPoses,
                leftArmLengths,
                factor,
                true,
                targetSplitOrient,
                leftCentroidDist,
                debugIK.current,
              );
            }
          }
        } else {
          // No UB target — neutral arms-down pose
          poseArmDown(leftHandRefs.armChain, leftHandBindPoses.armChain, true, factor);
          debugIK.current.active = false;
        }
      }
    }

    // ─ RIGHT ARM: Mirror for symmetric mode ─
    // (skip if already posed in UB browse mode above)
    if (showAllUBPoints) {
      // Already handled above
    } else if (effectiveHandMode === "both_symmetric" && rightHandRefs && rightHandBindPoses) {
      if (movementInterp && movementInterp.fromUBCode && movementInterp.toUBCode) {
        // ── MOVEMENT SEGMENT: Mirrored smooth interpolation ──
        const mt = movementInterp.t;

        const fromPose = movementInterp.fromCM ? cmEntryToHandPose(movementInterp.fromCM) : RESTING_POSE;
        const toPose = movementInterp.toCM ? cmEntryToHandPose(movementInterp.toCM) : RESTING_POSE;
        const blendedPose = blendHandPoses(fromPose, toPose, mt);
        animateFingers(rightAnimState.current, blendedPose, rightHandRefs, rightHandBindPoses, factor);

        if (rightArmLengths) {
          const fromPos = computeUBWorldPositionMirrored(movementInterp.fromUBCode, boneMap);
          const toPos = computeUBWorldPositionMirrored(movementInterp.toUBCode, boneMap);

          if (fromPos && toPos) {
            const fromArr: [number, number, number] = [fromPos.x, fromPos.y, fromPos.z];
            const toArr: [number, number, number] = [toPos.x, toPos.y, toPos.z];
            const interpArr = interpolateMovementPosition(
              fromArr, toArr,
              movementInterp.contour,
              movementInterp.plane,
              mt,
            );
            _interpPosVec.set(interpArr[0], interpArr[1], interpArr[2]);

            const blendedSplitOrientR = blendSplitOrients(
              mirrorOrientation(movementInterp.fromOrientation),
              mirrorOrientation(movementInterp.toOrientation),
              mt,
            );

            animateArmIK(
              _interpPosVec,
              rightHandRefs,
              rightHandBindPoses,
              rightArmLengths,
              factor,
              false,
              blendedSplitOrientR,
              rightCentroidDist,
            );

            if (movementInterp.local) {
              applyLocalMovement(rightHandRefs, movementInterp.local, mt, t);
            }
          }
        }
      } else {
        // ── HOLD SEGMENT: Static mirrored ──
        animateFingers(
          rightAnimState.current,
          targetPose,
          rightHandRefs,
          rightHandBindPoses,
          factor,
        );

        if (ubLocation) {
          const fkPreset = UB_FK_PRESETS[ubLocation.code];
          if (fkPreset) {
            // Use mirrored FK preset (pass isLeftArm=false to mirror)
            poseArmPreset(
              fkPreset,
              rightHandRefs.armChain,
              rightHandBindPoses.armChain,
              false,
              factor,
            );
            // Apply mirrored OR orientation on top of FK preset
            if (mirroredSplitOrient) {
              applyOrientationOverFK(
                mirroredSplitOrient,
                rightHandRefs.armChain,
                rightHandBindPoses.armChain,
                false,
                factor,
              );
            }
          } else if (rightArmLengths) {
            // No preset — fall back to IK
            const ubTarget = computeUBWorldPositionMirrored(ubLocation.code, boneMap);
            if (ubTarget) {
              animateArmIK(
                ubTarget,
                rightHandRefs,
                rightHandBindPoses,
                rightArmLengths,
                factor,
                false,
                mirroredSplitOrient,
                rightCentroidDist,
              );
            }
          }
        } else {
          // No UB target — neutral arms-down pose
          poseArmDown(rightHandRefs.armChain, rightHandBindPoses.armChain, false, factor);
        }
      }
    } else if (rightHandRefs && rightHandBindPoses) {
      // Single-hand mode: right arm rests at side via direct pose
      poseArmDown(rightHandRefs.armChain, rightHandBindPoses.armChain, false, factor);
      animateFingers(
        rightAnimState.current,
        RESTING_POSE,
        rightHandRefs,
        rightHandBindPoses,
        factor,
      );
    }

    // ─ Auto-rotate ─
    if (autoRotate) {
      groupRef.current.rotation.y += clampedDelta * 0.3;
    }
  });

  // Snapshot debug positions for rendering (avoid creating new objects per frame)
  const dbg = debugIK.current;

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
      {/* All 80 interactive UB spheres */}
      {showAllUBPoints && (
        <UBPointCloud
          boneMap={boneMap}
          selectedCode={selectedUBCode}
          regionFilter={ubRegionFilter}
          onMarkerClick={handleUBMarkerClick}
        />
      )}
      {/* Debug spheres: Blue=UB target, Green=hand centroid */}
      {dbg.active && (
        <>
          <DebugSphere position={dbg.ubTarget} color="#3b82f6" />
          <DebugSphere position={dbg.ikTarget} color="#22c55e" />
        </>
      )}
    </group>
  );
}
