import { describe, it, expect } from "vitest";
import { filtra, normaliza, FILTROS_INICIALES, type BrowseRow } from "./browse";

describe("navegador: filtra", () => {
  const row = (p: Partial<BrowseRow>): BrowseRow => ({
    gloss: "X", spanish: "x", synonyms: [], is_lsm: true, has_phonology: true,
    ub: "EN", ub_region: null, two_handed: false, ...p,
  });
  const rows = [
    row({ gloss: "AGUA", spanish: "agua" }),
    row({ gloss: "AGUACATE", spanish: "aguacate", ub: "Me", ub_region: "FACE", two_handed: true }),
    row({ gloss: "BEBER", spanish: "beber", synonyms: ["tomar agua"] }),
    row({ gloss: "PARAGUAS", spanish: "paraguas", has_phonology: false, ub: null }),
    row({ gloss: "WATER", spanish: "water", is_lsm: false }),
  ];
  it("sin acentos ni signos", () => {
    expect(normaliza("¿Cómo estás?")).toBe("como estas");
  });
  it("prefijo, luego contenido, luego sinónimo", () => {
    expect(filtra(rows, { ...FILTROS_INICIALES, q: "agua" }).map((r) => r.gloss)).toEqual(["AGUA", "AGUACATE", "PARAGUAS", "BEBER"]);
  });
  it("lengua, manos, lugar y video", () => {
    expect(filtra(rows, FILTROS_INICIALES).map((r) => r.gloss)).not.toContain("WATER");
    expect(filtra(rows, { ...FILTROS_INICIALES, lengua: "otras" }).map((r) => r.gloss)).toEqual(["WATER"]);
    expect(filtra(rows, { ...FILTROS_INICIALES, manos: "dos" }).map((r) => r.gloss)).toEqual(["AGUACATE"]);
    expect(filtra(rows, { ...FILTROS_INICIALES, lugar: "cara" }).map((r) => r.gloss)).toEqual(["AGUACATE"]);
    expect(filtra(rows, { ...FILTROS_INICIALES, soloConVideo: true }).map((r) => r.gloss)).not.toContain("PARAGUAS");
  });
});
