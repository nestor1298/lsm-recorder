/**
 * analyze_video.ts — extracción fonológica automática de un video de seña.
 *
 * Muestrea el video (seek frame a frame), corre HandLandmarker +
 * PoseLandmarker + FaceLandmarker (MediaPipe tasks-vision, WASM en el
 * navegador) y agrega los rasgos en una PhonSuggestion (ver
 * phon_features.ts). Client-side only.
 */

import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  FaceLandmarker,
} from "@mediapipe/tasks-vision";
import {
  aggregate,
  type PhonFrame,
  type PhonSuggestion,
  type Pt,
} from "./phon_features";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export interface AnalyzeProgress {
  phase: "modelos" | "frames";
  done: number;
  total: number;
}

const TARGET_FPS = 12;
const MAX_FRAMES = 72; // ~6 s a 12 fps; videos más largos bajan el fps

async function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  if (Math.abs(video.currentTime - t) < 1 / 120) return;
  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("seek failed"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = t;
  });
}

/**
 * Analiza un video (por URL) y regresa la sugerencia fonológica.
 * Crea su propio <video> offscreen con crossOrigin=anonymous (los
 * presigned GET de S3 ya permiten el origen vía CORS del bucket).
 */
export async function analyzeSignVideo(
  videoUrl: string,
  onProgress?: (p: AnalyzeProgress) => void,
): Promise<PhonSuggestion> {
  onProgress?.({ phase: "modelos", done: 0, total: 3 });

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;
  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    video.addEventListener(
      "error",
      () => reject(new Error("No se pudo cargar el video para analizar.")),
      { once: true },
    );
  });
  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    throw new Error("El video no tiene duración válida.");
  }

  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const base = (modelAssetPath: string) => ({
    baseOptions: { modelAssetPath, delegate: "GPU" as const },
    runningMode: "VIDEO" as const,
  });
  // GPU con caída a CPU (mismo patrón que el extractor existente).
  const make = async <T>(
    create: (opts: "GPU" | "CPU") => Promise<T>,
  ): Promise<T> => {
    try {
      return await create("GPU");
    } catch {
      return await create("CPU");
    }
  };

  const hand = await make((d) =>
    HandLandmarker.createFromOptions(fileset, {
      ...base(HAND_MODEL),
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: d },
      numHands: 2,
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    }),
  );
  onProgress?.({ phase: "modelos", done: 1, total: 3 });
  const pose = await make((d) =>
    PoseLandmarker.createFromOptions(fileset, {
      ...base(POSE_MODEL),
      baseOptions: { modelAssetPath: POSE_MODEL, delegate: d },
      numPoses: 1,
    }),
  );
  onProgress?.({ phase: "modelos", done: 2, total: 3 });
  const face = await make((d) =>
    FaceLandmarker.createFromOptions(fileset, {
      ...base(FACE_MODEL),
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: d },
      numFaces: 1,
      outputFaceBlendshapes: true,
    }),
  );
  onProgress?.({ phase: "modelos", done: 3, total: 3 });

  try {
    const frameCount = Math.min(
      MAX_FRAMES,
      Math.max(8, Math.round(duration * TARGET_FPS)),
    );
    const step = duration / frameCount;

    // Trayectoria por mano detectada (por índice de mano de MediaPipe no es
    // estable; usamos el lado: media de x de la mano vs centro).
    const rawFrames: {
      timestampMs: number;
      hands: Pt[][];
      pose?: Pt[];
      face?: Record<string, number>;
    }[] = [];

    for (let i = 0; i < frameCount; i++) {
      const t = Math.min(duration - 0.01, i * step);
      await seekTo(video, t);
      const ts = Math.round(t * 1000) + 1; // monotónico para detectForVideo
      const h = hand.detectForVideo(video, ts);
      const p = pose.detectForVideo(video, ts);
      const f = face.detectForVideo(video, ts);
      rawFrames.push({
        timestampMs: ts,
        hands: h.landmarks.map((hl) =>
          hl.map((q) => ({ x: q.x, y: q.y, z: q.z })),
        ),
        pose: p.landmarks[0]?.map((q) => ({ x: q.x, y: q.y, z: q.z })),
        face: f.faceBlendshapes?.[0]
          ? Object.fromEntries(
              f.faceBlendshapes[0].categories.map((c) => [
                c.categoryName,
                c.score,
              ]),
            )
          : undefined,
      });
      onProgress?.({ phase: "frames", done: i + 1, total: frameCount });
    }

    // Mano dominante = la del lado con mayor camino recorrido.
    const path = { left: 0, right: 0 };
    const last: Record<"left" | "right", { x: number; y: number } | null> = {
      left: null,
      right: null,
    };
    for (const fr of rawFrames) {
      for (const hd of fr.hands) {
        const cx = hd.reduce((s, q) => s + q.x, 0) / hd.length;
        const cy = hd.reduce((s, q) => s + q.y, 0) / hd.length;
        const side: "left" | "right" = cx < 0.5 ? "left" : "right";
        if (last[side]) {
          path[side] += Math.hypot(cx - last[side]!.x, cy - last[side]!.y);
        }
        last[side] = { x: cx, y: cy };
      }
    }
    const dominantSide: "left" | "right" =
      path.right >= path.left ? "right" : "left";

    const frames: PhonFrame[] = rawFrames.map((fr) => {
      // mano dominante de este frame: la del lado dominante; si solo hay
      // una mano, esa. La otra (si existe) va aparte para la relación
      // bimanual.
      let chosen: Pt[] | undefined;
      let other: Pt[] | undefined;
      if (fr.hands.length === 1) chosen = fr.hands[0];
      else if (fr.hands.length > 1) {
        chosen = fr.hands.reduce((best, hd) => {
          const cx = hd.reduce((s, q) => s + q.x, 0) / hd.length;
          const bx = best.reduce((s, q) => s + q.x, 0) / best.length;
          const want = dominantSide === "right";
          return (want ? cx > bx : cx < bx) ? hd : best;
        });
        other = fr.hands.find((hd) => hd !== chosen);
      }
      return {
        timestampMs: fr.timestampMs,
        hand: chosen,
        otherHand: other,
        twoHands: fr.hands.length >= 2,
        pose: fr.pose,
        face: fr.face,
      };
    });

    return aggregate(frames, dominantSide);
  } finally {
    hand.close();
    pose.close();
    face.close();
    video.removeAttribute("src");
    video.load();
  }
}

export type { PhonSuggestion } from "./phon_features";
