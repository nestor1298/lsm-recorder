"use client";

/**
 * /tarjeta — tu parte de las nueve manos: la tarjeta para compartir, las
 * señas en las que eres una mano, tu atlas de la mano (LSM Corpus) y tus
 * sellos de ruta (SignaPlay). Desde aquí se cambia el apodo y se descarga
 * la tarjeta.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchProgreso, type ProgresoResponse } from "@/lib/api-client";
import { guardarVolverA } from "@/lib/volver_a";
import TarjetaSenante, { type DatosTarjeta } from "@/components/tarjeta/TarjetaSenante";
import AtlasMano from "@/components/tarjeta/AtlasMano";
import SellosRutas from "@/components/tarjeta/SellosRutas";
import MisSenas from "@/components/tarjeta/MisSenas";
import PasoApodo from "@/components/unirse/PasoApodo";
import { signOut } from "@/lib/auth-client";

export default function TarjetaPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [progreso, setProgreso] = useState<ProgresoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editandoApodo, setEditandoApodo] = useState(false);

  useEffect(() => {
    if (state === "signedOut") {
      guardarVolverA("/tarjeta");
      router.replace("/unirse");
    }
  }, [state, router]);

  const cargar = useCallback(async () => {
    try {
      setProgreso(await fetchProgreso());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar tu progreso.");
    }
  }, []);

  useEffect(() => {
    if (state === "signedIn") void cargar();
  }, [state, cargar]);

  const datos = useMemo<DatosTarjeta | null>(() => {
    if (!progreso) return null;
    return {
      apodo: progreso.apodo ?? "Sin apodo",
      videos: progreso.videos,
      senas: progreso.senas,
      completas: progreso.completas,
      atlas: { tuyas: progreso.atlas.tuyas, total: progreso.atlas.total },
      sellos: { tuyos: progreso.sellos, total: progreso.rutas.length },
    };
  }, [progreso]);

  if (state !== "signedIn") {
    return <p className="py-12 text-center text-gray-500">Verificando acceso...</p>;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="overline-label text-gray-500">Tu tarjeta de señante</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
            {progreso?.apodo ?? "Tu progreso"}
          </h1>
          {progreso && (
            <p className="mt-2 text-gray-600">
              Mano de {progreso.senas} {progreso.senas === 1 ? "seña" : "señas"} ·{" "}
              {progreso.completas} {progreso.completas === 1 ? "ya completa" : "ya completas"}
              {progreso.cerraste > 0
                ? ` · ${progreso.cerraste === 1 ? "cerraste 1 círculo" : `cerraste ${progreso.cerraste} círculos`}`
                : ""}{" "}
              · {progreso.videosSemana} {progreso.videosSemana === 1 ? "video" : "videos"} esta semana.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/listas"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-gray-800"
          >
            Señar
          </Link>
          <Link
            href="/comunidad"
            className="rounded-full border-[1.5px] border-gray-300 px-5 py-2.5 text-sm font-semibold text-ink hover:border-ink"
          >
            Comunidad
          </Link>
          <button
            type="button"
            onClick={() => setEditandoApodo((v) => !v)}
            className="rounded-full border-[1.5px] border-gray-300 px-5 py-2.5 text-sm font-semibold text-ink hover:border-ink"
          >
            Cambiar apodo
          </button>
        </div>
      </div>

      {editandoApodo && (
        <div className="rounded-2xl border border-gray-200 bg-paper p-6 shadow-card">
          <PasoApodo
            actual={progreso?.apodo}
            onListo={() => {
              setEditandoApodo(false);
              void cargar();
            }}
          />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-coral-tint px-4 py-3 text-sm text-coral-deep">{error}</p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>{datos ? <TarjetaSenante datos={datos} /> : <p className="text-sm text-gray-500">Cargando...</p>}</div>
        <section aria-labelledby="mis-senas" className="space-y-4">
          <div>
            <p className="overline-label text-gray-500">Tus manos</p>
            <h2 id="mis-senas" className="mt-1 font-display text-2xl font-bold text-ink">
              {progreso ? `${progreso.senas} ${progreso.senas === 1 ? "seña" : "señas"}` : "Señas"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Tu lugar en el círculo de cada seña (el punto con aro) y cuántas manos tiene hoy.
            </p>
          </div>
          {progreso && <MisSenas senas={progreso.misSenas} />}
        </section>
      </div>

      {progreso && (
        <section aria-labelledby="atlas" className="space-y-4">
          <div>
            <p className="overline-label text-gray-500">LSM Corpus</p>
            <h2 id="atlas" className="mt-1 font-display text-2xl font-bold text-ink">
              Tu atlas de la mano · {progreso.atlas.tuyas} de {progreso.atlas.total}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Las configuraciones de mano de la LSM, agrupadas por los dedos que se
              seleccionan (Cruz Aldrete, 2008). Cada una que grabas se dibuja aquí; las
              vacías te llevan a grabarla.
            </p>
          </div>
          <AtlasMano atlas={progreso.atlas} />
        </section>
      )}

      {progreso && (
        <section aria-labelledby="sellos" className="space-y-4">
          <div>
            <p className="overline-label text-gray-500">SignaPlay</p>
            <h2 id="sellos" className="mt-1 font-display text-2xl font-bold text-ink">
              Sellos de ruta · {progreso.sellos} de {progreso.rutas.length}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Graba todas las señas de una ruta de SignaPlay y ganas su sello.
            </p>
          </div>
          <SellosRutas rutas={progreso.rutas} />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 pt-6 text-sm text-gray-500">
        <Link href="/mis-grabaciones" className="font-semibold text-ink underline-offset-4 hover:underline">
          Mis grabaciones
        </Link>
        <Link href="/perfil" className="font-semibold text-ink underline-offset-4 hover:underline">
          Completar mi perfil
        </Link>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="underline-offset-4 hover:underline"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
