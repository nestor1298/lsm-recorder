/**
 * pose3d.ts — reconstrucción 3D del esqueleto detectado por MediaPipe.
 *
 * Algoritmo (capa pura, testeada):
 *  1. La pose entrega `worldLandmarks` en METROS con origen entre las
 *     caderas y ejes de imagen (x derecha, y ABAJO, z hacia el fondo).
 *     Se convierten al marco de escena (y arriba, z hacia el
 *     espectador) con (x, −y, −z).
 *  2. Cada mano entrega sus propios `worldLandmarks` en metros pero con
 *     origen en el centro geométrico de la mano: se **injertan** en el
 *     cuerpo trasladando su muñeca (punto 0) sobre la muñeca de la pose
 *     correspondiente. Ese es el paso que une ambos modelos.
 *  3. La asignación mano↔lado se hace por cercanía en pantalla (los
 *     landmarks normalizados), no por la etiqueta `handedness`, que
 *     asume imagen en espejo y falla con video normal.
 *  4. Entre cuadros se interpola linealmente para que el muñeco siga el
 *     scrub del video sin saltos.
 */

export interface P3 {
  x: number;
  y: number;
  z: number;
}

export interface Pose3DFrame {
  tMs: number;
  /** 33 puntos de pose ya en marco de escena (metros, y arriba) */
  pose: P3[];
  /** 21 puntos por mano, ya injertados en la muñeca de la pose */
  left?: P3[];
  right?: P3[];
}

export interface Pose3DTrack {
  frames: Pose3DFrame[];
  durationMs: number;
}

const sub = (a: P3, b: P3): P3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: P3, b: P3): P3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** Marco de imagen de MediaPipe → marco de escena (y arriba, z al frente) */
export const toScene = (p: P3): P3 => ({ x: p.x, y: -p.y, z: -p.z });

/**
 * Injerta una mano (world landmarks con origen propio) en la muñeca de
 * la pose: traslada todos sus puntos por (muñecaPose − muñecaMano).
 */
export function graftHand(handWorld: P3[], poseWrist: P3): P3[] {
  if (handWorld.length === 0) return [];
  const offset = sub(poseWrist, handWorld[0]);
  return handWorld.map((p) => add(p, offset));
}

/** Distancia 2D entre puntos normalizados de pantalla */
const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Decide a qué lado del cuerpo pertenece cada mano detectada, por
 * cercanía de su muñeca (normalizada) a las muñecas de la pose.
 * Devuelve los índices dentro de `handsNorm` (o undefined).
 */
export function assignHands(
  handsNorm: { x: number; y: number }[][],
  poseNorm: { x: number; y: number }[] | undefined,
): { left?: number; right?: number } {
  if (!poseNorm || handsNorm.length === 0) return {};
  const wl = poseNorm[15];
  const wr = poseNorm[16];
  if (!wl || !wr) return {};
  const out: { left?: number; right?: number } = {};
  const used = new Set<number>();
  // Asigna primero la mano con la decisión más clara.
  const scored = handsNorm.map((h, i) => {
    const w = h[0] ?? { x: 0.5, y: 0.5 };
    const dl = dist2(w, wl);
    const dr = dist2(w, wr);
    return { i, dl, dr, margin: Math.abs(dl - dr) };
  });
  scored.sort((a, b) => b.margin - a.margin);
  for (const s of scored) {
    if (used.has(s.i)) continue;
    const side = s.dl <= s.dr ? "left" : "right";
    if (out[side] === undefined) {
      out[side] = s.i;
      used.add(s.i);
    } else {
      const other = side === "left" ? "right" : "left";
      if (out[other] === undefined) {
        out[other] = s.i;
        used.add(s.i);
      }
    }
  }
  return out;
}

const lerpP = (a: P3, b: P3, t: number): P3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

const lerpPts = (a: P3[] | undefined, b: P3[] | undefined, t: number) => {
  if (!a || !b || a.length !== b.length) return t < 0.5 ? a : b;
  return a.map((p, i) => lerpP(p, b[i], t));
};

/** Pose reconstruida en el instante t (interpolando entre cuadros). */
export function frameAt(
  track: Pose3DTrack | null,
  tMs: number,
): Pose3DFrame | null {
  if (!track || track.frames.length === 0) return null;
  const f = track.frames;
  if (tMs <= f[0].tMs) return f[0];
  if (tMs >= f[f.length - 1].tMs) return f[f.length - 1];
  let i = 0;
  while (i < f.length - 1 && f[i + 1].tMs < tMs) i++;
  const a = f[i];
  const b = f[i + 1] ?? a;
  const span = Math.max(1, b.tMs - a.tMs);
  const t = Math.min(1, Math.max(0, (tMs - a.tMs) / span));
  return {
    tMs,
    pose: lerpPts(a.pose, b.pose, t) ?? a.pose,
    left: lerpPts(a.left, b.left, t),
    right: lerpPts(a.right, b.right, t),
  };
}

/** Centro y radio aproximados de un cuadro, para encuadrar la cámara. */
export function frameBounds(fr: Pose3DFrame): { center: P3; radius: number } {
  const all = [...fr.pose, ...(fr.left ?? []), ...(fr.right ?? [])];
  if (all.length === 0) return { center: { x: 0, y: 0, z: 0 }, radius: 1 };
  const lo = { ...all[0] };
  const hi = { ...all[0] };
  for (const p of all) {
    lo.x = Math.min(lo.x, p.x);
    lo.y = Math.min(lo.y, p.y);
    lo.z = Math.min(lo.z, p.z);
    hi.x = Math.max(hi.x, p.x);
    hi.y = Math.max(hi.y, p.y);
    hi.z = Math.max(hi.z, p.z);
  }
  const center = {
    x: (lo.x + hi.x) / 2,
    y: (lo.y + hi.y) / 2,
    z: (lo.z + hi.z) / 2,
  };
  const radius =
    Math.max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z) / 2 || 0.5;
  return { center, radius };
}
