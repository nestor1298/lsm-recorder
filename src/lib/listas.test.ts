import { describe, expect, it } from "vitest";
import {
  claveItem,
  LISTAS,
  listaDe,
  listaDeItem,
  listaMasNecesitada,
  META_SENANTES,
  metaComunidad,
  minutosEstimados,
  resumenLista,
  TOTAL_SENAS,
  type SenantesPorItem,
} from "./listas";
import { ITEM_ID_RE } from "./aws/keys";

describe("listas", () => {
  it("cubren las 222 señas de los dos corpus sin repetir", () => {
    const todas = LISTAS.flatMap((l) => l.items.map((it) => claveItem(l.corpus, it)));
    expect(todas).toHaveLength(TOTAL_SENAS);
    expect(new Set(todas).size).toBe(TOTAL_SENAS);
    expect(TOTAL_SENAS).toBe(101 + 121);
    for (const l of LISTAS) {
      expect(l.id).toMatch(/^[a-z0-9-]+$/);
      for (const it of l.items) expect(it).toMatch(ITEM_ID_RE);
    }
  });

  it("4 listas del LSM Corpus por frecuencia y 12 de SignaPlay (11 rutas + sueltas)", () => {
    expect(LISTAS.filter((l) => l.corpus === "lsm")).toHaveLength(4);
    expect(LISTAS.filter((l) => l.corpus === "signaplay")).toHaveLength(12);
    expect(listaDe("lsm-t1")?.items).toHaveLength(30);
    expect(listaDe("sp-sueltas")?.items).toEqual(["PERRO"]);
    expect(listaDe("lsm-t1")?.prioridad).toBe(true);
    expect(listaDe("lsm-t4")?.prioridad).toBe(false);
    expect(listaDe("sp-u3")?.prioridad).toBe(true);
    expect(listaDe("sp-u4")?.prioridad).toBe(false);
  });

  it("encuentra la lista de un ítem", () => {
    expect(listaDeItem("lsm", "1")?.id).toMatch(/^lsm-t[1-4]$/);
    expect(listaDeItem("signaplay", "SI")?.id).toBe("sp-u1");
    expect(listaDeItem("signaplay", "PERRO")?.id).toBe("sp-sueltas");
    expect(listaDeItem("signaplay", "NADA")).toBeUndefined();
  });
});

describe("cobertura y meta", () => {
  it("promedia personas por seña, truncando, con tope en la meta", () => {
    const l = listaDe("sp-u1")!;
    const senantes: SenantesPorItem = {};
    expect(resumenLista(l, senantes)).toEqual({ id: "sp-u1", senantes: 0, pct: 0 });
    for (const it of l.items) senantes[claveItem("signaplay", it)] = META_SENANTES + 5;
    expect(resumenLista(l, senantes)).toEqual({ id: "sp-u1", senantes: 9, pct: 100 });
    // Una seña con 9 personas entre 9 señas → promedio 1, 11 %
    const uno: SenantesPorItem = { [claveItem("signaplay", l.items[0])]: 9 };
    expect(resumenLista(l, uno)).toEqual({ id: "sp-u1", senantes: 1, pct: 11 });
  });

  it("la meta de la comunidad suma persona × seña sobre las 222 señas", () => {
    expect(metaComunidad({})).toEqual({ pct: 0, hechas: 0, meta: 9 * 222 });
    const m = metaComunidad({ "lsm:1": 3, "signaplay:SI": 20, "signaplay:NADA": 7 });
    expect(m.hechas).toBe(3 + 9);
    expect(m.pct).toBe(0);
  });

  it("la más necesitada es la de menor cobertura; empate → prioritaria y más corta", () => {
    const res = LISTAS.map((l) => resumenLista(l, {}));
    // Todas en 0: gana una prioritaria, la más corta (ruta 1 tiene 9 señas)
    expect(listaMasNecesitada(res)).toBe("sp-u1");
    const parcial = res.map((r) => (r.id === "sp-u1" ? { ...r, pct: 100 } : r));
    expect(listaMasNecesitada(parcial)).toBe("sp-u2");
    expect(listaMasNecesitada(res.map((r) => ({ ...r, pct: 100 })))).toBeNull();
  });

  it("estima minutos en múltiplos de 5 con mínimo 5", () => {
    expect(minutosEstimados(1)).toBe(5);
    expect(minutosEstimados(9)).toBe(10);
    expect(minutosEstimados(30)).toBe(20);
    expect(minutosEstimados(39)).toBe(30);
  });
});
