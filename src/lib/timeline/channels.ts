/**
 * channels.ts — proyección de `PSHRSegment[]` a tramos por canal.
 *
 * PRINCIPIO RECTOR: los canales son PROYECCIONES de la misma secuencia
 * de segmentos, no pistas independientes. Las fronteras temporales se
 * editan en un solo lugar (el canal maestro) y todos los demás se
 * redibujan a partir de ahí. Ningún canal guarda tiempos propios.
 *
 * Reglas de dibujo:
 *  - Un tramo existe SOLO donde el valor está definido. Un hueco es
 *    información: ese segmento no anota esa dimensión (se dibuja como
 *    carril vacío con textura tenue, distinto de un valor "neutral").
 *  - Valores contiguos idénticos se FUSIONAN en un solo tramo; la
 *    frontera de segmento interna queda como divisoria tenue.
 *  - La procedencia del tramo es "auto" solo si TODOS los segmentos que
 *    lo componen traen ese campo como "auto".
 */

import type {
  PSHRSegment,
  SignAnnotation,
  AnnotProvenance,
} from "@/lib/types";
import {
  PHASE_ES,
  CONTOUR_ES,
  LOCAL_ES,
  PALM_ES,
  FINGER_ES,
  FOREARM_ES,
  CONTACT_ES,
  EYEBROWS_ES,
  MOUTH_ES,
  HEAD_ES,
  RELATION_ES,
  REPETITION_ES,
  CANAL_ES,
  SUBFILA_ES,
  directionLabel,
  ubName,
} from "@/lib/anotar_labels";

export type CanalId =
  | "segmentos"
  | "mano"
  | "lugar"
  | "orientacion"
  | "movimiento"
  | "rnm"
  | "manoBase";

export interface SubfilaDef {
  id: string;
  label: string;
}

export interface CanalDef {
  id: CanalId;
  label: string;
  tecnico?: string;
  /** El maestro es el único donde se editan fronteras. */
  maestro?: boolean;
  subfilas?: SubfilaDef[];
  /**
   * Reservado: los RNM son la única dimensión que lingüísticamente
   * quiere alcance temporal propio (una ceja levantada puede abarcar
   * varias señas). Todavía NO se usa. Ver docs/timeline-multicanal.md.
   */
  independentScope: boolean;
}

const canal = (id: CanalId, extra: Partial<CanalDef> = {}): CanalDef => ({
  id,
  label: CANAL_ES[id].label,
  tecnico: CANAL_ES[id].tecnico,
  independentScope: false,
  ...extra,
});

export const CANALES: CanalDef[] = [
  canal("segmentos", { maestro: true }),
  canal("mano"),
  canal("lugar"),
  canal("orientacion", {
    subfilas: [
      { id: "palma", label: SUBFILA_ES.palma },
      { id: "dedos", label: SUBFILA_ES.dedos },
    ],
  }),
  canal("movimiento"),
  canal("rnm", {
    subfilas: [
      { id: "cejas", label: SUBFILA_ES.cejas },
      { id: "boca", label: SUBFILA_ES.boca },
      { id: "cabeza", label: SUBFILA_ES.cabeza },
    ],
  }),
  canal("manoBase"),
];

/** Valor de una dimensión en un segmento; `undefined` = hueco. */
export interface Valor {
  /** clave de igualdad para fusionar contiguos */
  key: string;
  /** texto corto para el tramo */
  label: string;
  /** texto largo para lectores de pantalla */
  aria: string;
  /** datos crudos para dibujar glifos (MiniHand, flechas, trazos) */
  data?: Record<string, unknown>;
  /** campo de `provenance` que respalda este valor */
  campo?: string;
}

const v = (
  key: string,
  label: string,
  aria = label,
  data?: Record<string, unknown>,
  campo?: string,
): Valor => ({ key, label, aria, data, campo });

/**
 * Extrae el valor de un canal (y sub-fila) para un segmento.
 * Devuelve undefined cuando esa dimensión no está anotada: eso es un
 * hueco y se dibuja distinto de un valor vacío.
 */
