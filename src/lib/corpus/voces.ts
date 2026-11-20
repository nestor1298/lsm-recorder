/**
 * voces.ts — del video a oraciones señadas, para el corpus VOCES EN SEÑAS.
 *
 * Capa pura (sin lecturas de disco): recibe los cuadros por persona
 * (scripts/voces/extraer.py), los subtítulos leídos con OCR y el léxico, y
 * devuelve, por oración escrita:
 *   - quién la seña (seudónimo) y en qué tramo del video;
 *   - las señas en que se corta ese tramo (pausas del movimiento de la mano);
 *   - la fonología de cada seña (CM, UB, OR, MV, dos manos), con las mismas
 *     funciones que el léxico (aggregate de phon_features);
 *   - una transliteración en glosas: la seña del léxico más parecida, con
 *     ventaja para las que coinciden con palabras de la oración.
 *
 * Todo es automático y aproximado: el subtítulo traduce, no glosa; la
 * segmentación por pausas confunde señas compuestas y transiciones; y la
 * glosa es la más parecida del léxico, no un reconocimiento. Falta que lo
 * revise una persona Sorda.
 */

import { cleanHands, dominantImageSide, isFlatHand, pickHands, refineZigzag, type RawFrame, type V3 } from "@/lib/lexicon/derive";
import { aggregate, type PhonFrame, type Pt } from "@/lib/vision/phon/phon_features";

// ── Entradas ────────────────────────────────────────────────────

export interface CuerpoVoces {
  pista: number | null;
  persona: string | null;
  pose: [number, number, number, number][];
  pose_world: V3[];
  hands: V3[][];
  hands_world: V3[][];
  hand_src: string[];
  hand_wrist: number[];
  blendshapes?: Record<string, number> | null;
  head?: V3 | null;
}

export interface CuadroVoces {
  t: number;
  toma: number;
  gente: CuerpoVoces[];
}

export interface FramesVoces {
  youtube_id: string;
  video: { width: number; height: number; fps: number };
  frames: CuadroVoces[];
}

export interface Tarjeta {
  t0: number;
  t1: number;
  texto: string;
}

export interface OracionOCR {
  t0: number;
  t1: number;
  texto: string;
  tarjetas: number;
}

/** Lo que el corpus necesita de cada seña del léxico */
export interface LexRef {
  id: string;
  gloss: string;
  spanish: string;
  synonyms: string[];
  cm: number | null;
  ub: string | null;
  two_handed: boolean;
  contour: string | null;
  palm: string | null;
  fingers: string | null;
}

// ── Series por persona ─────────────────────────────────────────

const HUECO_MS = 300;

/**
 * Cuadros de cada persona como RawFrame del léxico (tiempo en ms), limpiados
 * con cleanHands por tramos continuos: cada mano queda en su muñeca y se
 * rellenan huecos cortos sin saltar de una toma a otra.
 */
