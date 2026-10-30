"use client";

/**
 * PasoApodo — el nombre con el que apareces en la comunidad. Nunca el real.
 */

import { useState } from "react";
import { postJson } from "@/lib/api-client";
import { avisarCambioDeMe } from "@/components/ChipSesion";
import { sugerirApodo, validarApodo, APODO_MAX } from "@/lib/apodos";
import { BotonPrincipal, Campo, claseInput, ErrorForm } from "./campos";

export default function PasoApodo({
  actual,
  onListo,
}: {
  actual?: string | null;
  onListo: (apodo: string) => void;
}) {
  const [apodo, setApodo] = useState(actual ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const invalido = validarApodo(apodo);
    if (invalido) {
      setError(invalido);
      return;
    }
    setError(null);
    setOcupado(true);
    try {
      const r = await postJson<{ apodo: string }>("/api/apodo", { apodo });
      avisarCambioDeMe();
      onListo(r.apodo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el apodo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="aparece space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">
          Elige tu apodo
        </h1>
        <p className="mt-2 text-gray-600">
          Es tu nombre en los círculos de las señas que grabes y en tu tarjeta
          de señante. Nunca tu nombre real.
        </p>
      </div>
      <form onSubmit={guardar} className="space-y-5">
        <Campo etiqueta="Apodo" htmlFor="apodo" pista={`De 3 a ${APODO_MAX} caracteres.`}>
          <div className="flex gap-2">
            <input
              id="apodo"
              type="text"
              maxLength={APODO_MAX}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
              placeholder="Colibrí 42"
              className={claseInput}
            />
            <button
              type="button"
              onClick={() => {
                setApodo(sugerirApodo());
                setError(null);
              }}
              className="shrink-0 rounded-lg border-[1.5px] border-gray-300 px-4 text-sm font-semibold text-ink hover:border-ink"
            >
              Sugerir uno
            </button>
          </div>
        </Campo>
        <ErrorForm>{error}</ErrorForm>
        <BotonPrincipal disabled={ocupado || !apodo.trim()}>
          {ocupado ? "Guardando..." : "Continuar"}
        </BotonPrincipal>
      </form>
    </section>
  );
}
