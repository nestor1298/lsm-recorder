import { describe, expect, it } from "vitest";
import {
  construirMapa,
  contarPorEntity,
  remapItem,
  remapLlave,
  subsViejosPresentes,
} from "./remap_items.mjs";

const mapa = { viejo1: "nuevo1", viejo2: "nuevo2" };

describe("remapLlave", () => {
  it("cambia solo el prefijo de usuario", () => {
    const h = new Set();
    expect(remapLlave("viejo1/sess/12.webm", mapa, h)).toBe("nuevo1/sess/12.webm");
    expect(remapLlave("viejo2/consent.webm", mapa, h)).toBe("nuevo2/consent.webm");
    expect(h.size).toBe(0);
  });
  it("anota huérfanos y deja la llave igual", () => {
    const h = new Set();
    expect(remapLlave("nadie/sess/1.mp4", mapa, h)).toBe("nadie/sess/1.mp4");
    expect([...h]).toEqual(["nadie"]);
  });
});

describe("remapItem", () => {
  it("participant: pk, user_id y video de consentimiento", () => {
    const h = new Set();
    const r = remapItem(
      { pk: "PART#viejo1", sk: "PROFILE", entity: "participant", user_id: "viejo1", consent_video_key: "viejo1/consent.webm", consent_status: "granted" },
      mapa, h,
    );
    expect(r).toMatchObject({ pk: "PART#nuevo1", sk: "PROFILE", user_id: "nuevo1", consent_video_key: "nuevo1/consent.webm", consent_status: "granted" });
    expect(h.size).toBe(0);
  });
  it("session: pk y user_id; sk intacta", () => {
    const r = remapItem({ pk: "PART#viejo2", sk: "SESS#abc", entity: "session", user_id: "viejo2", session_id: "abc" }, mapa, new Set());
    expect(r).toMatchObject({ pk: "PART#nuevo2", sk: "SESS#abc", user_id: "nuevo2" });
  });
  it("recording: gsi1pk, participant_id y s3_key; pk/sk intactas", () => {
    const r = remapItem(
      { pk: "SESS#abc", sk: "REC#12", entity: "recording", gsi1pk: "PART#viejo1", gsi1sk: "REC#2026", participant_id: "viejo1", s3_key: "viejo1/abc/12.webm" },
      mapa, new Set(),
    );
    expect(r).toMatchObject({ pk: "SESS#abc", sk: "REC#12", gsi1pk: "PART#nuevo1", gsi1sk: "REC#2026", participant_id: "nuevo1", s3_key: "nuevo1/abc/12.webm" });
  });
  it("annotation: gsi1pk y annotator_id; recording_id sin tocar", () => {
    const r = remapItem(
      { pk: "ANNOT#x", sk: "ANNOT#x", entity: "annotation", gsi1pk: "PART#viejo2", annotator_id: "viejo2", recording_id: "abc__12" },
      mapa, new Set(),
    );
    expect(r).toMatchObject({ gsi1pk: "PART#nuevo2", annotator_id: "nuevo2", recording_id: "abc__12" });
  });
  it("el sentinel de salud no se migra y una entity rara detiene", () => {
    expect(remapItem({ pk: "HEALTH#sentinel", sk: "x" }, mapa, new Set())).toBeNull();
    expect(() => remapItem({ pk: "X", sk: "Y", entity: "otra" }, mapa, new Set())).toThrow();
  });
  it("un sub sin mapa queda registrado como huérfano", () => {
    const h = new Set();
    remapItem({ pk: "PART#nadie", sk: "PROFILE", entity: "participant", user_id: "nadie" }, mapa, h);
    expect([...h]).toEqual(["nadie"]);
  });
});

describe("mapa y verificación", () => {
  it("construye el mapa por correo y reporta problemas", () => {
    const { mapa: m, problemas } = construirMapa(
      [
        { sub: "a", email: "Ana@X.mx" },
        { sub: "b", email: "beto@x.mx" },
        { sub: "c", email: "beto@x.mx" },
        { sub: "d", email: "" },
        { sub: "e", email: "eva@x.mx" },
      ],
      { "ana@x.mx": "A2", "beto@x.mx": "B2" },
    );
    expect(m).toEqual({ a: "A2", b: "B2" });
    expect(problemas).toHaveLength(3);
  });
  it("cuenta por entity y detecta subs viejos que quedaron", () => {
    const items = [
      { pk: "PART#nuevo1", entity: "participant" },
      { pk: "SESS#a", gsi1pk: "PART#viejo1", entity: "recording" },
    ];
    expect(contarPorEntity(items)).toEqual({ participant: 1, recording: 1 });
    expect(subsViejosPresentes(items, mapa)).toHaveLength(1);
  });
});
