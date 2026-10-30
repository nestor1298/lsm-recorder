/**
 * nueve_manos.ts — el juego de SignaLab: nueve manos por seña.
 *
 * Una seña no queda bien documentada con una sola persona: cada quien la
 * hace con sus manos, su cara, su región y su historia. Por eso cada una
 * de las 222 señas busca nueve manos (nueve personas distintas). El juego
 * es cooperativo, no una carrera:
 *
 * - Tu mano: al guardar una seña eres «la mano 4 de 9». La novena cierra
 *   el círculo y la seña queda completa, con los apodos de sus nueve manos.
 * - Tu atlas de la mano: las 101 configuraciones del LSM Corpus, por los
 *   cinco grupos de dedos seleccionados de Cruz Aldrete. Se llena al grabar.
 * - Tus sellos de ruta: una ruta de SignaPlay grabada completa es un sello.
 * - La comunidad: señas a las que les falta poco, círculos cerrados de la
 *   semana y el mapa de manos por estado. Sin tabla de posiciones.
 *
 * Reglas puras, sin red: las aplica el servidor al confirmar un video y
 * las dibuja el cliente.
 */

import { CM_INVENTORY, FINGER_GROUPS, getFingerGroup } from "./data";
import { cmDeItemId, senaSignaPlay, SIGNAPLAY_UNIDADES, type CorpusId } from "./corpus";
import { claveItem, LISTAS, META_SENANTES, type SenantesPorItem } from "./listas";

export const MANOS_POR_SENA = META_SENANTES;

// ── El círculo de una seña ──────────────────────────────────────

export interface Circulo {
  /** personas distintas que ya la grabaron */
  manos: number;
  de: number;
  /** cuántas faltan para cerrarlo (0 si ya está completo) */
  faltan: number;
  completo: boolean;
}

export function circuloDe(senantes: number): Circulo {
  const manos = Number.isFinite(senantes) ? Math.max(0, Math.floor(senantes)) : 0;
  return {
    manos,
    de: MANOS_POR_SENA,
    faltan: Math.max(0, MANOS_POR_SENA - manos),
    completo: manos >= MANOS_POR_SENA,
  };
}

// ── Atlas de la mano (LSM Corpus) ───────────────────────────────

export type GrupoId = "A" | "B" | "C" | "D" | "E";

export interface GrupoAtlas {
  id: GrupoId;
  /** "Todos los dedos" */
  nombre: string;
  /** "1234": los dedos seleccionados del grupo */
  dedos: string;
  cms: number[];
}

export const GRUPOS_ATLAS: GrupoAtlas[] = FINGER_GROUPS.map((g) => {
  // "A: Todos los dedos (1234)" → id A, nombre, dedos
  const m = /^([A-E]): (.+?)(?: \((\d+)\))?$/.exec(g);
  const id = (m?.[1] ?? g[0]) as GrupoId;
  return {
    id,
    nombre: m?.[2] ?? g,
    dedos: m?.[3] ?? "",
    cms: CM_INVENTORY.filter((cm) => getFingerGroup(cm) === g).map((cm) => cm.cm_id),
  };
});

export function grupoDeCM(cmId: number): GrupoAtlas | undefined {
  return GRUPOS_ATLAS.find((g) => g.cms.includes(cmId));
}

export interface AvanceGrupo {
  grupo: GrupoAtlas;
  tuyas: number[];
  completo: boolean;
}

export interface Atlas {
  grupos: AvanceGrupo[];
  tuyas: number;
  total: number;
}

export function atlasDe(cmIds: Iterable<number>): Atlas {
  const tuyas = new Set(cmIds);
  const grupos = GRUPOS_ATLAS.map((g) => {
    const t = g.cms.filter((id) => tuyas.has(id));
    return { grupo: g, tuyas: t, completo: t.length === g.cms.length && g.cms.length > 0 };
  });
  return {
    grupos,
    tuyas: grupos.reduce((a, g) => a + g.tuyas.length, 0),
    total: CM_INVENTORY.length,
  };
}

// ── Sellos de ruta (SignaPlay) ──────────────────────────────────

export interface Ruta {
  numero: number;
  /** "El primer día" (sin el «Ruta 1 ·» del nombre largo) */
  nombre: string;
  items: string[];
}

export const RUTAS: Ruta[] = SIGNAPLAY_UNIDADES.map((u) => ({
  numero: u.numero,
  nombre: u.nombre.replace(/^Ruta \d+\s*·\s*/, ""),
  items: [...new Set(u.lecciones.flatMap((l) => l.senas))],
}));

