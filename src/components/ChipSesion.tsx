"use client";

/**
 * ChipSesion — la esquina derecha del encabezado: «Entrar» si no hay
 * sesión; con sesión, el apodo y el nivel (enlace a la tarjeta de señante)
 * o «Elige tu apodo» si todavía falta.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { fetchMe, type MeResponse } from "@/lib/api-client";
import { pasoPendiente, rutaUnirse } from "@/lib/camino";
import { MEDALLAS } from "@/lib/progresion";

export default function ChipSesion() {
  const { state } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (state !== "signedIn") {
      setMe(null);
      return;
    }
    let activo = true;
    fetchMe()
      .then((m) => {
        if (activo) setMe(m);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [state]);

  if (state === "loading") return <span className="h-9 w-20" aria-hidden />;

  if (state === "signedOut") {
    return (
      <Link
        href="/auth"
        className="rounded-full border-[1.5px] border-ink px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-gray-50"
      >
        Entrar
      </Link>
    );
  }

  if (!me) return <span className="h-9 w-20" aria-hidden />;

  const paso = pasoPendiente(me);
  if (paso) {
    return (
      <Link
        href={rutaUnirse(paso)}
        className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper transition-colors hover:bg-gray-800"
      >
        {paso === 1 ? "Elige tu apodo" : "Terminar de unirme"}
      </Link>
    );
  }

  const medalla = MEDALLAS.find((m) => m.id === me.medalla);
  return (
    <Link
      href="/tarjeta"
      className="flex items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 text-sm transition-colors hover:border-ink"
      title="Tu tarjeta de señante"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-xs font-bold ${
          medalla ? medalla.clase : "bg-gray-100 text-gray-700"
        }`}
        aria-hidden
      >
        {me.nivel ?? 0}
      </span>
      <span className="max-w-[9rem] truncate font-semibold text-ink">{me.apodo}</span>
      <span className="hidden text-gray-500 sm:inline">Nivel {me.nivel ?? 0}</span>
    </Link>
  );
}
