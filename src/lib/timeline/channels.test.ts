import { describe, it, expect } from "vitest";
import { proyectar, valorDe, puntosDeCambio, CANALES } from "./channels";
import { moverFrontera, frameMs, candidatosImantado } from "./boundaries";
import type { PSHRSegment, SignAnnotation } from "@/lib/types";

const seg = (
  id: string,
  start: number,
  end: number,
  extra: Partial<PSHRSegment> = {},
): PSHRSegment => ({
  id,
  type: "M",
  phase: "STROKE",
  start_ms: start,
  end_ms: end,
  ...extra,
});

const anotacion = (segments: PSHRSegment[]): SignAnnotation => ({
  id: "a",
  cm_id: 1,
  gloss: "PRUEBA",
  created_at: "",
  updated_at: "",
  dominant_hand: "RIGHT",
  two_handed: false,
  symmetrical: false,
  notes: "",
  status: "complete",
  segments,
});

describe("proyección: fusión de contiguos iguales", () => {
  const segs = [
    seg("a", 0, 200, { cm_id: 5, location_code: "Fr" }),
    seg("b", 200, 500, { cm_id: 5, location_code: "Me" }), // misma CM, otro lugar
    seg("c", 500, 900, { cm_id: 5, location_code: "Me" }),
  ];

  it("la CM constante se lee como un solo tramo de toda la seña", () => {
    const t = proyectar(segs, "mano");
    expect(t).toHaveLength(1);
    expect(t[0].startMs).toBe(0);
    expect(t[0].endMs).toBe(900);
    expect(t[0].segmentIds).toEqual(["a", "b", "c"]);
  });

  it("guarda las fronteras internas como divisorias", () => {
    const t = proyectar(segs, "mano");
    expect(t[0].divisiones).toEqual([200, 500]);
  });

  it("el lugar sí cambia: dos tramos, el segundo fusionado", () => {
    const t = proyectar(segs, "lugar");
    expect(t.map((x) => [x.startMs, x.endMs])).toEqual([
      [0, 200],
      [200, 900],
    ]);
    expect(t[1].segmentIds).toEqual(["b", "c"]);
  });

  it("el canal maestro nunca fusiona: un tramo por segmento", () => {
    const t = proyectar(segs, "segmentos");
    expect(t).toHaveLength(3);
  });
});

describe("proyección: huecos", () => {
  it("un segmento sin esa dimensión no produce tramo (hueco)", () => {
    const segs = [
      seg("a", 0, 200, { cm_id: 5 }),
      seg("b", 200, 400), // sin CM: hueco
      seg("c", 400, 600, { cm_id: 5 }),
    ];
    const t = proyectar(segs, "mano");
    expect(t.map((x) => [x.startMs, x.endMs])).toEqual([
      [0, 200],
      [400, 600],
    ]);
  });

  it("valores iguales separados por un hueco NO se fusionan", () => {
    const segs = [
      seg("a", 0, 200, { location_code: "Fr" }),
      seg("b", 200, 400),
      seg("c", 400, 600, { location_code: "Fr" }),
    ];
    expect(proyectar(segs, "lugar")).toHaveLength(2);
  });

  it("valores iguales con salto temporal tampoco se fusionan", () => {
    const segs = [
      seg("a", 0, 200, { cm_id: 3 }),
      seg("b", 300, 500, { cm_id: 3 }), // no contiguo
    ];
    expect(proyectar(segs, "mano")).toHaveLength(2);
  });

  it("boca/cejas neutrales son hueco, no un tramo vacío", () => {
    const segs = [seg("a", 0, 200, { mouth: "NEUTRAL", eyebrows: "RAISED" })];
    expect(proyectar(segs, "rnm", undefined, "boca")).toHaveLength(0);
    expect(proyectar(segs, "rnm", undefined, "cejas")).toHaveLength(1);
  });

  it("el canal de movimiento no dibuja sobre detenciones", () => {
    const segs = [
      seg("d", 0, 200, { type: "D", phase: "HOLD", contour_movement: "ARC" }),
      seg("m", 200, 600, { contour_movement: "ARC" }),
    ];
    const t = proyectar(segs, "movimiento");
    expect(t).toHaveLength(1);
    expect(t[0].segmentIds).toEqual(["m"]);
  });
});

describe("proyección: procedencia", () => {
  it("el tramo es auto solo si todos sus segmentos lo son", () => {
    const auto = { provenance: { cm_id: "auto" as const } };
    const segs = [
      seg("a", 0, 200, { cm_id: 7, ...auto }),
      seg("b", 200, 400, { cm_id: 7, ...auto }),
    ];
    expect(proyectar(segs, "mano")[0].provenance).toBe("auto");

    const mixto = [
      seg("a", 0, 200, { cm_id: 7, ...auto }),
      seg("b", 200, 400, { cm_id: 7, provenance: { cm_id: "humano" } }),
    ];
    expect(proyectar(mixto, "mano")[0].provenance).toBeUndefined();
  });
});

