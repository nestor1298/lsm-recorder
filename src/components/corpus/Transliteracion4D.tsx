"use client";

/**
 * Transliteracion4D — el enunciado en 4D: Lexsi seña, una tras otra, las
 * señas que se anotaron (con su forma, lugar, orientación y movimiento)
 * al ritmo del video, y abajo la línea de tiempo en 2D con una entrada
 * por seña. Tocar una entrada la repite sola; tocar la línea salta a
 * ese instante.
 *
 * Solo un enunciado a la vez tiene el avatar (un contexto WebGL); los
 * demás muestran un botón para traerlo.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { cuadroEn, cuatroD, entradaEn, type Entrada } from "@/lib/corpus/cuatro_d";
import type { SenaCorpus } from "@/lib/corpus/explorar";
import { poseDeSegmento } from "@/lib/learn_viewer";
import type { UBLocation } from "@/lib/ub_inventory";
import { useMenosMovimiento } from "@/components/lexico/ficha/reloj";
import type { FaceState } from "@/components/learn/RNMControls";

const Hand3DViewer = dynamic(() => import("@/components/Hand3D/Hand3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  ),
});

const aTarget = (u: UBLocation | null) => (u ? { code: u.code, region: u.region, name: u.name, x: u.x, y: u.y } : null);
const seg = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

// ── Qué enunciado tiene el avatar ──────────────────────────────

let activo: string | null = null;
const avisos = new Set<() => void>();
const suscribe = (cb: () => void) => {
  avisos.add(cb);
  return () => avisos.delete(cb);
};
function activa(id: string | null) {
  activo = id;
  avisos.forEach((cb) => cb());
}

// ── Reloj con bucle opcional sobre un tramo ────────────────────

const PAUSA_MS = 500;

function useReloj4D(total: number, arrancar: boolean) {
  const [t, setT] = useState(0);
  const [jugando, setJugando] = useState(arrancar);
  const [velocidad, setVelocidad] = useState(1);
  const [rango, setRango] = useState<{ a: number; b: number } | null>(null);
  const fase = useRef(0);

  useEffect(() => {
    if (!jugando || total <= 0) return;
    const a = rango?.a ?? 0;
    const b = rango?.b ?? total;
    const ciclo = b - a + PAUSA_MS;
    let raf = 0;
    let antes = performance.now();
    const tick = (ahora: number) => {
      fase.current = (fase.current + (ahora - antes) * velocidad) % ciclo;
      antes = ahora;
      setT(a + Math.min(fase.current, b - a));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [jugando, total, velocidad, rango]);

  /** Salta a `ms`; con `r`, repite solo ese tramo */
  const ir = useCallback(
    (ms: number, r: { a: number; b: number } | null = null) => {
      setRango(r);
      const a = r?.a ?? 0;
      const b = r?.b ?? total;
      const x = Math.max(a, Math.min(b, ms));
      fase.current = x - a;
      setT(x);
    },
    [total],
  );
  return { t, jugando, setJugando, velocidad, setVelocidad, rango, ir };
}

// ── La línea de tiempo en 2D ───────────────────────────────────

