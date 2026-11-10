"use client";

/**
 * FichaSena — una seña del léxico de Wikisigns.
 *
 *  - Lexsi ejecuta la descripción fonológica (la matriz D → M → D que
 *    reproduce /learn), en bucle.
 *  - Al lado, lo que se midió: el esqueleto 3D de la persona que seña,
 *    reconstruido de la pista.
 *  - Abajo, los parámetros (CM, UB, OR, MV, dos manos, RNM), los ángulos
 *    medidos y los huesos que mueve Lexsi.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CM_INVENTORY } from "@/lib/data";
import { MiniHand } from "@/components/learn/MiniHand";
import type { FaceState } from "@/components/learn/RNMControls";
import {
  CONTACT_ES,
  CONTOUR_ES,
  EYEBROWS_ES,
  FINGER_ES,
  HEAD_ES,
  LATERALITY_ES,
  MOUTH_ES,
  PALM_ES,
  PLANE_ES,
  RELATION_ES,
  REPETITION_ES,
} from "@/lib/anotar_labels";
import { computeTotalDuration, getPlaybackFrame, DEFAULT_PLAYBACK_CONFIG } from "@/lib/sign_playback";
import { poseDeSegmento } from "@/lib/learn_viewer";
import { lexiconToConstruction } from "@/lib/lexicon/to_construction";
import { fetchLexiconTrack, trackToPose3D } from "@/lib/lexicon/track3d";
import type { Pose3DTrack } from "@/lib/vision/pose3d";
import type { HandObserved, LexiconEntry } from "@/lib/lexicon/types";

const Cargando = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
  </div>
);
const Hand3DViewer = dynamic(() => import("@/components/Hand3D/Hand3DViewer"), { ssr: false, loading: Cargando });
const EsqueletoMP3D = dynamic(() => import("@/components/esqueleto/EsqueletoMP3D"), { ssr: false, loading: Cargando });

const RITMO_LENTO = {
  holdDuration: DEFAULT_PLAYBACK_CONFIG.holdDuration * 2,
  movementDuration: DEFAULT_PLAYBACK_CONFIG.movementDuration * 2,
};
/** Pausa entre vueltas del bucle */
const PAUSA_MS = 500;

const BANDERAS_ES: Record<string, string> = {
  sin_video: "El video ya no está en YouTube (privado o borrado)",
  sin_mano: "No se detectó la mano en el video",
  cm_dudosa: "Forma de mano dudosa",
  cm_empate: "La forma empata con otras parecidas",
  pocos_cuadros: "Pocos cuadros con la mano visible",
  sin_ub: "No se pudo ubicar la mano",
  otra_lengua: "Seña de otra lengua de señas",
  dactilologia: "Deletreo manual",
};

const cmPorId = new Map(CM_INVENTORY.map((c) => [c.cm_id, c]));
const es = (m: Record<string, string>, k: string | undefined | null) => (k ? (m[k] ?? k.toLowerCase()) : "—");
/** prefers-reduced-motion, sin desajuste entre servidor y navegador */
function useMenosMovimiento(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      mq?.addEventListener("change", cb);
      return () => mq?.removeEventListener("change", cb);
    },
    () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
    () => false,
  );
}

/** Reloj en bucle: ms transcurridos dentro de una vuelta de `total` ms */
function useBucle(activo: boolean, total: number): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!activo || total <= 0) return;
    let raf = 0;
    const inicio = performance.now();
    const tick = (ahora: number) => {
      const fase = (ahora - inicio) % (total + PAUSA_MS);
      setT(Math.min(fase, total));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activo, total]);
  return t;
}

function Tarjeta({ titulo, sigla, children }: { titulo: string; sigla?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-paper p-4">
      <h2 className="mb-2 font-display text-base font-bold text-ink">
        {sigla && <span className="mr-1.5 text-accent-deep">{sigla}</span>}
        {titulo}
      </h2>
      <div className="text-sm text-gray-700">{children}</div>
    </section>
  );
}

function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-100 py-1 last:border-0">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}

