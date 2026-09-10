/**
 * viewport.ts — estado de vista de la línea de tiempo (zoom y
 * desplazamiento). Capa pura: sin DOM, sin React, testeable.
 *
 * Modelo: la vista es { startMs, msPerPx }. El ancho en píxeles lo pone
 * quien dibuja, así que endMs = startMs + widthPx * msPerPx.
 *
 * Invariantes que sostienen la sensación del gesto:
 *  - `zoomAt` conserva el instante bajo el punto de anclaje.
 *  - Nunca se sale del clip ni se pasa del tope de acercamiento.
 *  - Sin inercia ni rebote: es una herramienta de precisión.
 */

import {
  FIT_PADDING,
  MAX_ZOOM_FACTOR,
  MIN_LABEL_PX,
  MIN_MS_PER_PX,
  SNAP_THRESHOLD_PX,
} from "./constants";

export interface Viewport {
  startMs: number;
  msPerPx: number;
}

/** Duración anotable: normalmente { startMs: 0, endMs: duración del clip } */
export interface Bounds {
  startMs: number;
  endMs: number;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Dominio recorrible: el clip más el margen de `fit`. */
export function domain(bounds: Bounds): Bounds {
  const pad = (bounds.endMs - bounds.startMs) * FIT_PADDING;
  return { startMs: bounds.startMs - pad, endMs: bounds.endMs + pad };
}

/** ms/px con el que el clip completo (más margen) cabe en el ancho. */
export function fitMsPerPx(bounds: Bounds, widthPx: number): number {
  const d = domain(bounds);
  return (d.endMs - d.startMs) / Math.max(1, widthPx);
}

/**
 * Tope efectivo de acercamiento (ms/px más pequeño permitido).
 * Ver la nota de MIN_MS_PER_PX: en clips cortos `fit` ya es más fino
 * que el tope nominal, así que se garantizan MAX_ZOOM_FACTOR aumentos.
 */
export function minMsPerPx(bounds: Bounds, widthPx: number): number {
  return Math.min(MIN_MS_PER_PX, fitMsPerPx(bounds, widthPx) / MAX_ZOOM_FACTOR);
}

export function endMs(view: Viewport, widthPx: number): number {
  return view.startMs + widthPx * view.msPerPx;
}

export function timeToPx(
  view: Viewport,
  tMs: number,
  _widthPx?: number,
): number {
  return (tMs - view.startMs) / view.msPerPx;
}

export function pxToTime(view: Viewport, px: number): number {
  return view.startMs + px * view.msPerPx;
}

/** Encaja la vista dentro del dominio y del rango de zoom permitido. */
export function clampView(
  view: Viewport,
  bounds: Bounds,
  widthPx: number,
): Viewport {
  const d = domain(bounds);
  const maxMsPerPx = fitMsPerPx(bounds, widthPx);
  const msPerPx = clamp(view.msPerPx, minMsPerPx(bounds, widthPx), maxMsPerPx);
  const span = widthPx * msPerPx;
  const maxStart = d.endMs - span;
  // Si la vista abarca todo el dominio, se ancla al inicio del dominio.
  const startMs =
    maxStart <= d.startMs ? d.startMs : clamp(view.startMs, d.startMs, maxStart);
  return { startMs, msPerPx };
}

/** Vista que muestra el clip completo con su margen. */
export function fit(bounds: Bounds, widthPx: number): Viewport {
  const d = domain(bounds);
  return { startMs: d.startMs, msPerPx: fitMsPerPx(bounds, widthPx) };
}

/**
 * Zoom anclado: `factor` > 1 acerca, < 1 aleja. El instante que está
 * bajo `anchorPx` sigue estando bajo `anchorPx` después del zoom.
 */
export function zoomAt(
  view: Viewport,
  factor: number,
  anchorPx: number,
  bounds: Bounds,
  widthPx: number,
): Viewport {
  const tAnchor = pxToTime(view, anchorPx);
  const msPerPx = clamp(
    view.msPerPx / factor,
    minMsPerPx(bounds, widthPx),
    fitMsPerPx(bounds, widthPx),
  );
  return clampView({ startMs: tAnchor - anchorPx * msPerPx, msPerPx }, bounds, widthPx);
}

/** Desplazamiento horizontal en píxeles (positivo = avanzar en el tiempo). */
export function panBy(
  view: Viewport,
  deltaPx: number,
  bounds: Bounds,
  widthPx: number,
): Viewport {
  return clampView(
    { ...view, startMs: view.startMs + deltaPx * view.msPerPx },
    bounds,
    widthPx,
  );
}

/** Encuadra un rango (doble clic en un tramo) con margen proporcional. */
export function zoomToRange(
  startMs: number,
  endRangeMs: number,
  widthPx: number,
  paddingPct: number,
  bounds?: Bounds,
): Viewport {
  const span = Math.max(1, endRangeMs - startMs);
  const pad = span * paddingPct;
  const floor = bounds ? minMsPerPx(bounds, widthPx) : MIN_MS_PER_PX;
  const msPerPx = Math.max(floor, (span + 2 * pad) / Math.max(1, widthPx));
  const view = { startMs: startMs - pad, msPerPx };
  return bounds ? clampView(view, bounds, widthPx) : view;
}

// ── Regla ────────────────────────────────────────────────────────

/**
 * Paso de marcas de la serie 1-2-5 × 10ⁿ ms tal que queden al menos
 * MIN_LABEL_PX entre etiquetas.
 */
export function tickStepMs(
  msPerPx: number,
  minLabelPx: number = MIN_LABEL_PX,
): number {
  const minStep = msPerPx * minLabelPx;
  const exp = Math.floor(Math.log10(Math.max(1e-6, minStep)));
  for (let e = exp; e < exp + 4; e++) {
    for (const m of [1, 2, 5]) {
      const step = m * 10 ** e;
      if (step >= minStep) return step;
    }
  }
  return 10 ** (exp + 4);
}

/** Marcas visibles (tiempos absolutos) para la vista actual. */
export function ticks(
  view: Viewport,
  widthPx: number,
  minLabelPx: number = MIN_LABEL_PX,
): number[] {
  const step = tickStepMs(view.msPerPx, minLabelPx);
  const first = Math.ceil(view.startMs / step) * step;
  const last = endMs(view, widthPx);
  const out: number[] = [];
  for (let t = first; t <= last; t += step) out.push(Math.round(t));
  return out;
}

/**
 * Formato de la etiqueta según el nivel de acercamiento:
 * m:ss.mmm de cerca, s.mmm en medio, s de lejos.
 */
export function formatTick(tMs: number, msPerPx: number): string {
  const s = tMs / 1000;
  if (msPerPx < 20) {
    const m = Math.floor(s / 60);
    const rest = s - m * 60;
    return `${m}:${rest < 10 ? "0" : ""}${rest.toFixed(3)}`;
  }
  if (msPerPx < 100) return `${s.toFixed(3)} s`;
  return `${Math.round(s)} s`;
}

// ── Ajuste magnético ─────────────────────────────────────────────

/**
 * Resuelve al candidato más cercano dentro del umbral (en píxeles).
 * Devuelve el tiempo original si ninguno cae dentro.
 */
export function snapMs(
  tMs: number,
  candidates: number[],
  msPerPx: number,
  thresholdPx: number = SNAP_THRESHOLD_PX,
): { ms: number; snapped: boolean } {
  const thresholdMs = thresholdPx * msPerPx;
  let best: number | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = Math.abs(c - tMs);
    if (d <= thresholdMs && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best === null ? { ms: tMs, snapped: false } : { ms: best, snapped: true };
}
