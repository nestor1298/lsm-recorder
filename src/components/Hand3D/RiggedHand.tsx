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
import { PALM_EULER, FINGER_ROLL, orientationToQuat } from "@/lib/orientation";

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

// Movement animation temps
const _mvPos = new THREE.Vector3();
const _mvEuler = new THREE.Euler();
const _mvQuat = new THREE.Quaternion();

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

// ── Orientation (imported from shared lib) ──────────────────────

interface OrientationTarget {
  palm: string;
  fingers: string;
}

// ── Movement → Position mapping ─────────────────────────────────

interface MovementTarget {
  contour: string;
  local: string | null;
  plane: string;
}

function contourOffset(
  contour: string,
  plane: string,
  t: number,
): [number, number, number] {
  const A = 0.35;
  let u = 0,
    v = 0;

  switch (contour) {
    case "STRAIGHT":
      u = Math.sin(t * 2) * A;
      break;
    case "ARC":
      u = Math.sin(t * 2) * A;
      v = -Math.abs(Math.cos(t * 2)) * A * 0.6 + A * 0.3;
      break;
    case "CIRCLE":
      u = Math.cos(t * 1.5) * A * 0.7;
      v = Math.sin(t * 1.5) * A * 0.7;
      break;
    case "ZIGZAG": {
      const p =
        (((t * 1.5) % (Math.PI * 2)) + Math.PI * 2) %
        (Math.PI * 2) /
        (Math.PI * 2);
      u =
        (p < 0.25 ? p * 4 : p < 0.75 ? 2 - p * 4 : p * 4 - 4) * A;
      v = Math.abs(Math.sin(t * 6)) * A * 0.3;
      break;
    }
    case "SEVEN": {
      const p =
        (((t * 1.2) % (Math.PI * 2)) + Math.PI * 2) %
        (Math.PI * 2) /
        (Math.PI * 2);
      if (p < 0.4) {
        u = ((p / 0.4) * 2 - 1) * A;
        v = A * 0.4;
      } else {
        const q = (p - 0.4) / 0.6;
        u = A - q * A * 1.5;
        v = A * 0.4 - q * A * 1.2;
      }
      break;
    }
  }

  let px = 0,
    py = 0,
    pz = 0;
  switch (plane) {
    case "HORIZONTAL": px = u; pz = v; break;
    case "VERTICAL":   px = u; py = v; break;
    case "SAGITTAL":   pz = u; py = v; break;
    case "OBLIQUE":    px = u * 0.7; py = v * 0.7; pz = u * 0.5; break;
  }

  return [px, py, pz];
}

interface RiggedHandProps {
  cm: CMEntry | null;
  autoRotate?: boolean;
  orientation?: OrientationTarget;
  movement?: MovementTarget;
}