export function valorDe(
  canalId: CanalId,
  segmento: PSHRSegment,
  anotacion?: SignAnnotation,
  subfila?: string,
): Valor | undefined {
  const s = segmento;
  switch (canalId) {
    case "segmentos": {
      const tipo = s.type === "M" ? "movimiento" : s.type === "D" ? "detención" : "transición";
      // nunca se fusiona: cada segmento es su propio tramo
      return v(
        `seg:${s.id}`,
        `${s.type} · ${PHASE_ES[s.phase] ?? s.phase}`,
        `${tipo}, fase ${(PHASE_ES[s.phase] ?? s.phase).toLowerCase()}`,
        { type: s.type, phase: s.phase },
      );
    }
    case "mano": {
      if (s.cm_id === undefined) return undefined;
      const cambio = s.end_cm_id !== undefined || s.local_movement === "PROGRESSIVE";
      return v(
        `cm:${s.cm_id}:${s.end_cm_id ?? ""}`,
        `#${s.cm_id}${s.end_cm_id ? `→#${s.end_cm_id}` : ""}`,
        `forma de la mano ${s.cm_id}${s.end_cm_id ? `, cambia a ${s.end_cm_id}` : ""}`,
        { cmId: s.cm_id, endCmId: s.end_cm_id, cambio },
        "cm_id",
      );
    }
    case "lugar": {
      if (!s.location_code) return undefined;
      const nombre = ubName(s.location_code) ?? s.location_code;
      const contacto = s.contact ? CONTACT_ES[s.contact] : undefined;
      return v(
        `ub:${s.location_code}:${s.contact ?? ""}`,
        contacto ? `${nombre} · ${contacto.toLowerCase()}` : nombre,
        `lugar ${nombre.toLowerCase()}${contacto ? `, ${contacto.toLowerCase()}` : ""}`,
        { code: s.location_code, contact: s.contact, region: s.body_region },
        "location_code",
      );
    }
    case "orientacion": {
      if (subfila === "dedos") {
        if (!s.finger_pointing) return undefined;
        return v(
          `fp:${s.finger_pointing}`,
          FINGER_ES[s.finger_pointing].replace("Dedos ", ""),
          FINGER_ES[s.finger_pointing].toLowerCase(),
          { dir: s.finger_pointing },
          "finger_pointing",
        );
      }
      if (!s.palm_facing) return undefined;
      const antebrazo = s.forearm_rotation ? FOREARM_ES[s.forearm_rotation] : undefined;
      return v(
        `pf:${s.palm_facing}:${s.forearm_rotation ?? ""}`,
        `${PALM_ES[s.palm_facing].replace("Palma ", "")}${antebrazo ? ` · ${antebrazo.toLowerCase()}` : ""}`,
        `${PALM_ES[s.palm_facing].toLowerCase()}${antebrazo ? `, antebrazo ${antebrazo.toLowerCase()}` : ""}`,
        { dir: s.palm_facing, forearm: s.forearm_rotation },
        "palm_facing",
      );
    }
    case "movimiento": {
      // solo tiene sentido sobre segmentos de movimiento
      const esM = s.type === "M" || s.phase === "STROKE";
      if (!esM) return undefined;
      const partes = [
        s.contour_movement && CONTOUR_ES[s.contour_movement],
        s.direction && directionLabel(s.direction),
        s.repetition && `×${s.repetition.count}`,
        s.local_movement && LOCAL_ES[s.local_movement],
      ].filter(Boolean) as string[];
      if (partes.length === 0) return undefined;
      return v(
        `mv:${s.contour_movement ?? ""}:${JSON.stringify(s.direction ?? null)}:${s.repetition?.count ?? ""}:${s.local_movement ?? ""}`,
        partes.join(" · "),
        `movimiento ${partes.join(", ").toLowerCase()}${s.repetition ? `, repetición ${REPETITION_ES[s.repetition.type].toLowerCase()}` : ""}`,
        {
          contour: s.contour_movement,
          direction: s.direction,
          repetition: s.repetition,
          local: s.local_movement,
          plane: s.movement_plane,
        },
        "contour_movement",
      );
    }
    case "rnm": {
      if (subfila === "boca") {
        if (!s.mouth || s.mouth === "NEUTRAL") return undefined;
        return v(`boca:${s.mouth}`, MOUTH_ES[s.mouth], `boca ${MOUTH_ES[s.mouth].toLowerCase()}`, { mouth: s.mouth }, "mouth");
      }
      if (subfila === "cabeza") {
        if (!s.head_movement || s.head_movement === "NONE") return undefined;
        return v(`cab:${s.head_movement}`, HEAD_ES[s.head_movement], `cabeza ${HEAD_ES[s.head_movement].toLowerCase()}`, { head: s.head_movement }, "head_movement");
      }
      if (!s.eyebrows || s.eyebrows === "NEUTRAL") return undefined;
      return v(`cej:${s.eyebrows}`, EYEBROWS_ES[s.eyebrows], `cejas ${EYEBROWS_ES[s.eyebrows].toLowerCase()}`, { eyebrows: s.eyebrows }, "eyebrows");
    }
    case "manoBase": {
      const nd = anotacion?.nondominant;
      if (!nd) return undefined;
      const extra = [
        nd.cm_id !== undefined ? `#${nd.cm_id}` : undefined,
        nd.location_code ? (ubName(nd.location_code) ?? nd.location_code) : undefined,
      ].filter(Boolean);
      return v(
        `nd:${nd.relation}:${nd.cm_id ?? ""}:${nd.location_code ?? ""}`,
        [RELATION_ES[nd.relation], ...extra].join(" · "),
        `mano base: ${RELATION_ES[nd.relation].toLowerCase()}${extra.length ? `, ${extra.join(", ")}` : ""}`,
        { relation: nd.relation, cmId: nd.cm_id, code: nd.location_code },
        "relation",
      );
    }
  }
}

