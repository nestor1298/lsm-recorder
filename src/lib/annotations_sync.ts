/**
 * annotations_sync.ts — sincronización de anotaciones con el corpus.
 *
 * Modelo: localStorage sigue siendo el borrador de trabajo (rápido y
 * tolerante a estar sin conexión); DynamoDB es el registro compartido.
 * Al abrir se fusionan ambos lados y cada cambio se empuja con rebote.
 *
 * Conflictos: gana la marca `updated_at` más reciente. Es suficiente
 * porque una anotación tiene una sola dueña y se edita en un dispositivo
 * a la vez; lo que resuelve de verdad es "trabajé en la laptop y sigo en
 * la tablet".
 */

import type { SignAnnotation } from "./types";

export type EstadoSync = "local" | "guardando" | "sincronizada" | "error";

/** Resumen remoto (sin payload) que devuelve GET /api/annotations */
export interface AnotacionRemota {
  id: string;
  gloss: string;
  cmId: number;
  status: string;
  segmentCount: number;
  recordingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanDeFusion {
  /** están solo aquí (o son más nuevas aquí): hay que subirlas */
  subir: string[];
  /** están solo en el corpus (o son más nuevas allá): hay que bajarlas */
  bajar: string[];
  /** iguales a ambos lados */
  enPaz: string[];
}

const ts = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/**
 * Decide qué hacer con cada anotación comparando lo local y lo remoto.
 * Función pura: es la parte que conviene tener probada.
 */
export function planDeFusion(
  locales: Pick<SignAnnotation, "id" | "updated_at">[],
  remotas: Pick<AnotacionRemota, "id" | "updatedAt">[],
): PlanDeFusion {
  const mapaRemoto = new Map(remotas.map((r) => [r.id, ts(r.updatedAt)]));
  const mapaLocal = new Map(locales.map((l) => [l.id, ts(l.updated_at)]));
  const subir: string[] = [];
  const bajar: string[] = [];
  const enPaz: string[] = [];

  for (const [id, tLocal] of mapaLocal) {
    const tRemoto = mapaRemoto.get(id);
    if (tRemoto === undefined) subir.push(id);
    else if (tLocal > tRemoto) subir.push(id);
    else if (tLocal < tRemoto) bajar.push(id);
    else enPaz.push(id);
  }
  for (const [id] of mapaRemoto) {
    if (!mapaLocal.has(id)) bajar.push(id);
  }
  return { subir, bajar, enPaz };
}

/** Marca de sincronización por anotación (no viaja dentro del corpus). */
const KEY_ESTADOS = "lsm-recorder-sync-estados";

export function leerEstados(): Record<string, EstadoSync> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY_ESTADOS) ?? "{}") as Record<
      string,
      EstadoSync
    >;
  } catch {
    return {};
  }
}

export function escribirEstado(id: string, estado: EstadoSync): void {
  try {
    const todos = leerEstados();
    todos[id] = estado;
    localStorage.setItem(KEY_ESTADOS, JSON.stringify(todos));
  } catch {
    // sin almacenamiento: la sincronización sigue funcionando igual
  }
}

/**
 * Cola con rebote: agrupa los cambios de una misma anotación y sube uno
 * solo cuando la persona deja de escribir. Evita una escritura por
 * pulsación de tecla o por cuadro de arrastre.
 */
export function crearColaDeSubida(
  subir: (a: SignAnnotation) => Promise<void>,
  reboteMs = 1500,
) {
  const pendientes = new Map<string, SignAnnotation>();
  const temporizadores = new Map<string, ReturnType<typeof setTimeout>>();

  const enviar = async (id: string) => {
    const a = pendientes.get(id);
    if (!a) return;
    pendientes.delete(id);
    temporizadores.delete(id);
    escribirEstado(id, "guardando");
    try {
      await subir(a);
      escribirEstado(id, "sincronizada");
    } catch {
      escribirEstado(id, "error");
    }
  };

  return {
    encolar(a: SignAnnotation) {
      pendientes.set(a.id, a);
      escribirEstado(a.id, "local");
      const previo = temporizadores.get(a.id);
      if (previo) clearTimeout(previo);
      temporizadores.set(a.id, setTimeout(() => void enviar(a.id), reboteMs));
    },
    /** Fuerza el envío de todo lo pendiente (al salir de la página). */
    async vaciar() {
      for (const t of temporizadores.values()) clearTimeout(t);
      temporizadores.clear();
      await Promise.all([...pendientes.keys()].map((id) => enviar(id)));
    },
    pendientes: () => pendientes.size,
  };
}
