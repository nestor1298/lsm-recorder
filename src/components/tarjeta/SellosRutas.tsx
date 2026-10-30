/**
 * SellosRutas — las 11 rutas de SignaPlay como sellos: sellada cuando
 * grabaste todas sus señas; si no, cuántas llevas.
 */

import Link from "next/link";
import type { ProgresoResponse } from "@/lib/api-client";
import SelloRuta from "@/components/manos/SelloRuta";

export default function SellosRutas({ rutas }: { rutas: ProgresoResponse["rutas"] }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {rutas.map((r) => (
        <li key={r.numero}>
          <Link
            href={`/listas#sp-u${r.numero}`}
            className="flex flex-col items-center rounded-2xl p-2 text-center hover:bg-gray-50"
            title={`Ruta ${r.numero} · ${r.nombre}: ${r.tuyas} de ${r.total}`}
          >
            <SelloRuta numero={r.numero} sellada={r.sellada} size={68} />
            <span className="mt-1 line-clamp-2 text-xs font-semibold text-ink">{r.nombre}</span>
            <span className="text-xs text-gray-500">
              {r.sellada ? "Sellada" : `${r.tuyas} de ${r.total}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
