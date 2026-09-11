import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cuaternionManoMundo, direccionesMano } from "./orientation";

const cerca = (a: THREE.Vector3, b: [number, number, number]) =>
  a.distanceTo(new THREE.Vector3(...b)) < 1e-6;

describe("direccionesMano", () => {
  it("traduce las etiquetas a direcciones desde quien seña", () => {
    const { palma, dedos } = direccionesMano("BACK", "UP");
    expect(cerca(palma, [0, 0, -1])).toBe(true);
    expect(cerca(dedos, [0, 1, 0])).toBe(true);
  });

  it("evita palma y dedos en la misma recta", () => {
    const { palma, dedos } = direccionesMano("UP", "UP");
    expect(Math.abs(palma.dot(dedos))).toBeLessThan(1e-6);
  });
});

describe("cuaternionManoMundo", () => {
  // Calibración tipo Mixamo: dedos a lo largo de +Y, palma hacia +Z.
  const calib = {
    dedos: new THREE.Vector3(0.05, 1, 0).normalize(),
    palma: new THREE.Vector3(0, 0, 1),
  };

  it.each([
    ["FORWARD", "UP"],
    ["BACK", "UP"],
    ["DOWN", "FORWARD"],
    ["LEFT", "UP"],
    ["RIGHT", "DOWN"],
    ["UP", "LEFT"],
  ])("palma %s y dedos %s quedan donde se pidió", (palm, fingers) => {
    const q = cuaternionManoMundo(calib, palm, fingers);
    const { palma, dedos } = direccionesMano(palm, fingers);
    const d = calib.dedos.clone().applyQuaternion(q);
    const p = calib.palma.clone().applyQuaternion(q);
    expect(d.distanceTo(dedos)).toBeLessThan(0.06);
    expect(p.distanceTo(palma)).toBeLessThan(0.06);
  });
});