export function seriesPorPersona(
  fr: FramesVoces,
  personaDe: (c: CuerpoVoces) => string | null,
): Map<string, RawFrame[]> {
  const crudo = new Map<string, RawFrame[]>();
  const hombros = (g: CuerpoVoces) => Math.hypot(g.pose[11][0] - g.pose[12][0], g.pose[11][1] - g.pose[12][1]);
  for (const c of fr.frames) {
    // una persona, un cuerpo por cuadro: a veces la pose ve dos cuerpos en la
    // misma cara (un reflejo, un monitor); se queda el de más manos y más grande
    const porPersona = new Map<string, CuerpoVoces>();
    for (const g of c.gente) {
      const p = personaDe(g);
      if (!p) continue;
      const otro = porPersona.get(p);
      if (!otro || g.hands.length > otro.hands.length || (g.hands.length === otro.hands.length && hombros(g) > hombros(otro)))
        porPersona.set(p, g);
    }
    for (const [p, g] of porPersona) {
      const f: RawFrame = {
        t: c.t,
        hands: g.hands,
        hands_world: g.hands_world,
        hand_src: g.hand_src,
        // la muñeca que ya dio el recorte manda en cleanHands
        hand_side: g.hand_wrist.map((w) => (w === 15 ? "l" : "r")),
        pose: g.pose,
        pose_world: g.pose_world,
        blendshapes: g.blendshapes ?? undefined,
        head: g.head ?? undefined,
      };
      const lista = crudo.get(p) ?? [];
      lista.push(f);
      crudo.set(p, lista);
    }
  }
  const out = new Map<string, RawFrame[]>();
  for (const [p, lista] of crudo) {
    const limpio: RawFrame[] = [];
    let tramo: RawFrame[] = [];
    const cerrar = () => {
      if (tramo.length) limpio.push(...cleanHands(tramo, fr.video.width, fr.video.height).frames);
      tramo = [];
    };
    for (const f of lista) {
      if (tramo.length && f.t - tramo[tramo.length - 1].t > HUECO_MS) cerrar();
      tramo.push(f);
    }
    cerrar();
    out.set(p, limpio);
  }
  return out;
}

// ── Actividad de señado ────────────────────────────────────────

const PALMA = [0, 5, 9, 13, 17];

function palma(h: V3[], W: number, H: number): { x: number; y: number } {
  return { x: (PALMA.reduce((s, i) => s + h[i][0], 0) / 5) * W, y: (PALMA.reduce((s, i) => s + h[i][1], 0) / 5) * H };
}

function anchoHombros(f: RawFrame, W: number, H: number): number {
  const p = f.pose;
  return p ? Math.hypot((p[11][0] - p[12][0]) * W, (p[11][1] - p[12][1]) * H) : 0;
}

export interface Actividad {
  t: number[];
  /** velocidad de las manos levantadas, en anchos de hombro por segundo (suavizada) */
  a: number[];
}

/** Qué tanto mueve las manos la persona en cada cuadro (la mano más rápida de las levantadas) */
export function actividad(serie: RawFrame[], W: number, H: number): Actividad {
  const t = serie.map((f) => f.t);
  const cruda = serie.map((f, i) => {
    const prev = serie[i - 1];
    if (!prev || f.t <= prev.t || f.t - prev.t > HUECO_MS || !f.pose) return 0;
    const sw = anchoHombros(f, W, H);
    if (sw < 5) return 0;
    const cadera = ((f.pose[23][1] + f.pose[24][1]) / 2) * H;
    let v = 0;
    (f.hand_wrist ?? []).forEach((w, k) => {
      const j = (prev.hand_wrist ?? []).indexOf(w);
      if (j < 0) return;
      const a = palma(f.hands[k], W, H);
      if (a.y > cadera) return; // mano en reposo
      const b = palma(prev.hands[j], W, H);
      v = Math.max(v, Math.hypot(a.x - b.x, a.y - b.y) / sw / ((f.t - prev.t) / 1000));
    });
    return v;
  });
  const a = cruda.map((_, i) => {
    const ven = cruda.slice(Math.max(0, i - 2), i + 3);
    return ven.reduce((s, x) => s + x, 0) / ven.length;
  });
  return { t, a };
}

/** Media de actividad en [t0, t1] (s) y qué fracción del tramo tiene a la persona en cuadro */
export function mediaEn(act: Actividad, t0: number, t1: number): { media: number; cobertura: number } {
  let s = 0;
  let n = 0;
  for (let i = 0; i < act.t.length; i++) {
    const ts = act.t[i] / 1000;
    if (ts < t0 || ts > t1) continue;
    s += act.a[i];
    n++;
  }
  const esperados = Math.max(1, (t1 - t0) * 12);
  return { media: n ? s / n : 0, cobertura: Math.min(1, n / esperados) };
}

/** Umbral de actividad para decir que alguien está señando (anchos de hombro / s) */
export const SENA_MIN = 0.45;

