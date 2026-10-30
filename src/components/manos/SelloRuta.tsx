/**
 * SelloRuta — el sello de una ruta de SignaPlay: un timbre redondo con
 * borde dentado y el número de la ruta. Sellado en dorado; por sellar,
 * punteado en gris.
 */

export default function SelloRuta({
  numero,
  sellada = true,
  size = 72,
  animar = false,
  etiqueta,
}: {
  numero: number;
  sellada?: boolean;
  size?: number;
  animar?: boolean;
  etiqueta?: string;
}) {
  const dientes = 18;
  const puntos: string[] = [];
  for (let i = 0; i < dientes * 2; i++) {
    const r = i % 2 === 0 ? 47 : 42;
    const a = (Math.PI * i) / dientes - Math.PI / 2;
    puntos.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  const tinta = sellada ? "var(--color-gold-deep)" : "var(--color-gray-300)";
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={etiqueta ? "img" : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
      className={animar ? "sello-cae" : sellada ? "-rotate-[8deg]" : undefined}
    >
      <polygon
        points={puntos.join(" ")}
        fill={sellada ? "var(--color-gold-tint)" : "var(--color-paper)"}
        stroke={tinta}
        strokeWidth="2"
        strokeDasharray={sellada ? undefined : "3 3"}
      />
      <circle cx="50" cy="50" r="33" fill="none" stroke={tinta} strokeWidth="1.5" />
      <text
        x="50"
        y="38"
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        letterSpacing="1.5"
        fill={tinta}
      >
        RUTA
      </text>
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fontSize="30"
        fontWeight="700"
        fill={sellada ? "var(--color-ink)" : "var(--color-gray-400)"}
      >
        {numero}
      </text>
    </svg>
  );
}
