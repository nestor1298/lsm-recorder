"use client";

/**
 * campos — piezas de formulario del camino de unirse: campo con etiqueta,
 * botones segmentados (una sola opción) y mensajes de error.
 */

import type { ReactNode } from "react";

export const claseInput =
  "w-full rounded-lg border border-gray-300 bg-paper px-3 py-2.5 text-base text-ink placeholder:text-gray-400 focus:border-accent focus:outline-none";

export function Campo({
  etiqueta,
  pista,
  children,
  htmlFor,
}: {
  etiqueta: string;
  pista?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {etiqueta}
      </label>
      {children}
      {pista && <p className="mt-1.5 text-xs text-gray-500">{pista}</p>}
    </div>
  );
}

export function Segmento<T extends string>({
  etiqueta,
  valor,
  opciones,
  onChange,
  pista,
}: {
  etiqueta: string;
  valor: T | "";
  opciones: { value: T; label: string }[];
  onChange: (v: T) => void;
  pista?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta}>
      <p className="mb-1.5 text-sm font-semibold text-ink">{etiqueta}</p>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const activa = valor === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={activa}
              onClick={() => onChange(o.value)}
              className={`rounded-full border-[1.5px] px-4 py-2 text-sm font-medium transition-colors ${
                activa
                  ? "border-ink bg-ink text-paper"
                  : "border-gray-300 bg-paper text-gray-700 hover:border-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {pista && <p className="mt-1.5 text-xs text-gray-500">{pista}</p>}
    </div>
  );
}

export function ErrorForm({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-coral-tint px-4 py-3 text-sm text-coral-deep">
      {children}
    </p>
  );
}

export function BotonPrincipal({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="rounded-full bg-ink px-7 py-3 font-semibold text-paper transition-colors hover:bg-gray-800 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
