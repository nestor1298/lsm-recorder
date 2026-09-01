/**
 * Headless FK solver — computes arm joint angles for all UB points
 * using Node.js + three.js without needing a browser/WebGL.
 *
 * Usage: node scripts/solve_fk_headless.mjs
 */

// Polyfill browser globals for three.js in Node
import { Blob } from "buffer";
globalThis.self = globalThis;
globalThis.Blob = Blob;
globalThis.document = { createElementNS: () => ({ style: {} }) };
globalThis.window = globalThis;

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.join(__dirname, "../public/models/lexsi.glb");

// ── UB Bone Map (inline subset for solving) ───────────────────────
// Import dynamically would need TS compilation; inline the essential data
const UB_BONE_MAP_DATA = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../src/lib/ub_bone_map_data.json"), "utf-8"
));

// ── Arm FK types and solver ────────────────────────────────────────

const ARM_ROM_LIMITS = {
  clavShrug:     { min: -5,  max: 18 },
  clavProtract:  { min: 0,   max: 12 },
  shoulderSwing: { min: -50, max: 150 },
  shoulderElev:  { min: -50, max: 150 },
  shoulderTwist: { min: -90, max: 90 },
  elbowFlex:     { min: 0,   max: 140 },
  forearmTwist:  { min: -80, max: 80 },
  wristFlex:     { min: -60, max: 60 },
  wristDeviation:{ min: -20, max: 30 },
};

const JOINTS = [
  "shoulderSwing", "shoulderElev", "elbowFlex",
  "shoulderTwist", "clavShrug", "clavProtract",
  "forearmTwist", "wristFlex", "wristDeviation",
];

function defaultAngles() {
  return {
    clavShrug: 0, clavProtract: 0,
    shoulderSwing: 0, shoulderElev: 0, shoulderTwist: 0,
    elbowFlex: 0, forearmTwist: 0,
    wristFlex: 0, wristDeviation: 0,
  };
}

// ── Apply FK angles to arm bones ──────────────────────────────────

const DEG = Math.PI / 180;
const _euler = new THREE.Euler();
const _delta = new THREE.Quaternion();

function applyArmFK(angles, refs, bind, isLeft) {
  const sign = isLeft ? 1 : -1;

  // Clavicle
  _euler.set(0, angles.clavProtract * DEG * sign, angles.clavShrug * DEG * sign, "XYZ");
  _delta.setFromEuler(_euler);
  refs.clavicle.quaternion.copy(bind.clavicle).multiply(_delta);

  // Shoulder (YXZ)
  _euler.set(angles.shoulderElev * DEG, angles.shoulderSwing * DEG * sign, angles.shoulderTwist * DEG * sign, "YXZ");
  _delta.setFromEuler(_euler);
  refs.upperArm.quaternion.copy(bind.upperArm).multiply(_delta);

  // Forearm
  _euler.set(-angles.elbowFlex * DEG, angles.forearmTwist * DEG * sign, 0, "XYZ");
  _delta.setFromEuler(_euler);
  refs.foreArm.quaternion.copy(bind.foreArm).multiply(_delta);

  // Hand
  _euler.set(-angles.wristFlex * DEG, 0, angles.wristDeviation * DEG * sign, "XYZ");
  _delta.setFromEuler(_euler);
  refs.hand.quaternion.copy(bind.hand).multiply(_delta);
}

// ── Coordinate descent solver ─────────────────────────────────────

function coordinateDescentPass(applyAndMeasure, startAngles, samples, iterations) {
  const angles = { ...startAngles };
  for (let iter = 0; iter < iterations; iter++) {
    for (const joint of JOINTS) {
      const rom = ARM_ROM_LIMITS[joint];
      let bestVal = angles[joint];
      let bestDist = applyAndMeasure(angles);
      const fullRange = rom.max - rom.min;
      const range = iter === 0 ? fullRange : Math.max(8, fullRange / (iter * 2));
      const center = iter === 0 ? (rom.min + rom.max) / 2 : angles[joint];
      const lo = Math.max(rom.min, center - range / 2);
      const hi = Math.min(rom.max, center + range / 2);
      for (let s = 0; s <= samples; s++) {
        const val = Math.round(lo + (hi - lo) * (s / samples));
        angles[joint] = val;
        const dist = applyAndMeasure(angles);
        if (dist < bestDist) { bestDist = dist; bestVal = val; }
      }
      angles[joint] = bestVal;
      if (bestDist < 0.015) break;
    }
  }
  return { angles, distance: applyAndMeasure(angles) };
}

