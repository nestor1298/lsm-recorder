"use client";

/**
 * TimelineCanales — pistas por canal fonológico, como un editor de
 * video: cada matriz (segmento, mano, lugar, palma, movimiento, rostro)
 * es una pista horizontal; cada segmento D/M es una celda proporcional
 * al tiempo. Tocar una celda selecciona el segmento (y el formulario
 * del modo experto edita ese canal). Complementa a PSHRTimeline, que
 * sigue editando los límites temporales.
 */

import { useMemo } from "react";
import type { PSHRSegment } from "@/lib/types";
import {
  CONTOUR_ES,
  PALM_ES,
  FINGER_ES,
  CONTACT_ES,
  directionLabel,
  ubName,
} from "@/lib/anotar_labels";

interface TimelineCanalesProps {
  segments: PSHRSegment[];
  durationMs: number;
  currentTimeMs: number;
  selectedSegmentId: string | null;
  onSegmentSelect: (id: string) => void;
  onSeek: (ms: number) => void;
}

interface Canal {
  id: string;
  label: string;
  cell: (s: PSHRSegment) => string;
}

const CANALES: Canal[] = [
  {
    id: "segmento",
    label: "Segmento",
    cell: (s) => `${s.type === "M" ? "M" : "D"}`,
  },
  {
    id: "mano",
    label: "Mano",
    cell: (s) =>
      s.cm_id
        ? `#${s.cm_id}${s.end_cm_id ? `→#${s.end_cm_id}` : ""}`
        : "—",
  },
  {
    id: "lugar",
    label: "Lugar",
    cell: (s) =>
      s.location_code
        ? `${ubName(s.location_code) ?? s.location_code}${
            s.contact ? ` · ${CONTACT_ES[s.contact].toLowerCase()}` : ""
          }`
        : "—",
  },
  {
    id: "palma",
    label: "Palma",
    cell: (s) =>
      [
        s.palm_facing && PALM_ES[s.palm_facing].replace("Palma ", ""),
        s.finger_pointing &&
          FINGER_ES[s.finger_pointing].replace("Dedos ", "dedos "),
      ]
        .filter(Boolean)
        .join(" · ") || "—",
  },
  {
    id: "movimiento",
    label: "Movimiento",
    cell: (s) =>
      [
        s.contour_movement && CONTOUR_ES[s.contour_movement],
        s.direction && directionLabel(s.direction),
        s.repetition && `×${s.repetition.count}`,
      ]
        .filter(Boolean)
        .join(" · ") || "—",
  },
  {
    id: "rostro",
    label: "Rostro",
    cell: (s) =>
      [
        s.eyebrows === "RAISED"
          ? "cejas ↑"
          : s.eyebrows === "FURROWED"
            ? "ceño"
            : undefined,
        s.mouth && s.mouth !== "NEUTRAL" ? `boca ${s.mouth.toLowerCase()}` : undefined,
      ]
        .filter(Boolean)
        .join(" · ") || "—",
  },
];

export default function TimelineCanales({
  segments,
  durationMs,
  currentTimeMs,
  selectedSegmentId,
  onSegmentSelect,
  onSeek,
}: TimelineCanalesProps) {
  const sorted = useMemo(
    () => [...segments].sort((a, b) => a.start_ms - b.start_ms),
    [segments],
  );
  if (sorted.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
        Agrega segmentos en la línea de tiempo para ver los canales.
      </p>
    );
  }
  const total = Math.max(durationMs, sorted[sorted.length - 1].end_ms, 1);
  const pct = (ms: number) => `${(ms / total) * 100}%`;

  return (
    <div className="relative overflow-x-auto">
      <div className="min-w-[560px]">
        {CANALES.map((canal) => (
          <div
            key={canal.id}
            className="flex items-stretch border-b border-gray-100 last:border-0"
          >
            <div className="w-24 shrink-0 py-1.5 pr-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {canal.label}
            </div>
            <div className="relative h-8 flex-1 bg-gray-50">
              {sorted.map((s) => {
                const isSelected = s.id === selectedSegmentId;
                const isM = s.type === "M";
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSegmentSelect(s.id);
                      onSeek((s.start_ms + s.end_ms) / 2);
                    }}
                    title={`${canal.label}: ${canal.cell(s)}`}
                    className={`absolute top-1 h-6 overflow-hidden truncate rounded-md border px-1.5 text-left text-[10px] font-medium transition-colors ${
                      isSelected
                        ? "border-accent bg-accent-tint text-accent-deep"
                        : isM
                          ? "border-gray-200 bg-paper text-gray-700 hover:border-accent"
                          : "border-gray-200 bg-gray-100 text-gray-600 hover:border-accent"
                    }`}
                    style={{
                      left: pct(s.start_ms),
                      width: `calc(${pct(s.end_ms - s.start_ms)} - 2px)`,
                    }}
                  >
                    {canal.cell(s)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {/* Playhead */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-coral"
          style={{ left: `calc(6rem + (100% - 6rem) * ${Math.min(1, currentTimeMs / total)})` }}
          aria-hidden
        />
      </div>
    </div>
  );
}
