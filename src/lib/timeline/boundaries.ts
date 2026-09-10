/**
 * boundaries.ts — edición de fronteras en el canal maestro.
 *
 * Solo aquí se tocan `start_ms` / `end_ms`. Invariantes que nunca se
 * rompen: sin duración negativa, sin cruces y nada por debajo de un
 * cuadro. Los demás canales se redibujan solos porque son proyecciones.
 */

import type { PSHRSegment } from "@/lib/types";
import { ASSUMED_FPS } from "./constants";

/** Duración de un cuadro en ms (30 fps si no se conoce el del video). */
export const frameMs = (fps: number = ASSUMED_FPS) => 1000 / fps;

export interface MoverFronteraOpts {
  /** duración mínima de un segmento (por defecto, un cuadro) */
  minDurMs?: number;
  /** límites del clip */
  clip?: { startMs: number; endMs: number };
}

/**
 * Mueve el borde `edge` del segmento `id` a `newMs`.
 * Si el vecino comparte esa frontera (son contiguos), se ajusta también:
 * la frontera es una sola, como en un editor de video.
 */
export function moverFrontera(
  segmentos: PSHRSegment[],
  id: string,
  edge: "start" | "end",
  newMs: number,
  opts: MoverFronteraOpts = {},
): PSHRSegment[] {
  const min = opts.minDurMs ?? frameMs();
  const orden = [...segmentos].sort((a, b) => a.start_ms - b.start_ms);
  const i = orden.findIndex((s) => s.id === id);
  if (i < 0) return segmentos;
  const seg = orden[i];
  const prev = orden[i - 1];
  const next = orden[i + 1];
  const clipIni = opts.clip?.startMs ?? 0;
  const clipFin = opts.clip?.endMs ?? Infinity;

  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));

  const salida = orden.map((s) => ({ ...s }));

  if (edge === "start") {
    const comparte = prev && Math.abs(prev.end_ms - seg.start_ms) <= 1;
    const lo = comparte
      ? Math.max(clipIni, prev.start_ms + min) // el vecino conserva su mínimo
      : Math.max(clipIni, prev ? prev.end_ms : clipIni);
    const hi = seg.end_ms - min;
    const ms = clamp(newMs, lo, Math.max(lo, hi));
    salida[i].start_ms = ms;
    if (comparte) salida[i - 1].end_ms = ms;
  } else {
    const comparte = next && Math.abs(next.start_ms - seg.end_ms) <= 1;
    const hi = comparte
      ? Math.min(clipFin, next.end_ms - min)
      : Math.min(clipFin, next ? next.start_ms : clipFin);
    const lo = seg.start_ms + min;
    const ms = clamp(newMs, Math.min(lo, hi), hi);
    salida[i].end_ms = Math.max(ms, lo);
    if (comparte) salida[i + 1].start_ms = salida[i].end_ms;
  }
  return salida;
}

/**
 * Candidatos de imantado: playhead, marcas de cuadro cercanas, extremos
 * del clip y puntos de cambio de valor de los demás canales.
 */
export function candidatosImantado(params: {
  playheadMs: number;
  clip: { startMs: number; endMs: number };
  cambios: number[];
  /** incluir marcas de cuadro (solo cuando son visibles) */
  conCuadros: boolean;
  fps?: number;
  /** ventana alrededor del punto arrastrado, para no generar miles */
  cercaDeMs?: number;
  ventanaMs?: number;
}): number[] {
  const { playheadMs, clip, cambios, conCuadros } = params;
  const out = new Set<number>([playheadMs, clip.startMs, clip.endMs, ...cambios]);
  if (conCuadros && params.cercaDeMs !== undefined) {
    const f = frameMs(params.fps);
    const ventana = params.ventanaMs ?? f * 4;
    const desde = Math.max(clip.startMs, params.cercaDeMs - ventana);
    const hasta = Math.min(clip.endMs, params.cercaDeMs + ventana);
    for (let k = Math.ceil(desde / f); k * f <= hasta; k++) out.add(k * f);
  }
  return [...out].sort((a, b) => a - b);
}
