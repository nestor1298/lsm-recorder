"use client";

import { useEffect, useRef } from "react";

/**
 * Lleva el foco al elemento al montarse (el botón principal de un diálogo)
 * y lo devuelve a donde estaba al cerrarse. Así, con teclado, Tab y Enter
 * actúan dentro del diálogo y no sobre lo que quedó debajo del velo.
 */
export function useFocoInicial<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      try {
        antes?.focus?.({ preventScroll: true });
      } catch {
        // el elemento ya no existe: no pasa nada
      }
    };
  }, []);
  return ref;
}
