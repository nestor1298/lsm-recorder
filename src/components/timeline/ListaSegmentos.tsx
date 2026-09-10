"use client";

/**
 * ListaSegmentos — la ruta textual a cada segmento.
 *
 * El zoom no puede ser la única forma de llegar a un segmento: quien no
 * pueda hacer un pellizco tiene que poder anotar igual. Esta lista es
 * navegable con teclado (tab a la lista, flechas entre filas) y
 * selecciona exactamente lo mismo que la línea de tiempo.
 */

import { useRef } from "react";
import type { PSHRSegment, SignAnnotation } from "@/lib/types";
import { CANALES, valorDe } from "@/lib/timeline/channels";
import { PHASE_ES, TIMELINE_ES } from "@/lib/anotar_labels";

interface ListaSegmentosProps {
  annotation: SignAnnotation;
  selectedSegmentId: string | null;
  onSelect: (id: string) => void;
}

/** Resumen textual de un segmento, leído de sus matrices. */
export function resumirSegmento(
  s: PSHRSegment,
  annotation: SignAnnotation,
): string {
  const partes: string[] = [];
  for (const c of CANALES) {
    if (c.maestro) continue;
    const filas = c.subfilas?.map((f) => f.id) ?? [undefined];
    for (const f of filas) {
      const v = valorDe(c.id, s, annotation, f);
      if (v) partes.push(v.aria);
    }
  }
  return partes.join(", ") || "sin anotar";
}

export default function ListaSegmentos({
  annotation,
  selectedSegmentId,
  onSelect,
}: ListaSegmentosProps) {
  const refLista = useRef<HTMLUListElement>(null);
  const orden = [...annotation.segments].sort(
    (a, b) => a.start_ms - b.start_ms,
  );

  const alTeclado = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const siguiente = e.key === "ArrowDown" ? i + 1 : i - 1;
    const botones =
      refLista.current?.querySelectorAll<HTMLButtonElement>("button[data-fila]");
    botones?.[Math.max(0, Math.min(botones.length - 1, siguiente))]?.focus();
  };

  if (orden.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-paper p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {TIMELINE_ES.listaSegmentos}
      </h3>
      <ul ref={refLista} className="space-y-1">
        {orden.map((s, i) => {
          const activo = s.id === selectedSegmentId;
          return (
            <li key={s.id}>
              <button
                data-fila
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => alTeclado(e, i)}
                aria-current={activo ? "true" : undefined}
                className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                  activo
                    ? "border-accent bg-accent-tint text-accent-deep"
                    : "border-gray-200 bg-paper text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className="font-semibold">
                  {s.type} · {PHASE_ES[s.phase] ?? s.phase}
                </span>
                <span className="text-gray-500">
                  {" "}
                  · {Math.round(s.start_ms)}–{Math.round(s.end_ms)} ms
                </span>
                <span className="block truncate text-[11px] text-gray-500">
                  {resumirSegmento(s, annotation)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
