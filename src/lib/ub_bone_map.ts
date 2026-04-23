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
// ── Calibrated via vertex measurement on Lexsi mesh (lexsi.glb) ──────
//
// Head bone world: (0.002, 0.502, -0.008)
// Neck bone world: (0.002, 0.478, -0.013)
// Crown: y-offset +0.015 from Head
//
// Face surface z-offsets (from Head bone, measured via closest-vertex):
//   y+0.10 (eyebrow):    z = 0.026
//   y+0.08 (eye):        z = 0.048
//   y+0.06 (nose):       z = 0.054
//   y+0.04 (mouth):      z = 0.065
//   y+0.02 (chin):       z = 0.065
//   y+0.00 (jaw):        z = 0.058
//
// Head side widths (x-offset): 0.04-0.06
// Ear: x ≈ 0.06 at y+0.04
// Torso front z: ≈ 0.055
// Torso back z: ≈ -0.050

export interface BoneAnchor {
  boneName: string;
  offset: [number, number, number]; // local offset from bone in world-space
}

export const UB_BONE_MAP: Record<string, BoneAnchor> = {
  // ── HEAD region (on skull, not face) ──────────────────────────────

  // Ca — Cabeza (top-center of head, between crown and forehead)
  Ca: { boneName: "Head", offset: [0, 0.14, 0.06] },

  // Vx — Coronilla (very top of skull)
  Vx: { boneName: "Head", offset: [0, 0.16, 0.03] },

  // Par — Parietal (side of skull, ipsi)
  Par: { boneName: "Head", offset: [0.06, 0.12, 0.03] },

  // Te — Sien (temple)
  Te: { boneName: "Head", offset: [0.07, 0.08, 0.04] },

  // Au — Oreja (ear)
  Au: { boneName: "Head", offset: [0.07, 0.04, 0.0] },

  // LobAu — Lóbulo (earlobe)
  LobAu: { boneName: "Head", offset: [0.06, 0.01, 0.0] },

  // ── FACE region (front of head) ───────────────────────────────────

  // Fa — Cara (center of face)
  Fa: { boneName: "Head", offset: [0, 0.06, 0.07] },

  // Fr — Frente (forehead center)
  Fr: { boneName: "Head", offset: [0, 0.11, 0.05] },

  // IpsiFr — Frente-ipsi
  IpsiFr: { boneName: "Head", offset: [0.02, 0.11, 0.045] },

  // XFr — Frente-contra
  XFr: { boneName: "Head", offset: [-0.02, 0.11, 0.045] },

  // Ci — Ceja ipsi (eyebrow)
  Ci: { boneName: "Head", offset: [0.02, 0.10, 0.05] },

  // Su — Ceja contra (eyebrow)
  Su: { boneName: "Head", offset: [-0.02, 0.10, 0.05] },

  // Cin — Entrecejo (brow ridge center)
  Cin: { boneName: "Head", offset: [0, 0.10, 0.05] },

  // Oc — Ojo (eye)
  Oc: { boneName: "Head", offset: [0.02, 0.08, 0.06] },

  // RapOc — Rabillo del ojo (outer eye corner)
  RapOc: { boneName: "Head", offset: [0.04, 0.08, 0.05] },

  // OrbOc — Órbita ocular (above eye)
  OrbOc: { boneName: "Head", offset: [0.02, 0.09, 0.055] },

  // Na — Punta de nariz (nose tip)
  Na: { boneName: "Head", offset: [0, 0.06, 0.075] },

  // Sep — Puente nasal (nose bridge)
  Sep: { boneName: "Head", offset: [0, 0.07, 0.065] },

  // AlNa — Alas nasales (nasal wings)
  AlNa: { boneName: "Head", offset: [0.02, 0.06, 0.07] },

  // Po — Pómulo (cheekbone)
  Po: { boneName: "Head", offset: [0.04, 0.06, 0.06] },

  // Ge — Mejilla (cheek)
  Ge: { boneName: "Head", offset: [0.05, 0.04, 0.055] },

  // Os — Boca (mouth center)
  Os: { boneName: "Head", offset: [0, 0.04, 0.075] },

  // IpsiOs — Boca-ipsi
  IpsiOs: { boneName: "Head", offset: [0.02, 0.04, 0.07] },

  // XOs — Boca-contra
  XOs: { boneName: "Head", offset: [-0.02, 0.04, 0.07] },

  // La — Labio inferior (lower lip)
  La: { boneName: "Head", offset: [0, 0.03, 0.075] },

  // Lab — Labio superior (upper lip)
  Lab: { boneName: "Head", offset: [0, 0.05, 0.07] },

  // Lin — Lengua (tongue)
  Lin: { boneName: "Head", offset: [0, 0.04, 0.065] },

  // Den — Dientes (teeth)
  Den: { boneName: "Head", offset: [0, 0.04, 0.065] },

  // Col — Colmillo (canine)
  Col: { boneName: "Head", offset: [0.01, 0.04, 0.065] },

  // MedDen — Incisivos (front teeth)
  MedDen: { boneName: "Head", offset: [0, 0.04, 0.07] },

  // Me — Mentón (chin)
  Me: { boneName: "Head", offset: [0, 0.02, 0.075] },

  // ── NECK region ───────────────────────────────────────────────────

  // Ce — Nuca (back of neck)
  Ce: { boneName: "Neck", offset: [0, 0.0, -0.05] },

  // Gu — Garganta (throat)
  Gu: { boneName: "Head", offset: [0, -0.02, 0.05] },

  // Co — Cuello (neck front)
  Co: { boneName: "Neck", offset: [0, 0.0, 0.06] },

  // IpsiCo — Cuello-ipsi
  IpsiCo: { boneName: "Neck", offset: [0.03, 0.0, 0.05] },

  // ── TRUNK region ──────────────────────────────────────────────────

  // Cla - Clavicle
  Cla: { boneName: "LeftShoulder", offset: [-0.02, 0.0, 0.06] },

  // Um - Shoulder [frequent]
  Um: { boneName: "LeftArm", offset: [0.0, 0.0, 0.0] },

  // Pe - Chest [frequent]
  Pe: { boneName: "Spine2", offset: [0, 0.0, 0.07] },

  // XPe - Chest-contra
  XPe: { boneName: "Spine2", offset: [-0.04, 0.0, 0.07] },

  // IpsiPe - Chest-ipsi
  IpsiPe: { boneName: "Spine2", offset: [0.04, 0.0, 0.07] },

  // Cor - Heart (contra side)
  Cor: { boneName: "Spine2", offset: [-0.04, -0.01, 0.065] },

  // Es - Sternum
  Es: { boneName: "Spine2", offset: [0, -0.02, 0.07] },

  // To - Thorax (lower chest)
  To: { boneName: "Spine1", offset: [0, 0.02, 0.065] },

  // Cos - Ribs (side of ribs, ipsi)
  Cos: { boneName: "Spine1", offset: [0.05, 0.0, 0.05] },

  // Dor - Back (behind trunk)
  Dor: { boneName: "Spine2", offset: [0, 0.0, -0.06] },

  // Ve - Stomach [frequent]
  Ve: { boneName: "Spine", offset: [0, 0.0, 0.065] },

  // Abd - Abdomen (lower belly)
  Abd: { boneName: "Hips", offset: [0, 0.02, 0.065] },

  // Je - Liver (ipsi side)
  Je: { boneName: "Spine", offset: [0.04, -0.01, 0.06] },

  // Cit - Waist
  Cit: { boneName: "Hips", offset: [0.04, 0.01, 0.05] },

  // Cox - Hip
  Cox: { boneName: "LeftUpLeg", offset: [0.0, 0.02, 0.06] },

  // Fe - Thigh
  Fe: { boneName: "LeftUpLeg", offset: [0.0, -0.06, 0.06] },

  // Gen - Knee
  Gen: { boneName: "LeftLeg", offset: [0.0, 0.01, 0.04] },

  // ── ARM region ────────────────────────────────────────────────────

  // Br - Upper-arm [frequent]
  Br: { boneName: "LeftArm", offset: [0.0, -0.03, 0.0] },

  // IntBr - Arm-interior
  IntBr: { boneName: "LeftArm", offset: [-0.02, -0.03, 0.0] },

  // Cut - Elbow [frequent]
  Cut: { boneName: "LeftForeArm", offset: [0.0, 0.0, -0.02] },

  // ── FOREARM region ────────────────────────────────────────────────

  // Abr - Forearm [frequent]
  Abr: { boneName: "LeftForeArm", offset: [0.0, -0.03, 0.0] },

  // IntAbr - Forearm-interior
  IntAbr: { boneName: "LeftForeArm", offset: [-0.02, -0.03, 0.0] },

  // InfAbr - Forearm-lower
  InfAbr: { boneName: "LeftForeArm", offset: [0.0, -0.05, 0.0] },

  // RAAbr - Forearm-radial
  RAAbr: { boneName: "LeftForeArm", offset: [0.02, -0.02, 0.0] },

  // ExtAbr - Forearm-exterior
  ExtAbr: { boneName: "LeftForeArm", offset: [0.02, -0.03, 0.0] },

  // ── HAND region ───────────────────────────────────────────────────

  // Car - Wrist [frequent]
  Car: { boneName: "LeftHand", offset: [0.0, 0.0, 0.0] },

  // ExtCar - Wrist-exterior
  ExtCar: { boneName: "LeftHand", offset: [0.0, 0.0, -0.015] },

  // IntCar - Wrist-interior
  IntCar: { boneName: "LeftHand", offset: [0.0, 0.0, 0.015] },

  // Palma - Palm [frequent]
  Palma: { boneName: "LeftHand", offset: [0.0, -0.025, 0.015] },

  // ExtMano - Back-of-hand
  ExtMano: { boneName: "LeftHand", offset: [0.0, -0.025, -0.015] },

  // Dorso - Back-of-hand (dorsal)
  Dorso: { boneName: "LeftHand", offset: [0.0, -0.03, -0.015] },

  // D1 - Index-finger
  D1: { boneName: "LeftHand", offset: [0.01, -0.06, 0.0] },

  // D2 - Middle-finger
  D2: { boneName: "LeftHand", offset: [0.0, -0.065, 0.0] },

  // D3 - Ring-finger
  D3: { boneName: "LeftHand", offset: [-0.01, -0.06, 0.0] },

  // D4 - Pinky-finger
  D4: { boneName: "LeftHand", offset: [-0.02, -0.05, 0.0] },

  // PuntDed - Fingertips [frequent]
  PuntDed: { boneName: "LeftHand", offset: [0.005, -0.07, 0.0] },

  // Pol - Thumb
  Pol: { boneName: "LeftHand", offset: [0.025, -0.02, 0.01] },

  // IntDed - Fingers-interior
  IntDed: { boneName: "LeftHand", offset: [0.0, -0.05, 0.015] },

  // ExtDed - Fingers-exterior
  ExtDed: { boneName: "LeftHand", offset: [0.0, -0.05, -0.015] },

  // Nod - Knuckles
  Nod: { boneName: "LeftHand", offset: [0.0, -0.04, -0.01] },

  // Base - Hand-base (heel of palm)
  Base: { boneName: "LeftHand", offset: [0.0, -0.01, 0.015] },

  // Cub - Ulnar-side
  Cub: { boneName: "LeftHand", offset: [-0.02, -0.025, 0.0] },

  // RA - Radial-side
  RA: { boneName: "LeftHand", offset: [0.02, -0.025, 0.0] },

  // Gem - Fingertip-pad
  Gem: { boneName: "LeftHand", offset: [0.005, -0.07, 0.01] },

  // Ung - Nail
  Ung: { boneName: "LeftHand", offset: [0.005, -0.07, -0.01] },
};
