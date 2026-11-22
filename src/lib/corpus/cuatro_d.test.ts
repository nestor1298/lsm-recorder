import { describe, it, expect } from "vitest";
import { cuadroEn, cuatroD, entradaEn } from "./cuatro_d";
import type { SenaCorpus } from "./explorar";

function sena(i: number, t0: number, t1: number, extra: Partial<SenaCorpus["fonologia"]> = {}, glosa: string | null = null): SenaCorpus {
  return {
    i,
    t0,
    t1,
    fonologia: {
      cm: [{ id: 1, puntaje: 1 }],
      ub: "EN",
      contacto: null,
      palma: "BACK",
      dedos: "UP",
      contorno: null,
      plano: null,
      direccion: null,
      repeticion: null,
      dos_manos: false,
      relacion: null,
      plana: 0,
      cuadros: 5,
      ...extra,
    },
    glosa,
    candidatos: [],
    token: glosa ?? `[CM1·EN]`,
  };
}

describe("cuatroD", () => {
  const c = cuatroD("ep-7", [
    sena(2, 11.0, 11.6, { contorno: "ARC", plano: "VERTICAL", repeticion: { count: 2, type: "IGUAL" } }, "GRACIAS"),
    sena(1, 10.0, 10.5),
  ]);

  it("ordena las señas por tiempo y les da un id estable", () => {
    expect(c.entradas.map((e) => [e.id, e.k, e.etiqueta, e.glosa])).toEqual([
      ["ep-7/1", 1, "[CM1·EN]", false],
      ["ep-7/2", 0, "GRACIAS", true],
    ]);
  });

  it("respeta el ritmo del video con un margen al inicio", () => {
    expect(c.entradas[0]).toMatchObject({ inicio: 250, fin: 750 });
    expect(c.entradas[1]).toMatchObject({ inicio: 1250, fin: 1850 });
    expect(c.duracion).toBe(2100);
  });

  it("arma D, transición y D-M-D-M-D para la seña con repetición", () => {
    expect(c.sign.segments.map((s) => s.type).join("")).toBe("DMDMDMD");
    expect(c.sign.segments[2]).toMatchObject({ type: "D", ub: { code: "EN" }, orientation: { palm: "BACK", fingers: "UP" } });
    expect(c.sign.segments[3]).toMatchObject({ type: "M", contour: "ARC" });
  });

  it("el horario es continuo de 0 a la duración", () => {
    expect(c.horario[0].inicio).toBe(0);
    expect(c.horario.at(-1)!.fin).toBe(c.duracion);
    for (let k = 1; k < c.horario.length; k++) expect(c.horario[k].inicio).toBeCloseTo(c.horario[k - 1].fin);
  });

  it("encuentra el segmento y la entrada de cada instante", () => {
    expect(cuadroEn(c, 100)).toEqual({ indice: 0, t: expect.any(Number) });
    expect(cuadroEn(c, 1000).indice).toBe(1); // transición
    expect(entradaEn(c, 1000)).toBeNull();
    expect(entradaEn(c, 1300)?.id).toBe("ep-7/2");
    expect(cuadroEn(c, 99999).indice).toBe(c.sign.segments.length - 1);
  });

  it("abre espacio para la transición cuando las señas se enciman", () => {
    const e = cuatroD("x", [sena(1, 0, 1), sena(2, 0.9, 1.5)]).entradas;
    expect(e[1].inicio - e[0].fin).toBeGreaterThanOrEqual(180);
    expect(e[0].fin - e[0].inicio).toBeGreaterThanOrEqual(120);
  });
});
