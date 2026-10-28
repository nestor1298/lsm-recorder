import Link from "next/link";
import {
  ACUERDO_FECHA,
  ACUERDO_RESUMEN,
  ACUERDO_SECCIONES,
  ACUERDO_VERSION,
} from "@/lib/acuerdo";

/** /acuerdo — el acuerdo de participación completo, para leerlo con calma. */
export default function AcuerdoPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="overline-label text-gray-500">
          Versión {ACUERDO_VERSION} · {ACUERDO_FECHA}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
          Acuerdo de participación en SignaLab
        </h1>
        <p className="mt-2 text-gray-600">
          En una página y en lenguaje llano. Es lo que firmas al unirte, con tu
          nombre escrito o con un video en LSM.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {ACUERDO_RESUMEN.map((r) => (
          <li key={r} className="rounded-lg border border-gray-200 bg-paper px-3 py-2 text-sm text-gray-700">
            {r}
          </li>
        ))}
      </ul>
      <div className="space-y-6 text-gray-700">
        {ACUERDO_SECCIONES.map((s) => (
          <section key={s.titulo}>
            <h2 className="font-display text-xl font-bold text-ink">{s.titulo}</h2>
            {s.parrafos.map((p) => (
              <p key={p} className="mt-2">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-6">
        <Link
          href="/unirse"
          className="rounded-full bg-ink px-7 py-3 font-semibold text-paper transition-colors hover:bg-gray-800"
        >
          Unirme
        </Link>
        <Link
          href="/preguntas"
          className="rounded-full border-[1.5px] border-gray-300 px-7 py-3 font-semibold text-ink transition-colors hover:border-ink"
        >
          Preguntas
        </Link>
      </div>
    </article>
  );
}
