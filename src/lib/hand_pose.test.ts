import { describe, expect, it } from "vitest";
import { CM_INVENTORY } from "./data";
import {
  cmEntryToHandPose,
  flexionDedo,
  formaDobladoPorDedo,
  ROM_DEDO,
  ROM_PULGAR,
  type FingerName,
} from "./hand_pose";

const DEDOS: FingerName[] = ["index", "middle", "ring", "pinky"];
const RAD = Math.PI / 180;
const dentro = (v: number, [min, max]: readonly [number, number]) =>
  v >= min * RAD - 1e-9 && v <= max * RAD + 1e-9;
const cm = (id: number) => CM_INVENTORY.find((c) => c.cm_id === id)!;

describe("flexionDedo", () => {
  it("coincide con el inventario en las 101 CM (miniatura = avatar)", () => {
    for (const c of CM_INVENTORY) {
      for (const d of DEDOS) expect([c.cm_id, d, flexionDedo(c, d)]).toEqual([c.cm_id, d, c[d]]);
    }
  });

  it("CM #80 LETRA-I: solo el meñique extendido", () => {
    const i = cm(80);
    expect(DEDOS.map((d) => flexionDedo(i, d))).toEqual([
      "CLOSED",
      "CLOSED",
      "CLOSED",
      "EXTENDED",
    ]);
  });

  it("NSAb deja abiertos los no seleccionados (VACA: cuernos)", () => {
    const vaca = cm(91);
    expect(flexionDedo(vaca, "index")).toBe("EXTENDED");
    expect(flexionDedo(vaca, "pinky")).toBe("EXTENDED");
  });
});

describe("formaDobladoPorDedo", () => {
  it("distingue doblado en la base (^) de gancho (\")", () => {
    expect(formaDobladoPorDedo("1234^/a+")).toEqual({
      index: "base",
      middle: "base",
      ring: "base",
      pinky: "base",
    });
    expect(formaDobladoPorDedo('12"sep/o-')).toEqual({
      index: "gancho",
      middle: "gancho",
    });
    expect(formaDobladoPorDedo("1^2+/o+c-")).toEqual({ index: "base" });
    expect(formaDobladoPorDedo("2^°NSAb-/a+")).toEqual({ middle: "base" });
    expect(formaDobladoPorDedo("1234+/a+")).toEqual({});
  });
});

describe("cmEntryToHandPose", () => {
  it("ninguna CM sale del rango de movimiento articular", () => {
    for (const c of CM_INVENTORY) {
      const p = cmEntryToHandPose(c);
      for (const d of DEDOS) {
        expect(dentro(p[d].mcpFlex, ROM_DEDO.mcp)).toBe(true);
        expect(dentro(p[d].pipFlex, ROM_DEDO.pip)).toBe(true);
        expect(dentro(p[d].dipFlex, ROM_DEDO.dip)).toBe(true);
        expect(dentro(p[d].carpalSpread, ROM_DEDO.abduccion)).toBe(true);
      }
      expect(dentro(p.thumb.mcpFlex, ROM_PULGAR.mcp)).toBe(true);
      expect(dentro(p.thumb.ipFlex, ROM_PULGAR.ip)).toBe(true);
      expect(dentro(p.thumb.cmcOpposition, ROM_PULGAR.cmc)).toBe(true);
      expect(dentro(p.thumb.cmcRotation, ROM_PULGAR.cmcRotacion)).toBe(true);
    }
  });

  it("cerrado es puño, no garra: la base se flexiona casi por completo", () => {
    const p = cmEntryToHandPose(cm(80));
    for (const d of ["index", "middle", "ring"] as const) {
      expect(p[d].mcpFlex).toBeGreaterThanOrEqual(85 * RAD);
      expect(p[d].pipFlex).toBeGreaterThanOrEqual(100 * RAD);
    }
    expect(p.pinky.mcpFlex).toBe(0);
  });

  it("doblado ^ dobla la base con el dedo recto; \" engancha las falanges", () => {
    const base = cmEntryToHandPose(cm(15)).index; // CUCHARA 1234^
    expect(base.mcpFlex).toBeGreaterThan(70 * RAD);
    expect(base.pipFlex).toBeLessThan(15 * RAD);
    const gancho = cmEntryToHandPose(cm(42)).index; // PESERO 12"sep
    expect(gancho.mcpFlex).toBeLessThan(20 * RAD);
    expect(gancho.pipFlex).toBeGreaterThan(70 * RAD);
  });
});