export interface Tramo {
  startMs: number;
  endMs: number;
  key: string;
  label: string;
  aria: string;
  data?: Record<string, unknown>;
  /** segmentos que componen el tramo (uno o varios si se fusionaron) */
  segmentIds: string[];
  /** fronteras internas de los segmentos fusionados (divisorias tenues) */
  divisiones: number[];
  provenance?: AnnotProvenance;
}

/** Tolerancia para considerar dos segmentos contiguos (ms). */
const EPS = 1;

/**
 * Proyecta la secuencia a los tramos de un canal, fusionando valores
 * contiguos idénticos y preservando los huecos.
 */
export function proyectar(
  segmentos: PSHRSegment[],
  canalId: CanalId,
  anotacion?: SignAnnotation,
  subfila?: string,
): Tramo[] {
  const orden = [...segmentos].sort((a, b) => a.start_ms - b.start_ms);
  const out: Tramo[] = [];
  for (const s of orden) {
    const val = valorDe(canalId, s, anotacion, subfila);
    if (!val) continue; // hueco: no se dibuja nada
    const prov =
      val.campo && s.provenance ? s.provenance[val.campo] : undefined;
    const prev = out[out.length - 1];
    const contiguo = prev && Math.abs(prev.endMs - s.start_ms) <= EPS;
    if (prev && contiguo && prev.key === val.key) {
      prev.endMs = s.end_ms;
      prev.segmentIds.push(s.id);
      prev.divisiones.push(s.start_ms);
      // la procedencia solo se conserva si TODOS son auto
      if (prev.provenance === "auto" && prov !== "auto") {
        prev.provenance = undefined;
      }
      continue;
    }
    out.push({
      startMs: s.start_ms,
      endMs: s.end_ms,
      key: val.key,
      label: val.label,
      aria: val.aria,
      data: val.data,
      segmentIds: [s.id],
      divisiones: [],
      provenance: prov,
    });
  }
  return out;
}

/** Texto accesible de un tramo: "detención, 0 a 200 ms, mano en la barbilla". */
export function describirTramo(t: Tramo, canal: CanalDef): string {
  return `${canal.label}, ${Math.round(t.startMs)} a ${Math.round(t.endMs)} milisegundos, ${t.aria}`;
}

/** Puntos donde cambia el valor de un canal (candidatos de imantado). */
export function puntosDeCambio(
  segmentos: PSHRSegment[],
  anotacion?: SignAnnotation,
): number[] {
  const set = new Set<number>();
  for (const c of CANALES) {
    if (c.maestro) continue;
    const filas = c.subfilas?.map((f) => f.id) ?? [undefined];
    for (const f of filas) {
      for (const t of proyectar(segmentos, c.id, anotacion, f)) {
        set.add(Math.round(t.startMs));
        set.add(Math.round(t.endMs));
      }
    }
  }
  return [...set].sort((a, b) => a - b);
}
