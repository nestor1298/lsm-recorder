"use client";

/**
 * PasoCorreo — entrar con el correo: mandamos un código, lo escribes y
 * listo. Sin contraseñas. El mismo paso sirve para volver a entrar.
 */

import { useState } from "react";
import { confirmEmailOtp, startEmailOtp } from "@/lib/auth-client";
import { BotonPrincipal, Campo, claseInput, ErrorForm } from "./campos";

export default function PasoCorreo({
  onEntro,
  titulo = "¿Quién eres?",
  texto = "Escribe tu correo y te mandamos un código. Otras personas nunca verán tu correo: solo tu apodo.",
}: {
  onEntro: () => void;
  titulo?: string;
  texto?: string;
}) {
  const [fase, setFase] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mandarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    try {
      await startEmailOtp(correo.trim().toLowerCase());
      setFase("codigo");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar el código. Intenta de nuevo.",
      );
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    try {
      await confirmEmailOtp(codigo.trim());
      onEntro();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código incorrecto o expirado.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="aparece space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">{titulo}</h1>
        <p className="mt-2 text-gray-600">{texto}</p>
      </div>

      {fase === "correo" ? (
        <form onSubmit={mandarCodigo} className="space-y-5">
          <Campo etiqueta="Correo electrónico" htmlFor="correo">
            <input
              id="correo"
              type="email"
              required
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu@correo.com"
              className={claseInput}
            />
          </Campo>
          <ErrorForm>{error}</ErrorForm>
          <BotonPrincipal disabled={ocupado || !correo.trim()}>
            {ocupado ? "Enviando..." : "Mandar el código"}
          </BotonPrincipal>
        </form>
      ) : (
        <form onSubmit={confirmar} className="space-y-5">
          <Campo
            etiqueta={`Código que llegó a ${correo}`}
            htmlFor="codigo"
            pista="Si no llega en un minuto, revisa la carpeta de correo no deseado."
          >
            <input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="123456"
              className={`${claseInput} text-center text-2xl tracking-[0.3em]`}
            />
          </Campo>
          <ErrorForm>{error}</ErrorForm>
          <div className="flex flex-wrap items-center gap-4">
            <BotonPrincipal disabled={ocupado || !codigo.trim()}>
              {ocupado ? "Verificando..." : "Entrar"}
            </BotonPrincipal>
            <button
              type="button"
              onClick={() => {
                setFase("correo");
                setCodigo("");
                setError(null);
              }}
              className="text-sm text-gray-500 underline-offset-4 hover:underline"
            >
              Usar otro correo
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
