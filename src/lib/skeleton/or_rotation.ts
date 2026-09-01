/**
 * or_rotation.ts — matriz OR (orientación) → rotación de la mano.
 *
 * Marco local de la mano (mano derecha en reposo, palma abajo, dedos al
 * frente): +Y local = dirección de los dedos, −Z local = normal de la
 * palma. El marco del cuerpo es el de geometry.ts.
 *
 * Si la combinación es geométricamente imposible (palma y dedos
 * colineales), se ortogonaliza la palma contra los dedos y se devuelve
 * un warning que la interfaz muestra.
 */

import type { PalmFacing, FingerPointing, ForearmRotation } from "@/lib/types";
import {
  v3,
  cross,
  dot,
  normalize,
  norm,
  sub,
  scale,
  quatFromBasis,
  quatFromAxisAngle,
  mulQ,
  type Quat,
  type Vec3,
} from "./geometry";

/** Dirección en el marco del cuerpo (LEFT/RIGHT = dentro/fuera se
 * resuelven según el lado de la mano en handFrameVector). */
const DIR: Record<string, Vec3> = {
  UP: v3(0, 1, 0),
  DOWN: v3(0, -1, 0),
  FORWARD: v3(0, 0, 1),
  BACK: v3(0, 0, -1),
  LEFT: v3(-1, 0, 0),
  RIGHT: v3(1, 0, 0),
};

function dirVector(
  facing: PalmFacing | FingerPointing,
  side: "L" | "R",
  kind: "palm" | "fingers",
): Vec3 {
  if (facing !== "NEUTRAL") return DIR[facing];
  // NEUTRAL: palma "de canto" mira al centro del cuerpo; dedos de canto
  // apuntan al frente. Aproximación documentada.
  if (kind === "palm") return v3(side === "R" ? -1 : 1, 0, 0);
  return v3(0, 0, 1);
}

export interface ORResult {
  quat: Quat;
  warning?: string;
}

export function wristRotationFromOR(
  palm_facing: PalmFacing | undefined,
  finger_pointing: FingerPointing | undefined,
  side: "L" | "R",
  forearm_rotation?: ForearmRotation,
): ORResult {
  const fingers = normalize(
    dirVector(finger_pointing ?? "FORWARD", side, "fingers"),
  );
  let palmN = normalize(dirVector(palm_facing ?? "DOWN", side, "palm"));

  let warning: string | undefined;
  const d = dot(fingers, palmN);
  if (Math.abs(d) > 0.85) {
    // combinación imposible (p. ej. palma arriba y dedos arriba):
    // ortogonalizar la palma contra los dedos, usando la más cercana.
    const ortho = sub(palmN, scale(fingers, d));
    palmN =
      norm(ortho) > 1e-4
        ? normalize(ortho)
        : normalize(cross(fingers, v3(1, 0, 0)));
    warning =
      "Palma y dedos no pueden apuntar al mismo lado; se usó la orientación más cercana.";
  } else if (Math.abs(d) > 1e-6) {
    palmN = normalize(sub(palmN, scale(fingers, d)));
  }

  // Base: Y local = dedos; Z local = −palma (la palma mira a −Z local);
  // X local completa la terna derecha.
  const Z = scale(palmN, -1);
  const X = normalize(cross(fingers, Z));
  const quatBase = quatFromBasis(X, fingers, Z);

  // Rotación de antebrazo: giro adicional sobre el eje de los dedos.
  const twist =
    forearm_rotation === "PRONE"
      ? quatFromAxisAngle(fingers, side === "R" ? -0.6 : 0.6)
      : forearm_rotation === "SUPINE"
        ? quatFromAxisAngle(fingers, side === "R" ? 0.6 : -0.6)
        : null;

  return { quat: twist ? mulQ(twist, quatBase) : quatBase, warning };
}
