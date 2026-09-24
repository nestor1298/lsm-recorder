"use client";

import {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CM_INVENTORY, TIER_LABELS } from "@/lib/data";
import {
  createSession,
  getSession,
  getSessions,
  deleteSession,
  updateSignRecording,
  saveSession,
} from "@/lib/store";
import type { RecordingSession, SyncStatus } from "@/lib/types";
import {
  CORPUS_INFO,
  cmDeItemId,
  describirItem,
  esCorpusId,
  itemsLSM,
  itemsSignaPlay,
  senaSignaPlay,
  SIGNAPLAY_UNIDADES,
  type CorpusId,
} from "@/lib/corpus";
import { useAuth } from "@/hooks/useAuth";
import { fetchMe, postJson } from "@/lib/api-client";
import { guardarVolverA } from "@/lib/volver_a";
import SignPrompt from "@/components/SignPrompt";
import PromptSignaPlay from "@/components/grabar/PromptSignaPlay";
import TarjetaCorpus, { MarcaCorpus } from "@/components/grabar/TarjetaCorpus";
import CameraRecorder from "@/components/CameraRecorder";

// Tipos admitidos al subir un video ya grabado (además del webm de cámara)
const UPLOAD_TYPES = ["video/webm", "video/mp4", "video/quicktime"];
const MAX_UPLOAD_MB = 300;

type View = "setup" | "recording" | "review";
type Gate = "checking" | "ok" | "redirecting" | "error";

export default function RecordPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-gray-500">Cargando...</div>
      }
    >
      <RecordPageInner />
    </Suspense>
  );
}

function RecordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("session");
  const corpusParam = searchParams.get("corpus");
  const { state: authState } = useAuth();

  const [gate, setGate] = useState<Gate>("checking");
  const [view, setView] = useState<View>(resumeId ? "recording" : "setup");
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [lastBlobUrl, setLastBlobUrl] = useState<string | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState(0);
  const [sessions, setSessions] = useState<RecordingSession[]>([]);

  // Blobs held in memory for upload + retry within this page session,
  // por ítem ("12" o "POR_FAVOR").
  const blobsRef = useRef<Map<string, Blob>>(new Map());

  // ── Setup: primero el corpus, luego qué señas ──
  const [corpus, setCorpus] = useState<CorpusId | null>(
    esCorpusId(corpusParam) ? corpusParam : null,
  );
  const [sessionName, setSessionName] = useState("");
  const [selectedTier, setSelectedTier] = useState<number | null>(1);
  const [selectedUnidad, setSelectedUnidad] = useState<number | null>(1);
  const [shuffled, setShuffled] = useState(false);
  const [lugar, setLugar] = useState("");

  // Captured at session start, read at upload time (avoid stale closures).
  const lugarRef = useRef("");
  const cameraSettingsRef = useRef<MediaTrackSettings | null>(null);

  // ── Gate: require sign-in + granted consent ──────────────────────────────
  useEffect(() => {
    if (authState === "loading") return;
    // Guardar a dónde volver: el corpus elegido en Inicio (?corpus=) o la
    // sesión a retomar (?session=) sobreviven al inicio de sesión.
    const volver = () =>
      guardarVolverA(window.location.pathname + window.location.search);
    if (authState === "signedOut") {
      setGate("redirecting");
      volver();
      router.replace("/auth");
      return;
    }
    let active = true;
    fetchMe()
      .then((me) => {
        if (!active) return;
        if (me.consentStatus !== "granted") {
          setGate("redirecting");
          volver();
          router.replace("/consentimiento");
        } else {
          setGate("ok");
        }
      })
      .catch(() => {
        // We're signed in (authState says so) but /api/me failed — a server or
        // config error, not an auth problem. Bouncing to /auth here caused a
        // loop ("there is already a signed in user"); show the error instead.
        if (active) setGate("error");
      });
    return () => {
      active = false;
    };
  }, [authState, router]);

  // Signs stuck at "uploading" after a reload have no in-memory blob, so they
  // can never finish. Mark them "failed" so they surface in the retry panel.
  const reconcileOrphans = useCallback(
    (s: RecordingSession): RecordingSession => {
      let changed = false;
      for (const sign of s.signs) {
        if (
          sign.status === "approved" &&
          sign.sync_status === "uploading" &&
          !blobsRef.current.has(sign.item_id)
        ) {
          sign.sync_status = "failed";
          sign.sync_error =
            "La subida se interrumpió y el video ya no está en este navegador; vuelve a grabar esta seña.";
          changed = true;
        }
      }
      if (changed) saveSession(s);
      return s;
    },
    [],
  );

  const abrirSesion = useCallback(
    (s: RecordingSession) => {
      setSession(reconcileOrphans(s));
      setCorpus(s.corpus ?? "lsm");
      const firstPending = s.signs.findIndex((x) => x.status === "pending");
      setCurrentIndex(firstPending >= 0 ? firstPending : 0);
      setView("recording");
    },
    [reconcileOrphans],
  );

  // Load existing session if resuming
  useEffect(() => {
    if (resumeId) {
      const existing = getSession(resumeId);
      if (existing) abrirSesion(existing);
    }
    setSessions(getSessions());
  }, [resumeId, abrirSesion]);

  const sessionCorpus: CorpusId = session?.corpus ?? corpus ?? "lsm";
  const items = useMemo(
    () => (session ? session.signs.map((s) => s.item_id) : []),
    [session],
  );
  const currentItem = items[currentIndex] ?? null;

  const refreshSession = useCallback((id: string) => {
    const updated = getSession(id);
    if (updated) setSession(updated);
  }, []);

  // ── Remote sync ──────────────────────────────────────────────────────────
  const ensureRemoteSession = useCallback(
    async (s: RecordingSession): Promise<void> => {
      if (s.remote_session_created) return;
      const settings = cameraSettingsRef.current;
      await postJson("/api/sessions", {
        sessionId: s.id,
        name: s.name,
        corpus: s.corpus ?? "lsm",
        deviceInfo: { userAgent: navigator.userAgent },
        sessionMetadata: {
          user_agent: navigator.userAgent,
          screen_width: window.screen?.width,
          screen_height: window.screen?.height,
          camera_width: settings?.width,
          camera_height: settings?.height,
          camera_frame_rate: settings?.frameRate,
          lugar: lugarRef.current || undefined,
          captured_at: new Date().toISOString(),
        },
      });
      const fresh = getSession(s.id);
      if (fresh) {
        fresh.remote_session_created = true;
        saveSession(fresh);
        setSession(fresh);
      }
    },
    [],
  );

  const uploadSign = useCallback(
    async (sessionId: string, itemId: string, durationMs: number) => {
      const blob = blobsRef.current.get(itemId);
      if (!blob) {
        updateSignRecording(sessionId, itemId, {
          sync_status: "failed",
          sync_error: "No hay video en memoria; vuelve a grabar esta seña.",
        });
        refreshSession(sessionId);
        return;
      }
      updateSignRecording(sessionId, itemId, {
        sync_status: "uploading",
        sync_error: undefined,
      });
      refreshSession(sessionId);
      try {
        const current = getSession(sessionId);
        if (current) await ensureRemoteSession(current);
        const corpusSesion: CorpusId = current?.corpus ?? "lsm";

        const { url, key, contentType } = await postJson<{
          url: string;
          key: string;
          contentType: string;
        }>("/api/recordings/presign", {
          sessionId,
          itemId,
          corpus: corpusSesion,
          // Tipo real del video (webm de cámara o mp4/mov subido), sin
          // parámetros de codecs (MediaRecorder produce p. ej.
          // "video/webm;codecs=vp9"); el servidor valida el tipo base.
          ...(blob.type
            ? { contentType: blob.type.split(";")[0].trim() }
            : {}),
        });

        const put = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
        });
        if (!put.ok) throw new Error("Falló la subida del video a S3");

        const { id } = await postJson<{ id: string }>(
          "/api/recordings/confirm",
          {
            sessionId,
            itemId,
            corpus: corpusSesion,
            gloss:
              corpusSesion === "signaplay"
                ? senaSignaPlay(itemId)?.glosa
                : undefined,
            s3Key: key,
            durationMs,
          },
        );

        updateSignRecording(sessionId, itemId, {
          sync_status: "synced",
          s3_key: key,
          remote_id: id,
          sync_error: undefined,
        });
        blobsRef.current.delete(itemId);
      } catch (err) {
        updateSignRecording(sessionId, itemId, {
          sync_status: "failed",
          sync_error:
            err instanceof Error ? err.message : "Error al sincronizar",
        });
      } finally {
        refreshSession(sessionId);
      }
    },
    [ensureRemoteSession, refreshSession],
  );

  // ── Qué señas entran en la sesión nueva ──
  const itemsNuevos = useMemo(() => {
    if (corpus === "signaplay") return itemsSignaPlay(selectedUnidad);
    return itemsLSM(selectedTier);
  }, [corpus, selectedTier, selectedUnidad]);

  const nombrePorDefecto = useMemo(() => {
    if (!corpus) return "";
    if (corpus === "signaplay") {
      const u = SIGNAPLAY_UNIDADES.find((x) => x.numero === selectedUnidad);
      return u ? u.nombre : "SignaPlay · todas las rutas";
    }
    return selectedTier
      ? `LSM Corpus · ${TIER_LABELS[selectedTier]}`
      : "LSM Corpus · las 101";
  }, [corpus, selectedTier, selectedUnidad]);

  // Create new session
  const handleCreateSession = useCallback(() => {
    if (!corpus) return;
    let ids = [...itemsNuevos];
    if (shuffled) ids = ids.sort(() => Math.random() - 0.5);
    const name =
      sessionName.trim() ||
      `${nombrePorDefecto} · ${new Date().toLocaleDateString()}`;
    const newSession = createSession(name, ids, corpus);
    setSession(newSession);
    setCurrentIndex(0);
    setView("recording");
    setSessions(getSessions());
  }, [corpus, itemsNuevos, shuffled, sessionName, nombrePorDefecto]);

  const handleRecordingComplete = useCallback(
    (blob: Blob, durationMs: number) => {
      if (!session || !currentItem) return;
      const url = URL.createObjectURL(blob);
      setLastBlob(blob);
      setLastBlobUrl(url);
      setLastDurationMs(durationMs);
      setView("review");
    },
    [session, currentItem],
  );

  // Subir un archivo de video en lugar de grabar con la cámara.
  // Entra al mismo flujo de revisión → aceptar → presign/S3.
  const [uploadError, setUploadError] = useState<string | null>(null);
  const handleFileChosen = useCallback(
    (file: File | undefined) => {
      setUploadError(null);
      if (!file) return;
      if (!UPLOAD_TYPES.includes(file.type.split(";")[0].trim())) {
        setUploadError("Formato no admitido. Usa webm, mp4 o mov.");
        return;
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setUploadError(`El video pasa de ${MAX_UPLOAD_MB} MB. Recórtalo e intenta de nuevo.`);
        return;
      }
      // Leer la duración de los metadatos antes de pasar a revisión.
      const probe = document.createElement("video");
      const url = URL.createObjectURL(file);
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        const durationMs = isFinite(probe.duration)
          ? Math.round(probe.duration * 1000)
          : 0;
        URL.revokeObjectURL(url);
        handleRecordingComplete(file, durationMs);
      };
      probe.onerror = () => {
        URL.revokeObjectURL(url);
        setUploadError("No se pudo leer el video. ¿El archivo está completo?");
      };
      probe.src = url;
    },
    [handleRecordingComplete],
  );

  // Accept recording -> approve + start upload
  const handleAccept = useCallback(() => {
    if (!session || !currentItem || !lastBlob) return;
    blobsRef.current.set(currentItem, lastBlob);
    updateSignRecording(session.id, currentItem, {
      status: "approved",
      recorded_at: new Date().toISOString(),
      duration_ms: lastDurationMs,
      video_blob_url: lastBlobUrl ?? undefined,
      sync_status: "uploading",
    });
    refreshSession(session.id);
    void uploadSign(session.id, currentItem, lastDurationMs);

    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    setLastBlob(null);
    setLastBlobUrl(null);
    setLastDurationMs(0);
    setView("recording");
  }, [
    session,
    currentItem,
    currentIndex,
    items.length,
    lastBlob,
    lastBlobUrl,
    lastDurationMs,
    refreshSession,
    uploadSign,
  ]);

  const handleRetryUpload = useCallback(
    (itemId: string) => {
      if (!session) return;
      const sign = session.signs.find((s) => s.item_id === itemId);
      void uploadSign(session.id, itemId, sign?.duration_ms ?? 0);
    },
    [session, uploadSign],
  );

  const handleRetry = useCallback(() => {
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    setLastBlob(null);
    setLastBlobUrl(null);
    setLastDurationMs(0);
    setView("recording");
  }, [lastBlobUrl]);

  const handleSkip = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, items.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id);
    setSessions(getSessions());
  }, []);

  // ── Gate UI ──────────────────────────────────────────────────────────────
  if (gate === "error") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="text-gray-700">
          Tu sesión está activa, pero no se pudo verificar tu perfil.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-ink px-6 py-2.5 font-semibold text-white transition-colors hover:bg-gray-800"
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (gate !== "ok") {
    return (
      <div className="py-12 text-center text-gray-500">
        {gate === "redirecting" ? "Redirigiendo..." : "Verificando acceso..."}
      </div>
    );
  }

  // ── Setup View ────────────────────────────────────────────────────────────
  if (view === "setup") {
    const sesionesAnteriores = sessions.length > 0 && (
      <div>
        <h2 className="mb-3 text-lg font-bold text-ink">Sesiones anteriores</h2>
        <div className="space-y-2">
          {sessions.map((s) => {
            const recorded = s.signs.filter(
              (sign) => sign.status !== "pending",
            ).length;
            const unsynced = s.signs.filter(
              (sign) =>
                sign.status === "approved" && sign.sync_status !== "synced",
            ).length;
            const c: CorpusId = s.corpus ?? "lsm";
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-paper p-4"
              >
                <button onClick={() => abrirSesion(s)} className="flex items-center gap-3 text-left">
                  <MarcaCorpus corpus={c} className="w-10 shrink-0 rounded-md" />
                  <span>
                    <p className="font-semibold text-ink">{s.name}</p>
                    <p className="text-sm text-gray-500">
                      {CORPUS_INFO[c].nombre} &middot; {recorded}/{s.signs.length} grabadas
                      &middot; {new Date(s.created_at).toLocaleDateString()}
                      {unsynced > 0 && (
                        <span className="ml-1 text-gold-deep">
                          &middot; {unsynced} sin sincronizar
                        </span>
                      )}
                    </p>
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteSession(s.id)}
                  className="rounded-lg px-3 py-1 text-sm text-coral-deep hover:bg-coral-tint"
                >
                  Eliminar
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );

    // 1. ¿A qué corpus va la grabación?
    if (!corpus) {
      return (
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <p className="overline-label text-gray-500">Grabar</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
              ¿Qué vamos a grabar hoy?
            </h1>
            <p className="mt-2 text-gray-600">
              Hay dos corpus. Elige uno y la cámara te va guiando seña por
              seña; cada video queda con tu nivel de acceso y lo puedes
              retirar cuando quieras.
            </p>
          </div>
          <div className="grid gap-4">
            <TarjetaCorpus corpus="lsm" onClick={() => setCorpus("lsm")} />
            <TarjetaCorpus corpus="signaplay" onClick={() => setCorpus("signaplay")} />
          </div>
          {sesionesAnteriores}
        </div>
      );
    }

    // 2. Qué señas de ese corpus
    const info = CORPUS_INFO[corpus];
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-start gap-4">
          <MarcaCorpus corpus={corpus} className="w-16 shrink-0 rounded-lg shadow-card" />
          <div className="min-w-0 flex-1">
            <p className="overline-label text-gray-500">{info.nombre}</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-ink">
              Nueva sesión de grabación
            </h1>
            <p className="text-sm text-gray-500">{info.queSeGraba}</p>
          </div>
          <button
            onClick={() => setCorpus(null)}
            className="shrink-0 rounded-full border-[1.5px] border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-ink"
          >
            Cambiar de corpus
          </button>
        </div>

        <div className="space-y-6 rounded-xl border border-gray-200 bg-paper p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nombre de la sesión
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder={nombrePorDefecto}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-accent"
            />
          </div>

          {corpus === "lsm" ? (
            <div role="group" aria-labelledby="nivel-frecuencia">
              <p id="nivel-frecuencia" className="mb-2 block text-sm font-medium text-gray-700">
                Nivel de frecuencia
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTier(null)}
                  aria-pressed={selectedTier === null}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    selectedTier === null
                      ? "bg-ink text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Las 101 señas
                </button>
                {[1, 2, 3, 4].map((tier) => {
                  const count = CM_INVENTORY.filter(
                    (cm) => cm.frequency_tier === tier,
                  ).length;
                  return (
                    <button
                      key={tier}
                      onClick={() => setSelectedTier(tier)}
                      aria-pressed={selectedTier === tier}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        selectedTier === tier
                          ? "bg-ink text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      T{tier}: {TIER_LABELS[tier]} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div role="group" aria-labelledby="ruta-signaplay">
              <p id="ruta-signaplay" className="mb-2 block text-sm font-medium text-gray-700">
                Ruta de SignaPlay
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedUnidad(null)}
                  aria-pressed={selectedUnidad === null}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    selectedUnidad === null
                      ? "bg-ink text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Todas las rutas ({info.total})
                </button>
                {SIGNAPLAY_UNIDADES.map((u) => {
                  const n = u.lecciones.reduce((a, l) => a + l.senas.length, 0);
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUnidad(u.numero)}
                      aria-pressed={selectedUnidad === u.numero}
                      title={u.concepto}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        selectedUnidad === u.numero
                          ? "bg-ink text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {u.nombre} ({n})
                    </button>
                  );
                })}
              </div>
              {/* Las señas que entran, para saber qué se va a grabar */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {itemsNuevos.slice(0, 40).map((id) => (
                  <span
                    key={id}
                    className="rounded-full bg-gold-tint px-2.5 py-0.5 text-xs font-semibold text-ink"
                  >
                    {describirItem("signaplay", id).titulo}
                  </span>
                ))}
                {itemsNuevos.length > 40 && (
                  <span className="px-1 text-xs text-gray-500">
                    y {itemsNuevos.length - 40} más
                  </span>
                )}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={shuffled}
              onChange={(e) => setShuffled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-accent-deep focus:ring-accent"
            />
            <span className="text-sm text-gray-700">Mezclar el orden</span>
          </label>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Lugar (opcional)
            </label>
            <input
              type="text"
              value={lugar}
              onChange={(e) => {
                setLugar(e.target.value);
                lugarRef.current = e.target.value;
              }}
              placeholder="ej., Ciudad de México"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-accent"
            />
          </div>

          <button
            onClick={handleCreateSession}
            disabled={itemsNuevos.length === 0}
            className="w-full rounded-full bg-ink py-3 text-lg font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            Comenzar a grabar ({itemsNuevos.length} señas)
          </button>
        </div>

        {sesionesAnteriores}
      </div>
    );
  }

  // ── Prompt según el corpus ────────────────────────────────────────────────
  const prompt = (itemId: string) => {
    if (sessionCorpus === "signaplay") {
      return <PromptSignaPlay itemId={itemId} index={currentIndex} total={items.length} />;
    }
    const cm = cmDeItemId(itemId);
    return cm ? (
      <SignPrompt cm={cm} index={currentIndex} total={items.length} />
    ) : (
      <div className="rounded-xl border border-gray-200 bg-paper p-6 text-center">
        <p className="text-sm text-gray-500">
          Seña {currentIndex + 1} de {items.length}
        </p>
        <h2 className="mt-2 text-3xl font-bold text-ink">
          {describirItem(sessionCorpus, itemId).titulo}
        </h2>
      </div>
    );
  };

  // ── Review View ───────────────────────────────────────────────────────────
  if (view === "review" && lastBlobUrl && currentItem) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold text-ink">Revisar grabación</h1>

        {prompt(currentItem)}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
          <video
            src={lastBlobUrl}
            controls
            className="aspect-video w-full"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleAccept}
            className="flex-1 rounded-full bg-green py-3 text-lg font-semibold text-white transition-colors hover:bg-green-deep"
          >
            Aceptar y subir
          </button>
          <button
            onClick={handleRetry}
            className="flex-1 rounded-full bg-gray-200 py-3 text-lg font-semibold text-gray-700 transition-colors hover:bg-gray-300"
          >
            Repetir
          </button>
        </div>
      </div>
    );
  }

  // ── Recording View ────────────────────────────────────────────────────────
  if (!currentItem || !session) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-gray-500">No hay señas para grabar.</p>
        <button
          onClick={() => {
            setView("setup");
            setSession(null);
            setCorpus(null);
          }}
          className="mt-4 rounded-full bg-ink px-6 py-2 text-white"
        >
          Crear nueva sesión
        </button>
      </div>
    );
  }

  const recorded = session.signs.filter((s) => s.status !== "pending").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <MarcaCorpus corpus={sessionCorpus} className="w-12 shrink-0 rounded-lg shadow-card" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-ink">{session.name}</h1>
            <p className="text-sm text-gray-500">
              {CORPUS_INFO[sessionCorpus].nombre} &middot; {recorded}/{session.signs.length} grabadas
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setView("setup");
            setSession(null);
            setCorpus(null);
          }}
          className="shrink-0 rounded-full bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Volver a sesiones
        </button>
      </div>

      {prompt(currentItem)}

      <CameraRecorder
        onRecordingComplete={handleRecordingComplete}
        onStreamReady={(s) => {
          cameraSettingsRef.current = s;
        }}
      />

      {/* Alternativa: subir un video ya grabado para esta seña */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-600">
            ¿Ya tienes esta seña en video? Súbelo en lugar de grabar.
          </p>
          <label className="cursor-pointer rounded-full border-[1.5px] border-ink px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-gray-100">
            Subir video
            <input
              type="file"
              accept="video/webm,video/mp4,video/quicktime"
              className="hidden"
              onChange={(e) => {
                handleFileChosen(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          webm, mp4 o mov · máx. 300 MB · pasa por la misma revisión antes de
          enviarse
        </p>
        {uploadError && (
          <p className="mt-2 rounded bg-coral-tint px-3 py-2 text-xs text-coral-deep">
            {uploadError}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="rounded-full bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm text-gray-500">
          {currentIndex + 1} / {items.length}
        </span>
        <button
          onClick={handleSkip}
          disabled={currentIndex >= items.length - 1}
          className="rounded-full bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Saltar
        </button>
      </div>

      {/* Per-sign sync state */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Progreso y sincronización
        </p>
        <div className="flex flex-wrap gap-1">
          {session.signs.map((sign, i) => (
            <button
              key={sign.item_id}
              onClick={() => setCurrentIndex(i)}
              className={`h-6 min-w-6 rounded px-1.5 text-xs font-medium transition-colors ${gridClass(
                i === currentIndex,
                sign.status,
                sign.sync_status,
              )}`}
              title={syncTitle(
                describirItem(sessionCorpus, sign.item_id).titulo,
                sign.status,
                sign.sync_status,
              )}
            >
              {describirItem(sessionCorpus, sign.item_id).corto}
            </button>
          ))}
        </div>

        {/* Failed uploads with retry */}
        {session.signs.some(
          (s) => s.status === "approved" && s.sync_status === "failed",
        ) && (
          <div className="mt-3 space-y-2 rounded-lg border border-gold bg-gold-tint p-3">
            <p className="text-sm font-medium text-gold-deep">
              Señas sin sincronizar. El video solo se conserva mientras esta
              página esté abierta; si la recargas tendrás que volver a grabar.
            </p>
            {session.signs
              .filter(
                (s) => s.status === "approved" && s.sync_status === "failed",
              )
              .map((s) => (
                <div
                  key={s.item_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gold-deep">
                    {describirItem(sessionCorpus, s.item_id).titulo} — {s.sync_error ?? "error"}
                  </span>
                  <button
                    onClick={() => handleRetryUpload(s.item_id)}
                    className="rounded bg-gold px-3 py-1 text-xs font-medium text-white hover:bg-gold-deep"
                  >
                    Reintentar
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      <p className="text-center text-sm text-gray-600">
        <Link href="/mis-grabaciones" className="underline-offset-2 hover:underline">
          Ver mis grabaciones
        </Link>
      </p>
    </div>
  );
}

function gridClass(
  isCurrent: boolean,
  status: string,
  sync?: SyncStatus,
): string {
  if (isCurrent) return "bg-ink text-white ring-2 ring-accent-tint";
  if (status === "approved") {
    if (sync === "synced") return "bg-green text-white";
    if (sync === "uploading")
      return "bg-accent-tint text-accent-deep animate-pulse";
    if (sync === "failed") return "bg-gold text-gold-deep";
    return "bg-green-tint text-green-deep";
  }
  if (status === "recorded") return "bg-green-tint text-green-deep";
  return "bg-gray-100 text-gray-400 hover:bg-gray-200";
}

function syncTitle(nombre: string, status: string, sync?: SyncStatus): string {
  if (status !== "approved") return nombre;
  switch (sync) {
    case "synced":
      return `${nombre} — sincronizada`;
    case "uploading":
      return `${nombre} — subiendo...`;
    case "failed":
      return `${nombre} — sin sincronizar`;
    default:
      return `${nombre} — pendiente de sincronizar`;
  }
}