/**
 * Desfase entre el subtítulo y el señado (s): el subtítulo va con la voz,
 * y la voz de quien interpreta va detrás (o delante) de las manos. Se
 * busca el corrimiento que más actividad de señado junta dentro de las
 * oraciones.
 */
export function estimarDesfase(oraciones: { t0: number; t1: number }[], acts: Actividad[]): number {
  let mejor = { L: 0, total: -1 };
  let enCero = 0;
  for (let L = -3; L <= 3.001; L += 0.25) {
    let total = 0;
    for (const o of oraciones) {
      total += Math.max(0, ...acts.map((a) => {
        const m = mediaEn(a, o.t0 + L, o.t1 + L);
        return m.media * m.cobertura;
      }));
    }
    if (Math.abs(L) < 1e-6) enCero = total;
    if (total > mejor.total + 1e-9) mejor = { L: Math.round(L * 100) / 100, total };
  }
  // en una plática casi siempre alguien seña y la curva sale casi plana: solo se
  // corre el subtítulo si eso junta claramente más señado que dejarlo donde está
  return mejor.total >= enCero * DESFASE_GANANCIA ? mejor.L : 0;
}

/** Cuánto más señado (×) debe juntar un desfase que el 0 para aplicarlo */
export const DESFASE_GANANCIA = 1.05;

export interface Enunciado {
  t0: number;
  t1: number;
  texto: string;
  persona: string | null;
  /** tramo de señado (s), ya corrido por el desfase */
  sena: { t0: number; t1: number } | null;
}

/**
 * Oraciones → enunciados de una sola persona. Cada tarjeta del subtítulo se
 * asigna a quien más seña en su tramo corrido; si dentro de una oración
 * cambia quien seña, la oración se parte ahí.
 */
export function asignar(
  oraciones: OracionOCR[],
  tarjetas: Tarjeta[],
  acts: Map<string, Actividad>,
  desfase: number,
): Enunciado[] {
  const out: Enunciado[] = [];
  let k = 0;
  for (const o of oraciones) {
    const cs = tarjetas.slice(k, k + o.tarjetas);
    k += o.tarjetas;
    const quien = cs.map((c) => {
      let mejor: { p: string; m: number } | null = null;
      for (const [p, a] of acts) {
        const m = mediaEn(a, c.t0 + desfase, c.t1 + desfase);
        if (m.cobertura >= 0.3 && m.media >= SENA_MIN && (!mejor || m.media > mejor.m)) mejor = { p, m: m.media };
      }
      return mejor?.p ?? null;
    });
    // las tarjetas sin nadie señando se pegan a su vecina
    for (let i = 0; i < quien.length; i++) if (!quien[i]) quien[i] = quien[i - 1] ?? quien.find(Boolean) ?? null;
    let ini = 0;
    for (let i = 1; i <= cs.length; i++) {
      if (i < cs.length && quien[i] === quien[ini]) continue;
      const grupo = cs.slice(ini, i);
      const t0 = grupo[0].t0;
      const t1 = grupo[grupo.length - 1].t1;
      out.push({
        t0,
        t1,
        texto: cs.length === 1 ? o.texto : grupo.map((c) => c.texto).join(" ").replace(/\s+/g, " ").trim(),
        persona: quien[ini],
        sena: quien[ini] ? { t0: Math.max(0, t0 + desfase), t1: t1 + desfase } : null,
      });
      ini = i;
    }
  }
  return out;
}

// ── Segmentación en señas ──────────────────────────────────────

export interface Tramo {
  i0: number;
  i1: number;
}

/**
 * Corta un tramo de señado en señas por las pausas de la mano dominante:
 * mínimos locales de su velocidad por debajo de un umbral relativo. Cada
 * seña dura al menos 160 ms y tiene un pico de movimiento claro.
 * // VALIDAR-LSM: las señas compuestas y los movimientos internos (repeticiones)
 * // pueden partirse; las transiciones rápidas pueden unirse.
 */
