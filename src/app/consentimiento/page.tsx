"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CameraRecorder from "@/components/CameraRecorder";
import LSMVideoSlot from "@/components/LSMVideoSlot";
import { useAuth } from "@/hooks/useAuth";
import { postJson } from "@/lib/api-client";
import { ACCESS_TIERS } from "@/lib/tiers";
import type { AccessTier } from "@/lib/aws/keys";

type Step = 1 | 2 | 3 | 4;

export default function ConsentimientoPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [tier, setTier] = useState<AccessTier>("restringido");
  const [consentBlob, setConsentBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state === "signedOut") router.replace("/auth");
  }, [state, router]);

  async function uploadConsentVideo(blob: Blob): Promise<string> {
    const { url, key, contentType } = await postJson<{
      url: string;
      key: string;
      contentType: string;
    }>("/api/consent/presign", {});
    const put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    if (!put.ok) throw new Error("Falló la subida del consentimiento");
    return key;
  }

  async function grantWithVideo() {
    if (!consentBlob) return;
    setError(null);
    setBusy(true);
    try {
      const videoKey = await uploadConsentVideo(consentBlob);
      await postJson("/api/consent/grant", {
        mode: "video",
        videoKey,
        defaultTier: tier,
      });
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  async function grantTextOnly() {
    setError(null);
    setBusy(true);
    try {
      await postJson("/api/consent/grant", {
        mode: "text",
        defaultTier: tier,
      });
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <StepHeader step={step} />

      {step === 1 && (
        <section className="space-y-4">
          <LSMVideoSlot caption="Bienvenida a SignaLab" />
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenida a SignaLab
          </h1>
          <div className="space-y-3 text-gray-700">
            <p>
              SignaLab construye un corpus de Lengua de Señas Mexicana (LSM).
              Vas a grabar videos de señas con tu cámara para que el equipo
              pueda estudiarlas y documentarlas.
            </p>
            <p>
              En los videos se ve tu rostro y tus manos, porque son parte de la
              lengua. Tú decides quién puede ver cada video.
            </p>
            <p>
              Antes de grabar te pedimos tu consentimiento y unos datos
              básicos. Puedes cambiar de opinión cuando quieras.
            </p>
          </div>
          <NavButtons onNext={() => setStep(2)} />
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <LSMVideoSlot caption="Niveles de acceso" />
          <h1 className="text-2xl font-bold text-gray-900">Niveles de acceso</h1>
          <p className="text-gray-700">
            Elige quién puede ver tus videos de forma predeterminada. Cada video
            se puede cambiar individualmente después.
          </p>
          <div className="space-y-2">
            {ACCESS_TIERS.map((t) => (
              <label
                key={t.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                  tier === t.value
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="tier"
                  checked={tier === t.value}
                  onChange={() => setTier(t.value)}
                  className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <span className="block font-semibold text-gray-900">
                    {t.label}
                  </span>
                  <span className="block text-sm text-gray-600">
                    {t.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Tu rostro es parte de tu lengua. No podemos difuminarlo sin borrar
            lo que señas. Por eso tú decides quién ve cada video.
          </p>
          <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <LSMVideoSlot caption="Consentimiento en video" />
          <h1 className="text-2xl font-bold text-gray-900">
            Consentimiento en video
          </h1>
          <p className="text-gray-700">
            Graba un video corto en LSM confirmando lo siguiente:
          </p>
          <ul className="list-inside list-disc space-y-1 rounded-lg bg-gray-50 p-4 text-gray-700">
            <li>Tu nombre</li>
            <li>La fecha de hoy</li>
            <li>
              Que aceptas participar con el nivel de acceso{" "}
              <strong>{ACCESS_TIERS.find((t) => t.value === tier)?.label}</strong>
            </li>
          </ul>

          <CameraRecorder
            onRecordingComplete={(blob) => setConsentBlob(blob)}
          />

          {consentBlob && (
            <p className="text-sm text-green-700">
              Video listo para enviar ({Math.round(consentBlob.size / 1024)} KB).
            </p>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={grantWithVideo}
              disabled={!consentBlob || busy}
              className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {busy ? "Guardando..." : "Enviar consentimiento en video"}
            </button>
            <button
              onClick={grantTextOnly}
              disabled={busy}
              className="w-full rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Continuar solo con texto
            </button>
          </div>
          <button
            onClick={() => setStep(2)}
            className="text-sm text-gray-500 hover:underline"
          >
            Volver
          </button>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <LSMVideoSlot caption="Tus derechos" />
          <h1 className="text-2xl font-bold text-gray-900">Tus derechos</h1>
          <div className="space-y-3 text-gray-700">
            <p>
              Puedes ver, cambiar el nivel de acceso o retirar cualquier video
              en cualquier momento, sin dar explicaciones.
            </p>
            <p>
              Para hacerlo, entra a{" "}
              <Link
                href="/mis-grabaciones"
                className="font-medium text-indigo-600 hover:underline"
              >
                mis grabaciones
              </Link>
              .
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/perfil")}
              className="flex-1 rounded-lg bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Continuar
            </button>
            <Link
              href="/mis-grabaciones"
              className="flex-1 rounded-lg border border-gray-300 py-3 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Mis grabaciones
            </Link>
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function StepHeader({ step }: { step: Step }) {
  const labels = ["Bienvenida", "Acceso", "Video", "Derechos"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? "bg-indigo-600 text-white"
                  : done
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {n}
            </div>
            <span className="mt-1 text-[11px] text-gray-500">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
}: {
  onBack?: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex gap-3">
      {onBack && (
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver
        </button>
      )}
      <button
        onClick={onNext}
        className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        Continuar
      </button>
    </div>
  );
}
