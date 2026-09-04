"use client";

/**
 * Formulario del modo experto: un acordeón por canal fonológico que
 * reusa los editores visuales del flujo guiado (EditorCM,
 * EditorUbicacion, EditorOrientacion, EditorMovimiento, EditorRostro).
 * Al tocar una celda en TimelineCanales, el canal correspondiente se
 * abre aquí.
 */

import { useEffect, useState } from "react";
import type { PSHRSegment, HeadMovement } from "@/lib/types";
import { UB_LOCATIONS } from "@/lib/ub_inventory";
import { CM_INVENTORY } from "@/lib/data";
import { PALM_ES, FINGER_ES, CONTOUR_ES } from "@/lib/anotar_labels";
import { EditorCM } from "@/components/anotar/PasoCM";
import { EditorUbicacion } from "@/components/anotar/PasoUbicacion";
import { EditorOrientacion } from "@/components/anotar/PasoOrientacion";
import {
  EditorMovimiento,
  EditorRostro,
} from "@/components/anotar/PasoMovimiento";

const HEAD_ES: Record<HeadMovement, string> = {
  NONE: "Quieta",
  NOD: "Asiente",
  SHAKE: "Niega",
  TILT_LEFT: "Inclinada izq.",
  TILT_RIGHT: "Inclinada der.",
  TILT_BACK: "Atrás",
  TILT_DOWN: "Abajo",
};

export type CanalId = "mano" | "lugar" | "palma" | "movimiento" | "rostro";

const CANAL_LABELS: Record<CanalId, string> = {
  mano: "Mano (CM)",
  lugar: "Lugar (UB)",
  palma: "Palma (OR)",
  movimiento: "Movimiento (MV)",
  rostro: "Rostro (RNM)",
};

interface AnnotationFormProps {
  segment: PSHRSegment;
  onUpdate: (updates: Partial<PSHRSegment>) => void;
  /** canal a abrir (desde TimelineCanales) */
  focusChannel?: CanalId | null;
}

export default function AnnotationForm({
  segment,
  onUpdate,
  focusChannel,
}: AnnotationFormProps) {
  const [open, setOpen] = useState<CanalId>("mano");
  useEffect(() => {
    if (focusChannel) setOpen(focusChannel);
  }, [focusChannel]);

  const isMovement = segment.type === "M" || segment.phase === "STROKE";

  const seccion = (id: CanalId, resumen: string, children: React.ReactNode) => {
    const isOpen = open === id;
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <button
          onClick={() => setOpen(id)}
          aria-expanded={isOpen}
          className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${
            isOpen ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-gray-50"
          }`}
        >
          <span className="text-sm font-semibold">{CANAL_LABELS[id]}</span>
          <span
            className={`max-w-[50%] truncate text-xs ${
              isOpen ? "text-gray-300" : "text-gray-500"
            }`}
          >
            {resumen}
          </span>
        </button>
        {isOpen && <div className="bg-paper p-4">{children}</div>}
      </div>
    );
  };

  const cmActual = CM_INVENTORY.find((c) => c.cm_id === segment.cm_id);

  return (
    <div className="space-y-2">
      {seccion(
        "mano",
        cmActual
          ? `#${cmActual.cm_id} · ${cmActual.cruz_aldrete_notation}`
          : "Sin CM",
        <div className="space-y-4">
          <EditorCM
            selectedCmId={segment.cm_id}
            onSelect={(cm) => onUpdate({ cm_id: cm.cm_id })}
          />
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
              CM final (osc-CM / cambios progresivos)
            </label>
            <select
              value={segment.end_cm_id ?? ""}
              onChange={(e) =>
                onUpdate({
                  end_cm_id: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className="w-full rounded border border-gray-200 bg-paper px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Sin cambio de forma</option>
              {CM_INVENTORY.map((cm) => (
                <option key={cm.cm_id} value={cm.cm_id}>
                  #{cm.cm_id} · {cm.cruz_aldrete_notation}
                </option>
              ))}
            </select>
          </div>
        </div>,
      )}

      {seccion(
        "lugar",
        segment.location_code
          ? `${segment.location ?? segment.location_code}`
          : "Sin lugar",
        <EditorUbicacion
          locationCode={segment.location_code}
          contact={segment.contact}
          laterality={segment.laterality}
          onLocationChange={(code) => {
            const loc = code
              ? UB_LOCATIONS.find((l) => l.code === code)
              : undefined;
            onUpdate({
              location_code: code,
              location: loc?.name,
              body_region: loc?.region,
            });
          }}
          onContactChange={(v) => onUpdate({ contact: v })}
          onLateralityChange={(v) => onUpdate({ laterality: v })}
        />,
      )}

      {seccion(
        "palma",
        [
          segment.palm_facing && PALM_ES[segment.palm_facing],
          segment.finger_pointing && FINGER_ES[segment.finger_pointing],
        ]
          .filter(Boolean)
          .join(" · ") || "Sin orientación",
        <EditorOrientacion
          palmFacing={segment.palm_facing}
          fingerPointing={segment.finger_pointing}
          forearmRotation={segment.forearm_rotation}
          onPalmChange={(v) => onUpdate({ palm_facing: v })}
          onFingerChange={(v) => onUpdate({ finger_pointing: v })}
          onForearmChange={(v) => onUpdate({ forearm_rotation: v })}
        />,
      )}

      {seccion(
        "movimiento",
        (segment.contour_movement && CONTOUR_ES[segment.contour_movement]) ??
          (isMovement ? "Sin contorno" : "Detención"),
        isMovement ? (
          <EditorMovimiento
            contour={segment.contour_movement}
            local={segment.local_movement}
            plane={segment.movement_plane}
            direction={segment.direction}
            repetition={segment.repetition}
            onContourChange={(v) => onUpdate({ contour_movement: v })}
            onLocalChange={(v) => onUpdate({ local_movement: v })}
            onPlaneChange={(v) => onUpdate({ movement_plane: v })}
            onDirectionChange={(v) => onUpdate({ direction: v })}
            onRepetitionChange={(v) => onUpdate({ repetition: v })}
          />
        ) : (
          <p className="text-xs text-gray-500">
            Este segmento es una detención (D): no lleva movimiento. Cambia
            su tipo en la línea de tiempo si corresponde.
          </p>
        ),
      )}

      {seccion(
        "rostro",
        [
          segment.eyebrows && segment.eyebrows !== "NEUTRAL" ? "cejas" : null,
          segment.mouth && segment.mouth !== "NEUTRAL" ? "boca" : null,
          segment.head_movement && segment.head_movement !== "NONE"
            ? "cabeza"
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Neutral",
        <div className="space-y-3">
          <EditorRostro
            eyebrows={segment.eyebrows}
            mouth={segment.mouth}
            onEyebrowsChange={(v) => onUpdate({ eyebrows: v })}
            onMouthChange={(v) => onUpdate({ mouth: v })}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Cabeza
            </span>
            {(Object.keys(HEAD_ES) as HeadMovement[]).map((v) => (
              <button
                key={v}
                onClick={() =>
                  onUpdate({
                    head_movement: segment.head_movement === v ? undefined : v,
                  })
                }
                aria-pressed={segment.head_movement === v}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  segment.head_movement === v
                    ? "bg-ink text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {HEAD_ES[v]}
              </button>
            ))}
          </div>
        </div>,
      )}
    </div>
  );
}
