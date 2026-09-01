import { describe, it, expect } from "vitest";
import {
  observeOrientation,
  observeDirection,
  observeRepetition,
  observeRelation,
  classifyTrajectory,
  contactFromDistance,
  observeFace,
  type Pt,
} from "./phon_features";

/** Mano sintética plana: palma hacia la cámara (BACK de la persona = FORWARD…
 * en marco señante la palma que mira a cámara mira "al frente"), dedos
 * hacia arriba (y de imagen decreciente). Mano derecha de la persona. */
function flatHand(): Pt[] {
  const h: Pt[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  h[0] = { x: 0.5, y: 0.9, z: 0 };
  const fx = [0.44, 0.48, 0.52, 0.56];
  [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]].forEach(
    (idxs, f) =>
      idxs.forEach((li, j) => {
        h[li] = { x: fx[f], y: 0.72 - 0.08 * j, z: 0 };
      }),
  );
  [1, 2, 3, 4].forEach((li, j) => {
    h[li] = { x: 0.4 - 0.02 * j, y: 0.82 - 0.02 * j, z: 0 };
  });
  return h;
}

describe("observeOrientation", () => {
  it("dedos hacia arriba se clasifican UP", () => {
    // la mano está en el lado izquierdo de la imagen = derecha de la persona
    const { fingers } = observeOrientation(flatHand(), true);
    expect(fingers).toBe("UP");
  });
  it("la normal de palma da un eje válido y cambia con la mano", () => {
    const r = observeOrientation(flatHand(), true);
    const l = observeOrientation(flatHand(), false);
    expect(r.palm).not.toBe(l.palm); // se invierte con la mano
  });
});

describe("observeDirection", () => {
  const up = Array.from({ length: 10 }, (_, i) => ({ x: 0.5, y: 0.8 - i * 0.03 }));
  it("movimiento hacia arriba en imagen → y=1 señante", () => {
    expect(observeDirection(up, 0.3)).toEqual({ x: 0, y: 1, z: 0 });
  });
  it("desplazamiento pequeño → sin dirección", () => {
    const still = Array.from({ length: 10 }, () => ({ x: 0.5, y: 0.5 }));
    expect(observeDirection(still, 0.3)).toBeUndefined();
  });
});

describe("observeRepetition", () => {
  it("oscilación de 3 ciclos → repetido", () => {
    const osc = Array.from({ length: 40 }, (_, i) => ({
      x: 0.5 + 0.12 * Math.sin((i / 40) * Math.PI * 6),
      y: 0.5,
    }));
    const r = observeRepetition(osc, 0.3);
    expect(r).toBeDefined();
    expect(r!.count).toBeGreaterThanOrEqual(2);
  });
  it("trazo simple → sin repetición", () => {
    const line = Array.from({ length: 20 }, (_, i) => ({ x: 0.3 + i * 0.02, y: 0.5 }));
    expect(observeRepetition(line, 0.3)).toBeUndefined();
  });
});

describe("observeRelation", () => {
  const N = 20;
  const domUp = Array.from({ length: N }, (_, i) => ({ x: 0.4, y: 0.8 - i * 0.02 }));
  it("base quieta → base pasiva", () => {
    const still = Array.from({ length: N }, () => ({ x: 0.6, y: 0.8 }));
    expect(observeRelation(domUp, still)).toBe("BASE_PASIVA");
  });
  it("misma fase vertical → simétrica", () => {
    const alsoUp = Array.from({ length: N }, (_, i) => ({ x: 0.6, y: 0.8 - i * 0.02 }));
    expect(observeRelation(domUp, alsoUp)).toBe("SIMETRICA");
  });
  it("fase opuesta → alternada", () => {
    const down = Array.from({ length: N }, (_, i) => ({ x: 0.6, y: 0.4 + i * 0.02 }));
    expect(observeRelation(domUp, down)).toBe("ALTERNADA");
  });
});

describe("clasificadores previos siguen estables", () => {
  it("círculo sintético → CIRCLE", () => {
    const N = 24;
    const circle = Array.from({ length: N }, (_, i) => ({
      x: 0.5 + 0.15 * Math.cos((2 * Math.PI * i) / N),
      y: 0.5 + 0.15 * Math.sin((2 * Math.PI * i) / N),
    }));
    expect(classifyTrajectory(circle, 0.3).contour).toBe("CIRCLE");
  });
  it("contacto por distancia", () => {
    expect(contactFromDistance(0.2)).toBe("TOUCHING");
    expect(contactFromDistance(1.2)).toBe("DISTANT");
  });
  it("cejas levantadas", () => {
    expect(observeFace({ browInnerUp: 0.6 }).eyebrows).toBe("RAISED");
  });
});
