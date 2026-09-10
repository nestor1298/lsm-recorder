"use client";

/**
 * PanelAtajos — los atajos de la línea de tiempo, visibles en la
 * interfaz y no solo en el README.
 */

import { TIMELINE_ES } from "@/lib/anotar_labels";

const ATAJOS: { teclas: string; hace: string }[] = [
  { teclas: "Pellizcar", hace: "Acercar y alejar (táctil y trackpad)" },
  { teclas: "⌘ + rueda", hace: "Acercar y alejar con el cursor como ancla" },
  { teclas: "Rueda", hace: "Recorrer la seña en el tiempo" },
  { teclas: "Doble clic", hace: "Encuadrar ese segmento" },
  { teclas: "+ / −", hace: "Acercar y alejar sobre la aguja" },
  { teclas: "0", hace: "Ajustar al clip completo" },
  { teclas: "⇧ 0", hace: "Ajustar al segmento seleccionado" },
  { teclas: "← / →", hace: "Mover la aguja un cuadro" },
  { teclas: "⇧ ← / ⇧ →", hace: "Mover la aguja diez cuadros" },
  { teclas: "Inicio / Fin", hace: "Ir al principio o al final" },
  { teclas: "⌥ al arrastrar", hace: "Desactivar el ajuste magnético" },
];

export default function PanelAtajos({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={TIMELINE_ES.atajos}
      className="absolute right-0 z-40 mt-1 w-80 rounded-xl border border-gray-200 bg-paper p-3 shadow-card"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{TIMELINE_ES.atajos}</h3>
        <button
          onClick={onClose}
          className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
        >
          Cerrar
        </button>
      </div>
      <dl className="space-y-1">
        {ATAJOS.map((a) => (
          <div key={a.teclas} className="flex items-baseline gap-2 text-xs">
            <dt className="w-28 shrink-0 font-mono text-[11px] text-ink">
              {a.teclas}
            </dt>
            <dd className="text-gray-600">{a.hace}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
        La lista de segmentos de la derecha llega a lo mismo sin gestos.
      </p>
    </div>
  );
}
