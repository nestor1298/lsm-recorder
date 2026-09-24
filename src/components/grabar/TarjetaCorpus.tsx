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
      <MarcaCorpus
        corpus={corpus}
        className="w-24 shrink-0 rounded-xl shadow-card sm:w-28"
        animada={corpus === "lsm"}
      />
      <div className="min-w-0 flex-1">
        <p className="overline-label text-gray-500">{info.lema}</p>
        <h3 className="mt-1 font-display text-xl font-bold text-ink">
          {info.nombre}
        </h3>
        <p className="mt-2 text-sm text-gray-600">{info.descripcion}</p>
        <p className="mt-3 text-sm font-semibold text-ink">
          {info.total} señas
          <span className="ml-3 font-medium text-accent-deep group-hover:underline">
            {accion} →
          </span>
        </p>
      </div>
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
