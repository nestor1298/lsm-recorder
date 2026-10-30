import { describe, expect, it } from "vitest";
import { inicioDeSemana, rangoDeSemana, semanaIso } from "./semana";

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
