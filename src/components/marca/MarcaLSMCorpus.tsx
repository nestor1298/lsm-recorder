/**
 * MarcaLSMCorpus — la marca «LSM CORPUS» animada.
 *
 * Un cuadro verde con las nueve letras en rejilla. Cada letra existe en
 * trazo fino y en trazo grueso (los dos mosaicos del archivo original);
 * la animación cruza uno con otro, letra por letra, como un latido que
 * recorre la marca. Con `prefers-reduced-motion` queda fija en trazo
 * grueso. Es SVG en línea: escala sin perder nitidez y no carga nada.
 */

import {
  COLOR_MARCA,
  GLIFOS_MARCA,
  LADO_MARCA,
} from "./lsm_corpus_glifos";

export default function MarcaLSMCorpus({
  className = "",
  animada = true,
  titulo = "LSM Corpus",
}: {
  className?: string;
  /** false → siempre en trazo grueso, sin latido */
  animada?: boolean;
  titulo?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${LADO_MARCA} ${LADO_MARCA}`}
      role="img"
      aria-label={titulo}
      className={`marca-lsm ${animada ? "marca-lsm--animada" : ""} ${className}`}
      style={{ color: COLOR_MARCA }}
    >
      <rect width={LADO_MARCA} height={LADO_MARCA} fill="currentColor" />
      {GLIFOS_MARCA.map((g, i) => (
        <g
          key={`${g.fila}-${g.columna}`}
          className="marca-lsm__letra"
          style={{ "--i": i } as React.CSSProperties}
        >
          <g className="marca-lsm__fina" fill="#fff">
            {g.fina.map((d, k) => (
              <path key={k} d={d} />
            ))}
          </g>
          <g className="marca-lsm__gruesa" fill="#fff">
            {g.gruesa.map((d, k) => (
              <path key={k} d={d} />
            ))}
          </g>
        </g>
      ))}
    </svg>
  );
}
