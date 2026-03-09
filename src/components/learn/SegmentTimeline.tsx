"use client";

import type { Segment } from "@/lib/sign_types";
import { segmentSummary } from "@/lib/sign_types";

interface SegmentTimelineProps {
  segments: Segment[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAddHold: () => void;
  onAddMovement: () => void;
  onRemove: (index: number) => void;
}

const D_COLOR = "#4f46e5";
const M_COLOR = "#0284c7";

export default function SegmentTimeline({
  segments,
  activeIndex,
  onSelect,
  onAddHold,
  onAddMovement,
  onRemove,
}: SegmentTimelineProps) {
  let dCount = 0;
  let mCount = 0;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1">
      {segments.map((seg, i) => {
        if (seg.type === "D") dCount++;
        else mCount++;

        const label = seg.type === "D" ? `D${dCount}` : `M${mCount}`;
        const isActive = i === activeIndex;
        const color = seg.type === "D" ? D_COLOR : M_COLOR;
        const summary = segmentSummary(seg);

        return (
          <div key={seg.id} className="flex items-center">
            {/* Connector */}
            {i > 0 && (
              <div className="mx-0.5 h-0.5 w-3 flex-shrink-0 rounded bg-gray-300 sm:w-5" />
            )}

            {/* Segment chip */}
            <button
              onClick={() => onSelect(i)}
              className={`group relative flex flex-shrink-0 flex-col items-center rounded-lg border-2 px-2.5 py-1 transition-all ${
                isActive
                  ? "scale-105 text-white shadow-lg"
                  : "bg-white/50 text-gray-600 hover:shadow-md"
              }`}
              style={
                isActive
                  ? { backgroundColor: color, borderColor: color }
                  : { borderColor: `${color}40` }
              }
            >
              <span className="text-[11px] font-bold leading-none">{label}</span>
              <span
                className={`mt-0.5 text-[8px] leading-none ${
                  isActive ? "text-white/70" : "text-gray-400"
                }`}
              >
                {summary}
              </span>

              {/* Remove button on hover */}
              {segments.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i);
                  }}
                  className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white shadow-sm group-hover:flex"
                >
                  ✕
                </button>
              )}
            </button>
          </div>
        );
      })}

      {/* Add segment buttons */}
      <div className="ml-2 flex flex-shrink-0 items-center gap-1">
        <button
          onClick={onAddHold}
          className="rounded-lg border border-dashed border-indigo-400/50 px-2 py-1.5 text-[10px] font-bold text-indigo-600 transition-colors hover:border-indigo-400 hover:bg-indigo-500/10"
        >
          +D
        </button>
        <button
          onClick={onAddMovement}
          className="rounded-lg border border-dashed border-sky-400/50 px-2 py-1.5 text-[10px] font-bold text-sky-600 transition-colors hover:border-sky-400 hover:bg-sky-500/10"
        >
          +M
        </button>
      </div>
    </div>
  );
}
