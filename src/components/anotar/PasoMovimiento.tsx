"use client";

import { useState } from "react";
import type {
  ContourMovement,
  EyebrowPosition,
  LocalMovement,
  MouthShape,
  MovementDirection,
  MovementPlane,
  Repetition,
} from "@/lib/types";
import {
  CONTOUR_ES,
  LOCAL_ES,
  PLANE_ES,
  REPETITION_ES,
  directionLabel,
  PROVENANCE_CHIP,
} from "@/lib/anotar_labels";

const EYEBROWS_ES: Record<EyebrowPosition, string> = {
  NEUTRAL: "Neutrales",
  RAISED: "Levantadas",
  FURROWED: "Fruncidas",
};

const MOUTH_ES: Record<MouthShape, string> = {
  NEUTRAL: "Neutral",
  OPEN: "Abierta",
  CLOSED: "Cerrada",
  ROUNDED: "Redonda (o)",
  STRETCHED: "Estirada",
};

/**
 * Paso 4 — describir el movimiento.
 * El contorno (la trayectoria de la mano) se elige por glifo, sin leer.
 * El movimiento local (lo que hacen dedos/muñeca) y el plano son
 * opcionales y viven bajo "Más detalle".
 */

const CONTOURS: ContourMovement[] = [
  "STRAIGHT",
  "ARC",
  "CIRCLE",
  "ZIGZAG",
  "SEVEN",
];

/** Glifos de trayectoria: trazo grueso + flecha, legibles a golpe de vista */
function ContourGlyph({ contour }: { contour: ContourMovement }) {
  const stroke = {
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
    stroke: "currentColor",
  };
  switch (contour) {
    case "STRAIGHT":
      return (
        <svg viewBox="0 0 80 48" className="h-12 w-20">
          <path d="M10 24 H58" {...stroke} />
          <path d="M52 14 70 24 52 34 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "ARC":
      return (
        <svg viewBox="0 0 80 48" className="h-12 w-20">
          <path d="M10 38 Q40 2 62 26" {...stroke} />
          <path d="M64 12 68 34 46 28 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "CIRCLE":
      return (
        <svg viewBox="0 0 80 48" className="h-12 w-20">
          <path d="M52 10 A17 17 0 1 1 51 38" {...stroke} />
          <path d="M46 44 62 36 48 26 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "ZIGZAG":
      return (
        <svg viewBox="0 0 80 48" className="h-12 w-20">
          <path d="M8 14 L24 34 L40 14 L54 32" {...stroke} />
          <path d="M56 18 64 40 42 36 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "SEVEN":
      return (
        <svg viewBox="0 0 80 48" className="h-12 w-20">
          <path d="M14 12 H50 L34 38" {...stroke} />
          <path d="M42 34 30 46 26 30 Z" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

/** Mini glifo para movimientos locales (gesto pequeño repetido) */
function LocalGlyph({ local }: { local: LocalMovement }) {
  const s = {
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    fill: "none",
    stroke: "currentColor",
  };
  switch (local) {
    case "WIGGLE":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <path d="M4 12 Q9 4 14 12 T24 12 T34 12" {...s} />
        </svg>
      );
    case "CIRCULAR":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <circle cx="20" cy="12" r="8" {...s} strokeDasharray="4 3" />
        </svg>
      );
    case "TWIST":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <path d="M8 16 A12 8 0 0 1 32 16" {...s} />
          <path d="M32 16 l-5 -2 m5 2 l-1 -5" {...s} />
          <path d="M8 16 l5 2 m-5 -2 l1 5" {...s} />
        </svg>
      );
    case "SCRATCH":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <path d="M10 4 l4 8 M18 4 l4 8 M26 4 l4 8" {...s} />
          <path d="M12 18 h18" {...s} strokeDasharray="3 3" />
        </svg>
      );
    case "NOD":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <path d="M12 6 Q20 4 28 6" {...s} />
          <path d="M12 18 Q20 22 28 18" {...s} />
          <path d="M20 8 v8 m0 0 l-3 -3 m3 3 l3 -3" {...s} />
        </svg>
      );
    case "OSCILLATE":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <path d="M8 12 h24 m0 0 l-4 -4 m4 4 l-4 4 M8 12 l4 -4 m-4 4 l4 4" {...s} />
        </svg>
      );
    case "RELEASE":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <path d="M20 14 l-8 -8 M20 14 l8 -8 M20 14 l-10 2 M20 14 l10 2" {...s} />
        </svg>
      );
    case "FLATTEN":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <path d="M10 6 h20 m-20 12 h20" {...s} />
          <path d="M20 8 v6 m0 0 l-3 -3 m3 3 l3 -3" {...s} />
        </svg>
      );
    case "PROGRESSIVE":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <path d="M6 12 h6 M16 12 h6 M26 12 h8 m0 0 l-4 -4 m4 4 l-4 4" {...s} />
        </svg>
      );
    case "VIBRATE":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <path d="M6 12 l4 -6 4 12 4 -12 4 12 4 -12 4 12 4 -6" {...s} />
        </svg>
      );
    case "RUB":
      return (
        <svg viewBox="0 0 40 24" className="h-6 w-10">
          <path d="M8 10 h20 m0 0 l-4 -4 m4 4 l-4 4" {...s} />
          <path d="M32 18 h-20 m0 0 l4 -4 m-4 4 l4 4" {...s} />
        </svg>
      );
  }
}

