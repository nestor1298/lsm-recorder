import { describe, it, expect } from "vitest";
import type { PSHRSegment, SignAnnotation } from "@/lib/types";
import { senaReproducible } from "@/lib/sign_types";
import { lexiconToConstruction } from "./to_construction";
import { trackToPose3D, type LexiconTrack } from "./track3d";

const seg = (p: Partial<PSHRSegment>): PSHRSegment => ({
  id: "s",
  type: "M",
  phase: "STROKE",
  start_ms: 0,
  end_ms: 100,
  ...p,
} as PSHRSegment);

const ann = (segments: PSHRSegment[], extra: Partial<SignAnnotation> = {}): SignAnnotation => ({
  id: "wsl-1",
  cm_id: 9,
  gloss: "X",
  created_at: "",
  updated_at: "",
  dominant_hand: "RIGHT",
  segments,
  two_handed: false,
  symmetrical: false,
  notes: "",
  status: "draft",
  ...extra,
});

describe("lexiconToConstruction", () => {
  it("un M suelto queda entre dos detenciones con su lugar y forma", () => {
    const c = lexiconToConstruction(
      ann([seg({ cm_id: 9, location_code: "Me", palm_facing: "BACK", finger_pointing: "UP", contour_movement: "ARC", end_cm_id: 1 })]),
    );
    expect(c.segments.map((s) => s.type)).toEqual(["D", "M", "D"]);
    const [d1, m, d2] = c.segments;
    expect(d1.type === "D" && d1.ub?.code).toBe("Me");
    expect(d1.type === "D" && d1.cm?.cm_id).toBe(9);
    expect(d2.type === "D" && d2.cm?.cm_id).toBe(1);
    expect(m.type === "M" && m.contour).toBe("ARC");
    expect(senaReproducible(c)).toBe(true);
  });
  it("usa los D reales y el espacio neutro", () => {
    const c = lexiconToConstruction(
      ann([
        seg({ type: "D", start_ms: 0, location_code: "Fr" }),
        seg({ start_ms: 100, location_code: "EN" }),
        seg({ type: "D", start_ms: 200, location_code: "Pe" }),
      ]),
    );
    expect(c.segments.map((s) => (s.type === "D" ? s.ub?.code : "M"))).toEqual(["Fr", "M", "Pe"]);
  });
  it("repite ida y vuelta, como mucho tres veces", () => {
    const c = lexiconToConstruction(
      ann([seg({ type: "D", location_code: "Fr" }), seg({ start_ms: 1, repetition: { count: 5, type: "IGUAL" } }), seg({ type: "D", start_ms: 2, location_code: "Pe" })]),
    );
    expect(c.segments.map((s) => (s.type === "D" ? s.ub?.code : "M"))).toEqual(["Fr", "M", "Pe", "M", "Fr", "M", "Pe"]);
    expect(new Set(c.segments.map((s) => s.id)).size).toBe(c.segments.length);
  });
  it("las dos manos simétricas se reproducen con las dos manos", () => {
    const c = lexiconToConstruction(ann([seg({})], { two_handed: true, nondominant: { relation: "SIMETRICA" } }));
    expect(c.segments[0].type === "D" && c.segments[0].handMode).toBe("both_symmetric");
  });
  it("sin segmentos queda una detención en espacio neutro", () => {
    const c = lexiconToConstruction(ann([]));
    expect(c.segments).toHaveLength(1);
    expect(c.segments[0].type === "D" && c.segments[0].ub?.code).toBe("EN");
  });
});

describe("trackToPose3D", () => {
  const pose = Array.from({ length: 33 }, (_, i) => [i * 0.01, 0.5, 0.1]);
  const hand = Array.from({ length: 21 }, (_, i) => [i * 0.001, 0, 0]);
  const track: LexiconTrack = {
    schema: "lsm-lex-track/1.0",
    id: "wsl-1",
    window_index: [1, 2],
    frames: [
      { t: 0, pose_world: pose },
      { t: 83, pose_world: pose, dom_world: hand },
      { t: 166, pose_world: pose, dom_world: hand, nd_world: hand },
      { t: 250, pose_world: pose },
    ],
  };
  it("recorta a la ventana, empieza en 0 y pasa a marco de escena", () => {
    const t = trackToPose3D(track, "RIGHT");
    expect(t.frames.map((f) => f.tMs)).toEqual([0, 83]);
    expect(t.durationMs).toBe(83);
    expect(t.frames[0].pose[0].y).toBe(-0.5);
  });
  it("la mano dominante derecha se injerta en la muñeca 16", () => {
    const t = trackToPose3D(track, "RIGHT");
    expect(t.frames[0].right?.[0]).toEqual(t.frames[0].pose[16]);
    expect(t.frames[1].left?.[0]).toEqual(t.frames[1].pose[15]);
    const zurdo = trackToPose3D(track, "LEFT");
    expect(zurdo.frames[0].left?.[0]).toEqual(zurdo.frames[0].pose[15]);
  });
});

describe("trackToPose3D: piernas", () => {
  it("recoge las piernas en la cadera", () => {
    const pose = Array.from({ length: 33 }, (_, i) => [i * 0.01, i * 0.02, 0]);
    const t = trackToPose3D({ schema: "", id: "x", window_index: null, frames: [{ t: 0, pose_world: pose }] }, "RIGHT");
    expect(t.frames[0].pose[27]).toEqual(t.frames[0].pose[23]);
    expect(t.frames[0].pose[32]).toEqual(t.frames[0].pose[24]);
    expect(t.frames[0].pose[16]).not.toEqual(t.frames[0].pose[24]);
  });
});
