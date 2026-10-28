"use client";

/**
 * DialogoCompromiso — antes de entrar al estudio: cuántas señas son y
 * cuánto tardan, y la pregunta directa: ¿puedes con esta lista?
 */

import { useEffect, useRef } from "react";
import { minutosEstimados, type ListaDef } from "@/lib/listas";
import { CORPUS_INFO } from "@/lib/corpus";

export default function DialogoCompromiso({
  lista,
  tuyas,
  onSi,
  onNo,
}: {
  lista: ListaDef;
  tuyas: number;
  onSi: () => void;
  onNo: () => void;
}) {
  const tarjeta = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tarjeta.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onNo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNo]);

  const total = lista.items.length;
  const faltan = Math.max(0, total - tuyas);
  return (
    <div className="velo fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div
        ref={tarjeta}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compromiso-titulo"
        tabIndex={-1}
        className="aparece w-full max-w-md rounded-2xl bg-paper p-6 shadow-overlay"
      >
        <p className="overline-label text-gray-500">{CORPUS_INFO[lista.corpus].nombre}</p>
        <h2 id="compromiso-titulo" className="mt-1 font-display text-2xl font-bold text-ink">
          {lista.nombre}
        </h2>
        <div className="mt-4 space-y-2 text-gray-700">
          <p>
            Son <strong className="text-ink">{total} señas</strong>, una por video de 3 a 7
            segundos. Unos <strong className="text-ink">{minutosEstimados(faltan || total)} minutos</strong>
            {tuyas > 0 && tuyas < total ? ` para las ${faltan} que te faltan` : ""}.
          </p>
          <p>Puedes parar cuando quieras y seguir después: la lista te espera.</p>
          <p className="font-semibold text-ink">¿Puedes con esta lista?</p>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onSi}
            className="flex-1 rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:bg-gray-800"
          >
            Sí, puedo
          </button>
          <button
            type="button"
            onClick={onNo}
            className="flex-1 rounded-full border-[1.5px] border-gray-300 px-6 py-3 font-semibold text-ink hover:border-ink"
          >
            No, muéstrame otras listas
          </button>
        </div>
      </div>
    </div>
  );
}
