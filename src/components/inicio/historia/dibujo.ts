/**
 * dibujo.ts — herramientas de las escenas de la intro. Cada escena es una
 * función pura del avance `p` (0…1) de su diapositiva: así se pausa, se
 * salta y, con movimiento reducido, se dibuja directo el cuadro final.
 */

export const ANCHO = 480;
export const ALTO = 270;
export const CX = ANCHO / 2;
export const CY = ALTO / 2;

export const C = {
  ink: "var(--color-ink)",
  paper: "var(--color-paper)",
  g300: "var(--color-gray-300)",
  g400: "var(--color-gray-400)",
  g500: "var(--color-gray-500)",
  g600: "var(--color-gray-600)",
  g700: "var(--color-gray-700)",
  g800: "var(--color-gray-800)",
  accent: "var(--color-accent)",
  magenta: "var(--color-magenta)",
  gold: "var(--color-gold)",
  green: "var(--color-green)",
  coral: "var(--color-coral)",
} as const;

export const acotar = (x: number): number => Math.min(1, Math.max(0, x));
/** Avance local entre a y b (0 antes, 1 después). */
export const tramo = (p: number, a: number, b: number): number => acotar((p - a) / (b - a));
export const sale = (t: number): number => 1 - Math.pow(1 - t, 3);
export const entraSale = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/** Se pasa un poco y regresa: para lo que «llega». */
export const rebota = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return t <= 0 ? 0 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const mezcla = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Lugar i (0…8) en un círculo de nueve. */
export function lugar(i: number, r: number, cx = CX, cy = CY): { x: number; y: number } {
  const a = (-90 + 40 * i) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Punto de una curva cúbica de Bézier. */
export function bezier(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): [number, number] {
  const u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
  return [x, y];
}

export const COLORES_MANOS = [C.accent, C.magenta, C.gold, C.green, C.coral] as const;
export const colorDe = (i: number): string => COLORES_MANOS[i % COLORES_MANOS.length];