describe("proyección: canales con sub-filas y mano base", () => {
  it("orientación separa palma y dedos", () => {
    const segs = [seg("a", 0, 200, { palm_facing: "BACK", finger_pointing: "UP" })];
    expect(proyectar(segs, "orientacion", undefined, "palma")[0].label).toContain("hacia mí");
    expect(proyectar(segs, "orientacion", undefined, "dedos")[0].label).toContain("arriba");
  });

  it("mano base se lee de la anotación, no del segmento", () => {
    const segs = [seg("a", 0, 200), seg("b", 200, 400)];
    const ann = { ...anotacion(segs), nondominant: { relation: "BASE_PASIVA" as const, cm_id: 2 } };
    const t = proyectar(segs, "manoBase", ann);
    expect(t).toHaveLength(1); // constante ⇒ un solo tramo
    expect(t[0].label).toContain("#2");
    expect(proyectar(segs, "manoBase", anotacion(segs))).toHaveLength(0); // sin mano base: hueco
  });

  it("los 7 canales están declarados y solo el maestro edita", () => {
    expect(CANALES.map((c) => c.id)).toEqual([
      "segmentos", "mano", "lugar", "orientacion", "movimiento", "rnm", "manoBase",
    ]);
    expect(CANALES.filter((c) => c.maestro)).toHaveLength(1);
    // reservado para el alcance propio de RNM, aún sin usar
    expect(CANALES.every((c) => c.independentScope === false)).toBe(true);
  });

  it("valorDe devuelve texto accesible legible", () => {
    const s = seg("a", 0, 200, { location_code: "Me", contact: "TOUCHING" });
    expect(valorDe("lugar", s)?.aria).toContain("mentón");
  });
});

describe("fronteras", () => {
  const base = [seg("a", 0, 200), seg("b", 200, 900)];

  it("mover una frontera compartida ajusta al vecino", () => {
    const out = moverFrontera(base, "a", "end", 350);
    expect(out[0].end_ms).toBe(350);
    expect(out[1].start_ms).toBe(350);
  });

  it("nunca produce duración menor a un cuadro", () => {
    const out = moverFrontera(base, "a", "end", 1); // pegado al inicio
    expect(out[0].end_ms - out[0].start_ms).toBeGreaterThanOrEqual(frameMs() - 1e-9);
    const out2 = moverFrontera(base, "a", "end", 100_000); // más allá del vecino
    expect(out2[1].end_ms - out2[1].start_ms).toBeGreaterThanOrEqual(frameMs() - 1e-9);
  });

  it("nunca cruza ni produce duración negativa", () => {
    for (const target of [-500, 0, 199, 201, 899, 5000]) {
      const out = moverFrontera(base, "a", "end", target);
      for (const s of out) expect(s.end_ms).toBeGreaterThan(s.start_ms);
      expect(out[0].end_ms).toBeLessThanOrEqual(out[1].end_ms);
      expect(out[0].end_ms).toBe(out[1].start_ms); // la frontera sigue siendo una
    }
  });

  it("respeta los límites del clip", () => {
    const out = moverFrontera(base, "a", "start", -300, {
      clip: { startMs: 0, endMs: 900 },
    });
    expect(out[0].start_ms).toBeGreaterThanOrEqual(0);
  });

  it("segmentos no contiguos se redimensionan sin arrastrar al vecino", () => {
    const sueltos = [seg("a", 0, 200), seg("b", 400, 900)];
    const out = moverFrontera(sueltos, "a", "end", 300);
    expect(out[0].end_ms).toBe(300);
    expect(out[1].start_ms).toBe(400);
  });
});

describe("candidatos de imantado", () => {
  const segs = [
    seg("a", 0, 200, { cm_id: 5, location_code: "Fr" }),
    seg("b", 200, 900, { cm_id: 5, location_code: "Me" }),
  ];

  it("incluye playhead, extremos del clip y cambios de otros canales", () => {
    const cambios = puntosDeCambio(segs);
    const c = candidatosImantado({
      playheadMs: 137,
      clip: { startMs: 0, endMs: 900 },
      cambios,
      conCuadros: false,
    });
    expect(c).toContain(137);
    expect(c).toContain(0);
    expect(c).toContain(900);
    expect(c).toContain(200); // cambio de lugar
  });

  it("las marcas de cuadro solo entran cuando son visibles y cerca", () => {
    const sin = candidatosImantado({
      playheadMs: 100,
      clip: { startMs: 0, endMs: 900 },
      cambios: [],
      conCuadros: false,
    });
    const con = candidatosImantado({
      playheadMs: 100,
      clip: { startMs: 0, endMs: 900 },
      cambios: [],
      conCuadros: true,
      cercaDeMs: 500,
    });
    expect(con.length).toBeGreaterThan(sin.length);
    // y no genera candidatos en todo el clip, solo alrededor
    expect(con.every((t) => t <= 900 && t >= 0)).toBe(true);
  });
});
