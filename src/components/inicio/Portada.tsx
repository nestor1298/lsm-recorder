"use client";

/**
 * Portada — la primera pantalla: qué es esto, por qué, y un solo botón
 * para empezar. La intro de 40 segundos se abre encima; «Entrar» para
 * quien ya tiene cuenta.
 */

import { useState } from "react";
import Link from "next/link";
import MarcaLSMCorpus from "@/components/marca/MarcaLSMCorpus";
import Intro40, { INTRO_SEGUNDOS } from "./Intro40";

const HECHOS = [
  {
    titulo: "Juntos",
    texto: "cada seña busca nueve manos; tú puedes ser una, y nadie compite",
  },
  {
    titulo: "Tuyo y gratis",
    texto: "tú decides quién ve cada video y lo retiras cuando quieras",
  },
  {
    titulo: "Útil",
    texto: "un corpus de la LSM para investigar, enseñar y jugar en SignaPlay",
  },
];

export default function Portada() {
  const [intro, setIntro] = useState(false);
  return (
    <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div>
        <p className="overline-label text-gray-500">SignaLab · OtherAI</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-[-0.02em] text-ink sm:text-6xl">
          Seña en LSM.
          <br />
          Construye el corpus.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-gray-600">
          Cada seña de la Lengua de Señas Mexicana busca nueve manos: nueve
          personas distintas que la hagan frente a su cámara. Graba las tuyas,
          cierra círculos y llena tu atlas de la mano.{" "}
          <strong className="text-ink">Gratis</strong>, y hecho con la comunidad
          sorda.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/unirse"
            className="rounded-full bg-ink px-7 py-3 font-semibold text-paper transition-colors hover:bg-gray-800"
          >
            Dar mi mano
          </Link>
          <button
            type="button"
            onClick={() => setIntro(true)}
            className="rounded-full border-[1.5px] border-gray-300 px-7 py-3 font-semibold text-ink transition-colors hover:border-ink"
          >
            Ver la historia ({INTRO_SEGUNDOS} s)
          </button>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/auth" className="font-semibold text-ink underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>

        <dl className="mt-10 grid gap-4 sm:grid-cols-3">
          {HECHOS.map((h) => (
            <div key={h.titulo} className="rounded-2xl border border-gray-200 bg-paper p-4 shadow-card">
              <dt className="font-display text-xl font-bold text-ink">{h.titulo}</dt>
              <dd className="mt-1 text-sm text-gray-600">{h.texto}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mx-auto w-56 sm:w-72 lg:w-full lg:max-w-xs">
        <MarcaLSMCorpus className="rounded-2xl shadow-raised" />
      </div>
      {intro && <Intro40 onCerrar={() => setIntro(false)} />}
    </section>
  );
}
