import { describe, it, expect, vi } from "vitest";
import { planDeFusion, crearColaDeSubida } from "./annotations_sync";
import type { SignAnnotation } from "./types";

const local = (id: string, updated_at: string) => ({ id, updated_at });
const remota = (id: string, updatedAt: string) => ({ id, updatedAt });

describe("planDeFusion", () => {
  it("lo que solo está en este navegador se sube", () => {
    const p = planDeFusion([local("a", "2026-09-01T10:00:00Z")], []);
    expect(p.subir).toEqual(["a"]);
    expect(p.bajar).toEqual([]);
  });

  it("lo que solo está en el corpus se baja", () => {
    const p = planDeFusion([], [remota("b", "2026-09-01T10:00:00Z")]);
    expect(p.bajar).toEqual(["b"]);
    expect(p.subir).toEqual([]);
  });

  it("gana la marca más reciente (trabajé en la laptop y sigo en la tablet)", () => {
    const p = planDeFusion(
      [
        local("nueva-aqui", "2026-09-02T10:00:00Z"),
        local("nueva-alla", "2026-09-01T10:00:00Z"),
      ],
      [
        remota("nueva-aqui", "2026-09-01T10:00:00Z"),
        remota("nueva-alla", "2026-09-03T10:00:00Z"),
      ],
    );
    expect(p.subir).toEqual(["nueva-aqui"]);
    expect(p.bajar).toEqual(["nueva-alla"]);
  });

  it("las idénticas quedan en paz (no se toca la red)", () => {
    const p = planDeFusion(
      [local("x", "2026-09-01T10:00:00Z")],
      [remota("x", "2026-09-01T10:00:00Z")],
    );
    expect(p.enPaz).toEqual(["x"]);
    expect(p.subir.concat(p.bajar)).toEqual([]);
  });

  it("una fecha inválida no rompe la comparación", () => {
    const p = planDeFusion(
      [local("x", "no-es-fecha")],
      [remota("x", "2026-09-01T10:00:00Z")],
    );
    expect(p.bajar).toEqual(["x"]);
  });
});

describe("cola con rebote", () => {
  const ann = (id: string): SignAnnotation => ({
    id,
    cm_id: 1,
    gloss: "X",
    created_at: "",
    updated_at: "2026-09-01T10:00:00Z",
    dominant_hand: "RIGHT",
    two_handed: false,
    symmetrical: false,
    notes: "",
    status: "draft",
    segments: [],
  });

  it("agrupa muchos cambios seguidos en una sola subida", async () => {
    vi.useFakeTimers();
    const subir = vi.fn().mockResolvedValue(undefined);
    const cola = crearColaDeSubida(subir, 1000);
    for (let i = 0; i < 20; i++) cola.encolar(ann("a"));
    expect(subir).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1100);
    expect(subir).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("anotaciones distintas se suben por separado", async () => {
    vi.useFakeTimers();
    const subir = vi.fn().mockResolvedValue(undefined);
    const cola = crearColaDeSubida(subir, 500);
    cola.encolar(ann("a"));
    cola.encolar(ann("b"));
    await vi.advanceTimersByTimeAsync(600);
    expect(subir).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("vaciar() envía lo pendiente sin esperar el rebote", async () => {
    const subir = vi.fn().mockResolvedValue(undefined);
    const cola = crearColaDeSubida(subir, 100000);
    cola.encolar(ann("a"));
    expect(cola.pendientes()).toBe(1);
    await cola.vaciar();
    expect(subir).toHaveBeenCalledTimes(1);
    expect(cola.pendientes()).toBe(0);
  });
});