export function segmentar(serie: RawFrame[], side: "left" | "right", W: number, H: number): Tramo[] {
  if (serie.length < 3) return [];
  const v = serie.map((f, i) => {
    const prev = serie[i - 1];
    if (!prev) return 0;
    const a = pickHands(f, side).dom;
    const b = pickHands(prev, side).dom;
    if (a === undefined || b === undefined) return 0;
    const sw = anchoHombros(f, W, H) || 1;
    const pa = palma(f.hands[a], W, H);
    const pb = palma(prev.hands[b], W, H);
    return Math.hypot(pa.x - pb.x, pa.y - pb.y) / sw / Math.max(0.04, (f.t - prev.t) / 1000);
  });
  const s = v.map((_, i) => (v[Math.max(0, i - 1)] + v[i] + v[Math.min(v.length - 1, i + 1)]) / 3);
  const orden = [...s].sort((a, b) => a - b);
  const umbral = Math.max(0.25, orden[Math.floor(orden.length * 0.75)] * 0.4);
  const cortes = [0];
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] <= s[i - 1] && s[i] <= s[i + 1] && s[i] < umbral && i - cortes[cortes.length - 1] >= 2) cortes.push(i);
  }
  cortes.push(s.length - 1);
  const out: Tramo[] = [];
  for (let k = 0; k < cortes.length - 1; k++) {
    const i0 = cortes[k];
    const i1 = cortes[k + 1];
    const pico = Math.max(...s.slice(i0, i1 + 1));
    const conMano = serie.slice(i0, i1 + 1).filter((f) => pickHands(f, side).dom !== undefined).length;
    if (serie[i1].t - serie[i0].t >= 160 && pico >= umbral * 1.5 && conMano >= 2) out.push({ i0, i1 });
  }
  return out;
}

// ── Fonología de una seña ──────────────────────────────────────

const toPt = (v: number[]): Pt => ({ x: v[0], y: v[1], z: v[2] ?? 0 });

export interface FonologiaSena {
  cm: { id: number; puntaje: number }[];
  ub: string | null;
  contacto: string | null;
  palma: string | null;
  dedos: string | null;
  contorno: string | null;
  plano: string | null;
  direccion: { x: number; y: number; z: number } | null;
  repeticion: { count: number; type: string } | null;
  dos_manos: boolean;
  relacion: string | null;
  /** cuadros con la dominante solo en 2D (sin profundidad: la CM y la OR son menos fiables) */
  plana: number;
  cuadros: number;
}

/**
 * La fonología de una seña con aggregate() del léxico. La CM y la OR solo
 * con manos que tienen profundidad, como en el léxico.
 */
/** Hasta cuántos anchos de hombro bajo los hombros la otra mano está «arriba» */
export const OTRA_MANO_ALTO = 0.45;
/** A menos de esto (anchos de hombro) de la dominante, la otra mano hace de base */
export const OTRA_MANO_CERCA = 0.3;

