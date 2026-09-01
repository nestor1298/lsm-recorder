/**
 * ub_anchors.ts — cada punto UB de Cruz Aldrete → coordenada 3D en el
 * cuerpo del esqueleto.
 *
 * Marco: origen en el esternón, x hacia la derecha de la persona señante,
 * y arriba, z al frente (metros aproximados de un torso adulto).
 *
 * Generación en dos pasos, como pide el encargo:
 *  1) proyección afín de las coordenadas 2D de la silueta SVG de
 *     ub_inventory.ts (viewBox 200×280; el esternón "Es" está en
 *     (100,105)): x_cuerpo = (100 − svg.x) · e   [el SVG se dibuja como
 *     espejo del espectador], y_cuerpo = (105 − svg.y) · e, con
 *     e ≈ 0.0055 m/px; z por región (superficie donde se articula).
 *  2) afinado puntual de los casos donde la proyección queda burda.
 *
 * // VALIDAR-LSM: las anclas de brazo/antebrazo/mano asumen el brazo
 * // pasivo sostenido frente al torso (pose canónica); los offsets z por
 * // región son aproximados y deben revisarse con la lingüista.
 */

import { UB_LOCATIONS } from "@/lib/ub_inventory";
import { v3, type Vec3 } from "./geometry";

const E = 0.0055; // metros por pixel de la silueta
const CX = 100;
const CY = 105; // "Es" (esternón) en el SVG

/** Offset z (profundidad de la superficie articulatoria) por región */
const REGION_Z: Record<string, number> = {
  HEAD: 0.02,
  FACE: 0.06,
  NECK: 0.04,
  TRUNK: 0.08,
  ARM: 0.1,
  FOREARM: 0.16,
  HAND: 0.22,
  NEUTRAL_SPACE: 0.25,
};

/** Afinado puntual (paso 2) — solo donde la proyección afín queda burda */
const OVERRIDES: Record<string, Partial<Vec3>> = {
  Ce: { z: -0.06 }, // nuca: detrás de la cabeza
  Dor: { z: -0.1 }, // espalda
  Vx: { z: 0.0 }, // coronilla: arriba, no al frente
  Ca: { z: 0.01 },
};

function buildAnchors(): Record<string, Vec3> {
  const out: Record<string, Vec3> = {};
  for (const loc of UB_LOCATIONS) {
    const base = v3(
      (CX - loc.x) * E,
      (CY - loc.y) * E,
      REGION_Z[loc.region] ?? 0.1,
    );
    const o = OVERRIDES[loc.code];
    out[loc.code] = v3(o?.x ?? base.x, o?.y ?? base.y, o?.z ?? base.z);
  }
  return out;
}

export const UB_ANCHORS: Record<string, Vec3> = buildAnchors();

/** Punto neutro frente al hombro del lado activo */
export function neutralPoint(side: "L" | "R"): Vec3 {
  return v3(side === "R" ? 0.18 : -0.18, -0.05, 0.28);
}

export type Proximity = "TOUCHING" | "NEAR" | "MEDIAL" | "DISTANT" | "GRASPED" | "BRUSHING";

/**
 * Posición objetivo de la muñeca para un punto UB y una proximidad.
 * contacto pega la muñeca a la superficie; cerca ≈ 4 cm; medio ≈ 10 cm;
 * lejos/aire usa el punto pero alejado 18 cm hacia el frente.
 */
export function wristTargetFromUB(
  code: string | undefined,
  side: "L" | "R",
  proximity?: Proximity,
): Vec3 {
  if (!code) return neutralPoint(side);
  const a = UB_ANCHORS[code];
  if (!a) return neutralPoint(side);
  const off =
    proximity === "TOUCHING" || proximity === "GRASPED" || proximity === "BRUSHING"
      ? 0.02
      : proximity === "NEAR"
        ? 0.06
        : proximity === "MEDIAL"
          ? 0.12
          : proximity === "DISTANT"
            ? 0.2
            : 0.06;
  return v3(a.x, a.y, a.z + off);
}
