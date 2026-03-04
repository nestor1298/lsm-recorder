"use client";

import { useState, useMemo } from "react";
import {
  UB_LOCATIONS,
  FREQUENT_LOCATIONS,
  REGION_COLORS,
  REGION_LABELS,
  type UBLocation,
  type BodyZone,
} from "@/lib/ub_inventory";
import type { ContactType, Laterality } from "@/lib/types";

interface BodySilhouetteProps {
  selectedCode: string | undefined;
  contact: ContactType | undefined;
  laterality: Laterality | undefined;
  onSelect: (code: string | undefined) => void;
  onContactChange: (contact: ContactType | undefined) => void;
  onLateralityChange: (laterality: Laterality | undefined) => void;
}

const CONTACT_TYPES: ContactType[] = ["TOUCHING", "GRASPED", "NEAR", "MEDIAL", "DISTANT", "BRUSHING"];
const LATERALITIES: Laterality[] = ["IPSILATERAL", "CONTRALATERAL", "MIDLINE"];

// Viewbox settings for each zoom level
const VIEWBOX: Record<BodyZone, string> = {
  full: "0 0 200 280",
  head: "60 5 80 80",
  trunk: "50 80 100 110",
  arm: "20 85 80 130",
  hand: "15 185 55 60",
};

const ZONE_REGIONS: Record<BodyZone, string[]> = {
  full: ["HEAD", "FACE", "NECK", "TRUNK", "ARM", "FOREARM", "HAND", "NEUTRAL_SPACE"],
  head: ["HEAD", "FACE", "NECK"],
  trunk: ["TRUNK", "NECK"],
  arm: ["ARM", "FOREARM"],
  hand: ["HAND"],
};

