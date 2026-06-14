// Shared vision-layer types (capture + hand landmarks).
// Ported from signa-play (apps/app/lib/vision/types.ts).

export interface Landmark {
  x: number; // normalized 0..1 (width)
  y: number; // normalized 0..1 (height)
  z: number; // relative depth
}

/** 21 landmarks per hand (MediaPipe HandLandmarker model). */
export type HandLandmarks = Landmark[];

export interface LandmarkResult {
  hands: HandLandmarks[]; // 0..2 detected hands
  timestampMs: number;
}

/** Opaque frame source: on web this is an HTMLVideoElement. */
export type VideoFrameSource = unknown;

export interface LandmarkExtractor {
  /** Load the model + runtime (WASM on web). */
  init(): Promise<void>;
  /** Process a frame and return the detected landmarks. */
  detect(frame: VideoFrameSource, timestampMs: number): LandmarkResult;
  /** Release resources. */
  close(): void;
}
