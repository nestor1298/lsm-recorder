/**
 * CirculoManos — el dibujo del juego: nueve puntos en círculo, uno por
 * cada mano que busca una seña. Los puntos llenos son personas que ya la
 * grabaron (cada una en un color de los pilares de OtherAI); el tuyo lleva
 * aro; los vacíos son lugares libres. Con las nueve, el círculo se cierra.
 *
 * Sin texto adentro: quien lo usa pone la etiqueta (y el aria-label).
 */

import { MANOS_POR_SENA } from "@/lib/nueve_manos";

export const COLORES_MANO = [
  "var(--color-accent)",
  "var(--color-magenta)",
  "var(--color-gold)",
  "var(--color-green)",
  "var(--color-coral)",
] as const;

export function colorMano(i: number): string {
  return COLORES_MANO[((i % COLORES_MANO.length) + COLORES_MANO.length) % COLORES_MANO.length];
}

/** Punto i (0…8) del círculo, en un viewBox de 100 × 100 centrado en (cx, cy). */
export function puntoMano(i: number, r = 36, cx = 50, cy = 50): { x: number; y: number } {
  const ang = (-90 + (360 / MANOS_POR_SENA) * i) * (Math.PI / 180);
  return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
}

export default function CirculoManos({
  manos,
  tuya = null,
  size = 64,
  oscuro = false,
  animar = false,
  esperando = false,
  className = "",
  etiqueta,
}: {
  /** cuántas manos tiene la seña */
  manos: number;
  /** tu lugar (1…9), si eres una de ellas */
  tuya?: number | null;
  size?: number;
  /** sobre fondo tinta */
  oscuro?: boolean;
  /** los puntos llegan uno por uno y, si está completo, el círculo se cierra */
  animar?: boolean;
  /** el siguiente lugar libre late: «aquí iría tu mano» */
  esperando?: boolean;
  className?: string;
  /** texto para lectores de pantalla; sin él, el dibujo es decorativo */
  etiqueta?: string;
}) {
  const llenas = Math.max(0, Math.min(MANOS_POR_SENA, Math.floor(manos)));
  const completo = manos >= MANOS_POR_SENA;
  const vacio = oscuro ? "var(--color-gray-600)" : "var(--color-gray-300)";
  const trazo = oscuro ? "var(--color-paper)" : "var(--color-ink)";
  const largo = 2 * Math.PI * 36;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={etiqueta ? "img" : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
    >
      <circle cx="50" cy="50" r="36" fill="none" stroke={vacio} strokeWidth="1.5" />
      {completo && (
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke={trazo}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={largo}
          transform="rotate(-90 50 50)"
          className={animar ? "circulo-cierra" : undefined}
          style={
            animar
              ? ({ "--largo": largo, "--retraso": `${MANOS_POR_SENA * 70 + 200}ms` } as React.CSSProperties)
              : undefined
          }
        />
      )}
      {Array.from({ length: MANOS_POR_SENA }, (_, i) => {
        const { x, y } = puntoMano(i);
        const llena = i < llenas;
        const esTuya = tuya === i + 1;
        const late = esperando && !completo && i === llenas;
        return (
          <g key={i}>
            {esTuya && (
              <circle cx={x} cy={y} r="11.5" fill="none" stroke={trazo} strokeWidth="2.5" />
            )}
            <circle
              cx={x}
              cy={y}
              r="8"
              fill={llena ? colorMano(i) : oscuro ? "var(--color-ink)" : "var(--color-paper)"}
              stroke={llena ? "none" : vacio}
              strokeWidth="1.5"
              strokeDasharray={llena ? undefined : "3 2.5"}
              className={late ? "mano-late" : llena && animar ? "mano-llega" : undefined}
              style={llena && animar ? ({ "--i": i } as React.CSSProperties) : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}
