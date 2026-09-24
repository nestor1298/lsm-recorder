// Single-table key helpers and item shapes for `signalab-corpus`.
// Pure module (no server-only SDK) so types can be shared if needed.

export type ConsentStatus = "none" | "granted" | "withdrawn";
export type ConsentMode = "video" | "text";
export type AccessTier = "abierto" | "investigacion" | "restringido";
export type RecordingStatus = "pending" | "recorded" | "approved" | "rejected";

export const DEFAULT_ACCESS_TIER: AccessTier = "restringido";

// ── Key builders ────────────────────────────────────────────────────────────
export const partPk = (userId: string): string => `PART#${userId}`;
export const PROFILE_SK = "PROFILE" as const;
export const sessPk = (sessionId: string): string => `SESS#${sessionId}`;
export const sessSk = (sessionId: string): string => `SESS#${sessionId}`;
// Ítem que se graba: "12" (número de CM, LSM Corpus) o "POR_FAVOR" (glosa,
// corpus para SignaPlay). Las grabaciones anteriores usaban el número de
// CM tal cual, así que sus llaves REC#12 siguen siendo válidas.
export type CorpusId = "lsm" | "signaplay";
export const ITEM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const recSk = (itemId: string): string => `REC#${itemId}`;
export const recGsi1Sk = (recordedAt: string): string => `REC#${recordedAt}`;

// A recording is addressed by {sessionId}__{itemId} in the `/api/recordings/{id}` route.
export const recordingId = (sessionId: string, itemId: string): string =>
  `${sessionId}__${itemId}`;

export function parseRecordingId(
  id: string,
): { sessionId: string; itemId: string } | null {
  const sep = id.lastIndexOf("__");
  if (sep <= 0) return null;
  const sessionId = id.slice(0, sep);
  const itemId = id.slice(sep + 2);
  if (!sessionId || !ITEM_ID_RE.test(itemId)) return null;
  return { sessionId, itemId };
}

/** Ítem de una grabación guardada: las antiguas solo traen cm_id. */
export function itemIdDeGrabacion(r: { item_id?: string; cm_id?: number }): string {
  return r.item_id ?? String(r.cm_id ?? "");
}

export const annotPk = (annotationId: string): string => `ANNOT#${annotationId}`;
export const annotSk = (annotationId: string): string => `ANNOT#${annotationId}`;
export const annotGsi1Sk = (updatedAt: string): string => `ANNOT#${updatedAt}`;

// ── Item shapes ─────────────────────────────────────────────────────────────
export interface ParticipantItem {
  pk: string;
  sk: typeof PROFILE_SK;
  entity: "participant";
  user_id: string;
  email?: string;
  created_at: string;
  display_name?: string;
  // ParticipantMetadata (typed in src/lib/types.ts), stored as a map.
  metadata?: Record<string, unknown>;
  consent_status: ConsentStatus;
  consent_video_key?: string;
  consent_mode?: ConsentMode;
  default_access_tier: AccessTier;
}

export interface SessionItem {
  pk: string;
  sk: string;
  entity: "session";
  session_id: string;
  user_id: string;
  name: string;
  /** "phonological" = LSM Corpus (CM); "lexical" = corpus para SignaPlay */
  task_type: "phonological" | "lexical";
  corpus?: CorpusId;
  created_at: string;
  device_info?: Record<string, unknown>;
  session_metadata?: Record<string, unknown>;
}

export interface RecordingItem {
  pk: string;
  sk: string;
  entity: "recording";
  gsi1pk: string;
  gsi1sk: string;
  participant_id: string;
  session_id: string;
  /** ver recSk; las grabaciones anteriores a los dos corpus no lo traen */
  item_id?: string;
  corpus?: CorpusId;
  /** LSM Corpus: la configuración de mano grabada */
  cm_id?: number;
  /** SignaPlay: la glosa grabada */
  gloss?: string;
  s3_key: string;
  duration_ms: number;
  recorded_at: string;
  status: RecordingStatus;
  access_tier: AccessTier;
  withdrawn: boolean;
  notes?: string;
}

/**
 * Anotación fonológica LSM-PN.
 *
 * El dueño es quien anota (`annotator_id`), no necesariamente quien grabó:
 * una persona puede anotar el video de otra. Se lee por id (pk) y se
 * lista por gsi1 (PART#{annotator} + ANNOT#{updated_at}), igual que las
 * grabaciones.
 *
 * `payload` guarda el LSM-PN completo (segmentos y matrices). El borrado
 * es suave (`deleted`) porque la policy del runtime no incluye
 * DeleteItem, y porque en un corpus conviene poder auditar.
 */
export interface AnnotationItem {
  pk: string;
  sk: string;
  entity: "annotation";
  gsi1pk: string;
  gsi1sk: string;
  annotation_id: string;
  annotator_id: string;
  gloss: string;
  cm_id: number;
  status: string;
  /** Grabación del corpus que se anotó, si la anotación viene de una */
  recording_id?: string;
  schema_version: string;
  segment_count: number;
  created_at: string;
  updated_at: string;
  /** LSM-PN completo: segments, nondominant, notes, dominant_hand… */
  payload: Record<string, unknown>;
  deleted?: boolean;
}
