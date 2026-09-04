"use client";

/**
 * TimelineCanales — LA línea de tiempo del modo experto, estilo editor
 * de video: regla scrubbable con el cursor, fila de segmentos D/M
 * editable (arrastrar extremos = redimensionar, arrastrar el centro =
 * mover, chips para agregar, × para eliminar) y una pista por canal
 * fonológico. Tocar una celda selecciona el segmento y abre su editor.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { PSHRSegment, Phase } from "@/lib/types";
import {
  CONTOUR_ES,
  PALM_ES,
  FINGER_ES,
  CONTACT_ES,
  directionLabel,
  ubName,
} from "@/lib/anotar_labels";

const MIN_SEG_MS = 80;

const PHASE_LABEL: Record<Phase, string> = {
  PREPARATION: "P",
  STROKE: "S",
  HOLD: "H",
  RETRACTION: "R",
};

const PHASE_COLOR: Record<Phase, string> = {
  PREPARATION: "bg-gray-100 text-gray-600 border-gray-200",
  STROKE: "bg-accent-tint text-accent-deep border-accent",
  HOLD: "bg-green-tint text-green-deep border-green",
  RETRACTION: "bg-gold-tint text-gold-deep border-gold",
};

interface Canal {
  id: string;
  label: string;
  cell: (s: PSHRSegment) => string;
}

const CANALES: Canal[] = [
  {
    id: "mano",
    label: "Mano",
    cell: (s) =>
      s.cm_id ? `#${s.cm_id}${s.end_cm_id ? `→#${s.end_cm_id}` : ""}` : "—",
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
        s.mouth && s.mouth !== "NEUTRAL"
          ? `boca ${s.mouth.toLowerCase()}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · ") || "—",
  },
];

type DragState =
  | { kind: "scrub" }
  | { kind: "resize"; id: string; edge: "start" | "end" }
  | { kind: "move"; id: string; grabOffsetMs: number };

interface TimelineCanalesProps {
  segments: PSHRSegment[];
  durationMs: number;
  currentTimeMs: number;
  selectedSegmentId: string | null;
  onSegmentSelect: (id: string) => void;
  onSeek: (ms: number) => void;
  onChannelSelect?: (canal: string) => void;
  onSegmentUpdate: (id: string, updates: Partial<PSHRSegment>) => void;
  onSegmentAdd: (segment: PSHRSegment) => void;
  onSegmentDelete: (id: string) => void;
}

export default function TimelineCanales({
  segments,
  durationMs,
  currentTimeMs,
  selectedSegmentId,
  onSegmentSelect,
  onSeek,
  onChannelSelect,
  onSegmentUpdate,
  onSegmentAdd,
  onSegmentDelete,
}: TimelineCanalesProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [addMode, setAddMode] = useState<Phase | null>(null);

  const sorted = useMemo(
    () => [...segments].sort((a, b) => a.start_ms - b.start_ms),
    [segments],
  );
  const total = Math.max(
    durationMs,
    sorted.length ? sorted[sorted.length - 1].end_ms : 0,
    1,
  );
  const pct = (ms: number) => `${(ms / total) * 100}%`;

  const clientXToMs = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      const t = ((clientX - r.left) / r.width) * total;
      return Math.max(0, Math.min(total, t));
    },
    [total],
  );

  // ── Drag global (scrub / resize / move) ───────────────────────
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const ms = clientXToMs(e.clientX);
      if (drag.kind === "scrub") {
        onSeek(ms);
        return;
      }
      const seg = segments.find((s) => s.id === drag.id);
      if (!seg) return;
      if (drag.kind === "resize") {
        if (drag.edge === "start") {
          onSegmentUpdate(seg.id, {
            start_ms: Math.min(ms, seg.end_ms - MIN_SEG_MS),
          });
        } else {
          onSegmentUpdate(seg.id, {
            end_ms: Math.max(ms, seg.start_ms + MIN_SEG_MS),
          });
        }
      } else {
        const w = seg.end_ms - seg.start_ms;
        const start = Math.max(0, Math.min(total - w, ms - drag.grabOffsetMs));
        onSegmentUpdate(seg.id, { start_ms: start, end_ms: start + w });
      }
    },
    [segments, total, clientXToMs, onSeek, onSegmentUpdate],
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  const startDrag = (e: React.PointerEvent, state: DragState) => {
    e.stopPropagation();
    dragRef.current = state;
    (e.currentTarget.closest("[data-tlroot]") as HTMLElement | null)
      ?.setPointerCapture?.(e.pointerId);
  };

  const handleRulerDown = (e: React.PointerEvent) => {
    dragRef.current = { kind: "scrub" };
    (e.currentTarget.closest("[data-tlroot]") as HTMLElement | null)
      ?.setPointerCapture?.(e.pointerId);
    const ms = clientXToMs(e.clientX);
    if (addMode) {
      const half = Math.min(total * 0.05, 250);
      onSegmentAdd({
        id: crypto.randomUUID(),
        type: addMode === "STROKE" ? "M" : addMode === "HOLD" ? "D" : "T",
        phase: addMode,
        start_ms: Math.max(0, ms - half),
        end_ms: Math.min(total, ms + half),
      });
      setAddMode(null);
      dragRef.current = null;
      return;
    }
    onSeek(ms);
  };

  const selected = sorted.find((s) => s.id === selectedSegmentId);

  return (
    <div
      data-tlroot
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="select-none"
    >
      {/* Controles: agregar / eliminar */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500">Agregar:</span>
        {(
          ["PREPARATION", "STROKE", "HOLD", "RETRACTION"] as Phase[]
        ).map((ph) => (
          <button
            key={ph}
            onClick={() => setAddMode(addMode === ph ? null : ph)}
            aria-pressed={addMode === ph}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              addMode === ph
                ? "border-ink bg-ink text-paper"
                : `${PHASE_COLOR[ph]} hover:opacity-80`
            }`}
          >
            {PHASE_LABEL[ph]} · {ph.toLowerCase()}
          </button>
        ))}
        {addMode && (
          <span className="text-[10px] text-gray-500">
            Toca la regla donde va el segmento
          </span>
        )}
        <div className="flex-1" />
        {selected && (
          <button
            onClick={() => onSegmentDelete(selected.id)}
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-coral-deep hover:bg-coral-tint"
          >
            Eliminar segmento
          </button>
        )}
      </div>

      <div className="relative overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Regla de tiempo (scrub con el cursor) */}
          <div className="flex items-stretch">
            <div className="w-24 shrink-0" />
            <div
              ref={trackRef}
              onPointerDown={handleRulerDown}
              className="relative h-7 flex-1 cursor-ew-resize rounded-t-md bg-gray-100"
              role="slider"
              aria-label="Momento del video"
              aria-valuemin={0}
              aria-valuemax={Math.round(total)}
              aria-valuenow={Math.round(currentTimeMs)}
              tabIndex={0}
              onKeyDown={(e) => {
                const step = total / 50;
                if (e.key === "ArrowLeft")
                  onSeek(Math.max(0, currentTimeMs - step));
                if (e.key === "ArrowRight")
                  onSeek(Math.min(total, currentTimeMs + step));
              }}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <span
                  key={f}
                  className="absolute top-1 text-[9px] text-gray-400"
                  style={{ left: `calc(${f * 100}% + 3px)` }}
                >
                  {((total * f) / 1000).toFixed(1)}s
                </span>
              ))}
            </div>
          </div>

          {/* Fila de segmentos (editable) */}
          <div className="flex items-stretch border-b border-gray-100">
            <div className="w-24 shrink-0 py-1.5 pr-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Segmento
            </div>
            <div className="relative h-9 flex-1 bg-gray-50">
              {sorted.map((s) => {
                const isSelected = s.id === selectedSegmentId;
                return (
                  <div
                    key={s.id}
                    className={`absolute top-1 flex h-7 items-stretch overflow-hidden rounded-md border text-[10px] font-semibold ${
                      PHASE_COLOR[s.phase]
                    } ${isSelected ? "ring-2 ring-ink" : ""}`}
                    style={{
                      left: pct(s.start_ms),
                      width: `calc(${pct(s.end_ms - s.start_ms)} - 2px)`,
                    }}
                  >
                    {/* extremo izquierdo */}
                    <div
                      onPointerDown={(e) =>
                        startDrag(e, { kind: "resize", id: s.id, edge: "start" })
                      }
                      className="w-2 shrink-0 cursor-ew-resize bg-current opacity-30 hover:opacity-60"
                      aria-hidden
                    />
                    {/* centro: seleccionar / mover */}
                    <button
                      onPointerDown={(e) => {
                        const ms = clientXToMs(e.clientX);
                        startDrag(e, {
                          kind: "move",
                          id: s.id,
                          grabOffsetMs: ms - s.start_ms,
                        });
                      }}
                      onClick={() => onSegmentSelect(s.id)}
                      className="flex-1 cursor-grab truncate px-1 text-left active:cursor-grabbing"
                    >
                      {s.type === "M" ? "M" : "D"} · {PHASE_LABEL[s.phase]}
                    </button>
                    {/* extremo derecho */}
                    <div
                      onPointerDown={(e) =>
                        startDrag(e, { kind: "resize", id: s.id, edge: "end" })
                      }
                      className="w-2 shrink-0 cursor-ew-resize bg-current opacity-30 hover:opacity-60"
                      aria-hidden
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pistas por canal */}
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
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        onSegmentSelect(s.id);
                        onSeek((s.start_ms + s.end_ms) / 2);
                        onChannelSelect?.(canal.id);
                      }}
                      title={`${canal.label}: ${canal.cell(s)}`}
                      className={`absolute top-1 h-6 overflow-hidden truncate rounded-md border px-1.5 text-left text-[10px] font-medium transition-colors ${
                        isSelected
                          ? "border-accent bg-accent-tint text-accent-deep"
                          : "border-gray-200 bg-paper text-gray-700 hover:border-accent"
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

          {/* Playhead (arrastrable desde la regla) */}
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-coral"
            style={{
              left: `calc(6rem + (100% - 6rem) * ${Math.min(1, currentTimeMs / total)})`,
            }}
            aria-hidden
          >
            <span className="absolute -left-[5px] top-0 h-3 w-3 rounded-full bg-coral" />
          </div>
        </div>
      </div>

      {sorted.length === 0 && (
        <p className="mt-2 rounded-lg border border-dashed border-gray-300 p-3 text-center text-xs text-gray-400">
          Sube un video para que la visión proponga los segmentos, o
          agrégalos con los botones de arriba.
        </p>
      )}
    </div>
  );
}
