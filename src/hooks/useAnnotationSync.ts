"use client";

/**
 * useAnnotationSync — mantiene las anotaciones del navegador y las del
 * corpus en el mismo estado.
 *
 * Al montar (con sesión iniciada) fusiona ambos lados; después, cada
 * cambio se encola con rebote. Si no hay sesión, todo sigue funcionando
 * contra localStorage: anotar nunca depende de la red.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { getJson, postJson, authedFetch } from "@/lib/api-client";
import { getAnnotations, saveAnnotation } from "@/lib/store";
import {
  crearColaDeSubida,
  leerEstados,
  escribirEstado,
  planDeFusion,
  type AnotacionRemota,
  type EstadoSync,
} from "@/lib/annotations_sync";
import type { SignAnnotation } from "@/lib/types";

export interface SyncInfo {
  estados: Record<string, EstadoSync>;
  /** true mientras se hace la fusión inicial */
  fusionando: boolean;
  /** resumen de la última fusión, para contarlo en la interfaz */
  ultimaFusion: { subidas: number; bajadas: number } | null;
  error: string | null;
  /** encola una anotación para subirla (con rebote) */
  encolar: (a: SignAnnotation) => void;
  /** vuelve a fusionar a mano */
  refrescar: () => void;
  /** borrado suave en el corpus (no bloquea la interfaz si falla) */
  eliminar: (id: string) => Promise<void>;
}

export function useAnnotationSync(
  onCambioRemoto?: () => void,
): SyncInfo {
  const { state } = useAuth();
  const [estados, setEstados] = useState<Record<string, EstadoSync>>({});
  const [fusionando, setFusionando] = useState(false);
  const [ultimaFusion, setUltimaFusion] = useState<{
    subidas: number;
    bajadas: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const colaRef = useRef<ReturnType<typeof crearColaDeSubida> | null>(null);

  const refrescarEstados = useCallback(() => setEstados(leerEstados()), []);

  // Cola de subida (una sola por montaje).
  if (!colaRef.current) {
    colaRef.current = crearColaDeSubida(async (a) => {
      await postJson("/api/annotations", { annotation: a });
    });
  }

  const encolar = useCallback(
    (a: SignAnnotation) => {
      if (state !== "signedIn") {
        escribirEstado(a.id, "local");
        refrescarEstados();
        return;
      }
      colaRef.current?.encolar(a);
      refrescarEstados();
      // el estado final (sincronizada/error) se refleja al terminar
      setTimeout(refrescarEstados, 2200);
    },
    [state, refrescarEstados],
  );

  const fusionar = useCallback(async () => {
    if (state !== "signedIn") return;
    setFusionando(true);
    setError(null);
    try {
      const { annotations: remotas } = await getJson<{
        annotations: AnotacionRemota[];
      }>("/api/annotations");
      const locales = getAnnotations();
      const plan = planDeFusion(locales, remotas);

      // Bajar lo que está más fresco en el corpus
      for (const id of plan.bajar) {
        const { annotation } = await getJson<{ annotation: SignAnnotation }>(
          `/api/annotations/${id}`,
        );
        saveAnnotation(annotation);
        escribirEstado(id, "sincronizada");
      }
      // Subir lo que está más fresco aquí (incluye lo que nunca se subió)
      for (const id of plan.subir) {
        const local = locales.find((l) => l.id === id);
        if (!local) continue;
        escribirEstado(id, "guardando");
        await postJson("/api/annotations", { annotation: local });
        escribirEstado(id, "sincronizada");
      }
      for (const id of plan.enPaz) escribirEstado(id, "sincronizada");

      setUltimaFusion({ subidas: plan.subir.length, bajadas: plan.bajar.length });
      refrescarEstados();
      if (plan.bajar.length > 0) onCambioRemoto?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo sincronizar con el corpus",
      );
    } finally {
      setFusionando(false);
    }
  }, [state, refrescarEstados, onCambioRemoto]);

  useEffect(() => {
    refrescarEstados();
    if (state === "signedIn") void fusionar();
  }, [state, fusionar, refrescarEstados]);

  // Al cerrar la pestaña, se envía lo que quedó pendiente.
  useEffect(() => {
    const alSalir = () => void colaRef.current?.vaciar();
    window.addEventListener("pagehide", alSalir);
    return () => {
      window.removeEventListener("pagehide", alSalir);
      void colaRef.current?.vaciar();
    };
  }, []);

  const eliminar = useCallback(
    async (id: string) => {
      if (state !== "signedIn") return;
      try {
        await authedFetch(`/api/annotations/${id}`, { method: "DELETE" });
      } catch {
        // el borrado local ya ocurrió; el corpus se limpia al re-sincronizar
      }
    },
    [state],
  );

  return {
    estados,
    fusionando,
    ultimaFusion,
    error,
    encolar,
    refrescar: () => void fusionar(),
    eliminar,
  };
}
