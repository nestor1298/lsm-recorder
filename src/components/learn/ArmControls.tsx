"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  type ArmJointAngles,
  type ArmFKState,
  type CapturedPose,
  ARM_ROM_LIMITS,
  ARM_JOINT_ORDER,
} from "@/lib/arm_fk";

// ── Group config for visual separation ──────────────────────────

const GROUP_COLORS: Record<string, string> = {
  Clavícula: "#6366f1", // indigo
  Hombro: "#8b5cf6", // violet
  Codo: "#0ea5e9", // sky
  Antebrazo: "#14b8a6", // teal
  Muñeca: "#f59e0b", // amber
};

// ── Props ────────────────────────────────────────────────────────

interface ArmControlsProps {
  angles: ArmJointAngles;
  onChange: (angles: ArmJointAngles) => void;
  /** Shared ref to read FK state from the 3D scene */
  fkStateRef: React.RefObject<ArmFKState | null>;
  /** Currently selected UB code (from the UB tab) */
  ubCode?: string | null;
  /** Callback when the user captures a pose */
  onCapture?: (pose: CapturedPose) => void;
  /** Reset all angles to bind pose */
  onReset?: () => void;
  /** Trigger auto-solve for all non-arm UB points */
  onAutoSolveAll?: () => void;
  /** Whether auto-solve is currently running */
  autoSolveRunning?: boolean;
  /** Auto-solve results count */
  autoSolveCount?: number;
}

// ── Component ───────────────────────────────────────────────────

