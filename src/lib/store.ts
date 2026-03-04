import type { RecordingSession, RecordedSign, SignAnnotation } from "./types";

const SESSIONS_KEY = "lsm-recorder-sessions";
const ANNOTATIONS_KEY = "lsm-recorder-annotations";

export function getSessions(): RecordingSession[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(SESSIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveSession(session: RecordingSession): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function getSession(id: string): RecordingSession | null {
  return getSessions().find((s) => s.id === id) ?? null;
}

export function deleteSession(id: string): void {
  const sessions = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function createSession(name: string, cmIds: number[]): RecordingSession {
  const session: RecordingSession = {
    id: crypto.randomUUID(),
    name,
    created_at: new Date().toISOString(),
    signs: cmIds.map((cm_id) => ({
      cm_id,
      recorded_at: "",
      duration_ms: 0,
      status: "pending" as const,
    })),
  };
  saveSession(session);
  return session;
}

export function updateSignRecording(
  sessionId: string,
  cmId: number,
  update: Partial<RecordedSign>
): void {
  const session = getSession(sessionId);
  if (!session) return;
  const sign = session.signs.find((s) => s.cm_id === cmId);
  if (sign) {
    Object.assign(sign, update);
    saveSession(session);
  }
}

// ── Annotations ─────────────────────────────────────────────────

export function getAnnotations(): SignAnnotation[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(ANNOTATIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveAnnotation(annotation: SignAnnotation): void {
  const annotations = getAnnotations();
  const idx = annotations.findIndex((a) => a.id === annotation.id);
  if (idx >= 0) {
    annotations[idx] = annotation;
  } else {
    annotations.push(annotation);
  }
  localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(annotations));
}

export function getAnnotation(id: string): SignAnnotation | null {
  return getAnnotations().find((a) => a.id === id) ?? null;
}

export function deleteAnnotation(id: string): void {
  const annotations = getAnnotations().filter((a) => a.id !== id);
  localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(annotations));
}

export function createAnnotation(cmId: number, gloss: string): SignAnnotation {
  const annotation: SignAnnotation = {
    id: crypto.randomUUID(),
    cm_id: cmId,
    gloss,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    dominant_hand: "RIGHT",
    segments: [],
    two_handed: false,
    symmetrical: false,
    notes: "",
    status: "draft",
  };
  saveAnnotation(annotation);
  return annotation;
}

export function exportAnnotationAsLSMPN(annotation: SignAnnotation): object {
  return {
    schema_version: "1.0",
    gloss: annotation.gloss,
    cm_id: annotation.cm_id,
    dominant_hand: annotation.dominant_hand,
    two_handed: annotation.two_handed,
    symmetrical: annotation.symmetrical,
    segments: annotation.segments.map((seg) => ({
      type: seg.type,
      phase: seg.phase,
      timing: { start_ms: seg.start_ms, end_ms: seg.end_ms },
      ...(seg.cm_id && { cm: { cm_id: seg.cm_id } }),
      ...(seg.body_region && {
        location: {
          body_region: seg.body_region,
          contact: seg.contact,
          laterality: seg.laterality,
        },
      }),
      ...(seg.contour_movement && {
        movement: {
          contour: seg.contour_movement,
          local: seg.local_movement,
          plane: seg.movement_plane,
        },
      }),
      ...(seg.palm_facing && {
        orientation: {
          palm_facing: seg.palm_facing,
          finger_pointing: seg.finger_pointing,
        },
      }),
      ...((seg.eyebrows || seg.mouth || seg.head_movement) && {
        non_manual: {
          eyebrows: seg.eyebrows,
          mouth: seg.mouth,
          head_movement: seg.head_movement,
        },
      }),
    })),
    notes: annotation.notes,
    status: annotation.status,
  };
}
