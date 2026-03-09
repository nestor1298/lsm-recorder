"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { CMEntry } from "@/lib/types";
import type { UBLocation } from "@/lib/ub_inventory";
import {
  type SignConstruction,
  type HoldSegment,
  type MovementSegment,
  createDefaultSign,
  createHoldSegment,
  createMovementSegment,
  buildNotation,
} from "@/lib/sign_types";
import type { FaceState } from "./RNMControls";
import SegmentTimeline from "./SegmentTimeline";
import CMControls from "./CMControls";
import UBControls from "./UBControls";
import ORControls from "./ORControls";
import MVControls from "./MVControls";
import RNMControls from "./RNMControls";

// ── Viewer state — what the parent page feeds to Hand3DViewer ──

export interface ViewerState {
  activeChannel: string;
  cm: CMEntry | null;
  orientation?: { palm: string; fingers: string };
  movement?: { contour: string; local: string | null; plane: string };
  ubLocation: UBLocation | null;
  rnm: FaceState | null;
  showAllUBPoints?: boolean;
  /** Hand mode for avatar posing */
  handMode?: "dominant" | "both_symmetric";
  /** Movement interpolation data (during M segment playback) */
  movementInterp?: import("@/components/Hand3D/AvatarModel").MovementInterpolation | null;
}

interface SignBuilderProps {
  /** Called whenever the 3D viewer should update */
  onViewerUpdate: (state: ViewerState) => void;
  /** Called whenever the sign data changes (for playback) */
  onSignChange?: (sign: SignConstruction) => void;
}

// ── Hold sub-tab config ──

const HOLD_TABS = [
  { id: "cm" as const, label: "CM", fullLabel: "Config. Manual", color: "#4f46e5" },
  { id: "ub" as const, label: "UB", fullLabel: "Ubicación", color: "#059669" },
  { id: "or" as const, label: "OR", fullLabel: "Orientación", color: "#7c3aed" },
] as const;

type HoldTabId = (typeof HOLD_TABS)[number]["id"];

// ── Component ──

