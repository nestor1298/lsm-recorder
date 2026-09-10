"use client";

/**
 * TabsParametros — barra de pestañas CM · UB · OR · MV · RNM con la
 * descripción del parámetro activo. Explorar enseña: cada campo dice
 * qué es antes de pedir que se use.
 */

import { PARAMETROS, type ParametroId } from "@/lib/learn_labels";

export default function TabsParametros({
  activo,
  onChange,
}: {
  activo: ParametroId;
  onChange: (id: ParametroId) => void;
}) {
  const info = PARAMETROS.find((p) => p.id === activo)!;
  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Parámetros fonológicos"
        className="flex gap-1 overflow-x-auto border-b border-gray-200"
      >
        {PARAMETROS.map((p) => {
          const sel = p.id === activo;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={sel}
              aria-controls={`panel-${p.id}`}
              onClick={() => onChange(p.id)}
              className={`-mb-px flex shrink-0 flex-col items-start border-b-2 px-4 pb-2.5 pt-1 text-left transition-colors ${
                sel
                  ? "border-accent text-ink"
                  : "border-transparent text-gray-500 hover:text-ink"
              }`}
            >
              <span className="font-display text-lg font-bold leading-tight">
                {p.sigla}
              </span>
              <span className="text-xs">{p.nombre}</span>
            </button>
          );
        })}
      </div>
      <div
        id={`panel-${info.id}`}
        role="tabpanel"
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
      >
        <p className="max-w-3xl text-sm text-gray-700">{info.descripcion}</p>
        <p className="text-xs font-medium text-accent-deep">{info.observa}</p>
      </div>
    </div>
  );
}
