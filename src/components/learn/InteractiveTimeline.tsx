"use client";

import { useCallback, useMemo, useRef } from "react";
import type { SignConstruction } from "@/lib/sign_types";
import type { PlaybackFrame } from "@/lib/sign_playback";
import { DEFAULT_PLAYBACK_CONFIG } from "@/lib/sign_playback";

// ── Colors (match SegmentTimeline) ──────────────────────────────────
const D_COLOR = "#4f46e5";
const D_COLOR_DIM = "#6366f1";
const M_COLOR = "#0284c7";
const M_COLOR_DIM = "#38bdf8";

const SPEEDS = [0.5, 1, 1.5];

// ── Types ───────────────────────────────────────────────────────────

interface InteractiveTimelineProps {
  sign: SignConstruction;
  isPlaying: boolean;
  elapsedMs: number;
  totalDurationMs: number;
  speed: number;
  loop: boolean;
  currentFrame: PlaybackFrame | null;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onSpeedChange: (speed: number) => void;
  onScrub: (elapsedMs: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
}

// ── Segment layout ──────────────────────────────────────────────────

interface SegmentBlock {
  type: "D" | "M";
  label: string;
  startPct: number;
  widthPct: number;
  index: number;
}

function computeSegmentLayout(sign: SignConstruction): SegmentBlock[] {
  const { holdDuration, movementDuration } = DEFAULT_PLAYBACK_CONFIG;
  const segments = sign.segments;
  let totalMs = 0;
  for (const s of segments) totalMs += s.type === "D" ? holdDuration : movementDuration;
  if (totalMs === 0) return [];

  const blocks: SegmentBlock[] = [];
  let accMs = 0;
  let dCount = 0;
  let mCount = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const dur = seg.type === "D" ? holdDuration : movementDuration;
    const label = seg.type === "D" ? `D${++dCount}` : `M${++mCount}`;
    blocks.push({
      type: seg.type,
      label,
      startPct: (accMs / totalMs) * 100,
      widthPct: (dur / totalMs) * 100,
      index: i,
    });
    accMs += dur;
  }
  return blocks;
}

// ── Component ───────────────────────────────────────────────────────

export default function InteractiveTimeline({
  sign,
  isPlaying,
  elapsedMs,
  totalDurationMs,
  speed,
  loop,
  currentFrame,
  onTogglePlay,
  onStop,
  onToggleLoop,
  onSpeedChange,
  onScrub,
  onScrubStart,
  onScrubEnd,
}: InteractiveTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const blocks = useMemo(() => computeSegmentLayout(sign), [sign]);
  const playheadPct = totalDurationMs > 0 ? (elapsedMs / totalDurationMs) * 100 : 0;

  // ── Scrub helpers ─────────────────────────────────────────────────

  const msFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pct * totalDurationMs;
    },
    [totalDurationMs],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      scrubbing.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onScrubStart();
      onScrub(msFromPointer(e.clientX));
    },
    [onScrubStart, onScrub, msFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!scrubbing.current) return;
      onScrub(msFromPointer(e.clientX));
    },
    [onScrub, msFromPointer],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!scrubbing.current) return;
      scrubbing.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      onScrubEnd();
    },
    [onScrubEnd],
  );

  const cycleSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(speed);
    onSpeedChange(SPEEDS[(idx + 1) % SPEEDS.length]);
  }, [speed, onSpeedChange]);

  // ── Keyboard ──────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); onTogglePlay(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); onScrub(Math.max(0, elapsedMs - 50)); }
      if (e.key === "ArrowRight") { e.preventDefault(); onScrub(Math.min(totalDurationMs, elapsedMs + 50)); }
    },
    [onTogglePlay, onScrub, elapsedMs, totalDurationMs],
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-white/60 px-3 py-2 backdrop-blur-sm">
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-sm transition-colors hover:bg-indigo-600"
        title={isPlaying ? "Pausar" : "Reproducir"}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Stop */}
      <button
        onClick={onStop}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
        title="Detener"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      </button>

      {/* ── Segment track ── */}
      <div
        ref={trackRef}
        className="relative flex-1 cursor-pointer touch-none select-none"
        style={{ height: 24 }}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label="Línea de tiempo"
        aria-valuemin={0}
        aria-valuemax={totalDurationMs}
        aria-valuenow={Math.round(elapsedMs)}
      >
        {/* Segment blocks */}
        <div className="absolute inset-0 flex overflow-hidden rounded-lg">
          {blocks.map((b) => {
            const isActive = currentFrame?.segmentIndex === b.index;
            const baseColor = b.type === "D" ? D_COLOR : M_COLOR;
            const dimColor = b.type === "D" ? D_COLOR_DIM : M_COLOR_DIM;
            return (
              <div
                key={b.index}
                className="relative flex items-center justify-center overflow-hidden border-r border-white/20 last:border-r-0"
                style={{
                  width: `${b.widthPct}%`,
                  backgroundColor: isActive ? baseColor : dimColor,
                  opacity: isActive ? 1 : 0.5,
                  transition: "opacity 0.15s, background-color 0.15s",
                }}
              >
                {/* Progress fill within active segment */}
                {isActive && currentFrame && (
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${currentFrame.progress * 100}%`,
                      backgroundColor: "rgba(255,255,255,0.15)",
                    }}
                  />
                )}
                {/* Label */}
                <span className="relative z-10 text-[8px] font-bold text-white/80">
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Playhead */}
        <div
          className="pointer-events-none absolute top-0 z-20"
          style={{
            left: `${Math.min(100, Math.max(0, playheadPct))}%`,
            transform: "translateX(-50%)",
            height: 24,
          }}
        >
          {/* Line */}
          <div
            className="mx-auto h-full"
            style={{
              width: 2,
              backgroundColor: "#fff",
              boxShadow: "0 0 6px rgba(255,255,255,0.7)",
            }}
          />
          {/* Handle dot */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: -3,
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#fff",
              boxShadow: "0 0 4px rgba(0,0,0,0.3)",
            }}
          />
        </div>
      </div>

      {/* Loop toggle */}
      <button
        onClick={onToggleLoop}
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
          loop
            ? "bg-indigo-100 text-indigo-600"
            : "bg-gray-100 text-gray-400 hover:text-gray-600"
        }`}
        title={loop ? "Repetir: activado" : "Repetir: desactivado"}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
        </svg>
      </button>

      {/* Speed */}
      <button
        onClick={cycleSpeed}
        className="flex-shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600 transition-colors hover:bg-gray-200"
        title="Velocidad"
      >
        {speed}x
      </button>
    </div>
  );
}
