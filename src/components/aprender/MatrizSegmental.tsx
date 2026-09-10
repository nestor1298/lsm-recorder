"use client";

/**
 * MatrizSegmental — la matriz de Cruz Aldrete como tablero que se llena.
 *
 * Columnas: la secuencia D₁ M₁ D₂ …  Filas: "Cuerpo" (lo manual: forma,
 * lugar y orientación en las detenciones; trayectoria, plano y local en
 * los movimientos) y "Cara" (rasgos no manuales de cada segmento).
 *
 * La regla se enseña con la propia estructura: no existe un botón para
 * poner un movimiento suelto, solo "agregar movimiento", que trae su
 * detención final; y un movimiento no se puede definir hasta que sus
 * dos detenciones estén completas.
 */

import type { SignConstruction, HoldSegment, MovementSegment } from "@/lib/sign_types";
import {
  agregarMovimiento,
  quitarMovimiento,
  movimientoHabilitado,
  detencionCompleta,
  senaReproducible,
} from "@/lib/sign_types";
import { etiquetaSegmento, rnmDe } from "@/lib/learn_viewer";
import { APRENDER_ES, CAMPO_ES } from "@/lib/learn_labels";
import {
  CONTOUR_ES,
  PLANE_ES,
  LOCAL_ES,
  PALM_ES,
  FINGER_ES,
  EYEBROWS_ES,
  MOUTH_ES,
  HEAD_ES,
  OR_GLIFO,
} from "@/lib/anotar_labels";
import { MiniHand } from "@/components/learn/MiniHand";

export type CampoMatriz =
  | "cm"
  | "ub"
  | "or"
  | "contorno"
  | "plano"
  | "local"
  | "cara";

export interface CeldaSel {
  index: number;
  campo: CampoMatriz;
}

interface Props {
  sign: SignConstruction;
  onChange: (s: SignConstruction) => void;
  celda: CeldaSel | null;
  onSelect: (c: CeldaSel | null) => void;
  /** segmento que suena en la reproducción (resalta su columna) */
  segmentoActivo: number | null;
  reproduciendo: boolean;
  repetir: boolean;
  /** reproducción a media velocidad, para seguir cada segmento */
  lento: boolean;
  onReproducir: () => void;
  onRepetir: (v: boolean) => void;
  onLento: (v: boolean) => void;
}

const texto = (m: Record<string, string>, k?: string | null) =>
  (k && m[k]) || k || "";

