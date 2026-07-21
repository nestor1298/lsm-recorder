"use client";

import {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
import type { CMEntry, RecordingSession, SyncStatus } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { fetchMe, postJson } from "@/lib/api-client";
import SignPrompt from "@/components/SignPrompt";
import CameraRecorder from "@/components/CameraRecorder";

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
  const { state: authState } = useAuth();

  const [gate, setGate] = useState<Gate>("checking");
  const [view, setView] = useState<View>(resumeId ? "recording" : "setup");
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [lastBlobUrl, setLastBlobUrl] = useState<string | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState(0);
  const [sessions, setSessions] = useState<RecordingSession[]>([]);

  // Blobs held in memory for upload + retry within this page session.
  const blobsRef = useRef<Map<number, Blob>>(new Map());

  // Setup form state
  const [sessionName, setSessionName] = useState("");
  const [selectedTier, setSelectedTier] = useState<number | null>(1);
  const [shuffled, setShuffled] = useState(false);
  const [lugar, setLugar] = useState("");

  // Captured at session start, read at upload time (avoid stale closures).
  const lugarRef = useRef("");
  const cameraSettingsRef = useRef<MediaTrackSettings | null>(null);

  // ── Gate: require sign-in + granted consent ──────────────────────────────
  useEffect(() => {
    if (authState === "loading") return;
    if (authState === "signedOut") {
      setGate("redirecting");
      router.replace("/auth");
      return;
    }
    let active = true;
    fetchMe()
      .then((me) => {
        if (!active) return;
        if (me.consentStatus !== "granted") {
          setGate("redirecting");
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
          !blobsRef.current.has(sign.cm_id)
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

  // Load existing session if resuming
  useEffect(() => {
    if (resumeId) {
      const existing = getSession(resumeId);
      if (existing) {
        setSession(reconcileOrphans(existing));
        const firstPending = existing.signs.findIndex(
          (s) => s.status === "pending",
        );
        setCurrentIndex(firstPending >= 0 ? firstPending : 0);
        setView("recording");
      }
    }
    setSessions(getSessions());
  }, [resumeId, reconcileOrphans]);

  const sessionCMs = useMemo(() => {
    if (!session) return [];
    return session.signs
      .map((s) => CM_INVENTORY.find((cm) => cm.cm_id === s.cm_id))
      .filter(Boolean) as CMEntry[];
  }, [session]);

  const currentCM = sessionCMs[currentIndex] ?? null;

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
    async (sessionId: string, cmId: number, durationMs: number) => {
      const blob = blobsRef.current.get(cmId);
      if (!blob) {
        updateSignRecording(sessionId, cmId, {
          sync_status: "failed",
          sync_error: "No hay video en memoria; vuelve a grabar esta seña.",
        });
        refreshSession(sessionId);
        return;
      }
      updateSignRecording(sessionId, cmId, {
        sync_status: "uploading",
        sync_error: undefined,
      });
      refreshSession(sessionId);
      try {
        const current = getSession(sessionId);
        if (current) await ensureRemoteSession(current);

        const { url, key, contentType } = await postJson<{
          url: string;
          key: string;
          contentType: string;
        }>("/api/recordings/presign", { sessionId, cmId });

        const put = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
        });
        if (!put.ok) throw new Error("Falló la subida del video a S3");

        const { id } = await postJson<{ id: string }>(
          "/api/recordings/confirm",
          { sessionId, cmId, s3Key: key, durationMs },
        );

        updateSignRecording(sessionId, cmId, {
          sync_status: "synced",
          s3_key: key,
          remote_id: id,
          sync_error: undefined,
        });
        blobsRef.current.delete(cmId);
      } catch (err) {
        updateSignRecording(sessionId, cmId, {
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

  // Create new session
  const handleCreateSession = useCallback(() => {
    let cmIds = CM_INVENTORY.map((cm) => cm.cm_id);
    if (selectedTier !== null) {
      cmIds = CM_INVENTORY.filter(
        (cm) => cm.frequency_tier === selectedTier,
      ).map((cm) => cm.cm_id);
    }
    if (shuffled) {
      cmIds = cmIds.sort(() => Math.random() - 0.5);
    }
    const name = sessionName.trim() || `Sesión ${new Date().toLocaleString()}`;
    const newSession = createSession(name, cmIds);
    setSession(newSession);
    setCurrentIndex(0);
    setView("recording");
    setSessions(getSessions());
  }, [sessionName, selectedTier, shuffled]);

  const handleRecordingComplete = useCallback(
    (blob: Blob, durationMs: number) => {
      if (!session || !currentCM) return;
      const url = URL.createObjectURL(blob);
      setLastBlob(blob);
      setLastBlobUrl(url);
      setLastDurationMs(durationMs);
      setView("review");
    },
    [session, currentCM],
  );

  // Accept recording -> approve + start upload
  const handleAccept = useCallback(() => {
    if (!session || !currentCM || !lastBlob) return;
    const cmId = currentCM.cm_id;
    blobsRef.current.set(cmId, lastBlob);
    updateSignRecording(session.id, cmId, {
      status: "approved",
      recorded_at: new Date().toISOString(),
      duration_ms: lastDurationMs,
      video_blob_url: lastBlobUrl ?? undefined,
      sync_status: "uploading",
    });
    refreshSession(session.id);
    void uploadSign(session.id, cmId, lastDurationMs);

    if (currentIndex < sessionCMs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    setLastBlob(null);
    setLastBlobUrl(null);
    setLastDurationMs(0);
    setView("recording");
  }, [
    session,
    currentCM,
    currentIndex,
    sessionCMs.length,
    lastBlob,
    lastBlobUrl,
    lastDurationMs,
    refreshSession,
    uploadSign,
  ]);

  const handleRetryUpload = useCallback(
    (cmId: number) => {
      if (!session) return;
      const sign = session.signs.find((s) => s.cm_id === cmId);
      void uploadSign(session.id, cmId, sign?.duration_ms ?? 0);
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
    if (currentIndex < sessionCMs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, sessionCMs.length]);

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
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Nueva sesión de grabación
          </h1>
          <p className="text-sm text-gray-500">
            Configura qué señas grabar y comienza a capturar videos
          </p>
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
              placeholder="ej., Tier 1 — primera pasada"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-accent"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Nivel de frecuencia
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTier(null)}
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
            className="w-full rounded-full bg-ink py-3 text-lg font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Comenzar a grabar (
            {selectedTier
              ? CM_INVENTORY.filter((cm) => cm.frequency_tier === selectedTier)
                  .length
              : 101}{" "}
            señas)
          </button>
        </div>

        {sessions.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-bold text-ink">
              Sesiones anteriores
            </h2>
            <div className="space-y-2">
              {sessions.map((s) => {
                const recorded = s.signs.filter(
                  (sign) => sign.status !== "pending",
                ).length;
                const unsynced = s.signs.filter(
                  (sign) =>
                    sign.status === "approved" && sign.sync_status !== "synced",
                ).length;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-paper p-4"
                  >
                    <button
                      onClick={() => {
                        setSession(reconcileOrphans(s));
                        const firstPending = s.signs.findIndex(
                          (sign) => sign.status === "pending",
                        );
                        setCurrentIndex(firstPending >= 0 ? firstPending : 0);
                        setView("recording");
                      }}
                      className="text-left"
                    >
                      <p className="font-semibold text-ink">{s.name}</p>
                      <p className="text-sm text-gray-500">
                        {recorded}/{s.signs.length} grabadas &middot;{" "}
                        {new Date(s.created_at).toLocaleDateString()}
                        {unsynced > 0 && (
                          <span className="ml-1 text-gold-deep">
                            &middot; {unsynced} sin sincronizar
                          </span>
                        )}
                      </p>
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
        )}
      </div>
    );
  }

  // ── Review View ───────────────────────────────────────────────────────────
  if (view === "review" && lastBlobUrl && currentCM) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold text-ink">Revisar grabación</h1>

        <SignPrompt
          cm={currentCM}
          index={currentIndex}
          total={sessionCMs.length}
        />

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
  if (!currentCM || !session) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-gray-500">No hay señas para grabar.</p>
        <button
          onClick={() => setView("setup")}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{session.name}</h1>
          <p className="text-sm text-gray-500">
            {recorded}/{session.signs.length} grabadas
          </p>
        </div>
        <button
          onClick={() => {
            setView("setup");
            setSession(null);
          }}
          className="rounded-full bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Volver a sesiones
        </button>
      </div>

      <SignPrompt
        cm={currentCM}
        index={currentIndex}
        total={sessionCMs.length}
      />

      <CameraRecorder
        onRecordingComplete={handleRecordingComplete}
        onStreamReady={(s) => {
          cameraSettingsRef.current = s;
        }}
      />

      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="rounded-full bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm text-gray-500">
          {currentIndex + 1} / {sessionCMs.length}
        </span>
        <button
          onClick={handleSkip}
          disabled={currentIndex >= sessionCMs.length - 1}
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
              key={sign.cm_id}
              onClick={() => setCurrentIndex(i)}
              className={`h-6 w-6 rounded text-xs font-medium transition-colors ${gridClass(
                i === currentIndex,
                sign.status,
                sign.sync_status,
              )}`}
              title={syncTitle(sign.cm_id, sign.status, sign.sync_status)}
            >
              {sign.cm_id}
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
                  key={s.cm_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gold-deep">
                    Seña #{s.cm_id} — {s.sync_error ?? "error"}
                  </span>
                  <button
                    onClick={() => handleRetryUpload(s.cm_id)}
                    className="rounded bg-gold px-3 py-1 text-xs font-medium text-white hover:bg-gold-deep"
                  >
                    Reintentar
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
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

function syncTitle(cmId: number, status: string, sync?: SyncStatus): string {
  const base = `Seña #${cmId}`;
  if (status !== "approved") return base;
  switch (sync) {
    case "synced":
      return `${base} — sincronizada`;
    case "uploading":
      return `${base} — subiendo...`;
    case "failed":
      return `${base} — sin sincronizar`;
    default:
      return `${base} — pendiente de sincronizar`;
  }
}
