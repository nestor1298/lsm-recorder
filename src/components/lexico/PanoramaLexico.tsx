/**
 * PanoramaLexico — el léxico en conjunto: de dónde sale, cuánto se midió
 * y cómo se reparten la forma, el lugar, la orientación, el movimiento,
 * las manos y la cara. Componente de servidor: llega como HTML estático.
 *
 * Mismo lenguaje que la ficha de cada seña: tinta sobre papel, azul para
 * lo que se destaca, magenta para la cara, sin degradados.
 */

import Link from "next/link";
import { CM_INVENTORY } from "@/lib/data";
import { MiniHand } from "@/components/learn/MiniHand";
import {
  CONTOUR_ES,
  EYEBROWS_ES,
  FINGER_ES,
  HEAD_ES,
  MOUTH_ES,
  PALM_ES,
  PLANE_ES,
  RELATION_ES,
} from "@/lib/anotar_labels";
import { REGION_LABELS, UB_LOCATIONS } from "@/lib/ub_inventory";
import { BANDERAS_ES } from "@/lib/lexicon/banderas";
import type { Conteo, Panorama } from "@/lib/lexicon/panorama";
import type { ContourMovement } from "@/lib/types";
import { PictoMV } from "./ficha/Pictogramas";

const cmPorId = new Map(CM_INVENTORY.map((c) => [c.cm_id, c]));
const ubPorCodigo = new Map(UB_LOCATIONS.map((l) => [l.code, l]));
const mil = (n: number) => n.toLocaleString("es-MX");
const pct = (n: number, de: number) => (de ? `${Math.round((n / de) * 100)} %` : "—");

// ── Piezas ─────────────────────────────────────────────────────

function Seccion({ id, sigla, titulo, lema, children }: { id: string; sigla?: string; titulo: string; lema?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-gray-200 pt-8 sm:pt-10">
      <div className="mb-6 grid gap-2 lg:grid-cols-[16rem_1fr] lg:gap-10">
        <div>
          {sigla && <p className="overline-label font-semibold text-accent-deep">{sigla}</p>}
          <h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-ink">{titulo}</h2>
        </div>
        {lema && <p className="max-w-2xl self-end text-[15px] leading-relaxed text-gray-600">{lema}</p>}
      </div>
      {children}
    </section>
  );
}

function Cifra({ k, v, nota }: { k: string; v: string; nota?: string }) {
  return (
    <div className="min-w-0 bg-paper p-5">
      <p className="overline-label text-gray-400">{k}</p>
      <p className="mt-2 font-display text-4xl font-bold tracking-[-0.03em] text-ink tabular-nums sm:text-5xl">{v}</p>
      {nota && <p className="mt-1 text-[13px] text-gray-500">{nota}</p>}
    </div>
  );
}

