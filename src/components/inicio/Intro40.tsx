"use client";

/**
 * Intro40 — la intro de 40 segundos: la historia de una seña. Alguien
 * busca MAÑANA y no la encuentra descrita; una sola persona no basta;
 * cada seña busca nueve manos; tú puedes ser una; tu cara se queda; la
 * novena mano cierra el círculo; y la seña sigue su camino a la
 * investigación, a Aprender y a SignaPlay.
 *
 * Ocho escenas, cada una con su dibujo animado (historia/Escenas.tsx),
 * movidas por un solo reloj: barra de progreso por escena, Pausa, Saltar
 * (→), Esc para cerrar. Con movimiento reducido cada escena se dibuja en
 * su cuadro final. Sin sonido: todo está en el texto y en el dibujo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFocoInicial } from "@/hooks/useFocoInicial";
import { ESCENAS, Lienzo } from "./historia/Escenas";
import CirculoManos from "@/components/manos/CirculoManos";

interface Escena {
  /** segundos en pantalla */
  dura: number;
  titulo: string;
  linea: string;
}

const HISTORIA: Escena[] = [
  {
    dura: 4.5,
    titulo: "Piensa en una seña.",
    linea: "La primera que aprendiste. La que usas todos los días.",
  },
  {
    dura: 5,
    titulo: "Ahora búscala en internet.",
    linea: "Con suerte hay un video. Casi nunca dice cómo se forma: qué mano, dónde, hacia dónde, con qué cara.",
  },
  {
    dura: 5,
    titulo: "Una sola persona no basta.",
    linea: "Cada quien la hace con sus manos, su cara, su región y su historia. Una lengua viva se documenta con muchas.",
  },
  {
    dura: 5.5,
    titulo: "Nueve manos por seña.",
    linea: "Nueve personas distintas, de distintos lugares, hacen la misma seña. Así se arma el corpus de la LSM.",
  },
  {
    dura: 5,
    titulo: "Tú puedes ser una.",
    linea: "Lees la seña, la haces frente a tu cámara y sigues. Desde tu casa, a tu ritmo, sin mínimo.",
  },
  {
    dura: 5,
    titulo: "Tu cara se queda.",
    linea: "Es parte de la seña: no la borramos. Tú eliges quién ve cada video y lo retiras cuando quieras.",
  },
  {
    dura: 5,
    titulo: "La novena mano cierra el círculo.",
    linea: "La seña queda completa, con los apodos de sus nueve manos. Nunca tu nombre.",
  },
  {
    dura: 5,
    titulo: "Y la seña sigue su camino.",
    linea: "A la investigación, al modo Aprender y a las lecciones de SignaPlay, donde una niña o un niño puede aprenderla de ti.",
  },
];

const DIAPOSITIVAS = HISTORIA;

export const INTRO_SEGUNDOS = Math.round(DIAPOSITIVAS.reduce((a, d) => a + d.dura, 0));

