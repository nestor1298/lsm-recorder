import { describe, expect, it } from "vitest";
import {
  atlasDe,
  casiCompletas,
  circuloDe,
  GRUPOS_ATLAS,
  MANOS_POR_SENA,
  momentosAlGuardar,
  RUTAS,
  rutasDe,
  senasCompletas,
} from "./nueve_manos";
import { CM_INVENTORY } from "./data";
import { claveItem, TOTAL_SENAS } from "./listas";
import { ESTADOS_MX } from "./estados_mx";
import { MAPA_COLS, MAPA_FILAS, MAPA_MX } from "./mapa_mx";

describe("el círculo de una seña", () => {
  it("nueve manos lo cierran; nada raro con valores malos", () => {
    expect(MANOS_POR_SENA).toBe(9);
    expect(circuloDe(4)).toEqual({ manos: 4, de: 9, faltan: 5, completo: false });
    expect(circuloDe(9).completo).toBe(true);
    expect(circuloDe(12)).toMatchObject({ faltan: 0, completo: true });
    expect(circuloDe(-3).manos).toBe(0);
    expect(circuloDe(Number.NaN).manos).toBe(0);
  });
});

describe("atlas de la mano", () => {
  it("los cinco grupos cubren las 101 configuraciones sin repetir", () => {
    expect(GRUPOS_ATLAS.map((g) => g.id)).toEqual(["A", "B", "C", "D", "E"]);
    const todas = GRUPOS_ATLAS.flatMap((g) => g.cms);
    expect(todas.length).toBe(CM_INVENTORY.length);
    expect(new Set(todas).size).toBe(CM_INVENTORY.length);
    expect(GRUPOS_ATLAS[0]).toMatchObject({ nombre: "Todos los dedos", dedos: "1234" });
  });

  it("cuenta lo tuyo por grupo y marca el grupo completo", () => {
    const b = GRUPOS_ATLAS.find((g) => g.id === "B")!;
    const a = atlasDe([...b.cms, GRUPOS_ATLAS[0].cms[0]]);
    expect(a.tuyas).toBe(b.cms.length + 1);
    expect(a.total).toBe(CM_INVENTORY.length);
    expect(a.grupos.find((g) => g.grupo.id === "B")!.completo).toBe(true);
    expect(a.grupos.find((g) => g.grupo.id === "A")!.completo).toBe(false);
  });
});

describe("sellos de ruta", () => {
  it("una ruta grabada completa es un sello", () => {
    expect(RUTAS).toHaveLength(11);
    expect(RUTAS[0].nombre).not.toMatch(/^Ruta/);
    const r = rutasDe(RUTAS[0].items);
    expect(r[0]).toMatchObject({ sellada: true, tuyas: RUTAS[0].items.length });
    expect(r[1].sellada).toBe(false);
  });
});

describe("momentos al guardar", () => {
  it("la primera vez, tu mano y la novena cierra el círculo", () => {
    expect(
      momentosAlGuardar({ corpus: "lsm", itemId: "5", mano: 9, videos: 1, antes: [] }),
    ).toEqual([{ tipo: "primera" }, { tipo: "mano", mano: 9 }, { tipo: "circulo" }]);
    expect(
      momentosAlGuardar({ corpus: "lsm", itemId: "5", mano: null, videos: 7, antes: [] }),
    ).toEqual([{ tipo: "mano", mano: null }]);
  });

  it("completar un grupo del atlas", () => {
    const b = GRUPOS_ATLAS.find((g) => g.id === "B")!;
    const [ultima, ...resto] = b.cms;
    const antes = resto.map((id) => claveItem("lsm", String(id)));
    const m = momentosAlGuardar({ corpus: "lsm", itemId: String(ultima), mano: 2, videos: 9, antes });
    expect(m).toContainEqual({ tipo: "grupo", grupo: "B" });
    // si ya estaba, no se celebra otra vez
    const otra = momentosAlGuardar({
      corpus: "lsm",
      itemId: String(ultima),
      mano: 2,
      videos: 9,
      antes: [...antes, claveItem("lsm", String(ultima))],
    });
    expect(otra.some((x) => x.tipo === "grupo")).toBe(false);
  });

  it("sellar una ruta de SignaPlay", () => {
    const [ultima, ...resto] = RUTAS[0].items;
    const antes = resto.map((i) => claveItem("signaplay", i));
    const m = momentosAlGuardar({ corpus: "signaplay", itemId: ultima, mano: 1, videos: 20, antes });
    expect(m).toContainEqual({ tipo: "sello", ruta: 1 });
  });
});

describe("la comunidad", () => {
  it("primero las que están a una mano, sin las tuyas", () => {
    const sp = RUTAS[0].items;
    const senantes = {
      [claveItem("lsm", "1")]: 8,
      [claveItem("lsm", "2")]: 6,
      [claveItem("lsm", "3")]: 9,
      [claveItem("signaplay", sp[0])]: 8,
      [claveItem("lsm", "4")]: 0,
    };
    const casi = casiCompletas(senantes, new Set([claveItem("signaplay", sp[0])]));
    expect(casi.map((s) => s.itemId)).toEqual(["1", "2"]);
    expect(casi[0].faltan).toBe(1);
    expect(senasCompletas(senantes)).toBe(1);
  });

  it("el mapa tiene los 32 estados, cada uno en su casilla", () => {
    expect(TOTAL_SENAS).toBe(222);
    expect(MAPA_MX.map((c) => c.estado).sort()).toEqual([...ESTADOS_MX].sort());
    const casillas = new Set(MAPA_MX.map((c) => `${c.col},${c.fila}`));
    expect(casillas.size).toBe(32);
    for (const c of MAPA_MX) {
      expect(c.col).toBeLessThan(MAPA_COLS);
      expect(c.fila).toBeLessThan(MAPA_FILAS);
    }
  });
});
