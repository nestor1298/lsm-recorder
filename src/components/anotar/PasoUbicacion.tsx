"use client";

import { useMemo, useState } from "react";
import {
  UB_LOCATIONS,
  FREQUENT_LOCATIONS,
  REGION_COLORS,
  REGION_LABELS,
  type BodyZone,
} from "@/lib/ub_inventory";
import { BodyOutline } from "@/components/BodySilhouette";
import { CONTACT_ES, LATERALITY_ES } from "@/lib/anotar_labels";
import type { ContactType, Laterality } from "@/lib/types";

/**
 * Paso 3 — marcar dónde se hace la seña.
 * Toca la silueta (con zoom por zonas) o elige un punto frecuente.
 * El contacto se pregunta en 3 opciones grandes; el detalle fino
 * queda en "Más opciones".
 */

const VIEWBOX: Record<BodyZone, string> = {
  full: "0 0 200 280",
  head: "60 5 80 80",
  trunk: "50 80 100 110",
  arm: "20 85 80 130",
  hand: "15 185 55 60",
};

const ZONE_REGIONS: Record<BodyZone, string[]> = {
  full: ["HEAD", "FACE", "NECK", "TRUNK", "ARM", "FOREARM", "HAND", "NEUTRAL_SPACE"],
  head: ["HEAD", "FACE", "NECK"],
  trunk: ["TRUNK", "NECK"],
  arm: ["ARM", "FOREARM"],
  hand: ["HAND"],
};

const ZONE_ES: Record<BodyZone, string> = {
  full: "Todo",
  head: "Cabeza",
  trunk: "Tronco",
  arm: "Brazo",
  hand: "Mano",
};

/** Las 3 respuestas rápidas a "¿la mano toca el cuerpo?" */
const CONTACT_SIMPLE: { value: ContactType; label: string; desc: string }[] = [
  { value: "TOUCHING", label: "Toca", desc: "La mano toca ese punto" },
  { value: "NEAR", label: "Cerca", desc: "Queda cerca, sin tocar" },
  { value: "DISTANT", label: "En el aire", desc: "Lejos, en el espacio" },
];

const CONTACT_ADVANCED: ContactType[] = ["GRASPED", "BRUSHING", "MEDIAL"];
const LATERALITIES: Laterality[] = ["IPSILATERAL", "CONTRALATERAL", "MIDLINE"];