export default function Intro40({ onCerrar }: { onCerrar: () => void }) {
  const [i, setI] = useState(0);
  const [progreso, setProgreso] = useState(0); // 0..1 de la diapositiva actual
  const [pausada, setPausada] = useState(false);
  const [terminada, setTerminada] = useState(false);
  const cerrarRef = useFocoInicial<HTMLButtonElement>();
  const inicioRef = useRef(0);
  const acumuladoRef = useRef(0);
  // Solo se monta en el cliente (al pulsar «Ver la intro»), así que se puede leer aquí.
  const [reducido] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false),
  );

  // reloj por diapositiva (rAF); en pausa se congela el acumulado
  useEffect(() => {
    if (terminada || pausada) return;
    let raf = 0;
    inicioRef.current = performance.now();
    const paso = (ahora: number) => {
      const dura = DIAPOSITIVAS[i].dura * 1000;
      const t = acumuladoRef.current + (ahora - inicioRef.current);
      if (t >= dura) {
        acumuladoRef.current = 0;
        if (i + 1 < DIAPOSITIVAS.length) setI(i + 1);
        else setTerminada(true);
        return;
      }
      setProgreso(t / dura);
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(raf);
      acumuladoRef.current += performance.now() - inicioRef.current;
    };
  }, [i, pausada, terminada]);

  const saltar = useCallback(() => {
    acumuladoRef.current = 0;
    if (i + 1 < DIAPOSITIVAS.length) {
      setI(i + 1);
      setProgreso(0);
    } else setTerminada(true);
  }, [i]);

  const verDeNuevo = useCallback(() => {
    acumuladoRef.current = 0;
    setI(0);
    setProgreso(0);
    setTerminada(false);
    setPausada(false);
  }, []);

  // teclado: Esc cierra, espacio pausa, → salta
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      else if (e.key === " ") {
        e.preventDefault();
        setPausada((p) => !p);
      } else if (e.key === "ArrowRight") saltar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar, saltar]);

  const d = DIAPOSITIVAS[i];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Intro de 40 segundos: la historia de una seña"
      className="velo fixed inset-0 z-50 flex flex-col bg-ink text-paper"
    >
      {/* barra de progreso por diapositiva + cerrar */}
      <div className="flex items-center gap-3 px-4 pt-4 sm:px-8">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {DIAPOSITIVAS.map((_, k) => (
            <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-gray-700">
              <span
                className="block h-full bg-paper"
                style={{
                  width: k < i || terminada ? "100%" : k === i ? `${progreso * 100}%` : "0%",
                }}
              />
            </span>
          ))}
        </div>
        <button
          ref={cerrarRef}
          type="button"
          onClick={onCerrar}
          className="rounded-full border border-gray-600 px-3 py-1 text-sm text-gray-300 hover:border-paper hover:text-paper"
          aria-label="Cerrar la intro"
        >
          Cerrar
        </button>
      </div>

      {/* la escena: dibujo arriba, texto abajo */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-4 text-center">
        {!terminada ? (
          <>
            <Lienzo className="aspect-[480/270] max-h-[50vh] w-full max-w-2xl">
              {(() => {
                const Dibujo = ESCENAS[i];
                return <Dibujo p={reducido ? 1 : progreso} />;
              })()}
            </Lienzo>
            <div key={i} className={reducido ? "mt-6" : "diapositiva mt-6"}>
              <p className="font-display text-3xl font-bold tracking-[-0.02em] sm:text-5xl">{d.titulo}</p>
              <p className="mx-auto mt-4 max-w-2xl text-base text-gray-200 sm:text-xl">{d.linea}</p>
            </div>
          </>
        ) : (
          <div className="diapositiva flex flex-col items-center space-y-6">
            <CirculoManos manos={8} esperando oscuro size={150} />
            <p className="font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              ¿Le das una mano a la LSM?
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/unirse"
                className="rounded-full bg-paper px-7 py-3 font-semibold text-ink transition-colors hover:bg-gray-200"
              >
                Dar mi mano
              </Link>
              <Link
                href="/preguntas"
                className="rounded-full border-[1.5px] border-gray-500 px-7 py-3 font-semibold text-paper transition-colors hover:border-paper"
              >
                Preguntas primero
              </Link>
            </div>
            <button
              type="button"
              onClick={verDeNuevo}
              className="text-sm text-gray-400 underline-offset-4 hover:underline"
            >
              Ver de nuevo
            </button>
          </div>
        )}
      </div>

      {/* controles */}
      {!terminada && (
        <div className="flex items-center justify-between px-6 pb-6 text-sm text-gray-400 sm:px-10">
          <button
            type="button"
            onClick={() => setPausada((p) => !p)}
            className="rounded-full px-3 py-1.5 hover:bg-gray-800 hover:text-paper"
            aria-pressed={pausada}
          >
            {pausada ? "Seguir" : "Pausa"}
          </button>
          <span aria-live="polite" className="sr-only">
            Escena {i + 1} de {DIAPOSITIVAS.length}: {d.titulo} {d.linea}
          </span>
          <button
            type="button"
            onClick={saltar}
            className="rounded-full px-3 py-1.5 hover:bg-gray-800 hover:text-paper"
          >
            Saltar
          </button>
        </div>
      )}
    </div>
  );
}
