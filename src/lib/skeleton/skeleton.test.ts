import { describe, it, expect } from "vitest";
import { CM_INVENTORY } from "@/lib/data";
import { fingerAnglesFromCM } from "./cm_kinematics";
import { UB_ANCHORS, wristTargetFromUB } from "./ub_anchors";
import { wristRotationFromOR } from "./or_rotation";
import { armFromWrist, poseAtTime, SKEL } from "./pose_at_time";
import { rotateV, v3, norm, sub } from "./geometry";
import { migrateAnnotation } from "@/lib/store";
import type { SignAnnotation } from "@/lib/types";

const cmAbierta = CM_INVENTORY.find((c) => c.cm_id === 1)!; // 1234+/a+
const cmPuno = CM_INVENTORY.find(
  (c) =>
    c.index === "CLOSED" &&
    c.middle === "CLOSED" &&
    c.ring === "CLOSED" &&
    c.pinky === "CLOSED",
)!;

describe("cm_kinematics", () => {
  it("CM abierta produce dedos sin flexión", () => {
    const h = fingerAnglesFromCM(cmAbierta);
    expect(h.index.mcpFlex).toBeCloseTo(0, 3);
    expect(h.pinky.pipFlex).toBeCloseTo(0, 3);
  });
  it("CM puño produce flexión extrema", () => {
    const h = fingerAnglesFromCM(cmPuno);
    // 260° repartidos: MCP 35% ≈ 1.59 rad
    expect(h.index.mcpFlex).toBeGreaterThan(1.3);
    expect(h.index.pipFlex).toBeGreaterThan(1.5);
  });
});

describe("ub_anchors", () => {
  it("tiene ancla para los 80 puntos", () => {
    expect(Object.keys(UB_ANCHORS).length).toBeGreaterThanOrEqual(80);
  });
  it("contacto en la barbilla queda pegado al punto (<2 cm en xy, offset z pequeño)", () => {
    const target = wristTargetFromUB("Me", "R", "TOUCHING");
    const anchor = UB_ANCHORS["Me"];
    expect(Math.hypot(target.x - anchor.x, target.y - anchor.y)).toBeLessThan(
      0.02,
    );
    expect(target.z - anchor.z).toBeLessThanOrEqual(0.02 + 1e-9);
  });
  it("la barbilla está arriba del esternón y centrada", () => {
    const me = UB_ANCHORS["Me"];
    expect(me.y).toBeGreaterThan(0.1);
    expect(Math.abs(me.x)).toBeLessThan(0.03);
  });
});

describe("or_rotation", () => {
  it("palma abajo + dedos al frente: la normal de la palma apunta a −y", () => {
    const { quat, warning } = wristRotationFromOR("DOWN", "FORWARD", "R");
    expect(warning).toBeUndefined();
    // en el marco local la palma mira a −Z; rotada debe mirar a −y global
    const palmWorld = rotateV(quat, v3(0, 0, -1));
    expect(palmWorld.y).toBeLessThan(-0.9);
    // y los dedos (local +Y) al frente (+z)
    const fingersWorld = rotateV(quat, v3(0, 1, 0));
    expect(fingersWorld.z).toBeGreaterThan(0.9);
  });
  it("combinación imposible devuelve warning y una rotación válida", () => {
    const { quat, warning } = wristRotationFromOR("UP", "UP", "R");
    expect(warning).toBeTruthy();
    const n = Math.hypot(quat.x, quat.y, quat.z, quat.w);
    expect(n).toBeCloseTo(1, 5);
  });
});

describe("armFromWrist", () => {
  it("respeta las longitudes de los huesos", () => {
    const { shoulder, elbow, wrist } = armFromWrist(v3(0.1, 0, 0.3), "R");
    expect(norm(sub(elbow, shoulder))).toBeCloseTo(SKEL.upperArm, 2);
    expect(norm(sub(wrist, elbow))).toBeCloseTo(SKEL.forearm, 2);
  });
  it("recorta objetivos fuera de alcance", () => {
    const { wrist } = armFromWrist(v3(2, 2, 2), "R");
    expect(norm(sub(wrist, v3(SKEL.shoulderX, SKEL.shoulderY, 0)))).toBeLessThan(
      SKEL.upperArm + SKEL.forearm,
    );
  });
});

// ── DMD sintético ───────────────────────────────────────────────

function dmd(): SignAnnotation {
  return {
    id: "t",
    cm_id: cmAbierta.cm_id,
    gloss: "PRUEBA",
    created_at: "",
    updated_at: "",
    dominant_hand: "RIGHT",
    two_handed: false,
    symmetrical: false,
    notes: "",
    status: "complete",
    segments: [
      {
        id: "d1",
        type: "D",
        phase: "PREPARATION",
        start_ms: 0,
        end_ms: 200,
        cm_id: cmAbierta.cm_id,
        location_code: "Fr",
        contact: "TOUCHING",
        palm_facing: "BACK",
        finger_pointing: "UP",
      },
      {
        id: "m",
        type: "M",
        phase: "STROKE",
        start_ms: 200,
        end_ms: 800,
        cm_id: cmAbierta.cm_id,
        contour_movement: "ARC",
      },
      {
        id: "d2",
        type: "D",
        phase: "HOLD",
        start_ms: 800,
        end_ms: 1000,
        cm_id: cmPuno.cm_id,
        location_code: "Pe",
        contact: "NEAR",
        palm_facing: "DOWN",
        finger_pointing: "FORWARD",
      },
    ],
  };
}

describe("poseAtTime", () => {
  it("es determinista", () => {
    const a = dmd();
    const p1 = poseAtTime(a, 500);
    const p2 = poseAtTime(a, 500);
    expect(p1).toEqual(p2);
  });
  it("es continua (sin saltos entre frames consecutivos)", () => {
    const a = dmd();
    let prev = poseAtTime(a, 0);
    for (let t = 16; t <= 1000; t += 16) {
      const cur = poseAtTime(a, t);
      const jump = norm(sub(cur.right.wrist, prev.right.wrist));
      expect(jump).toBeLessThan(0.05);
      prev = cur;
    }
  });
  it("en D mantiene la ubicación anotada", () => {
    const a = dmd();
    const p = poseAtTime(a, 100);
    const target = wristTargetFromUB("Fr", "R", "TOUCHING");
    expect(norm(sub(p.right.wrist, target))).toBeLessThan(0.01);
  });
  it("simétrica espeja x", () => {
    const a = { ...dmd(), nondominant: { relation: "SIMETRICA" as const } };
    const p = poseAtTime(a, 100);
    expect(p.left.wrist.x).toBeCloseTo(-p.right.wrist.x, 5);
    expect(p.left.wrist.y).toBeCloseTo(p.right.wrist.y, 5);
  });
});

describe("migración bimanual", () => {
  const base = dmd();
  it("two_handed+symmetrical → simétrica", () => {
    const m = migrateAnnotation({ ...base, two_handed: true, symmetrical: true });
    expect(m.nondominant?.relation).toBe("SIMETRICA");
  });
  it("two_handed solo → base pasiva con CM pendiente", () => {
    const m = migrateAnnotation({ ...base, two_handed: true, symmetrical: false });
    expect(m.nondominant?.relation).toBe("BASE_PASIVA");
    expect(m.nondominant?.cm_id).toBeUndefined();
  });
  it("una mano queda intacta", () => {
    const m = migrateAnnotation(base);
    expect(m.nondominant).toBeUndefined();
  });
});
