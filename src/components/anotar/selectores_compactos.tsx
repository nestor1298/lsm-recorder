"use client";

/**
 * Selectores compactos de UB y CM para capturar los extremos D-M-D en el
 * Resumen sin repetir los pasos completos.
 */

import { useMemo } from "react";
import { CM_INVENTORY } from "@/lib/data";
import {
  FREQUENT_LOCATIONS,
  UB_LOCATIONS,
  REGION_COLORS,
} from "@/lib/ub_inventory";
import { MiniHand } from "@/components/learn/MiniHand";

export function SelectorUBCompacto({
  value,
  onChange,
}: {
  value?: string;
  onChange: (code: string | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {FREQUENT_LOCATIONS.map((loc) => {
          const isSelected = value === loc.code;
          return (
            <button
              key={loc.code}
              onClick={() => onChange(isSelected ? undefined : loc.code)}
              aria-pressed={isSelected}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isSelected ? "text-white" : "text-gray-700 hover:text-ink"
              }`}
              style={{
                backgroundColor: isSelected
                  ? REGION_COLORS[loc.region]
                  : `${REGION_COLORS[loc.region]}18`,
              }}
            >
              {loc.name}
            </button>
          );
        })}
      </div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        aria-label="Todos los puntos de ubicación"
        className="w-full rounded-lg border border-gray-200 bg-paper px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
      >
        <option value="">Todos los puntos…</option>
        {UB_LOCATIONS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name} ({l.code})
          </option>
        ))}
      </select>
    </div>
  );
}

export function SelectorCMCompacto({
  value,
  onChange,
}: {
  value?: number;
  onChange: (cm_id: number | undefined) => void;
}) {
  const cms = useMemo(() => CM_INVENTORY, []);
  return (
    <div className="grid max-h-44 grid-cols-6 gap-1.5 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 sm:grid-cols-8">
      {cms.map((cm) => {
        const isSelected = cm.cm_id === value;
        return (
          <button
            key={cm.cm_id}
            onClick={() => onChange(isSelected ? undefined : cm.cm_id)}
            aria-pressed={isSelected}
            title={`CM #${cm.cm_id} · ${cm.cruz_aldrete_notation}`}
            className={`flex flex-col items-center rounded-lg border-2 p-1 transition-colors ${
              isSelected
                ? "border-accent bg-accent-tint"
                : "border-transparent bg-white hover:border-gray-300"
            }`}
          >
            <MiniHand cm={cm} size={32} />
            <span className="text-[9px] font-bold text-gray-600">
              #{cm.cm_id}
            </span>
          </button>
        );
      })}
    </div>
  );
}
