"use client";

import { TIER_LABELS } from "@/lib/data";
import { CM_FAMILIES } from "@/lib/families";

interface FilterBarProps {
  selectedTier: number | null;
  selectedFamily: string | null;
  searchQuery: string;
  onTierChange: (tier: number | null) => void;
  onFamilyChange: (family: string | null) => void;
  familyCounts: Record<string, number>;
  onSearchChange: (query: string) => void;
  totalCount: number;
  filteredCount: number;
}

export default function FilterBar({
  selectedTier,
  selectedFamily,
  searchQuery,
  onTierChange,
  onFamilyChange,
  familyCounts,
  onSearchChange,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-paper p-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Busca por glosa, notación o código..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-accent"
        />
      </div>

      {/* Frequency Tiers */}
      <div>
        <p className="mb-2 text-xs font-medium overline-label text-gray-500">
          Nivel de frecuencia
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onTierChange(null)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedTier === null
                ? "bg-ink text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Todas
          </button>
          {[1, 2, 3, 4].map((tier) => (
            <button
              key={tier}
              onClick={() => onTierChange(selectedTier === tier ? null : tier)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedTier === tier
                  ? "bg-ink text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              T{tier}: {TIER_LABELS[tier]}
            </button>
          ))}
        </div>
      </div>

      {/* Familias */}
      <div>
        <p className="mb-2 overline-label text-gray-500">Familia de la mano</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onFamilyChange(null)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedFamily === null
                ? "bg-ink text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Todas
          </button>
          {CM_FAMILIES.map((fam) => (
            <button
              key={fam.id}
              onClick={() =>
                onFamilyChange(selectedFamily === fam.id ? null : fam.id)
              }
              title={fam.description}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedFamily === fam.id
                  ? "bg-ink text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {fam.label} ({familyCounts[fam.id] ?? 0})
            </button>
          ))}
        </div>
        {selectedFamily && (
          <p className="mt-2 text-xs text-gray-500">
            {CM_FAMILIES.find((f) => f.id === selectedFamily)?.description}
          </p>
        )}
      </div>

      {/* Count */}
      <p className="text-sm text-gray-500">
        Mostrando <span className="font-medium text-ink">{filteredCount}</span> de{" "}
        {totalCount} configuraciones
      </p>
    </div>
  );
}
