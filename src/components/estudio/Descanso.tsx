"use client";

/**
 * Descanso — la pausa del estudio (tecla B): cómo vas, el tablero de la
 * semana y volver. También sirve de salida limpia a las listas.
 */

import { useEffect } from "react";
import Link from "next/link";
import { faltanParaCofre, MEDALLAS, siguienteMedalla } from "@/lib/progresion";
import TablaSemana from "@/components/tablero/TablaSemana";

export default function Descanso({
  nivel,
  videosSesion,
  onSeguir,
}: {
  nivel: number;
  videosSesion: number;
  onSeguir: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "b") {
        e.preventDefault();
        e.stopPropagation();
        onSeguir();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onSeguir]);

  const medalla = MEDALLAS.filter((m) => nivel >= m.nivel).at(-1) ?? null;
  const siguiente = siguienteMedalla(nivel);
  return (
    <div className="velo fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="descanso-titulo"
        className="aparece w-full max-w-lg rounded-2xl bg-paper p-6 shadow-overlay"
      >
        <p className="overline-label text-gray-500">Descanso</p>
        <h2 id="descanso-titulo" className="mt-1 font-display text-2xl font-bold text-ink">
          Respira. La lista te espera.
        </h2>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-gray-50 p-3">
            <dt className="text-xs text-gray-500">Nivel</dt>
            <dd className="font-display text-2xl font-bold text-ink">{nivel}</dd>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <dt className="text-xs text-gray-500">Hoy en esta lista</dt>
            <dd className="font-display text-2xl font-bold text-ink">{videosSesion}</dd>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <dt className="text-xs text-gray-500">Para el cofre</dt>
            <dd className="font-display text-2xl font-bold text-ink">{faltanParaCofre(nivel)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-gray-600">
          {medalla ? `Medalla de ${medalla.nombre.toLowerCase()}. ` : ""}
          {siguiente
            ? `${siguiente.nombre} al nivel ${siguiente.nivel}: faltan ${siguiente.nivel - nivel} videos.`
            : "Tienes todas las medallas."}
        </p>
        <div className="mt-5 rounded-xl border border-gray-200 p-4">
          <p className="overline-label mb-2 text-gray-500">Tablero de la semana</p>
          <TablaSemana compacta />
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onSeguir}
            className="flex-1 rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:bg-gray-800"
          >
            Seguir (B)
          </button>
          <Link
            href="/listas"
            className="flex-1 rounded-full border-[1.5px] border-gray-300 px-6 py-3 text-center font-semibold text-ink hover:border-ink"
          >
            Salir a las listas
          </Link>
        </div>
      </div>
    </div>
  );
}
