"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CM_INVENTORY } from "@/lib/data";
import { MiniHand } from "@/components/learn/MiniHand";
import {
  buildNotacion,
  ubName,
  CONTACT_ES,
  CONTOUR_ES,
  LOCAL_ES,
  PLANE_ES,
} from "@/lib/anotar_labels";
import type { GuidedDraft } from "@/lib/anotar_draft";
import type { PasoId } from "@/lib/anotar_draft";

/**
 * Paso 5 — resumen. Todo lo elegido en una tarjeta, con la notación
 * LSM-PN compacta, listo para guardar o corregir cualquier paso.
 */

interface ResumenProps {
  draft: GuidedDraft;
  saved: boolean;
  onEdit: (paso: PasoId) => void;
  onSave: () => void;
  onExport: () => void;
  onNew: () => void;
}

export default function Resumen({
  draft,
  saved,
  onEdit,
  onSave,
  onExport,
  onNew,
}: ResumenProps) {
  const cm = useMemo(
    () => CM_INVENTORY.find((c) => c.cm_id === draft.cm_id) ?? null,
    [draft.cm_id],
  );

  const notacion = buildNotacion({
    cm,
    locationCode: draft.location_code,
    contact: draft.contact,
    contour: draft.contour,
    local: draft.local,
    plane: draft.plane,
  });

  const filas: {
    paso: PasoId;
    titulo: string;
    valor: React.ReactNode;
  }[] = [
    {
      paso: "cm",
      titulo: "Mano",
      valor: cm ? (
        <span className="flex items-center gap-2">
          <MiniHand cm={cm} size={40} />
          <span>
            CM #{cm.cm_id} · {cm.cruz_aldrete_notation}
          </span>
        </span>
      ) : (
        "—"
      ),
    },
    {
      paso: "ubicacion",
      titulo: "Lugar",
      valor: draft.location_code
        ? `${ubName(draft.location_code)} (${draft.location_code})${
            draft.contact ? ` · ${CONTACT_ES[draft.contact]}` : ""
          }`
        : "—",
    },
    {
      paso: "movimiento",
      titulo: "Movimiento",
      valor:
        [
          draft.contour && CONTOUR_ES[draft.contour],
          draft.local && LOCAL_ES[draft.local],
          draft.plane && PLANE_ES[draft.plane],
        ]
          .filter(Boolean)
          .join(" · ") || "Se queda quieta",
    },
    ...(draft.eyebrows || draft.mouth
      ? [
          {
            paso: "movimiento" as PasoId,
            titulo: "Rostro",
            valor: [
              draft.eyebrows &&
                { RAISED: "Cejas levantadas", FURROWED: "Ceño fruncido", NEUTRAL: "" }[
                  draft.eyebrows
                ],
              draft.mouth &&
                {
                  OPEN: "Boca abierta",
                  CLOSED: "Boca cerrada",
                  ROUNDED: "Boca redonda",
                  STRETCHED: "Boca estirada",
                  NEUTRAL: "",
                }[draft.mouth],
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">
          {saved ? "¡Anotación guardada!" : "Revisa tu anotación"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {saved
            ? "Puedes exportarla o empezar otra."
            : "Toca cualquier fila para corregirla."}
        </p>
      </div>

      {/* Tarjeta resumen */}
      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <div className="bg-ink px-5 py-4">
          <p className="overline-label text-gray-400">Seña</p>
          <p className="font-display text-2xl font-bold uppercase text-paper">
            {draft.gloss.trim() || "Sin nombre"}
          </p>
        </div>
        <div className="divide-y divide-gray-100 bg-paper">
          {filas.map((f) => (
            <button
              key={f.paso}
              onClick={() => onEdit(f.paso)}
              className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {f.titulo}
                </span>
                <span className="text-sm font-medium text-ink">{f.valor}</span>
              </div>
              <span className="text-xs font-semibold text-accent-deep">
                Editar
              </span>
            </button>
          ))}
        </div>
        {/* Notación */}
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Notación LSM-PN
          </p>
          <p className="mt-0.5 font-mono text-sm text-ink">
            {notacion || "—"}
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-3">
        {!saved ? (
          <button
            onClick={onSave}
            className="rounded-full bg-green px-8 py-3 font-semibold text-white transition-colors hover:bg-green-deep"
          >
            Guardar anotación
          </button>
        ) : (
          <>
            <button
              onClick={onExport}
              className="rounded-full border-[1.5px] border-ink px-6 py-3 font-semibold text-ink transition-colors hover:bg-gray-50"
            >
              Exportar JSON
            </button>
            <button
              onClick={onNew}
              className="rounded-full bg-ink px-6 py-3 font-semibold text-paper transition-colors hover:bg-gray-800"
            >
              Anotar otra seña
            </button>
          </>
        )}
        <Link
          href="/annotate"
          className="text-sm font-medium text-gray-500 hover:text-ink hover:underline"
        >
          Abrir en modo experto
        </Link>
      </div>
    </div>
  );
}
