"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  EMPTY_DRAFT,
  loadDraft,
  persistDraft,
  clearDraft,
  draftToAnnotation,
  buildAnnotationFromDraft,
  marcarHumano,
  type GuidedDraft,
  type PasoId,
} from "@/lib/anotar_draft";
import { exportAnnotationAsLSMPN } from "@/lib/store";
import type {
  SignAnnotation,
  CMEntry,
  ProvenanceMap,
} from "@/lib/types";
import type { PhonSuggestion } from "@/lib/vision/phon/phon_features";
import StepIndicator from "@/components/anotar/StepIndicator";
import PasoVideo from "@/components/anotar/PasoVideo";
import PasoCM from "@/components/anotar/PasoCM";
import PasoUbicacion from "@/components/anotar/PasoUbicacion";
import PasoOrientacion from "@/components/anotar/PasoOrientacion";
import PasoMovimiento from "@/components/anotar/PasoMovimiento";
import Resumen from "@/components/anotar/Resumen";

// El recuadro 3D usa WebGL: solo en cliente.
const EsqueletoLSM = dynamic(
  () => import("@/components/esqueleto/EsqueletoLSM"),
  { ssr: false },
);

/**
 * /anotar — flujo guiado de anotación LSM-PN.
 * video → mano (CM+bimanual) → lugar (UB) → palma (OR) → movimiento
 * (MV: contorno, dirección, repetición) → resumen (D-M-D + notación).
 * El esqueleto 3D acompaña todos los pasos: es función pura de las
 * matrices anotadas y se re-posa al instante con cada corrección.
 */

const DEFAULT_DURATION_MS = 1000;

