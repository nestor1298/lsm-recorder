"use client";

import { useState, useMemo } from "react";
import { CM_INVENTORY } from "@/lib/data";
import { getCMFamilyId } from "@/lib/families";
import SignCard from "@/components/SignCard";
import FilterBar from "@/components/FilterBar";

export default function InventarioPage() {
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const familyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cm of CM_INVENTORY) {
      const id = getCMFamilyId(cm);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, []);

  const filtered = useMemo(() => {
    return CM_INVENTORY.filter((cm) => {
      if (selectedTier !== null && cm.frequency_tier !== selectedTier)
        return false;
      if (selectedFamily !== null && getCMFamilyId(cm) !== selectedFamily)
        return false;
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
  }, [selectedTier, selectedFamily, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          Inventario de configuraciones de mano
        </h1>
        <p className="text-sm text-gray-500">
          Las 101 configuraciones de Cruz Aldrete, de la Gram&aacute;tica de la
          LSM (2008)
        </p>
      </div>

      {/* Guía express: qué es una CM y cómo leer las miniaturas */}
      <details className="rounded-2xl border border-gray-200 bg-gray-50 open:bg-paper">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
          ¿Cómo leer este inventario?
        </summary>
        <div className="space-y-3 px-4 pb-4 text-sm text-gray-700">
          <p>
            Una configuración de mano (CM) es la forma que toma la mano al
            hacer una seña. Para no perderte entre las 101, están agrupadas en
            9 familias con nombres sencillos — la notación de Cruz Aldrete
            sigue visible en cada tarjeta para quien la necesita.
          </p>
          <p className="flex flex-wrap items-center gap-3">
            En cada miniatura, el color de los dedos indica su flexión:
            <span className="inline-flex items-center gap-1">
              <i className="h-3 w-3 rounded-full bg-[#22c55e]" /> extendido
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="h-3 w-3 rounded-full bg-[#eab308]" /> curvado
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="h-3 w-3 rounded-full bg-[#f97316]" /> doblado
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="h-3 w-3 rounded-full bg-[#ef4444]" /> cerrado
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="h-3 w-3 rounded-full bg-gray-300" /> inactivo
            </span>
          </p>
        </div>
      </details>

      <FilterBar
        selectedTier={selectedTier}
        selectedFamily={selectedFamily}
        searchQuery={searchQuery}
        onTierChange={setSelectedTier}
        onFamilyChange={setSelectedFamily}
        onSearchChange={setSearchQuery}
        totalCount={CM_INVENTORY.length}
        filteredCount={filtered.length}
        familyCounts={familyCounts}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((cm) => (
          <SignCard key={cm.cm_id} cm={cm} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          Ninguna configuración coincide con tus filtros. Ajusta los criterios.
        </div>
      )}
    </div>
  );
}
