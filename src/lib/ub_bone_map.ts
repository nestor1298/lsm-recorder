// UB (Ubicación) -> 3D Bone Anchor Map
// Maps 80 UB phonological location codes to skeleton bones + local offsets.
//
// Coordinate system (world-space):
//   x: positive = avatar's left (signer's right / ipsi side for RH-dominant)
//   y: positive = up
//   z: positive = forward (toward viewer)
//
// Dominant hand (ipsi) maps to avatar LEFT side (positive x).
// Contralateral (contra) maps to avatar RIGHT side (negative x).
//
// ── Calibrated via raycasting on wscharacter.glb mesh ──────────────
//
// Head bone world: (0, 0.502, -0.057)
// Neck bone world: (0, 0.405, -0.063)
// Crown (top mesh): y-offset +0.747  (world y = 1.249)
//
// Face surface z-offsets (from Head bone, measured via outside-in raycasts):
//   y+0.42 (top forehead): z = 0.36
//   y+0.38 (forehead):     z = 0.37
//   y+0.33 (eyebrow):      z = 0.36-0.38
//   y+0.30 (eye):          z = 0.38
//   y+0.26 (nose bridge):  z = 0.44  ← most forward (round cartoon face)
//   y+0.24 (face center):  z = 0.42
//   y+0.20 (nose tip):     z = 0.39
//   y+0.16 (upper lip):    z = 0.38
//   y+0.14 (mouth):        z = 0.38
//   y+0.12 (lower lip):    z = 0.37
//   y+0.05 (chin front):   z = 0.32
//   y+0.00 (chin low):     z = 0.22
//
// Head side widths (x-offset):
//   y+0.10: 0.149   y+0.20: 0.170   y+0.30: 0.187   y+0.40: 0.200
//
// Ear: [±0.154, +0.15, 0.0]  Temple: [±0.186, +0.29, +0.06]
// Cheek: [±0.163, +0.12, +0.10]  Back-of-head: z = -0.27

export interface BoneAnchor {
  boneName: string;
  offset: [number, number, number]; // local offset from bone in world-space
}

