"use client";

import type { CMEntry } from "@/lib/types";
import { getFingerGroup, TIER_COLORS, TIER_LABELS } from "@/lib/data";

function FlexionDot({ level }: { level: string }) {
  const colors: Record<string, string> = {
    EXTENDED: "bg-green-500",
    CURVED: "bg-yellow-500",
    BENT: "bg-orange-500",
    CLOSED: "bg-red-500",
  };
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${colors[level] ?? "bg-gray-300"}`}
      title={level.toLowerCase()}
    />
  );
}

interface SignCardProps {
  cm: CMEntry;
  compact?: boolean;
  selected?: boolean;
  onSelect?: (cm: CMEntry) => void;
  status?: "pending" | "recorded" | "approved" | "rejected";
}

export default function SignCard({
  cm,
  compact = false,
  selected = false,
  onSelect,
  status,
}: SignCardProps) {
  const group = getFingerGroup(cm);
  const tierClass = TIER_COLORS[cm.frequency_tier];

  const statusBadge = status && {
    pending: "bg-gray-100 text-gray-600",
    recorded: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  }[status];

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        selected
          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      } ${onSelect ? "cursor-pointer" : ""}`}
      onClick={() => onSelect?.(cm)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">#{cm.cm_id}</span>
          {cm.alpha_code && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-700">
              {cm.alpha_code}
            </span>
          )}
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tierClass}`}>
          T{cm.frequency_tier}
        </span>
      </div>

      <p className="mt-1 text-base font-semibold text-indigo-700">{cm.example_sign}</p>

      {!compact && (
        <>
          <p className="mt-1 font-mono text-xs text-gray-500">{cm.cruz_aldrete_notation}</p>

          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Fingers:</span>
            <FlexionDot level={cm.index} />
            <FlexionDot level={cm.middle} />
            <FlexionDot level={cm.ring} />
            <FlexionDot level={cm.pinky} />
            <span className="ml-1 text-xs text-gray-400">Thumb:</span>
            <FlexionDot level={cm.thumb_flexion} />
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500">
              {group.split(":")[0]}
            </span>
            {cm.spread !== "NEUTRAL" && (
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600">
                {cm.spread.toLowerCase()}
              </span>
            )}
            {cm.interaction !== "NONE" && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-600">
                {cm.interaction.toLowerCase()}
              </span>
            )}
            {cm.thumb_contact && (
              <span className="rounded bg-pink-50 px-1.5 py-0.5 text-xs text-pink-600">
                contact
              </span>
            )}
            {cm.non_selected_above && (
              <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-xs text-cyan-600">
                NSAb
              </span>
            )}
          </div>
        </>
      )}

      {status && statusBadge && (
        <div className="mt-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge}`}>
            {status}
          </span>
        </div>
      )}
    </div>
  );
}
