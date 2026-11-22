import type { Metadata } from "next";
import Link from "next/link";
import ExplorarCorpus from "@/components/corpus/ExplorarCorpus";
import { CONTACTO_SIGNALAB } from "@/lib/acuerdo";
import { corpusPagina } from "@/lib/corpus/catalog";

export const metadata: Metadata = {
  title: "Corpus VOCES EN SEÑAS · SignaLab",
  description:
    "Oraciones en LSM del programa VOCES EN SEÑAS de Jalisco TV: la oración escrita, quién la seña (con seudónimo), sus señas con la fonología y la transliteración en glosas.",
};

const mil = (n: number) => n.toLocaleString("es-MX");

function Cifra({ k, v, nota }: { k: string; v: string; nota?: string }) {
  return (
    <div className="min-w-0 bg-paper p-5">
      <p className="overline-label text-gray-400">{k}</p>
      <p className="mt-2 font-display text-4xl font-bold tracking-[-0.03em] text-ink tabular-nums sm:text-5xl">{v}</p>
      {nota && <p className="mt-1 text-[13px] text-gray-500">{nota}</p>}
    </div>
  );
}

/** Estática: se calcula al construir; el detalle de las señas llega de public/corpus/e/ */
export default function CorpusPage() {
  const c = corpusPagina();
  const s = c.stats;
  const horas = Math.floor(c.duracion_s / 3600);
  const minutos = Math.round((c.duracion_s % 3600) / 60);
  const conSeudonimo = c.personas.filter((p) => p.c).length;
  const interpretados = c.filas.filter((f) => f.d === "interpretada").length;

  return (
    <article className="space-y-10 sm:space-y-12">
      <header className="max-w-4xl">
        <p className="overline-label flex flex-wrap gap-x-2 text-gray-400">
          <span className="text-accent-deep">LSM</span>
          <span>Corpus de oraciones</span>
          <span>Versión 1.0</span>
        </p>
        <h1 className="mt-2 font-display text-5xl font-bold leading-[0.95] tracking-[-0.035em] text-ink sm:text-6xl lg:text-7xl">
          VOCES EN SEÑAS
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
          Oraciones en Lengua de Señas Mexicana de las entrevistas del programa{" "}
          <a href={c.programa.lista} className="underline hover:text-accent-deep" target="_blank" rel="noreferrer">
            {c.programa.nombre}
          </a>{" "}
          de {c.programa.canal.replace(/\s*\(.*\)$/, "")}, con personas Sordas, intérpretes y conductoras. Cada enunciado une la
          oración escrita, quién la seña, sus señas con su descripción fonológica y una transliteración en glosas.
        </p>
        <p className="mt-3 max-w-2xl rounded-lg bg-gold-tint px-3 py-2 text-sm text-gold-deep">
          Todo es automático y aproximado. El subtítulo es el español del programa: traduce la seña cuando la persona seña sus
          propias palabras, pero cuando seña un intérprete ({mil(interpretados)} enunciados) puede ser el original que se
          interpretó. El corte en señas sale de las pausas de la mano y la glosa es la seña del{" "}
          <Link href="/lexico" className="underline">
            léxico
          </Link>{" "}
          que más se parece. Falta que lo revise una persona Sorda.
        </p>
      </header>

      <section aria-label="Cifras clave" className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 lg:grid-cols-4">
        <Cifra k="Episodios" v={mil(s.episodios)} nota={`${horas} h ${minutos} min de programa`} />
        <Cifra k="Enunciados" v={mil(s.enunciados)} nota={`de ${mil(s.oraciones)} oraciones del subtítulo`} />
        <Cifra k="Señas" v={mil(s.senas)} nota={`${mil(s.con_glosa)} con glosa del léxico`} />
        <Cifra k="Personas" v={mil(c.personas.length)} nota={`con seudónimo; ${mil(conSeudonimo)} señan en el corpus`} />
      </section>

      <ExplorarCorpus filas={c.filas} personas={c.personas} episodios={c.episodios} />

      <section aria-labelledby="t-privacidad" className="border-t border-gray-200 pt-8">
        <div className="grid gap-2 lg:grid-cols-[16rem_1fr] lg:gap-10">
          <h2 id="t-privacidad" className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            Privacidad y derechos
          </h2>
          <ul className="max-w-2xl list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-gray-600">
            <li>
              El programa tiene todos los derechos reservados. Aquí solo hay anotaciones derivadas: ni videos, ni cuadros, ni
              esqueletos.
            </li>
            <li>
              Los seudónimos se asignaron por parecido de cara en un equipo local; no se guardan rostros, vectores de cara ni
              nombres, y los títulos de los episodios (que traen nombres) no se copian.
            </li>
            <li>
              Los nombres de persona que aparecen en los subtítulos se cambian por <span className="font-mono text-[13px]">[NOMBRE]</span>{" "}
              ({mil(s.nombres_tapados)} en total).
            </li>
            <li>No se infieren rasgos físicos ni demográficos.</li>
            <li>
              Si sales en el programa y prefieres no estar en el corpus, escribe a{" "}
              <a href={`mailto:${CONTACTO_SIGNALAB}`} className="font-medium text-ink underline underline-offset-2 hover:text-accent-deep">
                {CONTACTO_SIGNALAB}
              </a>{" "}
              y dinos en qué episodio apareces: quitamos tus enunciados y tu seudónimo en la siguiente versión.
            </li>
          </ul>
        </div>
      </section>
    </article>
  );
}
