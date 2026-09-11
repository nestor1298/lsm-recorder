"use client";

/**
 * /learn — Representación fonológica LSM.
 *
 * Dos modos, con el avatar siempre como protagonista (el modelo de la
 * mano aislada queda descartado):
 *  - Explorar: los cinco parámetros de Cruz Aldrete (CM, UB, OR, MV,
 *    RNM) en una barra de pestañas, cada uno con su descripción.
 *  - Construir: la matriz segmental ocupa la parte baja de la pantalla y
 *    se llena casilla por casilla; el avatar ejecuta lo que dice.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CMEntry } from "@/lib/types";
import { CM_INVENTORY } from "@/lib/data";
import { UB_LOCATIONS, type UBLocation } from "@/lib/ub_inventory";
import { CODIGO_ESPACIO_NEUTRO } from "@/lib/ub_anatomia";
import {
  createSignaMinima,
  movimientoHabilitado,
  senaReproducible,
  type SignConstruction,
  type HoldSegment,
} from "@/lib/sign_types";
import {
  getPlaybackFrame,
  computeTotalDuration,
  DEFAULT_PLAYBACK_CONFIG,
} from "@/lib/sign_playback";
import { poseDeSegmento, type PoseAvatar } from "@/lib/learn_viewer";
import {
  APRENDER_ES,
  PARAMETROS,
  type ParametroId,
} from "@/lib/learn_labels";
import ModoToggle, { type Modo } from "@/components/aprender/ModoToggle";
import TabsParametros from "@/components/aprender/TabsParametros";
import MatrizSegmental, {
  type CeldaSel,
} from "@/components/aprender/MatrizSegmental";
import EditorCasilla from "@/components/aprender/EditorCasilla";
import CMControls from "@/components/learn/CMControls";
import UBControls from "@/components/learn/UBControls";
import ORControls from "@/components/learn/ORControls";
import MVControls from "@/components/learn/MVControls";
import RNMControls, { type FaceState } from "@/components/learn/RNMControls";

const Hand3DViewer = dynamic(() => import("@/components/Hand3D/Hand3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  ),
});

const CARA_NEUTRA: FaceState = {
  eyebrows: "NEUTRAL",
  mouth: "NEUTRAL",
  head: "NONE",
};
const MANO_ABIERTA: CMEntry = CM_INVENTORY[0];
const ubPor = (code: string) =>
  UB_LOCATIONS.find((l) => l.code === code) ?? null;
/** Espacio neutro frente al pecho: ahí se muestran formas y orientaciones
 *  sin tocar el cuerpo (cualquier orientación es posible). */
const NEUTRO: UBLocation = {
  code: CODIGO_ESPACIO_NEUTRO,
  region: "NEUTRAL_SPACE",
  name: "Espacio neutro",
  x: 100,
  y: 190,
};

/** Media velocidad: el doble de tiempo por detención y por movimiento. */
const RITMO_LENTO = {
  holdDuration: DEFAULT_PLAYBACK_CONFIG.holdDuration * 2,
  movementDuration: DEFAULT_PLAYBACK_CONFIG.movementDuration * 2,
};

/** Vaivén 0→1→0 para previsualizar movimientos en bucle. */
function useVaiven(activo: boolean, periodoMs = 1600): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!activo) return;
    const reducido =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (reducido) {
      // pose intermedia fija, sin animación
      raf = requestAnimationFrame(() => setT(0.5));
      return () => cancelAnimationFrame(raf);
    }
    const inicio = performance.now();
    const tick = (ahora: number) => {
      const fase = ((ahora - inicio) % periodoMs) / periodoMs;
      setT(fase < 0.5 ? fase * 2 : 2 - fase * 2);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activo, periodoMs]);
  return t;
}

/** Tamaño de un elemento (0 × 0 mientras no existe). */
function useTamano<T extends HTMLElement>(): [
  (el: T | null) => void,
  { w: number; h: number },
] {
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const obs = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    obs.current?.disconnect();
    if (!el) {
      setTam({ w: 0, h: 0 });
      return;
    }
    obs.current = new ResizeObserver(([e]) => {
      const r = e.target.getBoundingClientRect();
      setTam({ w: r.width, h: r.height });
    });
    obs.current.observe(el);
  }, []);
  return [ref, tam];
}

