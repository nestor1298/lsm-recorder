/**
 * browse.ts — búsqueda y filtros del navegador del léxico (/lexico).
 * Capa pura: recibe las filas ligeras de catalog.ts.
 */

import { CODIGO_ESPACIO_NEUTRO } from "@/lib/ub_anatomia";

/** Lo mínimo de una fila que necesitan los filtros */
export interface BrowseRow {
  gloss: string;
  spanish: string;
  synonyms: string[];
  is_lsm: boolean;
  has_phonology: boolean;
  ub: string | null;
  ub_region: string | null;
  two_handed: boolean;
}

export type Lengua = "lsm" | "otras" | "todas";
export type Manos = "todas" | "una" | "dos";
export type Lugar = "todos" | "cara" | "cuerpo" | "brazo" | "neutro";

export interface BrowseFilters {
  q: string;
  lengua: Lengua;
  manos: Manos;
  lugar: Lugar;
  soloConVideo: boolean;
}

export const FILTROS_INICIALES: BrowseFilters = {
  q: "",
  lengua: "lsm",
  manos: "todas",
  lugar: "todos",
  soloConVideo: false,
};

/** minúsculas, sin acentos ni signos: «¿Cómo estás?» → «como estas» */
export function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function lugarDe(r: Pick<BrowseRow, "ub" | "ub_region">): Exclude<Lugar, "todos"> | null {
  if (!r.ub) return null;
  if (r.ub === CODIGO_ESPACIO_NEUTRO) return "neutro";
  switch (r.ub_region) {
    case "HEAD":
    case "FACE":
      return "cara";
    case "ARM":
    case "FOREARM":
    case "HAND":
      return "brazo";
    case "NECK":
    case "TRUNK":
      return "cuerpo";
    default:
      return null;
  }
}

/**
 * Filtra y ordena: con búsqueda, primero las glosas que empiezan con el
 * texto, luego las que lo contienen y al final los sinónimos; sin
 * búsqueda, el orden alfabético de origen.
 */
export function filtra<T extends BrowseRow>(rows: T[], f: BrowseFilters): T[] {
  const q = normaliza(f.q);
  const scored: { r: T; s: number; i: number }[] = [];
  rows.forEach((r, i) => {
    if (f.lengua === "lsm" && !r.is_lsm) return;
    if (f.lengua === "otras" && r.is_lsm) return;
    if (f.soloConVideo && !r.has_phonology) return;
    if (f.manos !== "todas" && (!r.has_phonology || r.two_handed !== (f.manos === "dos"))) return;
    if (f.lugar !== "todos" && lugarDe(r) !== f.lugar) return;
    if (!q) {
      scored.push({ r, s: 0, i });
      return;
    }
    const main = normaliza(r.spanish);
    const gloss = normaliza(r.gloss.replace(/-/g, " "));
    let s = -1;
    if (main.startsWith(q) || gloss.startsWith(q)) s = 0;
    else if (main.includes(q) || gloss.includes(q)) s = 1;
    else if (r.synonyms.some((x) => normaliza(x).includes(q))) s = 2;
    if (s >= 0) scored.push({ r, s, i });
  });
  return scored.sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.r);
}
