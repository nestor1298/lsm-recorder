"use client";

/**
 * TimelineMulticanal — la línea de tiempo del modo experto.
 *
 * Rejilla de canales apilados: etiqueta fija a la izquierda y lienzo de
 * tiempo a la derecha. Cada canal es una PROYECCIÓN de PSHRSegment[]
 * (ver src/lib/timeline/channels.ts); las fronteras se editan solo en el
 * canal maestro y los demás se redibujan a partir de ahí.
 *
 * Las etiquetas no se desplazan porque el recorrido es por viewport
 * (zoom/pan sobre el mismo ancho), no por barra de scroll: nunca salen
 * del encuadre.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PSHRSegment, Phase, SignAnnotation } from "@/lib/types";
import {
  CANALES,
  proyectar,
  describirTramo,
  puntosDeCambio,
  type CanalDef,
  type CanalId,
  type Tramo,
} from "@/lib/timeline/channels";
import {
  fit,
  timeToPx,
  pxToTime,
  snapMs,
  clampView,
  zoomAt,
  panBy,
  zoomToRange,
  type Bounds,
  type Viewport,
} from "@/lib/timeline/viewport";
import {
  clasificarRueda,
  clasificarTecla,
  estadoPellizco,
  factorPellizco,
  panPellizco,
  transformacionCapa,
  type EstadoPellizco,
} from "@/lib/timeline/gestures";
import {
  ZOOM_TO_RANGE_PADDING,
  ASSUMED_FPS,
  SNAP_THRESHOLD_PX,
  FRAME_TICKS_BELOW_MS_PER_PX,
  GRAB_PX_FINE,
  GRAB_PX_COARSE,
} from "@/lib/timeline/constants";
import {
  moverFrontera,
  frameMs,
  candidatosImantado,
} from "@/lib/timeline/boundaries";
import {
  cargarPrefs,
  guardarPrefs,
  canalVisible,
  type TimelinePrefs,
} from "@/lib/timeline/prefs";
import {
  PHASE_ES,
  TIMELINE_ES,
  PROVENANCE_CHIP,
  OR_GLIFO,
  CONTOUR_ES,
} from "@/lib/anotar_labels";
import { CM_INVENTORY } from "@/lib/data";
import { MiniHand } from "@/components/learn/MiniHand";
import Regla from "./Regla";

const LABEL_W = 112; // ancho de la columna de etiquetas (px)

const PHASE_LABEL: Record<Phase, string> = {
  PREPARATION: "P",
  STROKE: "S",
  HOLD: "H",
  RETRACTION: "R",
};

/** Tipo y fase se distinguen por forma/patrón, no solo por color. */
const PHASE_CLASS: Record<Phase, string> = {
  PREPARATION: "bg-gray-100 text-gray-700 border-gray-300 border-dashed",
  STROKE: "bg-accent-tint text-accent-deep border-accent",
  HOLD: "bg-green-tint text-green-deep border-green border-dotted",
  RETRACTION: "bg-gold-tint text-gold-deep border-gold border-dashed",
};

/** Trazo esquemático del contorno, para el canal de movimiento. */
function TrazoContorno({ contour }: { contour?: string }) {
  if (!contour) return null;
  const s = {
    stroke: "currentColor",
    strokeWidth: 1.6,
    fill: "none",
    strokeLinecap: "round" as const,
  };
  const d: Record<string, string> = {
    STRAIGHT: "M2 8 H22",
    ARC: "M2 12 Q12 1 22 10",
    CIRCLE: "M17 4 A6 6 0 1 1 16 13",
    ZIGZAG: "M2 5 L7 12 L12 5 L17 12 L22 5",
    SEVEN: "M4 4 H18 L10 13",
  };
  return (
    <svg viewBox="0 0 24 16" className="h-3 w-6 shrink-0" aria-hidden>
      <path d={d[contour] ?? d.STRAIGHT} {...s} />
    </svg>
  );
}

