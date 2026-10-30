"use client";

/**
 * PasoAcuerdo — «Cómo participas»: el nivel de acceso predeterminado de
 * tus videos y el acuerdo en una página. Se firma con la palomita y el
 * nombre escrito, o grabando el consentimiento en LSM.
 */

import { useState } from "react";
import Link from "next/link";
import { postJson } from "@/lib/api-client";
import { avisarCambioDeMe } from "@/components/ChipSesion";
import {
  ACUERDO_ACEPTO,
  ACUERDO_FECHA,
  ACUERDO_RESUMEN,
  ACUERDO_SECCIONES,
  ACUERDO_VERSION,
} from "@/lib/acuerdo";
import { ACCESS_TIERS } from "@/lib/tiers";
import type { AccessTier } from "@/lib/aws/keys";
import CameraRecorder from "@/components/CameraRecorder";
import { BotonPrincipal, Campo, claseInput, ErrorForm } from "./campos";

type Firma = "texto" | "video";

export default function PasoAcuerdo({
  tierInicial = "restringido",
  onListo,
}: {
  tierInicial?: AccessTier;
  onListo: () => void;
}) {
  const [tier, setTier] = useState<AccessTier>(tierInicial);
  const [firma, setFirma] = useState<Firma>("texto");
  const [acepto, setAcepto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [video, setVideo] = useState<Blob | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subirVideo(blob: Blob): Promise<string> {
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
    if (!put.ok) throw new Error("Falló la subida del video de consentimiento");
    return key;
  }

  async function firmar(e: React.FormEvent) {
    e.preventDefault();
    if (!acepto) return setError("Marca la casilla para aceptar el acuerdo.");
    if (firma === "texto" && nombre.trim().length < 2)
      return setError("Escribe tu nombre completo para firmar.");
    if (firma === "video" && !video) return setError("Graba el video corto para firmar.");
    setError(null);
    setOcupado(true);
    try {
      const videoKey = firma === "video" && video ? await subirVideo(video) : undefined;
      await postJson("/api/consent/grant", {
        mode: firma === "video" ? "video" : "text",
        videoKey,
        defaultTier: tier,
        signedName: nombre.trim() || undefined,
        agreementVersion: ACUERDO_VERSION,
      });
      avisarCambioDeMe();
      onListo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar tu firma.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="aparece space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">
          Cómo participas
        </h1>
        <p className="mt-2 text-gray-600">
          Gratis y sin pago: lo que hay es el juego de las nueve manos. Lo
          que sí decides aquí es quién puede ver tus videos.
        </p>
      </div>

      <form onSubmit={firmar} className="space-y-8">
        {/* Nivel de acceso */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-ink">
            Quién puede ver tus videos (lo cambias por video cuando quieras)
          </legend>
          {ACCESS_TIERS.map((t) => (
            <label
              key={t.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-4 transition-colors ${
                tier === t.value ? "border-ink bg-gray-50" : "border-gray-200 bg-paper hover:border-gray-400"
              }`}
            >
              <input
                type="radio"
                name="tier"
                checked={tier === t.value}
                onChange={() => setTier(t.value)}
                className="mt-1 h-4 w-4 accent-ink"
              />
              <span>
                <span className="block font-semibold text-ink">{t.label}</span>
                <span className="block text-sm text-gray-600">{t.description}</span>
              </span>
            </label>
          ))}
          <p className="rounded-lg bg-gold-tint px-4 py-3 text-sm text-gold-deep">
            Tu rostro es parte de tu lengua. No podemos difuminarlo sin borrar
            lo que señas. Por eso tú decides quién ve cada video.
          </p>
        </fieldset>

        {/* El acuerdo */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-ink">Firma el acuerdo</h2>
            <span className="text-xs text-gray-500">
              Versión {ACUERDO_VERSION} · {ACUERDO_FECHA} ·{" "}
              <Link href="/acuerdo" target="_blank" className="underline-offset-4 hover:underline">
                Abrir en otra pestaña
              </Link>
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3">
            {ACUERDO_RESUMEN.map((r) => (
              <li key={r} className="rounded-lg border border-gray-200 bg-paper px-3 py-2 text-sm text-gray-700">
                {r}
              </li>
            ))}
          </ul>
          <div
            className="max-h-72 space-y-4 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700"
            tabIndex={0}
            aria-label="Texto del acuerdo"
          >
            <p className="overline-label text-gray-500">Acuerdo de participación en SignaLab</p>
            {ACUERDO_SECCIONES.map((s) => (
              <section key={s.titulo}>
                <h3 className="font-semibold text-ink">{s.titulo}</h3>
                {s.parrafos.map((p) => (
                  <p key={p} className="mt-1">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
          <label className="flex items-start gap-3 rounded-xl border-[1.5px] border-gray-200 p-4">
            <input
              type="checkbox"
              checked={acepto}
              onChange={(e) => setAcepto(e.target.checked)}
              className="mt-1 h-4 w-4 accent-ink"
            />
            <span className="text-sm text-ink">{ACUERDO_ACEPTO}</span>
          </label>
        </div>

        {/* La firma */}
        <div className="space-y-4">
          <div role="group" aria-label="Cómo firmas" className="flex flex-wrap gap-2">
            {(
              [
                { v: "texto", l: "Firmar con mi nombre" },
                { v: "video", l: "Firmar en LSM con un video" },
              ] as { v: Firma; l: string }[]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                aria-pressed={firma === o.v}
                onClick={() => setFirma(o.v)}
                className={`rounded-full border-[1.5px] px-4 py-2 text-sm font-medium ${
                  firma === o.v ? "border-ink bg-ink text-paper" : "border-gray-300 text-gray-700 hover:border-ink"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>

          {firma === "texto" ? (
            <Campo
              etiqueta="Escribe tu nombre completo para firmar"
              htmlFor="nombre"
              pista="Como en tu identificación. Solo se usa para este acuerdo; otras personas ven tu apodo."
            >
              <input
                id="nombre"
                type="text"
                autoComplete="name"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={claseInput}
              />
            </Campo>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Graba un video corto en LSM diciendo tu nombre, la fecha de hoy
                y que aceptas participar con el nivel de acceso{" "}
                <strong>{ACCESS_TIERS.find((t) => t.value === tier)?.label}</strong>.
              </p>
              <CameraRecorder onRecordingComplete={(blob) => setVideo(blob)} />
              {video && (
                <p className="text-sm text-green-deep">
                  Video listo ({Math.round(video.size / 1024)} KB).
                </p>
              )}
            </div>
          )}
        </div>

        <ErrorForm>{error}</ErrorForm>
        <BotonPrincipal disabled={ocupado}>
          {ocupado ? "Guardando..." : "Firmar y entrar al estudio"}
        </BotonPrincipal>
      </form>
    </section>
  );
}
