import { describe, expect, it } from "vitest";
import {
  CORPUS_INFO,
  describirItem,
  ITEM_ID_RE,
  itemsLSM,
  itemsSignaPlay,
  SIGNAPLAY_SENAS,
  SIGNAPLAY_UNIDADES,
} from "./corpus";
import { CM_INVENTORY } from "./data";

describe("corpus para SignaPlay", () => {
  it("trae las 121 señas del banco, con ids únicos y seguros para S3", () => {
    expect(SIGNAPLAY_SENAS).toHaveLength(121);
    const ids = SIGNAPLAY_SENAS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(ITEM_ID_RE);
    expect(CORPUS_INFO.signaplay.total).toBe(121);
  });

  it("las 11 rutas cubren 120 señas y toda seña de lección existe", () => {
    expect(SIGNAPLAY_UNIDADES).toHaveLength(11);
    const enLecciones = SIGNAPLAY_UNIDADES.flatMap((u) =>
      u.lecciones.flatMap((l) => l.senas),
    );
    expect(enLecciones).toHaveLength(120);
    const ids = new Set(SIGNAPLAY_SENAS.map((s) => s.id));
    for (const id of enLecciones) expect(ids.has(id)).toBe(true);
    expect(itemsSignaPlay(null)).toHaveLength(121);
    expect(itemsSignaPlay(1)).toEqual(["SI", "NO", "MAS", ...itemsSignaPlay(1).slice(3)]);
    expect(itemsSignaPlay(99)).toEqual([]);
  });

  it("describe una seña con glosa, español y ruta", () => {
    const d = describirItem("signaplay", "POR_FAVOR");
    expect(d.titulo).toBe("POR FAVOR");
    expect(d.detalle).toContain("por favor");
    expect(d.detalle).toMatch(/ruta \d+/);
    expect(describirItem("signaplay", "NADA").titulo).toBe("NADA");
  });
});

describe("LSM Corpus", () => {
  it("los ítems son los números de CM del inventario", () => {
    expect(itemsLSM(null)).toHaveLength(CM_INVENTORY.length);
    expect(itemsLSM(1).length).toBeGreaterThan(0);
    expect(itemsLSM(null)[0]).toBe("1");
    for (const id of itemsLSM(null)) expect(id).toMatch(ITEM_ID_RE);
  });

  it("describe una CM con su seña de ejemplo y notación", () => {
    const d = describirItem("lsm", "80");
    expect(d.titulo).toBe("LETRA-I");
    expect(d.detalle).toBe("CM #80 · 4+/o-");
    expect(d.corto).toBe("80");
    expect(describirItem("lsm", "999").titulo).toBe("Seña #999");
  });
});