function TablaDedos({ h, titulo }: { h: HandObserved; titulo: string }) {
  const filas: [string, { mcp: number; pip: number; dip: number }][] = [
    ["Índice", h.index],
    ["Medio", h.middle],
    ["Anular", h.ring],
    ["Meñique", h.pinky],
  ];
  return (
    <div>
      <p className="mb-1 text-xs font-medium overline-label text-gray-500">{titulo}</p>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="font-medium">Dedo</th>
            <th className="text-right font-medium">MCP</th>
            <th className="text-right font-medium">PIP</th>
            <th className="text-right font-medium">DIP</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(([n, f]) => (
            <tr key={n} className="border-t border-gray-100">
              <td>{n}</td>
              <td className="text-right">{f.mcp}°</td>
              <td className="text-right">{f.pip}°</td>
              <td className="text-right">{f.dip}°</td>
            </tr>
          ))}
          <tr className="border-t border-gray-100">
            <td>Pulgar</td>
            <td className="text-right" title="CMC">{h.thumb.cmc}°</td>
            <td className="text-right" title="MCP">{h.thumb.mcp}°</td>
            <td className="text-right" title="IP">{h.thumb.ip}°</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-xs text-gray-500">
        Separación: índice–medio {h.abduction.index_middle}°, medio–anular {h.abduction.middle_ring}°, anular–meñique{" "}
        {h.abduction.ring_pinky}° · mediana de {h.frames} cuadros
      </p>
    </div>
  );
}

function Esqueleto({ url, dominant }: { url: string; dominant: "RIGHT" | "LEFT" }) {
  const [track, setTrack] = useState<Pose3DTrack | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetchLexiconTrack(url, ctrl.signal)
      .then((t) => setTrack(trackToPose3D(t, dominant)))
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      });
    return () => ctrl.abort();
  }, [url, dominant]);
  const quieto = useMenosMovimiento();
  const t = useBucle(Boolean(track) && !quieto, track?.durationMs ?? 0);
  if (error) return <p className="p-6 text-center text-sm text-gray-500">No se pudo cargar la pista.</p>;
  return <EsqueletoMP3D track={track} timeMs={quieto ? (track?.durationMs ?? 0) / 2 : t} encuadre="todo" />;
}

