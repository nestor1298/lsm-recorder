"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startEmailOtp,
  confirmEmailOtp,
  currentUserId,
  signOut,
} from "@/lib/auth-client";
import { fetchMe, type MeResponse } from "@/lib/api-client";

type Phase = "checking" | "email" | "code" | "session_error";

export default function AuthPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const routeByProfile = useCallback(
    (me: MeResponse) => {
      if (me.consentStatus !== "granted") router.push("/consentimiento");
      else if (!me.hasMetadata) router.push("/perfil");
      else router.push("/record");
    },
    [router],
  );

  // Already signed in? Route forward instead of showing the email form —
  // trying to signIn again would throw "There is already a signed in user".
  useEffect(() => {
    let active = true;
    void (async () => {
      const uid = await currentUserId();
      if (!active) return;
      if (!uid) {
        setPhase("email");
        return;
      }
      try {
        const me = await fetchMe();
        if (active) routeByProfile(me);
      } catch (err) {
        // Signed in but the profile call failed (server/config issue):
        // dead-ending on the email form would loop. Surface it instead.
        if (active) {
          setPhase("session_error");
          setError(
            err instanceof Error ? err.message : "No se pudo cargar tu perfil.",
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [routeByProfile]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await startEmailOtp(email.trim().toLowerCase());
      setPhase("code");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo enviar el código. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await confirmEmailOtp(code.trim());
      // Route to wherever the participant needs to go next.
      routeByProfile(await fetchMe());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Código incorrecto o expirado.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Acceso</h1>
        <p className="text-sm text-gray-500">
          Te enviamos un código por correo. No usamos contraseñas.
        </p>
      </div>

      {phase === "checking" && (
        <p className="py-6 text-center text-sm text-gray-500">
          Verificando tu sesión...
        </p>
      )}

      {phase === "session_error" && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">
            Tu sesión está activa, pero no se pudo cargar tu perfil.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Reintentar
            </button>
            <button
              onClick={async () => {
                await signOut();
                setError(null);
                setPhase("email");
              }}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {phase === "email" && (
        <form
          onSubmit={handleSendCode}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Enviando..." : "Enviar código"}
          </button>
        </form>
      )}

      {phase === "code" && (
        <form
          onSubmit={handleConfirm}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Código de {email}
            </label>
            <input
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Verificando..." : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPhase("email");
              setCode("");
              setError(null);
            }}
            className="w-full rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Usar otro correo
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
