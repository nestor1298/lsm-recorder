/**
 * ficha.ts — series de tiempo de una seña del léxico para la ficha visual:
 * flexión de cada dedo, separación de los dedos, trazo de las manos sobre
 * el cuerpo, silueta medida de la persona, cabeza y gestos de la cara.
 *
 * Todo sale de la pista (tracks/<id>.json.gz), recortada a la ventana de la
 * seña y con el tiempo desde 0, igual que trackToPose3D, para que la
 * línea de tiempo y el esqueleto 3D compartan reloj.
 */

import { faceLinesFor, type LexiconTrack } from "./track3d";

type V = number[];
export type XY = { x: number; y: number };

export const DEDOS = ["pulgar", "indice", "medio", "anular", "menique"] as const;
export type Dedo = (typeof DEDOS)[number];

export const DEDO_ES: Record<Dedo, string> = {
  pulgar: "Pulgar",
  indice: "Índice",
  medio: "Medio",
  anular: "Anular",
  menique: "Meñique",
};

/** Cadenas de MediaPipe Hand: base de cada dedo y sus tres articulaciones siguientes */
const CADENA: Record<Dedo, number[]> = {
  pulgar: [0, 1, 2, 3, 4],
  indice: [0, 5, 6, 7, 8],
  medio: [0, 9, 10, 11, 12],
  anular: [0, 13, 14, 15, 16],
  menique: [0, 17, 18, 19, 20],
};
/** Flexión total que cuenta como «cerrado del todo» (grados) */
const FLEX_MAX: Record<Dedo, number> = { pulgar: 120, indice: 240, medio: 240, anular: 240, menique: 240 };
/** Separación índice–meñique que cuenta como «abierta del todo» (grados) */
const SEP_MAX = 60;