/** Contenido dibujado dentro de un tramo, según el canal. */
function ContenidoTramo({
  canal,
  tramo,
  anchoPx,
}: {
  canal: CanalDef;
  tramo: Tramo;
  anchoPx: number;
}) {
  const data = tramo.data ?? {};
  if (canal.id === "mano" && anchoPx > 46) {
    const cm = CM_INVENTORY.find((c) => c.cm_id === data.cmId);
    return (
      <span className="flex items-center gap-1 overflow-hidden">
        {cm && <MiniHand cm={cm} size={16} />}
        <span className="truncate">{tramo.label}</span>
      </span>
    );
  }
  if (canal.id === "orientacion") {
    const g = OR_GLIFO[(data.dir as string) ?? "NEUTRAL"] ?? "·";
    return (
      <span className="flex items-center gap-1 overflow-hidden">
        <span aria-hidden>{g}</span>
        {anchoPx > 54 && <span className="truncate">{tramo.label}</span>}
      </span>
    );
  }
  if (canal.id === "movimiento") {
    const rep = data.repetition as { count: number } | undefined;
    return (
      <span className="flex items-center gap-1 overflow-hidden">
        <TrazoContorno contour={data.contour as string | undefined} />
        {rep && rep.count > 1 && (
          <span aria-hidden className="tracking-tighter">
            {"·".repeat(Math.min(4, rep.count))}
          </span>
        )}
        {anchoPx > 70 && (
          <span className="truncate">
            {typeof data.contour === "string"
              ? (CONTOUR_ES[data.contour as keyof typeof CONTOUR_ES] ??
                tramo.label)
              : tramo.label}
          </span>
        )}
      </span>
    );
  }
  return <span className="truncate">{tramo.label}</span>;
}

type DragState =
  | { kind: "scrub" }
  | { kind: "frontera"; id: string; edge: "start" | "end" }
  | { kind: "mover"; id: string; agarreMs: number };

export interface TimelineMulticanalProps {
  annotation: SignAnnotation;
  durationMs: number;
  currentTimeMs: number;
  selectedSegmentId: string | null;
  fps?: number;
  onSeek: (ms: number) => void;
  onSegmentSelect: (id: string) => void;
  onChannelSelect?: (canal: string) => void;
  onSegmentUpdate: (id: string, updates: Partial<PSHRSegment>) => void;
  onSegmentsReplace: (segments: PSHRSegment[]) => void;
  onSegmentAdd: (segment: PSHRSegment) => void;
  onSegmentDelete: (id: string) => void;
}

