import { describe, it, expect } from "vitest";
import type { RawFrame, V3 } from "@/lib/lexicon/derive";
import {
  actividad,
  asignar,
  candidatos,
  descriptor,
  estimarDesfase,
  fonologia,
  glosaDe,
  juntarRepetidas,
  mediaEn,
  raicesDe,
  segmentar,
  seriesPorPersona,
  type Actividad,
  type FramesVoces,
  type FonologiaSena,
  type LexRef,
} from "./voces";

const W = 1920;
const H = 1080;
/** pose sentada: hombros a 0.4/0.6 (384 px), cadera en y = 0.8 */
function pose(): [number, number, number, number][] {
  const p = Array.from({ length: 33 }, () => [0.5, 0.5, 0, 1] as [number, number, number, number]);
  p[11] = [0.6, 0.4, 0, 1];
  p[12] = [0.4, 0.4, 0, 1];
  p[23] = [0.55, 0.8, 0, 1];
  p[24] = [0.45, 0.8, 0, 1];
  p[15] = [0.6, 0.6, 0, 1];
  p[16] = [0.4, 0.6, 0, 1];
  return p;
}
const mano = (x: number, y: number): V3[] => Array.from({ length: 21 }, () => [x, y, 0] as V3);
/** una mano derecha (muñeca 16) que va y viene en x */
function serie(n: number, amp: number, t0 = 0): RawFrame[] {
  return Array.from({ length: n }, (_, i) => {
    const x = 0.4 + amp * Math.sin(i / 2);
    return { t: t0 + i * 83, hands: [mano(x, 0.5)], hands_world: [mano(0, 0)], hand_src: ["crop"], hand_wrist: [16], pose: pose() };
  });
}

describe("actividad", () => {
  it("una mano quieta no seña; una que se mueve sí", () => {
    expect(Math.max(...actividad(serie(20, 0), W, H).a)).toBe(0);
    expect(mediaEn(actividad(serie(20, 0.05), W, H), 0, 2).media).toBeGreaterThan(0.45);
  });
  it("una mano bajo la cadera está en reposo", () => {
    const s = serie(10, 0.05).map((f) => ({ ...f, hands: [mano(0.4, 0.9)] }));
    expect(Math.max(...actividad(s, W, H).a)).toBe(0);
  });
});

describe("seriesPorPersona", () => {
  it("un solo cuerpo por persona y cuadro (sin tiempos repetidos ni NaN)", () => {
    const cuerpo = (x: number, manos: number) => ({
      pista: 0, persona: "P01", pose: pose(), pose_world: [], hand_wrist: manos ? [16] : [], hand_src: manos ? ["crop"] : [],
      hands: manos ? [mano(x, 0.5)] : [], hands_world: manos ? [mano(0, 0)] : [],
    });
    const fr: FramesVoces = {
      youtube_id: "x", video: { width: W, height: H, fps: 30 },
      frames: Array.from({ length: 12 }, (_, i) => ({ t: i * 83, toma: 0, gente: [cuerpo(0.4 + 0.02 * i, 1), cuerpo(0.5, 0)] })),
    };
    const s = seriesPorPersona(fr, (c) => c.persona).get("P01")!;
    expect(s).toHaveLength(12);
    expect(s.every((f) => f.hands.length === 1)).toBe(true);
    expect(actividad(s, W, H).a.every(Number.isFinite)).toBe(true);
  });
});

describe("desfase y asignación", () => {
  // A seña de 2 a 4 s; B de 6 a 8 s
  const act = (desde: number, hasta: number): Actividad => {
    const t = Array.from({ length: 120 }, (_, i) => i * 83);
    return { t, a: t.map((ms) => (ms / 1000 >= desde && ms / 1000 <= hasta ? 1 : 0)) };
  };
  const A = act(2, 4);
  const B = act(6, 8);
  it("el subtítulo que llega 1 s tarde da desfase −1 s", () => {
    const or = [{ t0: 3, t1: 5 }, { t0: 7, t1: 9 }];
    expect(estimarDesfase(or, [A, B])).toBe(-1);
  });
  it("cada tarjeta va a quien seña y la oración se parte si cambia", () => {
    const tarjetas = [{ t0: 2, t1: 4, texto: "Hola," }, { t0: 6, t1: 8, texto: "¿cómo estás?" }];
    const us = asignar([{ t0: 2, t1: 8, texto: "Hola, ¿cómo estás?", tarjetas: 2 }], tarjetas, new Map([["P01", A], ["P02", B]]), 0);
    expect(us.map((u) => [u.persona, u.texto])).toEqual([["P01", "Hola,"], ["P02", "¿cómo estás?"]]);
  });
});

