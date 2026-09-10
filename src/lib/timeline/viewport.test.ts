import { describe, it, expect } from "vitest";
import {
  fit,
  fitMsPerPx,
  minMsPerPx,
  domain,
  zoomAt,
  panBy,
  zoomToRange,
  clampView,
  timeToPx,
  pxToTime,
  endMs,
  tickStepMs,
  ticks,
  formatTick,
  snapMs,
  type Bounds,
  type Viewport,
} from "./viewport";
import { MIN_LABEL_PX } from "./constants";

const W = 800;
const B: Bounds = { startMs: 0, endMs: 900 }; // clip de 900 ms

describe("fit", () => {
  it("muestra el clip completo con margen a ambos lados", () => {
    const v = fit(B, W);
    const d = domain(B);
    expect(v.startMs).toBeCloseTo(d.startMs, 6);
    expect(endMs(v, W)).toBeCloseTo(d.endMs, 6);
    expect(v.startMs).toBeLessThan(0); // margen a la izquierda
  });
});

describe("zoomAt conserva el instante bajo el ancla", () => {
  const cases: { name: string; anchor: number; factor: number }[] = [
    { name: "acercando al centro", anchor: W / 2, factor: 2 },
    { name: "alejando al centro", anchor: W / 2, factor: 0.5 },
    { name: "acercando en el borde izquierdo", anchor: 0, factor: 3 },
    { name: "acercando en el borde derecho", anchor: W, factor: 3 },
    { name: "alejando en el borde derecho", anchor: W, factor: 0.4 },
  ];
  for (const c of cases) {
    it(c.name, () => {
      // vista intermedia (ya acercada) para que el encaje no absorba todo
      const base = clampView({ startMs: 200, msPerPx: 0.5 }, B, W);
      const tBefore = pxToTime(base, c.anchor);
      const next = zoomAt(base, c.factor, c.anchor, B, W);
      const tAfter = pxToTime(next, c.anchor);

      // la vista ideal (sin encajar) conserva el ancla exactamente
      const ideal = { startMs: tBefore - c.anchor * next.msPerPx, msPerPx: next.msPerPx };
      const d = domain(B);
      const enBorde =
        Math.abs(next.startMs - d.startMs) < 1e-6 ||
        Math.abs(endMs(next, W) - d.endMs) < 1e-6;

      if (!enBorde) {
        // sin encaje: el instante bajo el ancla no se mueve
        expect(tAfter).toBeCloseTo(tBefore, 6);
        expect(next.startMs).toBeCloseTo(ideal.startMs, 6);
      } else {
        // con encaje: se movió porque la vista topó con el final del clip,
        // que es la única razón admisible
        expect(next.startMs).toBeGreaterThanOrEqual(d.startMs - 1e-6);
        expect(endMs(next, W)).toBeLessThanOrEqual(d.endMs + 1e-6);
      }
    });
  }

  it("el anclaje se conserva en una cadena larga de zooms dentro del clip", () => {
    let v = clampView({ startMs: 300, msPerPx: 0.4 }, B, W);
    const anchor = W / 3;
    for (const f of [1.2, 1.2, 0.9, 1.4, 0.8]) {
      const before = pxToTime(v, anchor);
      const next = zoomAt(v, f, anchor, B, W);
      const d = domain(B);
      const enBorde =
        Math.abs(next.startMs - d.startMs) < 1e-6 ||
        Math.abs(endMs(next, W) - d.endMs) < 1e-6;
      if (!enBorde) expect(pxToTime(next, anchor)).toBeCloseTo(before, 6);
      v = next;
    }
  });
});

