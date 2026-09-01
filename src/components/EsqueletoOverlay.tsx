"use client";

/**
 * EsqueletoOverlay — dibuja SIEMPRE el esqueleto completo detectado en
 * el video: pose (33 puntos) + manos (21 puntos c/u), con MediaPipe en
 * el navegador. Es la referencia visual de la persona señante; la
 * anotación sigue siendo la fuente de verdad del modelo 3D.
 */

import { useEffect, useRef } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// Conexiones de pose (torso + brazos + piernas + cara mínima)
const POSE_CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [9, 10],
  [2, 5],
];

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

interface EsqueletoOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mirrored?: boolean;
}

export default function EsqueletoOverlay({
  videoRef,
  mirrored = false,
}: EsqueletoOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let hand: HandLandmarker | null = null;
    let pose: PoseLandmarker | null = null;
    let raf = 0;
    let disposed = false;
    let lastTs = -1;
    // detectForVideo exige timestamps estrictamente crecientes por
    // instancia; usamos un contador propio (+33 ms por frame procesado).
    let monoTs = 0;

    const draw = (
      ctx: CanvasRenderingContext2D,
      pts: NormalizedLandmark[],
      connections: [number, number][],
      color: string,
      jointR: number,
    ) => {
      const { width: w, height: h } = ctx.canvas;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(2, w / 320);
      for (const [a, b] of connections) {
        const p = pts[a];
        const q = pts[b];
        if (!p || !q) continue;
        ctx.beginPath();
        ctx.moveTo(p.x * w, p.y * h);
        ctx.lineTo(q.x * w, q.y * h);
        ctx.stroke();
      }
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, jointR, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !hand || !pose || !video.videoWidth) return;
      const ts = video.currentTime;
      if (ts === lastTs) return;
      lastTs = ts;
      monoTs += 33;
      const tsMs = monoTs;

      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        const pr = pose.detectForVideo(video, tsMs);
        const hr = hand.detectForVideo(video, tsMs);
        // Tokens de marca aproximados en canvas (accent y green)
        for (const lm of pr.landmarks) {
          draw(ctx, lm, POSE_CONNECTIONS, "#2B5BF7", canvas.width / 240);
        }
        for (const lm of hr.landmarks) {
          draw(ctx, lm, HAND_CONNECTIONS, "#00A878", canvas.width / 320);
        }
      } catch {
        // frame no listo: se intenta en el siguiente
      }
    };

    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        const mk = async <T,>(
          create: (d: "GPU" | "CPU") => Promise<T>,
        ): Promise<T> => {
          try {
            return await create("GPU");
          } catch {
            return await create("CPU");
          }
        };
        const h = await mk((d) =>
          HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: HAND_MODEL, delegate: d },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.3,
            minHandPresenceConfidence: 0.3,
            minTrackingConfidence: 0.3,
          }),
        );
        const p = await mk((d) =>
          PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: POSE_MODEL, delegate: d },
            runningMode: "VIDEO",
            numPoses: 1,
          }),
        );
        if (disposed) {
          h.close();
          p.close();
          return;
        }
        hand = h;
        pose = p;
        raf = requestAnimationFrame(loop);
      } catch {
        // sin WASM/WebGL: el overlay simplemente no se dibuja
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      hand?.close();
      pose?.close();
    };
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden
    />
  );
}
