"use client";

/**
 * /estudio — donde se graba. Una pantalla, sin scroll: la cámara a la
 * izquierda, la seña que toca a la derecha, y abajo la tira de la lista.
 *
 * Por seña: Grabar (espacio) → cuenta de 3 → REC → Detener (espacio) →
 * revisar: Guardar (Enter) o Rehacer (R). Guardar sube el video en
 * segundo plano y pasa a la siguiente seña; al confirmar, el servidor
 * dice si subiste de nivel, si se abre un cofre o si ganaste medalla.
 * Atrás/Siguiente/Saltar (flechas, S), Descanso (B).
 *
 * La sesión vive en localStorage (`?session=`), como en Grabar; aquí
 * además sabe de qué lista salió.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchMe, type MeResponse } from "@/lib/api-client";
import { pasoPendiente, rutaUnirse } from "@/lib/camino";
import { guardarVolverA } from "@/lib/volver_a";
import { CORPUS_INFO, describirItem, esCorpusId, type CorpusId } from "@/lib/corpus";
import { ITEM_ID_RE } from "@/lib/aws/keys";
import { listaDe } from "@/lib/listas";
import { createSession, getSession, saveSession, updateSignRecording } from "@/lib/store";
import { asegurarSesionRemota, subirGrabacion } from "@/lib/subida";
import { MEDALLAS, masRara, nivelDe, type Rareza } from "@/lib/progresion";
import { TIER_BY_VALUE } from "@/lib/tiers";
import type { RecordingSession, SyncStatus } from "@/lib/types";
import CamaraEstudio, {
  type CamaraHandle,
  type EstadoCamara,
} from "@/components/estudio/CamaraEstudio";
import PromptEstudio from "@/components/estudio/PromptEstudio";
import {
  AvisoNivel,
  Cofre,
  MedallaGanada,
  type Celebracion,
} from "@/components/estudio/Celebraciones";
import Descanso from "@/components/estudio/Descanso";
import FinDeLista from "@/components/estudio/FinDeLista";

type Gate = "checking" | "ok" | "redirecting" | "error";
type Fase = "senar" | "revisar" | "descanso" | "fin";

export default function EstudioPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-gray-500">Cargando...</p>}>
      <Estudio />
    </Suspense>
  );
}

function Estudio() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");
  const { state: authState } = useAuth();

  const [gate, setGate] = useState<Gate>("checking");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [indice, setIndice] = useState(0);
  const [fase, setFase] = useState<Fase>("senar");
  const [camara, setCamara] = useState<EstadoCamara>("apagada");
  const [ultimo, setUltimo] = useState<{ blob: Blob; url: string; ms: number } | null>(null);
  const [nivel, setNivel] = useState(0);
  const [videosSesion, setVideosSesion] = useState(0);
  const [celebracion, setCelebracion] = useState<Celebracion | null>(null);
  const [avisoNivel, setAvisoNivel] = useState<number | null>(null);
  const cola = useRef<Celebracion[]>([]);
  const recientes = useRef<{ corpus: CorpusId; itemId: string; rareza: Rareza }[]>([]);
  const blobs = useRef<Map<string, Blob>>(new Map());
  const camaraRef = useRef<CamaraHandle>(null);
  const camSettings = useRef<MediaTrackSettings | null>(null);

  // ── Puerta ──
  useEffect(() => {
    if (authState === "loading") return;
    const volver = () => guardarVolverA(window.location.pathname + window.location.search);
    if (authState === "signedOut") {
      setGate("redirecting");
      volver();
      router.replace("/unirse");
      return;
    }
    let activo = true;
    fetchMe()
      .then((m) => {
        if (!activo) return;
        const paso = pasoPendiente(m);
        if (paso) {
          setGate("redirecting");
          volver();
          router.replace(rutaUnirse(paso));
          return;
        }
        setMe(m);
        setNivel(nivelDe(m.videos ?? 0));
        setGate("ok");
      })
      .catch(() => {
        if (activo) setGate("error");
      });
    return () => {
      activo = false;
    };
  }, [authState, router]);

  // Sesión al vuelo (`?corpus=lsm&items=12,80`): para volver a grabar una
  // seña desde Mis grabaciones sin pasar por una lista.
  useEffect(() => {
    if (gate !== "ok" || sessionId) return;
    const c = params.get("corpus");
    const ids = (params.get("items") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => ITEM_ID_RE.test(x));
    if (!esCorpusId(c) || ids.length === 0) return;
    const s = createSession(
      ids.length === 1 ? `Volver a grabar · ${describirItem(c, ids[0]).titulo}` : "Volver a grabar",
      ids,
      c,
    );
    router.replace(`/estudio?session=${s.id}`);
  }, [gate, sessionId, params, router]);

  // ── Sesión local ──
  useEffect(() => {
    if (gate !== "ok" || !sessionId) return;
    const s = getSession(sessionId);
    if (!s) return;
    // Subidas que quedaron a medias en otra carga ya no tienen video.
    let cambio = false;
    for (const sign of s.signs) {
      if (sign.status === "approved" && sign.sync_status === "uploading" && !blobs.current.has(sign.item_id)) {
        sign.sync_status = "failed";
        sign.sync_error = "La subida se interrumpió y el video ya no está en este navegador; vuelve a grabar esta seña.";
        cambio = true;
      }
    }
    if (cambio) saveSession(s);
    setSession(s);
    const primera = s.signs.findIndex((x) => x.status === "pending");
    setIndice(primera >= 0 ? primera : 0);
    if (primera < 0) setFase("fin");
  }, [gate, sessionId]);

  const refrescar = useCallback(() => {
    if (!sessionId) return;
    const s = getSession(sessionId);
    if (s) setSession(s);
  }, [sessionId]);

  const corpus: CorpusId = session?.corpus ?? "lsm";
  const items = useMemo(() => session?.signs.map((s) => s.item_id) ?? [], [session]);
  const itemActual = items[indice] ?? null;
  const lista = session?.lista_id ? listaDe(session.lista_id) : undefined;
  const grabadas = session?.signs.filter((s) => s.status !== "pending").length ?? 0;
  const pendientes = session?.signs.filter((s) => s.status === "pending").length ?? 0;
  const subiendo = session?.signs.filter((s) => s.status === "approved" && s.sync_status === "uploading").length ?? 0;

  // ── Celebraciones en fila (una a la vez) ──
  const siguienteCelebracion = useCallback(() => {
    const c = cola.current.shift() ?? null;
    setCelebracion(c);
  }, []);
  const encolar = useCallback(
    (cs: Celebracion[]) => {
      cola.current.push(...cs);
      if (!celebracion) siguienteCelebracion();
    },
    [celebracion, siguienteCelebracion],
  );

  // ── Subida ──
  const subir = useCallback(
    async (sid: string, itemId: string, ms: number) => {
      const blob = blobs.current.get(itemId);
      if (!blob) {
        updateSignRecording(sid, itemId, {
          sync_status: "failed",
          sync_error: "No hay video en memoria; vuelve a grabar esta seña.",
        });
        refrescar();
        return;
      }
      updateSignRecording(sid, itemId, { sync_status: "uploading", sync_error: undefined });
      refrescar();
      try {
        const actual = getSession(sid);
        if (actual) await asegurarSesionRemota(actual, { camara: camSettings.current });
        const c: CorpusId = actual?.corpus ?? "lsm";
        const r = await subirGrabacion({ sessionId: sid, itemId, corpus: c, blob, durationMs: ms });
        updateSignRecording(sid, itemId, {
          sync_status: "synced",
          s3_key: r.key,
          remote_id: r.id,
          sync_error: undefined,
        });
        blobs.current.delete(itemId);
        if (r.progreso) {
          const p = r.progreso;
          setNivel(p.nivel);
          setVideosSesion((v) => v + 1);
          recientes.current.push({ corpus: c, itemId, rareza: p.rareza });
          if (recientes.current.length > 10) recientes.current.shift();
          const nuevas: Celebracion[] = [];
          if (p.cofre) {
            const mejor = recientes.current.reduce((a, b) =>
              masRara(a.rareza, b.rareza) === a.rareza ? a : b,
            );
            nuevas.push({ tipo: "cofre", ...mejor, nivel: p.nivel });
          }
          const medalla = MEDALLAS.find((m) => m.id === p.medalla);
          if (medalla) nuevas.push({ tipo: "medalla", medalla });
          if (nuevas.length) encolar(nuevas);
          else {
            setAvisoNivel(p.nivel);
            setTimeout(() => setAvisoNivel(null), 1800);
          }
        }
      } catch (err) {
        updateSignRecording(sid, itemId, {
          sync_status: "failed",
          sync_error: err instanceof Error ? err.message : "Error al sincronizar",
        });
      } finally {
        refrescar();
      }
    },
    [encolar, refrescar],
  );

  // ── Navegación por la lista ──
  const irA = useCallback(
    (i: number) => {
      if (!session) return;
      if (i < 0 || i >= session.signs.length) return;
      setIndice(i);
      setFase("senar");
    },
    [session],
  );
  const siguientePendiente = useCallback(
    (desde: number): number => {
      if (!session) return -1;
      const n = session.signs.length;
      for (let k = 1; k <= n; k++) {
        const j = (desde + k) % n;
        if (session.signs[j].status === "pending") return j;
      }
      return -1;
    },
    [session],
  );
  const avanzar = useCallback(
    (desde: number) => {
      const j = siguientePendiente(desde);
      if (j < 0 || (j <= desde && pendientes <= 1)) {
        setFase("fin");
        return;
      }
      // Al dar la vuelta solo quedan saltadas: cerramos la lista primero.
      if (j <= desde) {
        setFase("fin");
        return;
      }
      irA(j);
    },
    [irA, pendientes, siguientePendiente],
  );

  const alGrabar = useCallback((blob: Blob, ms: number) => {
    setUltimo({ blob, url: URL.createObjectURL(blob), ms });
    setFase("revisar");
  }, []);

  const rehacer = useCallback(() => {
    if (ultimo) URL.revokeObjectURL(ultimo.url);
    setUltimo(null);
    setFase("senar");
  }, [ultimo]);

  const guardar = useCallback(() => {
    if (!session || !itemActual || !ultimo) return;
    blobs.current.set(itemActual, ultimo.blob);
    updateSignRecording(session.id, itemActual, {
      status: "approved",
      recorded_at: new Date().toISOString(),
      duration_ms: ultimo.ms,
      saltada: false,
      sync_status: "uploading",
    });
    refrescar();
    void subir(session.id, itemActual, ultimo.ms);
    URL.revokeObjectURL(ultimo.url);
    setUltimo(null);
    const s = getSession(session.id);
    const quedan = s?.signs.filter((x) => x.status === "pending").length ?? 0;
    if (quedan === 0) setFase("fin");
    else {
      const j = siguientePendiente(indice);
      if (j < 0) setFase("fin");
      else irA(j);
    }
  }, [session, itemActual, ultimo, refrescar, subir, siguientePendiente, indice, irA]);

  const saltar = useCallback(() => {
    if (!session || !itemActual) return;
    updateSignRecording(session.id, itemActual, { saltada: true });
    refrescar();
    avanzar(indice);
  }, [session, itemActual, refrescar, avanzar, indice]);

  const volverASaltadas = useCallback(() => {
    if (!session) return;
    const j = session.signs.findIndex((s) => s.status === "pending");
    if (j >= 0) irA(j);
  }, [session, irA]);

  // ── Teclado ──
  useEffect(() => {
    if (gate !== "ok") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (celebracion) return; // las celebraciones manejan su propio Enter/Esc
      const k = e.key.toLowerCase();
      if (fase === "descanso") return; // Descanso maneja B/Esc
      if (fase === "fin") return;
      if (k === " ") {
        e.preventDefault();
        if (fase !== "senar") return;
        if (camara === "lista") camaraRef.current?.grabar();
        else if (camara === "grabando" || camara === "cuenta") camaraRef.current?.detener();
      } else if (k === "enter" && fase === "revisar") {
        e.preventDefault();
        guardar();
      } else if (k === "r" && fase === "revisar") {
        e.preventDefault();
        rehacer();
      } else if (k === "b") {
        e.preventDefault();
        if (camara === "grabando" || camara === "cuenta") camaraRef.current?.detener();
        setFase("descanso");
      } else if (k === "arrowright" && fase === "senar") {
        e.preventDefault();
        irA(indice + 1);
      } else if (k === "arrowleft" && fase === "senar") {
        e.preventDefault();
        irA(indice - 1);
      } else if (k === "s" && fase === "senar") {
        e.preventDefault();
        saltar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gate, fase, camara, celebracion, guardar, rehacer, irA, indice, saltar]);

  // Avisar antes de cerrar con subidas en curso
  useEffect(() => {
    if (subiendo === 0) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [subiendo]);

  // ── Puerta UI ──
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
  if (!sessionId && esCorpusId(params.get("corpus")) && params.get("items")) {
    return <p className="py-12 text-center text-gray-500">Preparando la sesión...</p>;
  }
  if (!sessionId || (gate === "ok" && !session)) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="text-gray-700">
          {sessionId ? "Esa sesión no está en este navegador." : "Elige una lista para entrar al estudio."}
        </p>
        <Link href="/listas" className="inline-block rounded-full bg-ink px-6 py-2.5 font-semibold text-paper hover:bg-gray-800">
          Ir a las listas
        </Link>
      </div>
    );
  }
  if (!session) return null;

  const tier = TIER_BY_VALUE[me?.defaultTier ?? "restringido"];
  const medalla = MEDALLAS.filter((m) => nivel >= m.nivel).at(-1) ?? null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-[69px] flex flex-col bg-gray-50">
      {/* Cabecera del estudio */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gray-200 bg-paper px-4 py-2 text-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/listas" className="shrink-0 font-semibold text-gray-600 hover:text-ink">
            ‹ Listas
          </Link>
          <span className="truncate text-gray-500">
            {CORPUS_INFO[corpus].nombre} · <span className="font-semibold text-ink">{session.name}</span> ·{" "}
            {grabadas} de {items.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 font-semibold ${medalla ? medalla.clase : "bg-gray-100 text-gray-700"}`}
            title={medalla ? `Medalla de ${medalla.nombre.toLowerCase()}` : "Cada video sube un nivel"}
          >
            Nivel {nivel}
          </span>
          <Link
            href="/mis-grabaciones"
            className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:border-ink"
            title="Nivel de acceso de tus videos nuevos; lo cambias video por video en Mis grabaciones"
          >
            Tu video: {tier.label}
          </Link>
          <button
            type="button"
            onClick={() => setFase("descanso")}
            className="rounded-full border border-gray-200 px-3 py-1 text-gray-700 hover:border-ink"
          >
            Descanso (B)
          </button>
        </div>
      </div>

      {/* Cuerpo: cámara + seña */}
      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:px-6">
        <div className="relative min-h-[14rem]">
          <CamaraEstudio
            ref={camaraRef}
            onRecordingComplete={alGrabar}
            onStreamReady={(s) => {
              camSettings.current = s;
            }}
            onEstado={setCamara}
          />
          {fase === "revisar" && ultimo && (
            <div className="absolute inset-0 overflow-hidden rounded-2xl bg-ink">
              <video
                src={ultimo.url}
                autoPlay
                loop
                playsInline
                controls
                className="h-full w-full object-contain"
                style={{ transform: "scaleX(-1)" }}
              />
              <p className="absolute left-4 top-4 rounded-full bg-paper/90 px-3 py-1 text-sm font-semibold text-ink">
                Revisa tu video · {(ultimo.ms / 1000).toFixed(1)} s
              </p>
            </div>
          )}
          {avisoNivel !== null && <AvisoNivel nivel={avisoNivel} />}
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {itemActual && <PromptEstudio corpus={corpus} itemId={itemActual} />}

          {/* Acción principal */}
          {fase === "revisar" ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={guardar}
                className="rounded-full bg-green py-3 font-semibold text-paper hover:bg-green-deep"
              >
                Guardar (Enter)
              </button>
              <button
                type="button"
                onClick={rehacer}
                className="rounded-full border-[1.5px] border-gray-300 py-3 font-semibold text-ink hover:border-ink"
              >
                Rehacer (R)
              </button>
            </div>
          ) : camara === "grabando" || camara === "cuenta" ? (
            <button
              type="button"
              onClick={() => camaraRef.current?.detener()}
              className="flex items-center justify-center gap-3 rounded-full bg-coral-deep py-3 font-semibold text-paper hover:bg-coral"
            >
              <span className="block h-4 w-4 rounded-sm bg-paper" aria-hidden />
              Detener (espacio)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => camaraRef.current?.grabar()}
              disabled={camara !== "lista"}
              className="flex items-center justify-center gap-3 rounded-full bg-ink py-3 font-semibold text-paper hover:bg-gray-800 disabled:opacity-40"
            >
              <span className="block h-4 w-4 rounded-full bg-coral" aria-hidden />
              Grabar (espacio)
            </button>
          )}

          <div className="grid grid-cols-3 gap-2 text-sm">
            <button
              type="button"
              onClick={() => irA(indice - 1)}
              disabled={indice === 0 || fase === "revisar"}
              className="rounded-full border border-gray-200 bg-paper py-2 font-medium text-gray-700 hover:border-ink disabled:opacity-40"
            >
              ‹ Atrás
            </button>
            <button
              type="button"
              onClick={() => irA(indice + 1)}
              disabled={indice >= items.length - 1 || fase === "revisar"}
              className="rounded-full border border-gray-200 bg-paper py-2 font-medium text-gray-700 hover:border-ink disabled:opacity-40"
            >
              Siguiente ›
            </button>
            <button
              type="button"
              onClick={saltar}
              disabled={fase === "revisar" || session.signs[indice]?.status !== "pending"}
              className="rounded-full border border-gray-200 bg-paper py-2 font-medium text-gray-700 hover:border-ink disabled:opacity-40"
            >
              Saltar (S)
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Manos en reposo al empezar y al terminar. De 3 a 7 segundos; se corta sola a los 12.
          </p>
        </div>
      </div>

      {/* Tira de la lista */}
      <div className="border-t border-gray-200 bg-paper px-4 py-2 sm:px-6">
        <div className="flex gap-1 overflow-x-auto" role="list" aria-label="Señas de la lista">
          {session.signs.map((sign, i) => (
            <button
              key={sign.item_id}
              role="listitem"
              type="button"
              onClick={() => fase !== "revisar" && irA(i)}
              className={`h-7 shrink-0 rounded px-2 text-xs font-medium transition-colors ${claseFicha(
                i === indice,
                sign.status,
                sign.sync_status,
                sign.saltada,
              )}`}
              title={tituloFicha(describirItem(corpus, sign.item_id).titulo, sign.status, sign.sync_status, sign.saltada)}
              aria-current={i === indice ? "true" : undefined}
            >
              {describirItem(corpus, sign.item_id).corto}
            </button>
          ))}
        </div>
        {session.signs.some((s) => s.status === "approved" && s.sync_status === "failed") && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gold-tint px-3 py-2 text-xs text-gold-deep">
            <span>Hay videos sin subir. Solo se conservan mientras esta pestaña siga abierta.</span>
            {session.signs
              .filter((s) => s.status === "approved" && s.sync_status === "failed")
              .map((s) => (
                <button
                  key={s.item_id}
                  type="button"
                  onClick={() => void subir(session.id, s.item_id, s.duration_ms)}
                  className="rounded bg-gold px-2 py-0.5 font-semibold text-ink hover:bg-gold-deep hover:text-paper"
                >
                  Reintentar {describirItem(corpus, s.item_id).corto}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Capas */}
      {fase === "descanso" && (
        <Descanso nivel={nivel} videosSesion={videosSesion} onSeguir={() => setFase("senar")} />
      )}
      {fase === "fin" && (
        <FinDeLista
          nombre={lista?.nombre ?? session.name}
          grabadas={grabadas}
          total={items.length}
          saltadas={pendientes}
          pendientesSubida={subiendo}
          onVolverASaltadas={volverASaltadas}
        />
      )}
      {celebracion?.tipo === "cofre" && (
        <Cofre
          corpus={celebracion.corpus}
          itemId={celebracion.itemId}
          rareza={celebracion.rareza}
          nivel={celebracion.nivel}
          onCerrar={siguienteCelebracion}
        />
      )}
      {celebracion?.tipo === "medalla" && (
        <MedallaGanada medalla={celebracion.medalla} onCerrar={siguienteCelebracion} />
      )}
    </div>
  );
}

function claseFicha(actual: boolean, status: string, sync?: SyncStatus, saltada?: boolean): string {
  if (actual) return "bg-ink text-paper ring-2 ring-accent-tint";
  if (status === "approved") {
    if (sync === "synced") return "bg-green text-paper";
    if (sync === "uploading") return "animate-pulse bg-accent-tint text-accent-deep";
    if (sync === "failed") return "bg-gold text-ink";
    return "bg-green-tint text-green-deep";
  }
  if (saltada) return "bg-gray-200 text-gray-600";
  return "bg-gray-100 text-gray-400 hover:bg-gray-200";
}

function tituloFicha(nombre: string, status: string, sync?: SyncStatus, saltada?: boolean): string {
  if (status !== "approved") return saltada ? `${nombre} — saltada` : nombre;
  switch (sync) {
    case "synced":
      return `${nombre} — en el corpus`;
    case "uploading":
      return `${nombre} — subiendo...`;
    case "failed":
      return `${nombre} — sin subir`;
    default:
      return `${nombre} — pendiente de subir`;
  }
}
