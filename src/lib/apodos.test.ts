import { describe, expect, it } from "vitest";
import {
  limpiarApodo,
  normalizarApodo,
  PALABRAS_APODO,
  sugerirApodo,
  validarApodo,
} from "./apodos";

describe("apodos", () => {
  it("acepta letras con acento, números, espacio, guion y guion bajo", () => {
    expect(validarApodo("Colibrí 42")).toBeNull();
    expect(validarApodo("ana_mx")).toBeNull();
    expect(validarApodo("Ñandú-7")).toBeNull();
    expect(validarApodo("  Ajolote  9  ")).toBeNull();
  });

  it("rechaza lo corto, lo largo, los símbolos y lo que no es texto", () => {
    expect(validarApodo("ab")).toMatch(/al menos 3/);
    expect(validarApodo("a".repeat(21))).toMatch(/hasta 20/);
    expect(validarApodo("hola@mundo")).toMatch(/Solo letras/);
    expect(validarApodo("-empieza")).toMatch(/Solo letras/);
    expect(validarApodo(42)).toMatch(/Escribe/);
    expect(validarApodo(null)).toMatch(/Escribe/);
  });

  it("normaliza acentos, espacios y mayúsculas para comparar", () => {
    expect(normalizarApodo("Colibrí   42")).toBe("colibri 42");
    expect(normalizarApodo("  AJOLOTE_9 ")).toBe("ajolote_9");
    expect(normalizarApodo("Colibrí 42")).toBe(normalizarApodo("colibri 42"));
    expect(limpiarApodo("  Colibrí   42 ")).toBe("Colibrí 42");
  });

  it("sugiere una palabra de la lista con dos dígitos, siempre válida", () => {
    let i = 0;
    const seq = [0, 0, 0.999, 0.999];
    const s1 = sugerirApodo(() => seq[i++]);
    expect(s1).toBe(`${PALABRAS_APODO[0]} 10`);
    const s2 = sugerirApodo(() => seq[i++]);
    expect(s2).toBe(`${PALABRAS_APODO[PALABRAS_APODO.length - 1]} 99`);
    for (let k = 0; k < 50; k++) expect(validarApodo(sugerirApodo())).toBeNull();
  });
});
