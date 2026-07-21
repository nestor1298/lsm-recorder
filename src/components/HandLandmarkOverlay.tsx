"use client";
import { useEffect, useRef, type RefObject } from "react";
import { useHandLandmarks } from "@/hooks/useHandLandmarks";
import type { HandLandmarks } from "@/lib/vision/types";

// 21-landmark hand skeleton edges (MediaPipe hand topology).
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

export interface HandLandmarkOverlayProps {
  /** The <video> to detect hands on (the sign clip being annotated). */
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
  /** Mirror horizontally to match a CSS-mirrored selfie video. */
  mirrored?: boolean;
  className?: string;
}

/**
 * Absolutely-positioned overlay that draws the detected 21-point hand skeleton
 * on top of a video. Drop it as a sibling of the <video> inside a
 * `position: relative` container. Pure visualization — no annotation state.
 */
export default function HandLandmarkOverlay({
  videoRef,
  enabled = true,
  mirrored = false,
  className,
}: HandLandmarkOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { status, lit, handsRef } = useHandLandmarks(videoRef, { enabled });

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        const w = video.clientWidth;
        const h = video.clientHeight;
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, w, h);
          ctx.save();
          if (mirrored) {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          }
          for (const hand of handsRef.current) drawHand(ctx, hand, w, h);
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [enabled, mirrored, videoRef, handsRef]);

  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      {status && (
        <div
          style={{
            position: "absolute",
            left: 8,
            bottom: 8,
            background: "rgba(0,0,0,0.6)",
            color: "white",
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 6,
          }}
        >
          {status}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          right: 8,
          top: 8,
          display: "flex",
          gap: 6,
        }}
      >
        <Dot on={lit.left} label="I" />
        <Dot on={lit.right} label="D" />
      </div>
    </div>
  );
}

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        color: on ? "white" : "#9ca3af",
        background: on ? "#16a34a" : "rgba(0,0,0,0.3)",
      }}
    >
      {label}
    </span>
  );
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  hand: HandLandmarks,
  w: number,
  h: number,
): void {
  if (hand.length === 0) return;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(99,102,241,0.9)"; // indigo links
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = hand[a];
    const pb = hand[b];
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(16,185,129,0.95)"; // green points
  for (const p of hand) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