export default function AnotarGuiadoPage() {
  const [draft, setDraft] = useState<GuidedDraft>(EMPTY_DRAFT);
  const [paso, setPaso] = useState<PasoId>("video");
  const [completed, setCompleted] = useState<Set<PasoId>>(new Set());
  const [savedAnnotation, setSavedAnnotation] =
    useState<SignAnnotation | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(DEFAULT_DURATION_MS);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    setDraft(loadDraft());
    setHydrated(true);
  }, []);

  /** Actualiza el borrador; `humanFields` marca procedencia humana */
  const update = useCallback(
    (changes: Partial<GuidedDraft>, humanFields?: string[]) => {
      setDraft((prev) => {
        const next = { ...prev, ...changes };
        if (humanFields?.length) {
          next.provenance = marcarHumano(next, humanFields);
        }
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

  // ── Sincronía video ↔ esqueleto (rAF mientras reproduce) ──────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => {
      if (isFinite(video.duration)) setDurationMs(video.duration * 1000);
    };
    const onTime = () => setTimeMs(video.currentTime * 1000);
    const loop = () => {
      setTimeMs(video.currentTime * 1000);
      rafRef.current = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    const onPause = () => cancelAnimationFrame(rafRef.current);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onPause);
    onMeta();
    return () => {
      cancelAnimationFrame(rafRef.current);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onPause);
    };
  }, [draft.video_url, paso]);

  // Anotación de previsualización: el esqueleto es función pura de esto.
  const previewAnnotation = useMemo(
    () => buildAnnotationFromDraft(draft, durationMs),
    [draft, durationMs],
  );

  const handleSuggestion = useCallback(
    (s: PhonSuggestion) => {
      const prov: ProvenanceMap = {};
      const setIf = <K extends keyof GuidedDraft>(
        field: K,
        value: GuidedDraft[K] | undefined,
      ): Partial<GuidedDraft> => {
        if (value === undefined) return {};
        prov[field as string] = "auto";
        return { [field]: value } as Partial<GuidedDraft>;
      };
      update({
        sugerencia: s,
        ...setIf("cm_id", s.cmCandidates[0]?.cm_id),
        ...setIf("location_code", s.location_code),
        ...setIf("contact", s.contact),
        ...setIf("contour", s.contour),
        ...setIf("plane", s.plane),
        ...setIf("direction", s.direction),
        ...setIf("repetition", s.repetition),
        ...setIf("palm_facing", s.palm_facing),
        ...setIf("finger_pointing", s.finger_pointing),
        ...setIf("eyebrows", s.eyebrows),
        ...setIf("mouth", s.mouth),
        ...setIf(
          "nondominant",
          s.nondominant_relation
            ? { relation: s.nondominant_relation }
            : undefined,
        ),
        provenance: prov,
      });
    },
    [update],
  );

  const handleSave = useCallback(() => {
    const annotation = draftToAnnotation(draft, durationMs);
    setSavedAnnotation(annotation);
  }, [draft, durationMs]);

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
    setTimeMs(0);
    setDurationMs(DEFAULT_DURATION_MS);
  }, []);

  if (!hydrated) return null;

  const auto = (campo: string) => draft.provenance?.[campo] === "auto";
  const showSidePanel = paso !== "video";

  return (
    <div className="space-y-6">
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
        className={`grid grid-cols-1 gap-6 ${showSidePanel ? "lg:grid-cols-5" : ""}`}
      >
        {/* Panel lateral: video + esqueleto, siempre a la vista */}
        {showSidePanel && (
          <div className="lg:col-span-2">
            <div className="space-y-4 lg:sticky lg:top-6">
              {draft.video_url && (
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
              )}
              <EsqueletoLSM
                annotation={previewAnnotation}
                timeMs={timeMs}
                durationMs={durationMs}
                standalone={!draft.video_url}
                onTimeChange={setTimeMs}
              />
              <p className="text-center text-sm font-semibold uppercase text-gray-600">
                {draft.gloss.trim() || "…"}
              </p>
            </div>
          </div>
        )}

        {/* Paso activo */}
        <div
          className={`rounded-2xl border border-gray-200 bg-paper p-5 shadow-card sm:p-6 ${
            showSidePanel ? "lg:col-span-3" : "mx-auto w-full max-w-3xl"
          }`}
        >
          {paso === "video" && (
            <PasoVideo
              gloss={draft.gloss}
              videoUrl={draft.video_url}
              sugerencia={draft.sugerencia}
              onGlossChange={(gloss) => update({ gloss })}
              onVideoChange={(url, isLocal) =>
                update({
                  video_url: url,
                  video_is_local: isLocal,
                  sugerencia: undefined,
                  provenance: undefined,
                })
              }
              onSuggestion={handleSuggestion}
              onNext={() => goTo("cm")}
            />
          )}
          {paso === "cm" && (
            <PasoCM
              selectedCmId={draft.cm_id}
              sugeridas={draft.sugerencia?.cmCandidates}
              nondominant={draft.nondominant}
              nondominantSuggested={auto("nondominant")}
              onSelect={(cm: CMEntry) => update({ cm_id: cm.cm_id }, ["cm_id"])}
              onNondominantChange={(nondominant) =>
                update({ nondominant }, ["nondominant"])
              }
              onNext={() => goTo("ubicacion")}
              onBack={() => goTo("video")}
            />
          )}
          {paso === "ubicacion" && (
            <PasoUbicacion
              locationCode={draft.location_code}
              contact={draft.contact}
              laterality={draft.laterality}
              onLocationChange={(code) =>
                update({ location_code: code }, ["location_code"])
              }
              onContactChange={(contact) => update({ contact }, ["contact"])}
              onLateralityChange={(laterality) =>
                update({ laterality }, ["laterality"])
              }
              onNext={() => goTo("orientacion")}
              onBack={() => goTo("cm")}
            />
          )}
          {paso === "orientacion" && (
            <PasoOrientacion
              palmFacing={draft.palm_facing}
              fingerPointing={draft.finger_pointing}
              palmSuggested={auto("palm_facing")}
              fingerSuggested={auto("finger_pointing")}
              onPalmChange={(palm_facing) =>
                update({ palm_facing }, ["palm_facing"])
              }
              onFingerChange={(finger_pointing) =>
                update({ finger_pointing }, ["finger_pointing"])
              }
              onNext={() => goTo("movimiento")}
              onBack={() => goTo("ubicacion")}
            />
          )}
          {paso === "movimiento" && (
            <PasoMovimiento
              contour={draft.contour}
              local={draft.local}
              plane={draft.plane}
              direction={draft.direction}
              repetition={draft.repetition}
              eyebrows={draft.eyebrows}
              mouth={draft.mouth}
              directionSuggested={auto("direction")}
              repetitionSuggested={auto("repetition")}
              onContourChange={(contour) => update({ contour }, ["contour"])}
              onLocalChange={(local) => update({ local }, ["local"])}
              onPlaneChange={(plane) => update({ plane }, ["plane"])}
              onDirectionChange={(direction) =>
                update({ direction }, ["direction"])
              }
              onRepetitionChange={(repetition) =>
                update({ repetition }, ["repetition"])
              }
              onEyebrowsChange={(eyebrows) => update({ eyebrows }, ["eyebrows"])}
              onMouthChange={(mouth) => update({ mouth }, ["mouth"])}
              onNext={() => goTo("resumen")}
              onBack={() => goTo("orientacion")}
            />
          )}
          {paso === "resumen" && (
            <Resumen
              draft={draft}
              saved={savedAnnotation !== null}
              onEdit={setPaso}
              onDraftChange={(changes) => update(changes)}
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
