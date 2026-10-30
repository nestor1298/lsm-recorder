"use client";

/**
 * Celebraciones — los momentos de las nueve manos al confirmar un video:
 *
 * - AvisoMano: siempre, breve y sin bloquear: «Eres la mano 4 de 9».
 * - PrimeraMano: tu primer video en el corpus.
 * - CirculoCerrado: fuiste la novena mano; la seña quedó completa.
 * - GrupoCompleto: completaste un grupo de dedos del atlas de la mano.
 * - SelloGanado: grabaste completa una ruta de SignaPlay.
 *
 * Los diálogos se cierran con el botón o con Enter/Esc/espacio y nunca
 * bloquean la grabación más de un gesto.
 */

import { useEffect } from "react";
import { describirItem, type CorpusId } from "@/lib/corpus";
import { CM_INVENTORY } from "@/lib/data";
import { GRUPOS_ATLAS, MANOS_POR_SENA, RUTAS, type GrupoId } from "@/lib/nueve_manos";
import { MiniHand } from "@/components/learn/MiniHand";
import CirculoManos from "@/components/manos/CirculoManos";
import SelloRuta from "@/components/manos/SelloRuta";
import { useFocoInicial } from "@/hooks/useFocoInicial";

export type Celebracion =
  | { tipo: "primera"; corpus: CorpusId; itemId: string; mano: number | null }
  | { tipo: "circulo"; corpus: CorpusId; itemId: string }
  | { tipo: "grupo"; grupo: GrupoId }
  | { tipo: "sello"; ruta: number };

function useCerrarConTeclado(onCerrar: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onCerrar();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCerrar]);
}

/** El texto de tu lugar en el círculo. */
export function textoMano(mano: number | null, glosa: string): string {
  if (mano === null) return `Ya eras una de las manos de ${glosa}. Este video suma variedad.`;
  if (mano > MANOS_POR_SENA) return `Mano ${mano} de ${glosa}: ya estaba completa y la tuya suma.`;
  if (mano === MANOS_POR_SENA) return `Novena mano de ${glosa}. Círculo cerrado.`;
  const faltan = MANOS_POR_SENA - mano;
  return `Eres la mano ${mano} de ${MANOS_POR_SENA} de ${glosa}. ${faltan === 1 ? "Falta una." : `Faltan ${faltan}.`}`;
}

export function AvisoMano({
  corpus,
  itemId,
  mano,
}: {
  corpus: CorpusId;
  itemId: string;
  mano: number | null;
}) {
  const glosa = describirItem(corpus, itemId).titulo;
  return (
    <div
      role="status"
      className="sube-aviso pointer-events-none absolute bottom-4 left-4 right-4 flex max-w-md items-center gap-3 rounded-2xl bg-ink px-3 py-2 text-sm text-paper shadow-raised sm:right-auto"
    >
      <CirculoManos manos={mano ?? 0} tuya={mano} size={40} oscuro animar />
      <span className="font-semibold">{textoMano(mano, glosa)}</span>
    </div>
  );
}

function Dialogo({
  id,
  sobre,
  titulo,
  children,
  onCerrar,
}: {
  id: string;
  sobre: string;
  titulo: string;
  children: React.ReactNode;
  onCerrar: () => void;
}) {
  useCerrarConTeclado(onCerrar);
  const foco = useFocoInicial<HTMLButtonElement>();
  return (
    <div className="velo fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="momento-entra w-full max-w-sm rounded-2xl bg-paper p-6 text-center shadow-overlay"
      >
        <p className="overline-label text-gray-500">{sobre}</p>
        <h2 id={id} className="mt-1 font-display text-2xl font-bold text-ink">
          {titulo}
        </h2>
        {children}
        <button
          ref={foco}
          type="button"
          onClick={onCerrar}
          className="mt-6 w-full rounded-full bg-ink py-3 font-semibold text-paper hover:bg-gray-800"
        >
          Seguir
        </button>
      </div>
    </div>
  );
}