describe("segmentar", () => {
  it("corta por las pausas de la mano", () => {
    // tres golpes separados por pausas
    const s: RawFrame[] = [];
    let x = 0.4;
    for (let i = 0; i < 36; i++) {
      if (i % 12 >= 3 && i % 12 < 9) x += 0.01;
      s.push({ t: i * 83, hands: [mano(x, 0.5)], hands_world: [mano(0, 0)], hand_src: ["crop"], hand_wrist: [16], pose: pose() });
    }
    const tr = segmentar(s, "left", W, H);
    expect(tr.length).toBe(3);
  });
});

describe("transliteración", () => {
  const lex: LexRef[] = [
    { id: "a", gloss: "PREGUNTAR", spanish: "preguntar", synonyms: [], cm: 3, ub: "EN", two_handed: false, contour: "ARC", palm: "UP", fingers: "FORWARD" },
    { id: "b", gloss: "CUBA", spanish: "Cuba", synonyms: [], cm: 3, ub: "EN", two_handed: false, contour: "ARC", palm: "UP", fingers: "FORWARD" },
    { id: "c", gloss: "CASA", spanish: "casa", synonyms: ["hogar"], cm: 9, ub: "EN", two_handed: true, contour: null, palm: null, fingers: null },
  ];
  const fon: FonologiaSena = {
    cm: [{ id: 3, puntaje: 0.9 }], ub: "EN", contacto: null, palma: "UP", dedos: "FORWARD", contorno: "ARC", plano: null,
    direccion: null, repeticion: null, dos_manos: false, relacion: null, plana: 0, cuadros: 8,
  };
  it("las palabras de la oración desempatan", () => {
    const c = candidatos(fon, lex, raicesDe("¿Me quieres preguntar algo?"));
    expect(c[0].glosa).toBe("PREGUNTAR");
    expect(c[0].en_oracion).toBe(true);
    expect(glosaDe(c)).toBe("PREGUNTAR");
  });
  it("sin la palabra en la oración no se adivina: queda la descripción", () => {
    const c = candidatos(fon, lex, raicesDe("Me gusta bailar"));
    expect(glosaDe(c)).toBeNull();
    expect(descriptor(fon)).toBe("[CM3·EN·arc]");
  });
  it("las repeticiones se juntan con +", () => {
    expect(juntarRepetidas(["PROFESOR", "PROFESOR", "[CM3·EN·arc]", "[CM3·EN·arc]", "SÍ"])).toEqual(["PROFESOR+", "[CM3·EN·arc]", "[CM3·EN·arc]", "SÍ"]);
  });
});

describe("fonologia: la otra mano", () => {
  // mano con forma (no un punto): dedos abiertos hacia arriba
  const manoAbierta = (x: number, y: number): V3[] =>
    Array.from({ length: 21 }, (_, k) => [x + ((k % 5) - 2) * 0.006, y - Math.floor(k / 5) * 0.012, 0] as V3);
  const sena = (yOtra: number, xOtra = 0.62): RawFrame[] =>
    Array.from({ length: 10 }, (_, i) => ({
      t: i * 83,
      hands: [manoAbierta(xOtra, yOtra), manoAbierta(0.38 + 0.01 * i, 0.5)],
      hands_world: [manoAbierta(0, 0), manoAbierta(0, 0)],
      hand_src: ["crop", "crop"],
      hand_wrist: [15, 16],
      pose: pose(),
    }));
  it("en el regazo o el vientre no cuenta; frente al pecho o de base sí", () => {
    // hombros en y = 0.4, ancho 0.2 (= 0.356 en y): regazo a 1.2 anchos, pecho a 0.3
    const regazo = fonologia(sena(0.4 + 1.2 * 0.356), "left");
    expect(regazo.dos_manos).toBe(false);
    expect(fonologia(sena(0.4 + 0.6 * 0.356), "left").dos_manos).toBe(false); // frente al vientre
    expect(fonologia(sena(0.5), "left").dos_manos).toBe(true); // frente al pecho
    expect(fonologia(sena(0.4 + 0.5 * 0.356, 0.425), "left").dos_manos).toBe(true); // baja, pero de base
  });
});
