import { describe, it, expect } from "vitest";
import { poseDeSegmento, etiquetaSegmento, rnmDe } from "./learn_viewer";
import {
  createSignaMinima,
  agregarMovimiento,
  quitarMovimiento,
  movimientoHabilitado,
  senaReproducible,
  detencionCompleta,
  type HoldSegment,
} from "./sign_types";
import { CM_INVENTORY } from "./data";
import { UB_LOCATIONS } from "./ub_inventory";

const cm = CM_INVENTORY[0];
const fr = UB_LOCATIONS.find((l) => l.code === "Fr")!;
const pe = UB_LOCATIONS.find((l) => l.code === "Pe")!;

const completar = (d: HoldSegment, ub = fr): HoldSegment => ({
  ...d,
  cm,
  ub,
  orientation: { palm: "BACK", fingers: "UP" },
});

describe("reglas de la matriz segmental", () => {
  it("la seña mínima es una sola detención", () => {
    const s = createSignaMinima();
    expect(s.segments.map((x) => x.type)).toEqual(["D"]);
  });

  it("agregar movimiento siempre trae su detención final", () => {
    const s = agregarMovimiento(createSignaMinima());
    expect(s.segments.map((x) => x.type)).toEqual(["D", "M", "D"]);
    const s2 = agregarMovimiento(s);
    expect(s2.segments.map((x) => x.type)).toEqual(["D", "M", "D", "M", "D"]);
  });

  it("quitar un movimiento nunca deja un M sin sus dos detenciones", () => {
    const s = agregarMovimiento(agregarMovimiento(createSignaMinima()));
    const q = quitarMovimiento(s, 1);
    expect(q.segments.map((x) => x.type)).toEqual(["D", "M", "D"]);
    expect(quitarMovimiento(q, 0)).toBe(q); // un D no se quita así
  });

  it("el movimiento se habilita solo con ambas detenciones completas", () => {
    const s = agregarMovimiento(createSignaMinima());
    expect(movimientoHabilitado(s, 1)).toBe(false);
    s.segments[0] = completar(s.segments[0] as HoldSegment);
    expect(movimientoHabilitado(s, 1)).toBe(false); // falta la final
    s.segments[2] = completar(s.segments[2] as HoldSegment, pe);
    expect(movimientoHabilitado(s, 1)).toBe(true);
    expect(senaReproducible(s)).toBe(true);
  });

  it("una detención sin lugar no está completa", () => {
    const d = completar(createSignaMinima().segments[0] as HoldSegment);
    expect(detencionCompleta({ ...d, ub: null })).toBe(false);
  });
});

describe("poseDeSegmento", () => {
  const base = agregarMovimiento(createSignaMinima());
  base.segments[0] = completar(base.segments[0] as HoldSegment, fr);
  base.segments[2] = completar(base.segments[2] as HoldSegment, pe);

  it("una detención pinta su forma, lugar y orientación", () => {
    const p = poseDeSegmento(base, 0);
    expect(p.cm?.cm_id).toBe(cm.cm_id);
    expect(p.ubLocation?.code).toBe("Fr");
    expect(p.movementInterp).toBeNull();
  });

  it("un movimiento interpola de la detención anterior a la siguiente", () => {
    const p = poseDeSegmento(base, 1, 0.4);
    expect(p.movementInterp?.fromUBCode).toBe("Fr");
    expect(p.movementInterp?.toUBCode).toBe("Pe");
    expect(p.movementInterp?.t).toBeCloseTo(0.4);
  });

  it("la cara de un segmento usa sus propios rasgos o los globales", () => {
    const s = { ...base, segments: [...base.segments] };
    expect(rnmDe(s, 0).eyebrows).toBe("NEUTRAL");
    s.segments[0] = {
      ...s.segments[0],
      rnm: { eyebrows: "RAISED", mouth: "NEUTRAL", head: "NONE" },
    };
    expect(poseDeSegmento(s, 0).rnm.eyebrows).toBe("RAISED");
  });

  it("numera la matriz como D₁ M₁ D₂", () => {
    expect([0, 1, 2].map((i) => etiquetaSegmento(base, i))).toEqual([
      "D₁",
      "M₁",
      "D₂",
    ]);
  });
});
