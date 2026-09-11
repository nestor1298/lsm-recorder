/**
 * orientation.ts — Shared orientation → quaternion logic
 *
 * orientationToQuat (palm Euler + finger roll) drives the stand-alone
 * RiggedHand. The avatar uses real directions instead (direccionesMano /
 * cuaternionManoMundo, below) and distributes them anatomically across
 * elbow, forearm and wrist in AvatarModel (resolverOrientacion).
 */

import * as THREE from "three";

const DEG = Math.PI / 180;

/**
 * Palm direction → base rotation (which way the palm surface faces).
 * Euler angles in degrees: [rx, ry, rz].
 */
export const PALM_EULER: Record<string, [number, number, number]> = {
  FORWARD: [0, 0, 0],
  BACK:    [0, 180, 0],
  UP:      [-90, 0, 0],
  DOWN:    [90, 0, 0],
  LEFT:    [0, -90, 0],
  RIGHT:   [0, 90, 0],
};

/**
 * Finger direction → Z-axis roll on top of palm rotation (degrees).
 */
export const FINGER_ROLL: Record<string, number> = {
  UP:      0,
  DOWN:    180,
  LEFT:    -90,
  RIGHT:   90,
  FORWARD: -45,
  BACK:    135,
};

// ── Reusable temp objects (module-level, not per-frame allocated) ──
const _palmEuler = new THREE.Euler();
const _palmQuat = new THREE.Quaternion();
const _fingerQuat = new THREE.Quaternion();
const _fingerEuler = new THREE.Euler();

/**
 * Compute a quaternion that represents the combined palm + finger orientation.
 * First applies palm rotation, then finger roll on top.
 */
export function orientationToQuat(palm: string, fingers: string): THREE.Quaternion {
  const [rx, ry, rz] = PALM_EULER[palm] ?? PALM_EULER.FORWARD;
  _palmEuler.set(rx * DEG, ry * DEG, rz * DEG, "XYZ");
  _palmQuat.setFromEuler(_palmEuler);

  const roll = FINGER_ROLL[fingers] ?? 0;
  _fingerEuler.set(0, 0, roll * DEG, "XYZ");
  _fingerQuat.setFromEuler(_fingerEuler);

  // Compose: first apply palm rotation, then finger roll on top
  return new THREE.Quaternion().copy(_palmQuat).multiply(_fingerQuat);
}

// ── Orientación como direcciones reales (vista desde quien seña) ─────
//
// El avatar funciona como espejo de quien aprende: está de frente a la
// cámara (+Z) y seña con su mano izquierda, que queda del lado derecho
// de la pantalla (+X). Así, para la mano dominante:
//   FORWARD  al frente, hacia quien mira       → +Z
//   BACK     hacia quien seña                  → −Z
//   RIGHT    hacia fuera (lado de la dominante) → +X
//   LEFT     hacia dentro (al centro)          → −X
// La mano no dominante usa mirrorOrientation (intercambia LEFT/RIGHT).

const DIRECCION_MUNDO: Record<string, [number, number, number]> = {
  UP: [0, 1, 0],
  DOWN: [0, -1, 0],
  FORWARD: [0, 0, 1],
  BACK: [0, 0, -1],
  RIGHT: [1, 0, 0],
  LEFT: [-1, 0, 0],
};

/** Ejes de la mano en su propio espacio local (se miden en el modelo). */
export interface CalibracionMano {
  /** de la muñeca hacia los dedos */
  dedos: THREE.Vector3;
  /** normal de la palma (hacia donde se flexionan los dedos) */
  palma: THREE.Vector3;
}

/**
 * Direcciones (mundo) de la palma y de los dedos. «De canto» (NEUTRAL)
 * pone la palma hacia dentro. Si palma y dedos piden la misma recta
 * (imposible), los dedos toman la perpendicular más natural.
 */
export function direccionesMano(
  palm: string,
  fingers: string,
): { palma: THREE.Vector3; dedos: THREE.Vector3 } {
  const palma = new THREE.Vector3(...(DIRECCION_MUNDO[palm] ?? DIRECCION_MUNDO.LEFT));
  let dedos = new THREE.Vector3(
    ...(DIRECCION_MUNDO[fingers] ?? DIRECCION_MUNDO.FORWARD),
  );
  if (Math.abs(palma.dot(dedos)) > 0.9) {
    dedos = new THREE.Vector3(
      ...(Math.abs(palma.y) > 0.9 ? DIRECCION_MUNDO.FORWARD : DIRECCION_MUNDO.UP),
    );
  }
  return { palma, dedos };
}

/** Base ortonormal (x, y = eje, z ≈ normal) como matriz de rotación. */
function baseMano(eje: THREE.Vector3, normal: THREE.Vector3): THREE.Matrix4 {
  const y = eje.clone().normalize();
  const z = normal.clone().addScaledVector(y, -normal.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x, y, z);
}

const _baseMundo = new THREE.Quaternion();
const _baseLocal = new THREE.Quaternion();

/**
 * Rotación de mundo del hueso de la mano para que sus dedos apunten a
 * `dedos` y su palma a `palma` (direcciones de mundo, no necesariamente
 * ortogonales: la palma se ajusta perpendicular a los dedos).
 */
export function cuaternionManoDesde(
  calib: CalibracionMano,
  dedos: THREE.Vector3,
  palma: THREE.Vector3,
  out: THREE.Quaternion = new THREE.Quaternion(),
): THREE.Quaternion {
  _baseMundo.setFromRotationMatrix(baseMano(dedos, palma));
  _baseLocal.setFromRotationMatrix(baseMano(calib.dedos, calib.palma));
  return out.copy(_baseMundo).multiply(_baseLocal.invert());
}

/**
 * Rotación de mundo que debe tener el hueso de la mano para que sus
 * dedos y su palma apunten a donde pide la orientación.
 */
export function cuaternionManoMundo(
  calib: CalibracionMano,
  palm: string,
  fingers: string,
): THREE.Quaternion {
  const { palma, dedos } = direccionesMano(palm, fingers);
  return cuaternionManoDesde(calib, dedos, palma);
}
