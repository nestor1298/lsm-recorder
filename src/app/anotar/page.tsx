"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_DRAFT,
  loadDraft,
  persistDraft,
  clearDraft,
  draftToAnnotation,
  type GuidedDraft,
  type PasoId,
} from "@/lib/anotar_draft";
import { exportAnnotationAsLSMPN } from "@/lib/store";
import type { SignAnnotation, CMEntry } from "@/lib/types";
import StepIndicator from "@/components/anotar/StepIndicator";
import PasoVideo from "@/components/anotar/PasoVideo";
import PasoCM from "@/components/anotar/PasoCM";
import PasoUbicacion from "@/components/anotar/PasoUbicacion";
import PasoMovimiento from "@/components/anotar/PasoMovimiento";
import Resumen from "@/components/anotar/Resumen";

/**
 * /anotar — flujo guiado de anotación LSM-PN.
 * Un paso a la vez: video → mano (CM) → lugar (UB) → movimiento (MV) →
 * resumen con notación Cruz Aldrete. El video queda siempre a la vista.
 * La vista experta (multi-segmento, PSHR) sigue en /annotate.
 */

export default function AnotarGuiadoPage() {
  const [draft, setDraft] = useState<GuidedDraft>(EMPTY_DRAFT);
  const [paso, setPaso] = useState<PasoId>("video");
  const [completed, setCompleted] = useState<Set<PasoId>>(new Set());
  const [savedAnnotation, setSavedAnnotation] =
    useState<SignAnnotation | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setDraft(loadDraft());
    setHydrated(true);
  }, []);

  const update = useCallback(
    (changes: Partial<GuidedDraft>) => {
      setDraft((prev) => {
        const next = { ...prev, ...changes };
        persistDraft(next);
        return next;
      });
      setSavedAnnotation(null);
    },
    [],
  );

  const goTo = useCallback(
    (next: PasoId) => {
      setCompleted((done) => new Set(done).add(paso));
      setPaso(next);
      window.scrollTo({ top: 0 });
    },
    [paso],
  );

  const handleSave = useCallback(() => {
    const durationMs = videoRef.current?.duration
      ? videoRef.current.duration * 1000
      : 3000;
    const annotation = draftToAnnotation(draft, durationMs);
    setSavedAnnotation(annotation);
  }, [draft]);

  const handleExport = useCallback(() => {
    if (!savedAnnotation) return;
    const lsmPn = exportAnnotationAsLSMPN(savedAnnotation);
    const blob = new Blob([JSON.stringify(lsmPn, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${savedAnnotation.gloss.toLowerCase().replace(/\s+/g, "_")}_lsm_pn.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [savedAnnotation]);

  const handleNew = useCallback(() => {
    clearDraft();
    setDraft({ ...EMPTY_DRAFT });
    setSavedAnnotation(null);
    setCompleted(new Set());
    setPaso("video");
  }, []);

  if (!hydrated) return null;

  const showVideoPanel = paso !== "video" && Boolean(draft.video_url);

  return (
    <div className="space-y-6">
      {/* Encabezado + pasos */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Anotar una seña</h1>
          <p className="text-sm text-gray-500">
            Paso a paso, con la notación de Cruz Aldrete.
          </p>
        </div>
        <StepIndicator current={paso} completed={completed} onNavigate={setPaso} />
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${
          showVideoPanel ? "lg:grid-cols-5" : ""
        }`}
      >
        {/* Video siempre a la vista durante la anotación */}
        {showVideoPanel && (
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-black">
                <video
                  ref={videoRef}
                  src={draft.video_url}
                  controls
                  loop
                  playsInline
                  className="aspect-video w-full"
                />
              </div>
              <p className="mt-2 text-center text-sm font-semibold uppercase text-gray-600">
                {draft.gloss.trim() || "…"}
              </p>
            </div>
          </div>
        )}

        {/* Paso activo */}
        <div
          className={`rounded-2xl border border-gray-200 bg-paper p-5 shadow-card sm:p-6 ${
            showVideoPanel ? "lg:col-span-3" : "mx-auto w-full max-w-3xl"
          }`}
        >
          {paso === "video" && (
            <PasoVideo
              gloss={draft.gloss}
              videoUrl={draft.video_url}
              onGlossChange={(gloss) => update({ gloss })}
              onVideoChange={(url, isLocal) =>
                update({ video_url: url, video_is_local: isLocal })
              }
              onNext={() => goTo("cm")}
            />
          )}
          {paso === "cm" && (
            <PasoCM
              selectedCmId={draft.cm_id}
              onSelect={(cm: CMEntry) => update({ cm_id: cm.cm_id })}
              onNext={() => goTo("ubicacion")}
              onBack={() => goTo("video")}
            />
          )}
          {paso === "ubicacion" && (
            <PasoUbicacion
              locationCode={draft.location_code}
              contact={draft.contact}
              laterality={draft.laterality}
              onLocationChange={(code) => update({ location_code: code })}
              onContactChange={(contact) => update({ contact })}
              onLateralityChange={(laterality) => update({ laterality })}
              onNext={() => goTo("movimiento")}
              onBack={() => goTo("cm")}
            />
          )}
          {paso === "movimiento" && (
            <PasoMovimiento
              contour={draft.contour}
              local={draft.local}
              plane={draft.plane}
              onContourChange={(contour) => update({ contour })}
              onLocalChange={(local) => update({ local })}
              onPlaneChange={(plane) => update({ plane })}
              onNext={() => goTo("resumen")}
              onBack={() => goTo("ubicacion")}
            />
          )}
          {paso === "resumen" && (
            <Resumen
              draft={draft}
              saved={savedAnnotation !== null}
              onEdit={setPaso}
              onSave={handleSave}
              onExport={handleExport}
              onNew={handleNew}
            />
          )}
        </div>
      </div>
    </div>
  );
}
