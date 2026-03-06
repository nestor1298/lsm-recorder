"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneWithSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CMEntry } from "@/lib/types";
import {
  cmEntryToHandPose,
  RESTING_POSE,
  FINGER_BONES,
  THUMB_BONES,
  type HandPose,
  type FingerPose,
  type ThumbPose,
  type FingerName,
} from "@/lib/hand_pose";

const MODEL_PATH = "/models/rigget_V16.glb";

// ── Skin-tone material ──────────────────────────────────────────

const skinMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#c8956c"),
  roughness: 0.6,
  metalness: 0.0,
  side: THREE.DoubleSide,
});

// ── Types ───────────────────────────────────────────────────────

interface BoneRefs {
  fingers: Record<FingerName, {
    carpal: THREE.Bone;
    bones: [THREE.Bone, THREE.Bone, THREE.Bone]; // MCP, PIP, DIP
  }>;
  thumb: [THREE.Bone, THREE.Bone, THREE.Bone]; // CMC, MCP, IP
}

interface BindPoses {
  fingers: Record<FingerName, {
    carpal: THREE.Quaternion;
    bones: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
  }>;
  thumb: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
}

/** Current animation state — mutable for useFrame */
interface AnimState {
  index: FingerPose;
  middle: FingerPose;
  ring: FingerPose;
  pinky: FingerPose;
  thumb: ThumbPose;
}

// ── Helper: find bone by name ───────────────────────────────────

function findBone(root: THREE.Object3D, name: string): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((child) => {
    if ((child as THREE.Bone).isBone && child.name === name) {
      found = child as THREE.Bone;
    }
  });
  return found;
}

// ── Helper: apply a rotation delta on top of bind pose ──────────

const _euler = new THREE.Euler();
const _deltaQuat = new THREE.Quaternion();

function applyPose(
  bone: THREE.Bone,
  bindQuat: THREE.Quaternion,
  dx: number,
  dy: number,
  dz: number,
) {
  _euler.set(dx, dy, dz, "XYZ");
  _deltaQuat.setFromEuler(_euler);
  bone.quaternion.copy(bindQuat).multiply(_deltaQuat);
}

// ── Main component ──────────────────────────────────────────────

interface RiggedHandProps {
  cm: CMEntry | null;
  autoRotate?: boolean;
}

