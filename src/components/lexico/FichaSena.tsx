"use client";

/**
 * FichaSena — una seña del léxico de Wikisigns, de lo general a lo fino:
 *
 *  1. La glosa y sus datos clave (mano, manos, duración, confianza).
 *  2. La fórmula: seis parámetros (CM, UB, OR, MV, dos manos, RNM), cada
 *     uno con su pictograma.
 *  3. La seña en movimiento: el esqueleto 3D medido y el trazo de las
 *     manos sobre la silueta, con un solo reloj.
 *  4. La partitura: estructura, la mano en momentos clave, cada dedo, la
 *     separación, la cabeza y la cara a lo largo del tiempo.
 *  5. Los datos medidos (ángulos, huesos del rig, notación) y la fuente.
 *
 * Colores: azul = mano dominante, verde = la otra, magenta = cara;
 * tinta para la estructura. Lexsi queda fuera por ahora.
 */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CM_INVENTORY } from "@/lib/data";
import { MiniHand } from "@/components/learn/MiniHand";
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
import { fetchLexiconTrack, trackToPose3D } from "@/lib/lexicon/track3d";
import { seriesFicha, type PistaFicha, type SeriesFicha } from "@/lib/lexicon/ficha";
import type { HandObserved, LexiconEntry } from "@/lib/lexicon/types";
import type { ContourMovement, FingerPointing, PalmFacing } from "@/lib/types";
import Partitura, { type Bloque } from "./ficha/Partitura";
import TrazoMovimiento from "./ficha/TrazoMovimiento";
import { PictoMV, PictoOR, PictoUB } from "./ficha/Pictogramas";
import { segundos, useMenosMovimiento, useReloj } from "./ficha/reloj";

const Cargando = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
  </div>
);
const EsqueletoMP3D = dynamic(() => import("@/components/esqueleto/EsqueletoMP3D"), { ssr: false, loading: Cargando });

const BANDERAS_ES: Record<string, string> = {
  sin_video: "El video ya no está en YouTube (privado o borrado)",
  sin_mano: "No se detectó la mano en el video",
  cm_dudosa: "Forma de mano dudosa",
  cm_empate: "La forma empata con otras parecidas",
  cm_2d: "La forma sale de manos vistas solo en 2D",
  pocos_cuadros: "Pocos cuadros con la mano visible",
  sin_ub: "No se pudo ubicar la mano",
  otra_lengua: "Seña de otra lengua de señas",
  dactilologia: "Deletreo manual",
};

const cmPorId = new Map(CM_INVENTORY.map((c) => [c.cm_id, c]));
const es = (m: Record<string, string>, k: string | undefined | null) => (k ? (m[k] ?? k.toLowerCase()) : "—");
const minus = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ── Piezas pequeñas ────────────────────────────────────────────

function Medida({ k, v, children }: { k: string; v: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="overline-label text-gray-400">{k}</dt>
      <dd className="mt-1 font-display text-xl font-semibold tracking-[-0.01em] text-ink tabular-nums">{v}</dd>
      {children}
    </div>
  );
}

/** Una casilla de la fórmula: sigla, pictograma, valor y detalle */
function Parametro({
  sigla,
  nombre,
  picto,
  valor,
  detalle,
}: {
  sigla: string;
  nombre: string;
  picto: React.ReactNode;
  valor: React.ReactNode;
  detalle?: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col bg-paper p-4 sm:p-5">
      <h3 className="overline-label flex items-baseline gap-2 text-gray-400">
        <span className="font-semibold text-accent-deep">{sigla}</span>
        {nombre}
      </h3>
      <div className="my-3 flex h-20 items-center justify-center">{picto}</div>
      <p className="font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">{valor}</p>
      {detalle && <div className="mt-1 text-[13px] leading-snug text-gray-500">{detalle}</div>}
    </section>
  );
}

function Lienzo({ titulo, leyenda, children }: { titulo: string; leyenda?: React.ReactNode; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-paper">
      <figcaption className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <span className="overline-label text-gray-500">{titulo}</span>
        {leyenda}
      </figcaption>
      <div className="relative aspect-square w-full">{children}</div>
    </figure>
  );
}