/** Una casilla de la matriz: llena muestra su valor, vacía invita a llenar. */
function Casilla({
  titulo,
  valor,
  vacia,
  activa,
  bloqueada,
  onClick,
  children,
}: {
  titulo: string;
  valor?: string;
  vacia: boolean;
  activa: boolean;
  bloqueada?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={bloqueada}
      aria-pressed={activa}
      aria-label={`${titulo}: ${vacia ? "sin llenar" : valor}`}
      className={`flex min-h-[3.25rem] w-full flex-col justify-center rounded-xl border-2 px-2.5 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        activa
          ? "border-accent bg-accent-tint"
          : vacia
            ? "border-dashed border-gray-300 bg-paper hover:border-accent"
            : "border-gray-200 bg-paper hover:border-gray-300"
      }`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {titulo}
      </span>
      {vacia ? (
        <span className="text-xs font-semibold text-accent-deep">+ Llenar</span>
      ) : (
        <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-ink">
          {children}
          <span className="truncate">{valor}</span>
        </span>
      )}
    </button>
  );
}

export default function MatrizSegmental({
  sign,
  onChange,
  celda,
  onSelect,
  segmentoActivo,
  reproduciendo,
  repetir,
  lento,
  onReproducir,
  onRepetir,
  onLento,
}: Props) {
  const esActiva = (index: number, campo: CampoMatriz) =>
    celda?.index === index && celda.campo === campo;
  const reproducible = senaReproducible(sign);

  const columnaDetencion = (d: HoldSegment, i: number) => (
    <div className="space-y-1.5">
      <Casilla
        titulo={CAMPO_ES.cm}
        vacia={!d.cm}
        valor={d.cm ? `#${d.cm.cm_id} · ${d.cm.cruz_aldrete_notation}` : ""}
        activa={esActiva(i, "cm")}
        onClick={() => onSelect({ index: i, campo: "cm" })}
      >
        {d.cm && <MiniHand cm={d.cm} size={22} />}
      </Casilla>
      <Casilla
        titulo={CAMPO_ES.ub}
        vacia={!d.ub}
        valor={d.ub?.name}
        activa={esActiva(i, "ub")}
        onClick={() => onSelect({ index: i, campo: "ub" })}
      />
      <Casilla
        titulo={CAMPO_ES.or}
        vacia={!d.orientation?.palm}
        valor={
          d.orientation
            ? `${texto(PALM_ES, d.orientation.palm).replace("Palma ", "")} · ${texto(FINGER_ES, d.orientation.fingers).replace("Dedos ", "dedos ")}`
            : ""
        }
        activa={esActiva(i, "or")}
        onClick={() => onSelect({ index: i, campo: "or" })}
      >
        {d.orientation && (
          <span aria-hidden>
            {OR_GLIFO[d.orientation.palm] ?? "·"}
            {OR_GLIFO[d.orientation.fingers] ?? "·"}
          </span>
        )}
      </Casilla>
    </div>
  );

  const columnaMovimiento = (m: MovementSegment, i: number) => {
    const habilitado = movimientoHabilitado(sign, i);
    return (
      <div className="space-y-1.5">
        {!habilitado && (
          <p className="rounded-lg bg-gold-tint px-2 py-1 text-[10px] font-semibold text-gold-deep">
            {APRENDER_ES.movBloqueado}
          </p>
        )}
        <Casilla
          titulo={CAMPO_ES.contorno}
          vacia={!m.contour}
          valor={texto(CONTOUR_ES, m.contour)}
          activa={esActiva(i, "contorno")}
          bloqueada={!habilitado}
          onClick={() => onSelect({ index: i, campo: "contorno" })}
        />
        <Casilla
          titulo={CAMPO_ES.plano}
          vacia={!m.plane}
          valor={texto(PLANE_ES, m.plane)}
          activa={esActiva(i, "plano")}
          bloqueada={!habilitado}
          onClick={() => onSelect({ index: i, campo: "plano" })}
        />
        <Casilla
          titulo={CAMPO_ES.local}
          vacia={false}
          valor={m.local ? texto(LOCAL_ES, m.local) : "Ninguno"}
          activa={esActiva(i, "local")}
          bloqueada={!habilitado}
          onClick={() => onSelect({ index: i, campo: "local" })}
        />
      </div>
    );
  };

  return (
    <section
      aria-label={APRENDER_ES.matriz}
      className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
    >
      {/* Encabezado con reproducción */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="font-display text-lg font-bold text-ink">
            {APRENDER_ES.matriz}
          </h2>
          <p className="text-xs text-gray-500">{APRENDER_ES.matrizAyuda}</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={repetir}
            onChange={(e) => onRepetir(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-accent-deep"
          />
          {APRENDER_ES.repetir}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={lento}
            onChange={(e) => onLento(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-accent-deep"
          />
          {APRENDER_ES.lento}
        </label>
        <button
          onClick={onReproducir}
          disabled={!reproducible}
          title={reproducible ? undefined : APRENDER_ES.incompleta}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {reproduciendo ? APRENDER_ES.pausar : APRENDER_ES.reproducir}
        </button>
      </div>

      {/* Rejilla: filas Cuerpo / Cara × columnas de segmentos */}
      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-max gap-2"
          style={{
            gridTemplateColumns: `5.5rem repeat(${sign.segments.length}, minmax(10.5rem, 1fr)) 9rem`,
          }}
        >
          {/* Encabezados de columna */}
          <div />
          {sign.segments.map((s, i) => {
            const completa = s.type === "D" ? detencionCompleta(s) : movimientoHabilitado(sign, i);
            const suena = segmentoActivo === i;
            return (
              <div
                key={s.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                  suena
                    ? "bg-coral text-paper"
                    : s.type === "D"
                      ? "bg-green-tint text-green-deep"
                      : "bg-accent-tint text-accent-deep"
                }`}
              >
                <span className="flex items-baseline gap-1.5">
                  <span className="font-display text-base font-bold">
                    {etiquetaSegmento(sign, i)}
                  </span>
                  <span className="text-[11px] font-medium">
                    {s.type === "D" ? APRENDER_ES.detencion : APRENDER_ES.movimiento}
                  </span>
                </span>
                {s.type === "M" ? (
                  <button
                    onClick={() => {
                      onChange(quitarMovimiento(sign, i));
                      onSelect(null);
                    }}
                    aria-label={APRENDER_ES.quitarMovimiento}
                    title={APRENDER_ES.quitarMovimiento}
                    className="rounded px-1.5 text-sm leading-none opacity-70 hover:opacity-100"
                  >
                    ×
                  </button>
                ) : (
                  <span
                    className={`h-2 w-2 rounded-full ${completa ? "bg-green" : "bg-gray-300"}`}
                    aria-label={completa ? "completa" : "incompleta"}
                  />
                )}
              </div>
            );
          })}
          <div />

          {/* Fila CUERPO */}
          <div className="flex items-start pt-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            {APRENDER_ES.filaCuerpo}
          </div>
          {sign.segments.map((s, i) => (
            <div
              key={`c-${s.id}`}
              className={`rounded-xl p-1 ${segmentoActivo === i ? "ring-2 ring-coral" : ""}`}
            >
              {s.type === "D"
                ? columnaDetencion(s, i)
                : columnaMovimiento(s, i)}
            </div>
          ))}
          <div className="row-span-2 flex">
            <button
              onClick={() => onChange(agregarMovimiento(sign))}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 bg-paper px-2 text-center text-xs font-semibold text-gray-600 transition-colors hover:border-accent hover:text-accent-deep"
            >
              <span className="text-2xl leading-none" aria-hidden>
                +
              </span>
              {APRENDER_ES.agregarMovimiento}
              <span className="text-[10px] font-normal text-gray-400">
                M + D
              </span>
            </button>
          </div>

          {/* Fila CARA */}
          <div className="flex items-start pt-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            {APRENDER_ES.filaCara}
          </div>
          {sign.segments.map((s, i) => {
            const r = rnmDe(sign, i);
            const partes = [
              r.eyebrows !== "NEUTRAL" && texto(EYEBROWS_ES, r.eyebrows),
              r.mouth !== "NEUTRAL" && `boca ${texto(MOUTH_ES, r.mouth).toLowerCase()}`,
              r.head !== "NONE" && `cabeza ${texto(HEAD_ES, r.head).toLowerCase()}`,
            ].filter(Boolean) as string[];
            return (
              <div
                key={`f-${s.id}`}
                className={`rounded-xl p-1 ${segmentoActivo === i ? "ring-2 ring-coral" : ""}`}
              >
                <Casilla
                  titulo={`${CAMPO_ES.cejas} · ${CAMPO_ES.boca} · ${CAMPO_ES.cabeza}`}
                  vacia={false}
                  valor={partes.join(" · ") || "Neutral"}
                  activa={esActiva(i, "cara")}
                  onClick={() => onSelect({ index: i, campo: "cara" })}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
