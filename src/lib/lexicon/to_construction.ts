/**
 * to_construction.ts — de una entrada del léxico a la matriz que Lexsi
 * reproduce en /learn (SignConstruction: D → M → D …).
 *
 * El léxico guarda la anotación LSM-PN 1.1 tal como la propuso la
 * visión; casi todas las señas son un solo M con su lugar, forma y
 * orientación. Un movimiento necesita una detención antes y otra
 * después, así que se completan con los rasgos del propio M (lugar del
 * núcleo; forma final si hay `end_cm_id`). Las repeticiones se repiten
 * como ida y vuelta, hasta tres veces.
 */

import { CM_INVENTORY } from "@/lib/data";
import { UB_LOCATIONS, type UBLocation } from "@/lib/ub_inventory";
import { CODIGO_ESPACIO_NEUTRO } from "@/lib/ub_anatomia";
import type { PSHRSegment, SignAnnotation } from "@/lib/types";
import type {
  HoldSegment,
  MovementSegment,
  RNMState,
  Segment,
  SignConstruction,
} from "@/lib/sign_types";

/** Espacio neutro frente al pecho, como en /learn */
export const UB_NEUTRO: UBLocation = {
  code: CODIGO_ESPACIO_NEUTRO,
  region: "NEUTRAL_SPACE",
  name: "Espacio neutro",
  x: 100,
  y: 190,
};

export const ubPorCodigo = (code: string | undefined): UBLocation | null =>
  !code ? null : code === CODIGO_ESPACIO_NEUTRO ? UB_NEUTRO : (UB_LOCATIONS.find((l) => l.code === code) ?? null);

const cmPorId = (id: number | undefined) => (id === undefined ? null : (CM_INVENTORY.find((c) => c.cm_id === id) ?? null));

/** Repeticiones que se reproducen como ida y vuelta (más cansa a la vista) */
const MAX_REPETICIONES = 3;

const RNM_NEUTRA: RNMState = { eyebrows: "NEUTRAL", mouth: "NEUTRAL", head: "NONE" };

export function lexiconToConstruction(a: SignAnnotation, rnm: RNMState = RNM_NEUTRA): SignConstruction {
  const handMode: HoldSegment["handMode"] =
    a.two_handed && (a.symmetrical || a.nondominant?.relation === "SIMETRICA") ? "both_symmetric" : "dominant";
  let n = 0;
  const id = (t: string) => `${a.id}-${t}${++n}`;

  const hold = (s: PSHRSegment, cmId = s.cm_id ?? a.cm_id): HoldSegment => ({
    type: "D",
    id: id("d"),
    cm: cmPorId(cmId),
    ub: ubPorCodigo(s.location_code) ?? UB_NEUTRO,
    orientation: { palm: s.palm_facing ?? "FORWARD", fingers: s.finger_pointing ?? "UP" },
    handMode,
  });
  const move = (s: PSHRSegment): MovementSegment => ({
    type: "M",
    id: id("m"),
    contour: s.contour_movement ?? "STRAIGHT",
    local: s.local_movement ?? null,
    plane: s.movement_plane ?? "VERTICAL",
  });

  const segs = [...a.segments]
    .filter((s) => s.type === "D" || s.type === "M")
    .sort((x, y) => x.start_ms - y.start_ms);
  const out: Segment[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.type === "D") {
      if (out.at(-1)?.type !== "D") out.push(hold(s));
      continue;
    }
    if (out.at(-1)?.type !== "D") out.push(hold(s));
    const start = out.at(-1) as HoldSegment;
    out.push(move(s));
    // la detención final es el D que sigue, o el propio M con su forma final
    const next = segs[i + 1];
    const end = next?.type === "D" ? hold(next) : hold(s, s.end_cm_id ?? s.cm_id ?? a.cm_id);
    if (next?.type === "D") i++;
    out.push(end);
    // repetición: vuelve al inicio y otra vez al final
    const veces = Math.min(MAX_REPETICIONES, s.repetition?.count ?? 1);
    for (let r = 1; r < veces; r++) {
      out.push(move(s));
      out.push({ ...(r % 2 === 1 ? start : end), id: id("d") });
    }
  }
  if (out.length === 0) {
    out.push({
      type: "D",
      id: id("d"),
      cm: cmPorId(a.cm_id),
      ub: UB_NEUTRO,
      orientation: { palm: "FORWARD", fingers: "UP" },
      handMode,
    });
  }
  return { name: a.gloss, segments: out, rnm };
}
