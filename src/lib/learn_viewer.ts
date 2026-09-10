/**
 * learn_viewer.ts — de la matriz segmental a lo que pinta el avatar.
 *
 * Capa pura: dado un segmento (y el avance t dentro de un movimiento)
 * devuelve la pose del avatar. La usan la reproducción y la vista
 * previa al editar una celda, así que el avatar siempre muestra
 * exactamente lo que dice la matriz.
 */

import type { CMEntry } from "./types";
import type { UBLocation } from "./ub_inventory";
import type {
  SignConstruction,
  HoldSegment,
  RNMState,
} from "./sign_types";

export interface PoseAvatar {
  cm: CMEntry | null;
  orientation?: { palm: string; fingers: string };
  ubLocation: UBLocation | null;
  rnm: RNMState;
  movementInterp: null | {
    t: number;
    fromUBCode: string | null;
    toUBCode: string | null;
    fromCM: CMEntry | null;
    toCM: CMEntry | null;
    fromOrientation: { palm: string; fingers: string };
    toOrientation: { palm: string; fingers: string };
    contour: string;
    plane: string;
    local: string | null;
    handMode: "dominant" | "both_symmetric";
  };
  handMode: "dominant" | "both_symmetric";
}

const OR_POR_DEFECTO = { palm: "FORWARD", fingers: "UP" };

/** Rasgos no manuales de un segmento, con los globales como respaldo. */
export function rnmDe(sign: SignConstruction, index: number): RNMState {
  return sign.segments[index]?.rnm ?? sign.rnm;
}

/**
 * Pose del avatar para el segmento `index`. En un movimiento, `t` (0-1)
 * es el avance entre la detención anterior y la siguiente.
 */
export function poseDeSegmento(
  sign: SignConstruction,
  index: number,
  t = 0,
): PoseAvatar {
  const seg = sign.segments[index];
  const rnm = rnmDe(sign, index);
  if (!seg) {
    return {
      cm: null,
      ubLocation: null,
      rnm,
      movementInterp: null,
      handMode: "dominant",
    };
  }
  if (seg.type === "D") {
    return {
      cm: seg.cm,
      orientation: seg.orientation,
      ubLocation: seg.ub,
      rnm,
      movementInterp: null,
      handMode: seg.handMode ?? "dominant",
    };
  }
  const antes = sign.segments[index - 1] as HoldSegment | undefined;
  const despues = sign.segments[index + 1] as HoldSegment | undefined;
  const handMode = antes?.handMode ?? "dominant";
  return {
    cm: null,
    orientation: undefined,
    ubLocation: null,
    rnm,
    handMode,
    movementInterp: {
      t: Math.min(1, Math.max(0, t)),
      fromUBCode: antes?.ub?.code ?? null,
      toUBCode: despues?.ub?.code ?? null,
      fromCM: antes?.cm ?? null,
      toCM: despues?.cm ?? null,
      fromOrientation: antes?.orientation ?? OR_POR_DEFECTO,
      toOrientation: despues?.orientation ?? OR_POR_DEFECTO,
      contour: seg.contour,
      plane: seg.plane,
      local: seg.local,
      handMode,
    },
  };
}

/** Numeración legible de la matriz: D₁ M₁ D₂ M₂ D₃ … */
export function etiquetaSegmento(sign: SignConstruction, index: number): string {
  const SUB = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
  const sub = (n: number) =>
    String(n)
      .split("")
      .map((d) => SUB[Number(d)])
      .join("");
  const seg = sign.segments[index];
  if (!seg) return "";
  const n = sign.segments
    .slice(0, index + 1)
    .filter((s) => s.type === seg.type).length;
  return `${seg.type}${sub(n)}`;
}
