"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getJson, postJson } from "@/lib/api-client";
import { ACCESS_TIERS } from "@/lib/tiers";
import type { AccessTier } from "@/lib/aws/keys";

interface RecordingRow {
  id: string;
  cmId: number;
  recordedAt: string;
  durationMs: number;
  status: string;
  accessTier: AccessTier;
  withdrawn: boolean;
}

export default function MisGrabacionesPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  useEffect(() => {
    if (state === "signedOut") router.replace("/auth");
  }, [state, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getJson<{ recordings: RecordingRow[] }>(
        "/api/recordings",
      );
      setRows(data.recordings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state === "signedIn") void load();
  }, [state, load]);

  async function changeTier(id: string, tier: AccessTier) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, accessTier: tier } : r)),
    );
    try {
      await postJson(`/api/recordings/${id}/tier`, { tier });
    } catch {
      void load(); // revert to server truth on failure
    }
  }

  async function withdrawOne(id: string) {
    try {
      await postJson(`/api/recordings/${id}/withdraw`, {});
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, withdrawn: true } : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function withdrawAll() {
    if (
      !window.confirm(
        "¿Retirar todo tu consentimiento? Se bloqueará la grabación hasta que vuelvas a otorgarlo.",
      )
    ) {
      return;
    }
    try {
      await postJson("/api/consent/withdraw-all", {});
      router.push("/consentimiento");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function play(id: string) {
    setPlayUrl(null);
    try {
      const { url } = await getJson<{ url: string }>(
        `/api/recordings/${id}/url`,
      );
      setPlayUrl(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al obtener el video",
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Mis grabaciones</h1>
          <p className="text-sm text-gray-500">
            Cambia el nivel de acceso o retira cualquier video cuando quieras.
          </p>
        </div>
        <Link
          href="/record"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Grabar
        </Link>
      </div>

      {playUrl && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
          <video
            src={playUrl}
            controls
            autoPlay
            className="aspect-video w-full"
          />
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-gray-500">Cargando...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
          Todavía no tienes grabaciones sincronizadas.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                r.withdrawn
                  ? "border-gray-200 bg-gray-50 opacity-70"
                  : "border-gray-200 bg-paper"
              }`}
            >
              <div>
                <p className="font-semibold text-ink">Seña #{r.cmId}</p>
                <p className="text-xs text-gray-500">
                  {new Date(r.recordedAt).toLocaleString()}
                </p>
                {r.withdrawn && (
                  <p className="mt-1 text-xs text-gold-deep">
                    Retirada. Se elimina del corpus en el siguiente ciclo de
                    procesamiento.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={r.accessTier}
                  disabled={r.withdrawn}
                  onChange={(e) =>
                    changeTier(r.id, e.target.value as AccessTier)
                  }
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
                >
                  {ACCESS_TIERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => play(r.id)}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Ver
                </button>
                {!r.withdrawn && (
                  <button
                    onClick={() => withdrawOne(r.id)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-coral-deep hover:bg-coral-tint"
                  >
                    Retirar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-coral-tint px-4 py-3 text-sm text-coral-deep">
          {error}
        </p>
      )}

      <div className="border-t border-gray-200 pt-6">
        <button
          onClick={withdrawAll}
          className="rounded-full border border-coral px-4 py-2.5 text-sm font-medium text-coral-deep hover:bg-coral-tint"
        >
          Retirar todo mi consentimiento
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Esto bloquea nuevas grabaciones hasta que vuelvas a otorgar tu
          consentimiento.
        </p>
      </div>
    </div>
  );
}
