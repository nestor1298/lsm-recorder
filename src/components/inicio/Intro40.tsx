"use client";

/**
 * Intro40 — la intro de 40 segundos: ocho diapositivas que cuentan por
 * qué señar aquí, qué se graba, qué pasa con tu rostro y cómo es el
 * juego. Se abre encima de Inicio, con barra de progreso por diapositiva,
 * Pausa y Saltar; al final ofrece empezar o leer las preguntas.
 *
 * Sin sonido: todo está en el texto y en el movimiento de los números.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Diapositiva {
  /** segundos en pantalla */
  dura: number;
  /** cifras grandes (se cuentan desde cero) o frase grande */
  grande: { cifra?: number; sufijo?: string; texto?: string }[];
  linea: string;
  nota?: string;
}

const DIAPOSITIVAS: Diapositiva[] = [
  {
    dura: 5,
    grande: [
      { cifra: 70, sufijo: " M+" },
      { cifra: 300, sufijo: "+" },
    ],
    linea: "70 millones de personas sordas. Más de 300 lenguas de señas.",
    nota: "Y la tecnología apenas entiende las señas. Tus manos pueden cambiarlo. Fuente: Federación Mundial de Sordos.",
  },
  {
    dura: 5,
    grande: [{ texto: "Desde 2005 la LSM es lengua nacional." }],
    linea: "Pero casi no hay corpus: videos de señas descritos uno por uno, para investigar y para enseñar.",
  },
  {
    dura: 5,
    grande: [{ texto: "Lee una seña. Hazla. Siguiente." }],
    linea: "Una seña por video, de 3 a 7 segundos, con tu cámara. Desde tu casa, a la hora que sea. Sin mínimo: paras cuando quieras.",
  },
  {
    dura: 5.5,
    grande: [{ texto: "Tu rostro es parte de tu lengua." }],
    linea: "No lo borramos. Tú decides quién ve cada video: abierto, investigación o restringido. Y lo retiras cuando quieras.",
  },
  {
    dura: 5,
    grande: [{ texto: "Un juego. Gratis." }],
    linea: "Cada video sube un nivel. Un cofre cada 10 videos. Colecciona señas: comunes, raras, épicas y legendarias.",
  },
  {
    dura: 5,
    grande: [{ texto: "Gana tus medallas." }],
    linea: "Bronce al nivel 30, Plata al 50, Oro al 70, Diamante al 100. Y el tablero de la semana, con tu apodo.",
  },
  {
    dura: 4.5,
    grande: [{ texto: "Tu tarjeta de señante." }],
    linea: "Tus videos, tus configuraciones de mano, tu seña más rara. Para compartir, sin tu nombre real.",
  },
  {
    dura: 5,
    grande: [{ texto: "De la seña al corpus." }],
    linea: "Para investigar, para el modo Aprender y para las lecciones de SignaPlay. Más personas señantes, mejor corpus. Esto lo cambia todo para nosotros.",
  },
];

export const INTRO_SEGUNDOS = Math.round(DIAPOSITIVAS.reduce((a, d) => a + d.dura, 0));

function Cifra({ hasta, sufijo, progreso }: { hasta: number; sufijo?: string; progreso: number }) {
  // cuenta desde 0 en el primer 60 % del tiempo de la diapositiva
  const p = Math.min(1, progreso / 0.6);
  const suave = 1 - Math.pow(1 - p, 3);
  return (
    <span className="tabular-nums">
      {Math.round(hasta * suave)}
      {sufijo}
    </span>
  );
}

export default function Intro40({ onCerrar }: { onCerrar: () => void }) {
  const [i, setI] = useState(0);
  const [progreso, setProgreso] = useState(0); // 0..1 de la diapositiva actual
  const [pausada, setPausada] = useState(false);
  const [terminada, setTerminada] = useState(false);
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
      aria-label="Intro de 40 segundos"
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
          type="button"
          onClick={onCerrar}
          className="rounded-full border border-gray-600 px-3 py-1 text-sm text-gray-300 hover:border-paper hover:text-paper"
          aria-label="Cerrar la intro"
        >
          Cerrar
        </button>
      </div>

      {/* la diapositiva */}
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        {!terminada ? (
          <div key={i} className={reducido ? "" : "diapositiva"}>
            <p className="font-display text-4xl font-bold tracking-[-0.02em] sm:text-6xl">
              {d.grande.map((g, k) => (
                <span key={k} className={k > 0 ? "ml-6" : ""}>
                  {g.cifra !== undefined ? (
                    <Cifra
                      hasta={g.cifra}
                      sufijo={g.sufijo}
                      progreso={reducido ? 1 : progreso}
                    />
                  ) : (
                    g.texto
                  )}
                </span>
              ))}
            </p>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-200 sm:text-xl">{d.linea}</p>
            {d.nota && <p className="mx-auto mt-3 max-w-xl text-sm text-gray-400">{d.nota}</p>}
          </div>
        ) : (
          <div className="diapositiva space-y-6">
            <p className="font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              ¿Empezamos?
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/unirse"
                className="rounded-full bg-paper px-7 py-3 font-semibold text-ink transition-colors hover:bg-gray-200"
              >
                Empezar a señar
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
            Diapositiva {i + 1} de {DIAPOSITIVAS.length}
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
