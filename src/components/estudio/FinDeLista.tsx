"use client";

/**
 * FinDeLista — se acabaron las señas de la lista (o solo quedan las que
 * saltaste): cómo quedó, y a dónde seguir.
 */

import Link from "next/link";

export default function FinDeLista({
  nombre,
  grabadas,
  total,
  saltadas,
  pendientesSubida,
  onVolverASaltadas,
}: {
  nombre: string;
  grabadas: number;
  total: number;
  saltadas: number;
  pendientesSubida: number;
  onVolverASaltadas: () => void;
}) {
  return (
    <div className="velo fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fin-titulo"
        className="aparece w-full max-w-lg rounded-2xl bg-paper p-6 shadow-overlay"
      >
        <p className="overline-label text-gray-500">{nombre}</p>
        <h2 id="fin-titulo" className="mt-1 font-display text-2xl font-bold text-ink">
          {saltadas > 0 ? "Llegaste al final de la lista" : "Lista completa"}
        </h2>
        <p className="mt-3 text-gray-700">
          Grabaste <strong className="text-ink">{grabadas}</strong> de {total} señas
          {saltadas > 0 ? ` y saltaste ${saltadas}` : ""}.
          {pendientesSubida > 0
            ? ` ${pendientesSubida} todavía se están subiendo: no cierres esta pestaña hasta que terminen.`
            : " Todas están en el corpus."}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {saltadas > 0 && (
            <button
              type="button"
              onClick={onVolverASaltadas}
              className="rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:bg-gray-800"
            >
              Volver a las que salté ({saltadas})
            </button>
          )}
          <Link
            href="/tarjeta"
            className={`rounded-full px-6 py-3 text-center font-semibold ${
              saltadas > 0
                ? "border-[1.5px] border-gray-300 text-ink hover:border-ink"
                : "bg-ink text-paper hover:bg-gray-800"
            }`}
          >
            Ver mi tarjeta de señante
          </Link>
          <Link
            href="/listas"
            className="rounded-full border-[1.5px] border-gray-300 px-6 py-3 text-center font-semibold text-ink hover:border-ink"
          >
            Elegir otra lista
          </Link>
        </div>
      </div>
    </div>
  );
}
