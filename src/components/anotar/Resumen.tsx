"use client";

import { useMemo, useState } from "react";
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
  PALM_ES,
  FINGER_ES,
  RELATION_ES,
  REPETITION_ES,
  directionLabel,
} from "@/lib/anotar_labels";
import type { GuidedDraft, ExtremoDMD } from "@/lib/anotar_draft";
import { esquemaDMD } from "@/lib/anotar_draft";
import type { PasoId } from "@/lib/anotar_draft";
import {
  SelectorUBCompacto,
  SelectorCMCompacto,
} from "./selectores_compactos";

/**
 * Paso 5 — resumen. Todo lo elegido en una tarjeta, con la notación
 * LSM-PN compacta, listo para guardar o corregir cualquier paso.
 */

interface ResumenProps {
  draft: GuidedDraft;
  saved: boolean;
  onEdit: (paso: PasoId) => void;
  onDraftChange: (changes: Partial<GuidedDraft>) => void;
  onSave: () => void;
  onExport: () => void;
  onNew: () => void;
}

/** Captura compacta de un extremo D (inicio o final) */
function ExtremoEditor({
  titulo,
  value,
  onChange,
}: {
  titulo: string;
  value?: ExtremoDMD;
  onChange: (v: ExtremoDMD | undefined) => void;
}) {
  const [showCM, setShowCM] = useState(Boolean(value?.cm_id));
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-paper p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {titulo}
        </p>
        <button
          onClick={() => onChange(undefined)}
          className="text-xs text-gray-400 hover:text-coral-deep"
        >
          Quitar
        </button>
      </div>
      <SelectorUBCompacto
        value={value?.location_code}
        onChange={(location_code) => onChange({ ...value, location_code })}
      />
      <button
        onClick={() => setShowCM(!showCM)}
        className="text-xs font-semibold text-accent-deep hover:underline"
      >
        {showCM ? "La forma no cambia" : "¿También cambia la forma de la mano?"}
      </button>
      {showCM && (
        <SelectorCMCompacto
          value={value?.cm_id}
          onChange={(cm_id) => onChange({ ...value, cm_id })}
        />
      )}
    </div>
  );
}

export default function Resumen({
  draft,
  saved,
  onEdit,
  onDraftChange,
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
    direction: draft.direction,
    repetition: draft.repetition,
    palmFacing: draft.palm_facing,
    fingerPointing: draft.finger_pointing,
    esquema: esquemaDMD(draft),
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
      paso: "orientacion" as PasoId,
      titulo: "Palma",
      valor:
        [
          draft.palm_facing && PALM_ES[draft.palm_facing],
          draft.finger_pointing && FINGER_ES[draft.finger_pointing],
        ]
          .filter(Boolean)
          .join(" · ") || "—",
    },
    {
      paso: "movimiento",
      titulo: "Movimiento",
      valor:
        [
          draft.contour && CONTOUR_ES[draft.contour],
          draft.direction && directionLabel(draft.direction),
          draft.repetition &&
            `se repite ×${draft.repetition.count} (${REPETITION_ES[draft.repetition.type].toLowerCase()})`,
          draft.local && LOCAL_ES[draft.local],
          draft.plane && PLANE_ES[draft.plane],
        ]
          .filter(Boolean)
          .join(" · ") || "Se queda quieta",
    },
    ...(draft.nondominant
      ? [
          {
            paso: "cm" as PasoId,
            titulo: "Dos manos",
            valor: `${RELATION_ES[draft.nondominant.relation]}${
              draft.nondominant.relation === "BASE_PASIVA"
                ? draft.nondominant.cm_id
                  ? ` · CM base #${draft.nondominant.cm_id}`
                  : " · CM base pendiente"
                : ""
            }`,
          },
        ]
      : []),
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
              key={f.titulo}
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
            Notación LSM-PN · esquema {esquemaDMD(draft)}
          </p>
          <p className="mt-0.5 font-mono text-sm text-ink">
            {notacion || "—"}
          </p>
        </div>
      </div>

      {/* Validación suave (restricciones de Cruz Aldrete) */}
      {draft.local === "TWIST" && draft.contour && (
        <p className="rounded-lg bg-gold-tint px-4 py-2.5 text-xs text-gold-deep">
          Combinación poco habitual en LSM: la rotación de muñeca no suele
          coarticularse con un movimiento de contorno.
        </p>
      )}

      {/* Segmentación ligera D-M-D */}
      {!saved && (
        <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
          <p className="text-sm font-semibold text-ink">
            ¿La seña empieza o termina en otro lugar o con otra forma?
          </p>
          <div className="flex flex-wrap gap-2">
            {!draft.inicio && (
              <button
                onClick={() => onDraftChange({ inicio: {} })}
                className="rounded-full border-[1.5px] border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-ink"
              >
                Marcar inicio distinto
              </button>
            )}
            {!draft.fin && (
              <button
                onClick={() => onDraftChange({ fin: {} })}
                className="rounded-full border-[1.5px] border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-ink"
              >
                Marcar final distinto
              </button>
            )}
          </div>
          {draft.inicio && (
            <ExtremoEditor
              titulo="Inicio de la seña"
              value={draft.inicio}
              onChange={(inicio) => onDraftChange({ inicio })}
            />
          )}
          {draft.fin && (
            <ExtremoEditor
              titulo="Final de la seña"
              value={draft.fin}
              onChange={(fin) => onDraftChange({ fin })}
            />
          )}
        </div>
      )}

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