export default function TimelineMulticanal({
  annotation,
  durationMs,
  currentTimeMs,
  selectedSegmentId,
  fps,
  onSeek,
  onSegmentSelect,
  onChannelSelect,
  onSegmentUpdate,
  onSegmentsReplace,
  onSegmentAdd,
  onSegmentDelete,
}: TimelineMulticanalProps) {
  const lienzoRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [ancho, setAncho] = useState(0);
  const [view, setView] = useState<Viewport | null>(null);
  const [prefs, setPrefs] = useState<TimelinePrefs>(cargarPrefs);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [addMode, setAddMode] = useState<Phase | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  // Gesto en curso: se previsualiza con transform sobre las capas y se
  // hace commit al soltar (nunca un render de React por cuadro).
  const rejillaRef = useRef<HTMLDivElement>(null);
  const gestoRef = useRef<{
    vistaInicial: Viewport;
    vistaActual: Viewport;
    pellizco?: EstadoPellizco;
  } | null>(null);
  const punterosRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const rafRef = useRef(0);
  // Edición de frontera: se previsualiza en el DOM y se escribe al
  // soltar, para no llenar el historial ni re-renderizar por movimiento.
  const edicionRef = useRef<{
    candidatos: number[];
    ultimo: PSHRSegment[] | null;
  } | null>(null);
  const indicadorRef = useRef<HTMLDivElement>(null);
  const punteroGrueso = useRef(false);
  useEffect(() => {
    punteroGrueso.current =
      window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  }, []);

  const segmentos = annotation.segments;
  const total = Math.max(
    durationMs,
    segmentos.length ? Math.max(...segmentos.map((s) => s.end_ms)) : 0,
    1,
  );
  const bounds: Bounds = useMemo(
    () => ({ startMs: 0, endMs: total }),
    [total],
  );

  // Un solo ResizeObserver para el ancho del lienzo.
  useEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setAncho(w);
    });
    ro.observe(el);
    setAncho(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Vista inicial y re-encaje cuando cambian ancho o duración.
  useEffect(() => {
    if (ancho <= 0) return;
    setView((v) => (v ? clampView(v, bounds, ancho) : fit(bounds, ancho)));
  }, [ancho, bounds]);

  useEffect(() => {
    guardarPrefs(prefs);
  }, [prefs]);

  const vista = view ?? fit(bounds, Math.max(1, ancho));
  const px = useCallback((ms: number) => timeToPx(vista, ms), [vista]);

  const clientXToMs = useCallback(
    (clientX: number) => {
      const el = lienzoRef.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return pxToTime(vista, clientX - r.left);
    },
    [vista],
  );

  // ── Arrastre (scrub / frontera / mover) ──────────────────────
  /** Pinta la previsualización de la frontera directamente en el DOM. */
  const pintarFrontera = useCallback(
    (previos: PSHRSegment[], msFrontera: number, imantado: boolean) => {
      const raiz = rejillaRef.current;
      if (!raiz) return;
      for (const seg of previos) {
        const el = raiz.querySelector<HTMLElement>(`[data-seg="${seg.id}"]`);
        if (!el) continue;
        const izq = px(seg.start_ms);
        el.style.left = `${izq}px`;
        el.style.width = `${Math.max(2, px(seg.end_ms) - izq)}px`;
      }
      const ind = indicadorRef.current;
      if (ind) {
        const orden = [...previos].sort((a, b) => a.start_ms - b.start_ms);
        const i = orden.findIndex(
          (sg) => Math.abs(sg.end_ms - msFrontera) < 1 || Math.abs(sg.start_ms - msFrontera) < 1,
        );
        const a = orden[i];
        const b = orden[i + 1];
        ind.style.display = "block";
        ind.style.left = `${LABEL_W + px(msFrontera)}px`;
        ind.dataset.imantado = imantado ? "1" : "0";
        ind.textContent =
          `${Math.round(msFrontera)} ms` +
          (a ? ` · ${Math.round(a.end_ms - a.start_ms)} ms` : "") +
          (b ? ` | ${Math.round(b.end_ms - b.start_ms)} ms` : "") +
          (imantado ? " ·imán" : "");
      }
    },
    [px],
  );

  const aplicarArrastre = useCallback(
    (clientX: number, altKey = false) => {
      const drag = dragRef.current;
      if (!drag) return;
      const ms = clientXToMs(clientX);
      if (drag.kind === "scrub") {
        onSeek(Math.max(0, Math.min(total, ms)));
        return;
      }
      const seg = segmentos.find((s) => s.id === drag.id);
      if (!seg) return;

      if (drag.kind === "frontera") {
        const ed = edicionRef.current;
        // Imantado: se apaga con ⌥ mientras dura el arrastre.
        const conIman = prefs.imantado && !altKey && ed;
        let destino = ms;
        let imantado = false;
        if (conIman) {
          const candidatos = candidatosImantado({
            playheadMs: currentTimeMs,
            clip: { startMs: 0, endMs: total },
            cambios: ed!.candidatos,
            // las marcas de cuadro solo cuentan cuando se están viendo
            conCuadros: vista.msPerPx <= FRAME_TICKS_BELOW_MS_PER_PX,
            fps,
            cercaDeMs: ms,
          });
          const r = snapMs(ms, candidatos, vista.msPerPx, SNAP_THRESHOLD_PX);
          destino = r.ms;
          imantado = r.snapped;
        }
        const previos = moverFrontera(segmentos, seg.id, drag.edge, destino, {
          clip: { startMs: 0, endMs: total },
          minDurMs: frameMs(fps),
        });
        if (ed) ed.ultimo = previos;
        pintarFrontera(previos, destino, imantado);
        return;
      }

      const w = seg.end_ms - seg.start_ms;
      const start = Math.max(0, Math.min(total - w, ms - drag.agarreMs));
      onSegmentUpdate(seg.id, { start_ms: start, end_ms: start + w });
    },
    [
      clientXToMs,
      onSeek,
      total,
      segmentos,
      onSegmentUpdate,
      fps,
      prefs.imantado,
      currentTimeMs,
      vista.msPerPx,
      pintarFrontera,
    ],
  );

  useEffect(() => {
    if (!arrastrando) return;
    const move = (ev: PointerEvent) => {
      ev.preventDefault();
      aplicarArrastre(ev.clientX, ev.altKey);
    };
    const up = () => {
      // La escritura ocurre AQUÍ, una sola vez, no en cada movimiento.
      const ed = edicionRef.current;
      if (dragRef.current?.kind === "frontera" && ed?.ultimo) {
        onSegmentsReplace(ed.ultimo);
      }
      edicionRef.current = null;
      if (indicadorRef.current) indicadorRef.current.style.display = "none";
      dragRef.current = null;
      setArrastrando(false);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [arrastrando, aplicarArrastre, onSegmentsReplace]);

  // ── Previsualización del gesto con transform ─────────────────
  const capas = useCallback(
    () =>
      Array.from(
        rejillaRef.current?.querySelectorAll<HTMLElement>("[data-capa]") ?? [],
      ),
    [],
  );

  const pintarGesto = useCallback(
    (destino: Viewport) => {
      const g = gestoRef.current;
      if (!g) return;
      g.vistaActual = destino;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const { scaleX, translateX } = transformacionCapa(
          g.vistaInicial,
          g.vistaActual,
        );
        for (const capa of capas()) {
          capa.style.transformOrigin = "left center";
          capa.style.transform = `translateX(${translateX}px) scaleX(${scaleX})`;
        }
      });
    },
    [capas],
  );

  const terminarGesto = useCallback(() => {
    const g = gestoRef.current;
    gestoRef.current = null;
    cancelAnimationFrame(rafRef.current);
    for (const capa of capas()) capa.style.transform = "";
    if (g) setView(g.vistaActual);
  }, [capas]);

  const iniciarGesto = useCallback(
    (pellizco?: EstadoPellizco) => {
      gestoRef.current = {
        vistaInicial: vista,
        vistaActual: vista,
        pellizco,
      };
    },
    [vista],
  );

  const iniciarArrastre = (e: React.PointerEvent, st: DragState) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = st;
    if (st.kind === "frontera") {
      // los puntos de cambio de los DEMÁS canales son candidatos de imán
      edicionRef.current = {
        candidatos: puntosDeCambio(segmentos, annotation),
        ultimo: null,
      };
    }
    setArrastrando(true);
  };

  // ── Rueda y pellizco de trackpad ─────────────────────────────
  useEffect(() => {
    const el = rejillaRef.current;
    if (!el || ancho <= 0) return;
    const onWheel = (ev: WheelEvent) => {
      const accion = clasificarRueda(ev);
      if (accion.kind === "nada") return;
      // Sin preventDefault el navegador hace zoom de la página entera.
      ev.preventDefault();
      const lienzo = lienzoRef.current?.getBoundingClientRect();
      const anclaPx = lienzo
        ? Math.max(0, Math.min(ancho, ev.clientX - lienzo.left))
        : ancho / 2;
      setView((v) => {
        const actual = v ?? fit(bounds, ancho);
        return accion.kind === "zoom"
          ? zoomAt(actual, accion.factor, anclaPx, bounds, ancho)
          : panBy(actual, accion.deltaPx, bounds, ancho);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ancho, bounds]);

  // ── Pellizco táctil (dos punteros) ───────────────────────────
  useEffect(() => {
    const el = rejillaRef.current;
    if (!el || ancho <= 0) return;

    const posicion = (ev: PointerEvent) => ({ x: ev.clientX, y: ev.clientY });

    const onDown = (ev: PointerEvent) => {
      punterosRef.current.set(ev.pointerId, posicion(ev));
      if (punterosRef.current.size === 2) {
        // Un pellizco cancela cualquier arrastre de frontera en curso.
        dragRef.current = null;
        setArrastrando(false);
        const [a, b] = [...punterosRef.current.values()];
        iniciarGesto(estadoPellizco(a, b));
      }
    };

    const onMove = (ev: PointerEvent) => {
      if (!punterosRef.current.has(ev.pointerId)) return;
      punterosRef.current.set(ev.pointerId, posicion(ev));
      const g = gestoRef.current;
      if (punterosRef.current.size !== 2 || !g?.pellizco) return;
      ev.preventDefault();
      const [a, b] = [...punterosRef.current.values()];
      const ahora = estadoPellizco(a, b);
      const lienzo = lienzoRef.current?.getBoundingClientRect();
      const anclaPx = lienzo
        ? Math.max(0, Math.min(ancho, ahora.centroideX - lienzo.left))
        : ancho / 2;
      // Zoom por distancia y desplazamiento por centroide, en el mismo
      // gesto continuo.
      let destino = zoomAt(
        g.vistaActual,
        factorPellizco(g.pellizco, ahora),
        anclaPx,
        bounds,
        ancho,
      );
      destino = panBy(destino, panPellizco(g.pellizco, ahora), bounds, ancho);
      g.pellizco = ahora;
      pintarGesto(destino);
    };

    const onUp = (ev: PointerEvent) => {
      punterosRef.current.delete(ev.pointerId);
      if (punterosRef.current.size < 2 && gestoRef.current) terminarGesto();
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [ancho, bounds, iniciarGesto, pintarGesto, terminarGesto]);

  // ── Teclado ──────────────────────────────────────────────────
  const cuadroMs = 1000 / (fps ?? ASSUMED_FPS);
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const accion = clasificarTecla(e);
      if (accion.kind === "nada") return;
      e.preventDefault();
      switch (accion.kind) {
        case "zoom":
          // forma funcional: varias pulsaciones seguidas se encadenan
          setView((v) => {
            const actual = v ?? fit(bounds, Math.max(1, ancho));
            return zoomAt(
              actual,
              accion.factor,
              timeToPx(actual, currentTimeMs),
              bounds,
              ancho,
            );
          });
          break;
        case "fit":
          setView(fit(bounds, ancho));
          break;
        case "fitSeleccion": {
          const sel = segmentos.find((s) => s.id === selectedSegmentId);
          if (sel)
            setView(
              zoomToRange(
                sel.start_ms,
                sel.end_ms,
                ancho,
                ZOOM_TO_RANGE_PADDING,
                bounds,
              ),
            );
          break;
        }
        case "seek":
          onSeek(
            Math.max(
              0,
              Math.min(total, currentTimeMs + accion.cuadros * cuadroMs),
            ),
          );
          break;
        case "inicio":
          onSeek(0);
          break;
        case "fin":
          onSeek(total);
          break;
      }
    },
    [
      bounds,
      ancho,
      currentTimeMs,
      segmentos,
      selectedSegmentId,
      onSeek,
      total,
      cuadroMs,
    ],
  );

  const onReglaDown = (e: React.PointerEvent) => {
    const ms = Math.max(0, Math.min(total, clientXToMs(e.clientX)));
    if (addMode) {
      const mitad = Math.min(total * 0.05, 250);
      onSegmentAdd({
        id: crypto.randomUUID(),
        type: addMode === "STROKE" ? "M" : addMode === "HOLD" ? "D" : "T",
        phase: addMode,
        start_ms: Math.max(0, ms - mitad),
        end_ms: Math.min(total, ms + mitad),
      });
      setAddMode(null);
      return;
    }
    dragRef.current = { kind: "scrub" };
    setArrastrando(true);
    onSeek(ms);
  };

  // Trazo de 2 px, pero área efectiva mayor en táctil.
  const agarrePx = punteroGrueso.current ? GRAB_PX_COARSE : GRAB_PX_FINE;
  const visibles = CANALES.filter((c) => canalVisible(prefs, c.id));
  const seleccionado = segmentos.find((s) => s.id === selectedSegmentId);
  const playheadPx = px(currentTimeMs);

  // ── Fila de un canal (o de una sub-fila) ─────────────────────
  const filaCanal = (canal: CanalDef, subfila?: { id: string; label: string }) => {
    const tramos = proyectar(segmentos, canal.id, annotation, subfila?.id);
    const alto = subfila ? Math.max(18, prefs.alturaFila - 10) : prefs.alturaFila;
    return (
      <div
        key={`${canal.id}-${subfila?.id ?? "u"}`}
        className="flex items-stretch border-b border-gray-100 last:border-0"
        role="group"
        aria-label={subfila ? `${canal.label}, ${subfila.label}` : canal.label}
      >
        <div
          className="flex shrink-0 items-center justify-end gap-1 bg-paper pr-2 text-right"
          style={{ width: LABEL_W }}
        >
          <span
            className={`truncate ${
              subfila
                ? "text-[10px] text-gray-400"
                : "text-[10px] font-semibold uppercase tracking-wide text-gray-500"
            }`}
          >
            {subfila ? subfila.label : canal.label}
          </span>
          {!subfila && canal.tecnico && (
            <span className="hidden text-[9px] text-gray-300 sm:inline">
              {canal.tecnico}
            </span>
          )}
        </div>
        <div
          className="relative flex-1 overflow-hidden bg-gray-50"
          style={{ height: alto, touchAction: "none" }}
        >
          {/* carril de hueco: textura tenue = esa dimensión no se anotó */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 5px, #E5E7EB 5px 6px)",
            }}
            aria-hidden
          />
          <div data-capa className="absolute inset-0 will-change-transform">
          {tramos.map((t) => {
            const izq = px(t.startMs);
            const anchoTramo = Math.max(2, px(t.endMs) - izq);
            if (
              izq > (lienzoRef.current?.clientWidth ?? anchoTramo) ||
              izq + anchoTramo < 0
            )
              return null;
            const activo = t.segmentIds.includes(selectedSegmentId ?? "");
            const esMaestro = canal.maestro;
            const fase = (t.data?.phase as Phase | undefined) ?? "STROKE";
            return (
              <div
                key={`${t.key}-${t.startMs}`}
                data-seg={esMaestro ? t.segmentIds[0] : undefined}
                className={`absolute top-1 flex items-stretch rounded-md border text-[10px] font-medium ${
                  esMaestro
                    ? PHASE_CLASS[fase]
                    : activo
                      ? "border-accent bg-accent-tint text-accent-deep"
                      : "border-gray-200 bg-paper text-gray-700"
                } ${activo && esMaestro ? "ring-2 ring-ink" : ""}`}
                style={{ left: izq, width: anchoTramo, height: alto - 8 }}
              >
                {esMaestro && (
                  <button
                    onPointerDown={(e) =>
                      iniciarArrastre(e, {
                        kind: "frontera",
                        id: t.segmentIds[0],
                        edge: "start",
                      })
                    }
                    aria-label={`Mover el inicio del segmento, ${Math.round(t.startMs)} milisegundos`}
                    style={{ width: agarrePx, marginLeft: -(agarrePx - 2) / 2 }}
                    className="relative z-10 shrink-0 cursor-ew-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span
                      className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-current opacity-40"
                      aria-hidden
                    />
                  </button>
                )}
                <button
                  onPointerDown={(e) => {
                    if (!esMaestro) return;
                    iniciarArrastre(e, {
                      kind: "mover",
                      id: t.segmentIds[0],
                      agarreMs: clientXToMs(e.clientX) - t.startMs,
                    });
                  }}
                  onClick={() => {
                    onSegmentSelect(t.segmentIds[0]);
                    if (!esMaestro) onChannelSelect?.(canal.id);
                  }}
                  onDoubleClick={() =>
                    setView(
                      zoomToRange(
                        t.startMs,
                        t.endMs,
                        ancho,
                        ZOOM_TO_RANGE_PADDING,
                        bounds,
                      ),
                    )
                  }
                  aria-label={describirTramo(t, canal)}
                  className={`flex flex-1 items-center gap-1 truncate px-1 text-left ${
                    esMaestro ? "cursor-grab active:cursor-grabbing" : ""
                  }`}
                >
                  {esMaestro ? (
                    <span className="truncate">
                      {String(t.data?.type ?? "")} · {PHASE_ES[fase]}
                    </span>
                  ) : (
                    <ContenidoTramo canal={canal} tramo={t} anchoPx={anchoTramo} />
                  )}
                  {t.provenance === "auto" && anchoTramo > 90 && (
                    <span className="ml-auto shrink-0 rounded bg-accent-tint px-1 text-[9px] font-semibold text-accent-deep">
                      {PROVENANCE_CHIP}
                    </span>
                  )}
                </button>
                {esMaestro && (
                  <button
                    onPointerDown={(e) =>
                      iniciarArrastre(e, {
                        kind: "frontera",
                        id: t.segmentIds[0],
                        edge: "end",
                      })
                    }
                    aria-label={`Mover el final del segmento, ${Math.round(t.endMs)} milisegundos`}
                    style={{ width: agarrePx, marginRight: -(agarrePx - 2) / 2 }}
                    className="relative z-10 shrink-0 cursor-ew-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span
                      className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-current opacity-40"
                      aria-hidden
                    />
                  </button>
                )}
                {/* divisorias tenues de los segmentos fusionados */}
                {t.divisiones.map((d) => (
                  <span
                    key={d}
                    className="pointer-events-none absolute top-0 h-full w-px bg-gray-300/70"
                    style={{ left: px(d) - izq }}
                    aria-hidden
                  />
                ))}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="select-none">
      {/* Controles */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500">
          {TIMELINE_ES.agregar}:
        </span>
        {(["PREPARATION", "STROKE", "HOLD", "RETRACTION"] as Phase[]).map(
          (ph) => (
            <button
              key={ph}
              onClick={() => setAddMode(addMode === ph ? null : ph)}
              aria-pressed={addMode === ph}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                addMode === ph
                  ? "border-ink bg-ink text-paper"
                  : `${PHASE_CLASS[ph]} hover:opacity-80`
              }`}
            >
              {PHASE_LABEL[ph]} · {PHASE_ES[ph].toLowerCase()}
            </button>
          ),
        )}
        <div className="flex-1" />
        {seleccionado && (
          <button
            onClick={() => onSegmentDelete(seleccionado.id)}
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-coral-deep hover:bg-coral-tint"
          >
            {TIMELINE_ES.eliminarSegmento}
          </button>
        )}
        {/* Menú de canales */}
        <div className="relative">
          <button
            onClick={() => setMenuAbierto((m) => !m)}
            aria-expanded={menuAbierto}
            className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-200"
          >
            {TIMELINE_ES.canales}
          </button>
          {menuAbierto && (
            <div className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-gray-200 bg-paper p-2 shadow-card">
              {CANALES.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
                    c.maestro ? "opacity-60" : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={canalVisible(prefs, c.id)}
                    disabled={c.maestro}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        canales: { ...p.canales, [c.id]: e.target.checked },
                      }))
                    }
                    className="h-3.5 w-3.5 rounded border-gray-300 text-accent-deep"
                  />
                  <span className="text-ink">{c.label}</span>
                  {c.tecnico && (
                    <span className="ml-auto text-[10px] text-gray-400">
                      {c.tecnico}
                    </span>
                  )}
                </label>
              ))}
              <div className="mt-1 border-t border-gray-100 pt-2">
                <label className="flex items-center gap-2 px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={prefs.seguirReproduccion}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        seguirReproduccion: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 rounded border-gray-300 text-accent-deep"
                  />
                  {TIMELINE_ES.seguirReproduccion}
                </label>
                <label className="flex items-center gap-2 px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={prefs.imantado}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, imantado: e.target.checked }))
                    }
                    className="h-3.5 w-3.5 rounded border-gray-300 text-accent-deep"
                  />
                  {TIMELINE_ES.imantado}
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rejilla */}
      <div
        ref={rejillaRef}
        onKeyDown={onKeyDown}
        tabIndex={0}
        aria-label="Línea de tiempo y canales"
        className="relative rounded-lg border border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* Regla */}
        <div className="flex items-stretch border-b border-gray-100">
          <div className="shrink-0 bg-paper" style={{ width: LABEL_W }} />
          <div
            ref={lienzoRef}
            onPointerDown={onReglaDown}
            className="relative h-[26px] flex-1 cursor-ew-resize bg-gray-100"
            style={{ touchAction: "none" }}
            role="slider"
            aria-label="Momento del video"
            aria-valuemin={0}
            aria-valuemax={Math.round(total)}
            aria-valuenow={Math.round(currentTimeMs)}
            tabIndex={0}
          >
            {ancho > 0 && (
              <div data-capa className="will-change-transform">
                <Regla view={vista} widthPx={ancho} fps={fps} />
              </div>
            )}
          </div>
        </div>

        {/* Canales */}
        {visibles.map((c) =>
          c.subfilas ? (
            <div key={c.id}>
              <div className="flex items-stretch bg-paper">
                <div
                  className="shrink-0 pr-2 pt-1 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                  style={{ width: LABEL_W }}
                >
                  {c.label}
                </div>
                <div className="flex-1" />
              </div>
              {c.subfilas.map((sf) => filaCanal(c, sf))}
            </div>
          ) : (
            filaCanal(c)
          ),
        )}

        {/* Indicador flotante durante el arrastre de una frontera */}
        <div
          ref={indicadorRef}
          style={{ display: "none" }}
          className="pointer-events-none absolute -top-6 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-1 text-[10px] font-semibold text-paper shadow data-[imantado=1]:bg-accent-deep"
          aria-live="polite"
        />

        {/* Playhead sobre todos los canales */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-coral"
          style={{ left: LABEL_W + playheadPx }}
        >
          <button
            onPointerDown={(e) => iniciarArrastre(e, { kind: "scrub" })}
            aria-label="Arrastrar la aguja de tiempo"
            className="pointer-events-auto absolute -left-2 -top-1 h-4 w-4 cursor-ew-resize rounded-full border-2 border-paper bg-coral shadow"
          />
        </div>
      </div>

      {segmentos.length === 0 && (
        <p className="mt-2 rounded-lg border border-dashed border-gray-300 p-3 text-center text-xs text-gray-400">
          Sube un video para que la visión proponga los segmentos, o
          agrégalos con los botones de arriba.
        </p>
      )}
    </div>
  );
}
