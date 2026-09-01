"use client";

import type {
  PalmFacing,
  FingerPointing,
  ForearmRotation,
} from "@/lib/types";
import {
  PALM_ES,
  FINGER_ES,
  FOREARM_ES,
  PROVENANCE_CHIP,
} from "@/lib/anotar_labels";

/**
 * Paso 4 — orientación (OR): hacia dónde mira la palma y hacia dónde
 * van los dedos, redactado desde la persona señante. Glifos de flecha;
 * hacia mí = círculo con punto, al frente = círculo con cruz
 * (convención estándar de notación).
 */

type Dir = "UP" | "DOWN" | "FORWARD" | "BACK" | "LEFT" | "RIGHT" | "NEUTRAL";

function DirGlyph({ dir }: { dir: Dir }) {
  const s = {
    stroke: "currentColor",
    strokeWidth: 4,
    strokeLinecap: "round" as const,
    fill: "none",
  };
  switch (dir) {
    case "UP":
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10">
          <path d="M24 40 V14 M14 22 24 10 34 22" {...s} />
        </svg>
      );
    case "DOWN":
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10">
          <path d="M24 8 V34 M14 26 24 38 34 26" {...s} />
        </svg>
      );
    case "LEFT":
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10">
          <path d="M40 24 H14 M22 14 10 24 22 34" {...s} />
        </svg>
      );
    case "RIGHT":
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10">
          <path d="M8 24 H34 M26 14 38 24 26 34" {...s} />
        </svg>
      );
    case "BACK": // hacia mí: círculo con punto
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10">
          <circle cx="24" cy="24" r="14" {...s} />
          <circle cx="24" cy="24" r="4" fill="currentColor" />
        </svg>
      );
    case "FORWARD": // al frente: círculo con cruz
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10">
          <circle cx="24" cy="24" r="14" {...s} />
          <path d="M15 15 33 33 M33 15 15 33" {...s} strokeWidth={3.2} />
        </svg>
      );
    case "NEUTRAL":
      return (
        <svg viewBox="0 0 48 48" className="h-10 w-10">
          <rect x="20" y="8" width="8" height="32" rx="4" fill="currentColor" />
        </svg>
      );
  }
}

const PALM_ORDER: PalmFacing[] = [
  "BACK",
  "FORWARD",
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "NEUTRAL",
];
const FINGER_ORDER: FingerPointing[] = [
  "UP",
  "DOWN",
  "FORWARD",
  "BACK",
  "LEFT",
  "RIGHT",
  "NEUTRAL",
];

function CardGroup<T extends Dir>({
  title,
  options,
  labels,
  value,
  suggested,
  onChange,
}: {
  title: string;
  options: T[];
  labels: Record<T, string>;
  value: T | undefined;
  suggested?: boolean;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        {title}
        {suggested && value && (
          <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-semibold text-accent-deep">
            {PROVENANCE_CHIP}
          </span>
        )}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {options.map((opt) => {
          const isSelected = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(isSelected ? undefined : opt)}
              aria-pressed={isSelected}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 transition-colors ${
                isSelected
                  ? "border-accent bg-accent-tint text-accent-deep"
                  : "border-gray-200 bg-paper text-gray-700 hover:border-gray-300"
              }`}
            >
              <DirGlyph dir={opt} />
              <span className="text-center text-xs font-bold leading-tight">
                {labels[opt]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface EditorOrientacionProps {
  palmFacing?: PalmFacing;
  fingerPointing?: FingerPointing;
  forearmRotation?: ForearmRotation;
  /** procedencia de los campos (para el chip Sugerido) */
  palmSuggested?: boolean;
  fingerSuggested?: boolean;
  onPalmChange: (v: PalmFacing | undefined) => void;
  onFingerChange: (v: FingerPointing | undefined) => void;
  /** presente solo donde se expone el antebrazo (modo experto) */
  onForearmChange?: (v: ForearmRotation | undefined) => void;
}

interface PasoOrientacionProps extends EditorOrientacionProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * Editor del canal Palma (orientación OR), reusable en el guiado y en
 * los canales del modo experto (donde además expone el antebrazo).
 */
export function EditorOrientacion({
  palmFacing,
  fingerPointing,
  forearmRotation,
  palmSuggested,
  fingerSuggested,
  onPalmChange,
  onFingerChange,
  onForearmChange,
}: EditorOrientacionProps) {
  return (
    <div className="space-y-6">
      <CardGroup
        title="¿Hacia dónde mira la palma?"
        options={PALM_ORDER}
        labels={PALM_ES}
        value={palmFacing}
        suggested={palmSuggested}
        onChange={onPalmChange}
      />
      <CardGroup
        title="¿Hacia dónde van los dedos?"
        options={FINGER_ORDER}
        labels={FINGER_ES}
        value={fingerPointing}
        suggested={fingerSuggested}
        onChange={onFingerChange}
      />
      {onForearmChange && (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">
            Rotación del antebrazo
          </p>
          <div className="flex gap-1.5">
            {(Object.keys(FOREARM_ES) as ForearmRotation[]).map((v) => (
              <button
                key={v}
                onClick={() =>
                  onForearmChange(forearmRotation === v ? undefined : v)
                }
                aria-pressed={forearmRotation === v}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  forearmRotation === v
                    ? "bg-ink text-paper"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {FOREARM_ES[v]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PasoOrientacion({
  onNext,
  onBack,
  ...editor
}: PasoOrientacionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">
          ¿Cómo está orientada la mano?
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Mira tu propia mano al hacer la seña.
        </p>
      </div>

      <EditorOrientacion {...editor} />

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
