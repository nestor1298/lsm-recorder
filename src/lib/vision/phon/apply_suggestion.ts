/**
 * apply_suggestion.ts — vuelca una PhonSuggestion sobre una
 * SignAnnotation: crea los segmentos (M o D-M-D según el corte
 * detectado) con todos los campos propuestos y procedencia "auto".
 * La persona anotadora corrige después por canal; visión propone,
 * humano dispone.
 */

import type {
  SignAnnotation,
  PSHRSegment,
  ProvenanceMap,
} from "@/lib/types";
import { UB_LOCATIONS } from "@/lib/ub_inventory";
import type { PhonSuggestion } from "./phon_features";

function locFields(code: string | undefined) {
  const loc = code ? UB_LOCATIONS.find((l) => l.code === code) : undefined;
  return { location_code: code, location: loc?.name, body_region: loc?.region };
}

/**
 * Regresa una copia de `annotation` con los segmentos generados desde la
 * sugerencia. Reemplaza los segmentos existentes (llamar solo sobre una
 * anotación vacía o con confirmación de la persona).
 */
export function applySuggestion(
  annotation: SignAnnotation,
  s: PhonSuggestion,
  durationMs: number,
): SignAnnotation {
  const total = Math.max(1000, Math.round(durationMs));
  const t1 = Math.round(total * 0.2);
  const t2 = Math.round(total * 0.8);
  const cmId = s.cmCandidates[0]?.cm_id;

  const prov = (fields: string[]): ProvenanceMap =>
    Object.fromEntries(fields.map((f) => [f, "auto" as const]));

  const core: PSHRSegment = {
    id: crypto.randomUUID(),
    type: "M",
    phase: "STROKE",
    start_ms: s.inicio ? t1 : 0,
    end_ms: s.fin ? t2 : total,
    cm_id: cmId,
    ...locFields(s.location_code),
    contact: s.contact,
    contour_movement: s.contour,
    movement_plane: s.plane,
    direction: s.direction,
    repetition: s.repetition,
    palm_facing: s.palm_facing,
    finger_pointing: s.finger_pointing,
    eyebrows: s.eyebrows,
    mouth: s.mouth,
    provenance: prov(
      [
        cmId !== undefined && "cm_id",
        s.location_code && "location_code",
        s.contact && "contact",
        s.contour && "contour_movement",
        s.plane && "movement_plane",
        s.direction && "direction",
        s.repetition && "repetition",
        s.palm_facing && "palm_facing",
        s.finger_pointing && "finger_pointing",
        s.eyebrows && "eyebrows",
        s.mouth && "mouth",
      ].filter((x): x is string => Boolean(x)),
    ),
  };

  const segments: PSHRSegment[] = [];
  if (s.inicio) {
    segments.push({
      id: crypto.randomUUID(),
      type: "D",
      phase: "PREPARATION",
      start_ms: 0,
      end_ms: t1,
      cm_id: cmId,
      ...locFields(s.inicio.location_code ?? s.location_code),
      palm_facing: s.palm_facing,
      finger_pointing: s.finger_pointing,
      provenance: prov(["location_code"]),
    });
  }
  segments.push(core);
  if (s.fin) {
    segments.push({
      id: crypto.randomUUID(),
      type: "D",
      phase: "HOLD",
      start_ms: t2,
      end_ms: total,
      cm_id: cmId,
      ...locFields(s.fin.location_code ?? s.location_code),
      palm_facing: s.palm_facing,
      finger_pointing: s.finger_pointing,
      provenance: prov(["location_code"]),
    });
  }

  return {
    ...annotation,
    cm_id: cmId ?? annotation.cm_id,
    nondominant: s.nondominant_relation
      ? { relation: s.nondominant_relation, provenance: { relation: "auto" } }
      : annotation.nondominant,
    two_handed: Boolean(s.nondominant_relation) || annotation.two_handed,
    symmetrical: s.nondominant_relation === "SIMETRICA",
    segments,
    updated_at: new Date().toISOString(),
  };
}
