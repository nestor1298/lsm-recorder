import { describe, it, expect } from "vitest";
import { CM_INVENTORY } from "@/lib/data";
import { observeLocation, type Pt } from "@/lib/vision/phon/phon_features";
import {
  breakCmTie,
  buildEntry,
  canonicalHand,
  fineLocation,
  notationOf,
  parseLabel,
  refineZigzag,
  signingWindow,
  ubAnchor,
  type RawFrame,
  type V3,
} from "./derive";

const cm = (id: number) => CM_INVENTORY.find((c) => c.cm_id === id)!;

describe("parseLabel", () => {
  it("separa variante, variedad y tipo", () => {
    expect(parseLabel("Aceite (A)")).toMatchObject({ spanish: "Aceite", gloss: "ACEITE(A)", variant: "A" });
    expect(parseLabel("a veces").gloss).toBe("A-VECES");
    expect(parseLabel("¿cómo estás").kind).toBe("phrase");
    expect(parseLabel("a").kind).toBe("fingerspelling");
    expect(parseLabel("Europa (LSM)").variety).toEqual({ language: "LSM", region: null, is_lsm: true });
  });
  it("separa los sinónimos que Wikisigns junta con comas", () => {
    expect(parseLabel("Abandonar, Dejar")).toMatchObject({ gloss: "ABANDONAR", synonyms: ["Dejar"] });
    expect(parseLabel("a lo largo, largamente, largo").gloss).toBe("A-LO-LARGO");
    expect(parseLabel("Austin, EUA (ASL)").variety).toEqual({ language: "ASL", region: null, is_lsm: false });
  });
  it("marca las señas de otra lengua y las regionales", () => {
    const asl = parseLabel("Abraham Lincoln  (variedad distinta de ASL utilizado en los EUA)");
    expect(asl.variety).toEqual({ language: "ASL", region: "los EUA", is_lsm: false });
    const cul = parseLabel("Almendra (variedad distinta de LSM utilizado en Culiacán)");
    expect(cul.variety).toEqual({ language: "LSM", region: "Culiacán", is_lsm: true });
    expect(parseLabel("Albania (Señas Internacional)").variety.is_lsm).toBe(false);
    expect(parseLabel("Aleluya (Cristiano)").qualifiers).toEqual(["Cristiano"]);
    expect(parseLabel("Alvaro Obregon (Deleg. Méx").spanish).toBe("Alvaro Obregon");
  });
});

describe("canonicalHand", () => {
  it("puño S: MCP/PIP/DIP como hand_pose.ts, en huesos Left* para la dominante", () => {
    const h = canonicalHand(cm(9), "dominant");
    const mcp = h.bones.find((b) => b.joint === "index.MCP")!;
    expect(mcp.bone).toBe("LeftHandIndex1");
    expect(mcp.euler_xyz_deg[0]).toBe(90);
    expect(h.bones.find((b) => b.joint === "index.PIP")!.bone).toBe("LeftHandIndex2");
    expect(h.bones).toHaveLength(15);
  });
  it("la no dominante usa Right* y espeja la separación", () => {
    const d = canonicalHand(cm(1), "dominant");
    const n = canonicalHand(cm(1), "nondominant");
    expect(n.bones[0].bone).toBe("RightHandIndex1");
    expect(n.bones[0].euler_xyz_deg[2]).toBe(-d.bones[0].euler_xyz_deg[2] || 0);
  });
});

describe("ubAnchor", () => {
  it("resuelve hueso y nombre del inventario", () => {
    expect(ubAnchor("Fr")).toMatchObject({ code: "Fr", name: "Frente", region: "FACE", bone: "Head" });
  });
});

/** Mano sintética de 21 puntos centrada en (cx, cy). */
function hand(cx: number, cy: number): V3[] {
  return Array.from({ length: 21 }, (_, i) => [cx + (i % 5) * 0.004, cy - Math.floor(i / 5) * 0.01, 0] as V3);
}
function pose(): [number, number, number, number][] {
  const p = Array.from({ length: 33 }, () => [0.5, 0.5, 0, 1] as [number, number, number, number]);
  p[11] = [0.65, 0.6, 0, 1]; // hombro izquierdo de la persona (derecha de imagen)
  p[12] = [0.35, 0.6, 0, 1];
  return p;
}

describe("signingWindow", () => {
  it("quita reposo, mano recortada por el borde y la subida", () => {
    const frames: RawFrame[] = [
      { t: 0, hands: [], hands_world: [], pose: pose() },
      { t: 80, hands: [hand(0.4, 0.95)], hands_world: [], pose: pose() }, // recortada
      { t: 160, hands: [hand(0.4, 0.8)], hands_world: [], pose: pose() }, // subiendo
      ...Array.from({ length: 8 }, (_, k) => ({
        t: 240 + k * 80,
        hands: [hand(0.4, 0.3)],
        hands_world: [],
        pose: pose(),
      })),
      { t: 900, hands: [hand(0.4, 0.8)], hands_world: [], pose: pose() }, // bajando
      { t: 980, hands: [], hands_world: [], pose: pose() },
    ];
    expect(signingWindow(frames, "left")).toEqual([3, 10]);
  });
});