const Punto = ({ color, hueco = false }: { color: string; hueco?: boolean }) => (
  <span
    className="inline-block h-2 w-2 rounded-full"
    style={hueco ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { background: color }}
  />
);

function Leyenda({ items }: { items: [React.ReactNode, string][] }) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] text-gray-500">
      {items.map(([p, t]) => (
        <span key={t} className="flex items-center gap-1.5">
          {p}
          {t}
        </span>
      ))}
    </span>
  );
}

/** La cara medida (cejas, ojos, nariz, boca), para el pictograma de la RNM */
function CaraMedida({ s }: { s: SeriesFicha | null }) {
  const cara = s?.silueta?.cara;
  if (!cara?.length) return <span className="font-display text-4xl text-gray-300">☺</span>;
  const pts = cara.flat();
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => -p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const lado = Math.max(x1 - x0, y1 - y0) * 1.15;
  return (
    <svg viewBox={`${(x0 + x1) / 2 - lado / 2} ${(y0 + y1) / 2 - lado / 2} ${lado} ${lado}`} className="h-full w-full" aria-hidden>
      {cara.map((tr, k) => (
        <path
          key={k}
          d={tr.map((q, n) => `${n ? "L" : "M"}${q.x},${-q.y}`).join("")}
          fill="none"
          stroke="var(--color-magenta)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
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
      <p className="overline-label mb-1 text-gray-500">{titulo}</p>
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

// ── Reproducción ───────────────────────────────────────────────

function IconoPlay({ jugando }: { jugando: boolean }) {
  return jugando ? (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <rect x={3.5} y={3} width={3} height={10} rx={1} fill="currentColor" />
      <rect x={9.5} y={3} width={3} height={10} rx={1} fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" fill="currentColor" />
    </svg>
  );
}

function Transporte({ reloj, total }: { reloj: ReturnType<typeof useReloj>; total: number }) {
  return (
    <div className="sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-1 rounded-full bg-ink p-1.5 pr-2 text-white shadow-overlay">
      <button
        type="button"
        onClick={reloj.alternar}
        aria-label={reloj.jugando ? "Pausa" : "Reproducir"}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink transition hover:scale-105"
      >
        <IconoPlay jugando={reloj.jugando} />
      </button>
      <span className="w-[7.5rem] text-center font-mono text-xs tabular-nums text-gray-300">
        {segundos(reloj.t)} <span className="text-gray-500">/ {segundos(total)}</span>
      </span>
      <div className="flex rounded-full bg-gray-800 p-0.5" role="group" aria-label="Velocidad">
        {[
          [1, "1×"],
          [0.5, "½×"],
          [0.25, "¼×"],
        ].map(([v, l]) => (
          <button
            key={l}
            type="button"
            aria-pressed={reloj.velocidad === v}
            onClick={() => reloj.setVelocidad(v as number)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${reloj.velocidad === v ? "bg-white text-ink" : "text-gray-300 hover:text-white"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Estructura ─────────────────────────────────────────────────

function bloquesDe(entry: LexiconEntry, total: number): Bloque[] {
  const w0 = entry.video.window_ms?.[0] ?? 0;
  const segs = entry.annotation.segments;
  if (!segs.length) return [{ tipo: "M", desde: 0, hasta: total, etiqueta: "" }];
  return segs.map((s) => {
    const desde = Math.max(0, Math.min(total, s.start_ms - w0));
    const hasta = Math.max(desde, Math.min(total, s.end_ms - w0));
    const etiqueta =
      s.type === "M"
        ? [s.contour_movement ? CONTOUR_ES[s.contour_movement] : "movimiento", s.repetition?.count ? `×${s.repetition.count}` : ""]
            .filter(Boolean)
            .join(" ")
        : (s.location ?? s.location_code ?? "");
    return { tipo: s.type, desde, hasta, etiqueta };
  });
}

// ── La ficha ───────────────────────────────────────────────────

export default function FichaSena({ entry, trackUrl }: { entry: LexiconEntry; trackUrl: string | null }) {
  const p = entry.phonology;
  const conFonologia = p !== null;
  const cm = p?.cm ? cmPorId.get(p.cm.id) : undefined;
  const ndCm = p?.bimanual.nondominant_cm ? cmPorId.get(p.bimanual.nondominant_cm.id) : undefined;
  const obs = entry.skeleton.observed;
  const dominante = entry.skeleton.dominant_hand;

  const [pista, setPista] = useState<PistaFicha | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!trackUrl || !conFonologia) return;
    const ctrl = new AbortController();
    fetchLexiconTrack(trackUrl, ctrl.signal)
      .then((t) => setPista(t as PistaFicha))
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      });
    return () => ctrl.abort();
  }, [trackUrl, conFonologia]);
  const pose3d = useMemo(() => (pista ? trackToPose3D(pista, dominante) : null), [pista, dominante]);
  const series = useMemo(() => (pista ? seriesFicha(pista) : null), [pista]);
  const total = series?.duracionMs ?? 0;

  // con movimiento reducido arranca en pausa, a la mitad
  const quieto = useMenosMovimiento();
  const reloj = useReloj(total, !quieto);
  const { ir } = reloj;
  useEffect(() => {
    if (quieto && total) ir(total / 2);
  }, [quieto, total, ir]);

  const [cual, setCual] = useState<"dom" | "nd">("dom");
  const bloques = useMemo(() => bloquesDe(entry, total), [entry, total]);

  const lado = dominante === "RIGHT" ? "right" : "left";
  const dosManos = Boolean(p?.bimanual.two_handed);
  const contorno = p?.mov?.contour as ContourMovement | undefined;
  const rep = p?.mov?.repetition;

  return (
    <article className="space-y-8 sm:space-y-10">
      <nav>
        <Link href="/lexico" className="text-sm font-medium text-gray-500 transition hover:text-accent-deep">
          ← Léxico
        </Link>
      </nav>

      {/* 1 · la glosa */}
      <header className="grid items-end gap-6 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="overline-label flex flex-wrap gap-x-2 text-gray-400">
            <span className={entry.variety.is_lsm ? "text-accent-deep" : "text-magenta-deep"}>
              {entry.variety.language}
              {entry.variety.region ? ` · ${entry.variety.region}` : ""}
            </span>
            <span>Léxico Wikisigns</span>
            {entry.source.wikisigns_number && <span>Núm. {entry.source.wikisigns_number}</span>}
            {entry.kind === "phrase" && <span>frase</span>}
          </p>
          <h1 className="mt-2 break-words font-display text-5xl font-bold leading-[0.95] tracking-[-0.035em] text-ink sm:text-6xl lg:text-7xl">
            {entry.gloss}
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            {entry.spanish}
            {entry.synonyms.length > 0 && <span className="text-gray-400"> · también «{entry.synonyms.join("», «")}»</span>}
          </p>
        </div>
        {conFonologia && (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:pb-1">
            <Medida k="Mano" v={dominante === "RIGHT" ? "Diestra" : "Zurda"} />
            <Medida k="Manos" v={dosManos ? "Dos" : "Una"} />
            <Medida k="Duración" v={total ? segundos(total) : "—"} />
            <Medida k="Confianza" v={`${Math.round(entry.qa.confidence * 100)} %`}>
              <div className="mt-1.5 h-1 w-16 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-ink" style={{ width: `${Math.round(entry.qa.confidence * 100)}%` }} />
              </div>
            </Medida>
          </dl>
        )}
      </header>

      {!conFonologia ? (
        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
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
        <>
          {/* 2 · la fórmula */}
          <section aria-label="Parámetros fonológicos">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 md:grid-cols-3 xl:grid-cols-6">
              <Parametro
                sigla="CM"
                nombre="Forma"
                picto={cm ? <MiniHand cm={cm} size={80} /> : <span className="text-gray-300">—</span>}
                valor={
                  p.cm ? (
                    <>
                      <span className="font-mono text-[15px]">{p.cm.notation}</span>
                      <span className="ml-1.5 text-gray-400">#{p.cm.id}</span>
                    </>
                  ) : (
                    "—"
                  )
                }
                detalle={
                  p.cm && (
                    <>
                      como en «{p.cm.example_sign}»
                      {p.cm.candidates.length > 1 && (
                        <span className="mt-1 block text-gray-400">parecidas: {p.cm.candidates.slice(1, 4).map((c) => `#${c.cm_id}`).join(" · ")}</span>
                      )}
                    </>
                  )
                }
              />
              <Parametro
                sigla="UB"
                nombre="Lugar"
                picto={<PictoUB code={p.ub?.code} toca={p.ub?.contact === "TOUCHING" || p.ub?.contact === "GRASPED" || p.ub?.contact === "BRUSHING"} />}
                valor={p.ub ? (p.ub.code === "EN" ? "Espacio neutro" : (p.ub.name ?? p.ub.code)) : "—"}
                detalle={[p.ub?.contact && minus(es(CONTACT_ES, p.ub.contact)), p.ub?.laterality && minus(es(LATERALITY_ES, p.ub.laterality))]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Parametro
                sigla="OR"
                nombre="Orientación"
                picto={<PictoOR palma={p.or.palm as PalmFacing} dedos={p.or.fingers as FingerPointing} />}
                valor={es(PALM_ES, p.or.palm)}
                detalle={
                  <>
                    {es(FINGER_ES, p.or.fingers)}
                    <span className="mt-1 flex gap-3 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Punto color="var(--color-ink)" /> dedos
                      </span>
                      <span className="flex items-center gap-1">
                        <Punto color="var(--color-accent)" /> palma
                      </span>
                    </span>
                  </>
                }
              />
              <Parametro
                sigla="MV"
                nombre="Movimiento"
                picto={<PictoMV contorno={contorno} direccion={p.mov?.direction} repeticiones={rep?.count} />}
                valor={contorno ? CONTOUR_ES[contorno] : "Sin trayecto"}
                detalle={[
                  p.mov?.plane && `plano ${minus(es(PLANE_ES, p.mov.plane))}`,
                  rep && `${rep.count}× ${minus(es(REPETITION_ES, rep.type))}`,
                  `estructura ${p.structure}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Parametro
                sigla="2M"
                nombre="Manos"
                picto={
                  <div className="flex items-end gap-1">
                    {cm && <MiniHand cm={cm} size={dosManos ? 60 : 72} />}
                    {dosManos && (ndCm ? <MiniHand cm={ndCm} size={48} /> : <span className="mb-3 h-8 w-8 rounded-full border border-dashed border-gray-300" />)}
                  </div>
                }
                valor={dosManos ? es(RELATION_ES, p.bimanual.relation) : "Una mano"}
                detalle={dosManos ? (ndCm ? `la otra mano: #${ndCm.cm_id}` : "la otra mano repite la forma") : "la otra mano descansa"}
              />
              <Parametro
                sigla="RNM"
                nombre="Cara y cabeza"
                picto={<div className="h-20 w-20"><CaraMedida s={series} /></div>}
                valor={entry.face.rnm.head !== "NONE" ? es(HEAD_ES, entry.face.rnm.head) : "Cabeza quieta"}
                detalle={`cejas: ${minus(es(EYEBROWS_ES, entry.face.rnm.eyebrows))} · boca: ${minus(es(MOUTH_ES, entry.face.rnm.mouth))}`}
              />
            </div>
          </section>

          {/* 3 y 4 · la seña en movimiento y su partitura, con un solo reloj */}
          {trackUrl && !error ? (
            <div className="space-y-6">
              <section className="grid gap-4 lg:grid-cols-2" aria-label="La seña en movimiento">
                <Lienzo
                  titulo="Esqueleto 3D"
                  leyenda={
                    <Leyenda
                      items={[
                        [<Punto key="d" color="var(--color-accent)" />, "dominante"],
                        ...(dosManos ? ([[<Punto key="n" color="var(--color-green)" />, "otra mano"]] as [React.ReactNode, string][]) : []),
                        [<Punto key="c" color="var(--color-magenta)" />, "cara"],
                      ]}
                    />
                  }
                >
                  <EsqueletoMP3D track={pose3d} timeMs={reloj.t} encuadre="todo" dominante={lado} desnudo />
                  <span className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-gray-400">Arrastra para girar</span>
                </Lienzo>
                <Lienzo
                  titulo="Trayectoria"
                  leyenda={
                    <Leyenda
                      items={[
                        [<Punto key="i" color="var(--color-ink)" hueco />, "inicio"],
                        [<Punto key="f" color="var(--color-ink)" />, "fin"],
                      ]}
                    />
                  }
                >
                  {series ? <TrazoMovimiento s={series} t={reloj.t} /> : <Cargando />}
                  <span className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-gray-400">Un punto por cuadro: más juntos, más lento</span>
                </Lienzo>
              </section>

              <section className="rounded-3xl border border-gray-200 bg-paper p-5 sm:p-6" aria-label="Partitura de la seña">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">Partitura</h2>
                    <p className="mt-1 max-w-xl text-sm text-gray-500">
                      Cada dedo es una banda: delgada si está estirado, gruesa si se cierra. Rayada donde la mano solo se vio en 2D.
                      Arrastra sobre la partitura para recorrer la seña.
                    </p>
                  </div>
                  {series?.nd && (
                    <div className="flex rounded-full border border-gray-200 p-0.5 text-sm" role="group" aria-label="Mano">
                      {(
                        [
                          ["dom", "Dominante", "bg-accent"],
                          ["nd", "Otra mano", "bg-green"],
                        ] as const
                      ).map(([k, l, bg]) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={cual === k}
                          onClick={() => setCual(k)}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition ${cual === k ? "bg-ink text-white" : "text-gray-600 hover:text-ink"}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${bg}`} />
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {series ? <Partitura s={series} t={reloj.t} ir={reloj.ir} cual={cual} bloques={bloques} /> : <div className="h-64"><Cargando /></div>}
              </section>

              {series && <Transporte reloj={reloj} total={total} />}
            </div>
          ) : (
            <p className="rounded-3xl border border-gray-200 p-6 text-center text-sm text-gray-500">
              {error ? "No se pudo cargar la pista de esta seña." : "Esta seña no tiene pista."}
            </p>
          )}

          {/* 5 · datos medidos */}
          {(obs.dominant || obs.arm_dominant) && (
            <details className="group rounded-3xl border border-gray-200 bg-paper">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 sm:px-6">
                <span>
                  <span className="font-display text-lg font-bold text-ink">Datos medidos</span>
                  <span className="ml-2 text-sm text-gray-500">ángulos, huesos del rig y notación</span>
                </span>
                <span className="text-gray-400 transition group-open:rotate-45" aria-hidden>
                  ＋
                </span>
              </summary>
              <div className="space-y-6 border-t border-gray-100 px-5 py-5 sm:px-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {obs.dominant && <TablaDedos h={obs.dominant} titulo="Mano dominante" />}
                  {obs.nondominant && <TablaDedos h={obs.nondominant} titulo="Otra mano" />}
                  {obs.arm_dominant && (
                    <div>
                      <p className="overline-label mb-1 text-gray-500">Brazo dominante</p>
                      <dl className="text-sm">
                        <Dato k="Hombro al frente" v={`${obs.arm_dominant.shoulderFlex}°`} />
                        <Dato k="Hombro al lado" v={`${obs.arm_dominant.shoulderAbd}°`} />
                        <Dato k="Codo" v={`${obs.arm_dominant.elbowFlex}°`} />
                        <Dato k="Muñeca" v={`${obs.arm_dominant.wristBend}°`} />
                      </dl>
                    </div>
                  )}
                </div>
                <div>
                  <p className="overline-label mb-1 text-gray-500">Notación</p>
                  <p className="whitespace-pre-line rounded-xl bg-gray-50 p-3 font-mono text-xs text-gray-700">{entry.notation}</p>
                </div>
                <details>
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
              </div>
            </details>
          )}
        </>
      )}

      <footer className="space-y-3 border-t border-gray-100 pt-6 text-xs text-gray-500">
        {conFonologia && entry.qa.flags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {entry.qa.flags.map((f) => (
              <li key={f} className="rounded-full bg-gold-tint px-2.5 py-1 text-gold-deep">
                {BANDERAS_ES[f] ?? f}
              </li>
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
    </article>
  );
}