const LOCALS: LocalMovement[] = [
  "WIGGLE",
  "CIRCULAR",
  "TWIST",
  "SCRATCH",
  "NOD",
  "OSCILLATE",
  "RELEASE",
  "FLATTEN",
  "PROGRESSIVE",
  "VIBRATE",
  "RUB",
];

const PLANES: MovementPlane[] = [
  "HORIZONTAL",
  "VERTICAL",
  "SAGITTAL",
  "OBLIQUE",
];

/** Flechas de dirección: 6 botones combinables (máx. dos ejes) */
export function DireccionControl({
  value,
  suggested,
  onChange,
}: {
  value?: MovementDirection;
  suggested?: boolean;
  onChange: (v: MovementDirection | undefined) => void;
}) {
  const d = value ?? { x: 0, y: 0, z: 0 };
  const toggle = (axis: "x" | "y" | "z", dir: -1 | 1) => {
    const next: MovementDirection = { ...d, [axis]: d[axis] === dir ? 0 : dir };
    onChange(next.x === 0 && next.y === 0 && next.z === 0 ? undefined : next);
  };
  const btn = (
    label: string,
    axis: "x" | "y" | "z",
    dir: -1 | 1,
    glyph: string,
  ) => (
    <button
      key={label}
      onClick={() => toggle(axis, dir)}
      aria-pressed={d[axis] === dir}
      aria-label={label}
      className={`rounded-xl border-2 px-3 py-2.5 text-lg font-bold transition-colors ${
        d[axis] === dir
          ? "border-accent bg-accent-tint text-accent-deep"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
      }`}
    >
      {glyph}
    </button>
  );
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        ¿Hacia dónde va?
        {suggested && value && (
          <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-semibold text-accent-deep">
            {PROVENANCE_CHIP}
          </span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {btn("Arriba", "y", 1, "↑")}
        {btn("Abajo", "y", -1, "↓")}
        {btn("A la izquierda", "x", -1, "←")}
        {btn("A la derecha", "x", 1, "→")}
        {btn("Hacia mí", "z", -1, "⊙")}
        {btn("Al frente", "z", 1, "⊗")}
        <span className="ml-1 text-xs text-gray-500">
          {value ? directionLabel(value) : "Sin dirección marcada"}
        </span>
      </div>
    </div>
  );
}

/** ¿Se repite? no / 2 veces / varias, con tipo cuando aplica */
export function RepeticionControl({
  value,
  suggested,
  onChange,
}: {
  value?: Repetition;
  suggested?: boolean;
  onChange: (v: Repetition | undefined) => void;
}) {
  const count = value?.count ?? 1;
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        ¿Se repite el movimiento?
        {suggested && value && (
          <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-semibold text-accent-deep">
            {PROVENANCE_CHIP}
          </span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {[
          { c: 1, label: "No" },
          { c: 2, label: "2 veces" },
          { c: 3, label: "Varias" },
        ].map(({ c, label }) => (
          <button
            key={c}
            onClick={() =>
              onChange(
                c === 1 ? undefined : { count: c, type: value?.type ?? "IGUAL" },
              )
            }
            aria-pressed={count === c}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              count === c
                ? "bg-ink text-paper"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
        {value && (
          <div className="flex gap-1.5">
            {(Object.keys(REPETITION_ES) as Repetition["type"][]).map((t) => (
              <button
                key={t}
                onClick={() => onChange({ ...value, type: t })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  value.type === t
                    ? "bg-accent-tint text-accent-deep"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {REPETITION_ES[t]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EditorMovimientoProps {
  contour?: ContourMovement;
  local?: LocalMovement;
  plane?: MovementPlane;
  direction?: MovementDirection;
  repetition?: Repetition;
  directionSuggested?: boolean;
  repetitionSuggested?: boolean;
  onContourChange: (v: ContourMovement | undefined) => void;
  onLocalChange: (v: LocalMovement | undefined) => void;
  onPlaneChange: (v: MovementPlane | undefined) => void;
  onDirectionChange: (v: MovementDirection | undefined) => void;
  onRepetitionChange: (v: Repetition | undefined) => void;
}

interface PasoMovimientoProps extends EditorMovimientoProps {
  eyebrows?: EyebrowPosition;
  mouth?: MouthShape;
  onEyebrowsChange: (v: EyebrowPosition | undefined) => void;
  onMouthChange: (v: MouthShape | undefined) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Editor del canal Movimiento (contorno por glifo, dirección,
 * repetición, y bajo "más detalle" el movimiento local y el plano).
 * Reusable en el guiado y en los canales del modo experto.
 */
export function EditorMovimiento({
  contour,
  local,
  plane,
  direction,
  repetition,
  directionSuggested,
  repetitionSuggested,
  onContourChange,
  onLocalChange,
  onPlaneChange,
  onDirectionChange,
  onRepetitionChange,
}: EditorMovimientoProps) {
  const [showDetail, setShowDetail] = useState(Boolean(local || plane));

  return (
    <div className="space-y-6">
      {/* Contorno por glifo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CONTOURS.map((c) => {
          const isSelected = contour === c;
          return (
            <button
              key={c}
              onClick={() => onContourChange(isSelected ? undefined : c)}
              aria-pressed={isSelected}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-colors ${
                isSelected
                  ? "border-accent bg-accent-tint text-accent-deep"
                  : "border-gray-200 bg-paper text-gray-700 hover:border-gray-300"
              }`}
            >
              <ContourGlyph contour={c} />
              <span className="text-sm font-bold">{CONTOUR_ES[c]}</span>
            </button>
          );
        })}
        {/* Sin trayectoria: la mano se queda en su lugar */}
        <button
          onClick={() => onContourChange(undefined)}
          aria-pressed={!contour}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 transition-colors ${
            !contour
              ? "border-accent bg-accent-tint text-accent-deep"
              : "border-gray-200 bg-paper text-gray-500 hover:border-gray-300"
          }`}
        >
          <svg viewBox="0 0 80 48" className="h-12 w-20">
            <circle cx="40" cy="24" r="9" fill="currentColor" />
          </svg>
          <span className="text-sm font-bold">Se queda quieta</span>
        </button>
      </div>

      {/* Dirección y repetición (matriz segmental de Cruz Aldrete) */}
      <DireccionControl
        value={direction}
        suggested={directionSuggested}
        onChange={onDirectionChange}
      />
      <RepeticionControl
        value={repetition}
        suggested={repetitionSuggested}
        onChange={onRepetitionChange}
      />

      {/* Más detalle: movimiento local + plano */}
      <button
        onClick={() => setShowDetail(!showDetail)}
        className="text-sm font-semibold text-accent-deep hover:underline"
      >
        {showDetail
          ? "Menos detalle"
          : "Más detalle (dedos, muñeca, plano)"}
      </button>

      {showDetail && (
        <div className="space-y-5 rounded-2xl bg-gray-50 p-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">
              ¿Los dedos o la muñeca hacen algo mientras tanto?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LOCALS.map((l) => {
                const isSelected = local === l;
                return (
                  <button
                    key={l}
                    onClick={() => onLocalChange(isSelected ? undefined : l)}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-accent bg-accent-tint text-accent-deep"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <LocalGlyph local={l} />
                    <span className="text-xs font-semibold leading-tight">
                      {LOCAL_ES[l]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">
              ¿En qué plano se mueve?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLANES.map((p) => (
                <button
                  key={p}
                  onClick={() => onPlaneChange(plane === p ? undefined : p)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    plane === p
                      ? "bg-ink text-white"
                      : "bg-white text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {PLANE_ES[p]}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

/**
 * Editor del canal Rostro (RNM básico): cejas y boca por chips.
 * Reusable en el guiado y en los canales del modo experto.
 */
export function EditorRostro({
  eyebrows,
  mouth,
  onEyebrowsChange,
  onMouthChange,
}: {
  eyebrows?: EyebrowPosition;
  mouth?: MouthShape;
  onEyebrowsChange: (v: EyebrowPosition | undefined) => void;
  onMouthChange: (v: MouthShape | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-14 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Cejas
        </span>
        {(Object.keys(EYEBROWS_ES) as EyebrowPosition[]).map((v) => (
          <button
            key={v}
            onClick={() => onEyebrowsChange(eyebrows === v ? undefined : v)}
            aria-pressed={eyebrows === v}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              eyebrows === v
                ? "bg-ink text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {EYEBROWS_ES[v]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-14 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Boca
        </span>
        {(Object.keys(MOUTH_ES) as MouthShape[]).map((v) => (
          <button
            key={v}
            onClick={() => onMouthChange(mouth === v ? undefined : v)}
            aria-pressed={mouth === v}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              mouth === v
                ? "bg-ink text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {MOUTH_ES[v]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PasoMovimiento({
  eyebrows,
  mouth,
  onEyebrowsChange,
  onMouthChange,
  onNext,
  onBack,
  ...editor
}: PasoMovimientoProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">¿Cómo se mueve la mano?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Elige la trayectoria que dibuja la mano en el aire.
        </p>
      </div>

      <EditorMovimiento {...editor} />

      <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
        <p className="text-sm font-semibold text-ink">¿Qué hace el rostro?</p>
        <EditorRostro
          eyebrows={eyebrows}
          mouth={mouth}
          onEyebrowsChange={onEyebrowsChange}
          onMouthChange={onMouthChange}
        />
      </div>

      <div className="flex justify-between border-t border-gray-100 pt-4">
        <button
          onClick={onBack}
          className="rounded-full px-6 py-3 font-semibold text-gray-600 hover:bg-gray-50"
        >
          Atrás
        </button>
        <button
          onClick={onNext}
          className="rounded-full bg-ink px-8 py-3 font-semibold text-paper transition-colors hover:bg-gray-800"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
