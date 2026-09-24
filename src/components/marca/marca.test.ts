import { describe, expect, it } from "vitest";
import { GLIFOS_MARCA, LADO_MARCA } from "./lsm_corpus_glifos";

describe("marca LSM CORPUS", () => {
  it("tiene las nueve letras en rejilla 3 × 3, cada una fina y gruesa", () => {
    expect(GLIFOS_MARCA.map((g) => g.letra).join("")).toBe("LSMCORPUS");
    for (const g of GLIFOS_MARCA) {
      expect(g.fina.length).toBeGreaterThan(0);
      expect(g.gruesa.length).toBeGreaterThan(0);
    }
    const celdas = new Set(GLIFOS_MARCA.map((g) => `${g.fila}${g.columna}`));
    expect(celdas.size).toBe(9);
  });

  it("todos los trazos caben en el cuadro", () => {
    for (const g of GLIFOS_MARCA) {
      for (const d of [...g.fina, ...g.gruesa]) {
        const nums = d.match(/-?\d+\.?\d*/g)!.map(Number);
        for (const n of nums) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(LADO_MARCA);
        }
      }
    }
  });
});

import { GLIFOS_SIGNAPLAY, VISTA_SIGNAPLAY } from "./signaplay_glifos";

describe("wordmark SignaPlay", () => {
  it("tiene las nueve letras de «Signa» y «Play», en dos naranjas", () => {
    expect(GLIFOS_SIGNAPLAY.map((g) => g.letra).join("")).toBe("SignaPlay");
    expect(new Set(GLIFOS_SIGNAPLAY.map((g) => g.fill))).toEqual(
      new Set(["#f7931d", "#fab14b"]),
    );
  });

  it("todos los trazos caben en la vista recortada", () => {
    const [x, y, w, h] = VISTA_SIGNAPLAY;
    for (const g of GLIFOS_SIGNAPLAY) {
      const nums = g.d.match(/-?\d+\.?\d*/g)!.map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) {
        expect(nums[i]).toBeGreaterThanOrEqual(x);
        expect(nums[i]).toBeLessThanOrEqual(x + w);
        expect(nums[i + 1]).toBeGreaterThanOrEqual(y);
        expect(nums[i + 1]).toBeLessThanOrEqual(y + h);
      }
    }
  });
});
