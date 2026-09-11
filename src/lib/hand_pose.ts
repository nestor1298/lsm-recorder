/**
 * hand_pose.ts — Pure data layer: CMEntry → bone rotation targets
 *
 * Converts LSM-PN handshape configurations into target Euler rotations
 * for each bone in the rigget_V16.glb rigged hand model.
 *
 * Bone hierarchy (from GLB):
 *   rHand (root)
 *   ├── rThumb1 → rThumb2 → rThumb3 → rThumb4__
 *   ├── rCarpal1 → rIndex1 → rIndex2 → rIndex3 → rIndex4
 *   ├── rCarpal2 → rMid1 → rMid2 → rMid3 → rMid4
 *   ├── rCarpal3 → rRing1 → rRing2 → rRing3 → rRing4
 *   └── rCarpal4 → rPinky1 → rPinky2 → rPinky3 → rPinky4
 */

import type { CMEntry, FlexionLevel, ThumbOpposition } from "./types";

// ── Bone name constants ─────────────────────────────────────────

export const FINGER_BONES = {
  index:  { carpal: "rCarpal1", bones: ["rIndex1", "rIndex2", "rIndex3"] },
  middle: { carpal: "rCarpal2", bones: ["rMid1",   "rMid2",   "rMid3"]   },
  ring:   { carpal: "rCarpal3", bones: ["rRing1",  "rRing2",  "rRing3"]  },
  pinky:  { carpal: "rCarpal4", bones: ["rPinky1", "rPinky2", "rPinky3"] },
} as const;

export const THUMB_BONES = ["rThumb1", "rThumb2", "rThumb3"] as const;

export type FingerName = keyof typeof FINGER_BONES;

// ── Ángulos articulares por nivel de flexión ────────────────────
// Cada nivel se traduce a ángulos por articulación (no a un total que se
// reparte), para que la forma sea la anatómica:
//   extendido  → dedo recto
//   curvado    → dedo redondeado en las tres articulaciones (forma de C)
//   doblado    → Cruz Aldrete distingue dos: «^» dobla en la base (MCP)
//                con el dedo recto; «"» engancha las falanges (PIP+DIP)
//                con la base recta
//   cerrado    → puño: base, media y punta flexionadas por completo
// Todo se limita al rango de movimiento articular (ROM) de abajo.

const DEG2RAD = Math.PI / 180;

/**
 * Rango de movimiento articular de los dedos, en grados (valores
 * clínicos de referencia, AAOS). Ninguna rotación del avatar sale de aquí.
 */
export const ROM_DEDO = {
  /** metacarpofalángica: la base del dedo */
  mcp: [-10, 90],
  /** interfalángica proximal: la articulación media */
  pip: [0, 110],
  /** interfalángica distal: la punta */
  dip: [0, 80],
  /** separación lateral (abducción/aducción) en la base */
  abduccion: [-20, 20],
} as const satisfies Record<string, readonly [number, number]>;

/** Rango de movimiento del pulgar, en grados. */
export const ROM_PULGAR = {
  /** oposición/abducción en la base (trapeciometacarpiana) */
  cmc: [-55, 15],
  /** rotación axial de la base */
  cmcRotacion: [-30, 15],
  mcp: [0, 55],
  ip: [-10, 80],
} as const satisfies Record<string, readonly [number, number]>;

/** Ángulos [MCP, PIP, DIP] en grados por nivel. */
const ANGULOS_DEDO: Record<FlexionLevel, readonly [number, number, number]> = {
  EXTENDED: [0, 0, 0],
  CURVED: [35, 50, 30],
  BENT: [85, 5, 0], // «^»: doblado en la base
  CLOSED: [90, 105, 70],
};

/** Doblado «"»: gancho en las falanges con la base casi recta. */
const ANGULOS_GANCHO: readonly [number, number, number] = [10, 90, 65];

/** Ángulos [MCP, IP] del pulgar en grados por nivel. */
const ANGULOS_PULGAR: Record<FlexionLevel, readonly [number, number]> = {
  EXTENDED: [0, 0],
  CURVED: [20, 30],
  BENT: [35, 55],
  CLOSED: [50, 75],
};

/** Qué tan cerrado queda el dedo (0–1), para el ahuecado de la palma. */
const CIERRE: Record<FlexionLevel, number> = {
  EXTENDED: 0,
  CURVED: 0.3,
  BENT: 0.6,
  CLOSED: 1,
};

