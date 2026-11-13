"use client";

/**
 * Partitura de la seña: todo lo que cambia a lo largo del tiempo, en
 * renglones alineados sobre el mismo eje.
 *
 *   Estructura   bloques D / M con su lugar o su movimiento
 *   Mano         la mano medida dibujada en momentos clave
 *   Dedos        una banda por dedo: delgada = estirado, gruesa = cerrado
 *                (rayada donde la mano solo se vio en 2D)
 *   Separación   qué tan abiertos están los dedos entre sí
 *   Cabeza       giro y cabeceo (grados, respecto a su mediana)
 *   Cara         los gestos que más cambian
 *
 * Se arrastra (o se usan las flechas) para mover el reloj.
 */

import { memo, useCallback, useMemo, useRef } from "react";
import { cuadroEn, DEDO_ES, DEDOS, momentosClave, type SerieMano, type SeriesFicha } from "@/lib/lexicon/ficha";
import ManoDibujo, { escalaManos } from "./ManoDibujo";
import { segundos } from "./reloj";

export interface Bloque {
  tipo: "D" | "M" | "T";
  desde: number;
  hasta: number;
  etiqueta: string;
}

const ANCHO = 1000;
const ETIQUETA = "w-[5.5rem] shrink-0 sm:w-36";

function Renglon({ titulo, lectura, alto = "h-7", children }: { titulo: string; lectura?: string; alto?: string; children: React.ReactNode }) {
  return (
    <div className={`flex items-center ${alto}`}>
      <div className={`${ETIQUETA} flex items-baseline justify-between gap-2 pr-3`}>
        <span className="truncate text-[13px] text-gray-700">{titulo}</span>
        {lectura && <span className="overline-label hidden shrink-0 !text-[10px] text-gray-400 sm:inline">{lectura}</span>}
      </div>
      <div className="relative h-full flex-1">{children}</div>
    </div>
  );
}

/**
 * Medio grosor de la banda. Un dedo estirado mide ~0.1–0.35 (ruido de la
 * MCP) y uno cerrado ~0.75–0.9: se estira ese tramo para que se note.
 */
const grosor = (v: number) => 0.6 + Math.max(0, Math.min(1, (v - 0.12) / 0.7)) * 10;

