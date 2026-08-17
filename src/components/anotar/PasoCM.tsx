"use client";

import { useMemo, useState } from "react";
import { CM_INVENTORY } from "@/lib/data";
import { CM_FAMILIES, getCMFamilyId } from "@/lib/families";
import { MiniHand } from "@/components/learn/MiniHand";
import type { CMEntry } from "@/lib/types";

/**
 * Paso 2 — elegir la configuración de mano (CM).
 * Primero la familia visual (9 formas base), luego la CM exacta con
 * su miniatura. Mismo lenguaje visual que el Inventario.
 */

interface PasoCMProps {
  selectedCmId?: number;
  onSelect: (cm: CMEntry) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function PasoCM({
  selectedCmId,
  onSelect,
  onNext,
  onBack,
}: PasoCMProps) {
  const selectedCM = useMemo(
    () => CM_INVENTORY.find((c) => c.cm_id === selectedCmId) ?? null,
    [selectedCmId],
  );
  const [familyId, setFamilyId] = useState<string | null>(
    selectedCM ? getCMFamilyId(selectedCM) : null,
  );

  const byFamily = useMemo(() => {
    const map = new Map<string, CMEntry[]>();
    for (const cm of CM_INVENTORY) {
      const id = getCMFamilyId(cm);
      map.set(id, [...(map.get(id) ?? []), cm]);
    }
    return map;
  }, []);

  const familyCMs = familyId ? (byFamily.get(familyId) ?? []) : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">
          ¿Cómo está la mano en el video?
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {familyId
            ? "Ahora elige la forma exacta."
            : "Primero elige la forma general."}
        </p>
      </div>

      {/* Nivel 1: familias */}
      {!familyId && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CM_FAMILIES.map((fam) => {
            const cms = byFamily.get(fam.id) ?? [];
            const sample = cms[0];
            return (
              <button
                key={fam.id}
                onClick={() => setFamilyId(fam.id)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-paper p-4 transition-colors hover:border-accent"
              >
                {sample && <MiniHand cm={sample} size={72} />}
                <span className="text-sm font-bold text-ink">{fam.label}</span>
                <span className="text-center text-xs leading-snug text-gray-500">
                  {fam.description}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                  {cms.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Nivel 2: CMs de la familia */}
      {familyId && (
        <div className="space-y-3">
          <button
            onClick={() => setFamilyId(null)}
            className="flex items-center gap-1.5 text-sm font-semibold text-accent-deep hover:underline"
          >
            <span aria-hidden>←</span> Todas las formas
          </button>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {familyCMs.map((cm) => {
              const isSelected = cm.cm_id === selectedCmId;
              return (
                <button
                  key={cm.cm_id}
                  onClick={() => onSelect(cm)}
                  aria-pressed={isSelected}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 transition-colors ${
                    isSelected
                      ? "border-accent bg-accent-tint"
                      : "border-gray-200 bg-paper hover:border-gray-300"
                  }`}
                >
                  <MiniHand cm={cm} size={64} />
                  <span className="text-xs font-bold text-ink">
                    #{cm.cm_id}
                  </span>
                  <span className="max-w-full truncate text-[10px] text-gray-500">
                    {cm.example_sign}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selección actual */}
      {selectedCM && (
        <div className="flex items-center gap-4 rounded-xl border border-green bg-green-tint/40 p-3">
          <MiniHand cm={selectedCM} size={56} />
          <div>
            <p className="text-sm font-bold text-ink">
              CM #{selectedCM.cm_id} · {selectedCM.cruz_aldrete_notation}
            </p>
            <p className="text-xs text-gray-600">
              Como en la seña {selectedCM.example_sign}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between border-t border-gray-100 pt-4">
        <button
          onClick={onBack}
          className="rounded-full px-6 py-3 font-semibold text-gray-600 hover:bg-gray-50"
        >
          Atrás
        </button>
        <button
          onClick={onNext}
          disabled={!selectedCM}
          className="rounded-full bg-ink px-8 py-3 font-semibold text-paper transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
