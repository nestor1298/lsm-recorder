import Link from "next/link";
import MarcaLSMCorpus from "@/components/marca/MarcaLSMCorpus";
import TarjetaCorpus from "@/components/grabar/TarjetaCorpus";
import SesionPendiente from "@/components/inicio/SesionPendiente";

/**
 * Inicio — explica el camino completo en una pantalla: grabar → anotar →
 * corpus → aprender y jugar. Sin métricas ni tableros: quien llega por
 * primera vez debe entender qué es esto y por dónde empezar.
 */

const PASOS = [
  {
    n: 1,
    titulo: "Graba",
    texto:
      "Eliges un corpus y la cámara te guía seña por seña. Tú decides quién puede ver tus videos y los puedes retirar cuando quieras.",
    href: "/record",
    enlace: "Ir a grabar",
    color: "bg-green text-ink",
    icono: (
      <path d="M4 7h3l2-2h6l2 2h3v11H4z M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
    ),
  },
  {
    n: 2,
    titulo: "Anota",
    texto:
      "La computadora propone la forma de la mano, el lugar, la orientación y el movimiento. Tú corriges lo que haga falta, canal por canal.",
    href: "/annotate",
    enlace: "Ir a anotar",
    color: "bg-accent text-paper",
    icono: (
      <path d="M4 20h4l10-10-4-4L4 16z M13 7l4 4 M4 20v-4" />
    ),
  },
  {
    n: 3,
    titulo: "Corpus",
    texto:
      "Cada seña queda descrita con la notación de Cruz Aldrete: forma, lugar, orientación, movimiento y cara. Lista para investigar y para enseñar.",
    href: "/mis-grabaciones",
    enlace: "Ver mis grabaciones",
    color: "bg-gold text-ink",
    icono: (
      <path d="M4 8h16v12H4z M4 8l2-4h12l2 4 M9 12h6" />
    ),
  },
  {
    n: 4,
    titulo: "Aprende y juega",
    texto:
      "Del corpus salen el modo Aprender, para explorar cómo se forma cada seña, y las lecciones de SignaPlay para niñas y niños.",
    href: "/learn",
    enlace: "Ir a aprender",
    color: "bg-coral text-ink",
    icono: <path d="M6 4l14 8-14 8z" />,
  },
];

const PROMESAS = [
  {
    titulo: "Con tu consentimiento",
    texto: "Antes de grabar, tú dices para qué se puede usar tu video.",
    href: "/consentimiento",
  },
  {
    titulo: "Con tu nivel de acceso",
    texto: "Abierto, solo investigación o restringido: lo eliges por video.",
    href: "/mis-grabaciones",
  },
  {
    titulo: "Y siempre tuyos",
    texto: "Puedes retirar cualquier grabación cuando quieras.",
    href: "/perfil",
  },
];

export default function Inicio() {
  return (
    <div className="space-y-16">
      {/* Portada: la marca y la promesa */}
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <p className="overline-label text-gray-500">SignaLab · OtherAI</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">
            Tu lengua, documentada contigo.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-gray-600">
            Aquí la comunidad sorda graba señas de la Lengua de Señas Mexicana,
            las describe con precisión y construye un corpus que sirve para
            investigar y para enseñar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/record"
              className="rounded-full bg-ink px-7 py-3 font-semibold text-paper transition-colors hover:bg-gray-800"
            >
              Grabar señas
            </Link>
            <a
              href="#como-funciona"
              className="rounded-full border-[1.5px] border-gray-300 px-7 py-3 font-semibold text-ink transition-colors hover:border-ink"
            >
              Ver cómo funciona
            </a>
          </div>
        </div>
        <div className="mx-auto w-56 sm:w-72 lg:w-full lg:max-w-xs">
          <MarcaLSMCorpus className="rounded-2xl shadow-raised" />
        </div>
      </section>

      {/* El camino, en cuatro pasos */}
      <section id="como-funciona" className="space-y-6">
        <div>
          <p className="overline-label text-gray-500">Cómo funciona</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
            De la seña al corpus, en cuatro pasos
          </h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PASOS.map((p) => (
            <li
              key={p.n}
              className="flex flex-col rounded-2xl border border-gray-200 bg-paper p-5 shadow-card"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-bold ${p.color}`}
                >
                  {p.n}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7 text-ink"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {p.icono}
                </svg>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-ink">
                {p.titulo}
              </h3>
              <p className="mt-2 flex-1 text-sm text-gray-600">{p.texto}</p>
              <Link
                href={p.href}
                className="mt-4 text-sm font-semibold text-accent-deep hover:underline"
              >
                {p.enlace} →
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* Los dos corpus (y la sesión a medias, si la hay: aparece al hidratar,
          aquí abajo no desplaza la portada) */}
      <section className="space-y-6">
        <SesionPendiente />
        <div>
          <p className="overline-label text-gray-500">Dos corpus, dos caminos</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
            ¿Qué vas a grabar?
          </h2>
          <p className="mt-2 max-w-2xl text-gray-600">
            El LSM Corpus describe cómo se forman las señas; el corpus para
            SignaPlay junta el vocabulario que verán las niñas y los niños en la
            app. Los dos se graban igual: seña por seña, con la cámara.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TarjetaCorpus corpus="lsm" href="/record?corpus=lsm" accion="Grabar" />
          <TarjetaCorpus
            corpus="signaplay"
            href="/record?corpus=signaplay"
            accion="Grabar"
          />
        </div>
      </section>

      {/* Tus videos son tuyos */}
      <section className="rounded-2xl bg-ink p-8 text-paper sm:p-10">
        <p className="overline-label text-gray-400">Tus videos son tuyos</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          {PROMESAS.map((p) => (
            <Link key={p.titulo} href={p.href} className="group">
              <h3 className="font-display text-xl font-bold group-hover:underline">
                {p.titulo}
              </h3>
              <p className="mt-2 text-sm text-gray-300">{p.texto}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