export interface AvanceRuta {
  numero: number;
  nombre: string;
  total: number;
  tuyas: number;
  sellada: boolean;
}

export function rutasDe(itemIds: Iterable<string>): AvanceRuta[] {
  const tuyas = new Set(itemIds);
  return RUTAS.map((r) => {
    const n = r.items.filter((i) => tuyas.has(i)).length;
    return {
      numero: r.numero,
      nombre: r.nombre,
      total: r.items.length,
      tuyas: n,
      sellada: n === r.items.length && n > 0,
    };
  });
}

// ── Lo que pasa al guardar ──────────────────────────────────────

export type Momento =
  /** el primer video de la persona */
  | { tipo: "primera" }
  /** tu mano en el círculo de esta seña (o null si ya eras una de sus manos) */
  | { tipo: "mano"; mano: number | null }
  /** fuiste la novena mano: el círculo se cerró */
  | { tipo: "circulo" }
  /** completaste un grupo del atlas */
  | { tipo: "grupo"; grupo: GrupoId }
  /** grabaste una ruta completa de SignaPlay */
  | { tipo: "sello"; ruta: number };

/**
 * Los momentos de un video recién confirmado, del más pequeño al más
 * grande (el estudio los muestra en ese orden). `antes` son las señas en
 * las que la persona ya era una mano, sin la de este video.
 */
export function momentosAlGuardar(args: {
  corpus: CorpusId;
  itemId: string;
  /** su lugar en el círculo; null si ya contaba en esta seña */
  mano: number | null;
  /** videos de la persona contando este */
  videos: number;
  antes: Iterable<string>;
}): Momento[] {
  const antes = new Set(args.antes);
  const clave = claveItem(args.corpus, args.itemId);
  const momentos: Momento[] = [];
  if (args.videos === 1) momentos.push({ tipo: "primera" });
  momentos.push({ tipo: "mano", mano: args.mano });
  if (args.mano === MANOS_POR_SENA) momentos.push({ tipo: "circulo" });
  if (antes.has(clave) || args.mano === null) return momentos;

  const despues = new Set(antes).add(clave);
  if (args.corpus === "lsm") {
    const cm = cmDeItemId(args.itemId);
    const g = cm ? grupoDeCM(cm.cm_id) : undefined;
    if (g && g.cms.every((id) => despues.has(claveItem("lsm", String(id))))) {
      momentos.push({ tipo: "grupo", grupo: g.id });
    }
  } else {
    const s = senaSignaPlay(args.itemId);
    for (const r of RUTAS) {
      if (!r.items.includes(args.itemId) || s === undefined) continue;
      if (r.items.every((i) => despues.has(claveItem("signaplay", i)))) {
        momentos.push({ tipo: "sello", ruta: r.numero });
      }
    }
  }
  return momentos;
}

// ── La comunidad ────────────────────────────────────────────────

export interface SenaCasi {
  corpus: CorpusId;
  itemId: string;
  manos: number;
  faltan: number;
}

/**
 * Señas a las que les falta poco (1 a `hasta` manos), primero las que
 * están a una mano. Quita las que la persona ya grabó: ahí no puede sumar.
 */
export function casiCompletas(
  senantes: SenantesPorItem,
  excluir: Set<string>,
  { hasta = 3, limite = 12 }: { hasta?: number; limite?: number } = {},
): SenaCasi[] {
  const out: SenaCasi[] = [];
  for (const l of LISTAS) {
    for (const itemId of l.items) {
      const clave = claveItem(l.corpus, itemId);
      if (excluir.has(clave)) continue;
      const c = circuloDe(senantes[clave] ?? 0);
      if (c.manos > 0 && c.faltan >= 1 && c.faltan <= hasta) {
        out.push({ corpus: l.corpus, itemId, manos: c.manos, faltan: c.faltan });
      }
    }
  }
  // sin repetir (una seña en dos listas) y las más cerca primero
  const vistas = new Set<string>();
  return out
    .filter((s) => {
      const k = claveItem(s.corpus, s.itemId);
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    })
    .sort((a, b) => a.faltan - b.faltan || b.manos - a.manos)
    .slice(0, limite);
}

export function senasCompletas(senantes: SenantesPorItem): number {
  let n = 0;
  for (const v of Object.values(senantes)) if (circuloDe(v).completo) n += 1;
  return n;
}
