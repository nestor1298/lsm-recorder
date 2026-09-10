"use client";

/**
 * ModoToggle — selector Explorar / Construir con la forma del
 * interruptor de modos de Claude: píldora gris con dos íconos y el
 * elegido elevado en blanco. Íconos: persona (explorar el cuerpo que
 * seña) y bloques (tres de base y uno encima: la matriz segmental que
 * se construye pieza por pieza).
 */

import { APRENDER_ES } from "@/lib/learn_labels";

export type Modo = "explorar" | "construir";

function IconoPersona() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <circle cx="12" cy="4.6" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.2v6.6M12 13.8l-3.4 6M12 13.8l3.4 6M6.2 9.6l5.8 1.2 5.8-1.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoBloques() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      {/* tres bloques de base: D M D */}
      <rect x="2.5" y="13" width="5.6" height="5.6" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="9.2" y="13" width="5.6" height="5.6" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="15.9" y="13" width="5.6" height="5.6" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
      {/* y uno encima: la capa que se agrega */}
      <rect x="9.2" y="5.4" width="5.6" height="5.6" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export default function ModoToggle({
  modo,
  onChange,
}: {
  modo: Modo;
  onChange: (m: Modo) => void;
}) {
  const opciones: { id: Modo; label: string; icono: React.ReactNode }[] = [
    { id: "explorar", label: APRENDER_ES.modoExplorar, icono: <IconoPersona /> },
    { id: "construir", label: APRENDER_ES.modoConstruir, icono: <IconoBloques /> },
  ];
  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Modo"
        className="inline-flex rounded-2xl bg-gray-100 p-1"
      >
        {opciones.map((o) => {
          const activo = modo === o.id;
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={activo}
              aria-label={o.label}
              title={o.label}
              onClick={() => onChange(o.id)}
              className={`flex h-10 w-14 items-center justify-center rounded-xl transition-all ${
                activo
                  ? "bg-paper text-ink shadow-card"
                  : "text-gray-500 hover:text-ink"
              }`}
            >
              {o.icono}
            </button>
          );
        })}
      </div>
      <span className="text-sm font-semibold text-ink">
        {modo === "explorar" ? APRENDER_ES.modoExplorar : APRENDER_ES.modoConstruir}
      </span>
    </div>
  );
}
