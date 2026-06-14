import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarker as HandLandmarkerType,
} from "@mediapipe/tasks-vision";
import type {
  LandmarkExtractor,
  LandmarkResult,
  VideoFrameSource,
} from "./types";

// Web HandLandmarker (MediaPipe Tasks Vision) running in the browser via WASM.
// Ported from signa-play; the Metro `new Function` import hack is dropped —
// Next.js/Turbopack bundles @mediapipe/tasks-vision directly in a client module.
//
// The WASM runtime + model are fetched at runtime. Defaults point at the public
// MediaPipe CDN for zero setup; for an offline / privacy-sensitive deployment,
// self-host these (download from the @mediapipe/tasks-vision npm package + the
// Google model CDN once) and pass `wasmBasePath` / `modelAssetPath`.

export interface ExtractorOptions {
  wasmBasePath?: string;
  modelAssetPath?: string;
  numHands?: number;
}

const DEFAULT_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const DEFAULT_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

class WebLandmarkExtractor implements LandmarkExtractor {
  private landmarker: HandLandmarkerType | null = null;

  constructor(private readonly opts: ExtractorOptions = {}) {}

  async init(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(
      this.opts.wasmBasePath ?? DEFAULT_WASM,
    );
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: {
        modelAssetPath: this.opts.modelAssetPath ?? DEFAULT_MODEL,
        delegate,
      },
      runningMode: "VIDEO" as const,
      numHands: this.opts.numHands ?? 2,
      // Stickier than the 0.5 default: keep the track alive even on noisy
      // frames (quality filtering happens elsewhere).
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
    try {
      this.landmarker = await HandLandmarker.createFromOptions(
        fileset,
        options("GPU"),
      );
    } catch {
      // No WebGL2 / old drivers: fall back to CPU rather than dying.
      this.landmarker = await HandLandmarker.createFromOptions(
        fileset,
        options("CPU"),
      );
    }
  }

  detect(frame: VideoFrameSource, timestampMs: number): LandmarkResult {
    if (!this.landmarker) return { hands: [], timestampMs };
    const video = frame as HTMLVideoElement;
    if (!video.videoWidth) return { hands: [], timestampMs };
    const res = this.landmarker.detectForVideo(video, timestampMs);
    const hands = res.landmarks.map((hand) =>
      hand.map((p) => ({ x: p.x, y: p.y, z: p.z })),
    );
    return { hands, timestampMs };
  }

  close(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}

export function createLandmarkExtractor(
  opts: ExtractorOptions = {},
): LandmarkExtractor {
  return new WebLandmarkExtractor(opts);
}
