"use client";

import { useState, useMemo } from "react";
import { CM_INVENTORY, getFingerGroup } from "@/lib/data";
import type { FingerGroup } from "@/lib/types";
import SignCard from "@/components/SignCard";
import FilterBar from "@/components/FilterBar";

export default function CatalogPage() {
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<FingerGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return CM_INVENTORY.filter((cm) => {
      if (selectedTier !== null && cm.frequency_tier !== selectedTier) return false;
      if (selectedGroup !== null && getFingerGroup(cm) !== selectedGroup) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          cm.example_sign.toLowerCase().includes(q) ||
          cm.cruz_aldrete_notation.toLowerCase().includes(q) ||
          (cm.alpha_code?.toLowerCase().includes(q) ?? false) ||
          cm.cm_id.toString() === q;
        if (!matches) return false;
      }
      return true;
    });
  }, [selectedTier, selectedGroup, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          CM Handshape Catalog
        </h1>
        <p className="text-sm text-gray-500">
          101 Cruz Aldrete configurations from Gram&aacute;tica de la LSM (2008)
        </p>
      </div>

      <FilterBar
        selectedTier={selectedTier}
        selectedGroup={selectedGroup}
        searchQuery={searchQuery}
        onTierChange={setSelectedTier}
        onGroupChange={setSelectedGroup}
        onSearchChange={setSearchQuery}
        totalCount={CM_INVENTORY.length}
        filteredCount={filtered.length}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((cm) => (
          <SignCard key={cm.cm_id} cm={cm} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No handshapes match your filters. Try adjusting the criteria.
        </div>
      )}
    </div>
  );
}
