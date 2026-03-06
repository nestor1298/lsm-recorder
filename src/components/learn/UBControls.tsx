"use client";

import { useState, useMemo } from "react";
import {
  UB_LOCATIONS,
  REGION_COLORS,
  REGION_LABELS,
  type UBLocation,
} from "@/lib/ub_inventory";

type BodyZone = "full" | "head" | "trunk" | "arm" | "hand";

const VIEWBOX: Record<BodyZone, string> = {
  full: "0 0 200 280",
  head: "60 5 80 80",
  trunk: "50 80 100 110",
  arm: "20 85 80 130",
  hand: "15 185 55 60",
};

const ZONE_REGIONS: Record<BodyZone, string[]> = {
  full: ["HEAD", "FACE", "NECK", "TRUNK", "ARM", "FOREARM", "HAND"],
  head: ["HEAD", "FACE", "NECK"],
  trunk: ["TRUNK", "NECK"],
  arm: ["ARM", "FOREARM"],
  hand: ["HAND"],
};

const ZONE_LABELS: Record<BodyZone, string> = {
  full: "Completo",
  head: "Cabeza",
  trunk: "Tronco",
  arm: "Brazos",
  hand: "Manos",
};

interface UBControlsProps {
  className?: string;
}

export default function UBControls({ className = "" }: UBControlsProps) {
  const [zone, setZone] = useState<BodyZone>("full");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoveredLoc, setHoveredLoc] = useState<UBLocation | null>(null);
  const [selectedLoc, setSelectedLoc] = useState<UBLocation | null>(null);

  const visibleLocations = useMemo(() => {
    const regions = ZONE_REGIONS[zone];
    let locs = UB_LOCATIONS.filter((loc) => regions.includes(loc.region));
    if (selectedRegion) locs = locs.filter((l) => l.region === selectedRegion);
    return locs;
  }, [zone, selectedRegion]);

  const displayLoc = hoveredLoc || selectedLoc;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Zone selector */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(ZONE_LABELS) as BodyZone[]).map((z) => (
          <button
            key={z}
            onClick={() => { setZone(z); setSelectedLoc(null); }}
            className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
              zone === z
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {ZONE_LABELS[z]}
          </button>
        ))}
      </div>

      {/* SVG body diagram */}
      <div className="relative">
        <svg
          viewBox={VIEWBOX[zone]}
          className="w-full rounded-xl border border-gray-200 bg-gradient-to-b from-slate-50 to-white"
          style={{ maxHeight: 300 }}
        >
          {/* Body outline */}
          <g opacity={0.12} fill="none" stroke="#374151" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx={100} cy={38} rx={22} ry={28} fill="#d1d5db" stroke="#9ca3af" />
            <rect x={92} y={65} width={16} height={18} rx={4} fill="#d1d5db" stroke="#9ca3af" />
            <path d="M68,88 Q66,86 68,84 L132,84 Q134,86 132,88 L138,165 Q138,180 120,182 L80,182 Q62,180 62,165 Z" fill="#d1d5db" stroke="#9ca3af" />
            <path d="M68,88 Q55,92 50,110 L44,150 Q40,165 38,190 L32,215 Q28,230 30,235" stroke="#9ca3af" strokeWidth={12} fill="none" opacity={0.4} />
            <path d="M132,88 Q145,92 150,110 L156,150 Q160,165 162,190 L168,215 Q172,230 170,235" stroke="#9ca3af" strokeWidth={12} fill="none" opacity={0.4} />
            <path d="M90,182 L85,240 Q82,260 80,275" stroke="#9ca3af" strokeWidth={14} fill="none" opacity={0.3} />
            <path d="M110,182 L115,240 Q118,260 120,275" stroke="#9ca3af" strokeWidth={14} fill="none" opacity={0.3} />
          </g>

          {/* Location points */}
          {visibleLocations.map((loc) => {
            const isSelected = selectedLoc?.code === loc.code;
            const isHovered = hoveredLoc?.code === loc.code;
            const color = REGION_COLORS[loc.region];
            const r = zone === "full" ? 3 : 5;

            return (
              <g key={loc.code}>
                {isSelected && (
                  <circle cx={loc.x} cy={loc.y} r={r + 4} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5}>
                    <animate attributeName="r" values={`${r + 3};${r + 6};${r + 3}`} dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  cx={loc.x}
                  cy={loc.y}
                  r={isSelected ? r + 1 : isHovered ? r + 0.5 : r}
                  fill={isSelected ? color : isHovered ? color : `${color}60`}
                  stroke={isSelected ? "white" : color}
                  strokeWidth={isSelected ? 1.5 : 0.8}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredLoc(loc)}
                  onMouseLeave={() => setHoveredLoc(null)}
                  onClick={() => setSelectedLoc(isSelected ? null : loc)}
                />
                {zone !== "full" && (isSelected || isHovered) && (
                  <text
                    x={loc.x + r + 3}
                    y={loc.y + 1}
                    fontSize={zone === "hand" ? 3.5 : 5}
                    fill={color}
                    fontWeight={isSelected ? "bold" : "normal"}
                    dominantBaseline="middle"
                  >
                    {loc.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hoveredLoc && zone === "full" && (
          <div className="absolute bottom-2 left-2 rounded-lg bg-gray-900/90 px-2 py-1 text-[10px] text-white shadow-lg">
            <span className="font-bold">{hoveredLoc.code}</span> {hoveredLoc.name}
            <span className="ml-1 opacity-60">({hoveredLoc.region})</span>
          </div>
        )}
      </div>

      {/* Region filter buttons */}
      <div className="flex flex-wrap gap-1">
        {Object.entries(REGION_COLORS).map(([region, color]) => (
          <button
            key={region}
            onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
              selectedRegion === region ? "bg-white shadow ring-1 ring-gray-200" : "hover:bg-gray-100"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {REGION_LABELS[region] || region}
          </button>
        ))}
      </div>

      {/* Selected location detail */}
      {displayLoc && (
        <div
          className="rounded-xl border-2 p-3"
          style={{ borderColor: REGION_COLORS[displayLoc.region], backgroundColor: `${REGION_COLORS[displayLoc.region]}08` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">{displayLoc.code}</span>
            <span className="text-sm text-gray-600">{displayLoc.name}</span>
            {displayLoc.frequent && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                Alta Freq.
              </span>
            )}
          </div>
          {displayLoc.latin && (
            <p className="mt-0.5 text-[10px] italic text-gray-400">Latín: {displayLoc.latin}</p>
          )}
        </div>
      )}
    </div>
  );
}
