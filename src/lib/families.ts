import type { CMEntry } from "./types";

/**
 * Familias de configuraciones de mano (CM) — una capa pedagógica sobre el
 * inventario de Cruz Aldrete. La notación fonológica es precisa pero críptica;
 * estas 9 familias agrupan las 101 CM por su forma visual, con nombres en
 * lenguaje llano, derivadas de los rasgos (dedos seleccionados, flexión,
 * contacto del pulgar). La notación original sigue visible en cada tarjeta.
 */

export interface CMFamily {
  id: string;
  label: string;
  description: string;
}

export const CM_FAMILIES: CMFamily[] = [
  {
    id: "mano-abierta",
    label: "Mano abierta",
    description: "Los 4 dedos extendidos, como al saludar.",
  },
  {
    id: "puno",
    label: "Puño",
    description: "Todos los dedos cerrados sobre la palma.",
  },
  {
    id: "mano-curva",
    label: "Mano curva",
    description: "Los 4 dedos curvados, formando una C.",
  },
  {
    id: "garra",
    label: "Garra",
    description: "Los 4 dedos doblados, como una garra.",
  },
  {
    id: "indice",
    label: "Índice",
    description: "Solo el índice activo, como al señalar.",
  },
  {
    id: "dos-dedos",
    label: "Dos dedos",
    description: "Índice y medio activos, como la V.",
  },
  {
    id: "tres-dedos",
    label: "Tres dedos",
    description: "Índice, medio y anular activos.",
  },
  {
    id: "menique",
    label: "Meñique y especiales",
    description: "El meñique como protagonista: I, cuernos y formas poco comunes.",
  },
  {
    id: "pinza",
    label: "Pinza y círculo",
    description: "El pulgar toca los dedos: F, O y aros.",
  },
];

export function getCMFamilyId(cm: CMEntry): string {
  const sel = new Set(cm.selected_fingers);
  const flex = [cm.index, cm.middle, cm.ring, cm.pinky];
  const all4 = sel.size === 4;

  if (cm.thumb_contact) return "pinza";
  if (all4 && flex.every((f) => f === "EXTENDED")) return "mano-abierta";
  if (all4 && flex.every((f) => f === "CURVED")) return "mano-curva";
  if (all4 && flex.every((f) => f === "BENT")) return "garra";
  if (all4 && flex.every((f) => f === "CLOSED")) return "puno";
  if (sel.size === 1 && sel.has(1)) return "indice";
  if (sel.size === 2 && sel.has(1) && sel.has(2)) return "dos-dedos";
  if (sel.size === 3 && sel.has(1) && sel.has(2) && sel.has(3))
    return "tres-dedos";
  // meñique protagonista, un solo dedo no-índice, y formas restantes
  return "menique";
}

export function getCMFamily(cm: CMEntry): CMFamily {
  const id = getCMFamilyId(cm);
  return CM_FAMILIES.find((f) => f.id === id) ?? CM_FAMILIES[8];
}
