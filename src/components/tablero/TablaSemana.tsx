"use client";

/**
 * TablaSemana — el tablero de la semana: puesto, apodo, videos y nivel.
 * Solo apodos. Se usa completo en /tablero y compacto en el descanso del
 * estudio.
 */

import { useEffect, useState } from "react";
import { fetchTablero, type TableroResponse } from "@/lib/api-client";
import { MEDALLAS } from "@/lib/progresion";

export default function TablaSemana({
  semana,
  compacta = false,
  onDatos,
}: {
  semana?: string;
  compacta?: boolean;
  onDatos?: (t: TableroResponse) => void;
}) {
  const [datos, setDatos] = useState<TableroResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    fetchTablero(semana)
      .then((t) => {
        if (!activo) return;
        setDatos(t);
        onDatos?.(t);
      })
      .catch((err) => {
        if (activo) setError(err instanceof Error ? err.message : "No se pudo cargar el tablero.");
      });
    return () => {
      activo = false;
    };
  }, [semana, onDatos]);

  if (error) return <p className="text-sm text-coral-deep">{error}</p>;
  if (!datos) return <p className="text-sm text-gray-500">Cargando el tablero...</p>;

  const filas = compacta ? datos.filas.slice(0, 5) : datos.filas;
  if (filas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        Nadie ha grabado todavía esta semana. El primer video pone tu apodo aquí.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Tablero de la semana {datos.semana}</caption>
      <thead>
        <tr className="text-left text-xs text-gray-500">
          <th scope="col" className="py-1 pr-2 font-medium">#</th>
          <th scope="col" className="py-1 pr-2 font-medium">Apodo</th>
          <th scope="col" className="py-1 pr-2 text-right font-medium">Videos</th>
          {!compacta && (
            <th scope="col" className="py-1 text-right font-medium">Nivel</th>
          )}
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          const medalla = MEDALLAS.find((m) => m.id === f.medalla);
          return (
            <tr
              key={f.puesto}
              className={`border-t border-gray-100 ${f.eresTu ? "bg-accent-tint font-semibold" : ""}`}
            >
              <td className="py-2 pr-2 tabular-nums text-gray-500">{f.puesto}</td>
              <td className="py-2 pr-2">
                <span className="flex items-center gap-2">
                  <span className="truncate text-ink">{f.apodo}</span>
                  {f.eresTu && <span className="text-xs text-accent-deep">tú</span>}
                  {medalla && (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${medalla.clase}`}>
                      {medalla.nombre}
                    </span>
                  )}
                </span>
              </td>
              <td className="py-2 pr-2 text-right tabular-nums text-ink">{f.videos}</td>
              {!compacta && <td className="py-2 text-right tabular-nums text-gray-600">{f.nivel}</td>}
            </tr>
          );
        })}
      </tbody>
      {datos.tu && !datos.filas.some((f) => f.eresTu) && (
        <tfoot>
          <tr className="border-t border-gray-200 bg-accent-tint font-semibold">
            <td className="py-2 pr-2 tabular-nums text-gray-500">{datos.tu.puesto}</td>
            <td className="py-2 pr-2 text-ink">Tú</td>
            <td className="py-2 pr-2 text-right tabular-nums">{datos.tu.videos}</td>
            {!compacta && <td className="py-2 text-right tabular-nums">{datos.tu.nivel}</td>}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
