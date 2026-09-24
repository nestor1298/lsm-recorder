import { beforeEach, describe, expect, it } from "vitest";
import { guardarVolverA, tomarVolverA } from "./volver_a";

const almacen = new Map<string, string>();
beforeEach(() => {
  almacen.clear();
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => void almacen.set(k, v),
      removeItem: (k: string) => void almacen.delete(k),
    },
  });
});

describe("volver a", () => {
  it("guarda una ruta interna y la entrega una sola vez", () => {
    guardarVolverA("/record?corpus=signaplay");
    expect(tomarVolverA()).toBe("/record?corpus=signaplay");
    expect(tomarVolverA()).toBeNull();
  });
  it("ignora rutas externas o protocol-relative", () => {
    guardarVolverA("https://otro.sitio/x");
    guardarVolverA("//otro.sitio/x");
    expect(tomarVolverA()).toBeNull();
  });
});
