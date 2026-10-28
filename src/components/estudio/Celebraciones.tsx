"use client";

/**
 * Celebraciones — lo que pasa al confirmar un video: un aviso breve de
 * nivel, el cofre cada 10 videos (con la seña más rara de esa decena) y
 * la medalla cuando se cruza un umbral. Cada una se cierra con un botón o
 * con Enter/Esc; nunca bloquean la grabación más de un gesto.
 */

import { useEffect } from "react";
import { cmDeItemId, describirItem, type CorpusId } from "@/lib/corpus";
import { MEDALLAS, RAREZA_INFO, type Medalla, type Rareza } from "@/lib/progresion";
import { MiniHand } from "@/components/learn/MiniHand";
import { useFocoInicial } from "@/hooks/useFocoInicial";

export type Celebracion =
  | { tipo: "nivel"; nivel: number }
  | { tipo: "cofre"; corpus: CorpusId; itemId: string; rareza: Rareza; nivel: number }
  | { tipo: "medalla"; medalla: Medalla };

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

export function AvisoNivel({ nivel }: { nivel: number }) {
  return (
    <div
      role="status"
      className="sube-aviso pointer-events-none absolute bottom-4 left-4 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper shadow-raised"
    >
      Nivel {nivel}
    </div>
  );
}

export function Cofre({
  corpus,
  itemId,
  rareza,
  nivel,
  onCerrar,
}: {
  corpus: CorpusId;
  itemId: string;
  rareza: Rareza;
  nivel: number;
  onCerrar: () => void;
}) {
  useCerrarConTeclado(onCerrar);
  const foco = useFocoInicial<HTMLButtonElement>();
  const info = RAREZA_INFO[rareza];
  const cm = corpus === "lsm" ? cmDeItemId(itemId) : undefined;
  const d = describirItem(corpus, itemId);
  return (
    <div className="velo fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cofre-titulo"
        className="cofre-abre w-full max-w-sm rounded-2xl bg-paper p-6 text-center shadow-overlay"
      >
        <p className="overline-label text-gray-500">Cofre · nivel {nivel}</p>
        <h2 id="cofre-titulo" className="mt-1 font-display text-2xl font-bold text-ink">
          Una seña para tu colección
        </h2>
        <div className="mx-auto mt-5 flex h-36 w-36 items-center justify-center rounded-2xl bg-gray-50">
          {cm ? (
            <MiniHand cm={cm} size={120} />
          ) : (
            <span className="px-2 font-display text-3xl font-bold text-ink">{d.titulo}</span>
          )}
        </div>
        <p className="mt-4 font-display text-xl font-bold text-ink">{d.titulo}</p>
        <p className="text-sm text-gray-600">{d.detalle}</p>
        <span className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${info.clase}`}>
          {info.nombre}
        </span>
        <p className="mt-4 text-sm text-gray-600">
          La más rara de tus últimos diez videos. Está en tu tarjeta de señante.
        </p>
        <button
          ref={foco}
          type="button"
          onClick={onCerrar}
          className="mt-5 w-full rounded-full bg-ink py-3 font-semibold text-paper hover:bg-gray-800"
        >
          Seguir
        </button>
      </div>
    </div>
  );
}

export function MedallaGanada({ medalla, onCerrar }: { medalla: Medalla; onCerrar: () => void }) {
  useCerrarConTeclado(onCerrar);
  const foco = useFocoInicial<HTMLButtonElement>();
  const siguiente = MEDALLAS.find((m) => m.nivel > medalla.nivel);
  return (
    <div className="velo fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="medalla-titulo"
        className="cofre-abre w-full max-w-sm rounded-2xl bg-paper p-6 text-center shadow-overlay"
      >
        <p className="overline-label text-gray-500">Nivel {medalla.nivel}</p>
        <div
          className={`mx-auto mt-4 flex h-28 w-28 items-center justify-center rounded-full font-display text-3xl font-bold ${medalla.clase}`}
          aria-hidden
        >
          {medalla.nivel}
        </div>
        <h2 id="medalla-titulo" className="mt-4 font-display text-2xl font-bold text-ink">
          Medalla de {medalla.nombre.toLowerCase()}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {siguiente
            ? `La siguiente, ${siguiente.nombre.toLowerCase()}, al nivel ${siguiente.nivel}.`
            : "La última medalla. Gracias por tanto."}
        </p>
        <button
          ref={foco}
          type="button"
          onClick={onCerrar}
          className="mt-5 w-full rounded-full bg-ink py-3 font-semibold text-paper hover:bg-gray-800"
        >
          Seguir
        </button>
      </div>
    </div>
  );
}
