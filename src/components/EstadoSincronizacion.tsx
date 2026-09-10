"use client";

/**
 * EstadoSincronizacion — dónde vive cada anotación.
 *
 * Anotar nunca depende de la red: si no hay sesión o falla la subida, el
 * trabajo sigue en este navegador y se sube después. El indicador existe
 * para que eso sea visible, no para bloquear.
 */

import { SYNC_ES } from "@/lib/anotar_labels";
import type { EstadoSync } from "@/lib/annotations_sync";

const CLASE: Record<EstadoSync, string> = {
  local: "bg-gray-100 text-gray-600",
  guardando: "bg-accent-tint text-accent-deep",
  sincronizada: "bg-green-tint text-green-deep",
  error: "bg-coral-tint text-coral-deep",
};

export function ChipSync({ estado }: { estado?: EstadoSync }) {
  const e = estado ?? "local";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CLASE[e]}`}
    >
      {SYNC_ES[e]}
    </span>
  );
}

export default function EstadoSincronizacion({
  fusionando,
  ultimaFusion,
  error,
  sesionIniciada,
  onRefrescar,
}: {
  fusionando: boolean;
  ultimaFusion: { subidas: number; bajadas: number } | null;
  error: string | null;
  sesionIniciada: boolean;
  onRefrescar: () => void;
}) {
  const texto = !sesionIniciada
    ? "Sin sesión: tus anotaciones viven solo en este navegador."
    : fusionando
      ? "Sincronizando con el corpus…"
      : error
        ? error
        : ultimaFusion
          ? ultimaFusion.subidas + ultimaFusion.bajadas === 0
            ? "Todo al día con el corpus."
            : `Sincronizado: ${ultimaFusion.subidas} subidas, ${ultimaFusion.bajadas} bajadas.`
          : "Listo para sincronizar.";

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
      <span
        className={`h-2 w-2 rounded-full ${
          error ? "bg-coral" : fusionando ? "bg-accent" : "bg-green"
        }`}
        aria-hidden
      />
      <span>{texto}</span>
      {sesionIniciada && (
        <button
          onClick={onRefrescar}
          disabled={fusionando}
          className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          Sincronizar ahora
        </button>
      )}
    </div>
  );
}
