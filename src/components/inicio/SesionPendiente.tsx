"use client";

/**
 * SesionPendiente — si en este navegador hay una sesión de grabación a
 * medias, Inicio ofrece retomarla. Lee localStorage, así que es cliente.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSessions } from "@/lib/store";
import type { RecordingSession } from "@/lib/types";
import { CORPUS_INFO } from "@/lib/corpus";
import { MarcaCorpus } from "@/components/grabar/TarjetaCorpus";

export default function SesionPendiente() {
  const [sesion, setSesion] = useState<RecordingSession | null>(null);

  useEffect(() => {
    const pendientes = getSessions().filter((s) =>
      s.signs.some((x) => x.status === "pending"),
    );
    setSesion(pendientes.at(-1) ?? null);
  }, []);

  if (!sesion) return null;
  const hechas = sesion.signs.filter((s) => s.status !== "pending").length;
  const corpus = sesion.corpus ?? "lsm";
  return (
    <Link
      href={`/record?session=${sesion.id}`}
      className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-paper p-4 shadow-card transition-colors hover:border-ink"
    >
      <MarcaCorpus corpus={corpus} className="w-12 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="overline-label text-gray-500">Tienes una sesión a medias</p>
        <p className="truncate font-semibold text-ink">{sesion.name}</p>
        <p className="text-sm text-gray-500">
          {CORPUS_INFO[corpus].nombre} · {hechas} de {sesion.signs.length} señas
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
        Continuar
      </span>
    </Link>
  );
}