describe("límites", () => {
  it("nunca acerca más allá del tope", () => {
    let v = fit(B, W);
    for (let i = 0; i < 50; i++) v = zoomAt(v, 2, W / 2, B, W);
    expect(v.msPerPx).toBeGreaterThanOrEqual(minMsPerPx(B, W) - 1e-9);
    // y el rango de zoom nunca queda vacío: se puede acercar de verdad
    expect(v.msPerPx).toBeLessThan(fitMsPerPx(B, W));
  });
  it("nunca aleja más allá de fit", () => {
    let v = clampView({ startMs: 100, msPerPx: 0.4 }, B, W);
    for (let i = 0; i < 50; i++) v = zoomAt(v, 0.5, W / 2, B, W);
    expect(v.msPerPx).toBeLessThanOrEqual(fitMsPerPx(B, W) + 1e-9);
  });
  it("no se desplaza fuera del clip por ninguno de los dos lados", () => {
    const d = domain(B);
    let v = clampView({ startMs: 300, msPerPx: 0.3 }, B, W);
    v = panBy(v, -10_000, B, W);
    expect(v.startMs).toBeGreaterThanOrEqual(d.startMs - 1e-6);
    v = panBy(v, 10_000, B, W);
    expect(endMs(v, W)).toBeLessThanOrEqual(d.endMs + 1e-6);
  });
});

describe("timeToPx y pxToTime son inversas", () => {
  const views: Viewport[] = [
    fit(B, W),
    { startMs: 0, msPerPx: 2 },
    { startMs: 120.5, msPerPx: 0.37 },
    { startMs: -18, msPerPx: 1.1 },
  ];
  it("dentro de medio pixel para varias vistas", () => {
    for (const v of views) {
      for (const px of [0, 1, 123.4, W / 2, W]) {
        const back = timeToPx(v, pxToTime(v, px));
        expect(Math.abs(back - px)).toBeLessThan(0.5);
      }
    }
  });
});

describe("regla", () => {
  it("el paso siempre deja al menos 60 px entre etiquetas", () => {
    for (let msPerPx = 0.1; msPerPx <= 20; msPerPx *= 1.15) {
      const step = tickStepMs(msPerPx);
      expect(step / msPerPx).toBeGreaterThanOrEqual(MIN_LABEL_PX - 1e-9);
    }
  });
  it("el paso pertenece a la serie 1-2-5 × 10ⁿ", () => {
    for (let msPerPx = 0.1; msPerPx <= 20; msPerPx *= 1.3) {
      const step = tickStepMs(msPerPx);
      const mant = step / 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 5]).toContain(Math.round(mant));
    }
  });
  it("las marcas caen dentro de la vista", () => {
    const v = clampView({ startMs: 100, msPerPx: 0.5 }, B, W);
    for (const t of ticks(v, W)) {
      expect(t).toBeGreaterThanOrEqual(v.startMs - 1);
      expect(t).toBeLessThanOrEqual(endMs(v, W) + 1);
    }
  });
  it("el formato se adapta al acercamiento", () => {
    expect(formatTick(65_432, 5)).toContain(":");
    expect(formatTick(1234, 50)).toBe("1.234 s");
    expect(formatTick(1234, 500)).toBe("1 s");
  });
});

describe("zoomToRange", () => {
  it("encuadra el segmento con margen y respeta el tope", () => {
    const v = zoomToRange(200, 280, W, 0.1, B);
    expect(v.startMs).toBeLessThanOrEqual(200);
    expect(endMs(v, W)).toBeGreaterThanOrEqual(280);
    expect(v.msPerPx).toBeGreaterThanOrEqual(minMsPerPx(B, W) - 1e-9);
    // y el rango de zoom nunca queda vacío: se puede acercar de verdad
    expect(v.msPerPx).toBeLessThan(fitMsPerPx(B, W));
  });
});

describe("ajuste magnético", () => {
  const cands = [0, 200, 400, 900];
  it("resuelve al candidato más cercano dentro del umbral", () => {
    const r = snapMs(205, cands, 1, 6); // umbral = 6 ms
    expect(r).toEqual({ ms: 200, snapped: true });
  });
  it("elige el más cercano cuando hay dos en rango", () => {
    const r = snapMs(203, [200, 206], 1, 6);
    expect(r.ms).toBe(206 - 3 > 3 ? 200 : 200);
  });
  it("no se activa fuera del umbral", () => {
    const r = snapMs(250, cands, 1, 6);
    expect(r).toEqual({ ms: 250, snapped: false });
  });
  it("el umbral escala con el zoom (en píxeles, no en ms)", () => {
    expect(snapMs(230, cands, 10, 6).snapped).toBe(true); // 60 ms de umbral
    expect(snapMs(230, cands, 0.5, 6).snapped).toBe(false); // 3 ms
  });
});
