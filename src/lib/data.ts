import type { CMEntry, FingerGroup } from "./types";
import inventoryData from "./cm_inventory.json";

export const CM_INVENTORY: CMEntry[] = inventoryData as CMEntry[];

export function getFingerGroup(cm: CMEntry): FingerGroup {
  const sf = cm.selected_fingers;
  if (sf.length === 4 && sf.includes(1) && sf.includes(2) && sf.includes(3) && sf.includes(4)) {
    return "A: Todos los dedos (1234)";
  }
  if (sf.length === 3 && sf.includes(1) && sf.includes(2) && sf.includes(3)) {
    return "B: Tres dedos (123)";
  }
  if (sf.length >= 1 && sf.length <= 2 && sf.includes(1) && sf.includes(2)) {
    return "C: Dos dedos (12)";
  }
  if (sf.length === 1 && sf.includes(1)) {
    return "D: Índice (1)";
  }
  return "E: Meñique y especiales";
}

export function getCMsByTier(tier: 1 | 2 | 3 | 4): CMEntry[] {
  return CM_INVENTORY.filter((cm) => cm.frequency_tier === tier);
}

export function getCMsByGroup(group: FingerGroup): CMEntry[] {
  return CM_INVENTORY.filter((cm) => getFingerGroup(cm) === group);
}

export const FINGER_GROUPS: FingerGroup[] = [
  "A: Todos los dedos (1234)",
  "B: Tres dedos (123)",
  "C: Dos dedos (12)",
  "D: Índice (1)",
  "E: Meñique y especiales",
];

export const TIER_LABELS: Record<number, string> = {
  1: "Frecuencia alta",
  2: "Frecuencia media",
  3: "Frecuencia baja",
  4: "Poco frecuente",
};

export const TIER_COLORS: Record<number, string> = {
  1: "bg-green-tint text-green-deep border-green",
  2: "bg-accent-tint text-accent-deep border-accent",
  3: "bg-gold-tint text-gold-deep border-gold",
  4: "bg-coral-tint text-coral-deep border-coral",
};

export const FLEXION_EMOJI: Record<string, string> = {
  EXTENDED: "straight",
  CURVED: "curved",
  BENT: "bent",
  CLOSED: "closed",
};
