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
  full: "Cuerpo Completo",
  head: "Cabeza y Cara",
  trunk: "Tronco",
  arm: "Brazos",
  hand: "Manos",
};

export default function UBExplorer() {
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

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    UB_LOCATIONS.forEach((loc) => {
      counts[loc.region] = (counts[loc.region] || 0) + 1;
    });
    return counts;
  }, []);

  const displayLoc = hoveredLoc || selectedLoc;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-emerald-50 px-3 py-1.5">
          <span className="text-2xl font-bold text-emerald-600">80</span>
          <span className="ml-1.5 text-xs text-emerald-600/70">ubicaciones</span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-1.5">
          <span className="text-2xl font-bold text-gray-700">8</span>
          <span className="ml-1.5 text-xs text-gray-500">regiones corporales</span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-1.5">
          <span className="text-2xl font-bold text-gray-700">20</span>
          <span className="ml-1.5 text-xs text-gray-500">alta frecuencia</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        {/* Body diagram */}
        <div>
          {/* Zone selector */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(Object.keys(ZONE_LABELS) as BodyZone[]).map((z) => (
              <button
                key={z}
                onClick={() => { setZone(z); setSelectedLoc(null); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  zone === z
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {ZONE_LABELS[z]}
              </button>
            ))}
          </div>

          {/* SVG */}
          <div className="relative">
            <svg
              viewBox={VIEWBOX[zone]}
              className="w-full rounded-2xl border border-gray-200 bg-gradient-to-b from-slate-50 to-white"
              style={{ maxHeight: 420 }}
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
              <div className="absolute bottom-3 left-3 rounded-lg bg-gray-900/90 px-3 py-1.5 text-xs text-white shadow-lg">
                <span className="font-bold">{hoveredLoc.code}</span>
                {" "}
                {hoveredLoc.name}
                <span className="ml-1.5 opacity-60">({hoveredLoc.region})</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Region breakdown */}
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Regiones
            </p>
            <div className="space-y-1.5">
              {Object.entries(REGION_COLORS).map(([region, color]) => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                    selectedRegion === region ? "bg-white shadow" : "hover:bg-white/60"
                  }`}
                >
                  <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="flex-1 font-medium text-gray-700">
                    {REGION_LABELS[region] || region}
                  </span>
                  <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    {regionCounts[region] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected location detail */}
          {displayLoc && (
            <div
              className="rounded-xl border-2 p-3"
              style={{ borderColor: REGION_COLORS[displayLoc.region], backgroundColor: `${REGION_COLORS[displayLoc.region]}08` }}
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: REGION_COLORS[displayLoc.region] }} />
                <span className="text-sm font-bold text-gray-900">{displayLoc.code}</span>
                <span className="text-sm text-gray-600">{displayLoc.name}</span>
              </div>
              {displayLoc.latin && (
                <p className="mt-1 text-xs italic text-gray-400">Latín: {displayLoc.latin}</p>
              )}
              <div className="mt-2 flex gap-2">
                <span className="rounded bg-white/80 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                  {REGION_LABELS[displayLoc.region]}
                </span>
                {displayLoc.frequent && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    Alta Frecuencia
                  </span>
                )}
              </div>
              <div className="mt-2 text-[10px] text-gray-400">
                Coordenadas: ({displayLoc.x}, {displayLoc.y})
              </div>
            </div>
          )}

          {/* Notation guide */}
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-gray-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Notación Cruz Aldrete
            </p>
            <p className="text-[11px] leading-relaxed text-gray-500">
              Cada ubicación se codifica con una abreviatura de 2-4 letras derivada de su nombre anatómico en latín.
              Modificadores de prefijo: <b className="text-gray-700">Ipsi</b> (mismo lado de la mano dominante),
              <b className="text-gray-700"> X</b> (lado opuesto),
              <b className="text-gray-700"> Int</b> (interior),
              <b className="text-gray-700"> Ext</b> (exterior),
              <b className="text-gray-700"> Inf</b> (inferior).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
