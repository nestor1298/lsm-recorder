/**
 * MapaManos — México en mosaico con las manos de cada estado: cuántas
 * manos (persona × seña) llegaron desde ahí. Escalones de color, no
 * degradados; sin ordenar estados ni compararlos en una lista.
 */

import { MAPA_COLS, MAPA_FILAS, MAPA_MX } from "@/lib/mapa_mx";

const ESCALONES = [
  { desde: 0, clase: "bg-gray-100 text-gray-500", etiqueta: "Todavía no" },
  { desde: 1, clase: "bg-green-tint text-green-deep", etiqueta: "1 a 9" },
  { desde: 10, clase: "bg-green text-paper", etiqueta: "10 a 49" },
  { desde: 50, clase: "bg-green-deep text-paper", etiqueta: "50 o más" },
];

function escalon(manos: number) {
  let e = ESCALONES[0];
  for (const x of ESCALONES) if (manos >= x.desde) e = x;
  return e;
}

export default function MapaManos({
  estados,
  tuEstado,
}: {
  estados: { estado: string; manos: number }[];
  tuEstado?: string | null;
}) {
  const manosDe = new Map(estados.map((e) => [e.estado, e.manos]));
  return (
    <div>
      <ul
        className="grid gap-1 sm:gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${MAPA_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${MAPA_FILAS}, minmax(0, 1fr))`,
        }}
        aria-label="Manos por estado"
      >
        {MAPA_MX.map((c, i) => {
          const manos = manosDe.get(c.estado) ?? 0;
          const e = escalon(manos);
          const tuyo = tuEstado === c.estado;
          return (
            <li
              key={c.estado}
              className={`aparece flex aspect-square flex-col items-center justify-center rounded-md text-center leading-none sm:rounded-lg ${e.clase} ${
                tuyo ? "ring-2 ring-ink ring-offset-1" : ""
              }`}
              style={{ gridColumnStart: c.col + 1, gridRowStart: c.fila + 1, animationDelay: `${i * 18}ms` }}
              title={`${c.estado}: ${manos} ${manos === 1 ? "mano" : "manos"}`}
            >
              <span className="text-[8px] font-semibold sm:text-[10px]">{c.abrev}</span>
              <span className="mt-0.5 hidden font-display text-xs font-bold sm:block">{manos || ""}</span>
              <span className="sr-only">
                {c.estado}: {manos} {manos === 1 ? "mano" : "manos"}
                {tuyo ? " (tu estado)" : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <ul className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600" aria-label="Escala">
        {ESCALONES.map((e) => (
          <li key={e.desde} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm ${e.clase}`} aria-hidden />
            {e.etiqueta}
          </li>
        ))}
      </ul>
    </div>
  );
}
