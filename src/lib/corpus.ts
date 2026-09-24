/**
 * corpus.ts — los dos corpus que se pueden grabar en SignaLab.
 *
 * - "lsm": el LSM Corpus fonológico: las 101 configuraciones de mano de
 *   Cruz Aldrete, una seña de ejemplo por configuración.
 * - "signaplay": el corpus léxico para SignaPlay (nivel preescolar «El
 *   Correo de Lexsi»): las 121 señas del banco de la app, en el orden de
 *   sus 11 unidades y 33 lecciones.
 *
 * Un ítem de grabación tiene un `id` estable y seguro para llaves de S3
 * (letras, dígitos, guion y guion bajo). En el LSM Corpus es el número de
 * la CM ("12"); en SignaPlay es la glosa normalizada ("POR_FAVOR").
 */

import { CM_INVENTORY } from "./data";
import type { CMEntry } from "./types";
import signaplay from "./signaplay_corpus.json";

export type CorpusId = "lsm" | "signaplay";

export const CORPUS_IDS: CorpusId[] = ["lsm", "signaplay"];

export function esCorpusId(x: unknown): x is CorpusId {
  return x === "lsm" || x === "signaplay";
}

/** Ítems válidos como llave de objeto en S3 y como sk en la tabla. */
export const ITEM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export interface CorpusInfo {
  id: CorpusId;
  nombre: string;
  lema: string;
  descripcion: string;
  /** qué se graba, en una frase */
  queSeGraba: string;
  /** a quién le sirve */
  paraQuien: string;
  total: number;
}

export const CORPUS_INFO: Record<CorpusId, CorpusInfo> = {
  lsm: {
    id: "lsm",
    nombre: "LSM Corpus",
    lema: "La fonología de la lengua",
    descripcion:
      "Las 101 configuraciones de mano de la LSM, con una seña de ejemplo cada una. Sirve para describir cómo se forma cada seña.",
    queSeGraba: "Una seña por configuración de mano, con la notación de Cruz Aldrete.",
    paraQuien: "Para el corpus de investigación y el modo Aprender.",
    total: CM_INVENTORY.length,
  },
  signaplay: {
    id: "signaplay",
    nombre: "Corpus para SignaPlay",
    lema: "El vocabulario de las niñas y los niños",
    descripcion:
      "Las 121 señas del nivel preescolar de SignaPlay, en el orden de sus 11 rutas. Son los videos que verán las niñas y los niños en la app.",
    queSeGraba: "Una seña por palabra, de frente, despacio y con la cara visible.",
    paraQuien: "Para las lecciones de SignaPlay.",
    total: signaplay.senas.length,
  },
};

// ── SignaPlay ───────────────────────────────────────────────────

export interface SenaSignaPlay {
  id: string;
  glosa: string;
  espanol: string;
  categoria: string;
  unidad: number | null;
  leccion: string | null;
  orden: number;
}

export interface LeccionSignaPlay {
  numero: string;
  titulo: string;
  senas: string[];
}

export interface UnidadSignaPlay {
  numero: number;
  id: string;
  nombre: string;
  concepto: string;
  lecciones: LeccionSignaPlay[];
}

export const SIGNAPLAY_SENAS: SenaSignaPlay[] = signaplay.senas as SenaSignaPlay[];
export const SIGNAPLAY_UNIDADES: UnidadSignaPlay[] =
  signaplay.unidades as UnidadSignaPlay[];
export const SIGNAPLAY_FUENTE = signaplay.fuente;

const SENA_POR_ID = new Map(SIGNAPLAY_SENAS.map((s) => [s.id, s]));

export function senaSignaPlay(id: string): SenaSignaPlay | undefined {
  return SENA_POR_ID.get(id);
}

/** Ítems de una sesión SignaPlay: toda la app o una unidad (ruta). */
export function itemsSignaPlay(unidad: number | null): string[] {
  if (unidad === null) return SIGNAPLAY_SENAS.map((s) => s.id);
  const u = SIGNAPLAY_UNIDADES.find((x) => x.numero === unidad);
  return u ? u.lecciones.flatMap((l) => l.senas) : [];
}

// ── LSM Corpus ──────────────────────────────────────────────────

export function itemIdDeCM(cmId: number): string {
  return String(cmId);
}

export function cmDeItemId(itemId: string): CMEntry | undefined {
  const n = Number(itemId);
  if (!Number.isInteger(n)) return undefined;
  return CM_INVENTORY.find((cm) => cm.cm_id === n);
}

/** Ítems de una sesión del LSM Corpus: las 101 CM o un nivel de frecuencia. */
export function itemsLSM(tier: number | null): string[] {
  const cms =
    tier === null
      ? CM_INVENTORY
      : CM_INVENTORY.filter((cm) => cm.frequency_tier === tier);
  return cms.map((cm) => itemIdDeCM(cm.cm_id));
}

// ── Descripción común ───────────────────────────────────────────

export interface DescripcionItem {
  /** lo que se lee en grande: "HOLA" o "BIEN" */
  titulo: string;
  /** "hola · saludo · ruta 2" o "CM #12 · 1234+/a+" */
  detalle: string;
  /** etiqueta corta para rejillas y listas: "12", "HOLA" */
  corto: string;
}

export function describirItem(corpus: CorpusId, itemId: string): DescripcionItem {
  if (corpus === "signaplay") {
    const s = senaSignaPlay(itemId);
    if (!s) return { titulo: itemId, detalle: "SignaPlay", corto: itemId };
    const partes = [s.espanol, s.categoria];
    if (s.unidad !== null) partes.push(`ruta ${s.unidad}`);
    return { titulo: s.glosa, detalle: partes.join(" · "), corto: s.glosa };
  }
  const cm = cmDeItemId(itemId);
  if (!cm) return { titulo: `Seña #${itemId}`, detalle: "LSM Corpus", corto: itemId };
  return {
    titulo: cm.example_sign,
    detalle: `CM #${cm.cm_id} · ${cm.cruz_aldrete_notation}`,
    corto: String(cm.cm_id),
  };
}