const sub = (a: V, b: V) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V) => Math.hypot(a[0], a[1], a[2]);
function angulo(a: V, b: V): number {
  const na = norm(a);
  const nb = norm(b);
  if (na < 1e-9 || nb < 1e-9) return 0;
  const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Flexión de un dedo, 0 (estirado) a 1 (cerrado): suma de los ángulos
 * entre huesos consecutivos de la cadena. En el nudillo (MCP) se mide
 * contra el eje de la palma (muñeca → nudillo del medio) quitando lo que
 * el dedo se abre de lado; el pulgar cuenta desde su MCP.
 */
export function flexion(h: V[], dedo: Dedo): number {
  const c = CADENA[dedo];
  let s = 0;
  const desde = 2;
  if (dedo !== "pulgar") {
    // MCP: falange contra el eje de la palma, sin lo que se abre de lado
    const eje = sub(h[9], h[0]);
    const ancho = sub(h[17], h[5]);
    const na = norm(ancho) || 1;
    const u = [ancho[0] / na, ancho[1] / na, ancho[2] / na];
    const f = sub(h[c[2]], h[c[1]]);
    const lado = f[0] * u[0] + f[1] * u[1] + f[2] * u[2];
    s += angulo(eje, [f[0] - lado * u[0], f[1] - lado * u[1], f[2] - lado * u[2]]);
  }
  for (let k = desde; k < c.length - 1; k++) s += angulo(sub(h[c[k]], h[c[k - 1]]), sub(h[c[k + 1]], h[c[k]]));
  return clamp01(s / FLEX_MAX[dedo]);
}

/** Separación de los dedos, 0 (juntos) a 1: ángulo entre índice y meñique */
export function separacion(h: V[]): number {
  return clamp01(angulo(sub(h[6], h[5]), sub(h[18], h[17])) / SEP_MAX);
}

export interface SerieMano {
  /** flexión 0..1 por dedo y cuadro (null si no se vio la mano) */
  dedos: Record<Dedo, (number | null)[]>;
  separacion: (number | null)[];
  /** cuadros donde la mano solo se vio en 2D (sin profundidad: la forma no es fiable) */
  plana: boolean[];
  /** puntos x, y de la mano (metros, vista de la cámara, y hacia abajo) para dibujarla */
  dibujo: (XY[] | null)[];
}

export interface Silueta {
  /** puntos del cuerpo en anchos de hombro, origen entre los hombros, y hacia arriba */
  p: Record<string, XY>;
  /** trazos de la cara (cejas, ojos, nariz, boca, mandíbula) */
  cara: XY[][];
}

export interface Rasgo {
  clave: string;
  nombre: string;
  valores: number[];
}

export interface SeriesFicha {
  duracionMs: number;
  tiempos: number[];
  dom: SerieMano;
  nd: SerieMano | null;
  /** centro de la palma por cuadro, mismas unidades que la silueta */
  trazo: { dom: (XY | null)[]; nd: (XY | null)[] };
  silueta: Silueta | null;
  cabeza: { cabeceo: number[]; giro: number[] } | null;
  cara: Rasgo[];
}

const PLANAS = new Set(["rtmw", "interp2d"]);
const PALMA = [0, 5, 9, 13, 17];

function serieMano(frames: { w?: V[]; src?: string }[]): SerieMano {
  const dedos = Object.fromEntries(DEDOS.map((d) => [d, [] as (number | null)[]])) as SerieMano["dedos"];
  const sep: (number | null)[] = [];
  const plana: boolean[] = [];
  const dibujo: (XY[] | null)[] = [];
  for (const f of frames) {
    const ok = Boolean(f.w && f.w.length >= 21);
    for (const d of DEDOS) dedos[d].push(ok ? flexion(f.w!, d) : null);
    sep.push(ok ? separacion(f.w!) : null);
    plana.push(ok && PLANAS.has(f.src ?? ""));
    dibujo.push(ok ? f.w!.map((v) => ({ x: v[0], y: v[1] })) : null);
  }
  return { dedos, separacion: sep, plana, dibujo };
}

const mediana = (v: number[]) => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Nombres en español de los gestos de la cara (blendshapes ARKit, izquierda y derecha juntas) */
export const GESTO_ES: Record<string, string> = {
  browInnerUp: "Cejas arriba (centro)",
  browOuterUp: "Cejas arriba (lados)",
  browDown: "Ceño",
  jawOpen: "Boca abierta",
  jawForward: "Mandíbula adelante",
  mouthClose: "Labios cerrados",
  mouthPucker: "Labios en beso",
  mouthFunnel: "Labios en embudo",
  mouthSmile: "Sonrisa",
  mouthFrown: "Comisuras abajo",
  mouthStretch: "Boca estirada",
  mouthPress: "Labios apretados",
  mouthRollLower: "Labio inferior adentro",
  mouthRollUpper: "Labio superior adentro",
  mouthShrugLower: "Labio inferior arriba",
  mouthShrugUpper: "Labio superior arriba",
  mouthLowerDown: "Labio inferior abajo",
  mouthUpperUp: "Labio superior arriba",
  mouthDimple: "Hoyuelos",
  mouth: "Boca de lado",
  jaw: "Mandíbula de lado",
  cheekPuff: "Mejillas infladas",
  cheekSquint: "Mejillas arriba",
  noseSneer: "Nariz arrugada",
  eyeSquint: "Ojos entrecerrados",
  eyeWide: "Ojos muy abiertos",
  tongueOut: "Lengua afuera",
};
/** Gestos que se mueven solos (parpadeo, mirada): no cuentan como rasgo */
const RUIDO = /^(eyeBlink|eyeLook)/;

/**
 * Las tres señales de la cara que más cambian durante la seña (rango
 * máximo − mínimo), con izquierda y derecha juntas.
 */
function rasgosCara(order: string[] | undefined, bs: (V | undefined)[]): Rasgo[] {
  if (!order?.length) return [];
  const grupos = new Map<string, number[]>();
  order.forEach((k, i) => {
    if (RUIDO.test(k)) return;
    const base = k.replace(/(Left|Right)$/, "");
    grupos.set(base, [...(grupos.get(base) ?? []), i]);
  });
  const out: (Rasgo & { rango: number })[] = [];
  for (const [base, idx] of grupos) {
    const valores = bs.map((v) => (v ? Math.max(...idx.map((i) => v[i] ?? 0)) : 0));
    const rango = Math.max(...valores) - Math.min(...valores);
    if (Math.max(...valores) < 0.2 || rango < 0.12) continue;
    out.push({ clave: base, nombre: GESTO_ES[base] ?? base, valores, rango });
  }
  return out
    .sort((a, b) => b.rango - a.rango)
    .slice(0, 3)
    .map(({ clave, nombre, valores }) => ({ clave, nombre, valores }));
}

/** Pista del léxico con los campos que usa la ficha (los que no lee trackToPose3D) */
export interface PistaFicha extends LexiconTrack {
  blendshape_order?: string[];
  frames: (LexiconTrack["frames"][number] & {
    dom?: V[];
    nd?: V[];
    dom_src?: string;
    nd_src?: string;
    bs?: V;
    head?: V;
  })[];
}

export function seriesFicha(track: PistaFicha): SeriesFicha {
  const [a, b] = track.window_index ?? [0, track.frames.length - 1];
  const win = track.frames.slice(a, b + 1).filter((f) => f.pose_world?.length);
  const t0 = win[0]?.t ?? 0;
  const W = track.video?.width ?? 1;
  const H = track.video?.height ?? 1;
  const tiempos = win.map((f) => f.t - t0);

  // marco del cuerpo: mediana de hombros en píxeles
  const conPose = win.filter((f) => f.pose && f.pose.length >= 25);
  const mx = mediana(conPose.map((f) => ((f.pose![11][0] + f.pose![12][0]) / 2) * W));
  const my = mediana(conPose.map((f) => ((f.pose![11][1] + f.pose![12][1]) / 2) * H));
  const sw = mediana(conPose.map((f) => Math.hypot((f.pose![11][0] - f.pose![12][0]) * W, (f.pose![11][1] - f.pose![12][1]) * H)));
  const listo = conPose.length > 0 && sw > 5;
  const aCuerpo = (x: number, y: number): XY => ({ x: (x * W - mx) / sw, y: -(y * H - my) / sw });
  const palma = (h?: V[]): XY | null => {
    if (!listo || !h || h.length < 21) return null;
    const x = PALMA.reduce((s, i) => s + h[i][0], 0) / PALMA.length;
    const y = PALMA.reduce((s, i) => s + h[i][1], 0) / PALMA.length;
    return aCuerpo(x, y);
  };

  let silueta: Silueta | null = null;
  if (listo) {
    const med = (i: number): XY => aCuerpo(mediana(conPose.map((f) => f.pose![i][0])), mediana(conPose.map((f) => f.pose![i][1])));
    const p: Record<string, XY> = {};
    for (const [k, i] of Object.entries({ nariz: 0, ojoI: 2, ojoD: 5, orejaI: 7, orejaD: 8, hombroI: 11, hombroD: 12, codoI: 13, codoD: 14, caderaI: 23, caderaD: 24 })) {
      p[k] = med(i);
    }
    const fmi = track.facemark_index ?? [];
    const conCara = win.filter((f) => f.fm?.length === fmi.length && fmi.length > 0);
    const cara = conCara.length
      ? faceLinesFor(fmi).map((tr) =>
          tr.map((k) => aCuerpo(mediana(conCara.map((f) => f.fm![k][0])), mediana(conCara.map((f) => f.fm![k][1])))),
        )
      : [];
    silueta = { p, cara };
  }

  const hasNd = win.some((f) => f.nd_world?.length);
  const conCabeza = win.filter((f) => f.head?.length === 3);
  const cabeza =
    conCabeza.length >= 3
      ? (() => {
          const p0 = mediana(conCabeza.map((f) => f.head![0]));
          const y0 = mediana(conCabeza.map((f) => f.head![1]));
          return {
            cabeceo: win.map((f) => (f.head ? f.head[0] - p0 : 0)),
            giro: win.map((f) => (f.head ? f.head[1] - y0 : 0)),
          };
        })()
      : null;

  return {
    duracionMs: tiempos.at(-1) ?? 0,
    tiempos,
    dom: serieMano(win.map((f) => ({ w: f.dom_world, src: f.dom_src }))),
    nd: hasNd ? serieMano(win.map((f) => ({ w: f.nd_world, src: f.nd_src }))) : null,
    trazo: { dom: win.map((f) => palma(f.dom)), nd: win.map((f) => palma(f.nd)) },
    silueta,
    cabeza,
    cara: rasgosCara(track.blendshape_order, win.map((f) => f.bs)),
  };
}

/** Índice del cuadro más cercano a `t` (ms desde el inicio de la ventana) */
export function cuadroEn(tiempos: number[], t: number): number {
  if (!tiempos.length) return -1;
  let lo = 0;
  let hi = tiempos.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (tiempos[m] < t) lo = m + 1;
    else hi = m;
  }
  return lo > 0 && Math.abs(tiempos[lo - 1] - t) <= Math.abs(tiempos[lo] - t) ? lo - 1 : lo;
}

/**
 * Momentos para dibujar la mano: `n` tiempos repartidos en la seña, cada
 * uno en el cuadro con mano más cercano (sin repetir cuadros).
 */
export function momentosClave(tiempos: number[], dibujo: (XY[] | null)[], n: number): number[] {
  const con = tiempos.map((_, i) => i).filter((i) => dibujo[i]);
  if (!con.length) return [];
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const t = tiempos[0] + ((tiempos.at(-1)! - tiempos[0]) * k) / Math.max(1, n - 1);
    const i = con.reduce((best, j) => (Math.abs(tiempos[j] - t) < Math.abs(tiempos[best] - t) ? j : best), con[0]);
    if (!out.includes(i)) out.push(i);
  }
  return out;
}
