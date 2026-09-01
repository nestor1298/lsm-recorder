"use client";

import type { PasoId } from "@/lib/anotar_draft";
import { PASOS } from "@/lib/anotar_draft";

/**
 * Indicador de pasos del flujo guiado. Ícono grande + nombre corto:
 * pensado para leerse de un vistazo, sin depender del texto.
 */

const STEP_META: Record<PasoId, { label: string; icon: React.ReactNode }> = {
  video: {
    label: "Video",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="3" y="6" width="13" height="12" rx="2" fill="currentColor" />
        <path d="M16 10.5 21 7.5v9l-5-3v-3z" fill="currentColor" />
      </svg>
    ),
  },
  cm: {
    label: "Mano",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M8 21c-2 0-3.5-2.5-3.5-5V9.5a1.4 1.4 0 0 1 2.8 0V12M7.3 12V5.4a1.4 1.4 0 0 1 2.8 0V11M10.1 11V4.2a1.4 1.4 0 0 1 2.8 0V11M12.9 11V5.4a1.4 1.4 0 0 1 2.8 0v7.4l1.6-1.9a1.3 1.3 0 0 1 2 1.6L16.5 18c-1 1.9-2.4 3-4.5 3H8z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  ubicacion: {
    label: "Lugar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="6" r="3" fill="currentColor" />
        <path
          d="M12 10c-3.5 0-6 2-6 5v6h12v-6c0-3-2.5-5-6-5z"
          fill="currentColor"
          opacity="0.5"
        />
        <circle cx="16.5" cy="13.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M19 16l2.4 2.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  orientacion: {
    label: "Palma",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect
          x="7"
          y="5"
          width="10"
          height="14"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M12 9v6m0 0-2.4-2.4M12 15l2.4-2.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  movimiento: {
    label: "Movimiento",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M4 16c3-7 8-7 10-3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M14.5 8.5 15 13l-4.2-1.2 3.7-3.3z" fill="currentColor" />
      </svg>
    ),
  },
  resumen: {
    label: "Listo",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M5 12.5 10 17.5 19 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
};

interface StepIndicatorProps {
  current: PasoId;
  /** Pasos ya completados (permiten saltar hacia atrás) */
  completed: Set<PasoId>;
  onNavigate: (paso: PasoId) => void;
}

export default function StepIndicator({
  current,
  completed,
  onNavigate,
}: StepIndicatorProps) {
  const currentIdx = PASOS.indexOf(current);

  return (
    <ol className="flex items-center gap-1 sm:gap-2" aria-label="Pasos">
      {PASOS.map((paso, i) => {
        const meta = STEP_META[paso];
        const isCurrent = paso === current;
        const isDone = completed.has(paso) && !isCurrent;
        const reachable = isDone || i <= currentIdx;
        return (
          <li key={paso} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && (
              <span
                className={`h-0.5 w-4 rounded sm:w-8 ${
                  i <= currentIdx ? "bg-accent" : "bg-gray-200"
                }`}
                aria-hidden
              />
            )}
            <button
              onClick={() => reachable && onNavigate(paso)}
              disabled={!reachable}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors sm:px-3 ${
                isCurrent
                  ? "bg-ink text-paper"
                  : isDone
                    ? "bg-green-tint text-green-deep hover:bg-green-tint/70"
                    : reachable
                      ? "text-gray-500 hover:bg-gray-100"
                      : "text-gray-300"
              }`}
            >
              {meta.icon}
              <span className="text-[10px] font-semibold">{meta.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
