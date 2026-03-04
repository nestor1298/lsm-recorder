"use client";

import type { CMEntry } from "@/lib/types";
import { TIER_COLORS } from "@/lib/data";

interface SignPromptProps {
  cm: CMEntry;
  index: number;
  total: number;
}

export default function SignPrompt({ cm, index, total }: SignPromptProps) {
  const tierClass = TIER_COLORS[cm.frequency_tier];

  const fingerLabels = ["Index", "Middle", "Ring", "Pinky"];
  const fingerStates = [cm.index, cm.middle, cm.ring, cm.pinky];
  const thumbLabel = `${cm.thumb_opposition.toLowerCase()}, ${cm.thumb_flexion.toLowerCase()}`;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
      {/* Progress */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-600">
          Sign {index + 1} of {total}
        </span>
        <div className="h-2 flex-1 mx-4 overflow-hidden rounded-full bg-indigo-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Main sign info */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="text-2xl font-bold text-gray-900">#{cm.cm_id}</span>
          {cm.alpha_code && (
            <span className="rounded bg-white px-2 py-1 font-mono text-lg text-gray-700 shadow-sm">
              {cm.alpha_code}
            </span>
          )}
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tierClass}`}>
            T{cm.frequency_tier}
          </span>
        </div>
        <h2 className="mt-2 text-4xl font-bold text-indigo-700">{cm.example_sign}</h2>
        <p className="mt-1 font-mono text-sm text-gray-500">{cm.cruz_aldrete_notation}</p>
      </div>

      {/* Handshape details */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {/* Finger states */}
        <div className="rounded-lg bg-white p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Finger States
          </p>
          <div className="space-y-1">
            {fingerLabels.map((label, i) => {
              const isSelected = cm.selected_fingers.includes(i + 1);
              return (
                <div
                  key={label}
                  className={`flex items-center justify-between text-sm ${
                    isSelected ? "font-medium text-gray-900" : "text-gray-400"
                  }`}
                >
                  <span>
                    {label} {isSelected && "*"}
                  </span>
                  <span className="font-mono text-xs">{fingerStates[i].toLowerCase()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thumb & modifiers */}
        <div className="rounded-lg bg-white p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Thumb & Modifiers
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Thumb</span>
              <span className="font-mono text-xs text-gray-900">{thumbLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Spread</span>
              <span className="font-mono text-xs text-gray-900">{cm.spread.toLowerCase()}</span>
            </div>
            {cm.interaction !== "NONE" && (
              <div className="flex justify-between">
                <span className="text-gray-600">Interaction</span>
                <span className="font-mono text-xs text-gray-900">
                  {cm.interaction.toLowerCase()}
                </span>
              </div>
            )}
            {cm.thumb_contact && (
              <div className="text-xs text-pink-600">Thumb contact</div>
            )}
            {cm.non_selected_above && (
              <div className="text-xs text-cyan-600">Non-selected above (NSAb)</div>
            )}
          </div>
        </div>
      </div>

      {cm.notes && (
        <p className="mt-3 text-center text-xs italic text-gray-500">{cm.notes}</p>
      )}
    </div>
  );
}
