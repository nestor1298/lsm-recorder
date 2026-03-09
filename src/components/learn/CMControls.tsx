"use client";

import { useState, useMemo, useEffect } from "react";
import { CM_INVENTORY, FINGER_GROUPS, TIER_COLORS, getFingerGroup } from "@/lib/data";
import type { CMEntry, FlexionLevel } from "@/lib/types";

const FLEXION_COLOR: Record<FlexionLevel, string> = {
  EXTENDED: "#22c55e",
  CURVED: "#eab308",
  BENT: "#f97316",
  CLOSED: "#ef4444",
};

const FLEXION_LABEL_ES: Record<FlexionLevel, string> = {
  EXTENDED: "extendido",
  CURVED: "curvado",
  BENT: "doblado",
  CLOSED: "cerrado",
};

const TIER_LABELS_ES: Record<number, string> = {
  1: "Alta Frecuencia",
  2: "Media Frecuencia",
  3: "Baja Frecuencia",
  4: "Raro",
};

/** Mini hand visualization — compact SVG version */
function MiniHand({ cm, size = 56 }: { cm: CMEntry; size?: number }) {
  const fingerStates: FlexionLevel[] = [cm.index, cm.middle, cm.ring, cm.pinky];
  const FINGER_ANGLES = [-25, -12, 3, 18];
  const SEG = 8;

  function fingerPath(baseX: number, baseY: number, angle: number, flexion: FlexionLevel) {
    const curl = ({ EXTENDED: 0, CURVED: 25, BENT: 55, CLOSED: 80 }[flexion] * Math.PI) / 180;
    const rad = ((angle - 90) * Math.PI) / 180;
    let x = baseX,
      y = baseY,
      a = rad;
    const pts = [`${x},${y}`];
    for (let i = 0; i < 3; i++) {
      a += curl * (i === 0 ? 0 : 0.5);
      x += Math.cos(a) * SEG * (i === 2 ? 0.7 : i === 1 ? 0.9 : 1);
      y += Math.sin(a) * SEG * (i === 2 ? 0.7 : i === 1 ? 0.9 : 1);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="flex-shrink-0">
      <ellipse cx="32" cy="38" rx="12" ry="13" fill="#fde8d0" stroke="#d4a574" strokeWidth="0.5" />
      {[
        { x: 26, y: 28 },
        { x: 31, y: 25 },
        { x: 36, y: 27 },
        { x: 40, y: 30 },
      ].map((base, i) => {
        const selected = cm.selected_fingers.includes(i + 1);
        return (
          <polyline
            key={i}
            points={fingerPath(base.x, base.y, FINGER_ANGLES[i], fingerStates[i])}
            fill="none"
            stroke={selected ? FLEXION_COLOR[fingerStates[i]] : "#ccc"}
            strokeWidth={selected ? 2.5 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={selected ? 1 : 0.4}
          />
        );
      })}
      <polyline
        points={`22,36 18,30 ${cm.thumb_opposition === "OPPOSED" ? "14,24" : "16,22"}`}
        fill="none"
        stroke={FLEXION_COLOR[cm.thumb_flexion]}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface CMControlsProps {
  onCMChange: (cm: CMEntry | null) => void;
  /** Pre-select a CM (used by sign builder to restore segment state) */
  defaultCM?: CMEntry | null;
  className?: string;
}

export default function CMControls({ onCMChange, defaultCM, className = "" }: CMControlsProps) {
  const [selectedTier, setSelectedTier] = useState<number | null>(1);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedCM, setSelectedCM] = useState<CMEntry | null>(defaultCM ?? null);

  const activeCM = selectedCM;

  const filtered = useMemo(() => {
    let items = CM_INVENTORY;
    if (selectedTier) items = items.filter((cm) => cm.frequency_tier === selectedTier);
    if (selectedGroup) items = items.filter((cm) => getFingerGroup(cm) === selectedGroup);
    return items;
  }, [selectedTier, selectedGroup]);

  // Propagate active CM to parent
  useEffect(() => {
    onCMChange(activeCM ?? null);
  }, [activeCM, onCMChange]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Selected CM detail (at top) */}
      {activeCM && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3">
          <div className="flex items-start gap-3">
            <MiniHand cm={activeCM} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">CM #{activeCM.cm_id}</span>
                <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${TIER_COLORS[activeCM.frequency_tier]}`}>
                  {TIER_LABELS_ES[activeCM.frequency_tier]}
                </span>
                {selectedCM && (
                  <button
                    onClick={() => setSelectedCM(null)}
                    className="ml-auto rounded-md bg-gray-200/80 px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-300"
                  >
                    ✕
                  </button>
                )}
              </div>
              {activeCM.cruz_aldrete_notation && (
                <p className="mt-0.5 font-mono text-[11px] text-gray-600">{activeCM.cruz_aldrete_notation}</p>
              )}
              {activeCM.example_sign && (
                <p className="text-[11px] text-gray-500">
                  Ej: <span className="font-medium text-gray-700">{activeCM.example_sign}</span>
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-1">
                {(["index", "middle", "ring", "pinky"] as const).map((finger) => {
                  const labels = { index: "Índ", middle: "Med", ring: "Anu", pinky: "Meñ" };
                  const flexion = activeCM[finger];
                  return (
                    <span
                      key={finger}
                      className="rounded px-1 py-0.5 text-[9px] font-medium"
                      style={{ backgroundColor: `${FLEXION_COLOR[flexion]}15`, color: FLEXION_COLOR[flexion] }}
                    >
                      {labels[finger]}: {FLEXION_LABEL_ES[flexion]}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flexion legend */}
      <div className="flex items-center gap-3">
        {(["EXTENDED", "CURVED", "BENT", "CLOSED"] as FlexionLevel[]).map((level) => (
          <div key={level} className="flex items-center gap-1">
            <div
              className="rounded-sm"
              style={{
                width: 3,
                height: level === "EXTENDED" ? 16 : level === "CURVED" ? 13 : level === "BENT" ? 10 : 5,
                backgroundColor: FLEXION_COLOR[level],
              }}
            />
            <span className="text-[10px] text-gray-500">{FLEXION_LABEL_ES[level]}</span>
          </div>
        ))}
      </div>

      {/* Tier filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedTier(null)}
          className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
            selectedTier === null ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Todos
        </button>
        {[1, 2, 3, 4].map((tier) => (
          <button
            key={tier}
            onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}
            className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
              selectedTier === tier
                ? `${TIER_COLORS[tier]} border`
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            N{tier}
          </button>
        ))}
      </div>

      {/* Group filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedGroup(null)}
          className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
            selectedGroup === null ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Todos
        </button>
        {FINGER_GROUPS.map((group) => (
          <button
            key={group}
            onClick={() => setSelectedGroup(selectedGroup === group ? null : group)}
            className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
              selectedGroup === group ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {group}
          </button>
        ))}
      </div>

      {/* CM grid (scrollable) */}
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-gray-100 bg-white/50 p-2">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
          {filtered.map((cm) => {
            const isSelected = selectedCM?.cm_id === cm.cm_id;
            return (
              <div
                key={cm.cm_id}
                className={`group relative cursor-pointer rounded-lg border bg-white p-1 transition-all hover:shadow-md ${
                  isSelected
                    ? "border-indigo-500 ring-2 ring-indigo-400/50 shadow-lg"
                    : "border-gray-200"
                }`}
                onClick={() => setSelectedCM(isSelected ? null : cm)}
              >
                <MiniHand cm={cm} size={48} />
                <div className="text-center">
                  <span className={`text-[8px] font-bold ${isSelected ? "text-indigo-600" : "text-gray-600"}`}>
                    #{cm.cm_id}
                  </span>
                </div>
                {isSelected && (
                  <div className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-500 text-[7px] text-white shadow">
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Count */}
      <p className="text-center text-[10px] text-gray-400">
        {filtered.length} de 101
        {selectedTier ? ` · Nivel ${selectedTier}` : ""}
        {selectedGroup ? ` · ${selectedGroup}` : ""}
      </p>
    </div>
  );
}
