"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { CMEntry } from "@/lib/types";
import { UB_LOCATIONS, type UBLocation } from "@/lib/ub_inventory";
import type { SignConstruction, HoldSegment } from "@/lib/sign_types";
import {
  getPlaybackFrame,
  computeTotalDuration,
  getHoldAtIndex,
  DEFAULT_PLAYBACK_CONFIG,
  type PlaybackConfig,
} from "@/lib/sign_playback";
import { defaultArmAngles, type ArmJointAngles, type ArmFKState, type CapturedPose } from "@/lib/arm_fk";
import CMControls from "@/components/learn/CMControls";
import ORControls from "@/components/learn/ORControls";
import UBControls from "@/components/learn/UBControls";
import MVControls from "@/components/learn/MVControls";
import RNMControls, { type FaceState } from "@/components/learn/RNMControls";
import ArmControls from "@/components/learn/ArmControls";
import SignBuilder, { type ViewerState } from "@/components/learn/SignBuilder";
import PlaybackControls from "@/components/learn/PlaybackControls";
import SignSummary from "@/components/learn/SignSummary";

// Single 3D viewer — no SSR, shared across all channels
const Hand3DViewer = dynamic(() => import("@/components/Hand3D/Hand3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        <p className="text-sm text-indigo-300">Cargando modelo 3D...</p>
      </div>
    </div>
  ),
});

// ── Channel configuration ──────────────────────────────────────

const CHANNELS = [
  {
    id: "cm",
    label: "CM",
    fullName: "Configuración Manual",
    color: "#4f46e5",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 22V8M12 8l-3-6M12 8l3-6M7 16l-4-3M17 16l4-3" />
      </svg>
    ),
  },
  {
    id: "ub",
    label: "UB",
    fullName: "Ubicación",
    color: "#059669",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="5" r="3" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="11" x2="16" y2="11" />
        <line x1="9" y1="22" x2="12" y2="16" />
        <line x1="15" y1="22" x2="12" y2="16" />
      </svg>
    ),
  },
  {
    id: "or",
    label: "OR",
    fullName: "Orientación",
    color: "#7c3aed",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v4m0 12v4M2 12h4m12 0h4M6.34 6.34l2.83 2.83m5.66 5.66l2.83 2.83M17.66 6.34l-2.83 2.83M8.17 14.83l-2.83 2.83" />
      </svg>
    ),
  },
  {
    id: "mv",
    label: "MV",
    fullName: "Movimiento",
    color: "#0284c7",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    id: "rnm",
    label: "RNM",
    fullName: "Rasgos No Manuales",
    color: "#e11d48",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="10" r="7" />
        <circle cx="9" cy="9" r="1" fill="currentColor" />
        <circle cx="15" cy="9" r="1" fill="currentColor" />
        <path d="M9 13q3 2 6 0" />
      </svg>
    ),
  },
  {
    id: "fk",
    label: "FK",
    fullName: "Cinemática Directa",
    color: "#d97706",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 12h16M12 4v16M8 8l8 8M16 8l-8 8" />
      </svg>
    ),
  },
];

// ── Main Page Component ─────────────────────────────────────────