/** Banda simétrica: grosor = valor; tramos rayados donde la mano no tiene profundidad */
function Banda({ x, v, plana, color, idPatron }: { x: number[]; v: (number | null)[]; plana?: boolean[]; color: string; idPatron: string }) {
  const piezas = useMemo(() => {
    const out: { d: string; plana: boolean }[] = [];
    let run: number[] = [];
    let modo = false;
    const cerrar = () => {
      if (run.length > 1) {
        const top = run.map((i) => `${x[i].toFixed(1)},${(12 - grosor(v[i]!)).toFixed(2)}`);
        const bot = [...run].reverse().map((i) => `${x[i].toFixed(1)},${(12 + grosor(v[i]!)).toFixed(2)}`);
        out.push({ d: `M${top.join("L")}L${bot.join("L")}Z`, plana: modo });
      }
    };
    v.forEach((val, i) => {
      const p = Boolean(plana?.[i]);
      if (val == null) {
        cerrar();
        run = [];
        return;
      }
      if (run.length && p !== modo) {
        run.push(i); // comparten el borde
        cerrar();
        run = [i];
        modo = p;
        return;
      }
      if (!run.length) modo = p;
      run.push(i);
    });
    cerrar();
    return out;
  }, [x, v, plana]);
  return (
    <svg viewBox={`0 0 ${ANCHO} 24`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <line x1={0} y1={12} x2={ANCHO} y2={12} stroke="var(--color-gray-100)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {piezas.map((p, k) => (
        <path key={k} d={p.d} fill={p.plana ? `url(#${idPatron})` : color} stroke={p.plana ? color : "none"} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

function Linea({ x, v, max, color, ancho = 1.5 }: { x: number[]; v: number[]; max: number; color: string; ancho?: number }) {
  const d = v.map((val, i) => `${i ? "L" : "M"}${x[i].toFixed(1)},${(12 - Math.max(-1, Math.min(1, val / max)) * 10).toFixed(2)}`).join("");
  return <path d={d} fill="none" stroke={color} strokeWidth={ancho} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
}

function Area({ x, v, color }: { x: number[]; v: number[]; color: string }) {
  const top = v.map((val, i) => `${x[i].toFixed(1)},${(23 - val * 21).toFixed(2)}`);
  return (
    <svg viewBox={`0 0 ${ANCHO} 24`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <path d={`M${x[0]},23L${top.join("L")}L${x.at(-1)},23Z`} fill="var(--color-magenta-tint)" />
      <path d={`M${top.join("L")}`} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const palabra = (v: number | null | undefined) => (v == null ? "—" : v < 0.4 ? "estirado" : v < 0.65 ? "doblado" : "cerrado");
const abierta = (v: number | null | undefined) => (v == null ? "—" : v < 0.35 ? "juntos" : v < 0.7 ? "abiertos" : "abanico");

/** Lo que no cambia con el reloj: posiciones, escala de los dibujos y momentos clave */
function usePartitura(s: SeriesFicha, mano: SerieMano) {
  const total = Math.max(1, s.duracionMs);
  const x = useMemo(() => s.tiempos.map((t) => (t / total) * ANCHO), [s.tiempos, total]);
  const escala = useMemo(() => escalaManos(mano.dibujo), [mano]);
  const claves = useMemo(() => momentosClave(s.tiempos, mano.dibujo, 7), [s.tiempos, mano]);
  return { x, escala, claves, total };
}

function Partitura({
  s,
  t,
  ir,
  cual,
  bloques,
}: {
  s: SeriesFicha;
  t: number;
  ir: (ms: number) => void;
  cual: "dom" | "nd";
  bloques: Bloque[];
}) {
  const mano = cual === "nd" && s.nd ? s.nd : s.dom;
  const color = cual === "nd" ? "var(--color-green)" : "var(--color-accent)";
  const idPatron = `rayado-${cual}`;
  const { x, escala, claves, total } = usePartitura(s, mano);
  const i = cuadroEn(s.tiempos, t);
  const capa = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);

  const desdePuntero = useCallback(
    (clientX: number) => {
      const r = capa.current?.getBoundingClientRect();
      if (!r || r.width <= 0) return;
      ir(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total);
    },
    [ir, total],
  );
  const paso = s.tiempos.length > 1 ? total / (s.tiempos.length - 1) : 100;
  const marcas = useMemo(() => {
    const cada = total > 2400 ? 500 : 250;
    return Array.from({ length: Math.floor(total / cada) + 1 }, (_, k) => k * cada);
  }, [total]);
  const pct = (ms: number) => `${(ms / total) * 100}%`;

  return (
    <div className="relative select-none">
      <svg width={0} height={0} className="absolute" aria-hidden>
        <defs>
          <pattern id={idPatron} patternUnits="userSpaceOnUse" width={7} height={7} patternTransform="rotate(45)">
            <rect width={7} height={7} fill="var(--color-paper)" />
            <line x1={0} y1={0} x2={0} y2={7} stroke={color} strokeWidth={2.4} />
          </pattern>
        </defs>
      </svg>

      {/* regla de tiempo */}
      <Renglon titulo="" alto="h-6">
        {marcas.map((m, k) => (
          <span key={m} className={`absolute top-0 h-full ${k % 2 ? "hidden sm:block" : ""}`} style={{ left: pct(m) }}>
            <span className="absolute bottom-0 h-1.5 w-px bg-gray-300" />
            <span className="absolute top-0 -translate-x-1/2 font-mono text-[10px] tabular-nums text-gray-400">{(m / 1000).toFixed(m % 1000 ? 2 : 0)}</span>
          </span>
        ))}
      </Renglon>

      {/* estructura D-M-D */}
      <Renglon titulo="Estructura" alto="h-9">
        {bloques.map((b, k) => (
          <div
            key={k}
            className={`absolute inset-y-1 flex items-center overflow-hidden rounded-md px-2 text-[11px] font-medium ${
              b.tipo === "M" ? "bg-ink text-white" : "border border-ink bg-paper text-ink"
            }`}
            style={{ left: pct(b.desde), width: `max(1.5rem, calc(${pct(b.hasta - b.desde)} - 2px))` }}
            title={`${b.tipo} · ${b.etiqueta}`}
          >
            <span className="font-mono">{b.tipo}</span>
            <span className="ml-1.5 truncate opacity-80">{b.etiqueta}</span>
          </div>
        ))}
      </Renglon>

      {/* la mano en momentos clave */}
      <Renglon titulo="Mano" alto="h-20">
        {claves.map((c, k) => (
          <div
            key={c}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${k % 2 ? "hidden sm:block" : ""}`}
            style={{ left: `clamp(2rem, ${(s.tiempos[c] / total) * 100}%, calc(100% - 2rem))` }}
          >
            <ManoDibujo pts={mano.dibujo[c]!} escala={escala} size={64} color={color} plana={mano.plana[c]} activa={Math.abs(c - i) <= 1} />
          </div>
        ))}
        {!claves.length && <span className="absolute inset-0 flex items-center text-xs text-gray-400">No se vio esta mano.</span>}
      </Renglon>

      <div className="my-1.5 ml-[5.5rem] border-t border-gray-100 sm:ml-36" />

      {DEDOS.map((d) => (
        <Renglon key={d} titulo={DEDO_ES[d]} lectura={palabra(mano.dedos[d][i])}>
          <Banda x={x} v={mano.dedos[d]} plana={mano.plana} color={color} idPatron={idPatron} />
        </Renglon>
      ))}
      <Renglon titulo="Separación" lectura={abierta(mano.separacion[i])}>
        <Banda x={x} v={mano.separacion} plana={mano.plana} color="var(--color-gray-500)" idPatron={idPatron} />
      </Renglon>

      {(s.cabeza || s.cara.length > 0) && <div className="my-1.5 ml-[5.5rem] border-t border-gray-100 sm:ml-36" />}
      {s.cabeza && (
        <Renglon titulo="Cabeza" lectura={`${Math.round(s.cabeza.giro[i] ?? 0)}° · ${Math.round(s.cabeza.cabeceo[i] ?? 0)}°`}>
          <svg viewBox={`0 0 ${ANCHO} 24`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <line x1={0} y1={12} x2={ANCHO} y2={12} stroke="var(--color-gray-100)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <Linea x={x} v={s.cabeza.cabeceo} max={15} color="var(--color-gray-400)" ancho={1.25} />
            <Linea x={x} v={s.cabeza.giro} max={15} color="var(--color-magenta)" />
          </svg>
        </Renglon>
      )}
      {s.cara.map((r) => (
        <Renglon key={r.clave} titulo={r.nombre} lectura={(r.valores[i] ?? 0).toFixed(2)}>
          <Area x={x} v={r.valores} color="var(--color-magenta)" />
        </Renglon>
      ))}

      {/* cabezal y capa para arrastrar */}
      <div className="pointer-events-none absolute inset-y-0 left-[5.5rem] right-0 sm:left-36">
        <div className="absolute inset-y-0 w-px bg-accent" style={{ left: pct(t) }}>
          <span className="absolute -left-[5px] top-[18px] h-[11px] w-[11px] rounded-full border-2 border-paper bg-accent shadow" />
        </div>
      </div>
      <div
        ref={capa}
        role="slider"
        tabIndex={0}
        aria-label="Instante de la seña"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(t)}
        aria-valuetext={segundos(t)}
        className="absolute inset-y-0 left-[5.5rem] right-0 cursor-ew-resize rounded-md sm:left-36"
        onPointerDown={(e) => {
          arrastrando.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          desdePuntero(e.clientX);
        }}
        onPointerMove={(e) => arrastrando.current && desdePuntero(e.clientX)}
        onPointerUp={() => (arrastrando.current = false)}
        onPointerCancel={() => (arrastrando.current = false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") ir(Math.min(total, t + paso));
          else if (e.key === "ArrowLeft") ir(Math.max(0, t - paso));
          else if (e.key === "Home") ir(0);
          else if (e.key === "End") ir(total);
          else return;
          e.preventDefault();
        }}
      />
    </div>
  );
}

export default memo(Partitura);
