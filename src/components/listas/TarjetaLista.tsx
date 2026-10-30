"use client";

/**
 * TarjetaLista — una lista para elegir: corpus, nombre, cuántas señas,
 * cuántas personas por seña van (puntos, de la meta de 9), etiquetas de
 * «Prioridad» y «Más necesitada», y lo que tú ya llevas de ella.
 */

import { CORPUS_INFO } from "@/lib/corpus";
import { META_SENANTES, minutosEstimados, type ListaDef } from "@/lib/listas";
import { MarcaCorpus } from "@/components/grabar/TarjetaCorpus";

export interface EstadoLista {
  senantes: number;
  pct: number;
  tuyas: number;
  masNecesitada: boolean;
}

export default function TarjetaLista({
  lista,
  estado,
  onElegir,
}: {
  lista: ListaDef;
  estado?: EstadoLista;
  onElegir: (lista: ListaDef) => void;
}) {
  const total = lista.items.length;
  const tuyas = estado?.tuyas ?? 0;
  const hechaPct = total ? Math.floor((tuyas / total) * 100) : 0;
  const completa = tuyas >= total;

  return (
    <button
      id={lista.id}
      type="button"
      onClick={() => onElegir(lista)}
      className={`group flex w-full flex-col rounded-2xl border bg-paper p-5 text-left shadow-card transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-accent ${
        estado?.masNecesitada ? "border-coral" : lista.prioridad ? "border-ink" : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-4">
        <span aria-hidden className="w-14 shrink-0">
          <MarcaCorpus corpus={lista.corpus} className="rounded-lg shadow-card" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="overline-label text-gray-500">{CORPUS_INFO[lista.corpus].nombre}</span>
            {estado?.masNecesitada && (
              <span className="rounded-full bg-coral-tint px-2 py-0.5 text-xs font-semibold text-coral-deep">
                Más necesitada
              </span>
            )}
            {lista.prioridad && !estado?.masNecesitada && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-paper">
                Prioridad
              </span>
            )}
            {completa && (
              <span className="rounded-full bg-green-tint px-2 py-0.5 text-xs font-semibold text-green-deep">
                Completa
              </span>
            )}
          </span>
          <span className="mt-1 block font-display text-xl font-bold text-ink">{lista.nombre}</span>
          <span className="mt-1 block text-sm text-gray-600">{lista.subtitulo}</span>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-gray-700">
          <strong className="text-ink">{total}</strong> señas · unos{" "}
          <strong className="text-ink">{minutosEstimados(total)}</strong> min
        </span>
        <span className="flex items-center gap-2" title={`Manos por seña, en promedio: ${estado?.senantes ?? 0} de ${META_SENANTES}`}>
          <span className="flex gap-0.5" aria-hidden>
            {Array.from({ length: META_SENANTES }, (_, i) => (
              <i
                key={i}
                className={`block h-2 w-2 rounded-full ${
                  i < (estado?.senantes ?? 0) ? "bg-green" : "bg-gray-200"
                }`}
              />
            ))}
          </span>
          <span className="text-gray-500">
            {estado?.senantes ?? 0} de {META_SENANTES} manos
          </span>
        </span>
      </div>

      {tuyas > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Tú llevas {tuyas} de {total}</span>
            <span>{hechaPct} %</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
            <div className="h-full rounded-full bg-ink" style={{ width: `${hechaPct}%` }} />
          </div>
        </div>
      )}

      <span className="mt-4 text-sm font-semibold text-accent-deep group-hover:underline">
        {completa ? "Volver a grabarla →" : tuyas > 0 ? "Seguir →" : "Elegir →"}
      </span>
    </button>
  );
}
