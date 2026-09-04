/**
 * constants.ts — constantes de interacción de la línea de tiempo.
 *
 * Todas viven aquí para poder calibrarlas en un solo lugar después de
 * usarlas con material real. Cada una dice qué pasa si se sube o baja.
 */

/**
 * Zoom máximo nominal: 2 ms/px ≈ 16 px por cuadro a 30 fps, suficiente
 * para colocar un corte al cuadro.
 *
 * CALIBRAR: en clips cortos este tope es inalcanzable porque `fit` ya
 * es más fino. Un clip de 900 ms en 800 px cabe a 1.17 ms/px, así que
 * un tope literal de 2 ms/px dejaría el rango de zoom vacío. El tope
 * efectivo es por eso `min(MIN_MS_PER_PX, fit / MAX_ZOOM_FACTOR)`:
 * garantiza siempre al menos MAX_ZOOM_FACTOR aumentos sobre `fit` y se
 * queda en 2 ms/px en clips largos, que es donde el tope importa.
 */
export const MIN_MS_PER_PX = 2;

/** Aumentos garantizados sobre `fit`, aunque el clip sea muy corto. */
export const MAX_ZOOM_FACTOR = 8;

/** Margen de `fit` a cada lado del clip, en fracción de su duración. */
export const FIT_PADDING = 0.02;

/** Separación mínima entre etiquetas de la regla. Menos = regla apretada. */
export const MIN_LABEL_PX = 60;

/** Debajo de este ms/px se dibujan marcas de cuadro. */
export const FRAME_TICKS_BELOW_MS_PER_PX = 4;

/** fps asumido cuando no se puede leer del video (se declara en la UI). */
export const ASSUMED_FPS = 30;

/** Umbral del ajuste magnético al arrastrar una frontera. */
export const SNAP_THRESHOLD_PX = 6;

/** Zona de agarre de una frontera: fina (mouse) y gruesa (táctil). */
export const GRAB_PX_FINE = 10;
export const GRAB_PX_COARSE = 24;

/** Al reproducir, la vista salta cuando el playhead cruza esta fracción. */
export const FOLLOW_TRIGGER = 0.8;
export const FOLLOW_JUMP = 0.8;

/** Margen de `zoomToRange` al hacer doble clic en un tramo. */
export const ZOOM_TO_RANGE_PADDING = 0.1;

/** Paso de zoom por tecla + / − y por muesca de rueda. */
export const ZOOM_STEP = 1.25;