/** Limita un ángulo (grados) a su rango y lo regresa en radianes. */
export function limitarRad(
  grados: number,
  [min, max]: readonly [number, number],
): number {
  return Math.min(max, Math.max(min, grados)) * DEG2RAD;
}

export type FormaDoblado = "base" | "gancho";

/**
 * Lee de la notación de Cruz Aldrete cómo se dobla cada dedo
 * seleccionado: «^»/«¬» en la base, «"» en gancho. Ej. "12\"sep/o-" →
 * índice y medio en gancho.
 * // VALIDAR-LSM: lectura de los diacríticos a revisar con la lingüista.
 */
export function formaDobladoPorDedo(
  notacion: string,
): Partial<Record<FingerName, FormaDoblado>> {
  const cabeza = notacion.split("/")[0].replace(/NS.*$/, "");
  const porNumero: Record<string, FingerName> = {
    "1": "index",
    "2": "middle",
    "3": "ring",
    "4": "pinky",
  };
  const out: Partial<Record<FingerName, FormaDoblado>> = {};
  for (const m of cabeza.matchAll(/([1-4]+)([^1-4]*)/g)) {
    const mods = m[2];
    const gancho = mods.indexOf('"');
    const base = Math.max(mods.indexOf("^"), mods.indexOf("¬"));
    let forma: FormaDoblado | undefined;
    if (gancho >= 0 && (base < 0 || gancho < base)) forma = "gancho";
    else if (base >= 0) forma = "base";
    if (!forma) continue;
    for (const d of m[1]) out[porNumero[d]] = forma;
  }
  return out;
}

// ── Types ───────────────────────────────────────────────────────

/** Rotation deltas (in radians) to apply on top of bind-pose for one finger */
export interface FingerPose {
  /** Carpal bone Y-rotation for lateral spread */
  carpalSpread: number;
  /** Carpal bone X-rotation for metacarpal cupping (palm closure) */
  carpalFlex: number;
  /** MCP (Digit1) X-rotation for primary curl */
  mcpFlex: number;
  /** PIP (Digit2) X-rotation for mid curl */
  pipFlex: number;
  /** DIP (Digit3) X-rotation for distal curl */
  dipFlex: number;
}

/** Rotation deltas for the thumb */
export interface ThumbPose {
  /** rThumb1 Z-rotation for opposition/abduction */
  cmcOpposition: number;
  /** rThumb1 Y-rotation for opposition */
  cmcRotation: number;
  /** rThumb2 X-rotation for MCP curl */
  mcpFlex: number;
  /** rThumb3 X-rotation for IP curl */
  ipFlex: number;
}

/** Complete hand pose — rotation deltas for all bones */
export interface HandPose {
  index: FingerPose;
  middle: FingerPose;
  ring: FingerPose;
  pinky: FingerPose;
  thumb: ThumbPose;
}

// ── Conversion logic ────────────────────────────────────────────

/** Spread angles per finger (radians), applied as lateral abduction */
const SPREAD_ANGLES: Record<FingerName, number> = {
  index:  -0.15,
  middle: -0.05,
  ring:    0.05,
  pinky:   0.15,
};

/**
 * Metacarpal cupping angles per finger (radians).
 * When making a fist, the ring and pinky metacarpals flex significantly
 * to form the palm cup. Index/middle barely cup. Only rigs with real
 * metacarpal bones use it (rigget_V16); Mixamo avatars have none.
 */
const METACARPAL_CUP_MAX: Record<FingerName, number> = {
  index:  5 * DEG2RAD,
  middle: 10 * DEG2RAD,
  ring:   18 * DEG2RAD,
  pinky:  25 * DEG2RAD,
};

/** Build a FingerPose from a flexion level, clamped to ROM_DEDO. */
function buildFingerPose(
  flexion: FlexionLevel,
  spread: boolean,
  fingerName: FingerName,
  distalOverride: string | null,
  forma?: FormaDoblado,
): FingerPose {
  const [mcp, pip, dip] =
    flexion === "BENT" && forma === "gancho"
      ? ANGULOS_GANCHO
      : ANGULOS_DEDO[flexion];
  // «d-»: la punta se flexiona de más
  const dipExtra = distalOverride === "d-" ? 25 : 0;

  // Ahuecado de la palma: solo a partir de medio cierre
  const cierre = CIERRE[flexion];
  const carpalFlex =
    cierre > 0.5 ? METACARPAL_CUP_MAX[fingerName] * ((cierre - 0.5) * 2) : 0;

  return {
    carpalSpread: spread
      ? limitarRad(SPREAD_ANGLES[fingerName] / DEG2RAD, ROM_DEDO.abduccion)
      : 0,
    carpalFlex,
    mcpFlex: limitarRad(mcp, ROM_DEDO.mcp),
    pipFlex: limitarRad(pip, ROM_DEDO.pip),
    dipFlex: limitarRad(dip + dipExtra, ROM_DEDO.dip),
  };
}

