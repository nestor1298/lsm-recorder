import { describe, it, expect } from "vitest";
import {
  episodiosNumerados,
  esInterprete,
  filasDe,
  filtraEnunciados,
  FILTROS_CORPUS,
  idDeGlosa,
  minSeg,
  type RegistroCorpus,
  type SenaCorpus,
} from "./explorar";

function sena(glosa: string | null, cand: [string, string][] = []): SenaCorpus {
  return {
    i: 1,
    t0: 0,
    t1: 1,
    fonologia: {
      cm: [{ id: 1, puntaje: 1 }],
      ub: "EN",
      contacto: null,
      palma: null,
      dedos: null,
      contorno: null,
      plano: null,
      direccion: null,
      repeticion: null,
      dos_manos: false,
      relacion: null,
      plana: 0,
      cuadros: 5,
    },
    glosa,
    candidatos: cand.map(([id, g]) => ({ id, glosa: g, puntaje: 0.6, en_oracion: true })),
    token: glosa ?? "[CM1·EN]",
  };
}

function registro(id: string, ep: string, t0: number, texto: string, p: string | null, tr: string | null, senas: SenaCorpus[]): RegistroCorpus {
  return {
    id,
    episodio: ep,
    oracion: { texto, t0, t1: t0 + 2 },
    senante: p ? { id: p, seudonimo: p, rol: null } : null,
    sena: { t0, t1: t0 + 2, desfase_s: 0 },
    toma_primer_plano: 0.8,
    senas,
    transliteracion: tr,
  };
}

const eps = episodiosNumerados([
  { youtube_id: "bbb", duration_s: 10, upload_date: "20251101" },
  { youtube_id: "aaa", duration_s: 10, upload_date: "20251015" },
]);

describe("episodiosNumerados", () => {
  it("numera por fecha y da la fecha legible", () => {
    expect(eps.map((e) => [e.id, e.n, e.fecha])).toEqual([
      ["aaa", 1, "2025-10-15"],
      ["bbb", 2, "2025-11-01"],
    ]);
  });
});

describe("filasDe y filtraEnunciados", () => {
  const filas = filasDe(
    [
      registro("b-1", "bbb", 5, "¡Gracias por venir!", "P01", "GRACIAS VENIR", [sena("GRACIAS", [["wsl-1", "GRACIAS"]]), sena(null)]),
      registro("a-2", "aaa", 30, "Mi familia es sorda.", "P02", "[CM1·EN] FAMILIA", [sena(null), sena("FAMILIA", [["wsl-2", "FAMILIA"]])]),
      registro("a-1", "aaa", 3, "¿Cómo estás?", null, null, []),
    ],
    eps,
    new Set(["P02"]),
  );

  it("ordena por episodio y tiempo, y cuenta señas y glosas", () => {
    expect(filas.map((f) => f.id)).toEqual(["a-1", "a-2", "b-1"]);
    expect(filas[2]).toMatchObject({ n: 2, p: "P01", senas: 2, glosas: 1, pp: 0.8 });
    expect(filas[0]).toMatchObject({ p: null, tr: "", senas: 0 });
  });

  it("busca sin acentos en la oración y en la glosa", () => {
    expect(filtraEnunciados(filas, { ...FILTROS_CORPUS, q: "como" }).map((f) => f.id)).toEqual(["a-1"]);
    expect(filtraEnunciados(filas, { ...FILTROS_CORPUS, q: "GRACIAS venir" }).map((f) => f.id)).toEqual(["b-1"]);
    expect(filtraEnunciados(filas, { ...FILTROS_CORPUS, q: "gracias familia" })).toEqual([]);
  });

  it("filtra por persona, episodio y glosa", () => {
    expect(filtraEnunciados(filas, { ...FILTROS_CORPUS, persona: "P02" }).map((f) => f.id)).toEqual(["a-2"]);
    expect(filtraEnunciados(filas, { ...FILTROS_CORPUS, episodio: 1 }).map((f) => f.id)).toEqual(["a-1", "a-2"]);
    expect(filtraEnunciados(filas, { ...FILTROS_CORPUS, soloConGlosa: true }).map((f) => f.id)).toEqual(["a-2", "b-1"]);
  });

  it("marca como interpretados los enunciados de intérpretes", () => {
    expect(filas.map((f) => f.d)).toEqual([null, "interpretada", "propia"]);
    expect(filtraEnunciados(filas, { ...FILTROS_CORPUS, direccion: "interpretada" }).map((f) => f.id)).toEqual(["a-2"]);
    expect(filtraEnunciados(filas, { ...FILTROS_CORPUS, direccion: "propia" }).map((f) => f.id)).toEqual(["b-1"]);
  });
});

describe("esInterprete", () => {
  it("lee la condición o el rol del rótulo", () => {
    expect(esInterprete({ rol: "INTÉRPRETE DE PERSONA SORDOCIEGA", condicion: null })).toBe(true);
    expect(esInterprete({ rol: null, condicion: "intérprete" })).toBe(true);
    expect(esInterprete({ rol: "CONDUCTORA", condicion: null })).toBe(false);
    expect(esInterprete({ rol: "USAER MAESTRA SORDA", condicion: "sorda" })).toBe(false);
  });
});

describe("minSeg e idDeGlosa", () => {
  it("formatea minutos y segundos", () => {
    expect(minSeg(163.9)).toBe("2:43");
    expect(minSeg(5)).toBe("0:05");
  });
  it("da el id del léxico de la glosa elegida", () => {
    expect(idDeGlosa(sena("FÁCIL", [["wsl-9", "AÑO"], ["wsl-981", "FÁCIL"]]))).toBe("wsl-981");
    expect(idDeGlosa(sena(null, [["wsl-9", "AÑO"]]))).toBeNull();
  });
});
