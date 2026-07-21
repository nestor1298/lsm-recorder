"use client";

import type { CMEntry } from "@/lib/types";
import { getFingerGroup, TIER_COLORS, TIER_LABELS } from "@/lib/data";

function FlexionDot({ level }: { level: string }) {
  const colors: Record<string, string> = {
    EXTENDED: "bg-green",
    CURVED: "bg-gold",
    BENT: "bg-coral",
    CLOSED: "bg-coral",
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

  const statusBadge =
    status &&
    {
      pending: "bg-gray-100 text-gray-600",
      recorded: "bg-accent-tint text-accent-deep",
      approved: "bg-green-tint text-green-deep",
      rejected: "bg-coral-tint text-coral-deep",
    }[status];

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        selected
          ? "border-accent bg-accent-tint ring-2 ring-accent-tint"
          : "border-gray-200 bg-paper hover:border-gray-300 hover:shadow-sm"
      } ${onSelect ? "cursor-pointer" : ""}`}
      onClick={() => onSelect?.(cm)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-ink">#{cm.cm_id}</span>
          {cm.alpha_code && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-700">
              {cm.alpha_code}
            </span>
          )}
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tierClass}`}
        >
          T{cm.frequency_tier}
        </span>
      </div>

      <p className="mt-1 text-base font-semibold text-accent-deep">
        {cm.example_sign}
      </p>

      {!compact && (
        <>
          <p className="mt-1 font-mono text-xs text-gray-500">
            {cm.cruz_aldrete_notation}
          </p>

          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Dedos:</span>
            <FlexionDot level={cm.index} />
            <FlexionDot level={cm.middle} />
            <FlexionDot level={cm.ring} />
            <FlexionDot level={cm.pinky} />
            <span className="ml-1 text-xs text-gray-400">Pulgar:</span>
            <FlexionDot level={cm.thumb_flexion} />
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500">
              {group.split(":")[0]}
            </span>
            {cm.spread !== "NEUTRAL" && (
              <span className="rounded bg-accent-tint px-1.5 py-0.5 text-xs text-accent-deep">
                {cm.spread.toLowerCase()}
              </span>
            )}
            {cm.interaction !== "NONE" && (
              <span className="rounded bg-gold-tint px-1.5 py-0.5 text-xs text-gold-deep">
                {cm.interaction.toLowerCase()}
              </span>
            )}
            {cm.thumb_contact && (
              <span className="rounded bg-magenta-tint px-1.5 py-0.5 text-xs text-magenta-deep">
                contacto
              </span>
            )}
            {cm.non_selected_above && (
              <span className="rounded bg-accent-tint px-1.5 py-0.5 text-xs text-accent-deep">
                NSAb
              </span>
            )}
          </div>
        </>
      )}

      {status && statusBadge && (
        <div className="mt-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge}`}
          >
            {
              {
                pending: "pendiente",
                recorded: "grabada",
                approved: "aprobada",
                rejected: "rechazada",
              }[status]
            }
          </span>
        </div>
      )}
    </div>
  );
}