export default function RiggedHand({ cm, autoRotate = false }: RiggedHandProps) {
  const { scene } = useGLTF(MODEL_PATH);
  const groupRef = useRef<THREE.Group>(null);

  // Clone the scene so we can manipulate bones independently
  const clonedScene = useMemo(() => {
    const clone = cloneWithSkeleton(scene);

    // Apply skin material
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = skinMaterial;
        (child as THREE.Mesh).castShadow = true;
        (child as THREE.Mesh).receiveShadow = true;
      }
    });

    // Center and scale the model
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = 2 / maxDim;
    clone.scale.setScalar(s);
    clone.position.set(-center.x * s, -center.y * s, -center.z * s);

    return clone;
  }, [scene]);

  // Collect bone references
  const boneRefs = useMemo<BoneRefs | null>(() => {
    const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
    const fingers = {} as BoneRefs["fingers"];

    for (const name of fingerNames) {
      const cfg = FINGER_BONES[name];
      const carpal = findBone(clonedScene, cfg.carpal);
      const b0 = findBone(clonedScene, cfg.bones[0]);
      const b1 = findBone(clonedScene, cfg.bones[1]);
      const b2 = findBone(clonedScene, cfg.bones[2]);
      if (!carpal || !b0 || !b1 || !b2) {
        console.warn(`Missing bones for finger: ${name}`);
        return null;
      }
      fingers[name] = { carpal, bones: [b0, b1, b2] };
    }

    const t0 = findBone(clonedScene, THUMB_BONES[0]);
    const t1 = findBone(clonedScene, THUMB_BONES[1]);
    const t2 = findBone(clonedScene, THUMB_BONES[2]);
    if (!t0 || !t1 || !t2) {
      console.warn("Missing thumb bones");
      return null;
    }

    return { fingers, thumb: [t0, t1, t2] };
  }, [clonedScene]);

  // Store bind-pose quaternions (snapshot on first render)
  const bindPoses = useMemo<BindPoses | null>(() => {
    if (!boneRefs) return null;
    const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
    const fingers = {} as BindPoses["fingers"];

    for (const name of fingerNames) {
      const f = boneRefs.fingers[name];
      fingers[name] = {
        carpal: f.carpal.quaternion.clone(),
        bones: [
          f.bones[0].quaternion.clone(),
          f.bones[1].quaternion.clone(),
          f.bones[2].quaternion.clone(),
        ],
      };
    }

    const thumb: BindPoses["thumb"] = [
      boneRefs.thumb[0].quaternion.clone(),
      boneRefs.thumb[1].quaternion.clone(),
      boneRefs.thumb[2].quaternion.clone(),
    ];

    return { fingers, thumb };
  }, [boneRefs]);

  // Animation state — current interpolated pose
  const animState = useRef<AnimState>({
    index:  { ...RESTING_POSE.index },
    middle: { ...RESTING_POSE.middle },
    ring:   { ...RESTING_POSE.ring },
    pinky:  { ...RESTING_POSE.pinky },
    thumb:  { ...RESTING_POSE.thumb },
  });

  // Compute target pose
  const targetPose = useMemo<HandPose>(() => {
    return cm ? cmEntryToHandPose(cm) : RESTING_POSE;
  }, [cm]);

  // Animation loop
  useFrame((_, delta) => {
    if (!boneRefs || !bindPoses) return;

    const clampedDelta = Math.min(delta, 0.05);
    const factor = 1 - Math.pow(1 - 0.08, clampedDelta * 60);

    const state = animState.current;
    const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];

    // Lerp finger poses
    for (const name of fingerNames) {
      const s = state[name];
      const t = targetPose[name];
      s.carpalSpread += (t.carpalSpread - s.carpalSpread) * factor;
      s.mcpFlex += (t.mcpFlex - s.mcpFlex) * factor;
      s.pipFlex += (t.pipFlex - s.pipFlex) * factor;
      s.dipFlex += (t.dipFlex - s.dipFlex) * factor;

      // Apply to bones
      const refs = boneRefs.fingers[name];
      const bind = bindPoses.fingers[name];

      applyPose(refs.carpal, bind.carpal, 0, s.carpalSpread, 0);
      applyPose(refs.bones[0], bind.bones[0], s.mcpFlex, 0, 0);
      applyPose(refs.bones[1], bind.bones[1], s.pipFlex, 0, 0);
      applyPose(refs.bones[2], bind.bones[2], s.dipFlex, 0, 0);
    }

    // Lerp thumb pose
    const ts = state.thumb;
    const tt = targetPose.thumb;
    ts.cmcOpposition += (tt.cmcOpposition - ts.cmcOpposition) * factor;
    ts.cmcRotation += (tt.cmcRotation - ts.cmcRotation) * factor;
    ts.mcpFlex += (tt.mcpFlex - ts.mcpFlex) * factor;
    ts.ipFlex += (tt.ipFlex - ts.ipFlex) * factor;

    applyPose(boneRefs.thumb[0], bindPoses.thumb[0], 0, ts.cmcRotation, ts.cmcOpposition);
    applyPose(boneRefs.thumb[1], bindPoses.thumb[1], ts.mcpFlex, 0, 0);
    applyPose(boneRefs.thumb[2], bindPoses.thumb[2], ts.ipFlex, 0, 0);

    // Auto-rotate the whole group
    if (groupRef.current && autoRotate && !cm) {
      groupRef.current.rotation.y += clampedDelta * 0.4;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