export default function ArmControls({
  angles,
  onChange,
  fkStateRef,
  ubCode,
  onCapture,
  onReset,
  onAutoSolveAll,
  autoSolveRunning = false,
  autoSolveCount = 0,
}: ArmControlsProps) {
  // Local copy of FK state, polled from ref every 100ms
  const [fkState, setFkState] = useState<ArmFKState | null>(null);
  const [captures, setCaptures] = useState<CapturedPose[]>([]);

  // Poll the FK state ref (written by AvatarModel inside Canvas)
  useEffect(() => {
    const interval = setInterval(() => {
      if (fkStateRef.current) {
        setFkState({ ...fkStateRef.current });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [fkStateRef]);

  // ── Slider change handler ──
  const handleSlider = useCallback(
    (key: keyof ArmJointAngles, value: number) => {
      onChange({ ...angles, [key]: value });
    },
    [angles, onChange],
  );

  // ── Capture handler ──
  const handleCapture = useCallback(() => {
    if (!fkState || !ubCode) return;
    const pose: CapturedPose = {
      ubCode,
      angles: { ...angles },
      handWorldQuat: fkState.handWorldQuat,
      distanceToUB: fkState.distanceToUB,
      timestamp: Date.now(),
    };
    setCaptures((prev) => [...prev, pose]);
    onCapture?.(pose);
  }, [fkState, ubCode, angles, onCapture]);

  // ── Copy captures as JSON ──
  const copyCaptures = useCallback(() => {
    navigator.clipboard
      .writeText(JSON.stringify(captures, null, 2))
      .catch(() => {});
  }, [captures]);

  // ── Derive group structure ──
  const groups = ARM_JOINT_ORDER.reduce(
    (acc, key) => {
      const { group } = ARM_ROM_LIMITS[key];
      if (!acc[group]) acc[group] = [];
      acc[group].push(key);
      return acc;
    },
    {} as Record<string, (keyof ArmJointAngles)[]>,
  );

  const reached = fkState?.reached ?? false;
  const distCm = fkState ? (fkState.distanceToUB * 100).toFixed(1) : "—";

  return (
    <div className="space-y-3">
      {/* ── UB Reach Indicator ── */}
      <div
        className={`flex items-center justify-between rounded-xl px-3 py-2 ${
          reached
            ? "bg-green/15 ring-1 ring-green/30"
            : "bg-gray-100"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              reached
                ? "bg-green shadow-md shadow-green/50"
                : "bg-gray-400"
            }`}
          />
          <div>
            <p
              className={`text-xs font-bold ${reached ? "text-green-deep" : "text-gray-500"}`}
            >
              {reached ? "Alcanzado" : "No alcanzado"}
            </p>
            <p className="text-[10px] text-gray-400">
              {ubCode ? (
                <>
                  UB:{" "}
                  <span className="font-medium text-gray-600">{ubCode}</span> ·{" "}
                  {distCm} cm
                </>
              ) : (
                "Selecciona un UB en la pestaña UB"
              )}
            </p>
          </div>
        </div>

        <button
          onClick={handleCapture}
          disabled={!reached || !ubCode}
          className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${
            reached && ubCode
              ? "bg-green-deep text-white shadow-sm hover:bg-green-deep"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Capturar
        </button>
      </div>

      {/* ── Joint Sliders grouped by anatomical segment ── */}
      {Object.entries(groups).map(([group, keys]) => {
        const color = GROUP_COLORS[group] ?? "#6b7280";
        return (
          <div key={group}>
            <div className="mb-1.5 flex items-center gap-2">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color }}
              >
                {group}
              </span>
            </div>

            <div className="space-y-1.5 rounded-lg bg-black/3 px-2.5 py-2">
              {keys.map((key) => {
                const rom = ARM_ROM_LIMITS[key];
                const value = angles[key];
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-[120px] shrink-0 text-[10px] text-gray-500 leading-tight">
                      {rom.label}
                    </span>
                    <input
                      type="range"
                      min={rom.min}
                      max={rom.max}
                      step={1}
                      value={value}
                      onChange={(e) =>
                        handleSlider(key, Number(e.target.value))
                      }
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-accent-deep
                        [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow-md"
                    />
                    <span
                      className={`w-[36px] shrink-0 text-right font-mono text-[10px] font-bold ${
                        value === 0 ? "text-gray-400" : "text-gray-700"
                      }`}
                    >
                      {value}°
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Reset button ── */}
      <button
        onClick={onReset}
        className="w-full rounded-lg bg-gray-100 py-1.5 text-[10px] font-bold text-gray-500 transition-colors hover:bg-gray-200"
      >
        Restablecer (pose bind)
      </button>

      {/* ── Auto-solve all button ── */}
      <button
        onClick={onAutoSolveAll}
        disabled={autoSolveRunning}
        className={`w-full rounded-lg py-2 text-[10px] font-bold transition-colors ${
          autoSolveRunning
            ? "bg-gold-tint text-gold-deep cursor-wait animate-pulse"
            : "bg-gold text-white hover:bg-gold shadow-sm"
        }`}
      >
        {autoSolveRunning
          ? `Resolviendo… (${autoSolveCount} capturados)`
          : "Auto-capturar todos (excl. brazo/mano)"}
      </button>

      {/* ── Hand Orientation Readout ── */}
      {fkState && (
        <div className="rounded-lg bg-gray-900/80 px-3 py-2">
          <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-400">
            Cuaternión de mano (mundo)
          </p>
          <p className="font-mono text-[10px] text-green">
            ({fkState.handWorldQuat.map((v) => v.toFixed(3)).join(", ")})
          </p>
        </div>
      )}

      {/* ── Captured Poses ── */}
      {captures.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Capturas ({captures.length})
            </span>
            <button
              onClick={copyCaptures}
              className="rounded bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-500 transition-colors hover:bg-gray-200"
            >
              Copiar JSON
            </button>
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-gray-900/80 px-3 py-2">
            {captures.map((cap, i) => (
              <div
                key={cap.timestamp}
                className="flex items-center gap-2 text-[9px]"
              >
                <span className="font-bold text-green">#{i + 1}</span>
                <span className="text-gray-400">
                  UB={cap.ubCode} · {(cap.distanceToUB * 100).toFixed(1)}cm
                </span>
                <span className="font-mono text-gray-500">
                  q=({cap.handWorldQuat.map((v) => v.toFixed(2)).join(", ")})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
