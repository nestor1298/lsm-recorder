"use client";

/**
 * CamaraEstudio — la cámara del estudio. Se enciende sola, muestra la
 * cuenta de 3 y el tiempo grabado, y corta sola al tope. Se maneja desde
 * afuera (botón o teclado) con `ref.grabar()` / `ref.detener()`.
 */

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";

export type EstadoCamara =
  | "apagada"
  | "pidiendo"
  | "lista"
  | "cuenta"
  | "grabando"
  | "error";

export interface CamaraHandle {
  grabar: () => void;
  detener: () => void;
  encender: () => void;
}

/** Tope de grabación: las señas son de 3 a 7 s; a los 12 s se corta sola. */
export const TOPE_MS = 12_000;

export default function CamaraEstudio({
  ref,
  onRecordingComplete,
  onStreamReady,
  onEstado,
  espejo = true,
}: {
  ref?: Ref<CamaraHandle>;
  onRecordingComplete: (blob: Blob, durationMs: number) => void;
  onStreamReady?: (settings: MediaTrackSettings) => void;
  onEstado?: (estado: EstadoCamara) => void;
  espejo?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const inicioRef = useRef(0);
  const cuentaRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const topeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [estado, setEstadoInterno] = useState<EstadoCamara>("apagada");
  const [cuenta, setCuenta] = useState<number | null>(null);
  const [transcurrido, setTranscurrido] = useState(0);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const setEstado = useCallback(
    (e: EstadoCamara) => {
      setEstadoInterno(e);
      onEstado?.(e);
    },
    [onEstado],
  );

  const encender = useCallback(async () => {
    if (streamRef.current) return;
    setEstado("pidiendo");
    setMensaje(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const track = stream.getVideoTracks()[0];
      if (track) onStreamReady?.(track.getSettings());
      setEstado("lista");
    } catch {
      setMensaje("No se pudo abrir la cámara. Permite el acceso en tu navegador y recarga.");
      setEstado("error");
    }
  }, [onStreamReady, setEstado]);

  const detener = useCallback(() => {
    if (cuentaRef.current) {
      clearInterval(cuentaRef.current);
      cuentaRef.current = null;
      setCuenta(null);
      setEstado("lista");
      return;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, [setEstado]);

  const grabar = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || estado !== "lista") return;
    setEstado("cuenta");
    let n = 3;
    setCuenta(n);
    cuentaRef.current = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCuenta(n);
        return;
      }
      if (cuentaRef.current) clearInterval(cuentaRef.current);
      cuentaRef.current = null;
      setCuenta(null);

      const tipo = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType: tipo });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (topeRef.current) clearTimeout(topeRef.current);
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const dur = Date.now() - inicioRef.current;
        setEstado("lista");
        setTranscurrido(0);
        onRecordingComplete(blob, dur);
      };
      inicioRef.current = Date.now();
      recorder.start(100);
      recorderRef.current = recorder;
      setEstado("grabando");
      topeRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, TOPE_MS);
    }, 1000);
  }, [estado, onRecordingComplete, setEstado]);

  useImperativeHandle(ref, () => ({ grabar, detener, encender: () => void encender() }), [
    grabar,
    detener,
    encender,
  ]);

  // Se enciende sola al montar; se apaga al desmontar.
  useEffect(() => {
    void encender();
    return () => {
      if (cuentaRef.current) clearInterval(cuentaRef.current);
      if (topeRef.current) clearTimeout(topeRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (estado !== "grabando") return;
    const t = setInterval(() => setTranscurrido(Date.now() - inicioRef.current), 100);
    return () => clearInterval(t);
  }, [estado]);

  const segundos = (transcurrido / 1000).toFixed(1);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gray-900">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
        style={espejo ? { transform: "scaleX(-1)" } : undefined}
      />

      {(estado === "apagada" || estado === "pidiendo" || estado === "error") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900 p-6 text-center text-paper">
          {estado === "error" ? (
            <>
              <p className="max-w-sm text-sm text-gray-200">{mensaje}</p>
              <button
                type="button"
                onClick={() => void encender()}
                className="rounded-full bg-paper px-5 py-2 text-sm font-semibold text-ink"
              >
                Intentar de nuevo
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-300">Abriendo la cámara...</p>
          )}
        </div>
      )}

      {cuenta !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/50">
          <span className="font-display text-9xl font-bold text-paper" aria-live="assertive">
            {cuenta}
          </span>
        </div>
      )}

      {estado === "grabando" && (
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-coral-deep px-3 py-1 text-paper">
          <span className="h-3 w-3 animate-pulse rounded-full bg-paper" aria-hidden />
          <span className="font-mono text-sm font-medium">REC {segundos} s</span>
        </div>
      )}

      {/* Guía de encuadre: cabeza a cintura, manos y codos dentro */}
      {estado === "lista" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[12%] inset-y-[6%] rounded-3xl border border-paper/30"
        />
      )}
    </div>
  );
}