/**
 * Build a ThumbPose from opposition and flexion, clamped to ROM_PULGAR.
 * Opposition calibrated from rigget_V16.glb animations:
 *   "S" (opposed fist): rThumb1 dX=-41° dY=-8°
 *   "1" (tucked): rThumb1 dX=-25° dY=-11°
 */
function buildThumbPose(
  opposition: ThumbOpposition,
  flexion: FlexionLevel,
  thumbContact: boolean,
): ThumbPose {
  let oposicion = 0;
  let rotacion = 0;
  if (opposition === "OPPOSED") {
    oposicion = -40;
    rotacion = -8;
  } else if (opposition === "CROSSED") {
    oposicion = -50;
    rotacion = -20;
  }
  // PARALLEL: el pulgar queda junto a la palma

  const [mcp, ip] = ANGULOS_PULGAR[flexion];
  // Contacto con otro dedo: la punta se acerca un poco más
  const ipContacto = thumbContact ? 10 : 0;

  return {
    cmcOpposition: limitarRad(oposicion, ROM_PULGAR.cmc),
    cmcRotation: limitarRad(rotacion, ROM_PULGAR.cmcRotacion),
    mcpFlex: limitarRad(mcp, ROM_PULGAR.mcp),
    ipFlex: limitarRad(ip + ipContacto, ROM_PULGAR.ip),
  };
}

// ── Main conversion function ────────────────────────────────────

const NUMERO_DEDO: Record<FingerName, number> = {
  index: 1,
  middle: 2,
  ring: 3,
  pinky: 4,
};

/**
 * Flexión real de un dedo en una CM. Los seleccionados usan su nivel;
 * los no seleccionados van cerrados, salvo que la CM los marque abiertos
 * (NSAb → non_selected_above). Única fuente de verdad para la miniatura
 * y para el avatar.
 */
export function flexionDedo(cm: CMEntry, dedo: FingerName): FlexionLevel {
  if (cm.selected_fingers.includes(NUMERO_DEDO[dedo])) return cm[dedo];
  return cm.non_selected_above ? "EXTENDED" : "CLOSED";
}

/**
 * Convert a CMEntry into target bone rotation deltas for all fingers.
 */
export function cmEntryToHandPose(cm: CMEntry): HandPose {
  const isSpread = cm.spread === "SPREAD";
  const formas = formaDobladoPorDedo(cm.cruz_aldrete_notation);
  const fingers = {} as Record<FingerName, FingerPose>;

  for (const name of ["index", "middle", "ring", "pinky"] as FingerName[]) {
    const isSelected = cm.selected_fingers.includes(NUMERO_DEDO[name]);
    // Only apply distal override to selected fingers
    const distal = isSelected ? cm.distal_override : null;
    fingers[name] = buildFingerPose(
      flexionDedo(cm, name),
      isSpread,
      name,
      distal,
      isSelected ? formas[name] : undefined,
    );
  }

  const thumb = buildThumbPose(cm.thumb_opposition, cm.thumb_flexion, cm.thumb_contact);

  return {
    index: fingers.index,
    middle: fingers.middle,
    ring: fingers.ring,
    pinky: fingers.pinky,
    thumb,
  };
}

/** Resting pose — slight natural curl (~10°) */
export const RESTING_POSE: HandPose = {
  index:  { carpalSpread: 0, carpalFlex: 0, mcpFlex: 0.07, pipFlex: 0.06, dipFlex: 0.04 },
  middle: { carpalSpread: 0, carpalFlex: 0, mcpFlex: 0.07, pipFlex: 0.06, dipFlex: 0.04 },
  ring:   { carpalSpread: 0, carpalFlex: 0, mcpFlex: 0.07, pipFlex: 0.06, dipFlex: 0.04 },
  pinky:  { carpalSpread: 0, carpalFlex: 0, mcpFlex: 0.07, pipFlex: 0.06, dipFlex: 0.04 },
  thumb:  { cmcOpposition: 0, cmcRotation: 0, mcpFlex: 0.05, ipFlex: 0.04 },
};
