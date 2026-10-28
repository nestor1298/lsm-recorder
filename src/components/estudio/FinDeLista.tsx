"use client";

/**
 * FinDeLista — se acabaron las señas de la lista (o solo quedan las que
 * saltaste): cómo quedó, y a dónde seguir. Si hay videos que no se
 * pudieron subir, lo dice y ofrece volver al estudio para reintentarlos
 * antes de salir (el video solo vive en esta pestaña).
 */

import Link from "next/link";
import { useEffect } from "react";
import { useFocoInicial } from "@/hooks/useFocoInicial";

export default function FinDeLista({
  nombre,
  grabadas,
  total,
  saltadas,
  pendientesSubida,
  sinSubir,
  onVolverASaltadas,
  onVolverAlEstudio,
}: {
  nombre: string;
  grabadas: number;
  total: number;
  saltadas: number;
  pendientesSubida: number;
  sinSubir: number;
  onVolverASaltadas: () => void;
  onVolverAlEstudio: () => void;
}) {
  const foco = useFocoInicial<HTMLButtonElement>();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onVolverAlEstudio();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onVolverAlEstudio]);

  const estado =
    sinSubir > 0
      ? ` ${sinSubir === 1 ? "Un video no se pudo subir" : `${sinSubir} videos no se pudieron subir`}: vuelve al estudio y pulsa «Reintentar» antes de salir, o se perderá${sinSubir === 1 ? "" : "n"}.`
      : pendientesSubida > 0
        ? ` ${pendientesSubida} todavía se ${pendientesSubida === 1 ? "está" : "están"} subiendo: no cierres esta pestaña hasta que termine${pendientesSubida === 1 ? "" : "n"}.`
        : " Todas están en el corpus.";

  const principal = sinSubir > 0 ? "estudio" : saltadas > 0 ? "saltadas" : "tarjeta";
  const clasePrincipal = "rounded-full bg-ink px-6 py-3 text-center font-semibold text-paper hover:bg-gray-800";
  const claseSecundaria =
    "rounded-full border-[1.5px] border-gray-300 px-6 py-3 text-center font-semibold text-ink hover:border-ink";

  return (
    <div className="velo fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fin-titulo"
        aria-describedby="fin-estado"
        className="aparece w-full max-w-lg rounded-2xl bg-paper p-6 shadow-overlay"
      >
        <p className="overline-label text-gray-500">{nombre}</p>
        <h2 id="fin-titulo" className="mt-1 font-display text-2xl font-bold text-ink">
          {saltadas > 0 ? "Llegaste al final de la lista" : "Lista completa"}
        </h2>
        <p id="fin-estado" className="mt-3 text-gray-700">
          Grabaste <strong className="text-ink">{grabadas}</strong> de {total} señas
          {saltadas > 0 ? ` y saltaste ${saltadas}` : ""}.{estado}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {sinSubir > 0 && (
            <button
              ref={principal === "estudio" ? foco : undefined}
              type="button"
              onClick={onVolverAlEstudio}
              className={clasePrincipal}
            >
              Volver al estudio para reintentar
            </button>
          )}
          {saltadas > 0 && (
            <button
              ref={principal === "saltadas" ? foco : undefined}
              type="button"
              onClick={onVolverASaltadas}
              className={principal === "saltadas" ? clasePrincipal : claseSecundaria}
            >
              Volver a las que salté ({saltadas})
            </button>
          )}
          <Link
            ref={principal === "tarjeta" ? (foco as unknown as React.Ref<HTMLAnchorElement>) : undefined}
            href="/tarjeta"
            className={principal === "tarjeta" ? clasePrincipal : claseSecundaria}
          >
            Ver mi tarjeta de señante
          </Link>
          <Link href="/listas" className={claseSecundaria}>
            Elegir otra lista
          </Link>
          {sinSubir === 0 && (
            <button
              type="button"
              onClick={onVolverAlEstudio}
              className="text-sm text-gray-600 underline-offset-4 hover:underline"
            >
              Volver al estudio (Esc)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
