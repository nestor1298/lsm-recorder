import { describe, expect, it } from "vitest";
import {
  ITEM_ID_RE,
  itemIdDeGrabacion,
  parseRecordingId,
  recordingId,
  recSk,
} from "./keys";

describe("llaves de grabación", () => {
  it("las grabaciones anteriores (número de CM) conservan su llave", () => {
    expect(recSk("12")).toBe("REC#12");
    expect(itemIdDeGrabacion({ cm_id: 12 })).toBe("12");
    expect(itemIdDeGrabacion({ item_id: "HOLA", cm_id: undefined })).toBe("HOLA");
  });

  it("recordingId ida y vuelta con ids de CM y de glosa", () => {
    const sess = "3f1c-uuid";
    for (const item of ["12", "POR_FAVOR", "BUENAS-NOCHES"]) {
      expect(parseRecordingId(recordingId(sess, item))).toEqual({
        sessionId: sess,
        itemId: item,
      });
    }
  });

  it("rechaza ítems con «__» o que empiezan con «_»: romperían recordingId", () => {
    expect(ITEM_ID_RE.test("A__B")).toBe(false);
    expect(ITEM_ID_RE.test("_X")).toBe(false);
    expect(ITEM_ID_RE.test("POR_FAVOR")).toBe(true);
    expect(ITEM_ID_RE.test("BUENAS-NOCHES")).toBe(true);
    expect(ITEM_ID_RE.test("12")).toBe(true);
    expect(ITEM_ID_RE.test("a".repeat(64))).toBe(true);
    expect(ITEM_ID_RE.test("a".repeat(65))).toBe(false);
  });

  it("rechaza ids sin sesión o con caracteres peligrosos", () => {
    expect(parseRecordingId("__12")).toBeNull();
    expect(parseRecordingId("sess__../x")).toBeNull();
    expect(parseRecordingId("sess__HOLA/ADIOS")).toBeNull();
    expect(parseRecordingId("sess")).toBeNull();
  });
});
