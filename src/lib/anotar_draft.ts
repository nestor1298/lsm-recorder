// Borrador del flujo guiado de anotación (/anotar).
// Se persiste en localStorage para que recargar la página no pierda el avance;
// al guardar se convierte en una SignAnnotation estándar (segmento M/STROKE).

import type {
  ContactType,
  ContourMovement,
  EyebrowPosition,
  Laterality,
  LocalMovement,
  MouthShape,
  MovementDirection,
  MovementPlane,
  NonDominantSpec,
  PalmFacing,
  FingerPointing,
  ProvenanceMap,
  Repetition,
  SignAnnotation,
  PSHRSegment,
} from "./types";
import type { PhonSuggestion } from "./vision/phon/phon_features";
import { UB_LOCATIONS } from "./ub_inventory";
import { saveAnnotation } from "./store";

export type PasoId =
  | "video"
  | "cm"
  | "ubicacion"
  | "orientacion"
  | "movimiento"
  | "resumen";

/**
 * Pasos visibles del flujo guiado. La CM no se pregunta: la detecta el
 * análisis de visión (el usuario promedio no es lingüista); el paso
 * "cm" existe solo como editor de corrección accesible desde Resumen.
 */
export const PASOS: PasoId[] = [
  "video",
  "ubicacion",
  "orientacion",
  "movimiento",
  "resumen",
];

/** Extremo D (inicio o final) para señas cuyo lugar/forma cambia */
export interface ExtremoDMD {
  location_code?: string;
  cm_id?: number;
}

export interface GuidedDraft {
  gloss: string;
  video_url?: string;
  /** El video es un objectURL local (no sobrevive recargas) */
  video_is_local?: boolean;
  cm_id?: number;
  location_code?: string;
  contact?: ContactType;
  laterality?: Laterality;
  contour?: ContourMovement;
  local?: LocalMovement;
  plane?: MovementPlane;
  direction?: MovementDirection;
  repetition?: Repetition;
  palm_facing?: PalmFacing;
  finger_pointing?: FingerPointing;
  eyebrows?: EyebrowPosition;
  mouth?: MouthShape;
  /** Tipología bimanual (undefined = una sola mano) */
  nondominant?: NonDominantSpec;
  /** Segmentación ligera D-M-D: extremos cuando difieren del núcleo */
  inicio?: ExtremoDMD;
  fin?: ExtremoDMD;
  /** Procedencia por campo (auto / humano / auto_confirmado) */
  provenance?: ProvenanceMap;
  dominant_hand: "LEFT" | "RIGHT";
  two_handed: boolean;
  notes: string;
  /** Resultado del análisis automático del video (pre-anotación) */
  sugerencia?: PhonSuggestion;
}

export const EMPTY_DRAFT: GuidedDraft = {
  gloss: "",
  dominant_hand: "RIGHT",
  two_handed: false,
  notes: "",
};

const DRAFT_KEY = "signalab_anotar_draft";

export function loadDraft(): GuidedDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return { ...EMPTY_DRAFT };
    const draft = { ...EMPTY_DRAFT, ...(JSON.parse(raw) as GuidedDraft) };
    // Un objectURL local no sobrevive la recarga: se descarta con aviso implícito.
    if (draft.video_is_local) {
      delete draft.video_url;
      delete draft.video_is_local;
    }
    return draft;
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function persistDraft(draft: GuidedDraft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

function segLoc(code: string | undefined) {
  const loc = code ? UB_LOCATIONS.find((l) => l.code === code) : undefined;
  return {
    location_code: code,
    location: loc?.name,
    body_region: loc?.region,
  };
}

/**
 * Construcción PURA del SignAnnotation desde el borrador (sin guardar):
 * la usa también el recuadro 3D para previsualizar en vivo.
 *
 * Sin inicio/fin: un solo segmento M/STROKE. Con inicio y/o fin:
 * esquema D-M-D (o DM/MD) — D(PREPARATION) inicial → M(STROKE) →
 * D(HOLD) final, con tiempos proporcionales a la duración
 * (o 0–200–800–1000 ms sin video).
 */
export function buildAnnotationFromDraft(
  draft: GuidedDraft,
  durationMs: number,
  id = "draft-preview",
): SignAnnotation {
  const now = new Date().toISOString();
  const total = Math.max(1000, Math.round(durationMs));
  const t1 = Math.round(total * 0.2);
  const t2 = Math.round(total * 0.8);

  const core: PSHRSegment = {
    id: `${id}-m`,
    type: "M",
    phase: "STROKE",
    start_ms: draft.inicio ? t1 : 0,
    end_ms: draft.fin ? t2 : total,
    cm_id: draft.cm_id,
    ...segLoc(draft.location_code),
    contact: draft.contact,
    laterality: draft.laterality,
    contour_movement: draft.contour,
    local_movement: draft.local,
    movement_plane: draft.plane,
    direction: draft.direction,
    repetition: draft.repetition,
    palm_facing: draft.palm_facing,
    finger_pointing: draft.finger_pointing,
    end_cm_id: draft.fin?.cm_id,
    eyebrows: draft.eyebrows,
    mouth: draft.mouth,
    provenance: draft.provenance,
  };

  const segments: PSHRSegment[] = [];
  if (draft.inicio) {
    segments.push({
      id: `${id}-d1`,
      type: "D",
      phase: "PREPARATION",
      start_ms: 0,
      end_ms: t1,
      cm_id: draft.inicio.cm_id ?? draft.cm_id,
      ...segLoc(draft.inicio.location_code ?? draft.location_code),
      contact: draft.contact,
      palm_facing: draft.palm_facing,
      finger_pointing: draft.finger_pointing,
    });
  }
  segments.push(core);
  if (draft.fin) {
    segments.push({
      id: `${id}-d2`,
      type: "D",
      phase: "HOLD",
      start_ms: t2,
      end_ms: total,
      cm_id: draft.fin.cm_id ?? draft.cm_id,
      ...segLoc(draft.fin.location_code ?? draft.location_code),
      contact: draft.contact,
      palm_facing: draft.palm_facing,
      finger_pointing: draft.finger_pointing,
    });
  }

  return {
    id,
    cm_id: draft.cm_id ?? 0,
    gloss: draft.gloss.trim() || "sin nombre",
    video_url: draft.video_is_local ? undefined : draft.video_url,
    created_at: now,
    updated_at: now,
    dominant_hand: draft.dominant_hand,
    two_handed: Boolean(draft.nondominant),
    symmetrical: draft.nondominant?.relation === "SIMETRICA",
    nondominant: draft.nondominant,
    notes: draft.notes,
    status: "complete",
    segments,
  };
}

/** Construye Y guarda la anotación (id real). */
export function draftToAnnotation(
  draft: GuidedDraft,
  durationMs: number,
): SignAnnotation {
  const annotation = buildAnnotationFromDraft(
    draft,
    durationMs,
    crypto.randomUUID(),
  );
  saveAnnotation(annotation);
  return annotation;
}

/** Esquema estructural (D, M, DM, MD, DMD) del borrador */
export function esquemaDMD(draft: GuidedDraft): string {
  return `${draft.inicio ? "D" : ""}M${draft.fin ? "D" : ""}`;
}

/** Marca procedencia de un campo cuando la persona lo edita */
export function marcarHumano(
  draft: GuidedDraft,
  campos: string[],
): ProvenanceMap {
  const p: ProvenanceMap = { ...draft.provenance };
  for (const c of campos) p[c] = "humano";
  return p;
}
