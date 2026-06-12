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
export const recSk = (cmId: number): string => `REC#${cmId}`;
export const recGsi1Sk = (recordedAt: string): string => `REC#${recordedAt}`;

// A recording is addressed by {sessionId}__{cmId} in the `/api/recordings/{id}` route.
export const recordingId = (sessionId: string, cmId: number): string =>
  `${sessionId}__${cmId}`;

export function parseRecordingId(
  id: string,
): { sessionId: string; cmId: number } | null {
  const sep = id.lastIndexOf("__");
  if (sep <= 0) return null;
  const sessionId = id.slice(0, sep);
  const cmId = Number(id.slice(sep + 2));
  if (!sessionId || !Number.isInteger(cmId)) return null;
  return { sessionId, cmId };
}

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
  task_type: "phonological";
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
  cm_id: number;
  s3_key: string;
  duration_ms: number;
  recorded_at: string;
  status: RecordingStatus;
  access_tier: AccessTier;
  withdrawn: boolean;
  notes?: string;
}
