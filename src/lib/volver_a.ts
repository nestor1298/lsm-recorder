/**
 * volver_a.ts — a dónde regresar después de iniciar sesión, dar el
 * consentimiento o llenar el perfil. Grabar guarda la ruta con la que se
 * llegó (p. ej. /record?corpus=signaplay) para que el corpus elegido en
 * Inicio no se pierda en el camino. Solo rutas internas ("/…", no "//…").
 */

const CLAVE = "signalab.volverA";

export function guardarVolverA(ruta: string): void {
  if (typeof window === "undefined") return;
  if (!ruta.startsWith("/") || ruta.startsWith("//")) return;
  try {
    sessionStorage.setItem(CLAVE, ruta);
  } catch {
    // sin sessionStorage (modo privado estricto): se pierde, no rompe
  }
}

/** Devuelve la ruta guardada (y la borra) o null. */
export function tomarVolverA(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
  } catch {
    return null;
  }
}
