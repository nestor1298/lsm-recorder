/**
 * cuatro_d.ts — la transliteración de un enunciado en 4D: sus señas,
 * en el orden y al ritmo en que se señaron, como una sola matriz
 * segmental (D → M → D …) que Lexsi reproduce.
 *
 * Cada seña se arma con su propia fonología del corpus (forma, lugar,
 * orientación, contorno y plano), no con la del léxico: así el avatar
 * muestra lo que se anotó, glosado o no, y es eso lo que una persona
 * Sorda puede confirmar o corregir. Entre seña y seña va una transición
 * recta del lugar de una al de la otra.
 *
 * El tiempo es el del video: cada seña ocupa su tramo [t0, t1] medido
 * desde la primera, y las transiciones llenan los huecos. Si el hueco es
 * muy corto se le quita un poco a las detenciones de los lados.
 */

import { CM_INVENTORY } from "@/lib/data";
import { UB_NEUTRO, ubPorCodigo } from "@/lib/lexicon/to_construction";
import type { HoldSegment, MovementSegment, Segment, SignConstruction } from "@/lib/sign_types";
import type { SenaCorpus } from "./explorar";

/** Transición mínima entre dos señas, en ms */
const TRANSICION_MIN = 180;
/** Repeticiones que se reproducen como ida y vuelta */
const MAX_REPETICIONES = 3;
/** Pausa en reposo al inicio y al final de la oración */
const MARGEN = 250;

/** Una seña del enunciado en la línea de tiempo (una «entrada») */
export interface Entrada {
  /** Id estable para revisarla: «<enunciado>/<i>» */
  id: string;
  /** Índice dentro de `senas` del enunciado */
  k: number;
  inicio: number;
  fin: number;
  /** Lo que se lee en la línea de tiempo: la glosa o la descripción */
  etiqueta: string;
  glosa: boolean;
}

export interface Tramo {
  inicio: number;
  fin: number;
}

export interface Cuatro4D {
  sign: SignConstruction;
  /** Tramo de cada segmento de `sign.segments` */
  horario: Tramo[];
  entradas: Entrada[];
  duracion: number;
}

const cmPorId = (id: number | undefined) => (id === undefined ? null : (CM_INVENTORY.find((c) => c.cm_id === id) ?? null));

let n = 0;
const sid = (t: string) => `4d-${t}${++n}`;

/** Detención y movimiento(s) de una seña, con su duración relativa */
function segmentosDe(s: SenaCorpus): { seg: Segment; peso: number }[] {
  const f = s.fonologia;
  const handMode: HoldSegment["handMode"] = f.dos_manos && f.relacion === "SIMETRICA" ? "both_symmetric" : "dominant";
  const hold: HoldSegment = {
    type: "D",
    id: sid("d"),
    cm: cmPorId(f.cm[0]?.id),
    ub: ubPorCodigo(f.ub ?? undefined) ?? UB_NEUTRO,
    orientation: { palm: f.palma ?? "FORWARD", fingers: f.dedos ?? "UP" },
    handMode,
  };
  if (!f.contorno) return [{ seg: hold, peso: 1 }];
  const move = (): MovementSegment => ({
    type: "M",
    id: sid("m"),
    contour: f.contorno ?? "STRAIGHT",
    local: null,
    plane: f.plano ?? "VERTICAL",
  });
  const veces = Math.max(1, Math.min(MAX_REPETICIONES, f.repeticion?.count ?? 1));
  const out: { seg: Segment; peso: number }[] = [{ seg: hold, peso: 1 }];
  for (let r = 0; r < veces; r++) {
    out.push({ seg: move(), peso: 2 });
    out.push({ seg: { ...hold, id: sid("d") }, peso: 1 });
  }
  return out;
}

/** Arma la matriz y el horario del enunciado. `id` es el del enunciado. */
export function cuatroD(id: string, senas: SenaCorpus[]): Cuatro4D {
  const orden = [...senas].sort((a, b) => a.t0 - b.t0);
  const base = orden[0]?.t0 ?? 0;
  const ms = (t: number) => MARGEN + Math.round((t - base) * 1000);

  // tramos de las señas, recortados para dejar transiciones mínimas
  const tramos: Tramo[] = orden.map((s) => ({ inicio: ms(s.t0), fin: Math.max(ms(s.t1), ms(s.t0) + 120) }));
  for (let k = 1; k < tramos.length; k++) {
    const a = tramos[k - 1];
    const b = tramos[k];
    const hueco = b.inicio - a.fin;
    if (hueco >= TRANSICION_MIN) continue;
    const falta = TRANSICION_MIN - hueco;
    // se reparte entre las dos señas sin dejar ninguna en menos de 120 ms
    a.fin = Math.max(a.inicio + 120, a.fin - falta / 2);
    b.inicio = Math.max(b.inicio, a.fin + TRANSICION_MIN);
    if (b.fin < b.inicio + 120) b.fin = b.inicio + 120;
  }

  const segments: Segment[] = [];
  const horario: Tramo[] = [];
  const entradas: Entrada[] = [];
  orden.forEach((s, k) => {
    const tr = tramos[k];
    if (k > 0) {
      // transición recta desde la seña anterior
      segments.push({ type: "M", id: sid("t"), contour: "STRAIGHT", local: null, plane: "VERTICAL" });
      horario.push({ inicio: tramos[k - 1].fin, fin: tr.inicio });
    }
    const partes = segmentosDe(s);
    const total = partes.reduce((x, p) => x + p.peso, 0);
    let t = tr.inicio;
    for (const p of partes) {
      const d = ((tr.fin - tr.inicio) * p.peso) / total;
      segments.push(p.seg);
      horario.push({ inicio: t, fin: t + d });
      t += d;
    }
    entradas.push({
      id: `${id}/${s.i}`,
      k: senas.indexOf(s),
      inicio: tr.inicio,
      fin: tr.fin,
      etiqueta: s.glosa ?? s.token,
      glosa: Boolean(s.glosa),
    });
  });

  const duracion = (tramos.at(-1)?.fin ?? 0) + MARGEN;
  // reposo al inicio y al final: se sostiene la primera y la última detención
  if (horario.length) {
    horario[0] = { ...horario[0], inicio: 0 };
    horario[horario.length - 1] = { ...horario[horario.length - 1], fin: duracion };
  }
  return {
    sign: { name: id, segments, rnm: { eyebrows: "NEUTRAL", mouth: "NEUTRAL", head: "NONE" } },
    horario,
    entradas,
    duracion,
  };
}

/** Segmento activo en `ms` y avance (0–1) dentro de él, suavizado en los movimientos */
export function cuadroEn(c: Cuatro4D, ms: number): { indice: number; t: number } {
  const h = c.horario;
  if (!h.length) return { indice: 0, t: 0 };
  let lo = 0;
  let hi = h.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (h[mid].fin <= ms) lo = mid + 1;
    else hi = mid;
  }
  const tr = h[lo];
  const p = tr.fin > tr.inicio ? Math.min(1, Math.max(0, (ms - tr.inicio) / (tr.fin - tr.inicio))) : 1;
  return { indice: lo, t: p * p * (3 - 2 * p) };
}

/** Entrada que suena en `ms` (o null en una transición) */
export function entradaEn(c: Cuatro4D, ms: number): Entrada | null {
  return c.entradas.find((e) => ms >= e.inicio && ms < e.fin) ?? null;
}
