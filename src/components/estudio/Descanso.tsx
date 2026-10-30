"use client";

/**
 * Descanso — la pausa del estudio (tecla B): cómo vas, a qué señas de la
 * comunidad les falta poco, y volver. También sirve de salida limpia a las
 * listas.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchComunidad, type ComunidadResponse } from "@/lib/api-client";
import { describirItem } from "@/lib/corpus";
import CirculoManos from "@/components/manos/CirculoManos";
import { useFocoInicial } from "@/hooks/useFocoInicial";

export default function Descanso({
  senas,
  videosSesion,
  onSeguir,
}: {
  /** señas en las que ya eres una mano */
  senas: number;
  videosSesion: number;
  onSeguir: () => void;
}) {
  const [comunidad, setComunidad] = useState<ComunidadResponse | null>(null);

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

  useEffect(() => {
    let activo = true;
    fetchComunidad()
      .then((c) => {
        if (activo) setComunidad(c);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  const foco = useFocoInicial<HTMLButtonElement>();
  const casi = comunidad?.casi.slice(0, 4) ?? [];
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
            <dt className="text-xs text-gray-500">Videos en esta lista</dt>
            <dd className="font-display text-2xl font-bold text-ink">{videosSesion}</dd>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <dt className="text-xs text-gray-500">Señas con tu mano</dt>
            <dd className="font-display text-2xl font-bold text-ink">{senas}</dd>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <dt className="text-xs text-gray-500">Manos esta semana</dt>
            <dd className="font-display text-2xl font-bold text-ink">
              {comunidad ? comunidad.deLaSemana.manos : "·"}
            </dd>
          </div>
        </dl>

        {casi.length > 0 && (
          <div className="mt-5 rounded-xl border border-gray-200 p-4">
            <p className="overline-label mb-3 text-gray-500">Les falta poco</p>
            <ul className="space-y-2">
              {casi.map((s) => (
                <li key={`${s.corpus}:${s.itemId}`} className="flex items-center gap-3 text-sm">
                  <CirculoManos manos={s.manos} esperando size={32} />
                  <span className="font-semibold text-ink">{describirItem(s.corpus, s.itemId).titulo}</span>
                  <span className="text-gray-500">
                    {s.faltan === 1 ? "a una mano" : `faltan ${s.faltan}`}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/comunidad"
              className="mt-3 inline-block text-sm font-semibold text-accent-deep underline-offset-4 hover:underline"
            >
              Ver la comunidad
            </Link>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            ref={foco}
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