export default function FichaSena({ entry, trackUrl }: { entry: LexiconEntry; trackUrl: string | null }) {
  const p = entry.phonology;
  const conFonologia = p !== null;
  const [lento, setLento] = useState(false);
  // con movimiento reducido arranca en pausa; el botón decide después
  const quieto = useMenosMovimiento();
  const [eleccion, setPausado] = useState<boolean | null>(null);
  const pausado = eleccion ?? quieto;

  const sign = useMemo(
    () =>
      lexiconToConstruction(entry.annotation, {
        eyebrows: entry.face.rnm.eyebrows,
        mouth: entry.face.rnm.mouth,
        head: entry.face.rnm.head,
      }),
    [entry],
  );
  const ritmo = lento ? RITMO_LENTO : DEFAULT_PLAYBACK_CONFIG;
  const total = computeTotalDuration(sign, ritmo);
  const t = useBucle(conFonologia && !pausado, total);
  const pose = useMemo(() => {
    const frame = getPlaybackFrame(sign, Math.min(t, total - 1), ritmo);
    return frame ? poseDeSegmento(sign, frame.segmentIndex, frame.ubInterpolation ?? 0) : poseDeSegmento(sign, 0);
  }, [sign, t, total, ritmo]);

  const cm = p?.cm ? cmPorId.get(p.cm.id) : undefined;
  const ndCm = p?.bimanual.nondominant_cm ? cmPorId.get(p.bimanual.nondominant_cm.id) : undefined;
  const obs = entry.skeleton.observed;
  const bs = entry.face.observed_blendshapes?.mean ?? {};
  const topBs = Object.entries(bs)
    .filter(([, v]) => v >= 0.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <nav>
        <Link href="/lexico" className="text-sm font-medium text-accent-deep hover:underline">
          ← Léxico
        </Link>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">{entry.gloss}</h1>
        <p className="text-base text-gray-700">
          {entry.spanish}
          {entry.synonyms.length > 0 && <span className="text-gray-500"> · también «{entry.synonyms.join("», «")}»</span>}
        </p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-medium ${entry.variety.is_lsm ? "bg-accent-tint text-accent-deep" : "bg-magenta-tint text-magenta-deep"}`}>
            {entry.variety.language}
            {entry.variety.region ? ` · ${entry.variety.region}` : ""}
          </span>
          {entry.kind === "phrase" && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">frase</span>}
          {entry.qualifiers.map((q) => (
            <span key={q} className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{q}</span>
          ))}
          {conFonologia && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
              {p.bimanual.two_handed ? "dos manos" : "una mano"} · confianza {Math.round(entry.qa.confidence * 100)} %
            </span>
          )}
        </div>
      </header>

      {!conFonologia ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
          <p className="font-semibold text-ink">Esta seña no tiene descripción.</p>
          <p className="mt-1">
            El video de Wikisigns ya no está en YouTube (es privado o se borró), así que no se pudo medir. Queda la
            entrada con su glosa y su fuente.
          </p>
          <a href={entry.source.page_url} target="_blank" rel="noreferrer" className="mt-3 inline-block font-medium text-accent-deep underline">
            Ver la página en Wikisigns
          </a>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <section className="lg:col-span-3" aria-label="Lexsi ejecuta la descripción">
            <div className="relative h-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 sm:h-[520px]">
              <Hand3DViewer
                forceAvatar
                sinMarco
                encuadre="torso"
                autoRotate={false}
                cm={pose.cm}
                orientation={pose.orientation}
                ubLocation={pose.ubLocation ? { code: pose.ubLocation.code, region: pose.ubLocation.region, name: pose.ubLocation.name, x: pose.ubLocation.x, y: pose.ubLocation.y } : null}
                rnm={pose.rnm as FaceState}
                movementInterp={pose.movementInterp}
                handMode={pose.handMode}
                selectedUBCode={pose.ubLocation?.code ?? null}
                isBuildMode
                height="100%"
                className="h-full w-full"
              />
              <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <p className="rounded-full bg-paper/85 px-3 py-1 text-xs font-medium text-gray-700 backdrop-blur">
                  Lexsi ejecuta la descripción
                </p>
                <div className="pointer-events-auto flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPausado(!pausado)}
                    className="rounded-full bg-paper/90 px-3 py-1 text-xs font-medium text-ink shadow-sm backdrop-blur hover:bg-paper"
                  >
                    {pausado ? "Reproducir" : "Pausa"}
                  </button>
                  <button
                    type="button"
                    aria-pressed={lento}
                    onClick={() => setLento((v) => !v)}
                    className={`rounded-full px-3 py-1 text-xs font-medium shadow-sm backdrop-blur ${lento ? "bg-ink text-white" : "bg-paper/90 text-ink hover:bg-paper"}`}
                  >
                    Lento
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line font-mono text-xs text-gray-500">{entry.notation}</p>
          </section>

          <section className="space-y-2 lg:col-span-2" aria-label="Esqueleto 3D medido">
            <p className="text-sm font-semibold text-ink">Esqueleto 3D medido</p>
            {trackUrl ? (
              <Esqueleto url={trackUrl} dominant={entry.skeleton.dominant_hand} />
            ) : (
              <p className="p-6 text-center text-sm text-gray-500">Esta seña no tiene pista.</p>
            )}
          </section>
        </div>
      )}

      {conFonologia && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tarjeta sigla="CM" titulo="Forma de la mano">
            {p.cm && cm ? (
              <div className="flex items-start gap-3">
                <MiniHand cm={cm} size={56} />
                <div>
                  <p className="font-semibold text-ink">
                    #{p.cm.id} {p.cm.alpha_code ? `· ${p.cm.alpha_code}` : ""}
                  </p>
                  <p className="font-mono text-xs text-gray-500">{p.cm.notation}</p>
                  <p className="text-xs text-gray-500">como en «{p.cm.example_sign}»</p>
                  {p.cm.candidates.length > 1 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Parecidas: {p.cm.candidates.slice(1, 4).map((c) => `#${c.cm_id}`).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              "—"
            )}
          </Tarjeta>

          <Tarjeta sigla="UB" titulo="Lugar">
            <dl>
              <Dato k="Dónde" v={p.ub ? (p.ub.code === "EN" ? "Espacio neutro" : (p.ub.name ?? p.ub.code)) : "—"} />
              <Dato k="Contacto" v={es(CONTACT_ES, p.ub?.contact)} />
              <Dato k="Lado" v={es(LATERALITY_ES, p.ub?.laterality)} />
            </dl>
          </Tarjeta>

          <Tarjeta sigla="OR" titulo="Orientación">
            <dl>
              <Dato k="Palma hacia" v={es(PALM_ES, p.or.palm)} />
              <Dato k="Dedos hacia" v={es(FINGER_ES, p.or.fingers)} />
            </dl>
          </Tarjeta>

          <Tarjeta sigla="MV" titulo="Movimiento">
            <dl>
              <Dato k="Estructura" v={p.structure} />
              <Dato k="Trayecto" v={es(CONTOUR_ES, p.mov?.contour)} />
              <Dato k="Plano" v={es(PLANE_ES, p.mov?.plane)} />
              <Dato
                k="Repetición"
                v={p.mov?.repetition ? `${p.mov.repetition.count} × ${es(REPETITION_ES, p.mov.repetition.type)}` : "no"}
              />
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Dos manos">
            {p.bimanual.two_handed ? (
              <div className="flex items-start gap-3">
                {ndCm && <MiniHand cm={ndCm} size={44} />}
                <dl className="flex-1">
                  <Dato k="Relación" v={es(RELATION_ES, p.bimanual.relation)} />
                  <Dato k="Forma de la otra mano" v={ndCm ? `#${ndCm.cm_id}` : "—"} />
                </dl>
              </div>
            ) : (
              <p>Se hace con una mano.</p>
            )}
          </Tarjeta>

          <Tarjeta sigla="RNM" titulo="Cara y cabeza">
            <dl>
              <Dato k="Cejas" v={es(EYEBROWS_ES, entry.face.rnm.eyebrows)} />
              <Dato k="Boca" v={es(MOUTH_ES, entry.face.rnm.mouth)} />
              <Dato k="Cabeza" v={es(HEAD_ES, entry.face.rnm.head)} />
            </dl>
            {topBs.length > 0 && (
              <div className="mt-2 space-y-1" aria-label="Gestos de la cara medidos">
                {topBs.map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className="w-32 truncate text-gray-500" title={k}>{k}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(v * 100)}%` }} />
                    </span>
                    <span className="w-8 text-right tabular-nums text-gray-600">{v.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>
        </div>
      )}

      {conFonologia && (obs.dominant || obs.arm_dominant) && (
        <section className="rounded-2xl border border-gray-200 bg-paper p-4">
          <h2 className="mb-3 font-display text-base font-bold text-ink">Esqueleto medido</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {obs.dominant && <TablaDedos h={obs.dominant} titulo="Mano dominante" />}
            {obs.nondominant && <TablaDedos h={obs.nondominant} titulo="Otra mano" />}
            {obs.arm_dominant && (
              <div>
                <p className="mb-1 text-xs font-medium overline-label text-gray-500">Brazo dominante</p>
                <dl className="text-sm">
                  <Dato k="Hombro al frente" v={`${obs.arm_dominant.shoulderFlex}°`} />
                  <Dato k="Hombro al lado" v={`${obs.arm_dominant.shoulderAbd}°`} />
                  <Dato k="Codo" v={`${obs.arm_dominant.elbowFlex}°`} />
                  <Dato k="Muñeca" v={`${obs.arm_dominant.wristBend}°`} />
                </dl>
              </div>
            )}
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-accent-deep">
              Huesos de Lexsi para esta forma ({entry.skeleton.rig})
            </summary>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              {entry.skeleton.canonical.hands.map((h) => (
                <table key={h.side} className="w-full text-xs tabular-nums">
                  <caption className="mb-1 text-left font-medium text-gray-600">
                    {h.side === "dominant" ? "Mano dominante" : "Otra mano"} · CM #{h.cm_id}
                  </caption>
                  <tbody>
                    {h.bones.map((b) => (
                      <tr key={b.bone} className="border-t border-gray-100">
                        <td className="py-0.5 font-mono">{b.bone}</td>
                        <td className="text-gray-500">{b.joint}</td>
                        <td className="text-right">{b.euler_xyz_deg.map((d) => `${d}°`).join(" ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          </details>
        </section>
      )}

      <footer className="space-y-2 rounded-2xl bg-gray-50 p-4 text-xs text-gray-600">
        {conFonologia && entry.qa.flags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {entry.qa.flags.map((f) => (
              <li key={f} className="rounded-full bg-gold-tint px-2 py-0.5 text-gold-deep">{BANDERAS_ES[f] ?? f}</li>
            ))}
          </ul>
        )}
        <p>
          Fuente:{" "}
          <a href={entry.source.page_url} target="_blank" rel="noreferrer" className="underline hover:text-accent-deep">
            {entry.label} en Wikisigns
          </a>
          , licencia CC BY-SA 4.0.
          {conFonologia &&
            " La descripción la propuso la visión por computadora (procedencia «auto») y falta que la revise una persona Sorda."}
        </p>
      </footer>
    </div>
  );
}
