"use client";

/**
 * /unirse — el camino para empezar a señar, en tres pasos:
 *   1. Quién eres: correo (código) y apodo.
 *   2. Un poco de ti: cuestionario corto.
 *   3. Cómo participas: nivel de acceso y acuerdo firmado.
 * El servidor decide en qué paso va cada persona (/api/me); `?paso=` es
 * solo una pista para quien llega desde un enlace. Al terminar: «Ya estás
 * dentro» y a elegir lista.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchMe, type MeResponse } from "@/lib/api-client";
import { pasoPendiente } from "@/lib/camino";
import { tomarVolverA } from "@/lib/volver_a";
import BarraPasos from "@/components/unirse/BarraPasos";
import PasoCorreo from "@/components/unirse/PasoCorreo";
import PasoApodo from "@/components/unirse/PasoApodo";
import PasoPerfil from "@/components/unirse/PasoPerfil";
import PasoAcuerdo from "@/components/unirse/PasoAcuerdo";

type Fase = "cargando" | "correo" | "apodo" | "perfil" | "acuerdo" | "dentro" | "error";

const VELO_MS = 1600;

export default function UnirsePage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-gray-500">Cargando...</p>}>
      <Unirse />
    </Suspense>
  );
}

function Unirse() {
  const router = useRouter();
  const { state, refresh } = useAuth();
  const [fase, setFase] = useState<Fase>("cargando");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Pone la fase que toca según el servidor; al terminar, velo y a las listas. */
  const avanzar = useCallback(
    (m: MeResponse, conVelo: boolean) => {
      setMe(m);
      const paso = pasoPendiente(m);
      if (paso === 1) setFase("apodo");
      else if (paso === 2) setFase("perfil");
      else if (paso === 3) setFase("acuerdo");
      else if (conVelo) {
        setFase("dentro");
        temporizador.current = setTimeout(
          () => router.replace(tomarVolverA() ?? "/listas"),
          VELO_MS,
        );
      } else router.replace(tomarVolverA() ?? "/listas");
    },
    [router],
  );

  const ubicar = useCallback(
    async (conVelo = false) => {
      try {
        avanzar(await fetchMe(), conVelo);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar tu perfil.");
        setFase("error");
      }
    },
    [avanzar],
  );

  useEffect(() => {
    if (state === "loading") return;
    if (state === "signedOut") setFase("correo");
    else void ubicar(false);
  }, [state, ubicar]);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  const paso: 1 | 2 | 3 =
    fase === "correo" || fase === "apodo" ? 1 : fase === "perfil" ? 2 : 3;

  if (fase === "dentro") {
    return (
      <div
        role="status"
        className="velo fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6 text-center text-paper"
      >
        <p className="aparece font-display text-4xl font-bold tracking-[-0.02em] sm:text-6xl">
          Ya estás dentro{me?.apodo ? `, ${me.apodo}` : ""}.
        </p>
        <p className="mt-4 text-lg text-gray-300">Ahora elige una lista.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <BarraPasos paso={paso} />

      {fase === "cargando" && (
        <p className="py-12 text-center text-gray-500">Verificando tu sesión...</p>
      )}

      {fase === "error" && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-paper p-6">
          <p className="text-sm text-gray-700">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-ink px-6 py-2.5 font-semibold text-paper hover:bg-gray-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {fase === "correo" && (
        <PasoCorreo
          onEntro={() => {
            void refresh();
            void ubicar(false);
          }}
        />
      )}

      {fase === "apodo" && (
        <PasoApodo
          actual={me?.apodo}
          onListo={(apodo) => me && avanzar({ ...me, apodo }, true)}
        />
      )}

      {fase === "perfil" && (
        <PasoPerfil onListo={() => me && avanzar({ ...me, hasMetadata: true }, true)} />
      )}

      {fase === "acuerdo" && (
        <PasoAcuerdo
          tierInicial={me?.defaultTier}
          onListo={() => me && avanzar({ ...me, consentStatus: "granted" }, true)}
        />
      )}
    </div>
  );
}