export default function BodySilhouette({
  selectedCode,
  contact,
  laterality,
  onSelect,
  onContactChange,
  onLateralityChange,
}: BodySilhouetteProps) {
  const [zone, setZone] = useState<BodyZone>("full");
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [showFrequent, setShowFrequent] = useState(false);

  const selectedLocation = useMemo(
    () => UB_LOCATIONS.find((loc) => loc.code === selectedCode) ?? null,
    [selectedCode]
  );

  const visibleLocations = useMemo(() => {
    const regions = ZONE_REGIONS[zone];
    const locs = UB_LOCATIONS.filter((loc) => regions.includes(loc.region));
    if (showFrequent) return locs.filter((loc) => loc.frequent);
    return locs;
  }, [zone, showFrequent]);

  const hoveredLocation = useMemo(
    () => (hoveredCode ? UB_LOCATIONS.find((l) => l.code === hoveredCode) : null),
    [hoveredCode]
  );

  return (
    <div className="space-y-3">
      {/* Zone selector */}
      <div className="flex items-center gap-1.5">
        {(["full", "head", "trunk", "arm", "hand"] as BodyZone[]).map((z) => (
          <button
            key={z}
            onClick={() => setZone(z)}
            className={`rounded px-2 py-1 text-[10px] font-medium capitalize ${
              zone === z
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {z === "full" ? "Body" : z}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowFrequent(!showFrequent)}
          className={`rounded px-2 py-1 text-[10px] font-medium ${
            showFrequent
              ? "bg-amber-100 text-amber-700"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          Top 20
        </button>
      </div>

      {/* SVG Body */}
      <div className="relative">
        <svg
          viewBox={VIEWBOX[zone]}
          className="w-full rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white"
          style={{ maxHeight: 360 }}
        >
          {/* Body outline */}
          <BodyOutline />

          {/* Location points */}
          {visibleLocations.map((loc) => {
            const isSelected = loc.code === selectedCode;
            const isHovered = loc.code === hoveredCode;
            const color = REGION_COLORS[loc.region];
            const r = zone === "full" ? 3 : 5;

            return (
              <g key={loc.code}>
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={loc.x}
                    cy={loc.y}
                    r={r + 4}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    opacity={0.5}
                  >
                    <animate
                      attributeName="r"
                      values={`${r + 3};${r + 6};${r + 3}`}
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {/* Point */}
                <circle
                  cx={loc.x}
                  cy={loc.y}
                  r={isSelected ? r + 1 : isHovered ? r + 0.5 : r}
                  fill={isSelected ? color : isHovered ? color : `${color}60`}
                  stroke={isSelected ? "white" : color}
                  strokeWidth={isSelected ? 1.5 : 0.8}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredCode(loc.code)}
                  onMouseLeave={() => setHoveredCode(null)}
                  onClick={() => onSelect(isSelected ? undefined : loc.code)}
                />
                {/* Label (zoomed views only) */}
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

        {/* Hover tooltip (full view) */}
        {hoveredLocation && zone === "full" && (
          <div className="absolute bottom-2 left-2 rounded bg-gray-900/90 px-2 py-1 text-[10px] text-white">
            <span className="font-semibold">{hoveredLocation.code}</span>{" "}
            {hoveredLocation.name}
            <span className="ml-1 opacity-60">({hoveredLocation.region})</span>
          </div>
        )}
      </div>

      {/* Selected location info */}
      {selectedLocation && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2.5">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: REGION_COLORS[selectedLocation.region] }}
            />
            <span className="text-xs font-semibold text-gray-900">
              {selectedLocation.code} — {selectedLocation.name}
            </span>
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[9px] text-gray-600">
              {REGION_LABELS[selectedLocation.region]}
            </span>
            {selectedLocation.latin && (
              <span className="text-[9px] italic text-gray-400">{selectedLocation.latin}</span>
            )}
          </div>
        </div>
      )}

      {/* Contact type */}
      <div>
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Contact
        </label>
        <div className="flex flex-wrap gap-1">
          {CONTACT_TYPES.map((ct) => (
            <button
              key={ct}
              onClick={() => onContactChange(contact === ct ? undefined : ct)}
              className={`rounded px-2 py-1 text-[10px] font-medium ${
                contact === ct
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {ct.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Laterality */}
      <div>
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Laterality
        </label>
        <div className="flex gap-1">
          {LATERALITIES.map((lat) => (
            <button
              key={lat}
              onClick={() => onLateralityChange(laterality === lat ? undefined : lat)}
              className={`rounded px-2 py-1 text-[10px] font-medium ${
                laterality === lat
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {lat.toLowerCase().replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Quick select (frequent) */}
      <div>
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Quick Select
        </label>
        <div className="flex flex-wrap gap-1">
          {FREQUENT_LOCATIONS.map((loc) => (
            <button
              key={loc.code}
              onClick={() => onSelect(selectedCode === loc.code ? undefined : loc.code)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                selectedCode === loc.code
                  ? "text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              style={{
                backgroundColor:
                  selectedCode === loc.code
                    ? REGION_COLORS[loc.region]
                    : `${REGION_COLORS[loc.region]}15`,
              }}
              title={`${loc.code}: ${loc.name}`}
            >
              {loc.code}
            </button>
          ))}
        </div>
      </div>

      {/* Region legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(REGION_COLORS).map(([region, color]) => (
          <div key={region} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-gray-500">{region.toLowerCase().replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** SVG body silhouette outline */
function BodyOutline() {
  return (
    <g opacity={0.15} fill="none" stroke="#374151" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {/* Head */}
      <ellipse cx={100} cy={38} rx={22} ry={28} fill="#d1d5db" stroke="#9ca3af" />
      {/* Neck */}
      <rect x={92} y={65} width={16} height={18} rx={4} fill="#d1d5db" stroke="#9ca3af" />
      {/* Torso */}
      <path
        d="M68,88 Q66,86 68,84 L132,84 Q134,86 132,88 L138,165 Q138,180 120,182 L80,182 Q62,180 62,165 Z"
        fill="#d1d5db"
        stroke="#9ca3af"
      />
      {/* Left arm (dominant) */}
      <path
        d="M68,88 Q55,92 50,110 L44,150 Q40,165 38,190 L32,215 Q28,230 30,235"
        stroke="#9ca3af"
        strokeWidth={12}
        fill="none"
        opacity={0.4}
      />
      {/* Right arm */}
      <path
        d="M132,88 Q145,92 150,110 L156,150 Q160,165 162,190 L168,215 Q172,230 170,235"
        stroke="#9ca3af"
        strokeWidth={12}
        fill="none"
        opacity={0.4}
      />
      {/* Legs */}
      <path d="M90,182 L85,240 Q82,260 80,275" stroke="#9ca3af" strokeWidth={14} fill="none" opacity={0.3} />
      <path d="M110,182 L115,240 Q118,260 120,275" stroke="#9ca3af" strokeWidth={14} fill="none" opacity={0.3} />
    </g>
  );
}
