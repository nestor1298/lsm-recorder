"use client";

/**
 * Reloj compartido de la ficha: el esqueleto, el trazo y la partitura
 * leen el mismo tiempo. Da vueltas con una pausa corta al final; al
 * pausar se queda donde iba y `ir` salta a un instante (arrastrando la
 * línea de tiempo).
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Pausa entre vueltas del bucle */
const PAUSA_MS = 600;

export interface Reloj {
  t: number;
  jugando: boolean;
  velocidad: number;
  alternar: () => void;
  setVelocidad: (v: number) => void;
  ir: (ms: number) => void;
}

export function useReloj(total: number, arrancar: boolean): Reloj {
  const [t, setT] = useState(0);
  const [eleccion, setEleccion] = useState<boolean | null>(null);
  const jugando = eleccion ?? arrancar;
  const [velocidad, setVelocidad] = useState(1);
  const fase = useRef(0);

  useEffect(() => {
    if (!jugando || total <= 0) return;
    let raf = 0;
    let antes = performance.now();
    const ciclo = total + PAUSA_MS;
    const tick = (ahora: number) => {
      fase.current = (fase.current + (ahora - antes) * velocidad) % ciclo;
      antes = ahora;
      setT(Math.min(fase.current, total));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [jugando, total, velocidad]);

  const ir = useCallback(
    (ms: number) => {
      fase.current = Math.max(0, Math.min(total, ms));
      setT(fase.current);
    },
    [total],
  );
  const alternar = useCallback(() => setEleccion(!jugando), [jugando]);
  return { t, jugando, velocidad, alternar, setVelocidad, ir };
}

/** prefers-reduced-motion, sin desajuste entre servidor y navegador */
export function useMenosMovimiento(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      mq?.addEventListener("change", cb);
      return () => mq?.removeEventListener("change", cb);
    },
    () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
    () => false,
  );
}

export const segundos = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
