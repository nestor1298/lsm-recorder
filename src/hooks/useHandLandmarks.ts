"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { awaitReadyVideo } from "@/lib/vision/awaitReadyVideo";
import {
  createLandmarkExtractor,
  type ExtractorOptions,
} from "@/lib/vision/extractor";
import { type HandsLit, handsLit } from "@/lib/vision/handIndicator";
import { FrameGate } from "@/lib/vision/pacing";
import type { HandLandmarks } from "@/lib/vision/types";

const DETECT_INTERVAL_MS = 33; // ~30fps
const MAX_CONSECUTIVE_ERRORS = 30;

export interface HandLandmarksState {
  /** Status message ('' once a hand is in frame / detection is running). */
  status: string;
  /** Which hand side is lit (Izquierda/Derecha). */
  lit: HandsLit;
  /** Fresh landmarks (mutable ref, zero re-renders) — read in a draw loop. */
  handsRef: { current: HandLandmarks[] };
}

export interface UseHandLandmarksOptions {
  enabled?: boolean;
  onFrame?: (hands: HandLandmarks[], tMs: number) => void;
  detectIntervalMs?: number;
  extractor?: ExtractorOptions;
}

/**
 * Web-only hand-landmark pipeline (adapted from signa-play's useHandDetection,
 * with react-native stripped). Loads the MediaPipe HandLandmarker, waits for the
 * given <video> to deliver frames, and runs a ~30fps detection loop. Each frame
 * is delivered via `onFrame` and the latest hands are exposed on `handsRef`
 * (mutable, so an overlay can paint without forcing React re-renders).
 */
export function useHandLandmarks(
  videoRef: RefObject<HTMLVideoElement | null>,
  options: UseHandLandmarksOptions = {},
): HandLandmarksState {
  const { enabled = true, detectIntervalMs = DETECT_INTERVAL_MS } = options;
  const [status, setStatus] = useState("");
  const [lit, setLit] = useState<HandsLit>({ left: false, right: false });
  const handsRef = useRef<HandLandmarks[]>([]);
  // The effect runs once; the caller's callback can change per render -> always
  // read the fresh version via ref.
  const onFrameRef = useRef(options.onFrame);
  onFrameRef.current = options.onFrame;
  const extractorOptsRef = useRef(options.extractor);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let cancelled = false;
    const extractor = createLandmarkExtractor(extractorOptsRef.current);
    void (async () => {
      try {
        setStatus("Cargando modelo...");
        await extractor.init();
        if (cancelled) return;
        const ready = await awaitReadyVideo<HTMLVideoElement>(
          () => videoRef.current,
          {
            isCancelled: () => cancelled,
            sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
            timeoutMs: 60000,
          },
        );
        if (cancelled || ready.status === "cancelled") return;
        if (ready.status === "timeout") {
          setStatus("El video no entregó imagen");
          return;
        }
        const video = ready.video;
        setStatus("");
        let consecutiveErrors = 0;
        const gate = new FrameGate(detectIntervalMs);
        const loop = () => {
          if (cancelled) return;
          const t = performance.now();
          if (!gate.shouldRun(t)) {
            raf = requestAnimationFrame(loop);
            return;
          }
          try {
            const r = extractor.detect(video, t);
            consecutiveErrors = 0;
            handsRef.current = r.hands;
            const nowLit = handsLit(r.hands);
            setLit((prev) =>
              prev.left === nowLit.left && prev.right === nowLit.right
                ? prev
                : nowLit,
            );
            onFrameRef.current?.(r.hands, t);
          } catch (e) {
            // A single failed frame must not silently kill the loop.
            consecutiveErrors += 1;
            if (consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
              setStatus(
                "La detección falló: " +
                  (e instanceof Error ? e.message : String(e)).slice(0, 120),
              );
              return;
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch {
        if (!cancelled) setStatus("No se pudo iniciar la detección");
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      extractor.close();
    };
  }, [enabled, detectIntervalMs, videoRef]);

  return { status, lit, handsRef };
}