/** Lista de barras horizontales: etiqueta, barra y número */
function Barras({
  titulo,
  items,
  etiqueta,
  total,
  color = "bg-ink",
  max = 8,
  ancho = "9.5rem",
}: {
  titulo?: string;
  items: Conteo[];
  etiqueta: (k: string) => string;
  total: number;
  color?: string;
  max?: number;
  /** ancho máximo de la columna de etiquetas */
  ancho?: string;
}) {
  const tope = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="min-w-0">
      {titulo && <h3 className="overline-label mb-3 text-gray-500">{titulo}</h3>}
      <ul className="space-y-2">
        {items.slice(0, max).map((i) => (
          <li key={i.clave} className="grid items-center gap-3 text-sm" style={{ gridTemplateColumns: `minmax(0,${ancho}) 1fr auto` }}>
            <span className="truncate text-gray-700" title={etiqueta(i.clave)}>
              {etiqueta(i.clave)}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-gray-100">
              <span className={`block h-full rounded-full ${color}`} style={{ width: `${(i.n / tope) * 100}%` }} />
            </span>
            <span className="w-20 text-right tabular-nums text-ink">
              {mil(i.n)} <span className="text-gray-400">{pct(i.n, total)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Histograma en columnas */
function Columnas({ cajas, etiqueta, titulo, nota }: { cajas: { desde: number; n: number }[]; etiqueta: (d: number) => string; titulo: string; nota?: string }) {
  const tope = Math.max(1, ...cajas.map((c) => c.n));
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="overline-label text-gray-500">{titulo}</span>
        {nota && <span className="text-xs text-gray-400">{nota}</span>}
      </figcaption>
      <div className="flex h-32 items-end gap-[3px]" aria-hidden>
        {cajas.map((c) => (
          <div key={c.desde} className="flex h-full flex-1 flex-col justify-end" title={`${etiqueta(c.desde)}: ${mil(c.n)}`}>
            <div className="rounded-t-sm bg-ink" style={{ height: `${(c.n / tope) * 100}%`, minHeight: c.n ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-gray-400">
        <span>{etiqueta(cajas[0]?.desde ?? 0)}</span>
        <span>{etiqueta(cajas[Math.floor(cajas.length / 2)]?.desde ?? 0)}</span>
        <span>{etiqueta(cajas.at(-1)?.desde ?? 0)}+</span>
      </div>
    </figure>
  );
}

/** Mapa del cuerpo: un círculo por lugar, su área según cuántas señas lo usan */
function MapaCuerpo({ todos }: { todos: Conteo[] }) {
  const tope = Math.max(1, ...todos.map((t) => t.n));
  const r = (n: number) => 3 + Math.sqrt(n / tope) * 22;
  const neutro = todos.find((t) => t.clave === "EN");
  const puntos = todos.filter((t) => t.clave !== "EN" && ubPorCodigo.has(t.clave)).sort((a, b) => b.n - a.n);
  // seis etiquetas, a cada lado repartidas para que no se encimen
  const etiquetas = (["izq", "der"] as const).flatMap((lado) => {
    let ultimo = -Infinity;
    return puntos
      .slice(0, 6)
      .map((p) => ({ ...p, loc: ubPorCodigo.get(p.clave)! }))
      .filter((p) => (p.loc.x >= 100) === (lado === "der"))
      .sort((a, b) => a.loc.y - b.loc.y)
      .map((p) => {
        const y = Math.max(p.loc.y, ultimo + 18);
        ultimo = y;
        return { ...p, y, der: lado === "der" };
      });
  });
  return (
    <svg viewBox="0 0 200 260" className="mx-auto h-auto w-full max-w-[22rem]" role="img" aria-label="Lugares del cuerpo donde se hacen las señas">
      <g fill="none" stroke="var(--color-gray-300)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx={100} cy={40} rx={22} ry={28} />
        <path d="M92,67 L92,82 M108,67 L108,82" />
        <path d="M68,88 Q66,86 68,84 L132,84 Q134,86 132,88 L138,165 Q138,180 120,182 L80,182 Q62,180 62,165 Z" />
        <path d="M68,88 Q55,92 50,110 L44,150 Q40,165 38,190 L32,215 Q28,230 30,235" />
        <path d="M132,88 Q145,92 150,110 L156,150 Q160,165 162,190 L168,215 Q172,230 170,235" />
      </g>
      {neutro && (
        <g>
          <ellipse cx={100} cy={150} rx={r(neutro.n) * 1.5} ry={r(neutro.n) * 0.9} fill="var(--color-accent-tint)" fillOpacity={0.6} stroke="var(--color-accent)" strokeWidth={1.2} strokeDasharray="4 3" />
          <text x={100} y={150 + r(neutro.n) * 0.9 + 11} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="var(--color-accent-deep)">
            Espacio neutro · {mil(neutro.n)}
          </text>
        </g>
      )}
      {puntos.map((p) => {
        const loc = ubPorCodigo.get(p.clave)!;
        return (
          <g key={p.clave}>
            <title>{`${loc.name} (${p.clave}): ${mil(p.n)}`}</title>
            <circle cx={loc.x} cy={loc.y} r={r(p.n)} fill="var(--color-ink)" fillOpacity={0.14} stroke="var(--color-ink)" strokeWidth={0.8} />
            <circle cx={loc.x} cy={loc.y} r={1.6} fill="var(--color-ink)" />
          </g>
        );
      })}
      {etiquetas.map(({ clave, n, loc, y, der }) => {
        const x = der ? 196 : 4;
        const codo = der ? 170 : 30;
        return (
          <g key={`e-${clave}`}>
            <polyline points={`${loc.x},${loc.y} ${codo},${y} ${der ? 176 : 24},${y}`} fill="none" stroke="var(--color-gray-400)" strokeWidth={0.5} />
            <text x={x} y={y - 1.5} textAnchor={der ? "end" : "start"} fontSize={7} fill="var(--color-ink)">
              {loc.name}
            </text>
            <text x={x} y={y + 6.5} textAnchor={der ? "end" : "start"} fontSize={6.5} fill="var(--color-gray-500)">
              {mil(n)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const nombreUB = (k: string) => (k === "EN" ? "Espacio neutro" : (ubPorCodigo.get(k)?.name ?? k));
const de = (m: Record<string, string>) => (k: string) => m[k] ?? k.toLowerCase();
const minus = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ── La página ──────────────────────────────────────────────────

export default function PanoramaLexico({ p }: { p: Panorama }) {
  const m = p.medidas;
  const n = p.conFonologia;
  const lsmMedidas = n - p.banderas.filter((b) => b.clave === "otra_lengua").reduce((s, b) => s + b.n, 0);
  const minutos = Math.round(m.segundosDeVideo / 60);
  const contornoTotal = p.contorno.reduce((s, c) => s + c.n, 0);
  const enNeutro = p.ub.todos.find((u) => u.clave === "EN")?.n ?? 0;
  const lugaresCuerpo = p.ub.todos.filter((u) => u.clave !== "EN").slice(0, 3).map((u) => minus(nombreUB(u.clave)));
  const trayectos = p.contorno.filter((c) => c.clave !== "NINGUNO").slice(0, 2).map((c) => minus(CONTOUR_ES[c.clave as ContourMovement] ?? c.clave));
  const relacionTop = p.relacion.find((r) => r.clave !== "UNA_MANO");
  const cabezaMueve = p.cabeza.filter((c) => c.clave !== "NONE").reduce((s, c) => s + c.n, 0);
  const caraNeutral = p.cejas.find((c) => c.clave === "NEUTRAL")?.n ?? 0;

  return (
    <article className="space-y-10 sm:space-y-12">
      <nav>
        <Link href="/lexico" className="text-sm font-medium text-gray-500 transition hover:text-accent-deep">
          ← Léxico
        </Link>
      </nav>

      <header className="max-w-4xl">
        <p className="overline-label flex flex-wrap gap-x-2 text-gray-400">
          <span className="text-accent-deep">LSM</span>
          <span>Léxico Wikisigns</span>
          <span>Panorama</span>
        </p>
        <h1 className="mt-2 font-display text-5xl font-bold leading-[0.95] tracking-[-0.035em] text-ink sm:text-6xl lg:text-7xl">
          El léxico en cifras
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
          {mil(p.entradas)} señas del diccionario de Wikisigns, medidas cuadro a cuadro con visión por computadora: forma de la mano,
          lugar, orientación, movimiento, una o dos manos y la cara.
        </p>
      </header>

      {/* cifras clave */}
      <section aria-label="Cifras clave" className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 lg:grid-cols-4">
        <Cifra k="Señas" v={mil(p.entradas)} nota={`${mil(p.lsm)} de LSM · ${mil(p.otrasLenguas)} de otras lenguas`} />
        <Cifra k="Medidas" v={mil(n)} nota={`${pct(n, p.entradas)} tiene video y se midió`} />
        <Cifra k="Formas de mano" v={`${p.cm.distintas}`} nota={`de las ${CM_INVENTORY.length} del inventario`} />
        <Cifra k="Lugares" v={`${p.ub.distintas}`} nota="puntos del cuerpo y espacio neutro" />
        <Cifra k="Dos manos" v={pct(m.dosManos, n)} nota={`${mil(m.dosManos)} señas`} />
        <Cifra k="Con repetición" v={pct(m.conRepeticion, n)} nota={`${mil(m.conRepeticion)} repiten el movimiento`} />
        <Cifra k="Duración típica" v={`${(m.duracionMedianaMs / 1000).toFixed(1)} s`} nota="mediana de la seña, sin reposo" />
        <Cifra k="Video analizado" v={`${minutos} min`} nota={`${mil(m.cuadros)} cuadros · confianza media de lo medido: ${Math.round(m.confianzaMedia * 100)} %`} />
      </section>

      {/* de la fuente a la seña medida */}
      <Seccion id="fuente" titulo="De la fuente a la seña medida" lema="Cada página de Wikisigns puede traer varios videos (variantes). Las que tienen video se miden; las que ya no están en YouTube quedan con su glosa y su fuente.">
        <div className="space-y-4">
          {[
            ["Páginas recorridas", p.paginas ?? p.entradas, "bg-gray-300"],
            ["Señas (una por video)", p.entradas, "bg-gray-500"],
            ["Con video y medidas", n, "bg-ink"],
            ["Medidas de LSM", lsmMedidas, "bg-accent"],
          ].map(([k, v, c]) => (
            <div key={k as string} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-3 text-sm sm:grid-cols-[13rem_1fr_5rem]">
              <span className="text-gray-700">{k}</span>
              <span className="h-6 overflow-hidden rounded-md bg-gray-50">
                <span className={`block h-full rounded-md ${c}`} style={{ width: `${((v as number) / Math.max(1, p.paginas ?? p.entradas)) * 100}%` }} />
              </span>
              <span className="text-right font-display text-lg font-semibold tabular-nums text-ink">{mil(v as number)}</span>
            </div>
          ))}
          <p className="text-sm text-gray-500">
            {mil(p.sinVideo)} señas ya no tienen video en YouTube · {mil(p.frases)} son frases.
          </p>
        </div>
      </Seccion>

      {/* CM */}
      <Seccion
        id="cm"
        sigla="CM"
        titulo="Forma de la mano"
        lema={`Aparecen ${p.cm.distintas} de las ${CM_INVENTORY.length} configuraciones del inventario, pero pocas hacen casi todo el trabajo: las doce más usadas cubren el ${pct(
          p.cm.top.slice(0, 12).reduce((s, c) => s + c.n, 0),
          n,
        )} de las señas.`}
      >
        <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-3 lg:grid-cols-6">
          {p.cm.top.slice(0, 12).map((c, k) => {
            const cm = cmPorId.get(c.clave);
            return (
              <li key={c.clave} className="flex flex-col bg-paper p-4">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[11px] text-gray-400">{String(k + 1).padStart(2, "0")}</span>
                  <span className="font-display text-xl font-bold tabular-nums text-ink">{mil(c.n)}</span>
                </div>
                <div className="my-2 flex h-20 items-center justify-center">{cm ? <MiniHand cm={cm} size={76} /> : null}</div>
                <p className="font-mono text-[13px] text-ink">
                  {cm?.cruz_aldrete_notation ?? "—"} <span className="text-gray-400">#{c.clave}</span>
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(c.n / p.cm.top[0].n) * 100}%` }} />
                </div>
                <Link href={`/lexico/sena?id=${c.ejemplo.id}`} className="mt-2 truncate text-[13px] text-gray-500 hover:text-accent-deep" title={c.ejemplo.gloss}>
                  p. ej. <span className="font-medium text-ink underline decoration-gray-300 underline-offset-2">{c.ejemplo.gloss}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </Seccion>

      {/* UB */}
      <Seccion
        id="ub"
        sigla="UB"
        titulo="Lugar"
        lema={`El ${pct(enNeutro, n)} de las señas se hace en el espacio neutro, frente al cuerpo. En el cuerpo, los lugares más usados son ${lugaresCuerpo.join(", ").replace(/, ([^,]*)$/, " y $1")}. El área de cada círculo es proporcional a cuántas señas lo usan.`}
      >
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-gray-200 bg-paper p-4 sm:p-6">
            <MapaCuerpo todos={p.ub.todos} />
          </div>
          <div className="space-y-8">
            <Barras titulo="Lugares más usados" items={p.ub.todos} etiqueta={nombreUB} total={n} max={10} />
            <Barras titulo="Por región" items={p.ub.regiones} etiqueta={(k) => REGION_LABELS[k] ?? k} total={n} color="bg-gray-500" />
          </div>
        </div>
      </Seccion>

      {/* OR */}
      <Seccion id="or" sigla="OR" titulo="Orientación" lema="Hacia dónde mira la palma y hacia dónde apuntan los dedos en el núcleo de la seña.">
        <div className="grid gap-8 md:grid-cols-2">
          <Barras titulo="Palma" items={p.palma} etiqueta={de(PALM_ES)} total={n} color="bg-accent" />
          <Barras titulo="Dedos" items={p.dedos} etiqueta={de(FINGER_ES)} total={n} />
        </div>
      </Seccion>

      {/* MV */}
      <Seccion
        id="mv"
        sigla="MV"
        titulo="Movimiento"
        lema={`Los trayectos más comunes son ${trayectos.join(" y ")}; el ${pct(m.conRepeticion, n)} de las señas repite su movimiento. El ${pct(p.estructura.find((e) => e.clave === "M")?.n ?? 0, n)} es un solo movimiento (M); las demás empiezan o terminan con una detención en otro lugar.`}
      >
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-3 lg:grid-cols-6">
          {p.contorno.map((c) => (
            <div key={c.clave} className="flex flex-col bg-paper p-4">
              <div className="flex h-16 items-center justify-center">
                <div className="h-14 w-24">
                  <PictoMV contorno={c.clave === "NINGUNO" ? null : (c.clave as ContourMovement)} />
                </div>
              </div>
              <p className="mt-2 font-display text-[17px] font-semibold text-ink">
                {c.clave === "NINGUNO" ? "Sin trayecto" : (CONTOUR_ES[c.clave as ContourMovement] ?? c.clave)}
              </p>
              <p className="text-sm tabular-nums text-gray-500">
                {mil(c.n)} · {pct(c.n, contornoTotal)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <Barras titulo="Plano" items={p.plano} etiqueta={de(PLANE_ES)} total={n} />
          <Barras titulo="Estructura" items={p.estructura} etiqueta={(k) => (k === "M" ? "M · un movimiento" : k)} total={n} color="bg-gray-500" />
        </div>
      </Seccion>

      {/* dos manos */}
      <Seccion
        id="manos"
        sigla="2M"
        titulo="Una o dos manos"
        lema={`El ${pct(m.dosManos, n)} de las señas usa las dos manos${relacionTop ? `; lo más común es «${minus((RELATION_ES as Record<string, string>)[relacionTop.clave] ?? relacionTop.clave)}»` : ""}. ${mil(m.zurdas)} señas se hicieron con la izquierda como mano dominante.`}
      >
        <Barras
          items={p.relacion}
          etiqueta={(k) => (k === "UNA_MANO" ? "Una mano" : (RELATION_ES as Record<string, string>)[k] ?? k)}
          total={n}
          color="bg-green"
        />
      </Seccion>

      {/* RNM */}
      <Seccion
        id="rnm"
        sigla="RNM"
        titulo="Cara y cabeza"
        lema={`Los rasgos no manuales que se detectaron. Las cejas quedan neutrales en el ${pct(caraNeutral, n)} de las señas; la cabeza se mueve en el ${pct(cabezaMueve, n)}.`}
      >
        <div className="grid gap-8 md:grid-cols-3">
          <Barras titulo="Cabeza" items={p.cabeza} etiqueta={de(HEAD_ES)} total={n} color="bg-magenta" />
          <Barras titulo="Cejas" items={p.cejas} etiqueta={de(EYEBROWS_ES)} total={n} color="bg-magenta" />
          <Barras titulo="Boca" items={p.boca} etiqueta={de(MOUTH_ES)} total={n} color="bg-magenta" />
        </div>
      </Seccion>

      {/* tiempo y calidad */}
      <Seccion id="calidad" titulo="Tiempo y calidad" lema="Cuánto dura cada seña, qué tan segura está la medición y qué se marcó para revisar. Toda la descripción es automática (procedencia «auto») y falta que la revise una persona Sorda.">
        <div className="grid gap-10 md:grid-cols-2">
          <Columnas titulo="Duración de la seña" nota={`mediana ${(m.duracionMedianaMs / 1000).toFixed(2)} s`} cajas={p.duracion} etiqueta={(d) => `${(d / 1000).toFixed(1)} s`} />
          <Columnas titulo="Confianza" nota={`media ${Math.round(m.confianzaMedia * 100)} %`} cajas={p.confianza} etiqueta={(d) => `${Math.round(d * 100)} %`} />
        </div>
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <Barras titulo="Banderas" items={p.banderas} etiqueta={(k) => BANDERAS_ES[k] ?? k} total={p.entradas} color="bg-gold" max={10} ancho="15rem" />
          <div>
            <h3 className="overline-label mb-3 text-gray-500">Manos recuperadas</h3>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200">
              {[
                ["Recorte guiado por la pose", p.manos.recorte],
                ["RTMW con forma 3D", p.manos.rtmw3d],
                ["RTMW solo 2D", p.manos.rtmw2d],
                ["Huecos rellenados", p.manos.interpoladas],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-paper p-4">
                  <dt className="text-[13px] text-gray-500">{k}</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">{mil(v as number)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-gray-500">
              Manos que MediaPipe no vio a la primera y se recuperaron. Se descartaron {mil(p.manos.descartadas)} falsas (sobre todo en la cara).
            </p>
          </div>
        </div>
      </Seccion>

      <footer className="border-t border-gray-100 pt-6 text-xs text-gray-500">
        Fuente:{" "}
        <a href="https://www.wikisigns.org/list/es/lsm" target="_blank" rel="noreferrer" className="underline hover:text-accent-deep">
          Wikisigns, Lengua de Señas Mexicana
        </a>
        , licencia CC BY-SA 4.0. Fonología extraída automáticamente por SignaLab (LSM-Lex 1.0).
      </footer>
    </article>
  );
}