/** `aspecto`: ancho / alto del video (los puntos vienen normalizados a cada eje) */
export function fonologia(frames: RawFrame[], side: "left" | "right", aspecto = 16 / 9): FonologiaSena {
  const picks = frames.map((f) => pickHands(f, side));
  const phon: PhonFrame[] = frames.map((f, i) => ({
    timestampMs: f.t,
    hand: picks[i].dom !== undefined ? f.hands[picks[i].dom!].map(toPt) : undefined,
    otherHand: picks[i].other !== undefined ? f.hands[picks[i].other!].map(toPt) : undefined,
    twoHands: f.hands.length >= 2,
    pose: f.pose?.map(toPt),
    face: f.blendshapes,
  }));
  const s = aggregate(phon, side);
  // en tramos cortos el temblor parece zigzag: mismo refinamiento que el léxico
  let contorno: string | null = s.contour ?? null;
  if (contorno === "ZIGZAG") {
    const traj = phon.filter((p) => p.hand).map((p) => ({
      x: p.hand!.reduce((a, q) => a + q.x, 0) / p.hand!.length,
      y: p.hand!.reduce((a, q) => a + q.y, 0) / p.hand!.length,
    }));
    const conPose = phon.filter((p) => p.pose);
    const sw = conPose.length ? Math.abs(conPose[0].pose![11].x - conPose[0].pose![12].x) : 0;
    const z = refineZigzag(traj, sw);
    if (z) contorno = z.contour;
    else if (traj.length < 10) contorno = null;
  }
  // la otra mano cuenta si participa: sube al espacio de señado o sirve de base
  // pegada a la dominante. Sentados, la mano que descansa queda frente al
  // vientre o en el regazo (≥ 0.45 anchos de hombro bajo los hombros); la que
  // seña, más arriba. El recorrido no sirve: el temblor del detector lo infla.
  // (Umbrales vistos a ojo en primeros planos; ver docs/corpus-voces-en-senas.md.)
  let participa = false;
  if (s.nondominant_relation) {
    const nd = phon
      .map((p) => (p.otherHand && p.hand && p.pose ? { h: p.otherHand, d: p.hand, pose: p.pose } : null))
      .filter(Boolean) as { h: Pt[]; d: Pt[]; pose: Pt[] }[];
    if (nd.length >= 2) {
      const centro = (h: Pt[]) => ({ x: h.reduce((a, q) => a + q.x, 0) / h.length, y: h.reduce((a, q) => a + q.y, 0) / h.length });
      const hombros = (pose: Pt[]) => Math.hypot(pose[11].x - pose[12].x, (pose[11].y - pose[12].y) / aspecto);
      const alto =
        nd.filter(({ h, pose }) => (centro(h).y - (pose[11].y + pose[12].y) / 2) / aspecto < OTRA_MANO_ALTO * hombros(pose)).length /
        nd.length;
      const cerca =
        nd.filter(({ h, d, pose }) => {
          const a = centro(h);
          const k = centro(d);
          return Math.hypot(k.x - a.x, (k.y - a.y) / aspecto) < OTRA_MANO_CERCA * hombros(pose);
        }).length / nd.length;
      participa = alto > 0.5 || cerca > 0.5;
    }
  }
  const plana = frames.filter((f, i) => picks[i].dom !== undefined && isFlatHand(f.hand_src?.[picks[i].dom!])).length;
  return {
    cm: s.cmCandidates.slice(0, 3).map((c) => ({ id: c.cm_id, puntaje: Math.round(c.score * 1000) / 1000 })),
    ub: s.location_code ?? null,
    contacto: s.contact ?? null,
    palma: s.palm_facing ?? null,
    dedos: s.finger_pointing ?? null,
    contorno,
    plano: s.plane ?? null,
    direccion: s.direction ?? null,
    repeticion: s.repetition ?? null,
    dos_manos: participa,
    relacion: participa ? (s.nondominant_relation ?? null) : null,
    plana,
    cuadros: frames.length,
  };
}

// ── Transliteración ────────────────────────────────────────────

/** minúsculas, sin acentos ni signos */
export function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Raíz burda para emparejar palabras con glosas («enseñamos» ~ «enseñar») */
export const raiz = (w: string) => normaliza(w).slice(0, Math.max(4, Math.min(6, normaliza(w).length - 2)));

const PALABRAS_VACIAS = new Set(
  ("a al con de del el en es la las lo los me mi no o para pero por que se si su te tu un una y ya yo " +
    "sin mas muy como este esta esto eso esa ese son hay fue era entre sobre hasta desde nos les ni porque pues asi tan sus mis")
    .split(" "),
);

