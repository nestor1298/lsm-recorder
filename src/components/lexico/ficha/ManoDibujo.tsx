"use client";

/**
 * La mano medida en un cuadro, dibujada como la ve la cámara: huesos en
 * línea, articulaciones en punto y yemas un poco más grandes. `escala`
 * (metros por lado del dibujo) es la misma para todos los dibujos de una
 * seña, así que se comparan entre sí.
 */

import { HAND_CONNECTIONS } from "@/lib/vision/connections";
import type { XY } from "@/lib/lexicon/ficha";

const YEMAS = new Set([4, 8, 12, 16, 20]);
const PALMA = [0, 5, 9, 13, 17];

export default function ManoDibujo({
  pts,
  escala,
  size = 56,
  color = "var(--color-accent)",
  plana = false,
  activa = false,
}: {
  pts: XY[];
  escala: number;
  size?: number;
  color?: string;
  /** solo 2D: trazo punteado */
  plana?: boolean;
  activa?: boolean;
}) {
  const cx = PALMA.reduce((s, i) => s + pts[i].x, 0) / PALMA.length;
  const cy = PALMA.reduce((s, i) => s + pts[i].y, 0) / PALMA.length;
  const k = 100 / escala;
  const P = pts.map((p) => ({ x: 50 + (p.x - cx) * k, y: 50 + (p.y - cy) * k }));
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="overflow-visible">
      {activa && <circle cx={50} cy={50} r={50} fill="var(--color-accent-tint)" />}
      {HAND_CONNECTIONS.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={P[a].x}
          y1={P[a].y}
          x2={P[b].x}
          y2={P[b].y}
          stroke={color}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeDasharray={plana ? "4 5" : undefined}
        />
      ))}
      {P.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={YEMAS.has(i) ? 4.2 : 2.4} fill={YEMAS.has(i) ? color : "var(--color-paper)"} stroke={color} strokeWidth={1.6} />
      ))}
    </svg>
  );
}

/**
 * Lado (en metros) del dibujo: el alcance típico de la mano (mediana de
 * los cuadros) con margen. Igual para toda la seña, así los dibujos se
 * comparan; una mano más abierta que lo típico se sale un poco del círculo.
 */
export function escalaManos(dibujos: (XY[] | null)[]): number {
  const alcances: number[] = [];
  for (const d of dibujos) {
    if (!d) continue;
    const cx = PALMA.reduce((s, i) => s + d[i].x, 0) / PALMA.length;
    const cy = PALMA.reduce((s, i) => s + d[i].y, 0) / PALMA.length;
    alcances.push(Math.max(...d.map((p) => Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy)))));
  }
  if (!alcances.length) return 0.2;
  alcances.sort((a, b) => a - b);
  return Math.max(0.05, alcances[alcances.length >> 1] * 2.5);
}
