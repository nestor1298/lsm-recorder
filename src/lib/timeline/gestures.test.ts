import { describe, it, expect } from "vitest";
import {
  clasificarRueda,
  clasificarTecla,
  estadoPellizco,
  factorPellizco,
  panPellizco,
  transformacionCapa,
} from "./gestures";
import { ZOOM_STEP } from "./constants";

describe("clasificarRueda", () => {
  it("el pellizco de trackpad (ctrlKey) es zoom, no desplazamiento", () => {
    const a = clasificarRueda({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: -10 });
    expect(a.kind).toBe("zoom");
    if (a.kind === "zoom") expect(a.factor).toBeGreaterThan(1); // acerca
    const b = clasificarRueda({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: 10 });
    if (b.kind === "zoom") expect(b.factor).toBeLessThan(1); // aleja
  });

  it("la rueda con ⌘ es zoom", () => {
    expect(
      clasificarRueda({ ctrlKey: false, metaKey: true, deltaX: 0, deltaY: -5 }).kind,
    ).toBe("zoom");
  });

  it("dos dedos horizontales son desplazamiento", () => {
    const a = clasificarRueda({ ctrlKey: false, metaKey: false, deltaX: 30, deltaY: 2 });
    expect(a).toEqual({ kind: "pan", deltaPx: 30 });
  });

  it("la rueda vertical sola desplaza en el tiempo", () => {
    const a = clasificarRueda({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 40 });
    expect(a).toEqual({ kind: "pan", deltaPx: 40 });
  });

  it("convierte deltas en líneas a píxeles", () => {
    const a = clasificarRueda({ ctrlKey: false, metaKey: false, deltaX: 3, deltaY: 0, deltaMode: 1 });
    expect(a).toEqual({ kind: "pan", deltaPx: 48 });
  });
});

describe("pellizco", () => {
  it("separar los dedos acerca y juntarlos aleja", () => {
    const a = estadoPellizco({ x: 100, y: 0 }, { x: 200, y: 0 });
    const separado = estadoPellizco({ x: 50, y: 0 }, { x: 250, y: 0 });
    const junto = estadoPellizco({ x: 140, y: 0 }, { x: 160, y: 0 });
    expect(factorPellizco(a, separado)).toBeCloseTo(2, 6);
    expect(factorPellizco(a, junto)).toBeCloseTo(0.2, 6);
  });

  it("ignora el temblor por debajo del medio por ciento", () => {
    const a = estadoPellizco({ x: 100, y: 0 }, { x: 200, y: 0 });
    const casi = estadoPellizco({ x: 100, y: 0 }, { x: 200.3, y: 0 });
    expect(factorPellizco(a, casi)).toBe(1);
  });

  it("el centroide desplaza la vista en el mismo gesto", () => {
    const a = estadoPellizco({ x: 100, y: 0 }, { x: 200, y: 0 }); // centro 150
    const b = estadoPellizco({ x: 130, y: 0 }, { x: 230, y: 0 }); // centro 180
    expect(panPellizco(a, b)).toBe(-30); // el contenido sigue a los dedos
  });
});

describe("clasificarTecla", () => {
  it("mapea los atajos documentados", () => {
    expect(clasificarTecla({ key: "+", shiftKey: false })).toEqual({ kind: "zoom", factor: ZOOM_STEP });
    expect(clasificarTecla({ key: "-", shiftKey: false })).toEqual({ kind: "zoom", factor: 1 / ZOOM_STEP });
    expect(clasificarTecla({ key: "0", shiftKey: false })).toEqual({ kind: "fit" });
    expect(clasificarTecla({ key: "0", shiftKey: true })).toEqual({ kind: "fitSeleccion" });
    expect(clasificarTecla({ key: "ArrowLeft", shiftKey: false })).toEqual({ kind: "seek", cuadros: -1 });
    expect(clasificarTecla({ key: "ArrowRight", shiftKey: true })).toEqual({ kind: "seek", cuadros: 10 });
    expect(clasificarTecla({ key: "Home", shiftKey: false })).toEqual({ kind: "inicio" });
    expect(clasificarTecla({ key: "End", shiftKey: false })).toEqual({ kind: "fin" });
    expect(clasificarTecla({ key: "q", shiftKey: false })).toEqual({ kind: "nada" });
  });
});

describe("transformacionCapa", () => {
  it("previsualiza el zoom sin recalcular posiciones", () => {
    const desde = { startMs: 0, msPerPx: 2 };
    const hacia = { startMs: 100, msPerPx: 1 };
    const { scaleX, translateX } = transformacionCapa(desde, hacia);
    // un punto en t=200 estaba en x=100 y debe quedar en x=100
    const xViejo = (200 - desde.startMs) / desde.msPerPx;
    const xNuevo = (200 - hacia.startMs) / hacia.msPerPx;
    expect(translateX + scaleX * xViejo).toBeCloseTo(xNuevo, 6);
  });

  it("es identidad cuando la vista no cambió", () => {
    const v = { startMs: 37, msPerPx: 0.8 };
    expect(transformacionCapa(v, v)).toEqual({ scaleX: 1, translateX: 0 });
  });
});
