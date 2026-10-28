"use client";

/**
 * /tablero — el tablero de la semana completo, con el rango de fechas y
 * la semana anterior para comparar. Solo apodos.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { guardarVolverA } from "@/lib/volver_a";
import { inicioDeSemana, rangoDeSemana, semanaIso } from "@/lib/progresion";
import TablaSemana from "@/components/tablero/TablaSemana";

function semanaAnterior(semana: string): string | null {
  const lunes = inicioDeSemana(semana);
  if (!lunes) return null;
  lunes.setUTCDate(lunes.getUTCDate() - 7);
  return semanaIso(lunes);
}

export default function TableroPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [semana, setSemana] = useState(() => semanaIso(new Date()));
  const actual = semanaIso(new Date());

  useEffect(() => {
    if (state === "signedOut") {
      guardarVolverA("/tablero");
      router.replace("/unirse");
    }
  }, [state, router]);

  if (state !== "signedIn") {
    return <p className="py-12 text-center text-gray-500">Verificando acceso...</p>;
  }

  const anterior = semanaAnterior(semana);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="overline-label text-gray-500">Tablero de la semana</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
          {semana === actual ? "Esta semana" : rangoDeSemana(semana)}
        </h1>
        <p className="mt-2 text-gray-600">
          {rangoDeSemana(semana)}. Cuenta videos confirmados y no retirados. Solo apodos.
        </p>
      </div>

      <div className="flex gap-2">
        {anterior && (
          <button
            type="button"
            onClick={() => setSemana(anterior)}
            className="rounded-full border-[1.5px] border-gray-300 px-4 py-2 text-sm font-medium text-ink hover:border-ink"
          >
            ‹ Semana anterior
          </button>
        )}
        {semana !== actual && (
          <button
            type="button"
            onClick={() => setSemana(actual)}
            className="rounded-full border-[1.5px] border-gray-300 px-4 py-2 text-sm font-medium text-ink hover:border-ink"
          >
            Esta semana
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-paper p-5 shadow-card">
        <TablaSemana semana={semana} />
      </div>

      <p className="text-sm text-gray-500">
        <Link href="/listas" className="font-semibold text-ink underline-offset-4 hover:underline">
          Elegir una lista
        </Link>{" "}
        y subir en el tablero.
      </p>
    </div>
  );
}