interface PasoUbicacionProps {
  locationCode?: string;
  contact?: ContactType;
  laterality?: Laterality;
  onLocationChange: (code: string | undefined) => void;
  onContactChange: (contact: ContactType | undefined) => void;
  onLateralityChange: (laterality: Laterality | undefined) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function PasoUbicacion({
  locationCode,
  contact,
  laterality,
  onLocationChange,
  onContactChange,
  onLateralityChange,
  onNext,
  onBack,
}: PasoUbicacionProps) {
  const [zone, setZone] = useState<BodyZone>("full");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selected = useMemo(
    () => UB_LOCATIONS.find((l) => l.code === locationCode) ?? null,
    [locationCode],
  );

  const visible = useMemo(() => {
    const regions = ZONE_REGIONS[zone];
    return UB_LOCATIONS.filter((l) => regions.includes(l.region));
  }, [zone]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">
          ¿Dónde se hace la seña?
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Toca el punto en el cuerpo. Puedes acercar por zona.
        </p>
      </div>

      {/* Zoom por zona */}
      <div className="flex items-center gap-2">
        {(Object.keys(ZONE_ES) as BodyZone[]).map((z) => (
          <button
            key={z}
            onClick={() => setZone(z)}
            aria-pressed={zone === z}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              zone === z
                ? "bg-ink text-paper"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {ZONE_ES[z]}
          </button>
        ))}
      </div>

      {/* Silueta */}
      <svg
        viewBox={VIEWBOX[zone]}
        className="w-full rounded-2xl border border-gray-200 bg-gray-50"
        style={{ maxHeight: 420 }}
      >
        <BodyOutline />
        {visible.map((loc) => {
          const isSelected = loc.code === locationCode;
          const color = REGION_COLORS[loc.region];
          const r = zone === "full" ? 4 : 5.5;
          return (
            <g key={loc.code}>
              {isSelected && (
                <circle
                  cx={loc.x}
                  cy={loc.y}
                  r={r + 4}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.5}
                >
                  <animate
                    attributeName="r"
                    values={`${r + 3};${r + 6};${r + 3}`}
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <circle
                cx={loc.x}
                cy={loc.y}
                r={isSelected ? r + 1.5 : r}
                fill={isSelected ? color : `${color}70`}
                stroke={isSelected ? "white" : color}
                strokeWidth={isSelected ? 1.5 : 0.8}
                className="cursor-pointer"
                onClick={() =>
                  onLocationChange(isSelected ? undefined : loc.code)
                }
              >
                <title>{loc.name}</title>
              </circle>
              {zone !== "full" && (
                <text
                  x={loc.x + r + 3}
                  y={loc.y + 1}
                  fontSize={zone === "hand" ? 3.2 : 4.5}
                  fill={isSelected ? color : "#6b7280"}
                  fontWeight={isSelected ? "bold" : "normal"}
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                >
                  {loc.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Frecuentes */}
      <div>
        <p className="mb-2 text-xs font-semibold text-gray-500">
          Los más comunes
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FREQUENT_LOCATIONS.map((loc) => {
            const isSelected = locationCode === loc.code;
            return (
              <button
                key={loc.code}
                onClick={() =>
                  onLocationChange(isSelected ? undefined : loc.code)
                }
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isSelected ? "text-white" : "text-gray-700 hover:text-ink"
                }`}
                style={{
                  backgroundColor: isSelected
                    ? REGION_COLORS[loc.region]
                    : `${REGION_COLORS[loc.region]}18`,
                }}
              >
                {loc.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Punto elegido */}
      {selected && (
        <div className="flex items-center gap-3 rounded-xl border border-green bg-green-tint/40 p-3">
          <span
            className="h-4 w-4 shrink-0 rounded-full"
            style={{ backgroundColor: REGION_COLORS[selected.region] }}
          />
          <div>
            <p className="text-sm font-bold text-ink">
              {selected.name}{" "}
              <span className="font-mono text-xs text-gray-500">
                ({selected.code})
              </span>
            </p>
            <p className="text-xs text-gray-600">
              {REGION_LABELS[selected.region]}
            </p>
          </div>
        </div>
      )}

      {/* Contacto: 3 opciones grandes */}
      {selected && (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">
            ¿La mano toca ese punto?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {CONTACT_SIMPLE.map((opt) => {
              const isSelected = contact === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() =>
                    onContactChange(isSelected ? undefined : opt.value)
                  }
                  aria-pressed={isSelected}
                  className={`rounded-xl border-2 p-3 text-center transition-colors ${
                    isSelected
                      ? "border-accent bg-accent-tint"
                      : "border-gray-200 bg-paper hover:border-gray-300"
                  }`}
                >
                  <p className="font-bold text-ink">{opt.label}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-gray-500">
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Más opciones */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="mt-3 text-xs font-semibold text-accent-deep hover:underline"
          >
            {showAdvanced ? "Menos opciones" : "Más opciones"}
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-3 rounded-xl bg-gray-50 p-3">
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  Otro tipo de contacto
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {CONTACT_ADVANCED.map((ct) => (
                    <button
                      key={ct}
                      onClick={() =>
                        onContactChange(contact === ct ? undefined : ct)
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        contact === ct
                          ? "bg-ink text-white"
                          : "bg-white text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {CONTACT_ES[ct]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  ¿De qué lado?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {LATERALITIES.map((lat) => (
                    <button
                      key={lat}
                      onClick={() =>
                        onLateralityChange(laterality === lat ? undefined : lat)
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        laterality === lat
                          ? "bg-ink text-white"
                          : "bg-white text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {LATERALITY_ES[lat]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between border-t border-gray-100 pt-4">
        <button
          onClick={onBack}
          className="rounded-full px-6 py-3 font-semibold text-gray-600 hover:bg-gray-50"
        >
          Atrás
        </button>
        <button
          onClick={onNext}
          disabled={!selected}
          className="rounded-full bg-ink px-8 py-3 font-semibold text-paper transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
