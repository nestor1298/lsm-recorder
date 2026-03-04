"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { PSHRSegment, Phase, SegmentType } from "@/lib/types";

const PHASE_COLORS: Record<Phase, string> = {
  PREPARATION: "#94a3b8",
  STROKE: "#6366f1",
  HOLD: "#22c55e",
  RETRACTION: "#f59e0b",
};

const PHASE_LABELS: Record<Phase, string> = {
  PREPARATION: "P",
  STROKE: "S",
  HOLD: "H",
  RETRACTION: "R",
};

const SEGMENT_TYPE_LABELS: Record<SegmentType, string> = {
  M: "Movement",
  D: "Detention",
  T: "Transition",
};

interface PSHRTimelineProps {
  segments: PSHRSegment[];
  durationMs: number;
  currentTimeMs: number;
  onSeek: (timeMs: number) => void;
  onSegmentAdd: (segment: PSHRSegment) => void;
  onSegmentUpdate: (id: string, updates: Partial<PSHRSegment>) => void;
  onSegmentDelete: (id: string) => void;
  onSegmentSelect: (id: string | null) => void;
  selectedSegmentId: string | null;
}

export default function PSHRTimeline({
  segments,
  durationMs,
  currentTimeMs,
  onSeek,
  onSegmentAdd,
  onSegmentUpdate,
  onSegmentDelete,
  onSegmentSelect,
  selectedSegmentId,
}: PSHRTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [addMode, setAddMode] = useState<Phase | null>(null);

  const msToPercent = (ms: number) =>
    durationMs > 0 ? (ms / durationMs) * 100 : 0;

  const percentToMs = (pct: number) => (pct / 100) * durationMs;

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const timeMs = percentToMs(Math.max(0, Math.min(100, pct)));

      if (addMode) {
        // Add a new segment at click position
        const segDuration = Math.min(durationMs * 0.1, 500); // 10% or 500ms
        onSegmentAdd({
          id: crypto.randomUUID(),
          type: addMode === "STROKE" ? "M" : addMode === "HOLD" ? "D" : "T",
          phase: addMode,
          start_ms: Math.max(0, timeMs - segDuration / 2),
          end_ms: Math.min(durationMs, timeMs + segDuration / 2),
        });
        setAddMode(null);
      } else {
        onSeek(timeMs);
      }
    },
    [addMode, durationMs, onSeek, onSegmentAdd, percentToMs]
  );

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const frac = Math.floor((ms % 1000) / 100);
    return `${s}.${frac}s`;
  };

  return (
    <div className="space-y-3">
      {/* Add segment buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Add:</span>
        {(["PREPARATION", "STROKE", "HOLD", "RETRACTION"] as Phase[]).map(
          (phase) => (
            <button
              key={phase}
              onClick={() => setAddMode(addMode === phase ? null : phase)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                addMode === phase
                  ? "ring-2 ring-offset-1 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              style={{
                backgroundColor:
                  addMode === phase ? PHASE_COLORS[phase] : `${PHASE_COLORS[phase]}20`,
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: addMode === phase ? PHASE_COLORS[phase] : `${PHASE_COLORS[phase]}40`,
              }}
            >
              {PHASE_LABELS[phase]} - {phase.charAt(0) + phase.slice(1).toLowerCase()}
            </button>
          )
        )}
        {addMode && (
          <span className="text-xs text-indigo-600 animate-pulse">
            Click timeline to place segment
          </span>
        )}
      </div>

      {/* Timeline track */}
      <div
        ref={timelineRef}
        className={`relative h-16 overflow-hidden rounded-lg border-2 ${
          addMode ? "border-indigo-400 cursor-crosshair" : "border-gray-200 cursor-pointer"
        } bg-gray-50`}
        onClick={handleTimelineClick}
      >
        {/* Time marks */}
        {Array.from({ length: 11 }, (_, i) => i * 10).map((pct) => (
          <div
            key={pct}
            className="absolute top-0 h-full border-l border-gray-200"
            style={{ left: `${pct}%` }}
          >
            <span className="absolute -top-0.5 left-1 text-[9px] text-gray-400">
              {formatTime(percentToMs(pct))}
            </span>
          </div>
        ))}

        {/* Segments */}
        {segments.map((seg) => {
          const left = msToPercent(seg.start_ms);
          const width = msToPercent(seg.end_ms - seg.start_ms);
          const isSelected = seg.id === selectedSegmentId;

          return (
            <div
              key={seg.id}
              className={`absolute top-5 h-9 rounded cursor-pointer transition-all ${
                isSelected ? "ring-2 ring-white shadow-lg z-10" : "hover:brightness-110"
              }`}
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 1)}%`,
                backgroundColor: PHASE_COLORS[seg.phase],
                opacity: isSelected ? 1 : 0.8,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSegmentSelect(isSelected ? null : seg.id);
              }}
            >
              <div className="flex h-full items-center justify-center px-1">
                <span className="text-[10px] font-bold text-white truncate">
                  {PHASE_LABELS[seg.phase]}
                </span>
              </div>
            </div>
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-0.5 bg-red-500 z-20 pointer-events-none"
          style={{ left: `${msToPercent(currentTimeMs)}%` }}
        >
          <div className="absolute -left-1.5 -top-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white" />
        </div>
      </div>

      {/* Time display */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>{formatTime(currentTimeMs)}</span>
        <span>{formatTime(durationMs)}</span>
      </div>

      {/* Selected segment editor */}
      {selectedSegmentId && (() => {
        const seg = segments.find((s) => s.id === selectedSegmentId);
        if (!seg) return null;
        return (
          <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: PHASE_COLORS[seg.phase] }}
                />
                <span className="text-sm font-semibold text-gray-900">
                  {seg.phase} ({SEGMENT_TYPE_LABELS[seg.type]})
                </span>
              </div>
              <button
                onClick={() => {
                  onSegmentDelete(seg.id);
                  onSegmentSelect(null);
                }}
                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-gray-500">Start (ms)</label>
                <input
                  type="number"
                  value={Math.round(seg.start_ms)}
                  onChange={(e) =>
                    onSegmentUpdate(seg.id, { start_ms: Number(e.target.value) })
                  }
                  className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                  step={50}
                  min={0}
                  max={seg.end_ms - 50}
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500">End (ms)</label>
                <input
                  type="number"
                  value={Math.round(seg.end_ms)}
                  onChange={(e) =>
                    onSegmentUpdate(seg.id, { end_ms: Number(e.target.value) })
                  }
                  className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                  step={50}
                  min={seg.start_ms + 50}
                  max={durationMs}
                />
              </div>
            </div>
            {/* Phase switcher */}
            <div className="flex gap-1">
              {(["PREPARATION", "STROKE", "HOLD", "RETRACTION"] as Phase[]).map((p) => (
                <button
                  key={p}
                  onClick={() => onSegmentUpdate(seg.id, { phase: p, type: p === "STROKE" ? "M" : p === "HOLD" ? "D" : "T" })}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                    seg.phase === p ? "text-white" : "text-gray-500"
                  }`}
                  style={{
                    backgroundColor: seg.phase === p ? PHASE_COLORS[p] : `${PHASE_COLORS[p]}15`,
                  }}
                >
                  {PHASE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
