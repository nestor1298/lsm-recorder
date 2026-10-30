"use client";

/**
 * PromptEstudio — la seña que toca: en grande la glosa; abajo, lo que
 * ayuda a hacerla bien (la mano de la CM o la palabra en español y su
 * lección) y cómo va su círculo de nueve manos. Sin barra de progreso:
 * esa va en la cabecera.
 */

import { cmDeItemId, senaSignaPlay, SIGNAPLAY_UNIDADES, type CorpusId } from "@/lib/corpus";
import { circuloDe, MANOS_POR_SENA } from "@/lib/nueve_manos";
import { MiniHand } from "@/components/learn/MiniHand";
import CirculoManos from "@/components/manos/CirculoManos";

const FLEXION_ES: Record<string, string> = {
  EXTENDED: "extendido",
  CURVED: "curvado",
  BENT: "doblado",
  CLOSED: "cerrado",
};

/** Cómo va el círculo de la seña, y dónde entrarías tú. */
export function EstadoCirculo({
  manos,
  eres,
}: {
  /** manos que ya tiene (undefined mientras carga) */
  manos?: number;
  eres: boolean;
}) {
  if (manos === undefined) return <span className="h-10" aria-hidden />;
  const c = circuloDe(manos);
  const texto = eres
    ? "Ya eres una de sus manos: otro video suma variedad."
    : c.completo
      ? "Ya tiene sus nueve manos. La tuya suma variedad."
      : c.manos === 0
        ? "Nadie la ha grabado. La tuya sería la primera mano."
        : `${c.manos} de ${MANOS_POR_SENA} manos. La tuya sería la ${c.manos + 1}${c.faltan === 1 ? " y cerraría el círculo" : ""}.`;
  return (
    <div className="flex items-center gap-3">
      <CirculoManos manos={c.manos} esperando={!eres && !c.completo} size={40} />
      <p className="text-sm text-gray-700">{texto}</p>
    </div>
  );
}

export default function PromptEstudio({
  corpus,
  itemId,
  manos,
  eres = false,
}: {
  corpus: CorpusId;
  itemId: string;
  manos?: number;
  eres?: boolean;
}) {
  const circulo = <EstadoCirculo manos={manos} eres={eres} />;

  if (corpus === "signaplay") {
    const s = senaSignaPlay(itemId);
    const u = s && s.unidad !== null ? SIGNAPLAY_UNIDADES.find((x) => x.numero === s.unidad) : null;
    const l = u?.lecciones.find((x) => x.numero === s?.leccion);
    return (
      <div className="rounded-2xl border border-gold-tint bg-gold-tint p-5">
        <p className="overline-label text-gray-600">Corpus para SignaPlay</p>
        <p className="mt-2 break-words font-display text-4xl font-bold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
          {s?.glosa ?? itemId}
        </p>
        {s && (
          <p className="mt-2 text-lg text-gray-700">
            «{s.espanol}» · {s.categoria}
          </p>
        )}
        {u && l && (
          <p className="mt-1 text-sm text-gray-600">
            {u.nombre} · Lección {l.numero}: {l.titulo}
          </p>
        )}
        <p className="mt-4 text-sm text-gray-700">
          Despacio y completa, con la cara que lleva la seña: las niñas y los niños la van a imitar.
        </p>
        <div className="mt-4 border-t border-gold/40 pt-3">{circulo}</div>
      </div>
    );
  }

  const cm = cmDeItemId(itemId);
  if (!cm) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-paper p-5">
        <p className="overline-label text-gray-500">LSM Corpus</p>
        <p className="mt-2 font-display text-5xl font-bold text-ink">Seña #{itemId}</p>
      </div>
    );
  }
  const dedos = [
    ["índice", cm.index],
    ["medio", cm.middle],
    ["anular", cm.ring],
    ["meñique", cm.pinky],
  ] as const;
  return (
    <div className="rounded-2xl border border-accent-tint bg-accent-tint p-5">
      <p className="overline-label text-gray-600">
        LSM Corpus · CM #{cm.cm_id}
        {cm.alpha_code ? ` · ${cm.alpha_code}` : ""}
      </p>
      <div className="mt-2 flex items-center gap-4">
        <MiniHand cm={cm} size={88} />
        <div className="min-w-0">
          <p className="break-words font-display text-4xl font-bold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
            {cm.example_sign}
          </p>
          <p className="mt-1 font-mono text-sm text-gray-600">{cm.cruz_aldrete_notation}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-700">
        Haz la seña de ejemplo con esta mano:{" "}
        {dedos.map(([n, v], i) => (
          <span key={n}>
            {n} {FLEXION_ES[v] ?? v.toLowerCase()}
            {i < dedos.length - 1 ? ", " : ""}
          </span>
        ))}
        ; pulgar {FLEXION_ES[cm.thumb_flexion] ?? cm.thumb_flexion.toLowerCase()}.
      </p>
      <div className="mt-4 border-t border-accent/20 pt-3">{circulo}</div>
    </div>
  );
}
