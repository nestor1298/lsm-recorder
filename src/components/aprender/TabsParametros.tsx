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
    <div className="space-y-2">
      <div
        role="tablist"
        aria-label="Parámetros fonológicos"
        className="grid grid-cols-5 border-b border-gray-200"
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
              className={`-mb-px flex min-w-0 flex-col items-start border-b-2 px-2 pb-2 pt-1 text-left transition-colors sm:px-3 ${
                sel
                  ? "border-accent text-ink"
                  : "border-transparent text-gray-500 hover:text-ink"
              }`}
            >
              <span className="font-display text-lg font-bold leading-tight">
                {p.sigla}
              </span>
              <span className="text-[11px] leading-tight sm:text-xs">{p.nombre}</span>
            </button>
          );
        })}
      </div>
      <div
        id={`panel-${info.id}`}
        role="tabpanel"
        className="space-y-0.5"
      >
        <p className="max-w-3xl text-sm text-gray-700">{info.descripcion}</p>
        <p className="text-xs font-medium text-accent-deep">{info.observa}</p>
      </div>
    </div>
  );
}
