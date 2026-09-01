/**
 * geometry.ts — vectores y cuaterniones mínimos para el motor del
 * esqueleto. Capa pura: sin Three.js, para poder probarla con vitest.
 * Convención de marco (cuerpo de la persona señante):
 *   origen en el esternón · x hacia SU derecha · y arriba · z al frente.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const add = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const norm = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const normalize = (a: Vec3): Vec3 => {
  const n = norm(a) || 1;
  return v3(a.x / n, a.y / n, a.z / n);
};
export const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 =>
  v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

export const QUAT_IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

/**
 * Cuaternión desde una base ortonormal (columnas X, Y, Z de la matriz
 * de rotación). Método estándar matriz→quat (Shepperd).
 */
export function quatFromBasis(X: Vec3, Y: Vec3, Z: Vec3): Quat {
  const m00 = X.x,
    m01 = Y.x,
    m02 = Z.x,
    m10 = X.y,
    m11 = Y.y,
    m12 = Z.y,
    m20 = X.z,
    m21 = Y.z,
    m22 = Z.z;
  const tr = m00 + m11 + m22;
  let q: Quat;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = { w: s / 4, x: (m21 - m12) / s, y: (m02 - m20) / s, z: (m10 - m01) / s };
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = { w: (m21 - m12) / s, x: s / 4, y: (m01 + m10) / s, z: (m02 + m20) / s };
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = { w: (m02 - m20) / s, x: (m01 + m10) / s, y: s / 4, z: (m12 + m21) / s };
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: s / 4 };
  }
  return normalizeQ(q);
}

export function normalizeQ(q: Quat): Quat {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const a = normalize(axis);
  const s = Math.sin(angle / 2);
  return normalizeQ({ x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(angle / 2) });
}

export function mulQ(a: Quat, b: Quat): Quat {
  return normalizeQ({
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  });
}

/** Rota un vector por un cuaternión */
export function rotateV(q: Quat, v: Vec3): Vec3 {
  const u = v3(q.x, q.y, q.z);
  const s = q.w;
  return add(
    add(scale(u, 2 * dot(u, v)), scale(v, s * s - dot(u, u))),
    scale(cross(u, v), 2 * s),
  );
}

/** slerp simplificado (suficiente para interpolación de pose) */
export function slerp(a: Quat, b: Quat, t: number): Quat {
  let d = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  const bb = d < 0 ? { x: -b.x, y: -b.y, z: -b.z, w: -b.w } : b;
  d = Math.abs(d);
  if (d > 0.9995) {
    return normalizeQ({
      x: a.x + (bb.x - a.x) * t,
      y: a.y + (bb.y - a.y) * t,
      z: a.z + (bb.z - a.z) * t,
      w: a.w + (bb.w - a.w) * t,
    });
  }
  const th = Math.acos(d);
  const sa = Math.sin((1 - t) * th) / Math.sin(th);
  const sb = Math.sin(t * th) / Math.sin(th);
  return normalizeQ({
    x: a.x * sa + bb.x * sb,
    y: a.y * sa + bb.y * sb,
    z: a.z * sa + bb.z * sb,
    w: a.w * sa + bb.w * sb,
  });
}

/** easing suave (easeInOutQuad) para los segmentos M */
export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
