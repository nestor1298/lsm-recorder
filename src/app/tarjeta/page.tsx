"use client";

/**
 * /tarjeta — tu tarjeta de señante y tu colección: nivel, medalla, cifras,
 * la seña más rara, y todas las señas que ya grabaste. Desde aquí se
 * cambia el apodo y se descarga la tarjeta.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchProgreso, type ProgresoResponse } from "@/lib/api-client";
import { guardarVolverA } from "@/lib/volver_a";
import { describirItem } from "@/lib/corpus";
import { MEDALLAS, RAREZA_INFO, siguienteMedalla } from "@/lib/progresion";
import TarjetaSenante, { type DatosTarjeta } from "@/components/tarjeta/TarjetaSenante";
import Coleccion from "@/components/tarjeta/Coleccion";
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
    const masRara = progreso.rarezaMax
      ? progreso.coleccion.find((s) => s.rareza === progreso.rarezaMax)
      : undefined;
    return {
      apodo: progreso.apodo ?? "Sin apodo",
      nivel: progreso.nivel,
      medalla: MEDALLAS.find((m) => m.id === progreso.medalla) ?? null,
      videos: progreso.videos,
      senasDistintas: progreso.senasDistintas,
      cmDistintas: progreso.cmDistintas,
      rarezaMax: progreso.rarezaMax,
      senaMasRara: masRara ? describirItem(masRara.corpus, masRara.itemId).titulo : undefined,
    };
  }, [progreso]);

  if (state !== "signedIn") {
    return <p className="py-12 text-center text-gray-500">Verificando acceso...</p>;
  }

  const siguiente = progreso ? siguienteMedalla(progreso.nivel) : null;

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
              Nivel {progreso.nivel}
              {datos?.medalla ? ` · medalla de ${datos.medalla.nombre.toLowerCase()}` : ""} ·{" "}
              {progreso.videosSemana} videos esta semana ·{" "}
              {siguiente
                ? `${siguiente.nombre} al nivel ${siguiente.nivel}`
                : "todas las medallas"}{" "}
              · el siguiente cofre en {progreso.faltanParaCofre} videos.
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
            href="/tablero"
            className="rounded-full border-[1.5px] border-gray-300 px-5 py-2.5 text-sm font-semibold text-ink hover:border-ink"
          >
            Tablero
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
        <div className="space-y-6">
          <div>
            <p className="overline-label text-gray-500">Tu colección</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">
              {progreso ? `${progreso.senasDistintas} señas` : "Señas"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {RAREZAS_TEXTO}
            </p>
          </div>
          {progreso && <Coleccion senas={progreso.coleccion} />}
        </div>
      </div>

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

const RAREZAS_TEXTO = `Rareza por corpus: en el LSM Corpus sale del nivel de frecuencia de la mano (${RAREZA_INFO.comun.nombre.toLowerCase()} a ${RAREZA_INFO.legendaria.nombre.toLowerCase()}); en SignaPlay, de qué tan adentro de las rutas está la seña.`;