export default function RiggedHand({ cm, autoRotate = false, orientation, movement }: RiggedHandProps) {
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

  // Compute target orientation quaternion
  const targetOrientQuat = useMemo(() => {
    if (!orientation) return null;
    return orientationToQuat(orientation.palm, orientation.fingers);
  }, [orientation]);

  // Animation loop
  useFrame((rs, delta) => {
    if (!boneRefs || !bindPoses) return;

    const clampedDelta = Math.min(delta, 0.05);
    const factor = 1 - Math.pow(1 - 0.08, clampedDelta * 60);

    const anim = animState.current;
    const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];

    // Lerp finger poses
    for (const name of fingerNames) {
      const s = anim[name];
      const t = targetPose[name];
      s.carpalSpread += (t.carpalSpread - s.carpalSpread) * factor;
      s.mcpFlex += (t.mcpFlex - s.mcpFlex) * factor;
      s.pipFlex += (t.pipFlex - s.pipFlex) * factor;
      s.dipFlex += (t.dipFlex - s.dipFlex) * factor;

      const refs = boneRefs.fingers[name];
      const bind = bindPoses.fingers[name];

      applyPose(refs.carpal, bind.carpal, 0, s.carpalSpread, 0);
      applyPose(refs.bones[0], bind.bones[0], -s.mcpFlex, 0, 0);
      applyPose(refs.bones[1], bind.bones[1], -s.pipFlex, 0, 0);
      applyPose(refs.bones[2], bind.bones[2], -s.dipFlex, 0, 0);
    }

    // Lerp thumb pose
    const ts = anim.thumb;
    const tt = targetPose.thumb;
    ts.cmcOpposition += (tt.cmcOpposition - ts.cmcOpposition) * factor;
    ts.cmcRotation += (tt.cmcRotation - ts.cmcRotation) * factor;
    ts.mcpFlex += (tt.mcpFlex - ts.mcpFlex) * factor;
    ts.ipFlex += (tt.ipFlex - ts.ipFlex) * factor;

    applyPose(boneRefs.thumb[0], bindPoses.thumb[0], ts.cmcOpposition, ts.cmcRotation, 0);
    applyPose(boneRefs.thumb[1], bindPoses.thumb[1], -ts.mcpFlex, 0, 0);
    applyPose(boneRefs.thumb[2], bindPoses.thumb[2], -ts.ipFlex, 0, 0);

    // ── Group position & rotation ──────────────────────────────
    if (!groupRef.current) return;

    if (movement) {
      const t = rs.clock.elapsedTime;

      // ─ Contour: move hand along trajectory path ─
      const [cpx, cpy, cpz] = contourOffset(movement.contour, movement.plane, t);
      _mvPos.set(cpx, cpy, cpz);

      // Vibrate / Rub: add jitter on top of contour
      if (movement.local === "VIBRATE") {
        _mvPos.x += Math.sin(t * 25) * 0.015;
        _mvPos.y += Math.cos(t * 22) * 0.015;
      }
      if (movement.local === "RUB") {
        _mvPos.x += Math.sin(t * 6) * 0.04;
      }

      groupRef.current.position.lerp(_mvPos, factor * 4);

      // ─ Group rotation from wrist-level local movements ─
      let lrx = 0, lry = 0, lrz = 0;
      switch (movement.local) {
        case "CIRCULAR": lrx = Math.sin(t * 3) * 0.15; lrz = Math.cos(t * 3) * 0.15; break;
        case "TWIST":    lrz = Math.sin(t * 3) * 0.4; break;
        case "NOD":      lrx = Math.sin(t * 3) * 0.3; break;
        case "OSCILLATE": lry = Math.sin(t * 4) * 0.25; break;
      }
      _mvEuler.set(lrx, lry, lrz, "XYZ");
      _mvQuat.setFromEuler(_mvEuler);
      groupRef.current.quaternion.slerp(_mvQuat, factor * 4);

      // ─ Finger-level local movements (on top of resting pose) ─
      switch (movement.local) {
        case "WIGGLE":
          for (let i = 0; i < fingerNames.length; i++) {
            boneRefs.fingers[fingerNames[i]].bones[0].rotateX(
              -Math.sin(t * 10 + i * 1.2) * 0.3,
            );
          }
          break;
        case "SCRATCH":
          for (const name of fingerNames) {
            boneRefs.fingers[name].bones[2].rotateX(-Math.sin(t * 14) * 0.2);
          }
          break;
        case "RELEASE": {
          const rp = (Math.sin(t * 2) + 1) / 2;
          for (const name of fingerNames) {
            boneRefs.fingers[name].bones[0].rotateX(-rp * 1.0);
            boneRefs.fingers[name].bones[1].rotateX(-rp * 0.7);
            boneRefs.fingers[name].bones[2].rotateX(-rp * 0.4);
          }
          break;
        }
        case "FLATTEN": {
          const fp = (Math.sin(t * 2.5) + 1) / 2;
          for (const name of fingerNames) {
            boneRefs.fingers[name].bones[0].rotateX(fp * 0.25);
          }
          break;
        }
        case "PROGRESSIVE":
          for (let i = 0; i < fingerNames.length; i++) {
            const pp = Math.max(0, Math.sin(t * 2.5 - i * 0.7));
            boneRefs.fingers[fingerNames[i]].bones[0].rotateX(-pp * 0.9);
            boneRefs.fingers[fingerNames[i]].bones[1].rotateX(-pp * 0.7);
          }
          break;
        case "RUB":
          for (const name of fingerNames) {
            boneRefs.fingers[name].bones[0].rotateX(-Math.sin(t * 6) * 0.12);
          }
          break;
      }
    } else if (targetOrientQuat) {
      // Orientation mode
      groupRef.current.quaternion.slerp(targetOrientQuat, factor * 2);
      _mvPos.set(0, 0, 0);
      groupRef.current.position.lerp(_mvPos, factor);
    } else {
      // Default: reset position, optional auto-rotate
      _mvPos.set(0, 0, 0);
      groupRef.current.position.lerp(_mvPos, factor);
      if (autoRotate && !cm) {
        groupRef.current.rotation.y += clampedDelta * 0.4;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
