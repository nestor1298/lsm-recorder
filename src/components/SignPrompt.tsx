"use client";

import type { CMEntry } from "@/lib/types";
import { TIER_COLORS } from "@/lib/data";

interface SignPromptProps {
  cm: CMEntry;
  index: number;
  total: number;
}

// Rasgos de la CM en lenguaje llano (los valores del esquema están en inglés)
const FLEXION_ES: Record<string, string> = {
  EXTENDED: "extendido",
  CURVED: "curvado",
  BENT: "doblado",
  CLOSED: "cerrado",
};
const OPOSICION_ES: Record<string, string> = {
  OPPOSED: "opuesto",
  PARALLEL: "paralelo",
  CROSSED: "cruzado",
};
const SEPARACION_ES: Record<string, string> = {
  NEUTRAL: "neutra",
  SPREAD: "separados",
};
const INTERACCION_ES: Record<string, string> = {
  NONE: "ninguna",
  CROSSED: "cruzados",
  STACKED: "apilados",
};
const es = (tabla: Record<string, string>, v: string) =>
  tabla[v] ?? v.toLowerCase();

export default function SignPrompt({ cm, index, total }: SignPromptProps) {
  const tierClass = TIER_COLORS[cm.frequency_tier];

  const fingerLabels = ["Índice", "Medio", "Anular", "Meñique"];
  const fingerStates = [cm.index, cm.middle, cm.ring, cm.pinky];
  const thumbLabel = `${es(OPOSICION_ES, cm.thumb_opposition)}, ${es(FLEXION_ES, cm.thumb_flexion)}`;

  return (
    <div className="rounded-xl border border-accent-tint bg-accent-tint p-6">
      {/* Progress */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-accent-deep">
          Seña {index + 1} de {total}
        </span>
        <div className="h-2 flex-1 mx-4 overflow-hidden rounded-full bg-accent-tint">
          <div
            className="h-full rounded-full bg-ink transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Main sign info */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="text-2xl font-bold text-ink">#{cm.cm_id}</span>
          {cm.alpha_code && (
            <span className="rounded bg-paper px-2 py-1 font-mono text-lg text-gray-700 shadow-sm">
              {cm.alpha_code}
            </span>
          )}
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tierClass}`}
          >
            T{cm.frequency_tier}
          </span>
        </div>
        <h2 className="mt-2 text-4xl font-bold text-accent-deep">
          {cm.example_sign}
        </h2>
        <p className="mt-1 font-mono text-sm text-gray-500">
          {cm.cruz_aldrete_notation}
        </p>
      </div>

      {/* Handshape details */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {/* Finger states */}
        <div className="rounded-lg bg-paper p-3">
          <p className="mb-2 text-xs font-medium overline-label text-gray-500">
            Estado de los dedos
          </p>
          <div className="space-y-1">
            {fingerLabels.map((label, i) => {
              const isSelected = cm.selected_fingers.includes(i + 1);
              return (
                <div
                  key={label}
                  className={`flex items-center justify-between text-sm ${
                    isSelected ? "font-medium text-ink" : "text-gray-400"
                  }`}
                >
                  <span>
                    {label} {isSelected && "*"}
                  </span>
                  <span className="font-mono text-xs">
                    {es(FLEXION_ES, fingerStates[i])}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thumb & modifiers */}
        <div className="rounded-lg bg-paper p-3">
          <p className="mb-2 text-xs font-medium overline-label text-gray-500">
            Pulgar y modificadores
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Pulgar</span>
              <span className="font-mono text-xs text-ink">{thumbLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Separación</span>
              <span className="font-mono text-xs text-ink">
                {es(SEPARACION_ES, cm.spread)}
              </span>
            </div>
            {cm.interaction !== "NONE" && (
              <div className="flex justify-between">
                <span className="text-gray-600">Interacción</span>
                <span className="font-mono text-xs text-ink">
                  {es(INTERACCION_ES, cm.interaction)}
                </span>
              </div>
            )}
            {cm.thumb_contact && (
              <div className="text-xs text-magenta-deep">Contacto del pulgar</div>
            )}
            {cm.non_selected_above && (
              <div className="text-xs text-accent-deep">
                No seleccionados arriba (NSAb)
              </div>
            )}
          </div>
        </div>
      </div>

      {cm.notes && (
        <p className="mt-3 text-center text-xs italic text-gray-500">
          {cm.notes}
        </p>
      )}
    </div>
  );
}