export interface Candidato {
  id: string;
  glosa: string;
  puntaje: number;
  /** la glosa coincide con una palabra de la oración */
  en_oracion: boolean;
}

const PESOS = { cm: 2, ub: 1, dos: 0.5, contorno: 0.5, palma: 0.3, palabra: 1.5 };
const MAX = Object.values(PESOS).reduce((s, x) => s + x, 0);
/** Glosa solo si se parece lo bastante: con la palabra en la oración, o sin ella pero mucho */
export const GLOSA_MIN = 0.5;
export const GLOSA_MIN_SIN_PALABRA = 0.75;

/** La glosa de una seña, o null si ningún candidato convence (queda la descripción) */
export function glosaDe(cands: Candidato[]): string | null {
  const c = cands.find((x) => (x.en_oracion ? x.puntaje >= GLOSA_MIN : x.puntaje >= GLOSA_MIN_SIN_PALABRA));
  return c && c.puntaje >= cands[0].puntaje - 0.08 ? c.glosa : null;
}

/** Tokens seguidos iguales se juntan con «+» (repetición): PROFESOR PROFESOR → PROFESOR+ */
export function juntarRepetidas(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    if (prev && prev.replace(/\+$/, "") === t && !t.startsWith("[")) out[out.length - 1] = t + "+";
    else out.push(t);
  }
  return out;
}

/** Raíces de las palabras con contenido de una oración */
export function raicesDe(texto: string): Set<string> {
  return new Set(
    normaliza(texto)
      .split(" ")
      .filter((w) => w.length > 2 && !PALABRAS_VACIAS.has(w))
      .map(raiz),
  );
}

/**
 * Las señas del léxico más parecidas a esta: forma de la mano (con el
 * puntaje de cada CM candidata), lugar, una o dos manos, contorno y palma;
 * más una ventaja si la glosa o sus sinónimos aparecen en la oración.
 */
export function candidatos(f: FonologiaSena, lexico: LexRef[], raices: Set<string>, n = 3): Candidato[] {
  const cmPuntaje = new Map(f.cm.map((c) => [c.id, c.puntaje]));
  const out = lexico.map((e) => {
    // palabras vacías fuera también de la glosa: «SIN-VERGÜENZA» no es «sin embargo»
    const palabras = [e.gloss, e.spanish, ...e.synonyms]
      .flatMap((w) => normaliza(w).split(" "))
      .filter((w) => w.length > 2 && !PALABRAS_VACIAS.has(w));
    const enOracion = palabras.some((w) => raices.has(raiz(w)));
    const s =
      PESOS.cm * (e.cm !== null ? (cmPuntaje.get(e.cm) ?? 0) : 0) +
      PESOS.ub * (e.ub && f.ub && e.ub === f.ub ? 1 : 0) +
      PESOS.dos * (e.two_handed === f.dos_manos ? 1 : 0) +
      PESOS.contorno * (e.contour && f.contorno && e.contour === f.contorno ? 1 : 0) +
      PESOS.palma * (e.palm && f.palma && e.palm === f.palma ? 1 : 0) +
      PESOS.palabra * (enOracion ? 1 : 0);
    return { id: e.id, glosa: e.gloss, puntaje: Math.round((s / MAX) * 1000) / 1000, en_oracion: enOracion };
  });
  return out.sort((a, b) => b.puntaje - a.puntaje || a.glosa.localeCompare(b.glosa)).slice(0, n);
}

/** Descripción corta de una seña sin glosa: [CM·UB·contorno] */
export function descriptor(f: FonologiaSena): string {
  return `[CM${f.cm[0]?.id ?? "?"}·${f.ub ?? "?"}·${(f.contorno ?? "quieta").toLowerCase()}${f.dos_manos ? "·2M" : ""}]`;
}

/** Lado de la imagen de la mano dominante de una persona (como en el léxico) */
export function ladoDominante(serie: RawFrame[]): "left" | "right" {
  return dominantImageSide(serie);
}