function solveFKMultiRestart(applyAndMeasure) {
  const STARTS = [
    defaultAngles(),
    { ...defaultAngles(), shoulderSwing: 90, elbowFlex: 90, shoulderElev: 30 },
    { ...defaultAngles(), shoulderSwing: 130, shoulderElev: 60, elbowFlex: 60 },
    { ...defaultAngles(), shoulderSwing: -30, shoulderElev: -40, elbowFlex: 90 },
    { ...defaultAngles(), shoulderSwing: 60, shoulderElev: -40, elbowFlex: 110, shoulderTwist: 45 },
    { ...defaultAngles(), shoulderSwing: 40, shoulderElev: -30, elbowFlex: 120 },
  ];
  let best = { angles: defaultAngles(), distance: Infinity };
  for (const start of STARTS) {
    const result = coordinateDescentPass(applyAndMeasure, start, 36, 7);
    if (result.distance < best.distance) best = result;
    if (best.distance < 0.02) break;
  }
  return best;
}

// ── Compute hand centroid ─────────────────────────────────────────

const FINGER_NAMES = ["Index", "Middle", "Ring", "Pinky"];
const _tmp = new THREE.Vector3();

function computeHandCentroid(boneMap) {
  const centroid = new THREE.Vector3();
  let count = 0;

  for (const fname of FINGER_NAMES) {
    for (let i = 1; i <= 4; i++) {
      const bone = boneMap.get(`LeftHand${fname}${i}`);
      if (bone) {
        bone.getWorldPosition(_tmp);
        centroid.add(_tmp);
        count++;
      }
    }
  }
  // Thumb
  for (let i = 1; i <= 3; i++) {
    const bone = boneMap.get(`LeftHandThumb${i}`);
    if (bone) {
      bone.getWorldPosition(_tmp);
      centroid.add(_tmp);
      count++;
    }
  }

  return count > 0 ? centroid.divideScalar(count) : centroid;
}

// ── Load model and solve ──────────────────────────────────────────

