import { describe, expect, it } from "vitest";
import { leerPaso, pasoPendiente, rutaDespuesDeEntrar } from "./camino";

describe("camino", () => {
  it("el primer paso que falta manda: apodo, cuestionario, acuerdo", () => {
    expect(pasoPendiente({ consentStatus: "none", hasMetadata: false })).toBe(1);
    expect(pasoPendiente({ consentStatus: "none", hasMetadata: false, apodo: "Colibrí 42" })).toBe(2);
    expect(pasoPendiente({ consentStatus: "none", hasMetadata: true, apodo: "Colibrí 42" })).toBe(3);
    expect(pasoPendiente({ consentStatus: "withdrawn", hasMetadata: true, apodo: "x" })).toBe(3);
    expect(pasoPendiente({ consentStatus: "granted", hasMetadata: true, apodo: "x" })).toBeNull();
  });

  it("después de entrar: al paso pendiente, o a donde iba, o a las listas", () => {
    let tomado = false;
    const tomar = () => {
      tomado = true;
      return "/estudio";
    };
    expect(rutaDespuesDeEntrar({ consentStatus: "none", hasMetadata: false }, tomar)).toBe(
      "/unirse?paso=1",
    );
    // Si falta un paso, la ruta guardada no se consume
    expect(tomado).toBe(false);
    const lista = { consentStatus: "granted" as const, hasMetadata: true, apodo: "x" };
    expect(rutaDespuesDeEntrar(lista, () => "/estudio?session=1")).toBe("/estudio?session=1");
    expect(rutaDespuesDeEntrar(lista, () => null)).toBe("/listas");
  });

  it("lee el paso de la URL con cuidado", () => {
    expect(leerPaso("2")).toBe(2);
    expect(leerPaso("9")).toBeNull();
    expect(leerPaso(null)).toBeNull();
  });
});
