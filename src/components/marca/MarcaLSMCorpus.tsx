"use client";

/**
 * MarcaLSMCorpus — la marca «LSM CORPUS» animada, sobre tarjeta blanca.
 *
 * Coreografía (bucle de 10.4 s, tomada del diseño «LSM Corpus Animation»):
 *   Intro       1.8 s  cada letra se escribe: el contorno se dibuja y luego se rellena
 *   Marca A     1.2 s  la marca compacta se sostiene y respira
 *   Transformar 2.2 s  cada letra se desliza y se estira hacia la marca ancha
 *   Marca B     1.8 s  la marca ancha se sostiene mientras la O se asienta
 *   Regreso     2.4 s  las letras vuelven, suaves, a la marca compacta
 *   Salida      1.0 s  las letras se desvanecen para que el bucle reinicie limpio
 *
 * Las letras existen en dos versiones (compacta y ancha, del archivo
 * original); la transformación interpola la caja de cada letra y cruza la
 * opacidad entre ambas. Se anima con requestAnimationFrame escribiendo
 * atributos (sin re-render), se pausa fuera de pantalla y, con
 * prefers-reduced-motion, queda fija en la marca compacta.
 */

import { useEffect, useRef } from "react";
import { GLIFOS_MARCA, LADO_MARCA } from "./lsm_corpus_glifos";

const ESCENAS = [1.8, 1.2, 2.2, 1.8, 2.4, 1.0] as const;
const TOTAL = ESCENAS.reduce((a, b) => a + b, 0);
const INICIO = ESCENAS.map((_, i) => ESCENAS.slice(0, i).reduce((a, b) => a + b, 0));

interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

