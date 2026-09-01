// Etiquetas es-MX y notación para el flujo guiado de anotación LSM-PN.
// Los valores de los enums vienen de src/lib/types.ts; aquí viven sus
// nombres en lenguaje llano para la comunidad, no la jerga del esquema.

import type {
  ContourMovement,
  LocalMovement,
  MovementPlane,
  ContactType,
  Laterality,
  CMEntry,
  PalmFacing,
  FingerPointing,
  ForearmRotation,
  RepetitionType,
  NonDominantRelation,
  MovementDirection,
} from "./types";
import { UB_LOCATIONS } from "./ub_inventory";

export const CONTOUR_ES: Record<ContourMovement, string> = {
  STRAIGHT: "Recto",
  ARC: "Arco",
  CIRCLE: "Círculo",
  ZIGZAG: "Zigzag",
  SEVEN: "Quebrado",
};

/** Abreviatura de contorno para la notación lineal */
export const CONTOUR_NOTATION: Record<ContourMovement, string> = {
  STRAIGHT: "rect",
  ARC: "arco",
  CIRCLE: "circ",
  ZIGZAG: "zz",
  SEVEN: "7",
};

export const LOCAL_ES: Record<LocalMovement, string> = {
  WIGGLE: "Dedos ondulan",
  CIRCULAR: "Circular",
  TWIST: "Gira la muñeca",
  SCRATCH: "Rasca",
  NOD: "Flexiona la muñeca",
  OSCILLATE: "Va y viene",
  RELEASE: "Abre y suelta",
  FLATTEN: "Se aplana",
  PROGRESSIVE: "Progresivo",
  VIBRATE: "Vibra",
  RUB: "Frota",
};

export const PLANE_ES: Record<MovementPlane, string> = {
  HORIZONTAL: "Horizontal",
  VERTICAL: "Vertical",
  SAGITTAL: "Hacia el frente",
  OBLIQUE: "Diagonal",
};

export const CONTACT_ES: Record<ContactType, string> = {
  TOUCHING: "Toca",
  GRASPED: "Agarra",
  NEAR: "Cerca",
  MEDIAL: "A media distancia",
  DISTANT: "En el aire",
  BRUSHING: "Roza",
};

export const LATERALITY_ES: Record<Laterality, string> = {
  IPSILATERAL: "Mismo lado",
  CONTRALATERAL: "Lado contrario",
  MIDLINE: "Al centro",
};

// ── Orientación (OR) — redactada desde la persona señante ───────

export const PALM_ES: Record<PalmFacing, string> = {
  UP: "Palma arriba",
  DOWN: "Palma abajo",
  FORWARD: "Palma al frente",
  BACK: "Palma hacia mí",
  LEFT: "Palma hacia dentro",
  RIGHT: "Palma hacia fuera",
  NEUTRAL: "Palma de canto",
};

export const FINGER_ES: Record<FingerPointing, string> = {
  UP: "Dedos arriba",
  DOWN: "Dedos abajo",
  FORWARD: "Dedos al frente",
  BACK: "Dedos hacia mí",
  LEFT: "Dedos hacia dentro",
  RIGHT: "Dedos hacia fuera",
  NEUTRAL: "Dedos de canto",
};

export const FOREARM_ES: Record<ForearmRotation, string> = {
  NEUTRAL: "Neutra",
  PRONE: "Prona",
  SUPINE: "Supina",
};

// ── Movimiento: dirección y repetición ──────────────────────────

export const REPETITION_ES: Record<RepetitionType, string> = {
  IGUAL: "Igual",
  ALTERNADA: "Alternada",
  PROGRESIVA: "Progresiva",
};

/** Dirección legible: "arriba y al frente" */
export function directionLabel(d: MovementDirection): string {
  const parts: string[] = [];
  if (d.y === 1) parts.push("arriba");
  if (d.y === -1) parts.push("abajo");
  if (d.x === 1) parts.push("a la derecha");
  if (d.x === -1) parts.push("a la izquierda");
  if (d.z === 1) parts.push("al frente");
  if (d.z === -1) parts.push("hacia mí");
  return parts.join(" y ") || "sin dirección";
}

// ── Bimanualidad ────────────────────────────────────────────────

export const RELATION_ES: Record<NonDominantRelation, string> = {
  SIMETRICA: "Igual y al mismo tiempo",
  ALTERNADA: "Igual pero alternando",
  BASE_PASIVA: "La otra mano es base",
  INDEPENDIENTE: "Cada mano hace algo distinto",
};

/** Chip de procedencia */
export const PROVENANCE_CHIP = "Sugerido";

/**
 * Descripción textual de la pose de un segmento, generada desde las
 * matrices (sirve de aria-label del recuadro 3D y como prueba de que la
 * notación es legible): "Mano derecha en la barbilla, palma hacia mí,
 * dedos arriba".
 */
export function describeSegmentPose(
  seg:
    | {
        location_code?: string;
        palm_facing?: PalmFacing;
        finger_pointing?: FingerPointing;
        contour_movement?: ContourMovement;
        direction?: MovementDirection;
        repetition?: { count: number };
      }
    | undefined,
  dominantHand: "LEFT" | "RIGHT",
): string {
  if (!seg) return "Pose de reposo";
  const parts: string[] = [
    `Mano ${dominantHand === "RIGHT" ? "derecha" : "izquierda"}`,
  ];
  const lugar = ubName(seg.location_code);
  if (lugar) parts.push(`en ${lugar.toLowerCase()}`);
  if (seg.palm_facing) parts.push(PALM_ES[seg.palm_facing].toLowerCase());
  if (seg.finger_pointing)
    parts.push(FINGER_ES[seg.finger_pointing].toLowerCase());
  if (seg.contour_movement)
    parts.push(`movimiento ${CONTOUR_ES[seg.contour_movement].toLowerCase()}`);
  if (seg.direction) parts.push(directionLabel(seg.direction));
  if (seg.repetition && seg.repetition.count > 1)
    parts.push(`repetido ${seg.repetition.count} veces`);
  return parts.join(", ");
}

/** Datos mínimos para componer la notación de una anotación guiada. */
export interface NotacionInput {
  cm: CMEntry | null;
  locationCode?: string;
  contact?: ContactType;
  contour?: ContourMovement;
  local?: LocalMovement;
  plane?: MovementPlane;
}

/**
 * Notación lineal estilo Cruz Aldrete: CM + UB + MV.
 * Es una lectura compacta de la anotación, no una transcripción exhaustiva.
 * Ej.: "B̂  ·  Fr(toca)  ·  MV: arco"
 */
export function buildNotacion(input: NotacionInput): string {
  const parts: string[] = [];
  if (input.cm) parts.push(input.cm.cruz_aldrete_notation);
  if (input.locationCode) {
    const contacto = input.contact
      ? `(${CONTACT_ES[input.contact].toLowerCase()})`
      : "";
    parts.push(`${input.locationCode}${contacto}`);
  }
  const mv: string[] = [];
  if (input.contour) mv.push(CONTOUR_NOTATION[input.contour]);
  if (input.local) mv.push(LOCAL_ES[input.local].toLowerCase());
  if (input.plane) mv.push(PLANE_ES[input.plane].toLowerCase());
  if (mv.length) parts.push(`MV: ${mv.join(", ")}`);
  return parts.join("  ·  ");
}

export function ubName(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return UB_LOCATIONS.find((l) => l.code === code)?.name;
}
