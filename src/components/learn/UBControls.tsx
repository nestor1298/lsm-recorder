"use client";

import { useState, useMemo, useEffect } from "react";
import {
  UB_LOCATIONS,
  FREQUENT_LOCATIONS,
  REGION_COLORS,
  REGION_LABELS,
  LOCATIONS_BY_REGION,
  type UBLocation,
} from "@/lib/ub_inventory";

interface UBControlsProps {
  onLocationChange?: (loc: UBLocation | null) => void;
  /** Pre-select a location (used by sign builder) */
  defaultLocation?: UBLocation | null;
  /** Filter 3D spheres by region */
  onRegionFilter?: (region: string | null) => void;
  className?: string;
}

export default function UBControls({
  onLocationChange,
  defaultLocation,
  onRegionFilter,
  className = "",
}: UBControlsProps) {
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedLoc, setSelectedLoc] = useState<UBLocation | null>(
    defaultLocation ?? null,
  );

  // Filter locations by search + region
  const filteredLocations = useMemo(() => {
    let locs = UB_LOCATIONS;
    if (selectedRegion) {
      locs = locs.filter((loc) => loc.region === selectedRegion);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      locs = locs.filter(
        (loc) =>
          loc.code.toLowerCase().includes(q) ||
          loc.name.toLowerCase().includes(q) ||
          (loc.latin && loc.latin.toLowerCase().includes(q)),
      );
    }
    return locs;
  }, [search, selectedRegion]);

  // Propagate location state to parent
  useEffect(() => {
    onLocationChange?.(selectedLoc);
  }, [selectedLoc, onLocationChange]);

  // Propagate region filter to parent (for 3D sphere filtering)
  useEffect(() => {
    onRegionFilter?.(selectedRegion);
  }, [selectedRegion, onRegionFilter]);

  // Select from 3D click (external update)
  useEffect(() => {
    if (defaultLocation) {
      setSelectedLoc(defaultLocation);
    }
  }, [defaultLocation]);

  const handleRegionClick = (region: string) => {
    const newRegion = selectedRegion === region ? null : region;
    setSelectedRegion(newRegion);
  };

  const handleLocClick = (loc: UBLocation) => {
    setSelectedLoc(selectedLoc?.code === loc.code ? null : loc);
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Search input */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar punto UB..."
          className="w-full rounded-lg border border-black/10 bg-white/50 py-1.5 pl-8 pr-3 text-[11px] text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
        />
      </div>

      {/* Region filter chips */}
      <div className="flex flex-wrap gap-1">
        {Object.entries(REGION_COLORS).map(([region, color]) => {
          const count = (LOCATIONS_BY_REGION[region] || []).length;
          return (
            <button
              key={region}
              onClick={() => handleRegionClick(region)}
              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                selectedRegion === region
                  ? "bg-white shadow ring-1 ring-gray-200"
                  : "hover:bg-gray-100"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {REGION_LABELS[region] || region}
              <span className="text-gray-400">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Frequent quick-select */}
      {!search && !selectedRegion && (
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">
            Alta frecuencia
          </p>
          <div className="flex flex-wrap gap-1">
            {FREQUENT_LOCATIONS.map((loc) => {
              const isActive = selectedLoc?.code === loc.code;
              const color = REGION_COLORS[loc.region];
              return (
                <button
                  key={loc.code}
                  onClick={() => handleLocClick(loc)}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                    isActive
                      ? "text-white shadow-sm"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                  style={
                    isActive ? { backgroundColor: color } : { borderLeft: `2px solid ${color}40` }
                  }
                >
                  {loc.code}
                  <span className={`ml-0.5 text-[8px] ${isActive ? "text-white/70" : "text-gray-400"}`}>
                    {loc.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Location list grouped by region */}
      <div className="max-h-[30vh] space-y-2 overflow-y-auto rounded-lg border border-black/5 bg-white/30 p-2">
        {filteredLocations.length === 0 ? (
          <p className="py-4 text-center text-[10px] text-gray-400">
            No se encontraron puntos UB
          </p>
        ) : (
          (() => {
            // Group filtered by region
            const grouped: Record<string, typeof filteredLocations> = {};
            for (const loc of filteredLocations) {
              if (!grouped[loc.region]) grouped[loc.region] = [];
              grouped[loc.region].push(loc);
            }
            return Object.entries(grouped).map(([region, locs]) => (
              <div key={region}>
                <div className="mb-0.5 flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: REGION_COLORS[region] }}
                  />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-gray-400">
                    {REGION_LABELS[region] || region} ({locs.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {locs.map((loc) => {
                    const isActive = selectedLoc?.code === loc.code;
                    const color = REGION_COLORS[loc.region];
                    return (
                      <button
                        key={loc.code}
                        onClick={() => handleLocClick(loc)}
                        className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-all ${
                          isActive
                            ? "text-white shadow-sm"
                            : "bg-gray-50/50 text-gray-600 hover:bg-gray-100"
                        }`}
                        style={isActive ? { backgroundColor: color } : {}}
                        title={`${loc.code} — ${loc.name}${loc.latin ? ` (${loc.latin})` : ""}`}
                      >
                        {loc.code}
                      </button>
                    );
                  })}
                </div>
              </div>
            ));
          })()
        )}
      </div>

      {/* Selected location detail */}
      {selectedLoc && (
        <div
          className="rounded-xl border-2 p-3"
          style={{
            borderColor: REGION_COLORS[selectedLoc.region],
            backgroundColor: `${REGION_COLORS[selectedLoc.region]}08`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">
              {selectedLoc.code}
            </span>
            <span className="text-sm text-gray-600">{selectedLoc.name}</span>
            {selectedLoc.frequent && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                Alta Freq.
              </span>
            )}
          </div>
          {selectedLoc.latin && (
            <p className="mt-0.5 text-[10px] italic text-gray-400">
              Lat&iacute;n: {selectedLoc.latin}
            </p>
          )}
          <p className="mt-1 text-[9px] text-gray-500">
            Regi&oacute;n:{" "}
            <span
              className="font-bold"
              style={{ color: REGION_COLORS[selectedLoc.region] }}
            >
              {REGION_LABELS[selectedLoc.region]}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
