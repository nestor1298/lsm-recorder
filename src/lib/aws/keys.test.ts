import { describe, expect, it } from "vitest";
import {
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

  it("rechaza ids sin sesión o con caracteres peligrosos", () => {
    expect(parseRecordingId("__12")).toBeNull();
    expect(parseRecordingId("sess__../x")).toBeNull();
    expect(parseRecordingId("sess__HOLA/ADIOS")).toBeNull();
    expect(parseRecordingId("sess")).toBeNull();
  });
});
