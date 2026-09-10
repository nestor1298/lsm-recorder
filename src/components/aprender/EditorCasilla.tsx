"use client";

/**
 * EditorCasilla — el control que llena la casilla elegida de la matriz.
 * Reutiliza los controles existentes de Aprender (CM, UB, OR, MV, RNM);
 * cada cambio se ve al instante en el avatar.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import CMControls from "@/components/learn/CMControls";
import UBControls from "@/components/learn/UBControls";
import ORControls from "@/components/learn/ORControls";
import MVControls from "@/components/learn/MVControls";
import RNMControls, { type FaceState } from "@/components/learn/RNMControls";
import type {
  SignConstruction,
  HoldSegment,
  MovementSegment,
  Segment,
} from "@/lib/sign_types";
import { etiquetaSegmento, rnmDe } from "@/lib/learn_viewer";
import { APRENDER_ES, CAMPO_ES } from "@/lib/learn_labels";
import type { CeldaSel } from "./MatrizSegmental";

export default function EditorCasilla({
  sign,
  celda,
  onChange,
  onClose,
}: {
  sign: SignConstruction;
  celda: CeldaSel;
  onChange: (s: SignConstruction) => void;
  onClose: () => void;
}) {
  // Los controles de Aprender emiten su valor desde un efecto cada vez que
  // cambia la identidad del callback. Con refs + callbacks estables + una
  // guarda de "¿realmente cambió?", un clic produce una sola actualización
  // y no hay rebotes que pisen el valor recién elegido.
  const signRef = useRef(sign);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    signRef.current = sign;
    onChangeRef.current = onChange;
  });

  const index = celda.index;
  const actualizar = useCallback(
    (cambios: Partial<Segment>) => {
      const actual = signRef.current;
      const s = actual.segments[index];
      if (!s) return;
      const previo = s as unknown as Record<string, unknown>;
      const cambia = Object.entries(cambios).some(
        ([k, v]) =>
          JSON.stringify(previo[k] ?? null) !== JSON.stringify(v ?? null),
      );
      if (!cambia) return;
      const segments = actual.segments.map((x, i) =>
        i === index ? ({ ...x, ...cambios } as Segment) : x,
      );
      const nuevo = { ...actual, segments };
      signRef.current = nuevo;
      onChangeRef.current(nuevo);
    },
    [index],
  );

  const on = useMemo(
    () => ({
      cm: (cm: HoldSegment["cm"]) => actualizar({ cm }),
      ub: (ub: HoldSegment["ub"]) => actualizar({ ub }),
      or: (orientation: HoldSegment["orientation"]) =>
        actualizar({ orientation }),
      mv: (mv: { contour: string; local: string | null; plane: string }) =>
        actualizar({ contour: mv.contour, local: mv.local, plane: mv.plane }),
      cara: (rnm: FaceState) => actualizar({ rnm }),
    }),
    [actualizar],
  );

  const seg = sign.segments[celda.index];
  if (!seg) return null;

  const titulo =
    celda.campo === "cara"
      ? APRENDER_ES.filaCara
      : celda.campo === "contorno" || celda.campo === "plano" || celda.campo === "local"
        ? APRENDER_ES.movimiento
        : CAMPO_ES[celda.campo];

  // key por segmento + campo: los controles toman sus valores iniciales
  // de la casilla y se reinician al cambiar de casilla.
  const key = `${seg.id}-${celda.campo}`;

  let control: React.ReactNode = null;
  if (seg.type === "D") {
    const d = seg as HoldSegment;
    if (celda.campo === "cm")
      control = (
        <CMControls key={key} defaultCM={d.cm} onCMChange={on.cm} />
      );
    if (celda.campo === "ub")
      control = (
        <UBControls
          key={key}
          defaultLocation={d.ub}
          onLocationChange={on.ub}
        />
      );
    if (celda.campo === "or")
      control = (
        <ORControls
          key={key}
          defaultPalm={d.orientation?.palm}
          defaultFingers={d.orientation?.fingers}
          onOrientationChange={on.or}
        />
      );
  } else if (
    celda.campo === "contorno" ||
    celda.campo === "plano" ||
    celda.campo === "local"
  ) {
    const m = seg as MovementSegment;
    control = (
      <MVControls
        key={key}
        defaultContour={m.contour}
        defaultLocal={m.local}
        defaultPlane={m.plane}
        onMovementChange={on.mv}
      />
    );
  }
  if (celda.campo === "cara") {
    control = (
      <RNMControls
        key={key}
        defaultFace={rnmDe(sign, celda.index) as FaceState}
        onFaceChange={on.cara}
      />
    );
  }

  return (
    <div className="flex max-h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-paper/95 shadow-card backdrop-blur">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <p className="text-sm text-gray-600">
          {APRENDER_ES.editando}{" "}
          <span className="font-display font-bold text-ink">
            {etiquetaSegmento(sign, celda.index)}
          </span>{" "}
          · <span className="font-semibold text-ink">{titulo}</span>
        </p>
        <button
          onClick={onClose}
          className="rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
        >
          {APRENDER_ES.cerrar}
        </button>
      </div>
      <div className="overflow-y-auto p-3">{control}</div>
    </div>
  );
}
