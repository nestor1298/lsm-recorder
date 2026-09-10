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
import { APRENDER_ES, type ParametroId } from "@/lib/learn_labels";
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
/** Lugar de exhibición: la mano frente al pecho, donde se lee bien. */
const PECHO = ubPor("Pe");

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

const aTarget = (u: UBLocation | null) =>
  u ? { code: u.code, region: u.region, name: u.name, x: u.x, y: u.y } : null;

export default function AprenderPage() {
  const [modo, setModo] = useState<Modo>("explorar");

  // ── Explorar ────────────────────────────────────────────────
  const [param, setParam] = useState<ParametroId>("cm");
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
          ubLocation: PECHO,
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
          ubLocation: PECHO,
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

  const avatar = (alto: string) => (
    <Hand3DViewer
      forceAvatar
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
      height={alto}
      className="w-full"
    />
  );

  return (
    <div className="space-y-6">
      {/* Título en grande y selector de modo */}
      <header className="space-y-4">
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">
          {APRENDER_ES.titulo}
        </h1>
        <p className="max-w-2xl text-sm text-gray-500">
          {APRENDER_ES.subtitulo}
        </p>
        <ModoToggle
          modo={modo}
          onChange={(m) => {
            setModo(m);
            setReproduciendo(false);
          }}
        />
      </header>

      {modo === "explorar" ? (
        <div className="space-y-4">
          <TabsParametros activo={param} onChange={setParam} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* El avatar manda */}
            <div className="lg:col-span-3">{avatar("64vh")}</div>
            <div className="max-h-[64vh] overflow-y-auto rounded-2xl border border-gray-200 bg-paper p-4 lg:col-span-2">
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
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Avatar protagonista, con el editor de la casilla flotando */}
          <div className="relative">
            {avatar("46vh")}
            {celda && !reproduciendo && (
              <div className="absolute bottom-3 right-3 top-3 w-[min(24rem,calc(100%-1.5rem))]">
                <EditorCasilla
                  sign={sign}
                  celda={celda}
                  onChange={cambiarSena}
                  onClose={() => setCelda(null)}
                />
              </div>
            )}
          </div>

          {/* La matriz segmental ocupa la parte baja */}
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
  );
}
