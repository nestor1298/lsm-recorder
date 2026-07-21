"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CM_INVENTORY, getCMsByTier } from "@/lib/data";
import { getSessions } from "@/lib/store";
import type { RecordingSession } from "@/lib/types";

export default function Dashboard() {
  const [sessions, setSessions] = useState<RecordingSession[]>([]);

  useEffect(() => {
    setSessions(getSessions());
  }, []);

  const tierCounts = [1, 2, 3, 4].map(
    (t) => getCMsByTier(t as 1 | 2 | 3 | 4).length,
  );

  const totalRecorded = sessions.reduce(
    (acc, s) =>
      acc + s.signs.filter((sign) => sign.status !== "pending").length,
    0,
  );

  return (
    <div className="space-y-10">
      {/* Hero: tinta plana, voz de misión */}
      <div className="rounded-2xl bg-ink p-10 text-paper">
        <p className="overline-label text-gray-400">Corpus de LSM</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-[-0.02em]">
          Tu lengua, documentada contigo.
        </h1>
        <p className="mt-3 max-w-xl text-lg text-gray-300">
          SignaLab graba y anota un corpus de Lengua de Señas Mexicana — las
          101 configuraciones de mano de Cruz Aldrete — junto con la comunidad
          sorda.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/record"
            className="rounded-full bg-paper px-7 py-3 font-semibold text-ink transition-colors hover:bg-gray-100"
          >
            Empezar a grabar
          </Link>
          <Link
            href="/catalog"
            className="rounded-full border-[1.5px] border-paper/40 px-7 py-3 font-semibold text-paper transition-colors hover:bg-paper/10"
          >
            Explorar el catálogo
          </Link>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Configuraciones de mano"
          value={CM_INVENTORY.length}
          color="text-ink"
        />
        <StatCard
          label="Señas grabadas"
          value={totalRecorded}
          color="text-green-deep"
        />
        <StatCard
          label="Sesiones"
          value={sessions.length}
          color="text-accent-deep"
        />
        <StatCard
          label="Avance"
          value={`${CM_INVENTORY.length > 0 ? Math.round((totalRecorded / CM_INVENTORY.length) * 100) : 0}%`}
          color="text-gold-deep"
        />
      </div>

      {/* Inventario por frecuencia */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-ink">
          Inventario por nivel de frecuencia
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { tier: 1, label: "Frecuencia alta", color: "bg-green" },
            { tier: 2, label: "Frecuencia media", color: "bg-accent" },
            { tier: 3, label: "Frecuencia baja", color: "bg-gold" },
            { tier: 4, label: "Poco frecuentes", color: "bg-coral" },
          ].map(({ tier, label, color }, i) => (
            <div
              key={tier}
              className="rounded-2xl border border-gray-200 bg-paper p-4 shadow-card"
            >
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${color}`} />
                <span className="text-sm font-medium text-gray-600">
                  Nivel {tier}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold text-ink">
                {tierCounts[i]}
              </p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sesiones recientes */}
      {sessions.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-bold text-ink">
            Sesiones recientes
          </h2>
          <div className="space-y-3">
            {sessions
              .slice(-5)
              .reverse()
              .map((session) => {
                const recorded = session.signs.filter(
                  (s) => s.status !== "pending",
                ).length;
                return (
                  <Link
                    key={session.id}
                    href={`/record?session=${session.id}`}
                    className="flex items-center justify-between rounded-2xl border border-gray-200 bg-paper p-4 shadow-card transition-colors hover:border-ink"
                  >
                    <div>
                      <p className="font-semibold text-ink">{session.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-accent-deep">
                        {recorded}/{session.signs.length}
                      </p>
                      <p className="text-xs text-gray-500">grabadas</p>
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-paper p-4 shadow-card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