const aTarget = (u: UBLocation | null) =>
  u ? { code: u.code, region: u.region, name: u.name, x: u.x, y: u.y } : null;

export default function AprenderPage() {
  const [modo, setModo] = useState<Modo>("explorar");

  // ── Explorar ────────────────────────────────────────────────
  const [param, setParam] = useState<ParametroId>("cm");
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [cm, setCm] = useState<CMEntry | null>(MANO_ABIERTA);
  const [ub, setUb] = useState<UBLocation | null>(null);
  const [or, setOr] = useState({ palm: "FORWARD", fingers: "UP" });
  const [mv, setMv] = useState<{
    contour: string;
    local: string | null;
    plane: string;
  }>({ contour: "ARC", local: null, plane: "VERTICAL" });
  const [cara, setCara] = useState<FaceState>(CARA_NEUTRA);

  // ── Construir ───────────────────────────────────────────────
  const [sign, setSign] = useState<SignConstruction>(createSignaMinima);
  const [celda, setCelda] = useState<CeldaSel | null>({ index: 0, campo: "cm" });
  const [reproduciendo, setReproduciendo] = useState(false);
  const [repetir, setRepetir] = useState(true);
  const [lento, setLento] = useState(false);
  const ritmo = lento ? RITMO_LENTO : DEFAULT_PLAYBACK_CONFIG;
  const [transcurrido, setTranscurrido] = useState(0);
  const rafRef = useRef(0);

  // Reproducción de la seña construida
  useEffect(() => {
    if (!reproduciendo) return;
    const total = computeTotalDuration(sign, ritmo);
    const inicio = performance.now() - transcurrido;
    const tick = (ahora: number) => {
      const t = ahora - inicio;
      if (t >= total) {
        if (repetir) {
          setTranscurrido(0);
          cancelAnimationFrame(rafRef.current);
          // reinicia el reloj en el siguiente cuadro
          rafRef.current = requestAnimationFrame(() => {
            setReproduciendo(false);
            setTimeout(() => setReproduciendo(true), 250);
          });
          return;
        }
        setReproduciendo(false);
        setTranscurrido(0);
        return;
      }
      setTranscurrido(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // transcurrido se lee solo al (re)iniciar
  }, [reproduciendo, sign, repetir, ritmo]); // eslint-disable-line react-hooks/exhaustive-deps

  const frame = useMemo(
    () => (reproduciendo ? getPlaybackFrame(sign, transcurrido, ritmo) : null),
    [reproduciendo, sign, transcurrido, ritmo],
  );

  const celdaEsMovimiento =
    modo === "construir" &&
    !reproduciendo &&
    celda !== null &&
    sign.segments[celda.index]?.type === "M" &&
    movimientoHabilitado(sign, celda.index);

  const tVaiven = useVaiven(
    (modo === "explorar" && param === "mv") || celdaEsMovimiento,
  );

  // ── Pose del avatar según el modo ───────────────────────────
  const pose: PoseAvatar & { showAllUBPoints?: boolean } = useMemo(() => {
    if (modo === "construir") {
      if (frame) {
        return poseDeSegmento(
          sign,
          frame.segmentIndex,
          frame.ubInterpolation ?? 0,
        );
      }
      const i = celda?.index ?? 0;
      const p = poseDeSegmento(sign, i, tVaiven);
      return { ...p, showAllUBPoints: celda?.campo === "ub" };
    }
    switch (param) {
      case "cm":
        return {
          cm,
          orientation: { palm: "FORWARD", fingers: "UP" },
          ubLocation: NEUTRO,
          rnm: CARA_NEUTRA,
          movementInterp: null,
          handMode: "dominant",
        };
      case "ub":
        return {
          cm: MANO_ABIERTA,
          orientation: { palm: "BACK", fingers: "UP" },
          ubLocation: ub,
          rnm: CARA_NEUTRA,
          movementInterp: null,
          handMode: "dominant",
          showAllUBPoints: true,
        };
      case "or":
        return {
          cm: MANO_ABIERTA,
          orientation: or,
          ubLocation: NEUTRO,
          rnm: CARA_NEUTRA,
          movementInterp: null,
          handMode: "dominant",
        };
      case "mv":
        return {
          cm: null,
          ubLocation: null,
          rnm: CARA_NEUTRA,
          handMode: "dominant",
          movementInterp: {
            t: tVaiven,
            fromUBCode: "IpsiPe",
            toUBCode: "XPe",
            fromCM: MANO_ABIERTA,
            toCM: MANO_ABIERTA,
            fromOrientation: { palm: "FORWARD", fingers: "UP" },
            toOrientation: { palm: "FORWARD", fingers: "UP" },
            contour: mv.contour,
            plane: mv.plane,
            local: mv.local,
            handMode: "dominant",
          },
        };
      case "rnm":
        return {
          cm: null,
          ubLocation: null,
          rnm: cara,
          movementInterp: null,
          handMode: "dominant",
        };
    }
  }, [modo, frame, sign, celda, tVaiven, param, cm, ub, or, mv, cara]);

  // Tocar un punto del cuerpo del avatar
  const onUBClick = useCallback(
    (code: string) => {
      const loc = ubPor(code);
      if (!loc) return;
      if (modo === "explorar") {
        setUb(loc);
        return;
      }
      if (celda?.campo === "ub" && sign.segments[celda.index]?.type === "D") {
        const segments = sign.segments.map((s, i) =>
          i === celda.index ? ({ ...(s as HoldSegment), ub: loc } as HoldSegment) : s,
        );
        setSign({ ...sign, segments });
      }
    },
    [modo, celda, sign],
  );

  const cambiarSena = (s: SignConstruction) => {
    setSign(s);
    setReproduciendo(false);
    setTranscurrido(0);
  };

  // ── Pantalla completa: el avatar al fondo, paneles encimados ──
  const [refRaiz, raiz] = useTamano<HTMLDivElement>();
  const [refTitulo, titulo] = useTamano<HTMLElement>();
  const [refPanel, panel] = useTamano<HTMLElement>();
  const [refMatriz, matriz] = useTamano<HTMLDivElement>();

  const hayPanel =
    modo === "explorar" ? panelAbierto : celda !== null && !reproduciendo;
  const MARGEN = 16;
  const fr = (px: number, total: number) =>
    total > 0 && px > 0 ? Math.min(0.6, (px + MARGEN) / total) : 0;
  const tapado = {
    izq: 0,
    der: hayPanel ? fr(panel.w, raiz.w) : 0,
    arr: 0,
    aba: modo === "construir" ? fr(matriz.h, raiz.h) : 0,
    esquina: { ancho: fr(titulo.w, raiz.w), alto: fr(titulo.h, raiz.h) },
  };

  const info = PARAMETROS.find((p) => p.id === param)!;

  const avatar = (
    <Hand3DViewer
      forceAvatar
      sinMarco
      encuadre="torso"
      tapado={tapado}
      autoRotate={false}
      cm={pose.cm}
      orientation={pose.orientation}
      ubLocation={aTarget(pose.ubLocation)}
      rnm={pose.rnm as FaceState}
      movementInterp={pose.movementInterp}
      handMode={pose.handMode}
      showAllUBPoints={Boolean(pose.showAllUBPoints)}
      selectedUBCode={pose.ubLocation?.code ?? null}
      onUBClick={onUBClick}
      isBuildMode
      height="100%"
      className="h-full w-full"
    />
  );

  // Ocupa toda la ventana bajo el encabezado del sitio (franja 4 px +
  // barra 64 px + borde 1 px): la página nunca se desplaza. Los paneles
  // van encima del avatar; solo las listas largas se desplazan dentro.
  return (
    <div
      ref={refRaiz}
      className="fixed inset-x-0 bottom-0 top-[69px] overflow-hidden bg-gray-50"
    >
      <div className="absolute inset-0">{avatar}</div>

      <div className="pointer-events-none absolute inset-3 flex flex-col gap-3 sm:inset-4">
        <div className="relative min-h-0 flex-1">
          {/* Arriba a la izquierda: título, modo y pestañas */}
          <header
            ref={refTitulo}
            className="pointer-events-auto w-max max-w-full space-y-3"
          >
            <h1 className="font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-ink lg:whitespace-nowrap sm:text-4xl">
              {APRENDER_ES.titulo}
            </h1>
            <ModoToggle
              modo={modo}
              onChange={(m) => {
                setModo(m);
                setReproduciendo(false);
              }}
            />
            {modo === "explorar" && (
              <div className="rounded-2xl bg-paper/85 px-1 pt-1 backdrop-blur">
                <TabsParametros
                  activo={param}
                  onChange={(id) => {
                    setParam(id);
                    setPanelAbierto(true);
                  }}
                  conDescripcion={false}
                />
              </div>
            )}
          </header>

          {/* Derecha: el panel del componente elegido aparece aquí */}
          {modo === "explorar" && panelAbierto && (
            <aside
              ref={refPanel}
              key={`explorar-${param}`}
              id={`panel-${param}`}
              role="tabpanel"
              aria-label={info.nombre}
              className="pop-derecha pointer-events-auto absolute right-0 top-0 flex max-h-full w-[min(24rem,100%)] min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-paper/95 shadow-card backdrop-blur"
            >
              <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold leading-tight text-ink">
                    {info.sigla}{" "}
                    <span className="text-sm font-semibold text-gray-500">
                      {info.nombre}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-700">{info.descripcion}</p>
                  <p className="mt-1 text-xs font-medium text-accent-deep">
                    {info.observa}
                  </p>
                </div>
                <button
                  onClick={() => setPanelAbierto(false)}
                  className="rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                >
                  {APRENDER_ES.cerrar}
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {param === "cm" && (
                  <CMControls defaultCM={cm} onCMChange={setCm} />
                )}
                {param === "ub" && (
                  <UBControls defaultLocation={ub} onLocationChange={setUb} />
                )}
                {param === "or" && (
                  <ORControls
                    defaultPalm={or.palm}
                    defaultFingers={or.fingers}
                    onOrientationChange={setOr}
                  />
                )}
                {param === "mv" && (
                  <MVControls
                    defaultContour={mv.contour}
                    defaultLocal={mv.local}
                    defaultPlane={mv.plane}
                    onMovementChange={setMv}
                  />
                )}
                {param === "rnm" && (
                  <RNMControls defaultFace={cara} onFaceChange={setCara} />
                )}
              </div>
            </aside>
          )}
          {modo === "construir" && celda && !reproduciendo && (
            <aside
              ref={refPanel}
              key={`construir-${celda.index}-${celda.campo}`}
              className="pop-derecha pointer-events-auto absolute right-0 top-0 flex max-h-full w-[min(24rem,100%)] min-h-0 flex-col"
            >
              <EditorCasilla
                sign={sign}
                celda={celda}
                onChange={cambiarSena}
                onClose={() => setCelda(null)}
              />
            </aside>
          )}
        </div>

        {/* Abajo, encimada: la matriz segmental */}
        {modo === "construir" && (
          <div ref={refMatriz} className="pointer-events-auto shrink-0">
            <MatrizSegmental
              sign={sign}
              onChange={cambiarSena}
              celda={celda}
              onSelect={(c) => {
                setCelda(c);
                setReproduciendo(false);
              }}
              segmentoActivo={frame ? frame.segmentIndex : null}
              reproduciendo={reproduciendo}
              repetir={repetir}
              onRepetir={setRepetir}
              lento={lento}
              onLento={(v) => {
                setLento(v);
                setReproduciendo(false);
                setTranscurrido(0);
              }}
              onReproducir={() => {
                if (!senaReproducible(sign)) return;
                if (!reproduciendo) {
                  setCelda(null);
                  setTranscurrido(0);
                }
                setReproduciendo((r) => !r);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
