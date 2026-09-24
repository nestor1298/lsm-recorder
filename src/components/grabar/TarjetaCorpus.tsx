"use client";

/**
 * TarjetaCorpus — una de las dos puertas de Grabar. Muestra la marca del
 * corpus, para qué sirve y cuántas señas tiene. Es un botón o un enlace
 * según de dónde se use (elegir dentro de /record o entrar desde Inicio).
 */

import Link from "next/link";
import { CORPUS_INFO, type CorpusId } from "@/lib/corpus";
import MarcaLSMCorpus from "@/components/marca/MarcaLSMCorpus";
import MarcaSignaPlay from "@/components/marca/MarcaSignaPlay";

export function MarcaCorpus({
  corpus,
  className = "",
  animada = false,
}: {
  corpus: CorpusId;
  className?: string;
  animada?: boolean;
}) {
  return corpus === "lsm" ? (
    <MarcaLSMCorpus className={className} animada={animada} />
  ) : (
    <MarcaSignaPlay className={className} />
  );
}

export default function TarjetaCorpus({
  corpus,
  href,
  onClick,
  accion = "Elegir",
}: {
  corpus: CorpusId;
  href?: string;
  onClick?: () => void;
  accion?: string;
}) {
  const info = CORPUS_INFO[corpus];
  const cuerpo = (
    <>
      {/* la marca late solo en la portada; aquí queda fija para no duplicar animación */}
      <span aria-hidden className="w-24 shrink-0 sm:w-28">
        <MarcaCorpus corpus={corpus} className="rounded-xl shadow-card" />
      </span>
      {/* solo contenido de frase: la tarjeta puede ser un <button> */}
      <span className="block min-w-0 flex-1">
        <span className="overline-label block text-gray-500">{info.lema}</span>
        <span className="mt-1 block font-display text-xl font-bold text-ink">
          {info.nombre}
        </span>
        <span className="mt-2 block text-sm text-gray-600">{info.descripcion}</span>
        <span className="mt-3 block text-sm font-semibold text-ink">
          {info.total} señas
          <span className="ml-3 font-medium text-accent-deep group-hover:underline">
            {accion} →
          </span>
        </span>
      </span>
    </>
  );
  const clase =
    "group flex w-full items-start gap-5 rounded-2xl border border-gray-200 bg-paper p-5 text-left shadow-card transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-accent";
  return href ? (
    <Link href={href} className={clase}>
      {cuerpo}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={clase}>
      {cuerpo}
    </button>
  );
}
