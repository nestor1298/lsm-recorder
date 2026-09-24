/**
 * MarcaSignaPlay — el wordmark de SignaPlay (signaplay.pdf) sobre tarjeta
 * blanca, hermano de la marca LSM CORPUS: «Signa» en naranja intenso,
 * «Play» en naranja claro, con letras de anchos variables. SVG en línea,
 * nítido a cualquier tamaño.
 */

import { GLIFOS_SIGNAPLAY, VISTA_SIGNAPLAY } from "./signaplay_glifos";

const LADO = 225;

export default function MarcaSignaPlay({
  className = "",
}: {
  className?: string;
}) {
  // El wordmark se centra en la tarjeta cuadrada con un margen del 10 %
  const [vx, vy, vw, vh] = VISTA_SIGNAPLAY;
  const margen = LADO * 0.1;
  const escala = Math.min((LADO - 2 * margen) / vw, (LADO - 2 * margen) / vh);
  const dx = (LADO - vw * escala) / 2 - vx * escala;
  const dy = (LADO - vh * escala) / 2 - vy * escala;
  return (
    <svg
      viewBox={`0 0 ${LADO} ${LADO}`}
      role="img"
      aria-label="Corpus para SignaPlay, nivel preescolar"
      className={`block aspect-square ${className}`}
    >
      <rect width={LADO} height={LADO} fill="#fff" />
      <g transform={`translate(${dx.toFixed(3)} ${dy.toFixed(3)}) scale(${escala.toFixed(5)})`}>
        {GLIFOS_SIGNAPLAY.map((g, i) => (
          <path key={i} d={g.d} fill={g.fill} />
        ))}
      </g>
    </svg>
  );
}