export function PrimeraMano({
  corpus,
  itemId,
  mano,
  onCerrar,
}: {
  corpus: CorpusId;
  itemId: string;
  mano: number | null;
  onCerrar: () => void;
}) {
  const glosa = describirItem(corpus, itemId).titulo;
  return (
    <Dialogo id="primera-titulo" sobre="Tu primer video" titulo="Ya eres parte del corpus" onCerrar={onCerrar}>
      <div className="mt-5 flex justify-center">
        <CirculoManos manos={mano ?? 1} tuya={mano} size={132} animar />
      </div>
      <p className="mt-4 text-sm text-gray-700">
        {mano ? `Eres la mano ${mano} de ${MANOS_POR_SENA} de ${glosa}.` : `${glosa} ya está en el corpus.`}{" "}
        Cada seña busca nueve personas distintas que la hagan. Cada una que grabes
        te suma a su círculo.
      </p>
    </Dialogo>
  );
}

export function CirculoCerrado({
  corpus,
  itemId,
  onCerrar,
}: {
  corpus: CorpusId;
  itemId: string;
  onCerrar: () => void;
}) {
  const d = describirItem(corpus, itemId);
  return (
    <Dialogo id="circulo-titulo" sobre="Novena mano" titulo={`Cerraste el círculo de ${d.titulo}`} onCerrar={onCerrar}>
      <div className="relative mx-auto mt-5 h-36 w-36">
        <CirculoManos manos={MANOS_POR_SENA} tuya={MANOS_POR_SENA} size={144} animar />
        <span className="absolute inset-0 flex items-center justify-center px-6 font-display text-lg font-bold leading-tight text-ink">
          {d.corto}
        </span>
      </div>
      <p className="mt-4 text-sm text-gray-700">
        Nueve personas distintas ya la hicieron. La seña queda completa en el
        corpus, con los apodos de sus nueve manos en la comunidad.
      </p>
    </Dialogo>
  );
}

export function GrupoCompleto({ grupo, onCerrar }: { grupo: GrupoId; onCerrar: () => void }) {
  const g = GRUPOS_ATLAS.find((x) => x.id === grupo);
  const cms = g ? CM_INVENTORY.filter((cm) => g.cms.includes(cm.cm_id)) : [];
  const lado = cms.length > 16 ? 30 : cms.length > 8 ? 40 : 56;
  return (
    <Dialogo
      id="grupo-titulo"
      sobre={`Atlas de la mano · grupo ${grupo}`}
      titulo={g ? `${g.nombre}, completo` : "Grupo completo"}
      onCerrar={onCerrar}
    >
      <ul className="mt-5 flex flex-wrap justify-center gap-1" aria-label={`${cms.length} configuraciones`}>
        {cms.map((cm, i) => (
          <li
            key={cm.cm_id}
            className="mano-llega rounded-md bg-gray-50"
            style={{ "--i": Math.min(i, 20) } as React.CSSProperties}
            title={`CM #${cm.cm_id} · ${cm.example_sign}`}
          >
            <MiniHand cm={cm} size={lado} />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-gray-700">
        Grabaste las {cms.length} configuraciones de mano con {g?.dedos ? `los dedos ${g.dedos} seleccionados` : "este grupo de dedos"}.
        Están en tu atlas.
      </p>
    </Dialogo>
  );
}

export function SelloGanado({ ruta, onCerrar }: { ruta: number; onCerrar: () => void }) {
  const r = RUTAS.find((x) => x.numero === ruta);
  return (
    <Dialogo id="sello-titulo" sobre="SignaPlay" titulo={`Sello de la ruta ${ruta}`} onCerrar={onCerrar}>
      <div className="mt-5 flex justify-center">
        <SelloRuta numero={ruta} size={140} animar />
      </div>
      <p className="mt-4 text-sm text-gray-700">
        {r ? `«${r.nombre}»: ` : ""}grabaste todas sus señas ({r?.items.length ?? 0}). Son
        las que aprenden niñas y niños en esa ruta de SignaPlay.
      </p>
    </Dialogo>
  );
}