export default function SignBuilder({ onViewerUpdate, onSignChange }: SignBuilderProps) {
  const [sign, setSign] = useState<SignConstruction>(createDefaultSign);
  const [activeIdx, setActiveIdx] = useState(0);
  const [holdTab, setHoldTab] = useState<HoldTabId>("cm");
  const [showRNM, setShowRNM] = useState(false);

  // Notify parent whenever sign changes
  useEffect(() => {
    onSignChange?.(sign);
  }, [sign, onSignChange]);

  const activeSegment = sign.segments[activeIdx] ?? sign.segments[0];

  // ── Sync viewer state ──

  const emitViewerState = useCallback(
    (overrides?: Partial<ViewerState>) => {
      const seg = sign.segments[activeIdx];
      if (!seg) return;

      let state: ViewerState;

      if (showRNM) {
        state = {
          activeChannel: "rnm",
          cm: null,
          orientation: undefined,
          movement: undefined,
          ubLocation: null,
          rnm: sign.rnm as FaceState,
        };
      } else if (seg.type === "D") {
        const channel = holdTab === "ub" ? "ub" : holdTab === "or" ? "or" : "cm";
        state = {
          activeChannel: channel,
          cm: seg.cm,
          orientation: seg.orientation,
          movement: undefined,
          // Always pass UB so avatar arm IK works regardless of active tab
          ubLocation: seg.ub,
          rnm: null,
          showAllUBPoints: holdTab === "ub",
          handMode: seg.handMode ?? "dominant",
        };
      } else {
        state = {
          activeChannel: "mv",
          cm: null,
          orientation: undefined,
          movement: { contour: seg.contour, local: seg.local, plane: seg.plane },
          ubLocation: null,
          rnm: null,
        };
      }

      onViewerUpdate({ ...state, ...overrides });
    },
    [sign, activeIdx, holdTab, showRNM, onViewerUpdate],
  );

  // Emit whenever context changes
  useEffect(() => {
    emitViewerState();
  }, [emitViewerState]);

  // ── Segment management ──

  const selectSegment = useCallback(
    (index: number) => {
      setActiveIdx(index);
      setShowRNM(false);
      const seg = sign.segments[index];
      if (seg?.type === "D") setHoldTab("cm");
    },
    [sign.segments],
  );

  const addHold = useCallback(() => {
    setSign((s) => ({
      ...s,
      segments: [...s.segments, createHoldSegment()],
    }));
  }, []);

  const addMovement = useCallback(() => {
    setSign((s) => ({
      ...s,
      segments: [...s.segments, createMovementSegment()],
    }));
  }, []);

  const removeSegment = useCallback(
    (index: number) => {
      setSign((s) => {
        const newSegs = s.segments.filter((_, i) => i !== index);
        if (newSegs.length === 0) return s;
        return { ...s, segments: newSegs };
      });
      setActiveIdx((prev) => Math.min(prev, sign.segments.length - 2));
    },
    [sign.segments.length],
  );

  const resetSign = useCallback(() => {
    const fresh = createDefaultSign();
    setSign(fresh);
    setActiveIdx(0);
    setHoldTab("cm");
    setShowRNM(false);
  }, []);

  // ── Update helpers ──

  const updateHold = useCallback(
    (patch: Partial<HoldSegment>) => {
      setSign((s) => {
        const segs = [...s.segments];
        const seg = segs[activeIdx];
        if (seg?.type !== "D") return s;
        segs[activeIdx] = { ...seg, ...patch };
        return { ...s, segments: segs };
      });
    },
    [activeIdx],
  );

  const updateMovement = useCallback(
    (patch: Partial<MovementSegment>) => {
      setSign((s) => {
        const segs = [...s.segments];
        const seg = segs[activeIdx];
        if (seg?.type !== "M") return s;
        segs[activeIdx] = { ...seg, ...patch };
        return { ...s, segments: segs };
      });
    },
    [activeIdx],
  );

  // ── Control callbacks ──

  const handleCMChange = useCallback(
    (cm: CMEntry | null) => {
      updateHold({ cm });
    },
    [updateHold],
  );

  const handleUBChange = useCallback(
    (ub: UBLocation | null) => {
      updateHold({ ub });
    },
    [updateHold],
  );

  const handleORChange = useCallback(
    (orientation: { palm: string; fingers: string }) => {
      updateHold({ orientation });
    },
    [updateHold],
  );

  const handleHandModeChange = useCallback(
    (handMode: "dominant" | "both_symmetric") => {
      updateHold({ handMode });
    },
    [updateHold],
  );

  const handleMVChange = useCallback(
    (mv: { contour: string; local: string | null; plane: string }) => {
      updateMovement({ contour: mv.contour, local: mv.local, plane: mv.plane });
    },
    [updateMovement],
  );

  const handleRNMChange = useCallback(
    (face: FaceState) => {
      setSign((s) => ({
        ...s,
        rnm: { eyebrows: face.eyebrows, mouth: face.mouth, head: face.head },
      }));
    },
    [],
  );

  // ── Notation ──

  const notation = useMemo(() => buildNotation(sign), [sign]);

  const copyNotation = useCallback(() => {
    navigator.clipboard.writeText(notation).catch(() => {});
  }, [notation]);

  // ── Render ──

  return (
    <div className="space-y-3">
      {/* ─── Row 1: Sign name + Timeline ─── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={sign.name}
            onChange={(e) => setSign((s) => ({ ...s, name: e.target.value }))}
            placeholder="Nombre / glosa..."
            className="w-40 rounded-lg border border-black/10 bg-white/50 px-3 py-1.5 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
          />
          <button
            onClick={resetSign}
            className="rounded-lg bg-gray-100 px-2 py-1.5 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-200"
            title="Nueva seña"
          >
            Nueva
          </button>
        </div>

        <SegmentTimeline
          segments={sign.segments}
          activeIndex={activeIdx}
          onSelect={selectSegment}
          onAddHold={addHold}
          onAddMovement={addMovement}
          onRemove={removeSegment}
        />
      </div>

      {/* ─── Row 2: Segment summary card ─── */}
      {activeSegment.type === "D" && !showRNM && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-indigo-500/8 px-3 py-2">
          <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
            Detención
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              activeSegment.cm
                ? "bg-indigo-500/10 text-indigo-700"
                : "bg-black/5 text-gray-400"
            }`}
          >
            CM: {activeSegment.cm ? `#${activeSegment.cm.cm_id}` : "—"}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              activeSegment.ub
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-black/5 text-gray-400"
            }`}
          >
            UB: {activeSegment.ub ? `${activeSegment.ub.code} (${activeSegment.ub.name})` : "—"}
          </span>
          <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
            OR: {activeSegment.orientation.palm.toLowerCase()},{activeSegment.orientation.fingers.toLowerCase()}
          </span>
          {activeSegment.handMode === "both_symmetric" && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              2M
            </span>
          )}
        </div>
      )}

      {activeSegment.type === "M" && !showRNM && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-500/8 px-3 py-2">
          <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700">
            Movimiento
          </span>
          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
            Contorno: {activeSegment.contour.toLowerCase()}
          </span>
          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
            Plano: {activeSegment.plane.toLowerCase()}
          </span>
          {activeSegment.local && (
            <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
              Local: {activeSegment.local.toLowerCase()}
            </span>
          )}
        </div>
      )}

      {/* ─── Row 3: Controls ─── */}
      <div className="rounded-xl border border-black/5 bg-white/40 p-3">
        {showRNM ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                RNM — Rasgos No Manuales
              </span>
              <button
                onClick={() => setShowRNM(false)}
                className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-200"
              >
                Volver al segmento
              </button>
            </div>
            <p className="mb-3 text-[10px] text-gray-500">
              Los rasgos no manuales se aplican suprasegmentalmente a toda la seña.
            </p>
            <RNMControls
              key="rnm-builder"
              onFaceChange={handleRNMChange}
              defaultFace={sign.rnm as FaceState}
            />
          </>
        ) : activeSegment.type === "D" ? (
          <>
            {/* Hand mode toggle */}
            <div className="mb-2 flex items-center gap-1.5">
              <span className="text-[9px] font-medium uppercase tracking-wider text-gray-400">Manos:</span>
              <div className="flex rounded-lg bg-black/5 p-0.5">
                <button
                  onClick={() => handleHandModeChange("dominant")}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-all ${
                    (activeSegment.handMode ?? "dominant") === "dominant"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Dominante
                </button>
                <button
                  onClick={() => handleHandModeChange("both_symmetric")}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-all ${
                    activeSegment.handMode === "both_symmetric"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Ambas
                </button>
              </div>
            </div>

            {/* Hold sub-tabs */}
            <div className="mb-3 flex items-center gap-1">
              {HOLD_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setHoldTab(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wider transition-all ${
                    holdTab === tab.id
                      ? "text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                  style={holdTab === tab.id ? { backgroundColor: tab.color } : {}}
                >
                  {tab.label}
                  <span className="ml-1 hidden text-[9px] font-medium opacity-70 sm:inline">
                    {tab.fullLabel}
                  </span>
                </button>
              ))}

              <button
                onClick={() => setShowRNM(true)}
                className="ml-auto rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600 transition-colors hover:bg-rose-100"
              >
                RNM
              </button>
            </div>

            {/* Hold controls — keyed by segment id so defaults apply */}
            {holdTab === "cm" && (
              <CMControls
                key={`cm-${activeSegment.id}`}
                onCMChange={handleCMChange}
                defaultCM={activeSegment.cm}
              />
            )}
            {holdTab === "ub" && (
              <UBControls
                key={`ub-${activeSegment.id}`}
                onLocationChange={handleUBChange}
                defaultLocation={activeSegment.ub}
              />
            )}
            {holdTab === "or" && (
              <ORControls
                key={`or-${activeSegment.id}`}
                onOrientationChange={handleORChange}
                defaultPalm={activeSegment.orientation.palm}
                defaultFingers={activeSegment.orientation.fingers}
              />
            )}
          </>
        ) : (
          <>
            {/* Movement controls */}
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                Movimiento
              </span>
              <button
                onClick={() => setShowRNM(true)}
                className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600 transition-colors hover:bg-rose-100"
              >
                RNM
              </button>
            </div>
            <MVControls
              key={`mv-${activeSegment.id}`}
              onMovementChange={handleMVChange}
              defaultContour={activeSegment.contour}
              defaultLocal={activeSegment.local}
              defaultPlane={activeSegment.plane}
            />
          </>
        )}
      </div>

      {/* ─── Row 4: Full notation output ─── */}
      <div className="rounded-xl bg-gray-900/80 p-3 backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Notación Segmental LSM-PN
          </p>
          <div className="flex items-center gap-2">
            {sign.name && (
              <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                {sign.name}
              </span>
            )}
            <button
              onClick={copyNotation}
              className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-400 transition-colors hover:bg-white/20 hover:text-white"
              title="Copiar notación"
            >
              Copiar
            </button>
          </div>
        </div>
        <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-emerald-400 sm:text-sm">
          {notation}
        </p>
      </div>
    </div>
  );
}
