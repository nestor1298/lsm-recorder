import { describe, it, expect } from "vitest";
import type { LexiconEntry } from "./types";
import { panorama } from "./panorama";

/** Entrada mínima: solo los campos que lee panorama() */
function entrada(o: {
  id: string;
  lsm?: boolean;
  cm?: number;
  ub?: string;
  dos?: boolean;
  conf?: number;
  zurda?: boolean;
  sinVideo?: boolean;
  ventana?: [number, number];
}): LexiconEntry {
  const fon = o.sinVideo
    ? null
    : {
        structure: "M",
        cm: o.cm === undefined ? null : { id: o.cm },
        ub: o.ub ? { code: o.ub, region: o.ub === "EN" ? null : "FACE" } : null,
        or: { palm: "BACK", fingers: "UP" },
        mov: { contour: "ARC", plane: "VERTICAL", repetition: { count: 2, type: "IGUAL" } },
        bimanual: { two_handed: Boolean(o.dos), relation: o.dos ? "SIMETRICA" : null, nondominant_cm: null },
      };
  return {
    id: o.id,
    gloss: o.id.toUpperCase(),
    kind: "lexical",
    variety: { language: "LSM", region: null, is_lsm: o.lsm ?? true },
    video: { duration_ms: 3000, sampled_frames: 36, frames_with_hand: 20, window_ms: o.ventana ?? [500, 1500], hand_recovery: { crop: 1, interpolated: 2, dropped: 0, rtmw3d: 1, rtmw2d: 3 } },
    phonology: fon,
    skeleton: { dominant_hand: o.zurda ? "LEFT" : "RIGHT" },
    face: { rnm: { head: "NONE", eyebrows: "NEUTRAL", mouth: "NEUTRAL" } },
    qa: { confidence: o.conf ?? 0.8, flags: o.sinVideo ? ["sin_video"] : [] },
  } as unknown as LexiconEntry;
}

describe("panorama", () => {
  const es = [
    entrada({ id: "a", cm: 3, ub: "Me", conf: 0.9 }),
    entrada({ id: "b", cm: 3, ub: "EN", dos: true, conf: 0.95, ventana: [0, 2000] }),
    entrada({ id: "c", cm: 9, ub: "Me", zurda: true, conf: 0.5 }),
    entrada({ id: "d", cm: 3, lsm: false, conf: 0.99 }),
    entrada({ id: "e", sinVideo: true }),
  ];
  const p = panorama(es, 10);
  it("cuenta el tamaño y lo medido", () => {
    expect([p.paginas, p.entradas, p.lsm, p.otrasLenguas, p.conFonologia, p.sinVideo]).toEqual([10, 5, 4, 1, 4, 1]);
    expect(p.medidas.dosManos).toBe(1);
    expect(p.medidas.zurdas).toBe(1);
    expect(p.medidas.conRepeticion).toBe(4);
  });
  it("las CM más usadas, con su ejemplo LSM de más confianza", () => {
    expect(p.cm.distintas).toBe(2);
    expect(p.cm.top[0]).toEqual({ clave: 3, n: 3, ejemplo: { id: "b", gloss: "B" } });
  });
  it("lugares y regiones (el espacio neutro aparte)", () => {
    expect(p.ub.todos).toEqual([{ clave: "Me", n: 2 }, { clave: "EN", n: 1 }]);
    expect(p.ub.regiones.map((r) => r.clave)).toEqual(["FACE", "NEUTRAL_SPACE"]);
  });
  it("una o dos manos como relación", () => {
    expect(p.relacion).toEqual([{ clave: "UNA_MANO", n: 3 }, { clave: "SIMETRICA", n: 1 }]);
  });
  it("histogramas de confianza y duración", () => {
    expect(p.confianza.reduce((s, c) => s + c.n, 0)).toBe(4);
    expect(p.confianza.at(-1)!.n).toBe(2); // 0.95 y 0.99
    expect(p.duracion[4].n).toBe(3); // 1000 ms
    expect(p.duracion[8].n).toBe(1); // 2000 ms
    expect(p.medidas.duracionMedianaMs).toBe(1000);
  });
  it("suma las manos recuperadas y cuenta banderas", () => {
    expect(p.manos).toEqual({ recorte: 4, rtmw3d: 4, rtmw2d: 12, interpoladas: 8, descartadas: 0 });
    expect(p.banderas).toEqual([{ clave: "sin_video", n: 1 }]);
  });
});
