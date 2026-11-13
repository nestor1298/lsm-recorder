"use client";

/**
 * Pictogramas de los parámetros: dónde (UB sobre una silueta), hacia
 * dónde (OR: dedos y palma en un eje de tres direcciones) y cómo se mueve
 * (MV: el contorno con su sentido y repeticiones). Tinta y un acento.
 */

import type { ContourMovement, FingerPointing, PalmFacing } from "@/lib/types";
import { UB_LOCATIONS } from "@/lib/ub_inventory";

const TINTA = "var(--color-ink)";
const SUAVE = "var(--color-gray-300)";
const ACENTO = "var(--color-accent)";

/** Silueta de la cintura para arriba, en las coordenadas de ub_inventory (200 × 500) */
function Silueta() {
  return (
    <g fill="none" stroke="var(--color-gray-400)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx={100} cy={40} rx={22} ry={28} />
      <path d="M92,67 L92,82 M108,67 L108,82" />
      <path d="M68,88 Q66,86 68,84 L132,84 Q134,86 132,88 L138,165 Q138,180 120,182 L80,182 Q62,180 62,165 Z" />
      <path d="M68,88 Q55,92 50,110 L44,150 Q40,165 38,190" />
      <path d="M132,88 Q145,92 150,110 L156,150 Q160,165 162,190" />
    </g>
  );
}

export function PictoUB({ code, toca }: { code?: string | null; toca: boolean }) {
  const loc = code ? UB_LOCATIONS.find((l) => l.code === code) : undefined;
  const neutro = code === "EN";
  return (
    <svg viewBox={loc && loc.y > 175 ? "14 0 172 245" : "34 6 132 180"} className="h-full w-full" aria-hidden>
      <Silueta />
      {neutro ? (
        <g>
          <ellipse cx={100} cy={130} rx={46} ry={30} fill="none" stroke={ACENTO} strokeWidth={2} strokeDasharray="5 5" />
          <circle cx={100} cy={130} r={7} fill={ACENTO} />
        </g>
      ) : loc ? (
        <g>
          <circle cx={loc.x} cy={loc.y} r={17} fill="var(--color-accent-tint)" />
          <circle cx={loc.x} cy={loc.y} r={8} fill={toca ? ACENTO : "var(--color-paper)"} stroke={ACENTO} strokeWidth={2.5} />
        </g>
      ) : null}
    </svg>
  );
}

/** Dirección de la persona → vector en el dibujo (al frente = hacia quien mira, en diagonal) */
const DIR: Record<string, [number, number] | null> = {
  UP: [0, -1],
  DOWN: [0, 1],
  LEFT: [1, 0],
  RIGHT: [-1, 0],
  FORWARD: [-0.62, 0.62],
  BACK: [0.62, -0.62],
  NEUTRAL: null,
};

function Flecha({ v, color, ancho, largo }: { v: [number, number]; color: string; ancho: number; largo: number }) {
  const [dx, dy] = v;
  const x2 = 50 + dx * largo;
  const y2 = 50 + dy * largo;
  const a = Math.atan2(dy, dx);
  const p = (r: number, da: number) => `${x2 + Math.cos(a + da) * r},${y2 + Math.sin(a + da) * r}`;
  return (
    <g>
      <line x1={50} y1={50} x2={x2 - dx * 6} y2={y2 - dy * 6} stroke={color} strokeWidth={ancho} strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${p(11, Math.PI - 0.45)} ${p(11, Math.PI + 0.45)}`} fill={color} />
    </g>
  );
}

export function PictoOR({ palma, dedos }: { palma?: PalmFacing | null; dedos?: FingerPointing | null }) {
  const vd = dedos ? DIR[dedos] : null;
  const vp = palma ? DIR[palma] : null;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <g stroke={SUAVE} strokeWidth={1} strokeDasharray="2 3">
        <line x1={50} y1={8} x2={50} y2={92} />
        <line x1={8} y1={50} x2={92} y2={50} />
        <line x1={20} y1={80} x2={80} y2={20} />
      </g>
      {vd && <Flecha v={vd} color={TINTA} ancho={4} largo={38} />}
      {vp && <Flecha v={vp} color={ACENTO} ancho={3} largo={26} />}
      <circle cx={50} cy={50} r={4.5} fill="var(--color-paper)" stroke={TINTA} strokeWidth={2} />
    </svg>
  );
}

/** Contorno de movimiento, de izquierda a derecha, en una caja de 100 × 60 */
const CONTORNO: Record<ContourMovement, string> = {
  STRAIGHT: "M12,30 L84,30",
  ARC: "M12,42 Q48,2 84,42",
  CIRCLE: "M50,8 A22,22 0 1 1 49.9,8",
  ZIGZAG: "M10,40 L28,18 L46,40 L64,18 L84,38",
  SEVEN: "M12,16 L66,16 L44,50",
};
/** punta de flecha al final del contorno: [x, y, ángulo] */
const PUNTA: Record<ContourMovement, [number, number, number]> = {
  STRAIGHT: [88, 30, 0],
  ARC: [86, 44, 0.9],
  CIRCLE: [49, 8, Math.PI],
  ZIGZAG: [88, 42, 0.9],
  SEVEN: [41, 54, 2.1],
};

export function PictoMV({
  contorno,
  direccion,
  repeticiones,
}: {
  contorno?: ContourMovement | null;
  direccion?: { x: number; y: number } | null;
  repeticiones?: number | null;
}) {
  if (!contorno) {
    return (
      <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden>
        <circle cx={50} cy={30} r={6} fill={TINTA} />
        <circle cx={50} cy={30} r={14} fill="none" stroke={SUAVE} strokeWidth={1.5} />
      </svg>
    );
  }
  // gira el dibujo hacia la dirección medida; viene en el marco de la persona
  // (x a su derecha, y arriba) y se dibuja como la ve la cámara, igual que el trazo
  const rot = direccion && (direccion.x || direccion.y) ? (Math.atan2(-direccion.y, -direccion.x) * 180) / Math.PI : 0;
  const [px, py, pa] = PUNTA[contorno];
  const p = (r: number, da: number) => `${px + Math.cos(pa + da) * r},${py + Math.sin(pa + da) * r}`;
  const rep = repeticiones && repeticiones > 1 ? repeticiones : 1;
  return (
    <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden>
      <g transform={contorno === "CIRCLE" ? undefined : `rotate(${rot} 50 30)`}>
        {rep > 1 && <path d={CONTORNO[contorno]} fill="none" stroke={SUAVE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" transform="translate(5 7)" />}
        <path d={CONTORNO[contorno]} fill="none" stroke={TINTA} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`${px},${py} ${p(10, Math.PI - 0.5)} ${p(10, Math.PI + 0.5)}`} fill={TINTA} />
      </g>
    </svg>
  );
}
