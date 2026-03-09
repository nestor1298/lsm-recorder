"use client";

import { useCallback } from "react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  loop: boolean;
  onToggleLoop: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  /** Current segment index (0-based) */
  currentSegment: number;
  totalSegments: number;
  progress: number; // 0..1 overall
}

const SPEEDS = [0.5, 1, 1.5];

export default function PlaybackControls({
  isPlaying,
  onTogglePlay,
  onStop,
  loop,
  onToggleLoop,
  speed,
  onSpeedChange,
  currentSegment,
  totalSegments,
  progress,
}: PlaybackControlsProps) {
  const cycleSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    onSpeedChange(next);
  }, [speed, onSpeedChange]);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-white/60 px-3 py-2 backdrop-blur-sm">
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-sm transition-colors hover:bg-indigo-600"
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
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
        title="Detener"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      </button>

      {/* Progress dots */}
      <div className="flex flex-1 items-center gap-1 px-2">
        {Array.from({ length: totalSegments }, (_, i) => (
          <div
            key={i}
            className="h-2 flex-1 rounded-full transition-all"
            style={{
              backgroundColor:
                i < currentSegment
                  ? "#4f46e5"
                  : i === currentSegment
                    ? "#818cf8"
                    : "#e5e7eb",
              opacity: i === currentSegment ? 0.6 + Math.sin(Date.now() * 0.005) * 0.4 : 1,
            }}
          />
        ))}
      </div>

      {/* Loop toggle */}
      <button
        onClick={onToggleLoop}
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
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
        className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600 transition-colors hover:bg-gray-200"
        title="Velocidad"
      >
        {speed}x
      </button>
    </div>
  );
}
