/**
 * gestures.ts — traducción de eventos crudos a intenciones de vista.
 *
 * Capa pura (sin DOM) para poder probar la parte que siempre se rompe:
 * distinguir el pellizco del trackpad del desplazamiento de dos dedos,
 * y calcular el factor de un pellizco táctil.
 *
 * Notas de plataforma:
 *  - En macOS el pellizco del trackpad llega como `wheel` con
 *    ctrlKey = true (aunque nadie toque Ctrl). Es zoom.
 *  - El desplazamiento de dos dedos llega como `wheel` con deltaX.
 *  - Con ⌘ (metaKey) o Ctrl real, la rueda del mouse también es zoom.
 */

import { ZOOM_STEP } from "./constants";

export interface WheelLike {
  ctrlKey: boolean;
  metaKey: boolean;
  deltaX: number;
  deltaY: number;
  deltaMode?: number;
}

export type AccionRueda =
  | { kind: "zoom"; factor: number }
  | { kind: "pan"; deltaPx: number }
  | { kind: "nada" };

/** Píxeles por muesca cuando el evento viene en líneas (deltaMode 1). */
const LINEA_PX = 16;

export function clasificarRueda(e: WheelLike): AccionRueda {
  const escala = e.deltaMode === 1 ? LINEA_PX : 1;
  const dy = e.deltaY * escala;
  const dx = e.deltaX * escala;

  // Pellizco de trackpad o rueda con modificador → zoom anclado.
  if (e.ctrlKey || e.metaKey) {
    if (dy === 0) return { kind: "nada" };
    // deltaY negativo = acercar. Exponencial para que se sienta parejo.
    return { kind: "zoom", factor: Math.exp(-dy / 100) };
  }
  // Desplazamiento horizontal de dos dedos.
  if (Math.abs(dx) > Math.abs(dy)) return { kind: "pan", deltaPx: dx };
  // Rueda vertical sola: desplazamiento horizontal (es una línea de
  // tiempo; desplazarse en el tiempo es lo único que tiene sentido).
  if (dy !== 0) return { kind: "pan", deltaPx: dy };
  return { kind: "nada" };
}

export interface PunteroXY {
  x: number;
  y: number;
}

export interface EstadoPellizco {
  distancia: number;
  centroideX: number;
}

export function estadoPellizco(a: PunteroXY, b: PunteroXY): EstadoPellizco {
  return {
    distancia: Math.hypot(a.x - b.x, a.y - b.y),
    centroideX: (a.x + b.x) / 2,
  };
}

/**
 * Factor de zoom entre dos estados de pellizco. Separar los dedos
 * acerca (factor > 1). Se ignora un cambio de distancia despreciable
 * para que un pellizco casi puro no tiemble.
 */
export function factorPellizco(
  antes: EstadoPellizco,
  ahora: EstadoPellizco,
): number {
  if (antes.distancia < 8 || ahora.distancia < 8) return 1;
  const f = ahora.distancia / antes.distancia;
  return Math.abs(f - 1) < 0.005 ? 1 : f;
}

/** Desplazamiento en píxeles del centroide entre dos estados. */
export function panPellizco(
  antes: EstadoPellizco,
  ahora: EstadoPellizco,
): number {
  return antes.centroideX - ahora.centroideX;
}

export type AccionTecla =
  | { kind: "zoom"; factor: number }
  | { kind: "fit" }
  | { kind: "fitSeleccion" }
  | { kind: "seek"; cuadros: number }
  | { kind: "inicio" }
  | { kind: "fin" }
  | { kind: "nada" };

export function clasificarTecla(e: {
  key: string;
  shiftKey: boolean;
}): AccionTecla {
  switch (e.key) {
    case "+":
    case "=":
      return { kind: "zoom", factor: ZOOM_STEP };
    case "-":
    case "_":
      return { kind: "zoom", factor: 1 / ZOOM_STEP };
    case "0":
      return e.shiftKey ? { kind: "fitSeleccion" } : { kind: "fit" };
    case "ArrowLeft":
      return { kind: "seek", cuadros: e.shiftKey ? -10 : -1 };
    case "ArrowRight":
      return { kind: "seek", cuadros: e.shiftKey ? 10 : 1 };
    case "Home":
      return { kind: "inicio" };
    case "End":
      return { kind: "fin" };
    default:
      return { kind: "nada" };
  }
}

/**
 * Transformación de capa entre dos vistas: permite previsualizar el
 * gesto con `transform` sin volver a renderizar React en cada cuadro.
 * x' = translateX + scaleX · x
 */
export function transformacionCapa(
  desde: { startMs: number; msPerPx: number },
  hacia: { startMs: number; msPerPx: number },
): { scaleX: number; translateX: number } {
  const scaleX = desde.msPerPx / hacia.msPerPx;
  const translateX = (desde.startMs - hacia.startMs) / hacia.msPerPx;
  return { scaleX, translateX };
}
