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
  | "A: All Fingers (1234)"
  | "B: Three Fingers (123)"
  | "C: Two Fingers (12)"
  | "D: Index Finger (1)"
  | "E: Pinky & Special";

export interface RecordingSession {
  id: string;
  name: string;
  created_at: string;
  signs: RecordedSign[];
}

export interface RecordedSign {
  cm_id: number;
  recorded_at: string;
  video_blob_url?: string;
  duration_ms: number;
  status: "pending" | "recorded" | "approved" | "rejected";
  notes?: string;
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
