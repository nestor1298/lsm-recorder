"use client";

import { useState, useMemo } from "react";
import { CM_INVENTORY, FINGER_GROUPS, TIER_LABELS, TIER_COLORS, getFingerGroup } from "@/lib/data";
import type { CMEntry, FlexionLevel } from "@/lib/types";

const FLEXION_COLOR: Record<FlexionLevel, string> = {
  EXTENDED: "#22c55e",
  CURVED: "#eab308",
  BENT: "#f97316",
  CLOSED: "#ef4444",
};

/** Mini hand visualization — compact version */
function MiniHand({ cm, size = 64 }: { cm: CMEntry; size?: number }) {
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
      {/* Palm */}
      <ellipse cx="32" cy="38" rx="12" ry="13" fill="#fde8d0" stroke="#d4a574" strokeWidth="0.5" />
      {/* Fingers */}
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
      {/* Thumb */}
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

export default function CMExplorer() {
  const [selectedTier, setSelectedTier] = useState<number | null>(1);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [hoveredCM, setHoveredCM] = useState<CMEntry | null>(null);

  const filtered = useMemo(() => {
    let items = CM_INVENTORY;
    if (selectedTier) items = items.filter((cm) => cm.frequency_tier === selectedTier);
    if (selectedGroup) items = items.filter((cm) => getFingerGroup(cm) === selectedGroup);
    return items;
  }, [selectedTier, selectedGroup]);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-indigo-50 px-3 py-1.5">
          <span className="text-2xl font-bold text-indigo-600">101</span>
          <span className="ml-1.5 text-xs text-indigo-600/70">handshapes</span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-1.5">
          <span className="text-2xl font-bold text-gray-700">4</span>
          <span className="ml-1.5 text-xs text-gray-500">frequency tiers</span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-1.5">
          <span className="text-2xl font-bold text-gray-700">5</span>
          <span className="ml-1.5 text-xs text-gray-500">finger groups</span>
        </div>
      </div>

      {/* Flexion legend */}
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          Finger Flexion Levels
        </p>
        <div className="flex items-center gap-4">
          {(["EXTENDED", "CURVED", "BENT", "CLOSED"] as FlexionLevel[]).map((level) => (
            <div key={level} className="flex items-center gap-2">
              <div className="flex items-end gap-0.5">
                <div
                  className="rounded-sm"
                  style={{
                    width: 4,
                    height: level === "EXTENDED" ? 20 : level === "CURVED" ? 16 : level === "BENT" ? 12 : 6,
                    backgroundColor: FLEXION_COLOR[level],
                  }}
                />
              </div>
              <span className="text-xs text-gray-600">{level.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tier filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedTier(null)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedTier === null ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All Tiers
        </button>
        {[1, 2, 3, 4].map((tier) => (
          <button
            key={tier}
            onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedTier === tier
                ? `${TIER_COLORS[tier]} border`
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Tier {tier}: {TIER_LABELS[tier]}
          </button>
        ))}
      </div>

      {/* Group filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedGroup(null)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedGroup === null ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All Groups
        </button>
        {FINGER_GROUPS.map((group) => (
          <button
            key={group}
            onClick={() => setSelectedGroup(selectedGroup === group ? null : group)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedGroup === group
                ? "bg-violet-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {group}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {filtered.map((cm) => (
          <div
            key={cm.cm_id}
            className={`group relative cursor-pointer rounded-xl border bg-white p-1 transition-all hover:shadow-md ${
              hoveredCM?.cm_id === cm.cm_id ? "border-indigo-400 shadow-lg" : "border-gray-200"
            }`}
            onMouseEnter={() => setHoveredCM(cm)}
            onMouseLeave={() => setHoveredCM(null)}
          >
            <MiniHand cm={cm} size={56} />
            <div className="px-0.5 pb-0.5 text-center">
              <span className="text-[9px] font-bold text-gray-700">#{cm.cm_id}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {hoveredCM && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-4">
          <div className="flex items-start gap-4">
            <MiniHand cm={hoveredCM} size={80} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-gray-900">CM #{hoveredCM.cm_id}</h4>
                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${TIER_COLORS[hoveredCM.frequency_tier]}`}>
                  {TIER_LABELS[hoveredCM.frequency_tier]}
                </span>
              </div>
              {hoveredCM.cruz_aldrete_notation && (
                <p className="mt-1 font-mono text-sm text-gray-600">
                  {hoveredCM.cruz_aldrete_notation}
                </p>
              )}
              {hoveredCM.example_sign && (
                <p className="mt-1 text-sm text-gray-500">
                  Example: <span className="font-medium text-gray-700">{hoveredCM.example_sign}</span>
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-white/80 px-2 py-0.5 text-gray-600">
                  Index: <b style={{ color: FLEXION_COLOR[hoveredCM.index] }}>{hoveredCM.index.toLowerCase()}</b>
                </span>
                <span className="rounded bg-white/80 px-2 py-0.5 text-gray-600">
                  Middle: <b style={{ color: FLEXION_COLOR[hoveredCM.middle] }}>{hoveredCM.middle.toLowerCase()}</b>
                </span>
                <span className="rounded bg-white/80 px-2 py-0.5 text-gray-600">
                  Ring: <b style={{ color: FLEXION_COLOR[hoveredCM.ring] }}>{hoveredCM.ring.toLowerCase()}</b>
                </span>
                <span className="rounded bg-white/80 px-2 py-0.5 text-gray-600">
                  Pinky: <b style={{ color: FLEXION_COLOR[hoveredCM.pinky] }}>{hoveredCM.pinky.toLowerCase()}</b>
                </span>
                <span className="rounded bg-white/80 px-2 py-0.5 text-gray-600">
                  Thumb: <b>{hoveredCM.thumb_opposition.toLowerCase()}</b> / <b style={{ color: FLEXION_COLOR[hoveredCM.thumb_flexion] }}>{hoveredCM.thumb_flexion.toLowerCase()}</b>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Showing count */}
      <p className="text-center text-xs text-gray-400">
        Showing {filtered.length} of 101 handshapes
        {selectedTier ? ` (Tier ${selectedTier})` : ""}
        {selectedGroup ? ` (${selectedGroup})` : ""}
      </p>
    </div>
  );
}
