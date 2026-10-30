/**
 * MisSenas — las señas en las que eres una mano: tu lugar en su círculo y
 * cómo va. Las completas primero.
 */

import { describirItem } from "@/lib/corpus";
import { MANOS_POR_SENA } from "@/lib/nueve_manos";
import type { ProgresoResponse } from "@/lib/api-client";
import CirculoManos from "@/components/manos/CirculoManos";

export default function MisSenas({ senas }: { senas: ProgresoResponse["misSenas"] }) {
  if (senas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        Tu primera seña te pone en su círculo.
      </p>
    );
  }
  const orden = [...senas].sort(
    (a, b) => Number(b.completa) - Number(a.completa) || b.manos - a.manos,
  );
  return (
    <ul className="grid content-start gap-2 sm:grid-cols-2">
      {orden.map((s) => {
        const d = describirItem(s.corpus, s.itemId);
        return (
          <li
            key={`${s.corpus}:${s.itemId}`}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-paper p-3"
          >
            <CirculoManos manos={s.manos} tuya={s.mano} size={44} />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{d.titulo}</span>
              <span className="block text-xs text-gray-600">
                {s.mano ? `Mano ${s.mano}` : "Tu mano"} ·{" "}
                {s.completa ? "círculo completo" : `${s.manos} de ${MANOS_POR_SENA}`}
                {s.veces > 1 ? ` · ${s.veces} videos` : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
