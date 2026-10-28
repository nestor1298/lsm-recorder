import Link from "next/link";
import { CONTACTO_SIGNALAB } from "@/lib/acuerdo";

/**
 * /preguntas — las dudas antes de empezar, en el orden en que llegan.
 */

const PREGUNTAS: { q: string; a: React.ReactNode }[] = [
  {
    q: "¿Quién está detrás?",
    a: (
      <>
        SignaLab es de OtherAI y se construye con la comunidad sorda de México.
        Documenta la Lengua de Señas Mexicana seña por seña: cómo se forma cada
        una, con la notación de Cruz Aldrete. De ahí salen el modo Aprender, las
        lecciones de SignaPlay y modelos que reconocen señas.
      </>
    ),
  },
  {
    q: "¿Por qué señar aquí?",
    a: (
      <>
        Porque casi no hay corpus de la LSM. Cada video tuyo describe una seña
        para investigar y para enseñar, y entrena tecnología que entienda las
        señas en vez de pedirle a las personas sordas que escriban.
      </>
    ),
  },
  {
    q: "¿Es gratis?",
    a: (
      <>
        Sí. No hay pago ni datos bancarios. Lo que hay es un juego: cada video
        sube un nivel, un cofre de señas cada 10 videos, medallas en los
        niveles 30, 50, 70 y 100, tu tarjeta de señante y el tablero de la
        semana.
      </>
    ),
  },
  {
    q: "¿Qué grabo?",
    a: (
      <>
        Una seña por video, de 3 a 7 segundos. Eliges una lista: del LSM Corpus
        (una seña de ejemplo por configuración de mano) o del corpus para
        SignaPlay (el vocabulario que verán niñas y niños en la app).
      </>
    ),
  },
  {
    q: "¿Cómo seño?",
    a: (
      <>
        Como señas de verdad: tus señas, tu ritmo, tu cara. De frente, de la
        cabeza a la cintura, con las manos y los codos siempre dentro del
        cuadro. Fondo liso y nadie más en la toma, luz en la cara (nunca una
        ventana atrás), ropa lisa, y las manos en reposo al empezar y al
        terminar cada video.
      </>
    ),
  },
  {
    q: "¿Qué necesito?",
    a: (
      <>
        Un teléfono o una computadora con cámara y Chrome o Safari. Buena luz
        en la cara y en las manos, y un fondo liso. Aléjate un poco para que
        las manos y los codos queden dentro.
      </>
    ),
  },
  {
    q: "¿Hay un mínimo?",
    a: <>No. Graba lo que quieras y para cuando quieras. La lista te espera.</>,
  },
  {
    q: "¿Quién ve mis videos?",
    a: (
      <>
        Tú decides, video por video, con el nivel de acceso: abierto (cualquier
        persona), investigación (solo personas investigadoras registradas) o
        restringido (solo el equipo de anotación). Tu rostro no se borra porque
        es parte de la seña; por eso el nivel de acceso lo eliges tú. Lo cambias
        o retiras cualquier video desde{" "}
        <Link href="/mis-grabaciones" className="font-semibold text-ink underline-offset-4 hover:underline">
          Mis grabaciones
        </Link>
        .
      </>
    ),
  },
  {
    q: "¿Y si me equivoco?",
    a: (
      <>
        Antes de guardar, rehaz el video (botón «Rehacer» o la tecla R). Si
        necesitas parar, «Descanso» (tecla B). Cualquier seña se puede volver a
        grabar después desde la lista. Si un video no corresponde a la seña o
        no se ve bien, el equipo puede rechazarlo: solo vuelves a grabarlo.
      </>
    ),
  },
  {
    q: "¿Puedo dejarlo?",
    a: <>Cuando quieras, sin avisar. Y puedes retirar todo tu consentimiento desde Mis grabaciones.</>,
  },
  {
    q: "Cambié de teléfono o de computadora.",
    a: (
      <>
        Entra con el mismo correo: te mandamos un código y todo regresa (nivel,
        señas, apodo). Sin contraseñas.
      </>
    ),
  },
  {
    q: "¿Dónde veo las configuraciones de mano?",
    a: (
      <>
        En el{" "}
        <Link href="/inventario" className="font-semibold text-ink underline-offset-4 hover:underline">
          inventario
        </Link>{" "}
        están las 101, por familia y por frecuencia, y en{" "}
        <Link href="/learn" className="font-semibold text-ink underline-offset-4 hover:underline">
          Aprender
        </Link>{" "}
        el avatar las ejecuta.
      </>
    ),
  },
  {
    q: "¿Otra pregunta?",
    a: (
      <>
        Escríbenos a{" "}
        <a href={`mailto:${CONTACTO_SIGNALAB}`} className="font-semibold text-ink underline-offset-4 hover:underline">
          {CONTACTO_SIGNALAB}
        </a>
        . El acuerdo completo está en{" "}
        <Link href="/acuerdo" className="font-semibold text-ink underline-offset-4 hover:underline">
          /acuerdo
        </Link>
        .
      </>
    ),
  },
];

export default function PreguntasPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="overline-label text-gray-500">Antes de empezar</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
          Preguntas
        </h1>
      </div>
      <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-paper px-5 shadow-card">
        {PREGUNTAS.map((p) => (
          <details key={p.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
              {p.q}
              <span
                aria-hidden
                className="text-gray-400 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-gray-700">{p.a}</p>
          </details>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/unirse"
          className="rounded-full bg-ink px-7 py-3 font-semibold text-paper transition-colors hover:bg-gray-800"
        >
          Empezar a señar
        </Link>
        <Link
          href="/"
          className="rounded-full border-[1.5px] border-gray-300 px-7 py-3 font-semibold text-ink transition-colors hover:border-ink"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
