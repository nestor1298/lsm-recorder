"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { CM_INVENTORY, FINGER_GROUPS, TIER_LABELS, TIER_COLORS, getFingerGroup } from "@/lib/data";
import type { CMEntry, FlexionLevel } from "@/lib/types";

const Hand3DViewer = dynamic(() => import("@/components/Hand3D/Hand3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-2xl bg-gradient-to-b from-indigo-950/50 to-slate-900/50">
      <div className="text-center">
        <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        <p className="text-xs text-indigo-300">Cargando 3D...</p>
      </div>
    </div>
  ),
});

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
  const [selectedCM, setSelectedCM] = useState<CMEntry | null>(null);

  // Active CM: click takes priority over hover
  const activeCM = selectedCM ?? hoveredCM;

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
          <span className="ml-1.5 text-xs text-indigo-600/70">configuraciones</span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-1.5">
          <span className="text-2xl font-bold text-gray-700">4</span>
          <span className="ml-1.5 text-xs text-gray-500">niveles de frecuencia</span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-1.5">
          <span className="text-2xl font-bold text-gray-700">5</span>
          <span className="ml-1.5 text-xs text-gray-500">grupos de dedos</span>
        </div>
      </div>

      {/* Flexion legend */}
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          Niveles de Flexión de Dedos
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
              <span className="text-xs text-gray-600">{FLEXION_LABEL_ES[level]}</span>
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
          Todos los Niveles
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
            Nivel {tier}: {TIER_LABELS_ES[tier]}
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
          Todos los Grupos
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

      {/* Main content: grid + 3D hand side-by-side on desktop */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Left: CM Grid */}
        <div className="space-y-4">
          {/* 3D hand — mobile: above grid */}
          <div className="lg:hidden">
            <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-950 to-slate-900">
              <Hand3DViewer cm={activeCM} height="280px" autoRotate={!activeCM} />
              {activeCM && (
                <div className="border-t border-white/10 bg-white/5 px-4 py-2 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">CM #{activeCM.cm_id}</span>
                    {selectedCM && (
                      <button
                        onClick={() => setSelectedCM(null)}
                        className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70 hover:bg-white/20"
                      >
                        ✕ Deseleccionar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7">
            {filtered.map((cm) => {
              const isSelected = selectedCM?.cm_id === cm.cm_id;
              const isHovered = hoveredCM?.cm_id === cm.cm_id;
              return (
                <div
                  key={cm.cm_id}
                  className={`group relative cursor-pointer rounded-xl border bg-white p-1 transition-all hover:shadow-md ${
                    isSelected
                      ? "border-indigo-500 ring-2 ring-indigo-400/50 shadow-lg"
                      : isHovered
                        ? "border-indigo-400 shadow-lg"
                        : "border-gray-200"
                  }`}
                  onMouseEnter={() => setHoveredCM(cm)}
                  onMouseLeave={() => setHoveredCM(null)}
                  onClick={() => setSelectedCM(isSelected ? null : cm)}
                >
                  <MiniHand cm={cm} size={56} />
                  <div className="px-0.5 pb-0.5 text-center">
                    <span className={`text-[9px] font-bold ${isSelected ? "text-indigo-600" : "text-gray-700"}`}>
                      #{cm.cm_id}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] text-white shadow">
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Sticky 3D hand panel — desktop only */}
        <div className="hidden lg:block">
          <div className="sticky top-4 space-y-3">
            <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-950 to-slate-900 shadow-xl">
              <Hand3DViewer cm={activeCM} height="340px" autoRotate={!activeCM} />

              {/* Info overlay */}
              <div className="border-t border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                {activeCM ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">CM #{activeCM.cm_id}</span>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${TIER_COLORS[activeCM.frequency_tier]}`}>
                          {TIER_LABELS_ES[activeCM.frequency_tier]}
                        </span>
                      </div>
                      {selectedCM && (
                        <button
                          onClick={() => setSelectedCM(null)}
                          className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70 hover:bg-white/20 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {activeCM.cruz_aldrete_notation && (
                      <p className="mt-1 font-mono text-xs text-indigo-300">
                        {activeCM.cruz_aldrete_notation}
                      </p>
                    )}
                    {activeCM.example_sign && (
                      <p className="mt-1 text-xs text-indigo-200/70">
                        Ejemplo: <span className="text-indigo-100 font-medium">{activeCM.example_sign}</span>
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(["index", "middle", "ring", "pinky"] as const).map((finger) => {
                        const labels = { index: "Índ", middle: "Med", ring: "Anu", pinky: "Meñ" };
                        const flexion = activeCM[finger];
                        return (
                          <span
                            key={finger}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${FLEXION_COLOR[flexion]}20`,
                              color: FLEXION_COLOR[flexion],
                            }}
                          >
                            {labels[finger]}: {FLEXION_LABEL_ES[flexion]}
                          </span>
                        );
                      })}
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-200">
                        Pulgar: {activeCM.thumb_opposition === "OPPOSED" ? "opuesto" : activeCM.thumb_opposition === "PARALLEL" ? "paralelo" : "cruzado"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-xs text-indigo-300/60">
                    Pasa el cursor o haz clic en una CM
                  </p>
                )}
              </div>
            </div>

            {/* Instruction hint */}
            <div className="rounded-xl bg-indigo-50 px-3 py-2 text-center">
              <p className="text-[10px] text-indigo-600/70">
                💡 <b>Clic</b> para fijar una CM · <b>Hover</b> para previsualizar · <b>Arrastra</b> para rotar el modelo 3D
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel — shown below grid when a CM is active (replaces old hover-only panel) */}
      {activeCM && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-4 lg:hidden">
          <div className="flex items-start gap-4">
            <MiniHand cm={activeCM} size={80} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-gray-900">CM #{activeCM.cm_id}</h4>
                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${TIER_COLORS[activeCM.frequency_tier]}`}>
                  {TIER_LABELS_ES[activeCM.frequency_tier]}
                </span>
              </div>
              {activeCM.cruz_aldrete_notation && (
                <p className="mt-1 font-mono text-sm text-gray-600">
                  {activeCM.cruz_aldrete_notation}
                </p>
              )}
              {activeCM.example_sign && (
                <p className="mt-1 text-sm text-gray-500">
                  Ejemplo: <span className="font-medium text-gray-700">{activeCM.example_sign}</span>
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-white/80 px-2 py-0.5 text-gray-600">
                  Índice: <b style={{ color: FLEXION_COLOR[activeCM.index] }}>{FLEXION_LABEL_ES[activeCM.index]}</b>
                </span>
                <span className="rounded bg-white/80 px-2 py-0.5 text-gray-600">
                  Medio: <b style={{ color: FLEXION_COLOR[activeCM.middle] }}>{FLEXION_LABEL_ES[activeCM.middle]}</b>
                </span>
                <span className="rounded bg-white/80 px-2 py-0.5 text-gray-600">
                  Anular: <b style={{ color: FLEXION_COLOR[activeCM.ring] }}>{FLEXION_LABEL_ES[activeCM.ring]}</b>
                </span>
                <span className="rounded bg-white/80 px-2 py-0.5 text-gray-600">
                  Meñique: <b style={{ color: FLEXION_COLOR[activeCM.pinky] }}>{FLEXION_LABEL_ES[activeCM.pinky]}</b>
                </span>
                <span className="rounded bg-white/80 px-2 py-0.5 text-gray-600">
                  Pulgar: <b>{activeCM.thumb_opposition === "OPPOSED" ? "opuesto" : activeCM.thumb_opposition === "PARALLEL" ? "paralelo" : "cruzado"}</b> / <b style={{ color: FLEXION_COLOR[activeCM.thumb_flexion] }}>{FLEXION_LABEL_ES[activeCM.thumb_flexion]}</b>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Showing count */}
      <p className="text-center text-xs text-gray-400">
        Mostrando {filtered.length} de 101 configuraciones
        {selectedTier ? ` (Nivel ${selectedTier})` : ""}
        {selectedGroup ? ` (${selectedGroup})` : ""}
      </p>
    </div>
  );
}
