"use client";

import type { CMEntry, FlexionLevel } from "@/lib/types";
import { MiniHand, FLEXION_COLOR } from "@/components/learn/MiniHand";

interface HandVisualizationProps {
  cm: CMEntry | null;
  size?: number;
}

/**
 * Visualización grande de la configuración de mano para Anotar.
 * Usa la misma silueta segmentada que las miniaturas del inventario
 * (MiniHand), con leyenda de flexión y modificadores.
 */
export default function HandVisualization({
  cm,
  size = 280,
}: HandVisualizationProps) {
  if (!cm) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50"
        style={{ width: size, height: size }}
      >
        <span className="text-sm text-gray-400">Elige una CM</span>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size }}>
      <div
        className="relative flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50"
        style={{ width: size, height: size }}
      >
        <MiniHand cm={cm} size={size * 0.92} />

        {/* Modificadores */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {cm.spread === "SPREAD" && (
            <span className="rounded bg-accent-tint px-1.5 py-0.5 text-[10px] font-bold text-accent-deep">
              separados
            </span>
          )}
          {cm.interaction === "CROSSED" && (
            <span className="rounded bg-gold-tint px-1.5 py-0.5 text-[10px] font-bold text-gold-deep">
              cruzados
            </span>
          )}
          {cm.interaction === "STACKED" && (
            <span className="rounded bg-gold-tint px-1.5 py-0.5 text-[10px] font-bold text-gold-deep">
              apilados
            </span>
          )}
          {cm.thumb_contact && (
            <span className="rounded bg-magenta-tint px-1.5 py-0.5 text-[10px] font-bold text-magenta-deep">
              contacto
            </span>
          )}
        </div>

        <span className="absolute bottom-2 right-3 text-[11px] text-gray-500">
          CM #{cm.cm_id}
        </span>
      </div>

      {/* Leyenda */}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {(["EXTENDED", "CURVED", "BENT", "CLOSED"] as FlexionLevel[]).map(
          (level) => (
            <div key={level} className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: FLEXION_COLOR[level] }}
              />
              <span className="text-[10px] text-gray-500">
                {
                  {
                    EXTENDED: "extendido",
                    CURVED: "curvado",
                    BENT: "doblado",
                    CLOSED: "cerrado",
                  }[level]
                }
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
