import { describe, expect, it } from "vitest";
import {
  abreCofre,
  eventosAlSubir,
  faltanParaCofre,
  inicioDeSemana,
  masRara,
  medallaDe,
  nivelDe,
  rangoDeSemana,
  rarezaDe,
  semanaIso,
  siguienteMedalla,
} from "./progresion";
import { CM_INVENTORY } from "./data";
import { cmDeItemId } from "./corpus";

describe("niveles y medallas", () => {
  it("cada video sube un nivel; nada raro con valores malos", () => {
    expect(nivelDe(0)).toBe(0);
    expect(nivelDe(12)).toBe(12);
    expect(nivelDe(-3)).toBe(0);
    expect(nivelDe(2.9)).toBe(2);
    expect(nivelDe(Number.NaN)).toBe(0);
  });

  it("medallas en 30, 50, 70 y 100", () => {
    expect(medallaDe(29)).toBeNull();
    expect(medallaDe(30)?.id).toBe("bronce");
    expect(medallaDe(69)?.id).toBe("plata");
    expect(medallaDe(70)?.id).toBe("oro");
    expect(medallaDe(250)?.id).toBe("diamante");
    expect(siguienteMedalla(0)?.id).toBe("bronce");
    expect(siguienteMedalla(50)?.id).toBe("oro");
    expect(siguienteMedalla(100)).toBeNull();
  });

  it("el cofre se abre cada diez videos, solo al subir", () => {
    expect(abreCofre(9, 10)).toBe(true);
    expect(abreCofre(10, 11)).toBe(false);
    expect(abreCofre(19, 21)).toBe(true);
    expect(abreCofre(10, 9)).toBe(false);
    expect(faltanParaCofre(0)).toBe(10);
    expect(faltanParaCofre(7)).toBe(3);
    expect(faltanParaCofre(10)).toBe(10);
  });

  it("eventos al subir: nivel, cofre y medalla recién ganada", () => {
    expect(eventosAlSubir(29, 30)).toEqual({
      nivel: 30,
      cofre: true,
      medalla: expect.objectContaining({ id: "bronce" }),
    });
    expect(eventosAlSubir(30, 31)).toEqual({ nivel: 31, cofre: false, medalla: null });
    // Un retiro no "gana" nada
    expect(eventosAlSubir(31, 30)).toEqual({ nivel: 30, cofre: false, medalla: null });
  });
});

describe("rareza", () => {
  it("en el LSM Corpus sale del nivel de frecuencia de la CM", () => {
    const porTier = (t: number) => CM_INVENTORY.find((cm) => cm.frequency_tier === t)!;
    expect(rarezaDe("lsm", String(porTier(1).cm_id))).toBe("comun");
    expect(rarezaDe("lsm", String(porTier(2).cm_id))).toBe("rara");
    expect(rarezaDe("lsm", String(porTier(3).cm_id))).toBe("epica");
    expect(rarezaDe("lsm", String(porTier(4).cm_id))).toBe("legendaria");
    expect(rarezaDe("lsm", "no-existe")).toBe("comun");
    // Solo ids canónicos: "05" no es la CM 5
    expect(cmDeItemId("05")).toBeUndefined();
    expect(cmDeItemId("5")?.cm_id).toBe(5);
  });

  it("en SignaPlay sale de la ruta; la seña sin ruta es legendaria", () => {
    expect(rarezaDe("signaplay", "SI")).toBe("comun");
    expect(rarezaDe("signaplay", "PERRO")).toBe("legendaria");
    expect(rarezaDe("signaplay", "NADA_DE_ESTO")).toBe("comun");
  });

  it("compara rarezas", () => {
    expect(masRara("comun", "epica")).toBe("epica");
    expect(masRara("legendaria", "rara")).toBe("legendaria");
    expect(masRara("rara", "rara")).toBe("rara");
  });
});

describe("semana ISO", () => {
  it("calcula la semana en UTC y su lunes", () => {
    expect(semanaIso(new Date("2026-10-28T12:00:00Z"))).toBe("2026-W44");
    // Año nuevo 2027 (viernes) todavía es la semana 53 de 2026
    expect(semanaIso(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    expect(semanaIso(new Date("2027-01-04T00:00:00Z"))).toBe("2027-W01");
    expect(inicioDeSemana("2026-W44")?.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(inicioDeSemana("2027-W01")?.toISOString()).toBe("2027-01-04T00:00:00.000Z");
    expect(inicioDeSemana("2026-W60")).toBeNull();
    // 2025 tiene 52 semanas; 2026 tiene 53
    expect(inicioDeSemana("2025-W53")).toBeNull();
    expect(inicioDeSemana("2026-W53")?.toISOString()).toBe("2026-12-28T00:00:00.000Z");
    expect(inicioDeSemana("hola")).toBeNull();
  });

  it("describe el rango en español", () => {
    expect(rangoDeSemana("2026-W44")).toMatch(/26 oct.*1 nov/);
    expect(rangoDeSemana("mal")).toBe("mal");
  });
});