function Linea({
  entradas,
  total,
  t,
  sonando,
  elegida,
  onEntrada,
  onIr,
}: {
  entradas: Entrada[];
  total: number;
  t: number;
  sonando: string | null;
  elegida: number | null;
  onEntrada: (k: number) => void;
  onIr: (ms: number) => void;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const pct = (ms: number) => `${(ms / total) * 100}%`;
  return (
    // en pantallas chicas la línea se desliza de lado para que se lean las entradas
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div style={{ minWidth: entradas.length * 56 }}>
        <div
          ref={pista}
          className="relative h-16 cursor-pointer rounded-lg border border-gray-200 bg-paper"
          onPointerDown={(e) => {
            if (e.target !== pista.current) return;
            const r = pista.current.getBoundingClientRect();
            onIr(((e.clientX - r.left) / r.width) * total);
          }}
        >
          {entradas.map((e) => {
            const viva = sonando === e.id;
            const sel = elegida === e.k;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onEntrada(e.k)}
                aria-pressed={sel}
                title={`${e.etiqueta} · ${seg(e.inicio)}–${seg(e.fin)}`}
                style={{
                  left: pct(e.inicio),
                  width: `max(6px, ${pct(e.fin - e.inicio)})`,
                }}
                className={`absolute top-2 bottom-2 overflow-hidden rounded-md px-1 text-left text-[11px] leading-tight focus-visible:outline-2 focus-visible:outline-accent ${
                  e.glosa ? "bg-accent-tint text-accent-deep" : "bg-gray-100 font-mono text-gray-500"
                } ${viva ? "!bg-accent !text-white" : ""} ${sel ? "ring-2 ring-ink ring-offset-1" : ""}`}
              >
                <span className="block truncate font-medium">{e.etiqueta}</span>
              </button>
            );
          })}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded bg-ink"
            style={{ left: pct(t) }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-gray-400">
          <span>0 s</span>
          <span>{seg(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── El reproductor ─────────────────────────────────────────────

export default function Transliteracion4D({
  id,
  senas,
  elegida,
  onElige,
}: {
  id: string;
  senas: SenaCorpus[];
  /** índice (en `senas`) de la seña elegida, o null para toda la oración */
  elegida: number | null;
  onElige: (k: number | null) => void;
}) {
  const c = useMemo(() => cuatroD(id, senas), [id, senas]);
  const quieto = useMenosMovimiento();
  const reloj = useReloj4D(c.duracion, !quieto);
  const { ir } = reloj;
  const mio = useSyncExternalStore(
    suscribe,
    () => activo === id,
    () => false,
  );

  // al abrir, este enunciado se queda con el avatar
  useEffect(() => {
    activa(id);
    return () => {
      if (activo === id) activa(null);
    };
  }, [id]);

  // la seña elegida (desde la línea o desde su tarjeta) se repite sola
  useEffect(() => {
    const e = elegida === null ? null : c.entradas.find((x) => x.k === elegida);
    if (e)
      ir(e.inicio, {
        a: Math.max(0, e.inicio - 150),
        b: Math.min(c.duracion, e.fin + 150),
      });
    else ir(0, null);
  }, [elegida, c, ir]);

  const { indice, t } = cuadroEn(c, reloj.t);
  const pose = poseDeSegmento(c.sign, indice, t);
  const sonando = entradaEn(c, reloj.t);
  const sel = elegida === null ? null : (c.entradas.find((x) => x.k === elegida) ?? null);
  const glosadas = c.entradas.filter((e) => e.glosa).length;

  return (
    <section aria-label="Transliteración en 4D" className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,17rem)_1fr]">
        <div className="relative h-72 overflow-hidden rounded-lg bg-paper md:h-auto md:min-h-72">
          {mio ? (
            <Hand3DViewer
              forceAvatar
              sinMarco
              encuadre="torso"
              autoRotate={false}
              cm={pose.cm}
              orientation={pose.orientation}
              ubLocation={aTarget(pose.ubLocation)}
              rnm={pose.rnm as FaceState}
              movementInterp={pose.movementInterp}
              handMode={pose.handMode}
              isBuildMode
              height="100%"
              className="h-full w-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => activa(id)}
              className="flex h-full w-full items-center justify-center text-sm font-medium text-gray-600 hover:text-accent-deep"
            >
              Ver en 4D aquí
            </button>
          )}
          <p
            className="pointer-events-none absolute left-3 top-2 max-w-[85%] truncate font-display text-lg font-bold text-ink"
            aria-live="off"
          >
            {sonando?.etiqueta ?? ""}
          </p>
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <h3 className="font-display text-lg font-bold tracking-[-0.01em] text-ink">Transliteración en 4D</h3>
            <p className="text-[13px] leading-relaxed text-gray-600">
              Lexsi seña lo que se anotó de cada seña —forma, lugar, orientación y movimiento— al ritmo del video. Es una
              reconstrucción desde la anotación, no la persona: sirve para ver si la anotación dice lo que se señó. Toca una
              entrada para repetirla sola.
            </p>
          </div>

          <Linea
            entradas={c.entradas}
            total={c.duracion}
            t={reloj.t}
            sonando={sonando?.id ?? null}
            elegida={elegida}
            onEntrada={(k) => onElige(elegida === k ? null : k)}
            onIr={(ms) => {
              onElige(null);
              ir(ms, null);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => reloj.setJugando(!reloj.jugando)}
              aria-label={reloj.jugando ? "Pausa" : "Reproducir"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white hover:bg-gray-800"
            >
              {reloj.jugando ? (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <rect x="3" y="2" width="3.5" height="12" rx="1" />
                  <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M4 2.5v11l9-5.5z" />
                </svg>
              )}
            </button>
            <span className="font-mono text-xs tabular-nums text-gray-600">
              {seg(reloj.t)} / {seg(c.duracion)}
            </span>
            <div className="flex rounded-full bg-gray-200 p-0.5" role="group" aria-label="Velocidad">
              {[0.5, 1].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={reloj.velocidad === v}
                  onClick={() => reloj.setVelocidad(v)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${reloj.velocidad === v ? "bg-paper text-ink" : "text-gray-600"}`}
                >
                  {v}×
                </button>
              ))}
            </div>
            {elegida !== null && (
              <button
                type="button"
                onClick={() => onElige(null)}
                className="text-xs font-medium text-gray-600 hover:text-accent-deep"
              >
                Toda la oración
              </button>
            )}
            <span className="ml-auto text-xs text-gray-500">
              {c.entradas.length} {c.entradas.length === 1 ? "entrada" : "entradas"} · {glosadas} con glosa
            </span>
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 bg-paper px-3 py-2 text-xs text-gray-600">
            {sel ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-ink">{sel.etiqueta}</span>
                <span className="font-mono text-gray-400">{sel.id}</span>
                <span className="rounded bg-gold-tint px-1.5 py-0.5 text-gold-deep">revisión pendiente</span>
                <span>Falta que la confirmen anotadores Sordos y lingüistas en la plataforma de anotación.</span>
              </p>
            ) : (
              <p>
                <span className="rounded bg-gold-tint px-1.5 py-0.5 text-gold-deep">revisión pendiente</span> Ninguna entrada se
                ha revisado todavía. Cada una tiene un id fijo para que anotadores Sordos y lingüistas puedan confirmarla o
                corregirla.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
