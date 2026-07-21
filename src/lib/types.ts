// LSM-PN Type Definitions for the Recording Web App

export type FlexionLevel = "EXTENDED" | "CURVED" | "BENT" | "CLOSED";
export type ThumbOpposition = "OPPOSED" | "PARALLEL" | "CROSSED";
export type FingerSpread = "CLOSED" | "NEUTRAL" | "SPREAD";
export type FingerInteraction = "NONE" | "SPREAD" | "STACKED" | "CROSSED";

export interface CMEntry {
  cm_id: number;
  cruz_aldrete_notation: string;
  example_sign: string;
  alpha_code: string | null;
  index: FlexionLevel;
  middle: FlexionLevel;
  ring: FlexionLevel;
  pinky: FlexionLevel;
  selected_fingers: number[];
  thumb_opposition: ThumbOpposition;
  thumb_flexion: FlexionLevel;
  spread: FingerSpread;
  interaction: FingerInteraction;
  non_selected_above: boolean;
  thumb_contact: boolean;
  distal_override: string | null;
  frequency_tier: 1 | 2 | 3 | 4;
  notes: string;
}

export type FingerGroup =
  | "A: Todos los dedos (1234)"
  | "B: Tres dedos (123)"
  | "C: Dos dedos (12)"
  | "D: Índice (1)"
  | "E: Meñique y especiales";

// Local draft sync state (the corpus of record lives in S3/DynamoDB; localStorage
// is a draft layer). A recording is only "synced" once its DynamoDB item exists.
export type SyncStatus = "local" | "uploading" | "synced" | "failed";

export interface RecordingSession {
  id: string;
  name: string;
  created_at: string;
  signs: RecordedSign[];
  // Set once the remote Session item has been created in DynamoDB.
  remote_session_created?: boolean;
}

export interface RecordedSign {
  cm_id: number;
  recorded_at: string;
  video_blob_url?: string;
  duration_ms: number;
  status: "pending" | "recorded" | "approved" | "rejected";
  notes?: string;
  // ── Remote sync (S3 + DynamoDB) ──
  sync_status?: SyncStatus;
  s3_key?: string;
  remote_id?: string;
  sync_error?: string;
}

// ── Participant metadata (questionnaire at /perfil) ─────────────
export type AgeBand = "18-30" | "31-45" | "46-60" | "60+";
export type AcquisitionAge =
  | "desde_nacimiento"
  | "antes_de_7"
  | "entre_7_y_12"
  | "adolescencia"
  | "adultez";
export type LearnedHow =
  | "familia"
  | "escuela"
  | "amistades"
  | "asociacion"
  | "otro";
export type DeafFamily = "si" | "no" | "no_se";
export type HearingStatus = "sorde" | "hipoacusique" | "oyente";
export type CommunityParticipation = "frecuente" | "ocasional" | "poca";

export interface ParticipantMetadata {
  // Required
  edad: AgeBand;
  edad_adquisicion: AcquisitionAge;
  // Optional
  genero?: string; // texto libre o "prefiero no decir"
  region_vive?: string;
  anios_en_region?: number;
  lugar_crecio?: string;
  como_aprendio?: LearnedHow;
  personas_sordas_familia?: DeafFamily;
  lengua_casa?: string;
  lengua_escuela?: string;
  audicion?: HearingStatus;
  participacion_comunidad?: CommunityParticipation;
  // How consent was given (video, or the text-only skip path).
  consent_mode?: "video" | "text";
  // TODO(comunidad): escolaridad y ocupación deben definirse junto con la
  // comunidad sorda antes de incluirse. No agregar estas categorías en este PR.
}

// Auto-captured session context (stored on the Session item).
export interface SessionMetadata {
  user_agent?: string;
  screen_width?: number;
  screen_height?: number;
  camera_width?: number;
  camera_height?: number;
  camera_frame_rate?: number;
  lugar?: string;
  captured_at?: string;
}

// ── Annotation Types (LSM-PN) ──────────────────────────────────

export type ContourMovement = "STRAIGHT" | "ARC" | "CIRCLE" | "ZIGZAG" | "SEVEN";
export type LocalMovement =
  | "WIGGLE" | "CIRCULAR" | "TWIST" | "SCRATCH" | "NOD"
  | "OSCILLATE" | "RELEASE" | "FLATTEN" | "PROGRESSIVE" | "VIBRATE" | "RUB";
export type MovementPlane = "HORIZONTAL" | "VERTICAL" | "SAGITTAL" | "OBLIQUE";
export type PalmFacing = "UP" | "DOWN" | "FORWARD" | "BACK" | "LEFT" | "RIGHT" | "NEUTRAL";
export type FingerPointing = "UP" | "DOWN" | "FORWARD" | "BACK" | "LEFT" | "RIGHT" | "NEUTRAL";
export type ContactType = "TOUCHING" | "GRASPED" | "NEAR" | "MEDIAL" | "DISTANT" | "BRUSHING";
export type BodyRegion = "HEAD" | "FACE" | "NECK" | "TRUNK" | "ARM" | "FOREARM" | "HAND" | "NEUTRAL_SPACE";
export type Laterality = "IPSILATERAL" | "CONTRALATERAL" | "MIDLINE";
export type SegmentType = "M" | "D" | "T";
export type Phase = "PREPARATION" | "STROKE" | "HOLD" | "RETRACTION";
export type EyebrowPosition = "NEUTRAL" | "RAISED" | "FURROWED";
export type MouthShape = "NEUTRAL" | "OPEN" | "CLOSED" | "ROUNDED" | "STRETCHED";
export type HeadMovement = "NONE" | "NOD" | "SHAKE" | "TILT_LEFT" | "TILT_RIGHT" | "TILT_BACK" | "TILT_DOWN";

export interface PSHRSegment {
  id: string;
  type: SegmentType;
  phase: Phase;
  start_ms: number;
  end_ms: number;
  // Segment-level annotation
  cm_id?: number;
  location_code?: string; // Cruz Aldrete UB code (e.g., "Fr", "Pe", "Car")
  location?: string;
  body_region?: BodyRegion;
  contact?: ContactType;
  laterality?: Laterality;
  contour_movement?: ContourMovement;
  local_movement?: LocalMovement;
  movement_plane?: MovementPlane;
  palm_facing?: PalmFacing;
  finger_pointing?: FingerPointing;
  // Non-manual
  eyebrows?: EyebrowPosition;
  mouth?: MouthShape;
  head_movement?: HeadMovement;
}

export interface SignAnnotation {
  id: string;
  cm_id: number;
  gloss: string;
  video_url?: string;
  created_at: string;
  updated_at: string;
  // Dominant hand
  dominant_hand: "LEFT" | "RIGHT";
  // PSHR segments
  segments: PSHRSegment[];
  // Global properties
  two_handed: boolean;
  symmetrical: boolean;
  notes: string;
  status: "draft" | "complete" | "reviewed";
}
