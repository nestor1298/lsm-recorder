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
