"use client";

/**
 * /comunidad — las nueve manos entre todas las personas: cuántas señas ya
 * están completas, a cuáles les falta poco (con un botón para grabarlas),
 * los círculos que se cerraron en la semana con los apodos de sus nueve
 * manos y el mapa de manos por estado. Cooperativo: sin posiciones.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { guardarVolverA } from "@/lib/volver_a";
import { fetchComunidad, fetchMe, type ComunidadResponse } from "@/lib/api-client";
import { describirItem, type CorpusId } from "@/lib/corpus";
import { inicioDeSemana, rangoDeSemana, semanaIso } from "@/lib/semana";
import { MANOS_POR_SENA } from "@/lib/nueve_manos";
import CirculoManos from "@/components/manos/CirculoManos";
import MapaManos from "@/components/manos/MapaManos";
import MetaComunidad from "@/components/listas/MetaComunidad";

function semanaAnterior(semana: string): string | null {
  const lunes = inicioDeSemana(semana);
  if (!lunes) return null;
  lunes.setUTCDate(lunes.getUTCDate() - 7);
  return semanaIso(lunes);
}

function rutaEstudio(corpus: CorpusId, items: string[]): string {
  return `/estudio?corpus=${corpus}&items=${items.map(encodeURIComponent).join(",")}`;
}

export default function ComunidadPage() {
  const router = useRouter();
  const { state } = useAuth();
  const actual = semanaIso(new Date());
  const [semana, setSemana] = useState(actual);
  const [datos, setDatos] = useState<ComunidadResponse | null>(null);
  const [tuEstado, setTuEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state === "signedOut") {
      guardarVolverA("/comunidad");
      router.replace("/unirse");
    }
  }, [state, router]);

  useEffect(() => {
    if (state !== "signedIn") return;
    let activo = true;
    fetchComunidad(semana === actual ? undefined : semana)
      .then((d) => {
        if (activo) {
          setDatos(d);
          setError(null);
        }
      })
      .catch((err) => {
        if (activo) setError(err instanceof Error ? err.message : "No se pudo cargar la comunidad.");
      });
    return () => {
      activo = false;
    };
  }, [state, semana, actual]);

  useEffect(() => {
    if (state !== "signedIn") return;
    fetchMe()
      .then((m) => setTuEstado(m.estado ?? null))
      .catch(() => {});
  }, [state]);

  if (state !== "signedIn") {
    return <p className="py-12 text-center text-gray-500">Verificando acceso...</p>;
  }

  const anterior = semanaAnterior(semana);
  const casiLsm = datos?.casi.filter((s) => s.corpus === "lsm").map((s) => s.itemId) ?? [];
  const casiSp = datos?.casi.filter((s) => s.corpus === "signaplay").map((s) => s.itemId) ?? [];

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="overline-label text-gray-500">La comunidad</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
            Nueve manos por seña
          </h1>
          <p className="mt-3 text-gray-600">
            Cada seña busca nueve personas distintas que la hagan, de distintos
            lugares y con distintas historias. Cuando llega la novena, el círculo
            se cierra y la seña queda completa.
          </p>
        </div>
        {datos && (
          <div className="flex items-center gap-4">
            <CirculoManos manos={MANOS_POR_SENA} size={64} animar />
            <p className="text-gray-600">
              <strong className="block font-display text-4xl text-ink">
                {datos.completas}
                <span className="text-xl text-gray-400"> / {datos.total}</span>
              </strong>
              señas completas
            </p>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-coral-tint px-4 py-3 text-sm text-coral-deep">{error}</p>}
      {!datos && !error && <p className="text-sm text-gray-500">Cargando...</p>}

      {datos && (
        <>
          <MetaComunidad {...datos.meta} />

          <section aria-labelledby="casi-titulo" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="casi-titulo" className="font-display text-2xl font-bold text-ink">
                  Les falta poco
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Señas a una, dos o tres manos de cerrarse. No salen las que tú ya grabaste.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {casiLsm.length > 0 && (
                  <Link
                    href={rutaEstudio("lsm", casiLsm)}
                    className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-gray-800"
                  >
                    Grabar las del LSM Corpus ({casiLsm.length})
                  </Link>
                )}
                {casiSp.length > 0 && (
                  <Link
                    href={rutaEstudio("signaplay", casiSp)}
                    className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-gray-800"
                  >
                    Grabar las de SignaPlay ({casiSp.length})
                  </Link>
                )}
              </div>
            </div>
            {datos.casi.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Ninguna seña está a punto de cerrarse. Elige una lista y empieza un círculo.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {datos.casi.map((s) => {
                  const d = describirItem(s.corpus, s.itemId);
                  return (
                    <li key={`${s.corpus}:${s.itemId}`}>
                      <Link
                        href={rutaEstudio(s.corpus, [s.itemId])}
                        className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-paper p-4 shadow-card transition-colors hover:border-ink"
                      >
                        <CirculoManos manos={s.manos} esperando size={56} />
                        <span className="min-w-0">
                          <span className="block truncate font-display text-lg font-bold text-ink">{d.titulo}</span>
                          <span className="block text-sm text-gray-600">
                            {s.manos} de {MANOS_POR_SENA} ·{" "}
                            {s.faltan === 1 ? "a una mano" : `faltan ${s.faltan}`}
                          </span>
                          <span className="mt-1 block text-sm font-semibold text-accent-deep">
                            {s.faltan === 1 ? "Ciérralo tú →" : "Grabarla →"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="semana-titulo" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="semana-titulo" className="font-display text-2xl font-bold text-ink">
                  {semana === actual ? "Esta semana" : "Esa semana"}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {rangoDeSemana(semana)}: llegaron{" "}
                  <strong className="text-ink">{datos.deLaSemana.manos}</strong>{" "}
                  {datos.deLaSemana.manos === 1 ? "mano nueva" : "manos nuevas"} y se{" "}
                  {datos.deLaSemana.completas === 1 ? "cerró" : "cerraron"}{" "}
                  <strong className="text-ink">{datos.deLaSemana.completas}</strong>{" "}
                  {datos.deLaSemana.completas === 1 ? "círculo" : "círculos"}.
                </p>
              </div>
              <div className="flex gap-2">
                {anterior && (
                  <button
                    type="button"
                    onClick={() => setSemana(anterior)}
                    className="rounded-full border-[1.5px] border-gray-300 px-4 py-2 text-sm font-medium text-ink hover:border-ink"
                  >
                    ‹ Semana anterior
                  </button>
                )}
                {semana !== actual && (
                  <button
                    type="button"
                    onClick={() => setSemana(actual)}
                    className="rounded-full border-[1.5px] border-gray-300 px-4 py-2 text-sm font-medium text-ink hover:border-ink"
                  >
                    Esta semana
                  </button>
                )}
              </div>
            </div>
            {datos.deLaSemana.circulos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Ningún círculo cerrado {semana === actual ? "todavía esta semana" : "esa semana"}.
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {datos.deLaSemana.circulos.map((c) => {
                  const d = describirItem(c.corpus, c.itemId);
                  return (
                    <li
                      key={`${c.corpus}:${c.itemId}`}
                      className="flex gap-4 rounded-2xl border border-gray-200 bg-paper p-4 shadow-card"
                    >
                      <CirculoManos manos={MANOS_POR_SENA} size={56} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-lg font-bold text-ink">{d.titulo}</span>
                          {c.estuviste && (
                            <span className="rounded-full bg-green-tint px-2 py-0.5 text-xs font-semibold text-green-deep">
                              Tu mano está aquí
                            </span>
                          )}
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-1" aria-label={`Las manos de ${d.titulo}`}>
                          {c.apodos.map((a, i) => (
                            <li key={`${a}-${i}`} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="mapa-titulo" className="space-y-4">
            <div>
              <h2 id="mapa-titulo" className="font-display text-2xl font-bold text-ink">
                Manos por estado
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-600">
                La LSM cambia de un lugar a otro, así que el corpus necesita manos de todo
                el país. Cuenta cada seña de cada persona según el estado que puso al
                unirse; nunca se muestra quién.
              </p>
            </div>
            <div className="max-w-3xl rounded-2xl border border-gray-200 bg-paper p-4 shadow-card sm:p-6">
              <MapaManos estados={datos.estados} tuEstado={tuEstado} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
