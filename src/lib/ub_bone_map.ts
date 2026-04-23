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

  // Ca — Cabeza (top-center of head, crown at y+0.015)
  Ca: { boneName: "Head", offset: [0, 0.013, 0.03] },

  // Vx — Coronilla (very top of skull, crown at y+0.015)
  Vx: { boneName: "Head", offset: [0, 0.016, 0.0] },

  // Par — Parietal (side of skull, ipsi)
  Par: { boneName: "Head", offset: [0.05, 0.012, 0.0] },

  // Te — Sien (temple, at y+0.08 head width=0.045)
  Te: { boneName: "Head", offset: [0.05, 0.008, 0.03] },

  // Au — Oreja (ear, at y+0.04 head width=0.063)
  Au: { boneName: "Head", offset: [0.065, 0.004, -0.01] },

  // LobAu — Lóbulo (earlobe)
  LobAu: { boneName: "Head", offset: [0.06, 0.001, -0.01] },

  // ── FACE region (front of head) ───────────────────────────────────
  // Lexsi face: z-offsets 0.045-0.065 from Head bone
  // Face features span y-0.02 (jaw) to y+0.11 (forehead)

  // Fa — Cara (center of face, y+0.06 z=0.054)
  Fa: { boneName: "Head", offset: [0, 0.006, 0.06] },

  // Fr — Frente (forehead center, y+0.11 z=0.007)
  Fr: { boneName: "Head", offset: [0, 0.011, 0.03] },

  // IpsiFr — Frente-ipsi
  IpsiFr: { boneName: "Head", offset: [0.02, 0.011, 0.025] },

  // XFr — Frente-contra
  XFr: { boneName: "Head", offset: [-0.02, 0.011, 0.025] },

  // Ci — Ceja ipsi (eyebrow, y+0.10 z=0.026)
  Ci: { boneName: "Head", offset: [0.02, 0.010, 0.03] },

  // Su — Ceja contra (eyebrow)
  Su: { boneName: "Head", offset: [-0.02, 0.010, 0.03] },

  // Cin — Entrecejo (brow ridge center)
  Cin: { boneName: "Head", offset: [0, 0.010, 0.03] },

  // Oc — Ojo (eye, y+0.08 z=0.048)
  Oc: { boneName: "Head", offset: [0.02, 0.008, 0.05] },

  // RapOc — Rabillo del ojo (outer eye corner)
  RapOc: { boneName: "Head", offset: [0.04, 0.008, 0.04] },

  // OrbOc — Órbita ocular (above eye)
  OrbOc: { boneName: "Head", offset: [0.02, 0.009, 0.045] },

  // Na — Punta de nariz (nose tip, y+0.06 z=0.054)
  Na: { boneName: "Head", offset: [0, 0.006, 0.06] },

  // Sep — Puente nasal (nose bridge, y+0.07 z=0.052)
  Sep: { boneName: "Head", offset: [0, 0.007, 0.055] },

  // AlNa — Alas nasales (nasal wings)
  AlNa: { boneName: "Head", offset: [0.02, 0.006, 0.055] },

  // Po — Pómulo (cheekbone, cheek x=0.02 z=0.05)
  Po: { boneName: "Head", offset: [0.03, 0.006, 0.05] },

  // Ge — Mejilla (cheek, x=0.05 z=0.04)
  Ge: { boneName: "Head", offset: [0.04, 0.004, 0.04] },

  // Os — Boca (mouth center, y+0.04 z=0.065)
  Os: { boneName: "Head", offset: [0, 0.004, 0.065] },

  // IpsiOs — Boca-ipsi
  IpsiOs: { boneName: "Head", offset: [0.015, 0.004, 0.06] },

  // XOs — Boca-contra
  XOs: { boneName: "Head", offset: [-0.015, 0.004, 0.06] },

  // La — Labio inferior (lower lip, y+0.03 z=0.065)
  La: { boneName: "Head", offset: [0, 0.003, 0.065] },

  // Lab — Labio superior (upper lip, y+0.05 z=0.056)
  Lab: { boneName: "Head", offset: [0, 0.005, 0.06] },

  // Lin — Lengua (tongue)
  Lin: { boneName: "Head", offset: [0, 0.004, 0.055] },

  // Den — Dientes (teeth)
  Den: { boneName: "Head", offset: [0, 0.004, 0.055] },

  // Col — Colmillo (canine)
  Col: { boneName: "Head", offset: [0.01, 0.004, 0.055] },

  // MedDen — Incisivos (front teeth)
  MedDen: { boneName: "Head", offset: [0, 0.004, 0.06] },

  // Me — Mentón (chin, y+0.02 z=0.065)
  Me: { boneName: "Head", offset: [0, 0.002, 0.065] },

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
