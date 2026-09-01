import { describe, it, expect } from "vitest";
import { applySuggestion } from "./apply_suggestion";
import type { SignAnnotation } from "@/lib/types";
import type { PhonSuggestion } from "./phon_features";

const base: SignAnnotation = {
  id: "a",
  cm_id: 0,
  gloss: "NUEVA SEÑA",
  created_at: "",
  updated_at: "",
  dominant_hand: "RIGHT",
  two_handed: false,
  symmetrical: false,
  notes: "",
  status: "draft",
  segments: [],
};

const sug: PhonSuggestion = {
  cmCandidates: [{ cm_id: 7, score: 0.9 }],
  location_code: "Me",
  contact: "TOUCHING",
  contour: "ARC",
  direction: { x: 0, y: 0, z: 1 },
  repetition: { count: 2, type: "IGUAL" },
  palm_facing: "BACK",
  finger_pointing: "UP",
  nondominant_relation: "BASE_PASIVA",
  fin: { location_code: "Pe" },
  framesAnalyzed: 40,
  framesWithHand: 38,
};

describe("applySuggestion", () => {
  it("genera MD con campos y procedencia auto", () => {
    const out = applySuggestion(base, sug, 2000);
    expect(out.segments.map((s) => s.type)).toEqual(["M", "D"]);
    const m = out.segments[0];
    expect(m.cm_id).toBe(7);
    expect(m.location_code).toBe("Me");
    expect(m.provenance?.cm_id).toBe("auto");
    expect(m.provenance?.contour_movement).toBe("auto");
    expect(out.segments[1].location_code).toBe("Pe");
    expect(out.cm_id).toBe(7);
    expect(out.nondominant?.relation).toBe("BASE_PASIVA");
  });
  it("sin corte D produce un solo M que cubre todo", () => {
    const out = applySuggestion(base, { ...sug, fin: undefined }, 3000);
    expect(out.segments).toHaveLength(1);
    expect(out.segments[0].start_ms).toBe(0);
    expect(out.segments[0].end_ms).toBe(3000);
  });
});
