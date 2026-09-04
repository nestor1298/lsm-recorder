import { describe, it, expect } from "vitest";
import { migrateAnnotation, exportAnnotationAsLSMPN } from "./store";
import type { SignAnnotation } from "./types";

const base: SignAnnotation = {
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
  segments: [
    { id: "m", type: "M", phase: "STROKE", start_ms: 0, end_ms: 800 },
    { id: "d", type: "D", phase: "HOLD", start_ms: 800, end_ms: 1000 },
  ],
};

describe("migración bimanual (LSM-PN 1.0 → 1.1)", () => {
  it("two_handed+symmetrical → simétrica", () => {
    const m = migrateAnnotation({ ...base, two_handed: true, symmetrical: true });
    expect(m.nondominant?.relation).toBe("SIMETRICA");
  });
  it("two_handed solo → base pasiva con CM pendiente", () => {
    const m = migrateAnnotation({
      ...base,
      two_handed: true,
      symmetrical: false,
    });
    expect(m.nondominant?.relation).toBe("BASE_PASIVA");
    expect(m.nondominant?.cm_id).toBeUndefined();
  });
  it("una mano queda intacta", () => {
    expect(migrateAnnotation(base).nondominant).toBeUndefined();
  });
});

describe("export LSM-PN 1.1", () => {
  it("incluye versión y esquema estructural", () => {
    const out = exportAnnotationAsLSMPN(base) as Record<string, unknown>;
    expect(out.schema_version).toBe("1.1");
    expect(out.esquema).toBe("MD");
  });
});
