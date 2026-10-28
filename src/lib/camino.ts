/**
 * camino.ts — en qué paso del camino va una persona y a dónde mandarla.
 *
 * Unirse tiene tres pasos: 1 quién eres (correo y apodo), 2 un poco de ti
 * (cuestionario) y 3 cómo participas (nivel de acceso y acuerdo). El
 * servidor es la fuente de verdad (/api/me); el cliente solo decide la
 * ruta. Se usa igual en Entrar, Unirse, Listas y Estudio.
 */

export type PasoUnirse = 1 | 2 | 3;

export interface EstadoCamino {
  consentStatus: "none" | "granted" | "withdrawn";
  hasMetadata: boolean;
  apodo?: string | null;
}

/** Primer paso que falta, o null si ya puede entrar al estudio. */
export function pasoPendiente(me: EstadoCamino): PasoUnirse | null {
  if (!me.apodo) return 1;
  if (!me.hasMetadata) return 2;
  if (me.consentStatus !== "granted") return 3;
  return null;
}

export function rutaUnirse(paso: PasoUnirse): string {
  return `/unirse?paso=${paso}`;
}

/** Ruta después de entrar: el paso que falte, o a donde iba, o las listas. */
export function rutaDespuesDeEntrar(me: EstadoCamino, volverA: string | null): string {
  const paso = pasoPendiente(me);
  if (paso) return rutaUnirse(paso);
  return volverA ?? "/listas";
}

export function leerPaso(valor: string | null): PasoUnirse | null {
  return valor === "1" || valor === "2" || valor === "3"
    ? (Number(valor) as PasoUnirse)
    : null;
}