describe("breakCmTie", () => {
  it("con pulgar extendido y paralelo prefiere A sobre S", () => {
    const tied = [9, 10, 12].map((cm_id) => ({ cm_id, score: 0.9 }));
    const r = breakCmTie(tied, [{ flexion: "EXTENDED", opposed: false }]);
    expect(r.ranked[0].cm_id).toBe(10);
  });
  it("con pulgar cerrado y opuesto prefiere S", () => {
    const tied = [10, 12, 9].map((cm_id) => ({ cm_id, score: 0.9 }));
    expect(breakCmTie(tied, [{ flexion: "CLOSED", opposed: true }]).ranked[0].cm_id).toBe(9);
  });
});

describe("observeLocation (brazo base)", () => {
  it("la muñeca de la mano base es la del otro brazo, no la de la dominante", () => {
    // persona diestra: su mano derecha está a la izquierda de la imagen
    const p: Pt[] = pose().map(([x, y, z]) => ({ x, y, z }));
    p[15] = { x: 0.6, y: 0.75, z: 0 }; // muñeca izquierda de la persona (base)
    p[16] = { x: 0.3, y: 0.9, z: 0 }; // muñeca derecha (la que seña)
    p[13] = { x: 0.68, y: 0.8, z: 0 };
    p[14] = { x: 0.3, y: 0.95, z: 0 };
    const h: Pt[] = hand(0.6, 0.75).map(([x, y, z]) => ({ x, y, z }));
    expect(observeLocation(h, p, "left")?.code).toMatch(/^(Car|Palma)$/);
  });
});

describe("buildEntry", () => {
  it("sin cuadros deja la fonología vacía y lo marca", () => {
    const { entry, track } = buildEntry({
      page: { slug_path: "/es/lsm/x", label: "x", url: "https://www.wikisigns.org/es/lsm/x", fetched_at: "2026-11-06T00:00:00Z", videos: [] },
      video: {
        title: "x", youtube_id: "aaaaaaaaaaa", file_id: 1, video_title: null, wikisigns_number: null,
        node_id: null, rating_avg: null, rating_votes: null,
      },
      frames: null,
      generatedAt: "2026-11-06T00:00:00Z",
    });
    expect(entry.id).toBe("wsl-1");
    expect(entry.phonology).toBeNull();
    expect(entry.qa.flags).toContain("sin_video");
    expect(entry.source.license).toBe("CC BY-SA 4.0");
    expect(track).toBeNull();
    expect(notationOf(entry.annotation)).toBe("—");
  });
});

describe("refineZigzag", () => {
  const sw = 0.3;
  it("ida y vuelta recta = recto con repetición, no zigzag", () => {
    const pts = [0, 0.1, 0.2, 0.1, 0, 0.1, 0.2, 0.1, 0].map((x) => ({ x: 0.4 + x, y: 0.5 }));
    expect(refineZigzag(pts, sw)).toEqual({ contour: "STRAIGHT", strokes: 4 });
  });
  it("un zigzag que avanza se queda como está", () => {
    const pts = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 0.3 + i * 0.05, y: 0.5 + (i % 2) * 0.05 }));
    expect(refineZigzag(pts, sw)).toBeNull();
  });
});

describe("fineLocation", () => {
  // cara mínima: los facemarks que usan las anclas, en coordenadas de imagen
  const fmIndex = [168, 10, 33, 133, 263, 362, 1, 6, 13, 14, 0, 17, 152, 61, 291, 50, 280, 205, 425, 234, 454];
  const at: Record<number, [number, number]> = {
    168: [0.5, 0.3], 10: [0.5, 0.2], 33: [0.46, 0.31], 133: [0.48, 0.31], 263: [0.54, 0.31], 362: [0.52, 0.31],
    1: [0.5, 0.36], 6: [0.5, 0.33], 13: [0.5, 0.4], 14: [0.5, 0.41], 0: [0.5, 0.39], 17: [0.5, 0.42], 152: [0.5, 0.46],
    61: [0.48, 0.4], 291: [0.52, 0.4], 50: [0.46, 0.36], 280: [0.54, 0.36], 205: [0.465, 0.39], 425: [0.535, 0.39],
    234: [0.44, 0.34], 454: [0.56, 0.34],
  };
  const frame: RawFrame = {
    t: 0, hands: [], hands_world: [], pose: pose(),
    facemarks: fmIndex.map((i) => [at[i][0], at[i][1], 0] as V3),
  };
  const toPts = (h: V3[]) => h.map(([x, y, z]) => ({ x, y, z }));
  it("la yema en la nariz da Na con contacto", () => {
    const h = toPts(hand(0.5, 0.39)); // centroide cerca; yemas suben hacia la nariz
    h[8] = { x: 0.5, y: 0.36, z: 0 };
    expect(fineLocation([frame, frame], [h, h], [undefined, undefined], fmIndex, 640, 360, "RIGHT")).toEqual({ code: "Na", contact: "TOUCHING" });
  });
  it("lejos de todo es espacio neutro", () => {
    const h = toPts(hand(0.15, 0.2));
    expect(fineLocation([frame, frame], [h, h], [undefined, undefined], fmIndex, 640, 360, "RIGHT")?.code).toBe("EN");
  });
});
