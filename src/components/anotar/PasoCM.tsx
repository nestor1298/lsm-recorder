"use client";

import { useMemo, useState } from "react";
import { CM_INVENTORY } from "@/lib/data";
import { CM_FAMILIES, getCMFamilyId } from "@/lib/families";
import { MiniHand } from "@/components/learn/MiniHand";
import type { CMEntry, NonDominantSpec } from "@/lib/types";
import type { CMCandidate } from "@/lib/vision/phon/phon_features";
import { RELATION_ES, PROVENANCE_CHIP } from "@/lib/anotar_labels";

/** Selector compacto de CM para la mano base (TAB primero) */
function SelectorCMBase({
  value,
  onChange,
}: {
  value?: number;
  onChange: (cm_id: number | undefined) => void;
}) {
  const ordered = useMemo(() => {
    // VALIDAR-LSM: tab_capable aproximado; la lingüista revisa la lista
    return [...CM_INVENTORY].sort(
      (a, b) => Number(b.tab_capable ?? false) - Number(a.tab_capable ?? false),
    );
  }, []);
  return (
    <div>
      <p className="mb-1 text-xs text-gray-500">
        ¿Qué forma tiene la mano base? La mano base suele usar pocas formas
        (aparecen primero).
      </p>
      <div className="grid max-h-48 grid-cols-5 gap-1.5 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 sm:grid-cols-7">
        {ordered.map((cm) => {
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
                  : cm.tab_capable
                    ? "border-gold-tint bg-white hover:border-gray-300"
                    : "border-transparent bg-white hover:border-gray-300"
              }`}
            >
              <MiniHand cm={cm} size={36} />
              <span className="text-[9px] font-bold text-gray-600">
                #{cm.cm_id}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Paso 2 — elegir la configuración de mano (CM).
 * Primero la familia visual (9 formas base), luego la CM exacta con
 * su miniatura. Mismo lenguaje visual que el Inventario.
 */

interface PasoCMProps {
  selectedCmId?: number;
  /** Candidatas del análisis automático del video */
  sugeridas?: CMCandidate[];
  nondominant?: NonDominantSpec;
  nondominantSuggested?: boolean;
  onSelect: (cm: CMEntry) => void;
  onNondominantChange: (nd: NonDominantSpec | undefined) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function PasoCM({
  selectedCmId,
  sugeridas,
  nondominant,
  nondominantSuggested,
  onSelect,
  onNondominantChange,
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

      {/* Sugerencias del análisis del video */}
      {sugeridas && sugeridas.length > 0 && (
        <div className="rounded-2xl border border-accent bg-accent-tint/30 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-deep">
            Sugerencias del video
          </p>
          <div className="flex flex-wrap gap-2">
            {sugeridas.map((cand) => {
              const cm = CM_INVENTORY.find((c) => c.cm_id === cand.cm_id);
              if (!cm) return null;
              const isSelected = cm.cm_id === selectedCmId;
              return (
                <button
                  key={cm.cm_id}
                  onClick={() => {
                    onSelect(cm);
                    setFamilyId(getCMFamilyId(cm));
                  }}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 transition-colors ${
                    isSelected
                      ? "border-accent bg-accent-tint"
                      : "border-transparent bg-paper hover:border-gray-300"
                  }`}
                >
                  <MiniHand cm={cm} size={44} />
                  <span className="text-left">
                    <span className="block text-xs font-bold text-ink">
                      #{cm.cm_id} · {cm.cruz_aldrete_notation}
                    </span>
                    <span className="block text-[10px] text-gray-500">
                      {Math.round(cand.score * 100)}% de coincidencia
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Bimanualidad (tipología de Cruz Aldrete) */}
      {selectedCM && (
        <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            ¿Usa las dos manos?
            {nondominantSuggested && nondominant && (
              <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-semibold text-accent-deep">
                {PROVENANCE_CHIP}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onNondominantChange(undefined)}
              aria-pressed={!nondominant}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                !nondominant
                  ? "bg-ink text-paper"
                  : "bg-white text-gray-600 hover:bg-gray-200"
              }`}
            >
              No, una mano
            </button>
            {(
              ["SIMETRICA", "ALTERNADA", "BASE_PASIVA"] as const
            ).map((rel) => (
              <button
                key={rel}
                onClick={() =>
                  onNondominantChange(
                    nondominant?.relation === rel
                      ? undefined
                      : { ...nondominant, relation: rel },
                  )
                }
                aria-pressed={nondominant?.relation === rel}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  nondominant?.relation === rel
                    ? "bg-ink text-paper"
                    : "bg-white text-gray-600 hover:bg-gray-200"
                }`}
              >
                {RELATION_ES[rel]}
              </button>
            ))}
          </div>
          {nondominant?.relation === "BASE_PASIVA" && (
            <SelectorCMBase
              value={nondominant.cm_id}
              onChange={(cm_id) =>
                onNondominantChange({ ...nondominant, cm_id })
              }
            />
          )}
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
