/**
 * MetaComunidad — la barra de «nuestra meta»: que cada una de las 222
 * señas la graben 9 personas distintas. Se cuenta persona × seña; los
 * videos repetidos de una misma persona no suman.
 */

import { META_SENANTES, TOTAL_SENAS } from "@/lib/listas";

export default function MetaComunidad({
  pct,
  hechas,
  meta,
}: {
  pct: number;
  hechas: number;
  meta: number;
}) {
  return (
    <section
      aria-label="Nuestra meta"
      className="rounded-2xl border border-gray-200 bg-paper p-5 shadow-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="overline-label text-gray-500">Nuestra meta</p>
        <p className="text-sm text-gray-600">
          <strong className="font-display text-2xl text-ink">{pct} %</strong> de la meta
        </p>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-green transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-sm text-gray-600">
        Meta: que cada una de las {TOTAL_SENAS} señas la graben {META_SENANTES} personas
        distintas. Llevamos {hechas.toLocaleString("es-MX")} de {meta.toLocaleString("es-MX")}.
        Los videos repetidos de una misma persona no suman aquí.
      </p>
    </section>
  );
}
