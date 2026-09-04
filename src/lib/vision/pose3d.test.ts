import { describe, it, expect } from "vitest";
import {
  toScene,
  graftHand,
  assignHands,
  frameAt,
  frameBounds,
  type Pose3DTrack,
  type P3,
} from "./pose3d";

describe("toScene", () => {
  it("convierte del marco de imagen (y abajo, z al fondo) a escena", () => {
    expect(toScene({ x: 0.2, y: 0.5, z: -0.3 })).toEqual({
      x: 0.2,
      y: -0.5,
      z: 0.3,
    });
  });
});

describe("graftHand", () => {
  it("pone la muñeca de la mano exactamente sobre la muñeca de la pose", () => {
    const hand: P3[] = [
      { x: 0, y: 0, z: 0 }, // muñeca (origen propio de la mano)
      { x: 0.03, y: 0.02, z: 0 },
      { x: 0.06, y: 0.05, z: 0.01 },
    ];
    const poseWrist = { x: 0.25, y: -0.1, z: 0.4 };
    const out = graftHand(hand, poseWrist);
    expect(out[0]).toEqual(poseWrist);
    // conserva la forma: distancias internas intactas
    const d0 = Math.hypot(
      hand[2].x - hand[1].x,
      hand[2].y - hand[1].y,
      hand[2].z - hand[1].z,
    );
    const d1 = Math.hypot(
      out[2].x - out[1].x,
      out[2].y - out[1].y,
      out[2].z - out[1].z,
    );
    expect(d1).toBeCloseTo(d0, 9);
  });
});

describe("assignHands", () => {
  const poseNorm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  poseNorm[15] = { x: 0.3, y: 0.6 }; // muñeca izquierda en pantalla
  poseNorm[16] = { x: 0.7, y: 0.6 }; // muñeca derecha

  it("asigna cada mano a la muñeca más cercana", () => {
    const hands = [
      [{ x: 0.72, y: 0.61 }], // cerca de la derecha
      [{ x: 0.28, y: 0.59 }], // cerca de la izquierda
    ];
    expect(assignHands(hands, poseNorm)).toEqual({ right: 0, left: 1 });
  });

  it("con una sola mano asigna solo ese lado", () => {
    const out = assignHands([[{ x: 0.31, y: 0.62 }]], poseNorm);
    expect(out.left).toBe(0);
    expect(out.right).toBeUndefined();
  });

  it("sin pose no asigna nada", () => {
    expect(assignHands([[{ x: 0.5, y: 0.5 }]], undefined)).toEqual({});
  });
});

describe("frameAt", () => {
  const mk = (tMs: number, y: number): Pose3DTrack["frames"][0] => ({
    tMs,
    pose: Array.from({ length: 33 }, () => ({ x: 0, y, z: 0 })),
  });
  const track: Pose3DTrack = {
    frames: [mk(0, 0), mk(100, 1), mk(200, 2)],
    durationMs: 200,
  };

  it("interpola entre cuadros", () => {
    expect(frameAt(track, 50)!.pose[0].y).toBeCloseTo(0.5, 6);
    expect(frameAt(track, 150)!.pose[0].y).toBeCloseTo(1.5, 6);
  });
  it("satura en los extremos", () => {
    expect(frameAt(track, -10)!.pose[0].y).toBe(0);
    expect(frameAt(track, 999)!.pose[0].y).toBe(2);
  });
  it("sin track regresa null", () => {
    expect(frameAt(null, 10)).toBeNull();
    expect(frameAt({ frames: [], durationMs: 0 }, 10)).toBeNull();
  });
});

describe("frameBounds", () => {
  it("centra y mide el cuadro para encuadrar la cámara", () => {
    const b = frameBounds({
      tMs: 0,
      pose: [
        { x: -1, y: -1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
    });
    expect(b.center).toEqual({ x: 0, y: 0, z: 0 });
    expect(b.radius).toBeCloseTo(1, 6);
  });
});
