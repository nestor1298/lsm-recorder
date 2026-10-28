"use client";

/**
 * Coleccion — las señas que ya grabaste, con su rareza: la mano de la CM
 * en el LSM Corpus, la glosa en SignaPlay. De la más rara a la más común.
 */

import { cmDeItemId, describirItem } from "@/lib/corpus";
import { RAREZA_INFO, RAREZAS, type Rareza } from "@/lib/progresion";
import type { ProgresoResponse } from "@/lib/api-client";
import { MiniHand } from "@/components/learn/MiniHand";

export default function Coleccion({ senas }: { senas: ProgresoResponse["coleccion"] }) {
  if (senas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        Tu colección empieza con el primer video.
      </p>
    );
  }
  const porRareza = new Map<Rareza, typeof senas>();
  for (const s of senas) porRareza.set(s.rareza, [...(porRareza.get(s.rareza) ?? []), s]);
  return (
    <div className="space-y-6">
      {[...RAREZAS].reverse().map((r) => {
        const grupo = porRareza.get(r);
        if (!grupo?.length) return null;
        const info = RAREZA_INFO[r];
        return (
          <section key={r} aria-label={`Señas ${info.nombre.toLowerCase()}s`}>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.clase}`}>
                {info.nombre}
              </span>
              <span className="text-xs text-gray-500">{grupo.length}</span>
            </div>
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {grupo.map((s) => {
                const cm = s.corpus === "lsm" ? cmDeItemId(s.itemId) : undefined;
                const d = describirItem(s.corpus, s.itemId);
                return (
                  <li
                    key={`${s.corpus}:${s.itemId}`}
                    className="flex flex-col items-center rounded-xl border border-gray-200 bg-paper p-2 text-center"
                    title={`${d.titulo} · ${d.detalle}${s.veces > 1 ? ` · ${s.veces} videos` : ""}`}
                  >
                    {cm ? (
                      <MiniHand cm={cm} size={56} />
                    ) : (
                      <span className="flex h-14 items-center font-display text-sm font-bold text-ink">
                        {d.titulo}
                      </span>
                    )}
                    <span className="mt-1 w-full truncate text-xs text-gray-600">{cm ? d.titulo : d.detalle.split(" · ")[0]}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
