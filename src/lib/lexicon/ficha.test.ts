import { describe, it, expect } from "vitest";
import { cuadroEn, flexion, momentosClave, separacion, seriesFicha, type PistaFicha } from "./ficha";

/** Mano con todos los dedos estirados hacia arriba (y negativa), en abanico si `abanico` */
function manoRecta(abanico = 0): number[][] {
  const h: number[][] = [[0, 0, 0]];
  const bases = [-0.04, -0.02, 0, 0.02, 0.04];
  for (let d = 0; d < 5; d++) {
    const ang = ((d - 2) * abanico * Math.PI) / 180;
    for (let k = 1; k <= 4; k++) h.push([bases[d] + Math.sin(ang) * 0.02 * k, -0.03 - Math.cos(ang) * 0.02 * k, 0]);
  }
  return h;
}
/** El índice doblado 90° en la PIP y en la DIP */
function indiceCerrado(): number[][] {
  const h = manoRecta();
  const [mcp, pip] = [h[5], h[6]];
  h[7] = [pip[0], pip[1], pip[2] + 0.02];
  h[8] = [pip[0], pip[1] + 0.02, pip[2] + 0.02];
  void mcp;
  return h;
}

describe("flexion", () => {
  it("un dedo estirado es 0", () => {
    expect(flexion(manoRecta(), "indice")).toBeCloseTo(0, 5);
  });
  it("doblar la PIP y la DIP 90° cada una cierra el índice 3/4", () => {
    expect(flexion(indiceCerrado(), "indice")).toBeCloseTo(180 / 240, 2);
    expect(flexion(indiceCerrado(), "medio")).toBeCloseTo(0, 5);
  });
  it("la separación crece con el abanico", () => {
    expect(separacion(manoRecta(0))).toBeCloseTo(0, 5);
    expect(separacion(manoRecta(15))).toBeGreaterThan(0.5);
    // abrir en abanico no es flexionar
    expect(flexion(manoRecta(15), "indice")).toBeLessThan(0.05);
  });
});

describe("seriesFicha", () => {
  const pose = Array.from({ length: 33 }, () => [0.5, 0.5, 0, 1]);
  pose[11] = [0.6, 0.5, 0, 1];
  pose[12] = [0.4, 0.5, 0, 1];
  const mano = Array.from({ length: 21 }, () => [0.5, 0.25, 0]);
  const pista: PistaFicha = {
    schema: "",
    id: "x",
    video: { width: 640, height: 360 },
    window_index: [1, 2],
    blendshape_order: ["jawOpen", "eyeBlinkLeft"],
    frames: [
      { t: 0, pose, pose_world: pose },
      { t: 100, pose, pose_world: pose, dom: mano, dom_world: manoRecta(), dom_src: "det", bs: [0, 1], head: [0, 0, 0] },
      { t: 183, pose, pose_world: pose, dom: mano, dom_world: manoRecta(), dom_src: "rtmw", bs: [0.6, 0], head: [2, 0, 0] },
      { t: 266, pose, pose_world: pose },
    ],
  };
  const s = seriesFicha(pista);
  it("recorta a la ventana y empieza en 0, como el esqueleto", () => {
    expect(s.tiempos).toEqual([0, 83]);
    expect(s.duracionMs).toBe(83);
  });
  it("marca las manos solo 2D", () => {
    expect(s.dom.plana).toEqual([false, true]);
  });
  it("pone el trazo en anchos de hombro, con y hacia arriba", () => {
    // palma 0.25 de alto sobre hombros en 0.5: 90 px arriba, hombros de 128 px
    expect(s.trazo.dom[0]!.x).toBeCloseTo(0);
    expect(s.trazo.dom[0]!.y).toBeCloseTo(90 / 128);
  });
  it("la cara: solo gestos que cambian, sin el parpadeo", () => {
    expect(s.cara.map((r) => r.clave)).toEqual(["jawOpen"]);
  });
});

describe("tiempo", () => {
  it("cuadroEn busca el más cercano", () => {
    expect(cuadroEn([0, 80, 160], 70)).toBe(1);
    expect(cuadroEn([0, 80, 160], 30)).toBe(0);
    expect(cuadroEn([0, 80, 160], 999)).toBe(2);
  });
  it("momentosClave no repite y salta cuadros sin mano", () => {
    expect(momentosClave([0, 1, 2, 3], [null, [], [], null], 4)).toEqual([1, 2]);
  });
});
