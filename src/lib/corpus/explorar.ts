/**
 * explorar.ts — capa pura de /corpus: de los registros del corpus VOCES
 * EN SEÑAS a filas ligeras para la lista, y la búsqueda con filtros.
 *
 * El detalle de cada enunciado (sus señas con la fonología) no va en la
 * página: se publica por episodio en public/corpus/e/<episodio>.json
 * (scripts/voces/publish.mjs) y se trae al abrir un enunciado.
 */

import { normaliza } from "@/lib/lexicon/browse";
import type { Candidato, FonologiaSena } from "./voces";

// ── Lo que hay en data/voces-en-senas/ ─────────────────────────

export interface SenaCorpus {
  i: number;
  t0: number;
  t1: number;
  fonologia: FonologiaSena;
  glosa: string | null;
  candidatos: Candidato[];
  token: string;
}

export interface RegistroCorpus {
  id: string;
  episodio: string;
  oracion: { texto: string; t0: number; t1: number };
  senante: { id: string; seudonimo: string; rol: string | null } | null;
  sena: { t0: number; t1: number; desfase_s: number };
  toma_primer_plano?: number;
  senas: SenaCorpus[];
  /** null si el tramo no tiene señas */
  transliteracion: string | null;
}

export interface EpisodioIndice {
  youtube_id: string;
  duration_s: number;
  upload_date: string;
}

export interface Conteo {
  clave: string;
  n: number;
}

export interface Caracterizacion {
  mano_dominante: "derecha" | "izquierda" | null;
  enunciados: number;
  minutos_senando: number;
  senas: number;
  senas_por_segundo: number;
  dos_manos: number;
  espacio_de_senado: { ancho: number; alto: number; centro: { x: number; y: number } } | null;
  lugares: Conteo[];
  formas: Conteo[];
  contornos: Conteo[];
  en_primer_plano: number;
}

export interface ParticipanteCorpus {
  id: string;
  seudonimo: string;
  episodios: Record<string, { en_pantalla_s: number; rol: string | null }>;
  en_pantalla_s: number;
  rol: string | null;
  condicion: string | null;
  caracterizacion: Caracterizacion | null;
}

// ── Lo que recibe la página ────────────────────────────────────

/** Episodio numerado por fecha de publicación (sin título: trae nombres) */
export interface EpisodioFila {
  id: string;
  n: number;
  fecha: string;
  duracion_s: number;
}

/**
 * Cómo llega la seña: «propia» si la persona seña sus palabras (el
 * subtítulo traduce la seña) o «interpretada» si seña un intérprete (la
 * seña traduce lo que dijo otra persona y el subtítulo puede ser el
 * original). Sale del rol del señante, no del video.
 */
export type Direccion = "propia" | "interpretada";

export const DIRECCION_ES: Record<Direccion, string> = { propia: "Seña propia", interpretada: "Interpretación" };

/** ¿El rótulo de la persona dice que es intérprete? */
export const esInterprete = (p: Pick<ParticipanteCorpus, "rol" | "condicion">) =>
  p.condicion === "intérprete" || /INT[ÉE]RPRETE/i.test(p.rol ?? "");

/** Fila de la lista: lo justo para buscar, filtrar y pintar */
export interface FilaEnunciado {
  id: string;
  /** id de YouTube del episodio (para traer el detalle) */
  e: string;
  /** número del episodio */
  n: number;
  t0: number;
  t1: number;
  texto: string;
  /** id del señante (P01…) o null si no se supo */
  p: string | null;
  tr: string;
  senas: number;
  glosas: number;
  /** parte del tramo en primer plano, 0–1 */
  pp: number | null;
  /** null si no se supo quién seña */
  d: Direccion | null;
}

export interface PersonaFila {
  id: string;
  seudonimo: string;
  rol: string | null;
  condicion: string | null;
  episodios: number;
  c: Caracterizacion | null;
}

/** «20251021» → «2025-10-21» */
const fecha = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d);

export function episodiosNumerados(eps: EpisodioIndice[]): EpisodioFila[] {
  return [...eps]
    .sort((a, b) => a.upload_date.localeCompare(b.upload_date) || a.youtube_id.localeCompare(b.youtube_id))
    .map((e, k) => ({ id: e.youtube_id, n: k + 1, fecha: fecha(e.upload_date), duracion_s: e.duration_s }));
}

/** `interpretes`: ids de las personas cuyo rótulo dice que interpretan */
export function filasDe(registros: RegistroCorpus[], eps: EpisodioFila[], interpretes: ReadonlySet<string> = new Set()): FilaEnunciado[] {
  const num = new Map(eps.map((e) => [e.id, e.n]));
  return registros
    .map((r) => ({
      id: r.id,
      e: r.episodio,
      n: num.get(r.episodio) ?? 0,
      t0: r.oracion.t0,
      t1: r.oracion.t1,
      texto: r.oracion.texto,
      p: r.senante?.id ?? null,
      tr: r.transliteracion ?? "",
      senas: r.senas.length,
      glosas: r.senas.filter((s) => s.glosa).length,
      pp: r.toma_primer_plano ?? null,
      d: r.senante ? (interpretes.has(r.senante.id) ? ("interpretada" as const) : ("propia" as const)) : null,
    }))
    .sort((a, b) => a.n - b.n || a.t0 - b.t0);
}

export function personasDe(ps: ParticipanteCorpus[]): PersonaFila[] {
  return ps.map((p) => ({
    id: p.id,
    seudonimo: p.seudonimo,
    rol: p.rol,
    condicion: p.condicion,
    episodios: Object.keys(p.episodios).length,
    c: p.caracterizacion,
  }));
}

// ── Búsqueda ───────────────────────────────────────────────────

export interface FiltrosCorpus {
  q: string;
  /** id de persona, o "" para todas */
  persona: string;
  /** número de episodio, o 0 para todos */
  episodio: number;
  soloConGlosa: boolean;
  /** "" para todas */
  direccion: Direccion | "";
}

export const FILTROS_CORPUS: FiltrosCorpus = { q: "", persona: "", episodio: 0, soloConGlosa: false, direccion: "" };

/**
 * Filtra las filas. La búsqueda va sin acentos ni mayúsculas, y cada
 * palabra debe aparecer en la oración o en la transliteración
 * («gracias» encuentra «¡Gracias!» y GRACIAS).
 */
export function filtraEnunciados(filas: FilaEnunciado[], f: FiltrosCorpus): FilaEnunciado[] {
  const palabras = normaliza(f.q).split(" ").filter(Boolean);
  return filas.filter((r) => {
    if (f.persona && r.p !== f.persona) return false;
    if (f.episodio && r.n !== f.episodio) return false;
    if (f.soloConGlosa && r.glosas === 0) return false;
    if (f.direccion && r.d !== f.direccion) return false;
    if (palabras.length) {
      const hay = `${normaliza(r.texto)} ${normaliza(r.tr.replace(/-/g, " "))}`;
      if (!palabras.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

/** 163.2 → «2:43» */
export function minSeg(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Id de lexicón de la glosa elegida (la candidata con esa glosa) */
export function idDeGlosa(s: Pick<SenaCorpus, "glosa" | "candidatos">): string | null {
  if (!s.glosa) return null;
  return s.candidatos.find((c) => c.glosa === s.glosa)?.id ?? null;
}
