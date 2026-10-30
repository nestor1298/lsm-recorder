"use client";

/**
 * AtlasMano — las 101 configuraciones de mano del LSM Corpus, por los cinco
 * grupos de dedos seleccionados de Cruz Aldrete. Las que ya grabaste se ven
 * con su mano; las demás son un lugar por llenar (con enlace para grabarla).
 */

import Link from "next/link";
import { CM_INVENTORY } from "@/lib/data";
import { GRUPOS_ATLAS } from "@/lib/nueve_manos";
import type { ProgresoResponse } from "@/lib/api-client";
import { MiniHand } from "@/components/learn/MiniHand";

export default function AtlasMano({ atlas }: { atlas: ProgresoResponse["atlas"] }) {
  const tuyasDe = new Map(atlas.grupos.map((g) => [g.id, new Set(g.tuyas)]));
  return (
    <div className="space-y-6">
      {GRUPOS_ATLAS.map((g) => {
        const tuyas = tuyasDe.get(g.id) ?? new Set<number>();
        const completo = atlas.grupos.find((x) => x.id === g.id)?.completo ?? false;
        const cms = CM_INVENTORY.filter((cm) => g.cms.includes(cm.cm_id));
        return (
          <section key={g.id} aria-label={`Grupo ${g.id}: ${g.nombre}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-display text-lg font-bold text-ink">
                <span className="text-gray-400">{g.id}</span> {g.nombre}
              </h3>
              {g.dedos && <span className="font-mono text-xs text-gray-500">dedos {g.dedos}</span>}
              <span className="text-sm text-gray-600">
                {tuyas.size} de {cms.length}
              </span>
              {completo && (
                <span className="rounded-full bg-green-tint px-2 py-0.5 text-xs font-semibold text-green-deep">
                  Completo
                </span>
              )}
            </div>
            <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5">
              {cms.map((cm) => {
                const tuya = tuyas.has(cm.cm_id);
                return (
                  <li key={cm.cm_id}>
                    {tuya ? (
                      <span
                        className="flex aspect-square items-center justify-center rounded-lg border border-gray-200 bg-paper"
                        title={`CM #${cm.cm_id} · ${cm.example_sign}`}
                      >
                        <MiniHand cm={cm} size={44} />
                      </span>
                    ) : (
                      <Link
                        href={`/estudio?corpus=lsm&items=${cm.cm_id}`}
                        className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-gray-300 font-mono text-xs text-gray-400 hover:border-ink hover:text-ink"
                        title={`CM #${cm.cm_id} · ${cm.example_sign}: grabarla`}
                        aria-label={`Grabar la configuración ${cm.cm_id}, ${cm.example_sign}`}
                      >
                        {cm.cm_id}
                      </Link>
                    )}
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
