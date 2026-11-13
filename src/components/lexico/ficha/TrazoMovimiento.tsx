"use client";

/**
 * El camino de las manos sobre la silueta medida de la persona (como la
 * ve la cámara): un punto por cuadro (más juntos = más lento), flechas de
 * sentido, inicio en anillo y fin en punto. Lo recorrido va en tinta llena
 * y lo que falta, tenue; el punto grande es el instante del reloj.
 */

import { memo, useMemo } from "react";
import { cuadroEn, type SeriesFicha, type XY } from "@/lib/lexicon/ficha";

const DOM = "var(--color-accent)";
const ND = "var(--color-green)";

/** Tramos continuos (cortados donde falta la mano) */
function tramos(pts: (XY | null)[]): { i: number; p: XY }[][] {
  const out: { i: number; p: XY }[][] = [];
  let cur: { i: number; p: XY }[] = [];
  pts.forEach((p, i) => {
    if (p) cur.push({ i, p });
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
}

const d = (t: { p: XY }[]) => t.map(({ p }, k) => `${k ? "L" : "M"}${p.x.toFixed(3)},${(-p.y).toFixed(3)}`).join("");

function Camino({ pts, hasta, color, grueso }: { pts: (XY | null)[]; hasta: number; color: string; grueso: number }) {
  const ts = useMemo(() => tramos(pts), [pts]);
  const flechas = useMemo(() => {
    const out: { x: number; y: number; a: number }[] = [];
    for (const t of ts) {
      for (let k = 3; k < t.length - 1; k += 4) {
        const a = t[k - 1].p;
        const b = t[k + 1].p;
        if (Math.hypot(b.x - a.x, b.y - a.y) < 0.04) continue;
        out.push({ x: t[k].p.x, y: -t[k].p.y, a: Math.atan2(-(b.y - a.y), b.x - a.x) });
      }
    }
    return out;
  }, [ts]);
  const todos = ts.flat();
  if (!todos.length) return null;
  const ini = todos[0].p;
  const fin = todos.at(-1)!.p;
  return (
    <g>
      {/* lo que falta, tenue */}
      {ts.map((t, k) => (
        <path key={`f${k}`} d={d(t)} fill="none" stroke={color} strokeOpacity={0.22} strokeWidth={grueso} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ))}
      {/* lo recorrido */}
      {ts.map((t, k) => {
        const hecho = t.filter((x) => x.i <= hasta);
        return hecho.length > 1 ? (
          <path key={`h${k}`} d={d(hecho)} fill="none" stroke={color} strokeWidth={grueso} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ) : null;
      })}
      {todos.map(({ i, p }) => (
        <circle key={i} cx={p.x} cy={-p.y} r={0.018} fill={i <= hasta ? color : "var(--color-paper)"} stroke={color} strokeWidth={0.008} />
      ))}
      {flechas.map((f, k) => (
        <path
          key={k}
          d="M0.055,0 L-0.035,-0.04 L-0.035,0.04 Z"
          transform={`translate(${f.x} ${f.y}) rotate(${(f.a * 180) / Math.PI})`}
          fill={color}
        />
      ))}
      <circle cx={ini.x} cy={-ini.y} r={0.05} fill="var(--color-paper)" stroke={color} strokeWidth={0.02} />
      <circle cx={fin.x} cy={-fin.y} r={0.045} fill={color} />
    </g>
  );
}

function Silueta({ s }: { s: NonNullable<SeriesFicha["silueta"]> }) {
  const { p, cara } = s;
  // cabeza: alrededor de la cara medida (mandíbula, ojos, cejas) o, sin ella, de las orejas
  const pc = cara.flat();
  let cx: number, cy: number, rx: number, ry: number;
  if (pc.length) {
    const xs = pc.map((q) => q.x);
    const ys = pc.map((q) => q.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    rx = ((x1 - x0) / 2) * 1.12;
    ry = ((y1 - y0) / 2) * 1.45;
    cx = (x0 + x1) / 2;
    cy = y0 + ry * 0.92;
  } else {
    const orejas = Math.hypot(p.orejaI.x - p.orejaD.x, p.orejaI.y - p.orejaD.y);
    rx = Math.max(0.18, orejas * 0.62);
    ry = rx * 1.28;
    cx = (p.orejaI.x + p.orejaD.x) / 2;
    cy = (p.ojoI.y + p.ojoD.y) / 2 + rx * 0.15;
  }
  const L = (a: XY, b: XY) => `M${a.x},${-a.y}L${b.x},${-b.y}`;
  const cuello = { x: (p.hombroI.x + p.hombroD.x) / 2, y: (p.hombroI.y + p.hombroD.y) / 2 };
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d={`M${p.hombroI.x},${-p.hombroI.y} L${p.caderaI.x},${-p.caderaI.y} L${p.caderaD.x},${-p.caderaD.y} L${p.hombroD.x},${-p.hombroD.y} Z`}
        fill="var(--color-gray-50)"
        stroke="var(--color-gray-200)"
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
      <ellipse cx={cx} cy={-cy} rx={rx} ry={ry} stroke="var(--color-gray-200)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
      <path
        d={[L(cuello, { x: cuello.x, y: cy - ry * 0.95 }), L(p.hombroI, p.codoI), L(p.hombroD, p.codoD)].join("")}
        stroke="var(--color-gray-200)"
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
      {cara.map((tr, k) => (
        <path
          key={k}
          d={tr.map((q, n) => `${n ? "L" : "M"}${q.x},${-q.y}`).join("")}
          stroke="var(--color-gray-400)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

function TrazoMovimiento({ s, t }: { s: SeriesFicha; t: number }) {
  const caja = useMemo(() => {
    const pts: XY[] = [...s.trazo.dom, ...s.trazo.nd].filter((p): p is XY => Boolean(p));
    if (s.silueta) pts.push(...Object.values(s.silueta.p), ...s.silueta.cara.flat());
    if (!pts.length) return null;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => -p.y);
    const m = 0.25;
    let [x0, x1, y0, y1] = [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...ys) - m, Math.max(...ys) + m];
    // cuadrada, para que no se deforme
    const lado = Math.max(x1 - x0, y1 - y0);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    [x0, x1, y0, y1] = [cx - lado / 2, cx + lado / 2, cy - lado / 2, cy + lado / 2];
    return { x0, y0, lado };
  }, [s]);
  const i = cuadroEn(s.tiempos, t);
  if (!caja) return <p className="p-6 text-center text-sm text-gray-500">Sin trazo.</p>;
  const ahora = (pts: (XY | null)[]) => pts[i] ?? null;
  const pd = ahora(s.trazo.dom);
  const pn = ahora(s.trazo.nd);
  return (
    <svg viewBox={`${caja.x0} ${caja.y0} ${caja.lado} ${caja.lado}`} className="h-full w-full" role="img" aria-label="Trayectoria de las manos sobre el cuerpo">
      {s.silueta && <Silueta s={s.silueta} />}
      {s.nd && <Camino pts={s.trazo.nd} hasta={i} color={ND} grueso={2} />}
      <Camino pts={s.trazo.dom} hasta={i} color={DOM} grueso={2.5} />
      {pn && (
        <g>
          <circle cx={pn.x} cy={-pn.y} r={0.09} fill="var(--color-green-tint)" />
          <circle cx={pn.x} cy={-pn.y} r={0.045} fill={ND} stroke="var(--color-paper)" strokeWidth={0.015} />
        </g>
      )}
      {pd && (
        <g>
          <circle cx={pd.x} cy={-pd.y} r={0.11} fill="var(--color-accent-tint)" />
          <circle cx={pd.x} cy={-pd.y} r={0.055} fill={DOM} stroke="var(--color-paper)" strokeWidth={0.018} />
        </g>
      )}
    </svg>
  );
}

export default memo(TrazoMovimiento);