export default function LearnPage() {
  // Mode: explore individual channels or build a complete sign
  const [mode, setMode] = useState<"explore" | "build">("explore");
  const [panelOpen, setPanelOpen] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // ── Explore mode state ──
  const [activeChannel, setActiveChannel] = useState("cm");
  const [activeCM, setActiveCM] = useState<CMEntry | null>(null);
  const [activeOrientation, setActiveOrientation] = useState<{
    palm: string;
    fingers: string;
  }>({ palm: "FORWARD", fingers: "UP" });
  const [activeMovement, setActiveMovement] = useState<{
    contour: string;
    local: string | null;
    plane: string;
  }>({ contour: "STRAIGHT", local: null, plane: "VERTICAL" });
  const [activeUBLocation, setActiveUBLocation] = useState<UBLocation | null>(null);
  const [activeRNM, setActiveRNM] = useState<FaceState>({
    eyebrows: "NEUTRAL",
    mouth: "NEUTRAL",
    head: "NONE",
  });
  const [ubRegionFilter, setUBRegionFilter] = useState<string | null>(null);

  // ── FK mode state ──
  const [armAngles, setArmAngles] = useState<ArmJointAngles>(defaultArmAngles());
  const armFKStateRef = useRef<ArmFKState | null>(null);

  // ── Build mode state — SignBuilder owns sign state, emits viewer props ──
  const [buildViewer, setBuildViewer] = useState<ViewerState>({
    activeChannel: "cm",
    cm: null,
    orientation: undefined,
    movement: undefined,
    ubLocation: null,
    rnm: null,
  });

  // ── Explore callbacks ──
  const handleCMChange = useCallback((cm: CMEntry | null) => setActiveCM(cm), []);
  const handleOrientationChange = useCallback(
    (o: { palm: string; fingers: string }) => setActiveOrientation(o),
    [],
  );
  const handleMovementChange = useCallback(
    (mv: { contour: string; local: string | null; plane: string }) => setActiveMovement(mv),
    [],
  );
  const handleLocationChange = useCallback(
    (loc: UBLocation | null) => setActiveUBLocation(loc),
    [],
  );
  const handleFaceChange = useCallback(
    (face: FaceState) => setActiveRNM(face),
    [],
  );
  const handleRegionFilter = useCallback(
    (region: string | null) => setUBRegionFilter(region),
    [],
  );
  const handleUBClickFrom3D = useCallback(
    (code: string) => {
      const loc = UB_LOCATIONS.find((l) => l.code === code) ?? null;
      setActiveUBLocation(loc);
    },
    [],
  );

  // ── Build callback ──
  const handleViewerUpdate = useCallback((state: ViewerState) => {
    setBuildViewer(state);
  }, []);

  // ── Playback state ──
  const [currentSign, setCurrentSign] = useState<SignConstruction | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackLoop, setPlaybackLoop] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackElapsed, setPlaybackElapsed] = useState(0);
  const playbackStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const handleSignChange = useCallback((sign: SignConstruction) => {
    setCurrentSign(sign);
  }, []);

  // Playback RAF loop
  useEffect(() => {
    if (!isPlaying || !currentSign) return;

    playbackStartRef.current = performance.now() - playbackElapsed / playbackSpeed;

    const tick = () => {
      const now = performance.now();
      const elapsed = (now - playbackStartRef.current) * playbackSpeed;
      const totalDur = computeTotalDuration(currentSign);

      if (elapsed >= totalDur) {
        if (playbackLoop) {
          playbackStartRef.current = now;
          setPlaybackElapsed(0);
        } else {
          setIsPlaying(false);
          setPlaybackElapsed(totalDur);
          return;
        }
      } else {
        setPlaybackElapsed(elapsed);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, currentSign, playbackLoop, playbackSpeed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive playback viewer state
  const playbackFrame = useMemo(() => {
    if (!currentSign || !isPlaying) return null;
    return getPlaybackFrame(currentSign, playbackElapsed);
  }, [currentSign, isPlaying, playbackElapsed]);

  // Override buildViewer with playback frame data
  const effectiveViewer = useMemo<ViewerState>(() => {
    if (!isPlaying || !playbackFrame || !currentSign) return buildViewer;

    const seg = currentSign.segments[playbackFrame.segmentIndex];
    if (!seg) return buildViewer;

    if (seg.type === "D") {
      return {
        activeChannel: "cm",
        cm: seg.cm,
        orientation: seg.orientation,
        movement: undefined,
        ubLocation: seg.ub,
        rnm: currentSign.rnm as FaceState,
        handMode: seg.handMode ?? "dominant",
        showAllUBPoints: false,
        movementInterp: null,
      };
    } else {
      // Movement segment: build interpolation data for smooth animation
      const fromHold = getHoldAtIndex(currentSign, playbackFrame.fromHoldIdx);
      const toHold = getHoldAtIndex(currentSign, playbackFrame.toHoldIdx);
      const t = playbackFrame.ubInterpolation ?? 0;

      return {
        activeChannel: "mv",
        cm: null, // AvatarModel blends CM internally via movementInterp
        orientation: undefined,
        movement: { contour: seg.contour, local: seg.local, plane: seg.plane },
        ubLocation: null, // AvatarModel interpolates position internally
        rnm: currentSign.rnm as FaceState,
        handMode: fromHold?.handMode ?? "dominant",
        showAllUBPoints: false,
        movementInterp: {
          t,
          fromUBCode: fromHold?.ub?.code ?? null,
          toUBCode: toHold?.ub?.code ?? null,
          fromCM: fromHold?.cm ?? null,
          toCM: toHold?.cm ?? null,
          fromOrientation: fromHold?.orientation ?? { palm: "FORWARD", fingers: "UP" },
          toOrientation: toHold?.orientation ?? { palm: "FORWARD", fingers: "UP" },
          contour: seg.contour,
          plane: seg.plane,
          local: seg.local,
          handMode: fromHold?.handMode ?? "dominant",
        },
      };
    }
  }, [isPlaying, playbackFrame, currentSign, buildViewer]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentSign) {
        const totalDur = computeTotalDuration(currentSign);
        if (playbackElapsed >= totalDur) setPlaybackElapsed(0);
      }
      setIsPlaying(true);
    }
  }, [isPlaying, currentSign, playbackElapsed]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setPlaybackElapsed(0);
  }, []);

  // ── Derive final 3D viewer props based on mode ──

  const viewerChannel = mode === "build" ? effectiveViewer.activeChannel : activeChannel;

  const hand3DProps = useMemo(() => {
    if (mode === "build") {
      return {
        cm: effectiveViewer.cm,
        orientation: effectiveViewer.orientation,
        movement: effectiveViewer.movement,
        movementInterp: effectiveViewer.movementInterp ?? null,
      };
    }
    switch (activeChannel) {
      case "cm":
        return { cm: activeCM, orientation: undefined, movement: undefined, movementInterp: null };
      case "or":
        return { cm: null, orientation: activeOrientation, movement: undefined, movementInterp: null };
      case "mv":
        return { cm: null, orientation: undefined, movement: activeMovement, movementInterp: null };
      default:
        return { cm: null, orientation: undefined, movement: undefined, movementInterp: null };
    }
  }, [mode, effectiveViewer, activeChannel, activeCM, activeOrientation, activeMovement]);

  const avatarUBTarget = useMemo(() => {
    if (mode === "build") {
      // In build mode, always pass UB to avatar (for arm IK), not just when on UB tab
      if (!effectiveViewer.ubLocation) return null;
      const loc = effectiveViewer.ubLocation;
      return { code: loc.code, region: loc.region, name: loc.name, x: loc.x, y: loc.y };
    }
    // In explore mode, show UB target for both UB tab and FK tab
    if ((activeChannel === "ub" || activeChannel === "fk") && activeUBLocation) {
      return {
        code: activeUBLocation.code,
        region: activeUBLocation.region,
        name: activeUBLocation.name,
        x: activeUBLocation.x,
        y: activeUBLocation.y,
      };
    }
    return null;
  }, [mode, effectiveViewer, activeChannel, activeUBLocation]);

  const avatarRNMTarget = useMemo(() => {
    if (mode === "build") {
      // In build mode, always pass RNM during playback and when on RNM tab
      if (isPlaying) return effectiveViewer.rnm;
      if (effectiveViewer.activeChannel !== "rnm") return null;
      return effectiveViewer.rnm;
    }
    if (activeChannel !== "rnm") return null;
    return activeRNM;
  }, [mode, effectiveViewer, activeChannel, activeRNM, isPlaying]);

  // Current channel info for display
  const currentChannelInfo = CHANNELS.find((c) => c.id === viewerChannel);

  return (
    <div className="fixed inset-x-0 top-16 bottom-0 z-10">
      {/* ─── 3D Viewport — fills the ENTIRE viewport ─── */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-slate-900 to-violet-950">
        <Hand3DViewer
          cm={hand3DProps.cm}
          orientation={hand3DProps.orientation}
          movement={hand3DProps.movement}
          movementInterp={hand3DProps.movementInterp}
          autoRotate={false}
          height="100%"
          className="rounded-none"
          activeChannel={viewerChannel}
          ubLocation={avatarUBTarget}
          rnm={avatarRNMTarget}
          showAllUBPoints={
            viewerChannel === "ub" && (mode === "explore" || effectiveViewer.showAllUBPoints)
          }
          ubRegionFilter={viewerChannel === "ub" ? ubRegionFilter : null}
          onUBClick={viewerChannel === "ub" ? handleUBClickFrom3D : undefined}
          isBuildMode={mode === "build"}
          handMode={effectiveViewer.handMode}
          armAngles={activeChannel === "fk" && mode === "explore" ? armAngles : null}
          armFKStateRef={armFKStateRef}
        />
      </div>

      {/* ─── Top-right: active channel indicator ─── */}
      {currentChannelInfo && (
        <div className="pointer-events-none absolute right-3 top-3 z-20 lg:right-5 lg:top-5">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-1.5 shadow-lg backdrop-blur-md">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: currentChannelInfo.color,
                boxShadow: `0 0 8px ${currentChannelInfo.color}80`,
              }}
            />
            <span
              className="text-[11px] font-bold"
              style={{ color: currentChannelInfo.color }}
            >
              {currentChannelInfo.label}
            </span>
            <span className="hidden text-[11px] text-white/50 sm:inline">
              {currentChannelInfo.fullName}
            </span>
          </div>
        </div>
      )}

      {/* ─── Right-side Segmental Matrix Card ─── */}
      <div className="absolute bottom-3 right-3 z-20 flex h-[20vh] w-[25vw] flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/50 shadow-2xl ring-1 ring-white/5 backdrop-blur-2xl lg:bottom-5 lg:right-5">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
            Matriz Segmental
          </span>
          <span className="font-mono text-[9px] text-emerald-400/70">Cruz Aldrete 2008</span>
        </div>

        {/* Matrix content */}
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 px-3 py-2">
          {/* Temporal sequence: D → M → D */}
          <div className="flex items-center justify-center gap-1.5">
            <div
              className={`flex flex-col items-center rounded-lg px-2.5 py-1.5 transition-all ${
                mode === "build" && ["cm", "ub", "or"].includes(buildViewer.activeChannel)
                  ? "bg-indigo-500 shadow-lg shadow-indigo-500/30"
                  : "bg-indigo-500/20"
              }`}
            >
              <span className="text-[11px] font-bold text-white">D</span>
              <span className="text-[7px] leading-tight text-white/60">Detención</span>
            </div>
            <svg viewBox="0 0 16 8" className="h-2 w-4 shrink-0 text-white/30">
              <path d="M0 4h12M10 1l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <div
              className={`flex flex-col items-center rounded-lg px-2.5 py-1.5 transition-all ${
                mode === "build" && buildViewer.activeChannel === "mv"
                  ? "bg-sky-500 shadow-lg shadow-sky-500/30"
                  : "bg-sky-500/20"
              }`}
            >
              <span className="text-[11px] font-bold text-white">M</span>
              <span className="text-[7px] leading-tight text-white/60">Movimiento</span>
            </div>
            <svg viewBox="0 0 16 8" className="h-2 w-4 shrink-0 text-white/30">
              <path d="M0 4h12M10 1l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <div
              className={`flex flex-col items-center rounded-lg px-2.5 py-1.5 transition-all ${
                mode === "build" && ["cm", "ub", "or"].includes(buildViewer.activeChannel)
                  ? "bg-indigo-500 shadow-lg shadow-indigo-500/30"
                  : "bg-indigo-500/20"
              }`}
            >
              <span className="text-[11px] font-bold text-white">D</span>
              <span className="text-[7px] leading-tight text-white/60">Detención</span>
            </div>
          </div>

          {/* Three matrices breakdown */}
          <div className="grid grid-cols-3 gap-1.5">
            {/* Matrix 1: Detención */}
            <div className="rounded-lg bg-white/5 px-2 py-1.5">
              <p className="mb-0.5 text-[8px] font-bold uppercase tracking-wider text-indigo-400">
                Detención
              </p>
              <div className="flex flex-wrap gap-0.5">
                <span className={`rounded px-1 py-px text-[8px] font-medium ${
                  mode === "build" && buildViewer.activeChannel === "cm"
                    ? "bg-indigo-500/40 text-indigo-200"
                    : "bg-white/5 text-white/40"
                }`}>CM</span>
                <span className={`rounded px-1 py-px text-[8px] font-medium ${
                  mode === "build" && buildViewer.activeChannel === "ub"
                    ? "bg-emerald-500/40 text-emerald-200"
                    : "bg-white/5 text-white/40"
                }`}>UB</span>
                <span className={`rounded px-1 py-px text-[8px] font-medium ${
                  mode === "build" && buildViewer.activeChannel === "or"
                    ? "bg-violet-500/40 text-violet-200"
                    : "bg-white/5 text-white/40"
                }`}>OR</span>
              </div>
            </div>

            {/* Matrix 2: Movimiento */}
            <div className="rounded-lg bg-white/5 px-2 py-1.5">
              <p className="mb-0.5 text-[8px] font-bold uppercase tracking-wider text-sky-400">
                Movimiento
              </p>
              <div className="flex flex-wrap gap-0.5">
                <span className={`rounded px-1 py-px text-[8px] font-medium ${
                  mode === "build" && buildViewer.activeChannel === "mv"
                    ? "bg-sky-500/40 text-sky-200"
                    : "bg-white/5 text-white/40"
                }`}>Cont.</span>
                <span className={`rounded px-1 py-px text-[8px] font-medium ${
                  mode === "build" && buildViewer.activeChannel === "mv"
                    ? "bg-sky-500/40 text-sky-200"
                    : "bg-white/5 text-white/40"
                }`}>Plano</span>
                <span className={`rounded px-1 py-px text-[8px] font-medium ${
                  mode === "build" && buildViewer.activeChannel === "mv"
                    ? "bg-sky-500/40 text-sky-200"
                    : "bg-white/5 text-white/40"
                }`}>Local</span>
              </div>
            </div>

            {/* Matrix 3: RNM */}
            <div className="rounded-lg bg-white/5 px-2 py-1.5">
              <p className="mb-0.5 text-[8px] font-bold uppercase tracking-wider text-rose-400">
                RNM
              </p>
              <div className="flex flex-wrap gap-0.5">
                <span className={`rounded px-1 py-px text-[8px] font-medium ${
                  mode === "build" && buildViewer.activeChannel === "rnm"
                    ? "bg-rose-500/40 text-rose-200"
                    : "bg-white/5 text-white/40"
                }`}>Cejas</span>
                <span className={`rounded px-1 py-px text-[8px] font-medium ${
                  mode === "build" && buildViewer.activeChannel === "rnm"
                    ? "bg-rose-500/40 text-rose-200"
                    : "bg-white/5 text-white/40"
                }`}>Boca</span>
                <span className={`rounded px-1 py-px text-[8px] font-medium ${
                  mode === "build" && buildViewer.activeChannel === "rnm"
                    ? "bg-rose-500/40 text-rose-200"
                    : "bg-white/5 text-white/40"
                }`}>Cab.</span>
              </div>
            </div>
          </div>

          {/* RNM suprasegmental bar */}
          <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/8 px-2 py-1">
            <div className="h-px flex-1 bg-rose-400/30" />
            <span className="text-[7px] font-bold uppercase tracking-widest text-rose-400/60">
              Suprasegmental
            </span>
            <div className="h-px flex-1 bg-rose-400/30" />
          </div>
        </div>
      </div>

      {/* ─── Left-side Floating Translucent Control Card ─── */}
      <div className="absolute left-3 bottom-3 z-20 flex h-[65vh] w-[35vw] flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/70 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl lg:left-5 lg:bottom-5">
        {/* ── Title header ── */}
        <div className="shrink-0 border-b border-black/5 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm font-bold text-gray-900 lg:text-base">
                Representación Fonológica{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  LSM
                </span>
              </h1>
              <p className="font-mono text-[10px] text-gray-500">
                {mode === "build"
                  ? "Construcción · Detención → Movimiento → Detención"
                  : "SEÑA = CM + UB + OR + MV + RNM"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {/* Info button */}
              <button
                onClick={() => setShowInfo(true)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-300/40 text-xs font-bold text-indigo-500 transition-colors hover:bg-indigo-500/10 hover:text-indigo-700"
                aria-label="Informaci&oacute;n"
              >
                ?
              </button>
              {/* Collapse toggle */}
              <button
                onClick={() => setPanelOpen(!panelOpen)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700"
                aria-label={panelOpen ? "Minimizar panel" : "Expandir panel"}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${panelOpen ? "" : "rotate-180"}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Mode toggle + channel tabs / matrix labels ── */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-black/5 px-2.5 py-1.5">
          {/* Mode toggle */}
          <div className="flex shrink-0 rounded-lg bg-black/5 p-0.5">
            <button
              onClick={() => setMode("explore")}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide transition-all ${
                mode === "explore"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Explorar
            </button>
            <button
              onClick={() => setMode("build")}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide transition-all ${
                mode === "build"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Construir
            </button>
          </div>

          {/* Explore mode: channel tabs */}
          {mode === "explore" && (
            <>
              <div className="h-4 w-px bg-black/10" />
              {CHANNELS.map((ch) => {
                const isActive = activeChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setActiveChannel(ch.id);
                      setPanelOpen(true);
                    }}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold tracking-wider transition-all ${
                      isActive
                        ? "text-white shadow-md"
                        : "text-gray-600 hover:bg-black/5"
                    }`}
                    style={isActive ? { backgroundColor: ch.color } : {}}
                  >
                    {ch.label}
                  </button>
                );
              })}
            </>
          )}

          {/* Build mode: compact indicator */}
          {mode === "build" && (
            <>
              <div className="h-4 w-px bg-black/10" />
              <span className="text-[10px] font-medium text-gray-500">
                D → M → D
              </span>
            </>
          )}
        </div>

        {/* ── Controls area — fills remaining space, scrollable ── */}
        {panelOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {mode === "explore" ? (
              <>
                {activeChannel === "cm" && <CMControls onCMChange={handleCMChange} />}
                {activeChannel === "ub" && (
                  <UBControls
                    onLocationChange={handleLocationChange}
                    onRegionFilter={handleRegionFilter}
                    defaultLocation={activeUBLocation}
                  />
                )}
                {activeChannel === "or" && <ORControls onOrientationChange={handleOrientationChange} />}
                {activeChannel === "mv" && <MVControls onMovementChange={handleMovementChange} />}
                {activeChannel === "rnm" && <RNMControls onFaceChange={handleFaceChange} />}
                {activeChannel === "fk" && (
                  <ArmControls
                    angles={armAngles}
                    onChange={setArmAngles}
                    fkStateRef={armFKStateRef}
                    ubCode={activeUBLocation?.code}
                    onCapture={(pose) => {
                      // eslint-disable-next-line no-console
                      console.log("Captured FK pose:", pose);
                    }}
                    onReset={() => setArmAngles(defaultArmAngles())}
                  />
                )}
              </>
            ) : (
              <div className="space-y-3">
                <SignBuilder
                  onViewerUpdate={handleViewerUpdate}
                  onSignChange={handleSignChange}
                />

                {/* Playback controls */}
                {currentSign && (
                  <PlaybackControls
                    isPlaying={isPlaying}
                    onTogglePlay={togglePlay}
                    onStop={stopPlayback}
                    loop={playbackLoop}
                    onToggleLoop={() => setPlaybackLoop((l) => !l)}
                    speed={playbackSpeed}
                    onSpeedChange={setPlaybackSpeed}
                    currentSegment={playbackFrame?.segmentIndex ?? 0}
                    totalSegments={currentSign.segments.length}
                    progress={
                      computeTotalDuration(currentSign) > 0
                        ? playbackElapsed / computeTotalDuration(currentSign)
                        : 0
                    }
                  />
                )}

                {/* Sign summary */}
                {currentSign && <SignSummary sign={currentSign} />}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Info Modal Overlay ─── */}
      {showInfo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl lg:p-8">
            {/* Close button */}
            <button
              onClick={() => setShowInfo(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-500 transition-colors hover:bg-black/10 hover:text-gray-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-1 text-lg font-bold text-gray-900">
              Unidad L&eacute;xica en LSM
            </h2>
            <p className="mb-5 text-xs text-gray-500">
              Modelo fonol&oacute;gico segmental de Cruz Aldrete (2008)
            </p>

            {/* ── What is a sign ── */}
            <div className="mb-5 rounded-xl bg-indigo-500/5 p-4">
              <h3 className="mb-1.5 text-sm font-bold text-gray-900">
                &iquest;Qu&eacute; es una se&ntilde;a?
              </h3>
              <p className="text-xs leading-relaxed text-gray-600">
                Una <strong>se&ntilde;a</strong> es la unidad l&eacute;xica m&iacute;nima con significado en la Lengua de Se&ntilde;as Mexicana (LSM).
                As&iacute; como las palabras habladas se componen de fonemas, cada se&ntilde;a se describe mediante
                <strong> par&aacute;metros fonol&oacute;gicos</strong> que, combinados en secuencia temporal, producen la articulaci&oacute;n completa.
              </p>
            </div>

            {/* ── 5 Parameters ── */}
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Los 5 par&aacute;metros fonol&oacute;gicos
            </h3>
            <div className="mb-5 grid gap-2">
              <div className="flex items-start gap-3 rounded-lg bg-black/3 p-3">
                <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: "#4f46e5" }} />
                <div>
                  <p className="text-xs font-bold text-gray-900">CM &mdash; Configuraci&oacute;n Manual</p>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    La forma que adopta la mano: qu&eacute; dedos est&aacute;n extendidos, flexionados o en contacto.
                    La LSM cuenta con un inventario de 101 configuraciones distintas organizadas en grupos articulatorios.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-black/3 p-3">
                <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: "#059669" }} />
                <div>
                  <p className="text-xs font-bold text-gray-900">UB &mdash; Ubicaci&oacute;n</p>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    El lugar del cuerpo o del espacio se&ntilde;ante donde se articula la se&ntilde;a.
                    Se divide en regiones: cabeza, tronco, brazo, mano y espacio neutro, con 80 puntos espec&iacute;ficos.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-black/3 p-3">
                <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: "#7c3aed" }} />
                <div>
                  <p className="text-xs font-bold text-gray-900">OR &mdash; Orientaci&oacute;n</p>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    Hacia d&oacute;nde apuntan la palma y los dedos de la mano.
                    Se define con dos ejes: la direcci&oacute;n de la palma (arriba, abajo, al frente, etc.) y la direcci&oacute;n de los dedos.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-black/3 p-3">
                <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: "#0284c7" }} />
                <div>
                  <p className="text-xs font-bold text-gray-900">MV &mdash; Movimiento</p>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    El desplazamiento de la mano durante la se&ntilde;a. Se describe con tres componentes:
                    <strong> contorno</strong> (recto, arco, circular), <strong>plano</strong> (horizontal, vertical, sagital)
                    y <strong>movimiento local</strong> opcional (rotaci&oacute;n, aleteo, vibraci&oacute;n, etc.).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-black/3 p-3">
                <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: "#e11d48" }} />
                <div>
                  <p className="text-xs font-bold text-gray-900">RNM &mdash; Rasgos No Manuales</p>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    Expresiones faciales y movimientos de cabeza que acompa&ntilde;an la se&ntilde;a.
                    Incluyen posici&oacute;n de cejas (levantadas, fruncidas), forma de la boca (abierta, redondeada, cerrada)
                    y movimiento de cabeza (asentir, negar, inclinar). Se aplican <em>suprasegmentalmente</em> a toda la se&ntilde;a.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Segmental matrices ── */}
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Matrices segmentales de Cruz Aldrete
            </h3>
            <div className="mb-5 rounded-xl bg-gray-900/90 p-4 backdrop-blur-sm">
              <p className="mb-3 text-[11px] leading-relaxed text-gray-300">
                Cada se&ntilde;a se descompone en una secuencia temporal de <strong className="text-indigo-300">segmentos</strong>.
                Existen dos tipos fundamentales que se alternan:
              </p>
              <div className="mb-3 flex items-center justify-center gap-2">
                <span className="rounded-lg bg-indigo-500 px-3 py-1 text-xs font-bold text-white">D &mdash; Detenci&oacute;n</span>
                <span className="text-gray-500">&rarr;</span>
                <span className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-bold text-white">M &mdash; Movimiento</span>
                <span className="text-gray-500">&rarr;</span>
                <span className="rounded-lg bg-indigo-500 px-3 py-1 text-xs font-bold text-white">D &mdash; Detenci&oacute;n</span>
              </div>
              <div className="space-y-2 text-[11px] text-gray-400">
                <p>
                  <strong className="text-indigo-300">Detenci&oacute;n (D):</strong> Un momento est&aacute;tico donde la mano se sostiene en una posici&oacute;n.
                  Se define por su <em>CM</em> + <em>UB</em> + <em>OR</em>.
                </p>
                <p>
                  <strong className="text-sky-300">Movimiento (M):</strong> La transici&oacute;n din&aacute;mica entre dos detenciones.
                  Se define por su <em>contorno</em> + <em>plano</em> + <em>movimiento local</em>.
                </p>
                <p>
                  <strong className="text-rose-300">RNM:</strong> Se aplican sobre toda la cadena segmental como una capa suprasegmental.
                </p>
              </div>
            </div>

            {/* ── How to use ── */}
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              C&oacute;mo usar esta herramienta
            </h3>
            <div className="space-y-2 text-[11px] leading-relaxed text-gray-600">
              <p>
                <strong className="text-gray-900">Modo Explorar:</strong> Navega cada par&aacute;metro de forma independiente.
                Selecciona una pesta&ntilde;a (CM, UB, OR, MV, RNM) para explorar sus valores y ver c&oacute;mo se reflejan en el modelo 3D.
              </p>
              <p>
                <strong className="text-gray-900">Modo Construir:</strong> Arma una se&ntilde;a completa paso a paso.
                Define la secuencia de segmentos D&rarr;M&rarr;D, asigna valores a cada uno y obt&eacute;n
                la notaci&oacute;n fonol&oacute;gica segmental (LSM-PN) de tu se&ntilde;a.
              </p>
            </div>

            {/* Close CTA */}
            <button
              onClick={() => setShowInfo(false)}
              className="mt-6 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
