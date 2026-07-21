"use client";

import { FINGER_GROUPS, TIER_LABELS } from "@/lib/data";
import type { FingerGroup } from "@/lib/types";

interface FilterBarProps {
  selectedTier: number | null;
  selectedGroup: FingerGroup | null;
  searchQuery: string;
  onTierChange: (tier: number | null) => void;
  onGroupChange: (group: FingerGroup | null) => void;
  onSearchChange: (query: string) => void;
  totalCount: number;
  filteredCount: number;
}

export default function FilterBar({
  selectedTier,
  selectedGroup,
  searchQuery,
  onTierChange,
  onGroupChange,
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

      {/* Finger Groups */}
      <div>
        <p className="mb-2 text-xs font-medium overline-label text-gray-500">
          Grupo de dedos
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onGroupChange(null)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedGroup === null
                ? "bg-ink text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Todas
          </button>
          {FINGER_GROUPS.map((group) => (
            <button
              key={group}
              onClick={() =>
                onGroupChange(selectedGroup === group ? null : group)
              }
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedGroup === group
                  ? "bg-ink text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {group.split(":")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-gray-500">
        Mostrando <span className="font-medium text-ink">{filteredCount}</span> de{" "}
        {totalCount} configuraciones
      </p>
    </div>
  );
}
