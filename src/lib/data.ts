import type { CMEntry, FingerGroup } from "./types";
import inventoryData from "./cm_inventory.json";

export const CM_INVENTORY: CMEntry[] = inventoryData as CMEntry[];

export function getFingerGroup(cm: CMEntry): FingerGroup {
  const sf = cm.selected_fingers;
  if (sf.length === 4 && sf.includes(1) && sf.includes(2) && sf.includes(3) && sf.includes(4)) {
    return "A: All Fingers (1234)";
  }
  if (sf.length === 3 && sf.includes(1) && sf.includes(2) && sf.includes(3)) {
    return "B: Three Fingers (123)";
  }
  if (sf.length >= 1 && sf.length <= 2 && sf.includes(1) && sf.includes(2)) {
    return "C: Two Fingers (12)";
  }
  if (sf.length === 1 && sf.includes(1)) {
    return "D: Index Finger (1)";
  }
  return "E: Pinky & Special";
}

export function getCMsByTier(tier: 1 | 2 | 3 | 4): CMEntry[] {
  return CM_INVENTORY.filter((cm) => cm.frequency_tier === tier);
}

export function getCMsByGroup(group: FingerGroup): CMEntry[] {
  return CM_INVENTORY.filter((cm) => getFingerGroup(cm) === group);
}

export const FINGER_GROUPS: FingerGroup[] = [
  "A: All Fingers (1234)",
  "B: Three Fingers (123)",
  "C: Two Fingers (12)",
  "D: Index Finger (1)",
  "E: Pinky & Special",
];

export const TIER_LABELS: Record<number, string> = {
  1: "High Frequency",
  2: "Medium Frequency",
  3: "Low Frequency",
  4: "Rare",
};

export const TIER_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800 border-green-300",
  2: "bg-blue-100 text-blue-800 border-blue-300",
  3: "bg-yellow-100 text-yellow-800 border-yellow-300",
  4: "bg-red-100 text-red-800 border-red-300",
};

export const FLEXION_EMOJI: Record<string, string> = {
  EXTENDED: "straight",
  CURVED: "curved",
  BENT: "bent",
  CLOSED: "closed",
};
