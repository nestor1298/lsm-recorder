"use client";

/**
 * PromptSignaPlay — la seña que toca grabar para el corpus de SignaPlay:
 * la glosa en grande, la palabra en español, su ruta y lección, y cómo
 * grabarla para que la vean niñas y niños de 4 y 5 años.
 */

import {
  senaSignaPlay,
  SIGNAPLAY_UNIDADES,
  type SenaSignaPlay,
} from "@/lib/corpus";

const CONSEJOS = [
  "De frente, con la cara y las dos manos dentro del cuadro.",
  "Despacio y completa: las niñas y los niños la van a imitar.",
  "Con la expresión de la cara que lleva la seña.",
];

function leccionDe(s: SenaSignaPlay) {
  if (s.unidad === null) return null;
  const u = SIGNAPLAY_UNIDADES.find((x) => x.numero === s.unidad);
  const l = u?.lecciones.find((x) => x.numero === s.leccion);
  return u && l ? { unidad: u, leccion: l } : null;
}

export default function PromptSignaPlay({
  itemId,
  index,
  total,
}: {
  itemId: string;
  index: number;
  total: number;
}) {
  const s = senaSignaPlay(itemId);
  const ctx = s ? leccionDe(s) : null;
  return (
    <div className="rounded-xl border border-gold-tint bg-gold-tint p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Seña {index + 1} de {total}
        </span>
        <div className="mx-4 h-2 flex-1 overflow-hidden rounded-full bg-paper">
          <div
            className="h-full rounded-full bg-ink transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="text-center">
        <h2 className="font-display text-5xl font-bold tracking-[-0.02em] text-ink">
          {s?.glosa ?? itemId}
        </h2>
        {s && (
          <p className="mt-2 text-lg text-gray-700">
            «{s.espanol}» · {s.categoria}
          </p>
        )}
        {ctx && (
          <p className="mt-1 text-sm text-gray-500">
            {ctx.unidad.nombre} · Lección {ctx.leccion.numero}: {ctx.leccion.titulo}
          </p>
        )}
      </div>

      <ul className="mt-6 grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
        {CONSEJOS.map((c) => (
          <li key={c} className="rounded-lg bg-paper px-3 py-2">
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
