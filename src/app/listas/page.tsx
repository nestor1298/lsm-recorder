"use client";

/**
 * /listas — elige una lista: bloques de señas de los dos corpus con su
 * cobertura (personas por seña, de la meta de 9), la más necesitada, lo
 * que tú llevas y la meta de la comunidad. Elegir abre la pregunta
 * «¿puedes con esta lista?» y, si sí, el estudio.
 *
 * Requiere haberse unido (sesión, apodo, cuestionario y acuerdo); si
 * falta algo manda al paso que toca y vuelve aquí después.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchListas, fetchMe, type ListasResponse } from "@/lib/api-client";
import { pasoPendiente, rutaUnirse } from "@/lib/camino";
import { guardarVolverA } from "@/lib/volver_a";
import { CORPUS_INFO, esCorpusId, type CorpusId } from "@/lib/corpus";
import { LISTAS, type ListaDef } from "@/lib/listas";
import { createSession, getSessions } from "@/lib/store";
import type { RecordingSession } from "@/lib/types";
import TarjetaLista, { type EstadoLista } from "@/components/listas/TarjetaLista";
import MetaComunidad from "@/components/listas/MetaComunidad";
import DialogoCompromiso from "@/components/listas/DialogoCompromiso";
import SesionPendiente from "@/components/inicio/SesionPendiente";

type Gate = "checking" | "ok" | "redirecting" | "error";

export default function ListasPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-gray-500">Cargando...</p>}>
      <Listas />
    </Suspense>
  );
}

function Listas() {
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useAuth();
  const [gate, setGate] = useState<Gate>("checking");
  const [datos, setDatos] = useState<ListasResponse | null>(null);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [elegida, setElegida] = useState<ListaDef | null>(null);
  const [sesiones, setSesiones] = useState<RecordingSession[]>([]);
  const corpusParam = params.get("corpus");
  const [filtro, setFiltro] = useState<CorpusId | "todas">(
    esCorpusId(corpusParam) ? corpusParam : "todas",
  );

  // ── Puerta: sesión + camino completo ──
  useEffect(() => {
    if (state === "loading") return;
    const volver = () => guardarVolverA(window.location.pathname + window.location.search);
    if (state === "signedOut") {
      setGate("redirecting");
      volver();
      router.replace("/unirse");
      return;
    }
    let activo = true;
    fetchMe()
      .then((me) => {
        if (!activo) return;
        const paso = pasoPendiente(me);
        if (paso) {
          setGate("redirecting");
          volver();
          router.replace(rutaUnirse(paso));
        } else setGate("ok");
      })
      .catch(() => {
        if (activo) setGate("error");
      });
    return () => {
      activo = false;
    };
  }, [state, router]);

  const cargar = useCallback(async () => {
    try {
      setDatos(await fetchListas());
      setErrorDatos(null);
    } catch (err) {
      setErrorDatos(err instanceof Error ? err.message : "No se pudo cargar la cobertura.");
    }
  }, []);

  useEffect(() => {
    if (gate !== "ok") return;
    void cargar();
    setSesiones(getSessions());
  }, [gate, cargar]);

  const estados = useMemo(() => {
    const m = new Map<string, EstadoLista>();
    for (const l of datos?.listas ?? []) m.set(l.id, l);
    return m;
  }, [datos]);

  const visibles = useMemo(
    () => LISTAS.filter((l) => filtro === "todas" || l.corpus === filtro),
    [filtro],
  );

  /** La sesión local a medias de esta lista, si la hay (para seguir donde ibas). */
  const sesionDe = useCallback(
    (lista: ListaDef) =>
      sesiones
        .filter((s) => s.lista_id === lista.id && s.signs.some((x) => x.status === "pending"))
        .at(-1) ?? null,
    [sesiones],
  );

  function entrar(lista: ListaDef) {
    const pendiente = sesionDe(lista);
    if (pendiente) {
      router.push(`/estudio?session=${pendiente.id}`);
      return;
    }
    const s = createSession(lista.nombre, lista.items, lista.corpus, lista.id);
    router.push(`/estudio?session=${s.id}`);
  }

  if (gate === "error") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="text-gray-700">Tu sesión está activa, pero no se pudo verificar tu perfil.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-ink px-6 py-2.5 font-semibold text-paper hover:bg-gray-800"
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (gate !== "ok") {
    return (
      <p className="py-12 text-center text-gray-500">
        {gate === "redirecting" ? "Redirigiendo..." : "Verificando acceso..."}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="overline-label text-gray-500">Señar</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
            Elige una lista
          </h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Bloques de señas de los dos corpus. Cada seña la queremos de{" "}
            {datos?.metaSenantes ?? 9} personas distintas. Graba lo que quieras y cambia
            de lista cuando quieras.
          </p>
        </div>
        <div role="group" aria-label="Corpus" className="flex gap-2">
          {(["todas", "lsm", "signaplay"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className={`rounded-full border-[1.5px] px-4 py-2 text-sm font-medium ${
                filtro === f ? "border-ink bg-ink text-paper" : "border-gray-300 text-gray-700 hover:border-ink"
              }`}
            >
              {f === "todas" ? "Todas" : CORPUS_INFO[f].nombre}
            </button>
          ))}
        </div>
      </div>

      <SesionPendiente />

      {datos ? (
        <MetaComunidad {...datos.comunidad} />
      ) : errorDatos ? (
        <p className="rounded-lg bg-gold-tint px-4 py-3 text-sm text-gold-deep">
          {errorDatos} Puedes elegir una lista de todas formas.
        </p>
      ) : (
        <p className="text-sm text-gray-500">Cargando la cobertura...</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibles.map((l) => (
          <TarjetaLista key={l.id} lista={l} estado={estados.get(l.id)} onElegir={setElegida} />
        ))}
      </div>

      <p className="text-sm text-gray-500">
        ¿Ya tienes videos grabados?{" "}
        <Link href="/record" className="font-semibold text-ink underline-offset-4 hover:underline">
          Súbelos desde Grabar
        </Link>
        .
      </p>

      {elegida && (
        <DialogoCompromiso
          lista={elegida}
          tuyas={estados.get(elegida.id)?.tuyas ?? 0}
          onSi={() => entrar(elegida)}
          onNo={() => setElegida(null)}
        />
      )}
    </div>
  );
}
