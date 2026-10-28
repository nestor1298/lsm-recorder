/**
 * listas.ts — las listas que se eligen antes de entrar al estudio.
 *
 * Una lista es un bloque de señas de uno de los dos corpus:
 * - LSM Corpus: una lista por nivel de frecuencia (T1 … T4).
 * - SignaPlay: una lista por ruta (11) y una más con las señas sueltas.
 *
 * La meta de la comunidad es que cada seña la grabe gente distinta
 * (`META_SENANTES` personas por seña). La cobertura de una lista es el
 * promedio, seña por seña, de cuánto falta para esa meta.
 */

import { CM_INVENTORY, TIER_LABELS } from "./data";
import {
  itemsLSM,
  SIGNAPLAY_SENAS,
  SIGNAPLAY_UNIDADES,
  type CorpusId,
} from "./corpus";

export interface ListaDef {
  id: string;
  corpus: CorpusId;
  nombre: string;
  /** qué tienen en común estas señas, en una frase */
  subtitulo: string;
  items: string[];
  /** la comunidad la necesita primero: por donde conviene empezar */
  prioridad: boolean;
}

export const LISTA_ID_RE = /^[a-z0-9-]{2,32}$/;

function listasLSM(): ListaDef[] {
  return [1, 2, 3, 4].map((tier) => ({
    id: `lsm-t${tier}`,
    corpus: "lsm",
    nombre: `${TIER_LABELS[tier]}`,
    subtitulo: `Configuraciones de mano de nivel ${tier}, una seña de ejemplo por cada una.`,
    items: itemsLSM(tier),
    prioridad: tier === 1,
  }));
}

function listasSignaPlay(): ListaDef[] {
  const rutas: ListaDef[] = SIGNAPLAY_UNIDADES.map((u) => ({
    id: `sp-u${u.numero}`,
    corpus: "signaplay",
    nombre: u.nombre,
    subtitulo: u.concepto,
    items: u.lecciones.flatMap((l) => l.senas),
    prioridad: u.numero <= 3,
  }));
  const enRutas = new Set(rutas.flatMap((r) => r.items));
  const sueltas = SIGNAPLAY_SENAS.filter((s) => !enRutas.has(s.id)).map((s) => s.id);
  if (sueltas.length > 0) {
    rutas.push({
      id: "sp-sueltas",
      corpus: "signaplay",
      nombre: "Señas sueltas",
      subtitulo: "Señas del banco de SignaPlay que todavía no entran en ninguna ruta.",
      items: sueltas,
      prioridad: false,
    });
  }
  return rutas;
}

export const LISTAS: ListaDef[] = [...listasLSM(), ...listasSignaPlay()];

const POR_ID = new Map(LISTAS.map((l) => [l.id, l]));
const POR_ITEM = new Map<string, ListaDef>();
for (const l of LISTAS) for (const it of l.items) POR_ITEM.set(`${l.corpus}:${it}`, l);

export function listaDe(id: string): ListaDef | undefined {
  return POR_ID.get(id);
}

export function listaDeItem(corpus: CorpusId, itemId: string): ListaDef | undefined {
  return POR_ITEM.get(`${corpus}:${itemId}`);
}

/** Total de señas en los dos corpus (la meta se mide sobre todas). */
export const TOTAL_SENAS = CM_INVENTORY.length + SIGNAPLAY_SENAS.length;

// ── Meta de la comunidad ────────────────────────────────────────

/** Personas distintas que queremos por cada seña. */
export const META_SENANTES = 9;

/** `corpus:itemId` → personas distintas que la han grabado. */
export type SenantesPorItem = Record<string, number>;

export const claveItem = (corpus: CorpusId, itemId: string): string =>
  `${corpus}:${itemId}`;

export interface ResumenLista {
  id: string;
  /** promedio de personas por seña, truncado, 0…META_SENANTES */
  senantes: number;
  /** 0…100, cuánto de la meta ya está, truncado */
  pct: number;
}

export function resumenLista(lista: ListaDef, senantes: SenantesPorItem): ResumenLista {
  if (lista.items.length === 0) return { id: lista.id, senantes: 0, pct: 0 };
  let suma = 0;
  for (const it of lista.items) {
    const n = senantes[claveItem(lista.corpus, it)] ?? 0;
    suma += Math.min(Math.max(0, n), META_SENANTES);
  }
  const promedio = suma / lista.items.length;
  return {
    id: lista.id,
    senantes: Math.floor(promedio),
    pct: Math.floor((promedio / META_SENANTES) * 100),
  };
}

export interface MetaComunidad {
  /** 0…100, truncado */
  pct: number;
  /** grabaciones distintas (persona × seña) que ya cuentan para la meta */
  hechas: number;
  /** META_SENANTES × todas las señas */
  meta: number;
}

export function metaComunidad(senantes: SenantesPorItem): MetaComunidad {
  let hechas = 0;
  for (const l of LISTAS) {
    for (const it of l.items) {
      hechas += Math.min(Math.max(0, senantes[claveItem(l.corpus, it)] ?? 0), META_SENANTES);
    }
  }
  const meta = META_SENANTES * TOTAL_SENAS;
  return { pct: Math.floor((hechas / meta) * 100), hechas, meta };
}

/**
 * La lista "más necesitada": la de menor cobertura que todavía no llega a
 * la meta; entre iguales gana la prioritaria y luego la más corta.
 */
export function listaMasNecesitada(resumenes: ResumenLista[]): string | null {
  let mejor: { r: ResumenLista; l: ListaDef } | null = null;
  for (const r of resumenes) {
    const l = listaDe(r.id);
    if (!l || r.pct >= 100) continue;
    if (
      !mejor ||
      r.pct < mejor.r.pct ||
      (r.pct === mejor.r.pct &&
        ((l.prioridad && !mejor.l.prioridad) ||
          (l.prioridad === mejor.l.prioridad && l.items.length < mejor.l.items.length)))
    ) {
      mejor = { r, l };
    }
  }
  return mejor ? mejor.r.id : null;
}

/** Minutos estimados para grabar n señas (unos 40 s por seña, redondeado a 5). */
export function minutosEstimados(n: number): number {
  const min = Math.ceil((n * 40) / 60);
  return Math.max(5, Math.ceil(min / 5) * 5);
}
