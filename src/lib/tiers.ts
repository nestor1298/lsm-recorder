import type { AccessTier } from "@/lib/aws/keys";

export interface TierInfo {
  value: AccessTier;
  label: string;
  description: string;
}

// Participant-facing access tiers (es-MX, sentence case, no exclamation marks).
export const ACCESS_TIERS: TierInfo[] = [
  {
    value: "abierto",
    label: "Abierto",
    description: "Corpus público. Cualquier persona puede ver estos videos.",
  },
  {
    value: "investigacion",
    label: "Investigación",
    description: "Solo investigadores registrados pueden ver estos videos.",
  },
  {
    value: "restringido",
    label: "Restringido",
    description: "Solo el equipo de anotación puede ver estos videos.",
  },
];

export const TIER_BY_VALUE: Record<AccessTier, TierInfo> = ACCESS_TIERS.reduce(
  (acc, t) => {
    acc[t.value] = t;
    return acc;
  },
  {} as Record<AccessTier, TierInfo>,
);

export const ACCESS_TIER_VALUES: AccessTier[] = ACCESS_TIERS.map((t) => t.value);
