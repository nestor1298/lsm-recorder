// Borrador del flujo guiado de anotación (/anotar).
// Se persiste en localStorage para que recargar la página no pierda el avance;
// al guardar se convierte en una SignAnnotation estándar (segmento M/STROKE).

import type {
  ContactType,
  ContourMovement,
  Laterality,
  LocalMovement,
  MovementPlane,
  SignAnnotation,
} from "./types";
import { UB_LOCATIONS } from "./ub_inventory";
import { saveAnnotation } from "./store";

export type PasoId = "video" | "cm" | "ubicacion" | "movimiento" | "resumen";

export const PASOS: PasoId[] = [
  "video",
  "cm",
  "ubicacion",
  "movimiento",
  "resumen",
];

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
  dominant_hand: "LEFT" | "RIGHT";
  two_handed: boolean;
  notes: string;
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

/**
 * Convierte el borrador guiado en una SignAnnotation estándar con un solo
 * segmento M en fase STROKE que concentra ubicación y movimiento.
 * La vista experta (/annotate) puede refinarla en múltiples segmentos.
 */
export function draftToAnnotation(
  draft: GuidedDraft,
  durationMs: number,
): SignAnnotation {
  const now = new Date().toISOString();
  const loc = draft.location_code
    ? UB_LOCATIONS.find((l) => l.code === draft.location_code)
    : undefined;
  const annotation: SignAnnotation = {
    id: crypto.randomUUID(),
    cm_id: draft.cm_id ?? 0,
    gloss: draft.gloss.trim() || "sin nombre",
    video_url: draft.video_is_local ? undefined : draft.video_url,
    created_at: now,
    updated_at: now,
    dominant_hand: draft.dominant_hand,
    two_handed: draft.two_handed,
    symmetrical: false,
    notes: draft.notes,
    status: "complete",
    segments: [
      {
        id: crypto.randomUUID(),
        type: "M",
        phase: "STROKE",
        start_ms: 0,
        end_ms: Math.max(1000, Math.round(durationMs)),
        cm_id: draft.cm_id,
        location_code: draft.location_code,
        location: loc?.name,
        body_region: loc?.region,
        contact: draft.contact,
        laterality: draft.laterality,
        contour_movement: draft.contour,
        local_movement: draft.local,
        movement_plane: draft.plane,
      },
    ],
  };
  saveAnnotation(annotation);
  return annotation;
}
