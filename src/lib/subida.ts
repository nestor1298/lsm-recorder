"use client";

/**
 * subida.ts — cómo llega un video al corpus desde el navegador: la sesión
 * remota (una vez), el presign, el PUT a S3 y la confirmación. Lo usan el
 * estudio y Grabar; la sesión local (localStorage) la actualiza quien
 * llama, aquí solo va la red.
 */

import { postJson, type ProgresoAlConfirmar } from "./api-client";
import { getSession, saveSession } from "./store";
import type { RecordingSession } from "./types";
import { senaSignaPlay, type CorpusId } from "./corpus";

export interface ContextoSesion {
  camara?: MediaTrackSettings | null;
  lugar?: string;
}

/** Crea la sesión en el servidor si esta sesión local aún no la tiene. */
export async function asegurarSesionRemota(
  s: RecordingSession,
  contexto: ContextoSesion = {},
): Promise<void> {
  if (s.remote_session_created) return;
  const cam = contexto.camara;
  await postJson("/api/sessions", {
    sessionId: s.id,
    name: s.name,
    corpus: s.corpus ?? "lsm",
    deviceInfo: { userAgent: navigator.userAgent },
    sessionMetadata: {
      user_agent: navigator.userAgent,
      screen_width: window.screen?.width,
      screen_height: window.screen?.height,
      camera_width: cam?.width,
      camera_height: cam?.height,
      camera_frame_rate: cam?.frameRate,
      lugar: contexto.lugar || undefined,
      captured_at: new Date().toISOString(),
    },
  });
  const fresh = getSession(s.id);
  if (fresh) {
    fresh.remote_session_created = true;
    saveSession(fresh);
  }
}

export interface ResultadoSubida {
  id: string;
  key: string;
  progreso: ProgresoAlConfirmar | null;
}

/** presign → PUT → confirm. Lanza si algo falla; quien llama marca el estado. */
export async function subirGrabacion(args: {
  sessionId: string;
  itemId: string;
  corpus: CorpusId;
  blob: Blob;
  durationMs: number;
}): Promise<ResultadoSubida> {
  const { sessionId, itemId, corpus, blob, durationMs } = args;
  const { url, key, contentType } = await postJson<{
    url: string;
    key: string;
    contentType: string;
  }>("/api/recordings/presign", {
    sessionId,
    itemId,
    corpus,
    // Tipo real del video (webm de cámara o mp4/mov subido), sin parámetros
    // de codecs: MediaRecorder produce p. ej. "video/webm;codecs=vp9".
    ...(blob.type ? { contentType: blob.type.split(";")[0].trim() } : {}),
  });

  const put = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!put.ok) throw new Error("Falló la subida del video a S3");

  const { id, progreso } = await postJson<{
    id: string;
    progreso?: ProgresoAlConfirmar | null;
  }>("/api/recordings/confirm", {
    sessionId,
    itemId,
    corpus,
    gloss: corpus === "signaplay" ? senaSignaPlay(itemId)?.glosa : undefined,
    s3Key: key,
    durationMs,
  });
  return { id, key, progreso: progreso ?? null };
}
