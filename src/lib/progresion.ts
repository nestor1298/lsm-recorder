/**
 * progresion.ts — el juego del estudio: niveles, cofres, medallas y rareza.
 *
 * Reglas puras, sin red ni almacenamiento, compartidas por el servidor (que
 * las aplica al confirmar un video) y por el cliente (que las dibuja):
 *
 * - Cada video confirmado y no retirado sube un nivel: nivel = videos.
 * - Cada 10 videos se abre un cofre con la seña más rara de esa decena.
 * - Medallas por nivel: Bronce 30, Plata 50, Oro 70, Diamante 100.
 * - La rareza de una seña sale del corpus: en el LSM Corpus, del nivel de
 *   frecuencia de la configuración de mano (T1 común … T4 legendaria); en
 *   SignaPlay, de qué tan adentro de las rutas está la seña.
 * - El tablero es semanal: semana ISO en UTC ("2026-W44").
 */

import { cmDeItemId, senaSignaPlay, type CorpusId } from "./corpus";

// ── Rareza ──────────────────────────────────────────────────────

export type Rareza = "comun" | "rara" | "epica" | "legendaria";

export interface RarezaInfo {
  id: Rareza;
  nombre: string;
  /** 0 = común … 3 = legendaria, para ordenar y comparar */
  orden: number;
  /** clases de pastilla (sistema OtherAI: tinta, acentos de pilar) */
  clase: string;
}

export const RAREZA_INFO: Record<Rareza, RarezaInfo> = {
  comun: { id: "comun", nombre: "Común", orden: 0, clase: "bg-gray-100 text-gray-700" },
  rara: { id: "rara", nombre: "Rara", orden: 1, clase: "bg-accent-tint text-accent-deep" },
  epica: { id: "epica", nombre: "Épica", orden: 2, clase: "bg-gold-tint text-gold-deep" },
  legendaria: {
    id: "legendaria",
    nombre: "Legendaria",
    orden: 3,
    clase: "bg-ink text-gold",
  },
};

export const RAREZAS: Rareza[] = ["comun", "rara", "epica", "legendaria"];

const RAREZA_POR_TIER: Record<number, Rareza> = {
  1: "comun",
  2: "rara",
  3: "epica",
  4: "legendaria",
};

/** Rareza de un ítem según su corpus. Ítems desconocidos cuentan como comunes. */
export function rarezaDe(corpus: CorpusId, itemId: string): Rareza {
  if (corpus === "lsm") {
    const cm = cmDeItemId(itemId);
    return cm ? (RAREZA_POR_TIER[cm.frequency_tier] ?? "comun") : "comun";
  }
  const s = senaSignaPlay(itemId);
  if (!s) return "comun";
  if (s.unidad === null) return "legendaria";
  if (s.unidad <= 4) return "comun";
  if (s.unidad <= 8) return "rara";
  return "epica";
}

export function masRara(a: Rareza, b: Rareza): Rareza {
  return RAREZA_INFO[a].orden >= RAREZA_INFO[b].orden ? a : b;
}

// ── Niveles, cofres y medallas ──────────────────────────────────

export const COFRE_CADA = 10;

export interface Medalla {
  id: "bronce" | "plata" | "oro" | "diamante";
  nombre: string;
  nivel: number;
  /** clases de la ficha de la medalla */
  clase: string;
}

export const MEDALLAS: readonly Medalla[] = [
  { id: "bronce", nombre: "Bronce", nivel: 30, clase: "bg-coral-tint text-coral-deep" },
  { id: "plata", nombre: "Plata", nivel: 50, clase: "bg-gray-200 text-gray-700" },
  { id: "oro", nombre: "Oro", nivel: 70, clase: "bg-gold-tint text-gold-deep" },
  { id: "diamante", nombre: "Diamante", nivel: 100, clase: "bg-accent-tint text-accent-deep" },
];

/** Nivel = videos confirmados y no retirados (nunca negativo ni fraccionario). */
export function nivelDe(videos: number): number {
  if (!Number.isFinite(videos)) return 0;
  return Math.max(0, Math.floor(videos));
}

export function medallaDe(nivel: number): Medalla | null {
  let m: Medalla | null = null;
  for (const medalla of MEDALLAS) if (nivel >= medalla.nivel) m = medalla;
  return m;
}

export function siguienteMedalla(nivel: number): Medalla | null {
  return MEDALLAS.find((m) => nivel < m.nivel) ?? null;
}

/** ¿Se abre un cofre al pasar de `antes` a `despues` videos? */
export function abreCofre(antes: number, despues: number): boolean {
  const a = nivelDe(antes);
  const d = nivelDe(despues);
  if (d <= a) return false;
  return Math.floor(d / COFRE_CADA) > Math.floor(a / COFRE_CADA);
}

/** Videos que faltan para el siguiente cofre (1…10). */
export function faltanParaCofre(videos: number): number {
  const n = nivelDe(videos);
  return COFRE_CADA - (n % COFRE_CADA);
}

export interface EventosDeSubida {
  nivel: number;
  cofre: boolean;
  /** medalla recién ganada, si el nivel la cruzó en esta subida */
  medalla: Medalla | null;
}

/** Qué pasa al pasar de `antes` a `despues` videos (lo celebra el estudio). */
export function eventosAlSubir(antes: number, despues: number): EventosDeSubida {
  const a = nivelDe(antes);
  const d = nivelDe(despues);
  const medalla = MEDALLAS.find((m) => a < m.nivel && d >= m.nivel) ?? null;
  return { nivel: d, cofre: abreCofre(a, d), medalla };
}

// ── Semana ISO (UTC) ────────────────────────────────────────────

/** "2026-W44": semana ISO 8601 de la fecha, en UTC. */
export function semanaIso(fecha: Date): string {
  const d = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()),
  );
  // Jueves de la misma semana ISO decide el año
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

export const SEMANA_RE = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

/** Lunes 00:00 UTC de una semana ISO, o null si el id no es válido. */
export function inicioDeSemana(semana: string): Date | null {
  if (!SEMANA_RE.test(semana)) return null;
  const anio = Number(semana.slice(0, 4));
  const n = Number(semana.slice(6));
  // El 4 de enero siempre cae en la semana 1
  const cuatroEnero = new Date(Date.UTC(anio, 0, 4));
  const dia = cuatroEnero.getUTCDay() || 7;
  const lunesSemana1 = new Date(cuatroEnero);
  lunesSemana1.setUTCDate(cuatroEnero.getUTCDate() - dia + 1);
  const lunes = new Date(lunesSemana1);
  lunes.setUTCDate(lunesSemana1.getUTCDate() + (n - 1) * 7);
  // W53 solo existe en algunos años: si el lunes cae en otra semana, no existe.
  return semanaIso(lunes) === semana ? lunes : null;
}

/** Texto corto para la gente: "27 oct – 2 nov". */
export function rangoDeSemana(semana: string, locale = "es-MX"): string {
  const lunes = inicioDeSemana(semana);
  if (!lunes) return semana;
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);
  const f = (d: Date) =>
    d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(lunes)} – ${f(domingo)}`;
}