async function main() {
  console.log("Loading GLB model...");

  // Read GLB as ArrayBuffer
  const buffer = fs.readFileSync(MODEL_PATH);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  // Parse GLB
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, "", resolve, reject);
  });

  const scene = gltf.scene;

  // Auto-scale like the app does
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const s = 2.5 / maxDim;
  scene.scale.setScalar(s);
  scene.position.set(-center.x * s, -center.y * s, -center.z * s);
  scene.updateMatrixWorld(true);

  console.log(`Scene scale: ${s.toFixed(4)} (maxDim=${maxDim.toFixed(4)})`);

  // Build bone map
  const boneMap = new Map();
  scene.traverse((child) => {
    if (child.isBone) {
      boneMap.set(child.name, child);
    }
  });
  console.log(`Found ${boneMap.size} bones`);

  // Get arm refs and bind poses
  const armRefs = {
    clavicle: boneMap.get("LeftShoulder"),
    upperArm: boneMap.get("LeftArm"),
    foreArm: boneMap.get("LeftForeArm"),
    hand: boneMap.get("LeftHand"),
  };

  if (!armRefs.clavicle || !armRefs.upperArm || !armRefs.foreArm || !armRefs.hand) {
    console.error("Missing arm bones!");
    console.log("Available bones:", [...boneMap.keys()].join(", "));
    process.exit(1);
  }

  // Snapshot bind poses
  const armBind = {
    clavicle: armRefs.clavicle.quaternion.clone(),
    upperArm: armRefs.upperArm.quaternion.clone(),
    foreArm: armRefs.foreArm.quaternion.clone(),
    hand: armRefs.hand.quaternion.clone(),
  };

  // Get world scale for offset multiplication
  const worldScale = new THREE.Vector3();
  armRefs.clavicle.getWorldScale(worldScale);
  console.log(`Bone world scale: ${worldScale.x.toFixed(4)}`);

  // Head position for verification
  const headBone = boneMap.get("Head");
  if (headBone) {
    const hp = new THREE.Vector3();
    headBone.getWorldPosition(hp);
    console.log(`Head world position: (${hp.x.toFixed(4)}, ${hp.y.toFixed(4)}, ${hp.z.toFixed(4)})`);
  }

  // ── Solve each UB code ──────────────────────────────────────────

  // Codes to solve (exclude arm/forearm/hand which are on the moving arm)
  const SKIP_REGIONS = ["ARM", "FOREARM", "HAND", "NEUTRAL_SPACE"];
  const ARM_BONE_NAMES = new Set(["LeftArm", "LeftForeArm", "LeftHand",
    "RightArm", "RightForeArm", "RightHand",
    "LeftShoulder", "RightShoulder"]);

  const codes = Object.keys(UB_BONE_MAP_DATA);
  console.log(`\nSolving ${codes.length} UB codes...`);

  const results = [];
  const _boneWorldPos = new THREE.Vector3();
  const _offsetVec = new THREE.Vector3();
  const _surfaceDir = new THREE.Vector3();

  for (const code of codes) {
    const anchor = UB_BONE_MAP_DATA[code];
    if (!anchor) continue;

    // Skip arm/hand bones (can't reach yourself)
    if (ARM_BONE_NAMES.has(anchor.boneName)) continue;

    const bone = boneMap.get(anchor.boneName);
    if (!bone) {
      console.log(`  ${code}: bone "${anchor.boneName}" not found, skipping`);
      continue;
    }

    // Compute UB world position WITH surface offset (matching app logic)
    bone.updateWorldMatrix(true, false);
    bone.getWorldPosition(_boneWorldPos);

    bone.getWorldScale(worldScale);
    _offsetVec.set(
      anchor.offset[0] * worldScale.x,
      anchor.offset[1] * worldScale.y,
      anchor.offset[2] * worldScale.z,
    );
    const ubWorldPos = _boneWorldPos.clone().add(_offsetVec);

    // Add surface offset (8cm outward) like the auto-solver does
    const offsetLen = _offsetVec.length();
    if (offsetLen > 0.001) {
      _surfaceDir.copy(_offsetVec);
      if (anchor.boneName === "Head") {
        _surfaceDir.y *= 0.3;
        if (_surfaceDir.lengthSq() < 0.001) _surfaceDir.set(0, 1, 0);
      }
      _surfaceDir.normalize();
      ubWorldPos.addScaledVector(_surfaceDir, 0.08 * worldScale.x);
    }

    // Solve
    const applyAndMeasure = (testAngles) => {
      applyArmFK(testAngles, armRefs, armBind, true);
      armRefs.clavicle.updateWorldMatrix(true, true);
      const centroid = computeHandCentroid(boneMap);
      return centroid.distanceTo(ubWorldPos);
    };

    const { angles, distance } = solveFKMultiRestart(applyAndMeasure);

    // Restore bind pose
    armRefs.clavicle.quaternion.copy(armBind.clavicle);
    armRefs.upperArm.quaternion.copy(armBind.upperArm);
    armRefs.foreArm.quaternion.copy(armBind.foreArm);
    armRefs.hand.quaternion.copy(armBind.hand);

    const distCm = (distance * 100).toFixed(1);
    const status = distance < 0.08 ? "OK" : distance < 0.15 ? "WARN" : "FAR";
    console.log(`  ${code.padEnd(8)} ${distCm.padStart(6)}cm  ${status}  sw=${angles.shoulderSwing} el=${angles.shoulderElev} ef=${angles.elbowFlex}`);

    results.push({
      code,
      dist: +distCm,
      angles,
    });
  }

  // ── Output results ──────────────────────────────────────────────

  // Sort by distance
  results.sort((a, b) => a.dist - b.dist);

  const good = results.filter(r => r.dist < 8).length;
  const warn = results.filter(r => r.dist >= 8 && r.dist < 15).length;
  const bad = results.filter(r => r.dist >= 15).length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${good} OK (<8cm), ${warn} WARN (8-15cm), ${bad} FAR (>15cm)`);
  console.log(`Total: ${results.length} codes solved`);

  // Generate TypeScript preset code
  const presetLines = results
    .filter(r => r.dist < 15) // exclude unreachable
    .map(r => {
      const a = r.angles;
      const pad = (n) => String(n).padStart(4);
      return `  ${r.code.padEnd(8)}: a(${pad(a.shoulderSwing)},${pad(a.shoulderElev)},${pad(a.elbowFlex)},${pad(a.shoulderTwist)},${pad(a.clavShrug)},${pad(a.clavProtract)},${pad(a.forearmTwist)},${pad(a.wristFlex)},${pad(a.wristDeviation)}),  // ${r.dist}cm`;
    });

  const outPath = path.join(__dirname, "../src/lib/ub_fk_presets_lexsi.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to: ${outPath}`);

  // Also write the preset TypeScript snippet
  const tsSnippet = presetLines.join("\n");
  const tsPath = path.join(__dirname, "../src/lib/ub_fk_presets_lexsi.txt");
  fs.writeFileSync(tsPath, tsSnippet);
  console.log(`Preset snippet written to: ${tsPath}`);
}

main().catch(console.error);