export const UB_BONE_MAP: Record<string, BoneAnchor> = {
  // ── HEAD region (on skull, not face) ──────────────────────────────

  // Ca — Cabeza (top-center of head, between crown and forehead)
  Ca: { boneName: "Head", offset: [0, 0.50, 0.18] },

  // Vx — Coronilla (very top of skull, measured crown at y+0.747)
  Vx: { boneName: "Head", offset: [0, 0.70, 0.0] },

  // Par — Parietal (side of skull, ipsi, measured side width at y+0.50 ≈ 0.20)
  Par: { boneName: "Head", offset: [0.16, 0.50, 0.0] },

  // Te — Sien (temple, measured at [0.186, +0.29, +0.06])
  Te: { boneName: "Head", offset: [0.18, 0.29, 0.06] },

  // Au — Oreja (ear, measured at [0.154, +0.15, 0.0])
  Au: { boneName: "Head", offset: [0.15, 0.15, -0.02] },

  // LobAu — Lóbulo (earlobe, below ear)
  LobAu: { boneName: "Head", offset: [0.14, 0.08, -0.02] },

  // ── FACE region (front of head) ───────────────────────────────────

  // Fa — Cara (center of face, measured at y+0.24, z=0.42)
  Fa: { boneName: "Head", offset: [0, 0.24, 0.42] },

  // Fr — Frente (forehead center, measured at y+0.38, z=0.37)
  Fr: { boneName: "Head", offset: [0, 0.38, 0.37] },

  // IpsiFr — Frente-ipsi (measured at [+0.06, +0.38, +0.35])
  IpsiFr: { boneName: "Head", offset: [0.06, 0.38, 0.35] },

  // XFr — Frente-contra (measured at [-0.06, +0.38, +0.35])
  XFr: { boneName: "Head", offset: [-0.06, 0.38, 0.35] },

  // Ci — Ceja ipsi (eyebrow, measured at [+0.05, +0.33, +0.36])
  Ci: { boneName: "Head", offset: [0.05, 0.33, 0.36] },

  // Su — Ceja contra (eyebrow, measured at [-0.05, +0.33, +0.36])
  Su: { boneName: "Head", offset: [-0.05, 0.33, 0.36] },

  // Cin — Entrecejo (brow ridge center, measured at [0, +0.33, +0.38])
  Cin: { boneName: "Head", offset: [0, 0.33, 0.38] },

  // Oc — Ojo (eye, measured at [+0.04, +0.30, +0.38])
  Oc: { boneName: "Head", offset: [0.04, 0.30, 0.38] },

  // RapOc — Rabillo del ojo (outer eye corner, measured at [+0.08, +0.30, +0.35])
  RapOc: { boneName: "Head", offset: [0.08, 0.30, 0.35] },

  // OrbOc — Órbita ocular (above eye, measured at [+0.04, +0.32, +0.37])
  OrbOc: { boneName: "Head", offset: [0.04, 0.32, 0.37] },

  // Na — Punta de nariz (nose tip, measured at [0, +0.20, +0.39])
  Na: { boneName: "Head", offset: [0, 0.20, 0.39] },

  // Sep — Puente nasal (nose bridge, measured at [0, +0.26, +0.44])
  Sep: { boneName: "Head", offset: [0, 0.26, 0.44] },

  // AlNa — Alas nasales (nasal wings, measured at [+0.04, +0.20, +0.39])
  AlNa: { boneName: "Head", offset: [0.04, 0.20, 0.39] },

  // Po — Pómulo (cheekbone, measured at [+0.08, +0.24, +0.37])
  Po: { boneName: "Head", offset: [0.08, 0.24, 0.37] },

  // Ge — Mejilla (cheek, between cheek side [0.163,+0.12] and front)
  Ge: { boneName: "Head", offset: [0.10, 0.16, 0.32] },

  // Os — Boca (mouth center, measured at [0, +0.14, +0.38])
  Os: { boneName: "Head", offset: [0, 0.14, 0.38] },

  // IpsiOs — Boca-ipsi (measured at [+0.04, +0.14, +0.37])
  IpsiOs: { boneName: "Head", offset: [0.04, 0.14, 0.37] },

  // XOs — Boca-contra (measured at [-0.04, +0.14, +0.37])
  XOs: { boneName: "Head", offset: [-0.04, 0.14, 0.37] },

  // La — Labio inferior (lower lip, measured at [0, +0.12, +0.37])
  La: { boneName: "Head", offset: [0, 0.12, 0.37] },

  // Lab — Labio superior (upper lip, measured at [0, +0.16, +0.38])
  Lab: { boneName: "Head", offset: [0, 0.16, 0.38] },

  // Lin — Lengua (tongue, slightly behind mouth surface)
  Lin: { boneName: "Head", offset: [0, 0.14, 0.35] },

  // Den — Dientes (teeth, at mouth level, slightly behind lips)
  Den: { boneName: "Head", offset: [0, 0.14, 0.35] },

  // Col — Colmillo (canine, side of mouth)
  Col: { boneName: "Head", offset: [0.03, 0.14, 0.35] },

  // MedDen — Incisivos (front teeth, at mouth level)
  MedDen: { boneName: "Head", offset: [0, 0.14, 0.36] },

  // Me — Mentón (chin, measured at [0, +0.05, +0.32])
  Me: { boneName: "Head", offset: [0, 0.05, 0.32] },

  // ── NECK region ───────────────────────────────────────────────────

  // Ce — Nuca (back of neck, measured back-of-head z = -0.27)
  Ce: { boneName: "Neck", offset: [0, 0.0, -0.10] },

  // Gu — Garganta (below chin / throat, measured at [0, -0.024, +0.10])
  Gu: { boneName: "Head", offset: [0, -0.02, 0.10] },

  // Co — Cuello (neck front)
  Co: { boneName: "Neck", offset: [0, 0.0, 0.12] },

  // IpsiCo — Cuello-ipsi
  IpsiCo: { boneName: "Neck", offset: [0.05, 0.0, 0.10] },

  // ── TRUNK region ──────────────────────────────────────────────────

  // Cla - Clavicle
  Cla: { boneName: "LeftShoulder", offset: [-0.04, 0.0, 0.12] },

  // Um - Shoulder [frequent]
  Um: { boneName: "LeftArm", offset: [0.0, 0.0, 0.0] },

  // Pe - Chest [frequent]
  Pe: { boneName: "Spine2", offset: [0, 0.0, 0.18] },

  // XPe - Chest-contra
  XPe: { boneName: "Spine2", offset: [-0.08, 0.0, 0.18] },

  // IpsiPe - Chest-ipsi
  IpsiPe: { boneName: "Spine2", offset: [0.08, 0.0, 0.18] },

  // Cor - Heart (left chest — avatar's right, signer's left, contra side)
  Cor: { boneName: "Spine2", offset: [-0.08, -0.02, 0.17] },

  // Es - Sternum
  Es: { boneName: "Spine2", offset: [0, -0.04, 0.18] },

  // To - Thorax (lower chest)
  To: { boneName: "Spine1", offset: [0, 0.04, 0.18] },

  // Cos - Ribs (side of ribs, ipsi side)
  Cos: { boneName: "Spine1", offset: [0.10, 0.0, 0.14] },

  // Dor - Back (behind trunk)
  Dor: { boneName: "Spine2", offset: [0, 0.0, -0.12] },

  // Ve - Stomach [frequent]
  Ve: { boneName: "Spine", offset: [0, 0.0, 0.18] },

  // Abd - Abdomen (lower belly)
  Abd: { boneName: "Hips", offset: [0, 0.04, 0.18] },

  // Je - Liver (right side of body = avatar's left = signer's right = ipsi)
  Je: { boneName: "Spine", offset: [0.07, -0.02, 0.16] },

  // Cit - Waist
  Cit: { boneName: "Hips", offset: [0.08, 0.02, 0.12] },

  // Cox - Hip
  Cox: { boneName: "LeftUpLeg", offset: [0.0, 0.04, 0.10] },

  // Fe - Thigh
  Fe: { boneName: "LeftUpLeg", offset: [0.0, -0.12, 0.10] },

  // Gen - Knee
  Gen: { boneName: "LeftLeg", offset: [0.0, 0.02, 0.10] },

  // ── ARM region ────────────────────────────────────────────────────

  // Br - Upper-arm [frequent]
  Br: { boneName: "LeftArm", offset: [0.0, -0.06, 0.0] },

  // IntBr - Arm-interior (inside of upper arm, facing body = negative x)
  IntBr: { boneName: "LeftArm", offset: [-0.04, -0.06, 0.0] },

  // Cut - Elbow [frequent]
  Cut: { boneName: "LeftForeArm", offset: [0.0, 0.0, -0.04] },

  // ── FOREARM region ────────────────────────────────────────────────

  // Abr - Forearm [frequent]
  Abr: { boneName: "LeftForeArm", offset: [0.0, -0.06, 0.0] },

  // IntAbr - Forearm-interior (facing body = negative x)
  IntAbr: { boneName: "LeftForeArm", offset: [-0.04, -0.06, 0.0] },

  // InfAbr - Forearm-lower (closer to wrist)
  InfAbr: { boneName: "LeftForeArm", offset: [0.0, -0.10, 0.0] },

  // RAAbr - Forearm-radial (thumb side = positive x on left arm)
  RAAbr: { boneName: "LeftForeArm", offset: [0.04, -0.04, 0.0] },

  // ExtAbr - Forearm-exterior (facing away from body = positive x)
  ExtAbr: { boneName: "LeftForeArm", offset: [0.04, -0.06, 0.0] },

  // ── HAND region ───────────────────────────────────────────────────

  // Car - Wrist [frequent]
  Car: { boneName: "LeftHand", offset: [0.0, 0.0, 0.0] },

  // ExtCar - Wrist-exterior (dorsal side of wrist)
  ExtCar: { boneName: "LeftHand", offset: [0.0, 0.0, -0.03] },

  // IntCar - Wrist-interior (palmar side of wrist)
  IntCar: { boneName: "LeftHand", offset: [0.0, 0.0, 0.03] },

  // Palma - Palm [frequent]
  Palma: { boneName: "LeftHand", offset: [0.0, -0.05, 0.03] },

  // ExtMano - Back-of-hand
  ExtMano: { boneName: "LeftHand", offset: [0.0, -0.05, -0.03] },

  // Dorso - Back-of-hand (dorsal)
  Dorso: { boneName: "LeftHand", offset: [0.0, -0.06, -0.03] },

  // D1 - Index-finger
  D1: { boneName: "LeftHand", offset: [0.02, -0.12, 0.0] },

  // D2 - Middle-finger
  D2: { boneName: "LeftHand", offset: [0.0, -0.13, 0.0] },

  // D3 - Ring-finger
  D3: { boneName: "LeftHand", offset: [-0.02, -0.12, 0.0] },

  // D4 - Pinky-finger
  D4: { boneName: "LeftHand", offset: [-0.04, -0.10, 0.0] },

  // PuntDed - Fingertips [frequent]
  PuntDed: { boneName: "LeftHand", offset: [0.01, -0.14, 0.0] },

  // Pol - Thumb
  Pol: { boneName: "LeftHand", offset: [0.05, -0.04, 0.02] },

  // IntDed - Fingers-interior (palmar side of fingers)
  IntDed: { boneName: "LeftHand", offset: [0.0, -0.10, 0.03] },

  // ExtDed - Fingers-exterior (dorsal side of fingers)
  ExtDed: { boneName: "LeftHand", offset: [0.0, -0.10, -0.03] },

  // Nod - Knuckles
  Nod: { boneName: "LeftHand", offset: [0.0, -0.08, -0.02] },

  // Base - Hand-base (heel of palm)
  Base: { boneName: "LeftHand", offset: [0.0, -0.02, 0.03] },

  // Cub - Ulnar-side (pinky side = negative x on left arm)
  Cub: { boneName: "LeftHand", offset: [-0.04, -0.05, 0.0] },

  // RA - Radial-side (thumb side = positive x on left arm)
  RA: { boneName: "LeftHand", offset: [0.04, -0.05, 0.0] },

  // Gem - Fingertip-pad (palmar side of fingertip)
  Gem: { boneName: "LeftHand", offset: [0.01, -0.14, 0.02] },

  // Ung - Nail (dorsal side of fingertip)
  Ung: { boneName: "LeftHand", offset: [0.01, -0.14, -0.02] },
};
