/**
 * MarcaSignaPlay — mosaico del corpus para SignaPlay, hermano visual de la
 * marca LSM CORPUS: mismo cuadro, colores de la app (naranja y azul de
 * SignaPlay) y el nombre del nivel.
 */

// Colores de la app SignaPlay (Tokens.swift / signaplay_prek_content.json),
// declarados como tokens en globals.css: no son del sistema OtherAI.
const NARANJA = "var(--color-signaplay)";
const AZUL = "var(--color-signaplay-azul)";

export default function MarcaSignaPlay({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 225 225"
      role="img"
      aria-label="Corpus para SignaPlay, nivel preescolar"
      className={`block aspect-square ${className}`}
    >
      <rect width="225" height="225" fill={NARANJA} />
      <text
        x="27"
        y="96"
        fill="#fff"
        fontFamily="var(--font-display), system-ui, sans-serif"
        fontWeight="800"
        fontSize="54"
        letterSpacing="-2"
      >
        Signa
      </text>
      <text
        x="27"
        y="150"
        fill="#fff"
        fontFamily="var(--font-display), system-ui, sans-serif"
        fontWeight="800"
        fontSize="54"
        letterSpacing="-2"
      >
        Play
      </text>
      {/* el sobre del cartero: «El Correo de Lexsi» */}
      <g transform="translate(150 158)">
        <rect width="48" height="34" rx="5" fill={AZUL} />
        <path d="M0 6 L24 24 L48 6" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