function cajaDe(paths: string[]): Caja {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of paths) {
    const n = d.match(/-?\d+\.?\d*/g)!.map(Number);
    for (let i = 0; i + 1 < n.length; i += 2) {
      x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]);
      y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const CAJAS = GLIFOS_MARCA.map((g) => ({ fina: cajaDe(g.fina), gruesa: cajaDe(g.gruesa) }));

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const suave = (v: number) => { const c = clamp01(v); return c * c * (3 - 2 * c); };
const cubica = (v: number) => { const c = clamp01(v); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** transform que lleva la caja `de` a la caja `a` */
function mapa(de: Caja, a: Caja): string {
  const sx = a.w / de.w, sy = a.h / de.h;
  return `translate(${a.x.toFixed(2)} ${a.y.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${(-de.x).toFixed(2)} ${(-de.y).toFixed(2)})`;
}

export default function MarcaLSMCorpus({
  className = "",
  animada = true,
  titulo = "LSM Corpus",
}: {
  className?: string;
  /** false → marca compacta fija, sin animación */
  animada?: boolean;
  titulo?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const finas = useRef<(SVGGElement | null)[]>([]);
  const gruesas = useRef<(SVGGElement | null)[]>([]);
  const trazos = useRef<(SVGPathElement | null)[][]>(GLIFOS_MARCA.map(() => []));

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !animada) return;
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducido) {
      // fija en la marca compacta
      finas.current.forEach((g) => g?.removeAttribute("opacity"));
      gruesas.current.forEach((g) => g?.setAttribute("opacity", "0"));
      return;
    }

    // longitud de cada contorno para el dibujado de la intro
    const largos = trazos.current.map((ps) => ps.map((p) => (p ? p.getTotalLength() : 0)));

    let raf = 0;
    let visible = true;
    let inicioT = performance.now();
    let pausadoEn = 0;

    const cuadro = (ahora: number) => {
      raf = requestAnimationFrame(cuadro);
      if (!visible) return;
      const tau = ((ahora - inicioT) / 1000) % TOTAL;
      const respira = 1 + 0.012 * Math.sin((2 * Math.PI * tau) / 3.2);

      for (let k = 0; k < GLIFOS_MARCA.length; k++) {
        const gf = finas.current[k], gg = gruesas.current[k];
        if (!gf || !gg) continue;
        const cf = CAJAS[k].fina, cg = CAJAS[k].gruesa;
        // p: 0 = compacta, 1 = ancha
        let p = 0;
        let opF = 1, opG = 0, dibujo = 1, relleno = 1;

        if (tau < INICIO[1]) {
          // Intro: cada letra dibuja su contorno (0.9 s) y se rellena (0.4 s)
          const t0 = k * 0.11;
          dibujo = clamp01((tau - t0) / 0.9);
          relleno = clamp01((tau - t0 - 0.6) / 0.45);
          opF = tau < t0 ? 0 : 1;
        } else if (tau < INICIO[2]) {
          // Marca A: sostiene y respira (ver `respira`)
          p = 0;
        } else if (tau < INICIO[3]) {
          // Transformar: se desliza y estira hacia la marca ancha
          const t0 = INICIO[2] + k * 0.06;
          p = cubica((tau - t0) / 1.6);
        } else if (tau < INICIO[4]) {
          p = 1;
        } else if (tau < INICIO[5]) {
          // Regreso: vuelve a la compacta, en orden inverso
          const t0 = INICIO[4] + (GLIFOS_MARCA.length - 1 - k) * 0.06;
          p = 1 - cubica((tau - t0) / 1.8);
        } else {
          // Salida: se desvanece
          p = 0;
          const s = clamp01((tau - INICIO[5]) / 0.7);
          opF = 1 - suave(s);
        }

        // caja interpolada: ambas versiones se dibujan sobre ella
        const caja: Caja = {
          x: lerp(cf.x, cg.x, p), y: lerp(cf.y, cg.y, p),
          w: lerp(cf.w, cg.w, p), h: lerp(cf.h, cg.h, p),
        };
        // Marca B: la O (índice 4) se asienta con un pequeño rebote horizontal
        if (k === 4 && tau >= INICIO[3] && tau < INICIO[4]) {
          const s = tau - INICIO[3];
          const rebote = 1 + 0.035 * Math.exp(-2.2 * s) * Math.cos(7 * s);
          const cx = caja.x + caja.w / 2;
          caja.w *= rebote;
          caja.x = cx - caja.w / 2;
        }
        if (p > 0 && p < 1) {
          opF = 1 - p; opG = p;
        } else if (p >= 1) {
          opF = 0; opG = 1;
        }
        const tf = p === 0 ? "" : mapa(cf, caja);
        const tg = p === 1 && !(k === 4 && tau >= INICIO[3] && tau < INICIO[4]) ? "" : mapa(cg, caja);
        gf.setAttribute("transform", tf);
        gg.setAttribute("transform", tg);
        gf.setAttribute("opacity", opF.toFixed(3));
        gg.setAttribute("opacity", opG.toFixed(3));

        // contornos de la intro: dasharray = largo; el trazo se apaga al rellenar
        const ps = trazos.current[k];
        for (let j = 0; j < ps.length; j++) {
          const path = ps[j];
          if (!path) continue;
          const L = largos[k][j] || 1;
          if (dibujo < 1 || relleno < 1) {
            path.setAttribute("stroke-dasharray", String(L));
            path.setAttribute("stroke-dashoffset", String(L * (1 - dibujo)));
            path.setAttribute("stroke-opacity", String(1 - relleno));
            path.setAttribute("fill-opacity", String(relleno));
          } else {
            path.removeAttribute("stroke-dasharray");
            path.removeAttribute("stroke-dashoffset");
            path.setAttribute("stroke-opacity", "0");
            path.setAttribute("fill-opacity", "1");
          }
        }
      }
      // respiración de toda la marca (alrededor del centro)
      const c = LADO_MARCA / 2;
      svg.querySelector("g[data-letras]")?.setAttribute(
        "transform",
        `translate(${c} ${c}) scale(${respira.toFixed(4)}) translate(${-c} ${-c})`,
      );
    };

    // Pausar fuera de pantalla (y no saltar de escena al volver)
    const io = new IntersectionObserver(([e]) => {
      const ahora = performance.now();
      if (e.isIntersecting && !visible) {
        inicioT += ahora - pausadoEn;
      } else if (!e.isIntersecting && visible) {
        pausadoEn = ahora;
      }
      visible = e.isIntersecting;
    });
    io.observe(svg);
    raf = requestAnimationFrame(cuadro);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [animada]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${LADO_MARCA} ${LADO_MARCA}`}
      role="img"
      aria-label={titulo}
      className={`block aspect-square text-green ${className}`}
    >
      {/* tarjeta blanca */}
      <rect width={LADO_MARCA} height={LADO_MARCA} fill="#fff" />
      <g data-letras>
        {GLIFOS_MARCA.map((g, k) => (
          <g key={`${g.fila}-${g.columna}`}>
            {/* compacta: contorno + relleno (el contorno solo se ve en la intro) */}
            <g
              ref={(el) => { finas.current[k] = el; }}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinejoin="round"
              strokeOpacity={0}
              opacity={animada ? 0 : 1}
            >
              {g.fina.map((d, j) => (
                <path key={j} d={d} ref={(el) => { trazos.current[k][j] = el; }} />
              ))}
            </g>
            {/* ancha */}
            <g ref={(el) => { gruesas.current[k] = el; }} fill="currentColor" opacity={0}>
              {g.gruesa.map((d, j) => (
                <path key={j} d={d} />
              ))}
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
