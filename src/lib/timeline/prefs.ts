/**
 * prefs.ts — preferencias de interfaz de la línea de tiempo.
 *
 * Viven en localStorage bajo `lsm-recorder-timeline-prefs`, NUNCA dentro
 * de SignAnnotation: son del dispositivo de quien anota, no del corpus.
 */

import type { CanalId } from "./channels";

export interface TimelinePrefs {
  /** canales visibles (el maestro no se puede ocultar) */
  canales: Record<string, boolean>;
  /** alto de cada fila de canal, en píxeles */
  alturaFila: number;
  /** la vista salta por páginas al reproducir */
  seguirReproduccion: boolean;
  /** ajuste magnético al arrastrar fronteras */
  imantado: boolean;
}

const KEY = "lsm-recorder-timeline-prefs";

export const PREFS_POR_DEFECTO: TimelinePrefs = {
  canales: {
    segmentos: true,
    mano: true,
    lugar: true,
    orientacion: true,
    movimiento: true,
    rnm: true,
    manoBase: true,
  },
  alturaFila: 30,
  seguirReproduccion: true,
  imantado: true,
};

export function cargarPrefs(): TimelinePrefs {
  if (typeof window === "undefined") return PREFS_POR_DEFECTO;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return PREFS_POR_DEFECTO;
    const p = JSON.parse(raw) as Partial<TimelinePrefs>;
    return {
      ...PREFS_POR_DEFECTO,
      ...p,
      canales: { ...PREFS_POR_DEFECTO.canales, ...(p.canales ?? {}) },
    };
  } catch {
    return PREFS_POR_DEFECTO;
  }
}

export function guardarPrefs(p: TimelinePrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // almacenamiento lleno o bloqueado: las preferencias son opcionales
  }
}

export function canalVisible(p: TimelinePrefs, id: CanalId): boolean {
  return id === "segmentos" ? true : (p.canales[id] ?? true);
}
