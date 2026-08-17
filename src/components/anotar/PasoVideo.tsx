"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getJson } from "@/lib/api-client";

/**
 * Paso 1 — elegir el video a anotar y darle nombre a la seña.
 * Tres caminos: una grabación sincronizada de la persona, un archivo
 * local, o continuar sin video (anotar de memoria).
 */

interface RecordingRow {
  id: string;
  cmId: number;
  recordedAt: string;
  durationMs: number;
  withdrawn: boolean;
}

interface PasoVideoProps {
  gloss: string;
  videoUrl?: string;
  onGlossChange: (gloss: string) => void;
  onVideoChange: (url: string | undefined, isLocal: boolean) => void;
  onNext: () => void;
}

export default function PasoVideo({
  gloss,
  videoUrl,
  onGlossChange,
  onVideoChange,
  onNext,
}: PasoVideoProps) {
  const { state } = useAuth();
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state !== "signedIn") return;
    setLoadingList(true);
    getJson<{ recordings: RecordingRow[] }>("/api/recordings")
      .then((data) =>
        setRecordings(data.recordings.filter((r) => !r.withdrawn).slice(0, 12)),
      )
      .catch(() => setRecordings([]))
      .finally(() => setLoadingList(false));
  }, [state]);

  const pickRecording = useCallback(
    async (id: string) => {
      setFetchingId(id);
      setError(null);
      try {
        const { url } = await getJson<{ url: string }>(
          `/api/recordings/${id}/url`,
        );
        onVideoChange(url, false);
      } catch {
        setError("No se pudo cargar el video. Intenta de nuevo.");
      } finally {
        setFetchingId(null);
      }
    },
    [onVideoChange],
  );

  const pickFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      onVideoChange(URL.createObjectURL(file), true);
    },
    [onVideoChange],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">¿Qué seña vas a anotar?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Escribe el nombre (glosa) y elige un video.
        </p>
      </div>

      {/* Glosa */}
      <div>
        <label
          htmlFor="glosa"
          className="mb-1 block text-xs font-semibold text-gray-600"
        >
          Nombre de la seña
        </label>
        <input
          id="glosa"
          type="text"
          value={gloss}
          onChange={(e) => onGlossChange(e.target.value)}
          placeholder="Ej. CASA, MAMÁ, TRABAJAR…"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-medium uppercase text-ink placeholder:normal-case placeholder:font-normal focus:border-accent focus:outline-none"
        />
      </div>

      {/* Video elegido */}
      {videoUrl && (
        <div className="overflow-hidden rounded-xl border-2 border-green bg-black">
          <video src={videoUrl} controls className="aspect-video w-full" />
          <div className="flex items-center justify-between bg-green-tint px-4 py-2">
            <span className="text-sm font-semibold text-green-deep">
              Video listo
            </span>
            <button
              onClick={() => onVideoChange(undefined, false)}
              className="text-sm font-medium text-gray-600 hover:text-ink"
            >
              Cambiar
            </button>
          </div>
        </div>
      )}

      {!videoUrl && (
        <div className="space-y-4">
          {/* Mis grabaciones */}
          {state === "signedIn" && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">
                Tus grabaciones
              </h3>
              {loadingList ? (
                <p className="text-sm text-gray-400">Cargando…</p>
              ) : recordings.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No tienes grabaciones sincronizadas todavía.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {recordings.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => void pickRecording(r.id)}
                      disabled={fetchingId !== null}
                      className="rounded-xl border border-gray-200 bg-paper p-3 text-left transition-colors hover:border-accent disabled:opacity-50"
                    >
                      <p className="font-semibold text-ink">Seña #{r.cmId}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(r.recordedAt).toLocaleDateString()}
                      </p>
                      {fetchingId === r.id && (
                        <p className="mt-1 text-xs text-accent-deep">
                          Cargando…
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subir archivo / sin video */}
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border-[1.5px] border-ink px-6 py-3 font-semibold text-ink transition-colors hover:bg-gray-50"
            >
              Subir un video
            </button>
            <button
              onClick={onNext}
              className="rounded-full px-6 py-3 font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-ink"
            >
              Continuar sin video
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-coral-tint px-4 py-3 text-sm text-coral-deep">
          {error}
        </p>
      )}

      <div className="flex justify-end border-t border-gray-100 pt-4">
        <button
          onClick={onNext}
          disabled={!gloss.trim()}
          className="rounded-full bg-ink px-8 py-3 font-semibold text-paper transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
