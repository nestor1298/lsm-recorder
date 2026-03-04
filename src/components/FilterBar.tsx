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
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search by gloss, notation, or code..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Frequency Tiers */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Frequency Tier
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onTierChange(null)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedTier === null
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {[1, 2, 3, 4].map((tier) => (
            <button
              key={tier}
              onClick={() => onTierChange(selectedTier === tier ? null : tier)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedTier === tier
                  ? "bg-indigo-600 text-white"
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
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Finger Group
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onGroupChange(null)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedGroup === null
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {FINGER_GROUPS.map((group) => (
            <button
              key={group}
              onClick={() => onGroupChange(selectedGroup === group ? null : group)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedGroup === group
                  ? "bg-indigo-600 text-white"
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
        Showing <span className="font-medium text-gray-900">{filteredCount}</span> of{" "}
        {totalCount} handshapes
      </p>
    </div>
  );
}
