/**
 * derive.ts — de cuadros de MediaPipe a una entrada LSM-Lex 1.0.
 *
 * Capa pura (sin E/S). Reutiliza el contrato de SignaLab sin copiarlo:
 *  - matrices: `aggregate` (phon_features.ts) + `applySuggestion`, igual
 *    que el botón "Sugerir" de /anotar;
 *  - huesos canónicos: `cmEntryToHandPose` (hand_pose.ts) aplicado con la
 *    misma convención de ejes que AvatarModel.tsx;
 *  - lugares: `UB_BONE_MAP` + `UB_LOCATIONS`.
 * Lo nuevo (lateralidad, cabeza, mano no dominante, ángulos medidos) va
 * marcado `// VALIDAR-LSM` donde hay umbrales.
 */

import type {
  CMEntry,
  EyebrowPosition,
  HeadMovement,
  Laterality,
  MouthShape,
  PSHRSegment,
  SignAnnotation,
} from "@/lib/types";
import { CM_INVENTORY } from "@/lib/data";
import { cmEntryToHandPose, type FingerName } from "@/lib/hand_pose";
import {
  AVATAR_FINGER_BONES,
  AVATAR_RIGHT_THUMB_BONES,
  AVATAR_THUMB_BONES,
  getRightFingerBones,
} from "@/lib/avatar_hand_bones";
import { UB_BONE_MAP } from "@/lib/ub_bone_map";
import { UB_LOCATIONS } from "@/lib/ub_inventory";
import {
  aggregate,
  observeHandShape,
  observeOrientation,
  rankCMs,
  type PhonFrame,
  type PhonSuggestion,
  type Pt,
} from "@/lib/vision/phon/phon_features";
import { applySuggestion } from "@/lib/vision/phon/apply_suggestion";
import {
  LEXICON_SCHEMA,
  type ArmObserved,
  type BoneRotation,
  type EntryKind,
  type FaceSummary,
  type HandCanonical,
  type HandObserved,
  type LexiconEntry,
  type Phonology,
  type UBAnchorRef,
  type Variety,
  type WikisignsSource,
} from "./types";

// ── Entrada: archivo de cuadros de extract.py ───────────────────

export type V3 = [number, number, number];

export interface RawFrame {
  t: number;
  hands: V3[][];
  hands_world: V3[][];
  /** De dónde salió cada mano: "det" (detector), "crop" (recorte guiado
   *  por la pose, extract.py), "rtmw3d" (MediaPipe en un recorte donde
   *  RTMW vio la mano), "rtmw" (puntos 2D de RTMW, z = 0) o "interp" /
   *  "interp2d" (hueco rellenado, cleanHands; 2D si un extremo lo era) */
  hand_src?: string[];
  /** Lado del señante según RTMW ("l" izquierda, "r" derecha; rtmw_hands.py):
   *  manda sobre la muñeca de la pose más cercana */
  hand_side?: ("l" | "r" | null)[];
  /** Muñeca de la pose (15 o 16) de cada mano; lo pone cleanHands */
  hand_wrist?: (15 | 16)[];
  pose?: [number, number, number, number][];
  pose_world?: V3[];
  facemarks?: V3[];
  blendshapes?: Record<string, number>;
  /** pitch, yaw, roll (grados) de la matriz facial */
  head?: V3;
}

export interface FramesFile {
  schema: string;
  error?: string;
  video?: { width: number; height: number; fps: number; frame_count: number; duration_ms: number };
  facemark_groups?: Record<string, number[]>;
  facemark_index?: number[];
  frames?: RawFrame[];
}

export interface SourceVideo {
  title: string | null;
  youtube_id: string;
  file_id: number | null;
  video_title: string | null;
  wikisigns_number: number | null;
  node_id: number | null;
  rating_avg: number | null;
  rating_votes: number | null;
}

export interface SourcePage {
  slug_path: string;
  label: string;
  url: string;
  fetched_at: string;
  videos: SourceVideo[];
}

const ATTRIBUTION =
  "Wikisigns (wikisigns.org) — Lengua de Señas Mexicana, CC BY-SA 4.0. Fonología extraída automáticamente por SignaLab.";

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const DEG = 180 / Math.PI;

const toPt = (v: V3 | number[]): Pt => ({ x: v[0], y: v[1], z: v[2] });

// ── Etiqueta de Wikisigns → glosa, variante, variedad ───────────

const OTHER_LANG: Record<string, string> = {
  ASL: "ASL",
  DGS: "DGS",
  LSE: "LSE",
  LSF: "LSF",
  BSL: "BSL",
  LSC: "LSC",
  LSA: "LSA",
  LIBRAS: "LIBRAS",
};

export function parseLabel(label: string): {
  spanish: string;
  synonyms: string[];
  gloss: string;
  variant: string | null;
  variety: Variety;
  qualifiers: string[];
  kind: EntryKind;
} {
  const clean = label.replace(/\s+/g, " ").trim();
  const quals: string[] = [];
  // paréntesis (algunos vienen sin cerrar: "Alvaro Obregon (Deleg. Méx")
  const base = clean
    .replace(/\(([^)]*)\)?/g, (_, q: string) => {
      quals.push(q.trim());
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  let variant: string | null = null;
  let variety: Variety = { language: "LSM", region: null, is_lsm: true };
  const rest: string[] = [];
  for (const q of quals) {
    const otra = q.match(/variedad distinta de (\S+) utilizad[oa] en (.+)/i);
    const code = q.toUpperCase();
    if (/^[A-Z]$/.test(q)) variant = q;
    else if (code === "LSM") variety = { ...variety, language: "LSM" };
    else if (OTHER_LANG[code]) variety = { language: OTHER_LANG[code], region: null, is_lsm: false };
    else if (otra) {
      const lang = otra[1].toUpperCase();
      const isLsm = lang === "LSM";
      variety = {
        language: isLsm ? "LSM" : OTHER_LANG[lang] ?? lang,
        region: otra[2].trim(),
        is_lsm: isLsm,
      };
    } else if (/se[ñn]as? internacional/i.test(q)) {
      variety = { language: "Señas Internacionales", region: null, is_lsm: false };
    } else if (q) rest.push(q);
  }

  // Wikisigns junta sinónimos con comas: «Abandonar, Dejar». La glosa es
  // la primera; los demás quedan como sinónimos.
  const terms = (base || clean)
    .split(/\s*[,/]\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
  const spanish = terms[0] ?? clean;
  const synonyms = terms.slice(1);
  const gloss =
    spanish
      .replace(/[¿?¡!.,;:"]/g, "")
      .trim()
      .toLocaleUpperCase("es-MX")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") + (variant ? `(${variant})` : "");

  const bare = spanish.replace(/[¿?¡!.]/g, "").trim();
  let kind: EntryKind = "lexical";
  if (/^\d+$/.test(bare)) kind = "number";
  else if (/^([a-zñ]|ch|ll|rr)$/i.test(bare)) kind = "fingerspelling";
  else if (bare.split(/\s+/).length >= 3 || /[¿?¡!]/.test(spanish)) kind = "phrase";

  return { spanish, synonyms, gloss, variant, variety, qualifiers: rest, kind };
}

// ── Mano dominante y ventana de la seña ─────────────────────────

const centroid = (h: Pt[]) => ({
  x: h.reduce((s, p) => s + p.x, 0) / h.length,
  y: h.reduce((s, p) => s + p.y, 0) / h.length,
});

// ── Limpieza de manos contra la pose ────────────────────────────

/** Una mano «es» de una muñeca a menos de esto (anchos de hombro); más
 *  lejos de las dos muñecas es un falso positivo (p. ej. en la cara) */
const HAND_WRIST_MAX = 0.5;
/** Huecos de hasta este número de cuadros (a 12 fps ≈ 170 ms) se rellenan */
const GAP_MAX = 2;

export interface HandCleanStats {
  dropped: number;
  interpolated: number;
  crop: number;
  /** manos que puso RTMW: con forma 3D (recorte) y solo 2D */
  rtmw3d: number;
  rtmw2d: number;
}

/** Manos sin profundidad (solo 2D): sirven para lugar y movimiento, no para la CM ni la OR */
export const isFlatHand = (src?: string) => src === "rtmw" || src === "interp2d";

/**
 * Limpia las manos de cada cuadro con la pose como referencia:
 *  1. asigna cada mano a su muñeca (15 o 16): la del lado que dijo RTMW
 *     (hand_side) o, si no hay, la de la pose más cercana;
 *  2. descarta las que quedan lejos de las dos muñecas y las sobrantes
 *     (a lo más una mano por muñeca);
 *  3. rellena huecos de 1–2 cuadros de una muñeca interpolando entre la
 *     mano de antes y la de después (imagen y mundo), con hand_src
 *     "interp".
 * Los cuadros sin pose se dejan como vienen (máximo dos manos).
 * // VALIDAR-LSM: HAND_WRIST_MAX y GAP_MAX.
 */
export function cleanHands(frames: RawFrame[], W: number, H: number): { frames: RawFrame[]; stats: HandCleanStats } {
  const stats: HandCleanStats = { dropped: 0, interpolated: 0, crop: 0, rtmw3d: 0, rtmw2d: 0 };
  type Slot = { img: V3[]; world: V3[]; src: string } | undefined;
  const slots: Record<15 | 16, Slot[]> = { 15: [], 16: [] };
  const sinPose: (RawFrame | null)[] = [];
  frames.forEach((f, fi) => {
    const src = f.hand_src ?? f.hands.map(() => "det");
    const p = f.pose;
    const sw = p ? Math.abs(p[11][0] - p[12][0]) * W : 0;
    if (!p || sw < 5) {
      sinPose[fi] = f;
      slots[15][fi] = undefined;
      slots[16][fi] = undefined;
      return;
    }
    sinPose[fi] = null;
    const pairs: { h: number; w: 15 | 16; d: number }[] = [];
    f.hands.forEach((hd, h) => {
      const hint = f.hand_side?.[h];
      if (hint) {
        // RTMW ve el brazo entero: su lado gana aunque la muñeca de la pose esté lejos
        pairs.push({ h, w: hint === "l" ? 15 : 16, d: -1 });
        return;
      }
      for (const w of [15, 16] as const) {
        pairs.push({ h, w, d: Math.hypot((hd[0][0] - p[w][0]) * W, (hd[0][1] - p[w][1]) * H) / sw });
      }
    });
    pairs.sort((a, b) => a.d - b.d);
    const usedH = new Set<number>();
    const got: Record<15 | 16, Slot> = { 15: undefined, 16: undefined };
    for (const { h, w, d } of pairs) {
      if (d > HAND_WRIST_MAX || usedH.has(h) || got[w]) continue;
      usedH.add(h);
      got[w] = { img: f.hands[h], world: f.hands_world[h] ?? [], src: src[h] ?? "det" };
    }
    stats.dropped += f.hands.length - usedH.size;
    slots[15][fi] = got[15];
    slots[16][fi] = got[16];
  });

  // huecos cortos: misma muñeca con mano antes y después
  const lerp = (a: V3[], b: V3[], t: number): V3[] =>
    a.length === b.length ? a.map((v, k) => [0, 1, 2].map((j) => v[j] + (b[k][j] - v[j]) * t) as V3) : [];
  for (const w of [15, 16] as const) {
    const s = slots[w];
    let i = 0;
    while (i < frames.length) {
      if (s[i] || i === 0 || !s[i - 1] || sinPose[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < frames.length && !s[j] && !sinPose[j] && j - i < GAP_MAX + 1) j++;
      const a = s[i - 1]!;
      const b = j < frames.length ? s[j] : undefined;
      if (b && j - i <= GAP_MAX) {
        const t0 = frames[i - 1].t;
        const span = frames[j].t - t0 || 1;
        for (let k = i; k < j; k++) {
          const t = (frames[k].t - t0) / span;
          const flat = isFlatHand(a.src) || isFlatHand(b.src);
          s[k] = { img: lerp(a.img, b.img, t), world: lerp(a.world, b.world, t), src: flat ? "interp2d" : "interp" };
          stats.interpolated++;
        }
      }
      i = Math.max(j, i + 1);
    }
  }

  const out = frames.map((f, fi) => {
    if (sinPose[fi]) {
      const keep = f.hands.length > 2 ? 2 : f.hands.length;
      stats.dropped += f.hands.length - keep;
      return { ...f, hands: f.hands.slice(0, keep), hands_world: f.hands_world.slice(0, keep), hand_src: (f.hand_src ?? []).slice(0, keep) };
    }
    const ws = ([15, 16] as const).filter((w) => slots[w][fi]);
    const hs = ws.map((w) => slots[w][fi]!);
    return {
      ...f,
      hands: hs.map((x) => x.img),
      hands_world: hs.map((x) => x.world),
      hand_src: hs.map((x) => x.src),
      hand_side: undefined,
      hand_wrist: [...ws],
    };
  });
  for (const f of out) {
    for (const x of f.hand_src ?? []) {
      if (x === "crop") stats.crop++;
      else if (x === "rtmw3d") stats.rtmw3d++;
      else if (x === "rtmw") stats.rtmw2d++;
    }
  }
  return { frames: out, stats };
}

/** La izquierda es dominante solo si su mano recorre al menos esto × lo de la derecha.
 *  // VALIDAR-LSM: margen para señas simétricas. */
const LEFT_HANDED_MARGIN = 1.5;

/**
 * Lado de la imagen de la mano dominante: la que más camino recorre.
 * Con las manos ya asignadas a sus muñecas (cleanHands) se mide por brazo
 * y se devuelve el lado de la imagen de su hombro; si no, por mitad de la
 * imagen (falla si la persona no está centrada).
 */
export function dominantImageSide(frames: RawFrame[]): "left" | "right" {
  const arm = { 15: 0, 16: 0 };
  const lastW: Record<15 | 16, { x: number; y: number } | null> = { 15: null, 16: null };
  let w15Right = 0;
  let w15Left = 0;
  for (const fr of frames) {
    if (!fr.hand_wrist || !fr.pose) continue;
    if (fr.pose[11][0] > fr.pose[12][0]) w15Right++;
    else w15Left++;
    fr.hands.forEach((hd, k) => {
      const w = fr.hand_wrist![k];
      if (w !== 15 && w !== 16) return;
      const c = centroid(hd.map(toPt));
      const prev = lastW[w];
      if (prev) arm[w] += Math.hypot(c.x - prev.x, c.y - prev.y);
      lastW[w] = c;
    });
  }
  if (arm[15] + arm[16] > 0) {
    // en las simétricas los dos brazos recorren casi lo mismo: queda la derecha (16)
    const domW = arm[15] > LEFT_HANDED_MARGIN * arm[16] ? 15 : 16;
    return (domW === 15) === w15Right >= w15Left ? "right" : "left";
  }
  const path = { left: 0, right: 0 };
  const last: Record<"left" | "right", { x: number; y: number } | null> = { left: null, right: null };
  for (const fr of frames) {
    for (const hd of fr.hands) {
      const c = centroid(hd.map(toPt));
      const side = c.x < 0.5 ? "left" : "right";
      const prev = last[side];
      if (prev) path[side] += Math.hypot(c.x - prev.x, c.y - prev.y);
      last[side] = c;
    }
  }
  return path.right >= path.left ? "right" : "left";
}

/**
 * Índice de la mano dominante (y de la otra) en un cuadro, como el
 * analizador. Con dos manos ya asignadas a sus muñecas (cleanHands), la
 * dominante es la del brazo cuyo hombro está del lado `side` de la imagen:
 * los hombros no se cruzan aunque las manos sí.
 */
export function pickHands(fr: RawFrame, side: "left" | "right"): { dom?: number; other?: number } {
  if (fr.hands.length === 0) return {};
  const hw = fr.hand_wrist;
  const p = fr.pose;
  // muñeca 15 = brazo del hombro 11
  const domWrist = p ? ((side === "right") === p[11][0] > p[12][0] ? 15 : 16) : undefined;
  if (fr.hands.length === 1) {
    // una mano sola del brazo base no es la dominante (p. ej. la que puso RTMW)
    return hw?.length === 1 && domWrist !== undefined && hw[0] !== domWrist ? { other: 0 } : { dom: 0 };
  }
  if (fr.hands.length === 2 && hw?.length === 2 && hw[0] !== hw[1] && domWrist !== undefined) {
    const dom = hw[0] === domWrist ? 0 : 1;
    return { dom, other: 1 - dom };
  }
  let best = 0;
  for (let i = 1; i < fr.hands.length; i++) {
    const cx = centroid(fr.hands[i].map(toPt)).x;
    const bx = centroid(fr.hands[best].map(toPt)).x;
    if (side === "right" ? cx > bx : cx < bx) best = i;
  }
  return { dom: best, other: best === 0 ? 1 : 0 };
}

/**
 * Ventana de la seña: del primer al último cuadro con una mano cuyo
 * centroide está por encima del 85 % de la altura (en Wikisigns las
 * manos reposan fuera de cuadro antes y después).
 * // VALIDAR-LSM: umbral de reposo.
 */
export function signingWindow(frames: RawFrame[], side: "left" | "right" = dominantImageSide(frames)): [number, number] | null {
  // mano entera en cuadro (no recortada por el borde inferior)
  const active = frames.map((f) =>
    f.hands.some((h) => centroid(h.map(toPt)).y < 0.85 && Math.max(...h.map((p) => p[1])) < 0.98),
  );
  let first = active.indexOf(true);
  let last = active.lastIndexOf(true);
  if (first < 0) return null;

  // Recorta la subida desde el reposo y la bajada final: cuadros iniciales
  // (o finales) con la mano dominante muy por debajo de su posición en el
  // núcleo. // VALIDAR-LSM: 0.6 anchos de hombro.
  const domY = (i: number): number | null => {
    const { dom } = pickHands(frames[i], side);
    return dom === undefined ? null : centroid(frames[i].hands[dom].map(toPt)).y;
  };
  const idx = [];
  for (let i = first; i <= last; i++) if (domY(i) !== null) idx.push(i);
  if (idx.length >= 6) {
    const third = Math.floor(idx.length / 3);
    const coreY = median(idx.slice(third, idx.length - third).map((i) => domY(i)!));
    const sws = frames
      .slice(first, last + 1)
      .filter((f) => f.pose)
      .map((f) => Math.abs(f.pose![11][0] - f.pose![12][0]));
    const sw = median(sws);
    const low = (i: number) => {
      const y = domY(i);
      return y === null || y > coreY + 0.6 * sw;
    };
    while (last - first >= 3 && low(first)) first++;
    while (last - first >= 3 && low(last)) last--;
  }
  return [first, last];
}

/** Promedio con los vecinos inmediatos (solo cuadros contiguos con la mano). */
/** smooth() para arreglos [x, y, z] (pistas) */
function smoothV3(seq: (V3[] | undefined)[]): (V3[] | undefined)[] {
  return smooth(seq.map((h) => h?.map(toPt))).map((h) => h?.map((p) => [p.x, p.y, p.z] as V3));
}

function smooth(seq: (Pt[] | undefined)[]): (Pt[] | undefined)[] {
  return seq.map((h, i) => {
    if (!h) return h;
    const ns = [seq[i - 1], h, seq[i + 1]].filter((x): x is Pt[] => Boolean(x));
    return h.map((_, k) => ({
      x: ns.reduce((s, n) => s + n[k].x, 0) / ns.length,
      y: ns.reduce((s, n) => s + n[k].y, 0) / ns.length,
      z: ns.reduce((s, n) => s + n[k].z, 0) / ns.length,
    }));
  });
}

// ── Ida y vuelta no es zigzag ───────────────────────────────────

/**
 * `classifyTrajectory` cuenta como zigzag cualquier serie de giros de
 * signo alterno, y un movimiento repetido de ida y vuelta (giros de
 * ~180°) cae ahí. Si la mano no avanza (desplazamiento < 50 % del camino),
 * se parte en trazos por las reversiones y el contorno es el de cada
 * trazo (recto o arco), con repetición.
 * // VALIDAR-LSM: 120° para reversión, 0.75 de rectitud por trazo.
 */
export function refineZigzag(
  pts: { x: number; y: number }[],
  sw: number,
): { contour: "STRAIGHT" | "ARC"; strokes: number } | null {
  if (pts.length < 4 || !sw) return null;
  const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  let path = 0;
  for (let i = 1; i < pts.length; i++) path += dist2(pts[i], pts[i - 1]);
  if (path < 1e-6 || dist2(pts[0], pts[pts.length - 1]) / path >= 0.5) return null;
  // puntos sin el temblor (pasos < 3 % del ancho de hombros)
  const kept = [pts[0]];
  for (const p of pts.slice(1)) if (dist2(p, kept[kept.length - 1]) >= 0.03 * sw) kept.push(p);
  if (kept.length < 3) return null;
  const strokes: { x: number; y: number }[][] = [[kept[0], kept[1]]];
  for (let i = 2; i < kept.length; i++) {
    const cur = strokes[strokes.length - 1];
    const a = { x: cur[cur.length - 1].x - cur[0].x, y: cur[cur.length - 1].y - cur[0].y };
    const b = { x: kept[i].x - kept[i - 1].x, y: kept[i].y - kept[i - 1].y };
    const cos = (a.x * b.x + a.y * b.y) / ((Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)) || 1);
    if (cos < Math.cos((120 * Math.PI) / 180)) strokes.push([kept[i - 1], kept[i]]);
    else cur.push(kept[i]);
  }
  if (strokes.length < 2) return null;
  const straight = strokes.map((st) => {
    let l = 0;
    for (let i = 1; i < st.length; i++) l += dist2(st[i], st[i - 1]);
    return l > 0 ? dist2(st[0], st[st.length - 1]) / l : 1;
  });
  const mean = straight.reduce((x, y) => x + y, 0) / straight.length;
  return { contour: mean >= 0.75 ? "STRAIGHT" : "ARC", strokes: strokes.length };
}

// ── Desempate de CM por el pulgar ───────────────────────────────

const LEVEL_ORD = { EXTENDED: 0, CURVED: 1, BENT: 2, CLOSED: 3 } as const;

/**
 * Pulgar observado (landmarks 3D): nivel de flexión por MCP+IP (umbrales
 * a medio camino de ANGULOS_PULGAR en hand_pose.ts) y oposición por la
 * punta: cruza hacia el meñique o sale del plano de la palma → OPPOSED.
 * // VALIDAR-LSM: umbrales.
 */
export function observeThumb(h: Pt[]): { flexion: keyof typeof LEVEL_ORD; opposed: boolean } {
  const j = handJoints(h);
  const curl = j.thumb.mcp + j.thumb.ip;
  const flexion = curl < 25 ? "EXTENDED" : curl < 70 ? "CURVED" : curl < 107 ? "BENT" : "CLOSED";
  const axis = sub(h[17], h[5]);
  const aw = len(axis) || 1e-6;
  const tip = sub(h[4], h[5]);
  const across = dot(tip, axis) / (aw * aw);
  const n = unit(cross(sub(h[5], h[0]), sub(h[17], h[0])));
  const front = Math.abs(dot(tip, n)) / aw;
  return { flexion, opposed: across > 0.35 || front > 0.35 };
}

/**
 * Entre CMs empatadas por los dedos, gana la que mejor explica el pulgar;
 * luego la más frecuente (frequency_tier). Devuelve el orden final y si
 * sigue habiendo empate.
 */
export function breakCmTie(
  candidates: { cm_id: number; score: number }[],
  thumbs: ReturnType<typeof observeThumb>[],
): { ranked: { cm_id: number; score: number }[]; stillTied: boolean } {
  if (candidates.length < 2 || thumbs.length === 0) return { ranked: candidates, stillTied: candidates.length > 1 };
  const top = candidates[0].score;
  const tied = candidates.filter((c) => c.score >= top - 0.005);
  const rest = candidates.filter((c) => c.score < top - 0.005);
  const levels = thumbs.map((t) => LEVEL_ORD[t.flexion]);
  const obsLevel = median(levels);
  const obsOpp = thumbs.filter((t) => t.opposed).length / thumbs.length >= 0.5;
  const cost = (id: number) => {
    const cm = CM_INVENTORY.find((c) => c.cm_id === id)!;
    const opp = cm.thumb_opposition === "PARALLEL" ? false : true;
    return Math.abs(LEVEL_ORD[cm.thumb_flexion] - obsLevel) + (opp === obsOpp ? 0 : 1);
  };
  const tier = (id: number) => CM_INVENTORY.find((c) => c.cm_id === id)?.frequency_tier ?? 4;
  const ranked = [...tied].sort((a, b) => cost(a.cm_id) - cost(b.cm_id) || tier(a.cm_id) - tier(b.cm_id) || a.cm_id - b.cm_id);
  const stillTied =
    ranked.length > 1 && cost(ranked[0].cm_id) === cost(ranked[1].cm_id) && tier(ranked[0].cm_id) === tier(ranked[1].cm_id);
  return { ranked: [...ranked, ...rest], stillTied };
}

// ── Rasgos nuevos (no están en el analizador del navegador) ─────

// ── Ubicación fina con la malla de la cara ──────────────────────

type XY = { x: number; y: number };

/**
 * Anclas UB en píxeles para un cuadro: la cara sale de los facemarks
 * (lado ipsi/contra correcto, sien, oreja, mejilla, ojo, cejas, nariz,
 * labios, mentón) y el cuerpo de la pose, como en buildAnchors (hombro
 * contra, brazo base solo si su mano está en cuadro).
 * // VALIDAR-LSM: posición de sien y oreja extrapoladas desde los ojos.
 */
export function fineAnchors(
  f: RawFrame,
  fmIndex: number[],
  W: number,
  H: number,
  dominant: "RIGHT" | "LEFT",
  baseVisible: boolean,
): { code: string; pt: XY }[] | null {
  if (!f.facemarks || !f.pose) return null;
  const fm = (i: number): XY | null => {
    const k = fmIndex.indexOf(i);
    return k < 0 ? null : { x: f.facemarks![k][0] * W, y: f.facemarks![k][1] * H };
  };
  const ps = (i: number): XY => ({ x: f.pose![i][0] * W, y: f.pose![i][1] * H });
  const meanOf = (ids: number[]): XY | null => {
    const pts = ids.map(fm).filter((p): p is XY => Boolean(p));
    return pts.length ? { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length } : null;
  };
  const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  // MediaPipe: 33/133/50/205/234/61 son del lado derecho de la persona
  const R = { out: 33, inn: 133, brow: [70, 63, 105, 66, 107], eye: [33, 160, 158, 133, 153, 144], po: 50, ge: 205, jaw: 234, lip: 61 };
  const L = { out: 263, inn: 362, brow: [300, 293, 334, 296, 336], eye: [263, 387, 385, 362, 380, 373], po: 280, ge: 425, jaw: 454, lip: 291 };
  const [ip, ct] = dominant === "RIGHT" ? [R, L] : [L, R];
  const bridge = fm(168);
  const top = fm(10);
  const ipOut = fm(ip.out);
  const ipIn = fm(ip.inn);
  const ctOut = fm(ct.out);
  if (!bridge || !top || !ipOut || !ipIn || !ctOut) return null;
  const iod = Math.hypot(ipOut.x - ctOut.x, ipOut.y - ctOut.y) || 1;
  const outward = { x: (ipOut.x - ipIn.x) / (Math.hypot(ipOut.x - ipIn.x, ipOut.y - ipIn.y) || 1), y: 0 };
  const up = { x: (top.x - bridge.x) / (Math.hypot(top.x - bridge.x, top.y - bridge.y) || 1), y: (top.y - bridge.y) / (Math.hypot(top.x - bridge.x, top.y - bridge.y) || 1) };
  const add = (a: XY, d: XY, k: number): XY => ({ x: a.x + d.x * k, y: a.y + d.y * k });
  const jaw = fm(ip.jaw);
  const face: [string, XY | null][] = [
    ["Ca", add(top, up, 0.6 * iod)],
    ["Fr", lerpXY(bridge, top, 0.6)],
    ["Ci", meanOf(ip.brow)],
    ["Su", meanOf(ct.brow)],
    ["Cin", bridge],
    ["Oc", meanOf(ip.eye)],
    ["RapOc", ipOut],
    ["Te", add(add(ipOut, outward, 0.5 * iod), up, 0.25 * iod)],
    // 234/454: borde de la cara a la altura del trago
    ["Au", jaw ? add(jaw, outward, 0.2 * iod) : null],
    ["Sep", fm(6)],
    ["Na", fm(1)],
    ["Po", fm(ip.po)],
    ["Ge", fm(ip.ge)],
    ["Lab", fm(0)],
    ["Os", meanOf([13, 14])],
    ["La", fm(17)],
    ["IpsiOs", fm(ip.lip)],
    ["Me", fm(152)],
  ];
  // cuerpo (pose): mismo criterio que buildAnchors
  const shMid = lerpXY(ps(11), ps(12), 0.5);
  const hipMid = lerpXY(ps(23), ps(24), 0.5);
  const mouth = meanOf([13, 14]) ?? lerpXY(ps(9), ps(10), 0.5);
  const [ipsiSh, contraSh] = dominant === "RIGHT" ? [12, 11] : [11, 12];
  const [baseElbow, baseWrist] = dominant === "RIGHT" ? [13, 15] : [14, 16];
  const pe = lerpXY(shMid, hipMid, 0.3);
  const body: [string, XY | null][] = [
    ["Co", lerpXY(shMid, mouth, 0.45)],
    ["Um", ps(contraSh)],
    ["Pe", pe],
    ["IpsiPe", lerpXY(pe, lerpXY(ps(ipsiSh), ps(dominant === "RIGHT" ? 24 : 23), 0.3), 0.5)],
    ["XPe", lerpXY(pe, lerpXY(ps(contraSh), ps(dominant === "RIGHT" ? 23 : 24), 0.3), 0.5)],
    ["Ve", lerpXY(shMid, hipMid, 0.7)],
  ];
  if (baseVisible) {
    body.push(["Cut", ps(baseElbow)], ["Abr", lerpXY(ps(baseElbow), ps(baseWrist), 0.5)], ["Car", ps(baseWrist)]);
  }
  return [...face, ...body].filter((a): a is [string, XY] => Boolean(a[1])).map(([code, pt]) => ({ code, pt }));
}

/** Contorno de la cara (mandíbula + frente), en píxeles, o null si faltan puntos */
export function faceOutline(f: RawFrame, fmIndex: number[], W: number, H: number): XY[] | null {
  if (!f.facemarks) return null;
  const ring = [234, 172, 136, 150, 152, 379, 365, 397, 454, 338, 10, 109];
  const pts: XY[] = [];
  for (const i of ring) {
    const k = fmIndex.indexOf(i);
    if (k < 0) return null;
    pts.push({ x: f.facemarks[k][0] * W, y: f.facemarks[k][1] * H });
  }
  return pts;
}

function insidePolygon(p: XY, poly: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Anclas por fuera del contorno de la cara (a los lados y arriba) */
const OUTSIDE_FACE = new Set(["Au", "Te", "Ca"]);
/** Anclas sobre la cara (el mentón queda justo en el contorno) */
const ON_FACE = new Set(["Fr", "Ci", "Su", "Cin", "Oc", "RapOc", "Sep", "Na", "Po", "Ge", "Lab", "Os", "La", "IpsiOs", "Me"]);
/**
 * Las anclas del borde cuentan como «cerca» a 4/5 de la distancia de las
 * demás: una mano que llega de lado pasa junto a la oreja, y en 2D no se
 * ve si va por delante.
 */
const OUTSIDE_FACE_WEIGHT = 1.25;

/**
 * UB fina en un tramo de cuadros: el ancla más cercana a cualquier punto
 * de contacto de la mano (centroide, yemas de pulgar, índice, medio y
 * meñique), moda entre cuadros y contacto por la mediana de distancia.
 * A más de 0.30 anchos de hombro de cualquier ancla, la mano está en el
 * espacio neutro (EN).
 *
 * Mano sobre la cara: si alguna yema cae dentro del contorno de la cara,
 * solo cuentan esas yemas y las anclas de adentro (boca, mejilla, ojo,
 * frente…), no la oreja ni la sien, que están en el borde. Oreja y sien
 * se separan por altura: arriba de la línea de los ojos es sien.
 * // VALIDAR-LSM: umbrales de contacto (0.10 / 0.30 anchos de hombro) y
 * el peso de las anclas del borde.
 */
export function fineLocation(
  frames: RawFrame[],
  hands: (Pt[] | undefined)[],
  others: (Pt[] | undefined)[],
  fmIndex: number[],
  W: number,
  H: number,
  dominant: "RIGHT" | "LEFT",
): { code: string; contact: "TOUCHING" | "NEAR" | "DISTANT" } | null {
  const obs: { code: string; d: number }[] = [];
  frames.forEach((f, i) => {
    const h = hands[i];
    if (!h || !f.pose) return;
    const anchors = fineAnchors(f, fmIndex, W, H, dominant, Boolean(others[i]));
    if (!anchors) return;
    const sw = Math.abs(f.pose[11][0] - f.pose[12][0]) * W;
    if (sw < 1) return;
    const c = centroid(h);
    const tips = [4, 8, 12, 20].map((k) => ({ x: h[k].x * W, y: h[k].y * H }));
    let pts = [{ x: c.x * W, y: c.y * H }, ...tips];
    let cands = anchors;
    const oval = faceOutline(f, fmIndex, W, H);
    const onFace = oval ? tips.filter((p) => insidePolygon(p, oval)) : [];
    if (onFace.length) {
      pts = onFace;
      cands = anchors.filter((a) => ON_FACE.has(a.code));
    }
    // oreja o sien según la altura de las yemas (su mediana, para que el
    // pulgar suelto no decida): arriba de los ojos es sien, entre ojos y
    // boca es oreja, más abajo ninguna de las dos
    const eyeY = anchors.find((a) => a.code === "RapOc")?.pt.y;
    const mouthY = anchors.find((a) => a.code === "IpsiOs")?.pt.y;
    const ys = tips.map((p) => p.y).sort((a, b) => a - b);
    const tipY = (ys[1] + ys[2]) / 2;
    const lateral = (code: string): string | null => {
      if ((code !== "Au" && code !== "Te") || eyeY === undefined || mouthY === undefined) return code;
      return tipY < eyeY ? "Te" : tipY <= mouthY ? "Au" : null;
    };
    let best = { code: "", d: Infinity, score: Infinity };
    for (const a of cands) {
      for (const p of pts) {
        const code = lateral(a.code);
        if (!code) continue;
        const d = Math.hypot(p.x - a.pt.x, p.y - a.pt.y) / sw;
        const score = OUTSIDE_FACE.has(a.code) ? d * OUTSIDE_FACE_WEIGHT : d;
        if (score < best.score) best = { code, d, score };
      }
    }
    if (!best.code) return;
    // lejos de todo: espacio neutro (código EN de ub_anatomia.ts)
    obs.push(best.score >= 0.3 ? { code: "EN", d: best.d } : { code: best.code, d: best.d });
  });
  if (obs.length < 2) return null;
  const counts = new Map<string, number>();
  for (const o of obs) counts.set(o.code, (counts.get(o.code) ?? 0) + 1);
  const code = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const d = median(obs.filter((o) => o.code === code).map((o) => o.d));
  return { code, contact: d < 0.1 ? "TOUCHING" : d < 0.3 ? "NEAR" : "DISTANT" };
}

/** Lateralidad en el núcleo: centroide vs línea media de los hombros. // VALIDAR-LSM */
export function observeLaterality(
  frames: RawFrame[],
  side: "left" | "right",
): Laterality | undefined {
  const xs: number[] = [];
  for (const fr of frames) {
    const { dom } = pickHands(fr, side);
    if (dom === undefined || !fr.pose) continue;
    const ls = fr.pose[11];
    const rs = fr.pose[12];
    const sw = Math.abs(ls[0] - rs[0]);
    if (sw < 1e-3) continue;
    const cx = centroid(fr.hands[dom].map(toPt)).x;
    // marco señante: +x = derecha de la persona = izquierda de la imagen
    xs.push(-(cx - (ls[0] + rs[0]) / 2) / sw);
  }
  if (xs.length === 0) return undefined;
  xs.sort((a, b) => a - b);
  const m = xs[Math.floor(xs.length / 2)];
  const ipsiSign = side === "left" ? 1 : -1; // mano derecha de la persona ⇒ ipsi = +x
  if (Math.abs(m) < 0.15) return "MIDLINE";
  return Math.sign(m) === ipsiSign ? "IPSILATERAL" : "CONTRALATERAL";
}

function reversals(sig: number[], minSwing: number): number {
  let rev = 0;
  let dir = 0;
  let swing = 0;
  for (let i = 1; i < sig.length; i++) {
    const d = sig[i] - sig[i - 1];
    const s = Math.sign(d);
    if (s === 0) continue;
    if (dir === 0) dir = s;
    else if (s !== dir) {
      if (swing > minSwing) rev++;
      dir = s;
      swing = 0;
    }
    swing += Math.abs(d);
  }
  return rev;
}

const median = (v: number[]) => {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const range = (v: number[]) => (v.length ? Math.max(...v) - Math.min(...v) : 0);

/**
 * Movimiento de cabeza. Oscilación (asentir/negar) con la matriz facial;
 * inclinación sostenida con los facemarks (línea de ojos para el roll,
 * nariz entre ojos y barbilla para el pitch), respecto al reposo.
 * // VALIDAR-LSM: umbrales (6° de vaivén, 8° de roll, 0.06 de pitch).
 */
export function observeHead(
  frames: RawFrame[],
  win: [number, number],
  fmIndex: number[],
  width: number,
  height: number,
): { head: HeadMovement; range: { pitch: number; yaw: number; roll: number } | null } {
  const inWin = frames.slice(win[0], win[1] + 1).filter((f) => f.head);
  if (inWin.length < 4) return { head: "NONE", range: null };
  const pitch = inWin.map((f) => f.head![0]);
  const yaw = inWin.map((f) => f.head![1]);
  const roll = inWin.map((f) => f.head![2]);
  const rng = { pitch: r1(range(pitch)), yaw: r1(range(yaw)), roll: r1(range(roll)) };

  const yawRev = reversals(yaw, 8);
  const pitchRev = reversals(pitch, 8);
  if (yawRev >= 2 && rng.yaw >= 12 && rng.yaw >= rng.pitch * 1.2) return { head: "SHAKE", range: rng };
  if (pitchRev >= 2 && rng.pitch >= 12 && rng.pitch >= rng.yaw * 1.2) return { head: "NOD", range: rng };

  const at = (i: number) => fmIndex.indexOf(i);
  const [eR, eL, nose, chin] = [at(33), at(263), at(1), at(152)];
  if (eR < 0 || eL < 0 || nose < 0 || chin < 0) return { head: "NONE", range: rng };
  const geo = (f: RawFrame) => {
    const m = f.facemarks!;
    const dx = (m[eL][0] - m[eR][0]) * width;
    const dy = (m[eL][1] - m[eR][1]) * height;
    const eyeY = (m[eL][1] + m[eR][1]) / 2;
    return {
      roll: Math.atan2(dy, dx) * DEG,
      pitch: (m[nose][1] - eyeY) / Math.max(1e-4, m[chin][1] - eyeY),
    };
  };
  const rest = frames.filter((f, i) => f.facemarks && (i < win[0] || i > win[1]));
  const core = frames.slice(win[0], win[1] + 1).filter((f) => f.facemarks);
  if (core.length < 3) return { head: "NONE", range: rng };
  const base = rest.length >= 2 ? rest : core.slice(0, 2);
  const dRoll = median(core.map((f) => geo(f).roll)) - median(base.map((f) => geo(f).roll));
  const dPitch = median(core.map((f) => geo(f).pitch)) - median(base.map((f) => geo(f).pitch));
  // La matriz facial tiene que confirmar el giro (los facemarks se
  // desvían cuando la mano tapa la cara).
  const mBase = base.filter((f) => f.head);
  const mCore = core.filter((f) => f.head);
  const mShift = (k: 0 | 2) =>
    mBase.length && mCore.length
      ? Math.abs(median(mCore.map((f) => f.head![k])) - median(mBase.map((f) => f.head![k])))
      : 0;
  // ojo derecho de la persona = izquierda de la imagen: si baja, roll < 0
  if (Math.abs(dRoll) > 8 && mShift(2) > 6 && Math.abs(dRoll) / 8 >= Math.abs(dPitch) / 0.06) {
    return { head: dRoll < 0 ? "TILT_RIGHT" : "TILT_LEFT", range: rng };
  }
  if (Math.abs(dPitch) > 0.06 && mShift(0) > 8) {
    return { head: dPitch > 0 ? "TILT_DOWN" : "TILT_BACK", range: rng };
  }
  return { head: "NONE", range: rng };
}

// ── Esqueleto canónico (rig Lexsi / Mixamo) ─────────────────────

const FINGERS: FingerName[] = ["index", "middle", "ring", "pinky"];
const deg3 = (x: number, y: number, z: number): [number, number, number] => [r1(x * DEG), r1(y * DEG), r1(z * DEG)];

/**
 * Rotaciones por hueso para una CM, exactamente como las aplica
 * AvatarModel: falange proximal = MCP + separación (Z), media = PIP,
 * distal = DIP; pulgar con X/Y invertidos y espejo en Y/Z.
 * Convención Lexsi: el avatar es espejo de quien aprende, así que la
 * mano dominante usa los huesos Left* y la otra los Right*.
 */
export function canonicalHand(cm: CMEntry, side: "dominant" | "nondominant"): HandCanonical {
  const pose = cmEntryToHandPose(cm);
  const left = side === "dominant";
  const fingerBones = left ? AVATAR_FINGER_BONES : getRightFingerBones();
  const thumbBones = left ? AVATAR_THUMB_BONES : AVATAR_RIGHT_THUMB_BONES;
  const espejo = left ? 1 : -1;
  const bones: BoneRotation[] = [];
  for (const f of FINGERS) {
    const p = pose[f];
    const chain = fingerBones[f];
    bones.push({ bone: chain.carpal, joint: `${f}.MCP`, euler_xyz_deg: deg3(p.mcpFlex, 0, -p.carpalSpread * espejo) });
    bones.push({ bone: chain.bones[0], joint: `${f}.PIP`, euler_xyz_deg: deg3(p.pipFlex, 0, 0) });
    bones.push({ bone: chain.bones[1], joint: `${f}.DIP`, euler_xyz_deg: deg3(p.dipFlex, 0, 0) });
  }
  const t = pose.thumb;
  bones.push({ bone: thumbBones[0], joint: "thumb.CMC", euler_xyz_deg: deg3(-t.cmcOpposition, -t.cmcRotation * espejo, 0) });
  bones.push({ bone: thumbBones[1], joint: "thumb.MCP", euler_xyz_deg: deg3(t.mcpFlex, 0, 0) });
  bones.push({ bone: thumbBones[2], joint: "thumb.IP", euler_xyz_deg: deg3(t.ipFlex, 0, 0) });
  return { cm_id: cm.cm_id, side, bones };
}

export function ubAnchor(code: string): UBAnchorRef {
  const loc = UB_LOCATIONS.find((l) => l.code === code);
  const a = UB_BONE_MAP[code];
  const en = code === "EN";
  return {
    code,
    name: loc?.name ?? (en ? "Espacio neutro" : null),
    region: loc?.region ?? (en ? "NEUTRAL_SPACE" : null),
    bone: a?.boneName ?? null,
    offset_m: a ? a.offset : null,
  };
}

// ── Ángulos observados ──────────────────────────────────────────

type P = { x: number; y: number; z: number };
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: P, b: P) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: P) => Math.hypot(a.x, a.y, a.z);
const cross = (a: P, b: P): P => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a: P): P => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const ang = (a: P, b: P) => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / ((len(a) * len(b)) || 1)))) * DEG;
const midP = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

const F_IDX: Record<FingerName, [number, number, number, number]> = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

/** Flexión por articulación de una mano (landmarks 3D en metros). */
export function handJoints(h: P[]) {
  const w = h[0];
  const out = {} as Record<FingerName, { mcp: number; pip: number; dip: number }>;
  for (const f of FINGERS) {
    const [m, p, d, t] = F_IDX[f].map((i) => h[i]);
    out[f] = { mcp: ang(sub(m, w), sub(p, m)), pip: ang(sub(p, m), sub(d, p)), dip: ang(sub(d, p), sub(t, d)) };
  }
  const thumb = {
    cmc: ang(sub(h[1], w), sub(h[2], h[1])),
    mcp: ang(sub(h[2], h[1]), sub(h[3], h[2])),
    ip: ang(sub(h[3], h[2]), sub(h[4], h[3])),
  };
  const prox = (f: FingerName) => sub(h[F_IDX[f][1]], h[F_IDX[f][0]]);
  const abduction = {
    index_middle: ang(prox("index"), prox("middle")),
    middle_ring: ang(prox("middle"), prox("ring")),
    ring_pinky: ang(prox("ring"), prox("pinky")),
  };
  return { ...out, thumb, abduction };
}

function medianHand(samples: ReturnType<typeof handJoints>[]): HandObserved | null {
  if (samples.length === 0) return null;
  const m = (get: (s: ReturnType<typeof handJoints>) => number) => r1(median(samples.map(get)));
  const finger = (f: FingerName) => ({ mcp: m((s) => s[f].mcp), pip: m((s) => s[f].pip), dip: m((s) => s[f].dip) });
  return {
    index: finger("index"),
    middle: finger("middle"),
    ring: finger("ring"),
    pinky: finger("pinky"),
    thumb: { cmc: m((s) => s.thumb.cmc), mcp: m((s) => s.thumb.mcp), ip: m((s) => s.thumb.ip) },
    abduction: {
      index_middle: m((s) => s.abduction.index_middle),
      middle_ring: m((s) => s.abduction.middle_ring),
      ring_pinky: m((s) => s.abduction.ring_pinky),
    },
    frames: samples.length,
  };
}

/**
 * Ángulos anatómicos del brazo desde pose_world (ejes de imagen, m).
 * Marco del tronco: L = hacia la derecha de la persona, U = arriba,
 * F = U × L = al frente (hacia la cámara).
 */
export function armAngles(pw: P[], vis: number[], signerSide: "RIGHT" | "LEFT"): Omit<ArmObserved, "frames"> | null {
  const [sh, el, wr, pk, ix] = signerSide === "RIGHT" ? [12, 14, 16, 18, 20] : [11, 13, 15, 17, 19];
  if ([sh, el, wr].some((i) => (vis[i] ?? 0) < 0.5)) return null;
  const L = unit(sub(pw[12], pw[11]));
  const upRaw = sub(midP(pw[11], pw[12]), midP(pw[23], pw[24]));
  const U = unit(sub(upRaw, { x: L.x * dot(upRaw, L), y: L.y * dot(upRaw, L), z: L.z * dot(upRaw, L) }));
  const F = cross(U, L);
  const out = signerSide === "RIGHT" ? L : { x: -L.x, y: -L.y, z: -L.z };
  const a = sub(pw[el], pw[sh]);
  const f = sub(pw[wr], pw[el]);
  const hand = sub(midP(pw[pk], pw[ix]), pw[wr]);
  return {
    shoulderFlex: r1(Math.atan2(dot(a, F), -dot(a, U)) * DEG),
    shoulderAbd: r1(Math.atan2(dot(a, out), -dot(a, U)) * DEG),
    elbowFlex: r1(ang(a, f)),
    wristBend: r1(ang(f, hand)),
  };
}

function medianArm(samples: Omit<ArmObserved, "frames">[]): ArmObserved | null {
  if (samples.length === 0) return null;
  const m = (k: keyof Omit<ArmObserved, "frames">) => r1(median(samples.map((s) => s[k])));
  return {
    shoulderFlex: m("shoulderFlex"),
    shoulderAbd: m("shoulderAbd"),
    elbowFlex: m("elbowFlex"),
    wristBend: m("wristBend"),
    frames: samples.length,
  };
}

// ── Cara ────────────────────────────────────────────────────────

/**
 * Pesos ARKit para la RNM categórica. Cejas tomadas de nmm_map.json
 * (SignaPlay-PreK: cejas-pregunta, ceño-fruncido); boca, propuesta.
 * // VALIDAR-LSM: no validado por una persona Sorda.
 */
export const RNM_BLENDSHAPES: {
  eyebrows: Record<EyebrowPosition, Record<string, number>>;
  mouth: Record<MouthShape, Record<string, number>>;
} = {
  eyebrows: {
    NEUTRAL: {},
    RAISED: { browInnerUp: 0.85, browOuterUpLeft: 0.7, browOuterUpRight: 0.7 },
    FURROWED: { browDownLeft: 1.0, browDownRight: 1.0, noseSneerLeft: 0.3, noseSneerRight: 0.3 },
  },
  mouth: {
    NEUTRAL: {},
    OPEN: { jawOpen: 0.5 },
    CLOSED: { mouthClose: 0.4, mouthPressLeft: 0.4, mouthPressRight: 0.4 },
    ROUNDED: { mouthPucker: 0.7, mouthFunnel: 0.3 },
    STRETCHED: { mouthStretchLeft: 0.6, mouthStretchRight: 0.6 },
  },
};

function faceSummary(
  frames: RawFrame[],
  win: [number, number] | null,
  eyebrows: EyebrowPosition,
  mouth: MouthShape,
  head: HeadMovement,
  headRange: FaceSummary["head_range_deg"],
  fmIndex: number[],
  width: number,
  height: number,
): FaceSummary {
  const canonical = { ...RNM_BLENDSHAPES.eyebrows[eyebrows], ...RNM_BLENDSHAPES.mouth[mouth] };
  const inWin = win ? frames.slice(win[0], win[1] + 1) : [];
  const bsFrames = inWin.filter((f) => f.blendshapes);
  let observed: FaceSummary["observed_blendshapes"] = null;
  if (bsFrames.length) {
    const mean: Record<string, number> = {};
    const peak: Record<string, number> = {};
    for (const k of Object.keys(bsFrames[0].blendshapes!)) {
      const v = bsFrames.map((f) => f.blendshapes![k] ?? 0);
      mean[k] = r3(v.reduce((s, x) => s + x, 0) / v.length);
      peak[k] = r3(Math.max(...v));
    }
    observed = { mean, peak };
  }
  // facemarks del cuadro central con cara
  let core: number[][] | null = null;
  const fmFrames = inWin.filter((f) => f.facemarks);
  const iBridge = fmIndex.indexOf(168);
  const [eR, eL] = [fmIndex.indexOf(33), fmIndex.indexOf(263)];
  if (fmFrames.length && iBridge >= 0 && eR >= 0 && eL >= 0) {
    const m = fmFrames[Math.floor(fmFrames.length / 2)].facemarks!;
    const px = (v: V3): V3 => [v[0] * width, v[1] * height, v[2] * width];
    const o = px(m[iBridge]);
    const a = px(m[eR]);
    const b = px(m[eL]);
    const iod = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    core = m.map((v) => {
      const q = px(v);
      return [r3((q[0] - o[0]) / iod), r3((q[1] - o[1]) / iod), r3((q[2] - o[2]) / iod)];
    });
  }
  return {
    rnm: { eyebrows, mouth, head },
    canonical_blendshapes: canonical,
    observed_blendshapes: observed,
    head_range_deg: headRange,
    facemarks_core: core,
  };
}

// ── Notación segmental ──────────────────────────────────────────

const SUB = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
const subN = (n: number) => String(n).split("").map((d) => SUB[+d]).join("");
const lc = (s?: string) => (s ? s.toLowerCase() : "");

/** LSM-PN legible, al estilo de buildNotation (sign_types.ts). */
export function notationOf(a: SignAnnotation): string {
  let d = 0;
  let m = 0;
  const parts = a.segments.map((s) => {
    const f: string[] = [];
    if (s.cm_id !== undefined) f.push(`CM=${s.cm_id}`);
    if (s.location_code) f.push(`UB=${s.location_code}${s.contact ? `/${lc(s.contact)}` : ""}`);
    if (s.palm_facing || s.finger_pointing) f.push(`OR=(${lc(s.palm_facing)},${lc(s.finger_pointing)})`);
    if (s.type === "M") {
      if (s.contour_movement) f.push(`cont=${lc(s.contour_movement)}`);
      if (s.movement_plane) f.push(`plano=${lc(s.movement_plane)}`);
      if (s.direction) f.push(`dir=(${s.direction.x},${s.direction.y},${s.direction.z})`);
      if (s.repetition) f.push(`rep=${s.repetition.count}×${lc(s.repetition.type)}`);
      return `M${subN(++m)}[${f.join(", ")}]`;
    }
    return `D${subN(++d)}[${f.join(", ")}]`;
  });
  let out = parts.join(" → ") || "—";
  if (a.nondominant) {
    const nd = a.nondominant;
    out += ` · 2M:${lc(nd.relation)}${nd.cm_id !== undefined ? `(CM=${nd.cm_id})` : ""}`;
  }
  const core = a.segments.find((s) => s.type === "M") ?? a.segments[0];
  const rnm: string[] = [];
  if (core?.eyebrows) rnm.push(`cejas=${lc(core.eyebrows)}`);
  if (core?.mouth) rnm.push(`boca=${lc(core.mouth)}`);
  if (core?.head_movement && core.head_movement !== "NONE") rnm.push(`cabeza=${lc(core.head_movement)}`);
  if (rnm.length) out += `\nRNM[${rnm.join(", ")}]`;
  return out;
}

// ── Pista compacta (tracks/<id>.json.gz) ────────────────────────

export const BLENDSHAPE_ORDER = [
  "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
  "cheekPuff", "cheekSquintLeft", "cheekSquintRight", "eyeBlinkLeft", "eyeBlinkRight",
  "eyeLookDownLeft", "eyeLookDownRight", "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft",
  "eyeLookOutRight", "eyeLookUpLeft", "eyeLookUpRight", "eyeSquintLeft", "eyeSquintRight",
  "eyeWideLeft", "eyeWideRight", "jawForward", "jawLeft", "jawOpen", "jawRight", "mouthClose",
  "mouthDimpleLeft", "mouthDimpleRight", "mouthFrownLeft", "mouthFrownRight", "mouthFunnel",
  "mouthLeft", "mouthLowerDownLeft", "mouthLowerDownRight", "mouthPressLeft", "mouthPressRight",
  "mouthPucker", "mouthRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower",
  "mouthShrugUpper", "mouthSmileLeft", "mouthSmileRight", "mouthStretchLeft", "mouthStretchRight",
  "mouthUpperUpLeft", "mouthUpperUpRight", "noseSneerLeft", "noseSneerRight",
] as const;

const q3 = (v: number[]) => v.map(r3);

export function buildTrack(id: string, ff: FramesFile, side: "left" | "right", win: [number, number] | null) {
  const frames = ff.frames ?? [];
  // manos de cada lado, suavizadas con sus vecinos (quita el temblor)
  const picks = frames.map((f) => pickHands(f, side));
  const seq = (get: (f: RawFrame, i: number) => V3[] | undefined) =>
    smoothV3(frames.map((f, i) => {
      const v = get(f, i);
      return v && v.length ? v : undefined;
    }));
  const domImg = seq((f, i) => (picks[i].dom !== undefined ? f.hands[picks[i].dom!] : undefined));
  const domWorld = seq((f, i) => (picks[i].dom !== undefined ? f.hands_world[picks[i].dom!] : undefined));
  const ndImg = seq((f, i) => (picks[i].other !== undefined ? f.hands[picks[i].other!] : undefined));
  const ndWorld = seq((f, i) => (picks[i].other !== undefined ? f.hands_world[picks[i].other!] : undefined));
  return {
    schema: "lsm-lex-track/1.0",
    id,
    units: {
      norm: "x,y en 0..1 de la imagen; z relativo (MediaPipe)",
      world: "metros, ejes de imagen (x der., y abajo, z al fondo); manos: origen propio",
      head: "grados (pitch, yaw, roll) de la matriz facial",
    },
    video: ff.video,
    window_index: win,
    dominant_image_side: side,
    pose_names: "MediaPipe Pose 33",
    hand_names: "MediaPipe Hand 21",
    blendshape_order: BLENDSHAPE_ORDER,
    facemark_groups: ff.facemark_groups,
    facemark_index: ff.facemark_index,
    frames: frames.map((f, i) => {
      const { dom, other } = picks[i];
      return {
        t: f.t,
        pose: f.pose?.map((p) => q3(p)),
        pose_world: f.pose_world?.map((p) => q3(p)),
        dom: domImg[i]?.map((p) => q3(p)),
        dom_world: domWorld[i]?.map((p) => q3(p)),
        dom_src: dom !== undefined ? (f.hand_src?.[dom] ?? "det") : undefined,
        nd: ndImg[i]?.map((p) => q3(p)),
        nd_world: ndWorld[i]?.map((p) => q3(p)),
        nd_src: other !== undefined ? (f.hand_src?.[other] ?? "det") : undefined,
        bs: f.blendshapes ? BLENDSHAPE_ORDER.map((k) => r3(f.blendshapes![k] ?? 0)) : undefined,
        fm: f.facemarks?.map((p) => q3(p)),
        head: f.head,
      };
    }),
  };
}

// ── Entrada completa ────────────────────────────────────────────

export interface BuildInput {
  page: SourcePage;
  video: SourceVideo;
  frames: FramesFile | null;
  generatedAt: string;
}

export function entryId(v: SourceVideo): string {
  return v.file_id !== null ? `wsl-${v.file_id}` : `wsl-yt-${v.youtube_id}`;
}

export function buildEntry({ page, video, frames: ff, generatedAt }: BuildInput): {
  entry: LexiconEntry;
  track: ReturnType<typeof buildTrack> | null;
} {
  const id = entryId(video);
  const label = video.title?.trim() || page.label;
  const meta = parseLabel(label);
  const flags: string[] = [];
  if (!meta.variety.is_lsm) flags.push("otra_lengua");
  if (meta.kind === "fingerspelling") flags.push("dactilologia");

  const W = ff?.video?.width ?? 640;
  const H = ff?.video?.height ?? 360;
  const cleaned = cleanHands(ff?.frames ?? [], W, H);
  const frames = cleaned.frames;
  const fmIndex = ff?.facemark_index ?? [];
  const side = dominantImageSide(frames);
  const dominant_hand: "RIGHT" | "LEFT" = side === "left" ? "RIGHT" : "LEFT";
  const win = frames.length ? signingWindow(frames, side) : null;
  if (!ff || ff.error) flags.push("sin_video");
  else if (!win) flags.push("sin_mano");

  const source: WikisignsSource = {
    site: "wikisigns.org",
    page_url: page.url,
    youtube_id: video.youtube_id,
    video_url: `https://www.youtube.com/watch?v=${video.youtube_id}`,
    file_id: video.file_id,
    node_id: video.node_id,
    video_title: video.video_title,
    wikisigns_number: video.wikisigns_number,
    rating_avg: video.rating_avg,
    rating_votes: video.rating_votes,
    fetched_at: page.fetched_at,
    license: "CC BY-SA 4.0",
    attribution: ATTRIBUTION,
  };

  let annotation: SignAnnotation = {
    id,
    cm_id: 0,
    gloss: meta.gloss,
    video_url: source.video_url,
    created_at: generatedAt,
    updated_at: generatedAt,
    dominant_hand,
    segments: [],
    two_handed: false,
    symmetrical: false,
    notes: `Wikisigns: ${page.url}`,
    status: "draft",
  };

  let suggestion: PhonSuggestion | null = null;
  let ndCm: { id: number; score: number } | null = null;
  let head: HeadMovement = "NONE";
  let headRange: FaceSummary["head_range_deg"] = null;
  let cmTied = false;
  const winFrames = win ? frames.slice(win[0], win[1] + 1) : [];
  const t0 = winFrames[0]?.t ?? 0;
  const t1 = winFrames[winFrames.length - 1]?.t ?? 0;

  if (win && winFrames.length) {
    const picks = winFrames.map((f) => pickHands(f, side));
    const domSeq = smooth(picks.map((p, i) => (p.dom !== undefined ? winFrames[i].hands[p.dom].map(toPt) : undefined)));
    const ndSeq = smooth(picks.map((p, i) => (p.other !== undefined ? winFrames[i].hands[p.other].map(toPt) : undefined)));
    // brazo base de la persona (ver buildAnchors): fuera de juego si su mano no está en cuadro
    const [baseElbow, baseWrist] = side === "left" ? [13, 15] : [14, 16];
    const phon: PhonFrame[] = winFrames.map((f, i) => {
      let pose = f.pose?.map(toPt);
      if (pose && !ndSeq[i]) {
        pose = pose.map((p, k) => (k === baseElbow || k === baseWrist ? { x: -9, y: -9, z: 0 } : p));
      }
      return {
        timestampMs: f.t,
        hand: domSeq[i],
        otherHand: ndSeq[i],
        twoHands: f.hands.length >= 2,
        pose,
        face: f.blendshapes,
      };
    });
    suggestion = aggregate(phon, side);
    // CM y OR solo con manos que tienen profundidad: una mano 2D de RTMW
    // (z = 0) se ve plana y votaría formas y palmas falsas. Lugar,
    // movimiento y dos manos sí usan todas.
    const flatDom = picks.map((p, i) => p.dom !== undefined && isFlatHand(winFrames[i].hand_src?.[p.dom]));
    const phon3d = phon.map((p, i) => (flatDom[i] ? { ...p, hand: undefined } : p));
    const shapeFrames = phon3d.some((p) => p.hand) ? phon3d : phon;
    if (shapeFrames === phon3d && flatDom.some(Boolean)) {
      const shape = aggregate(phon3d, side);
      suggestion = { ...suggestion, cmCandidates: shape.cmCandidates, palm_facing: shape.palm_facing, finger_pointing: shape.finger_pointing };
    } else if (shapeFrames === phon && flatDom.some(Boolean)) {
      flags.push("cm_2d");
    }

    // Desempate de CM con el pulgar (mismos cuadros núcleo que aggregate)
    const withHand = shapeFrames.map((p, i) => ({ p, i })).filter((x) => x.p.hand);
    const third = Math.floor(withHand.length / 3);
    const coreIdx = withHand.slice(third, Math.max(third + 1, withHand.length - third));
    const cmIdx = coreIdx.length >= 3 ? coreIdx : withHand;
    const all = rankCMs(cmIdx.map((x) => observeHandShape(x.p.hand!)), CM_INVENTORY.length);
    const thumbs = cmIdx
      .map((x) => {
        const d = picks[x.i].dom;
        const w = d !== undefined && !isFlatHand(winFrames[x.i].hand_src?.[d]) ? winFrames[x.i].hands_world[d] : undefined;
        return w?.length ? observeThumb(w.map(toPt)) : null;
      })
      .filter((t): t is ReturnType<typeof observeThumb> => Boolean(t));
    const tb = breakCmTie(all, thumbs);
    cmTied = tb.stillTied;
    suggestion = { ...suggestion, cmCandidates: tb.ranked.slice(0, 3) };

    if (suggestion.contour === "ZIGZAG") {
      const traj = phon.filter((p) => p.hand).map((p) => centroid(p.hand!));
      const sw = median(
        winFrames.filter((f) => f.pose).map((f) => Math.abs(f.pose![11][0] - f.pose![12][0])),
      );
      const z = refineZigzag(traj, sw);
      if (z) {
        suggestion = {
          ...suggestion,
          contour: z.contour,
          repetition: suggestion.repetition ?? { count: z.strokes >= 4 ? 3 : 2, type: "IGUAL" },
        };
      }
    }
    // la ventana arranca en t0: las marcas de tiempo del video se conservan
    annotation = applySuggestion(annotation, suggestion, Math.max(1, t1 - t0));
    annotation.updated_at = generatedAt;
    annotation.segments = annotation.segments.map((s, i) => ({
      ...s,
      id: `${id}-s${i + 1}`,
      start_ms: s.start_ms + t0,
      end_ms: s.end_ms + t0,
    }));

    // UB fina con la malla de la cara: núcleo para M, extremos para D
    const ubOf = (code: string) => UB_LOCATIONS.find((l) => l.code === code);
    const withIdx = phon.map((p, i) => i).filter((i) => phon[i].hand);
    const cThird = Math.floor(withIdx.length / 3);
    const coreI = withIdx.slice(cThird, Math.max(cThird + 1, withIdx.length - cThird));
    const span = (ids: number[]) =>
      fineLocation(ids.map((i) => winFrames[i]), ids.map((i) => domSeq[i]), ids.map((i) => ndSeq[i]), fmIndex, W, H, dominant_hand);
    const fine = {
      core: span(coreI.length >= 3 ? coreI : withIdx),
      start: span(withIdx.slice(0, 3)),
      end: span(withIdx.slice(-3)),
    };
    annotation.segments = annotation.segments.map((s) => {
      const f = s.type === "M" || annotation.segments.length === 1 ? fine.core : s.phase === "PREPARATION" ? fine.start : fine.end;
      if (!f) return s;
      const loc = ubOf(f.code);
      return {
        ...s,
        location_code: f.code,
        location: loc?.name ?? (f.code === "EN" ? "Espacio neutro" : f.code),
        body_region: loc?.region ?? (f.code === "EN" ? "NEUTRAL_SPACE" : s.body_region),
        ...(s.type === "M" || annotation.segments.length === 1 ? { contact: f.contact } : {}),
        provenance: { ...s.provenance, location_code: "auto", ...(s.type === "M" ? { contact: "auto" } : {}) },
      };
    });
    // un D igual al núcleo no es una detención distinta: fuera
    const coreCode = fine.core?.code;
    if (coreCode && annotation.segments.length > 1) {
      annotation.segments = annotation.segments.filter((s) => s.type === "M" || s.location_code !== coreCode);
      annotation.segments = annotation.segments.map((s, i) => ({ ...s, id: `${id}-s${i + 1}` }));
    }

    // Lateralidad y cabeza (núcleo M)
    const wThird = Math.floor(winFrames.length / 3);
    const coreFrames = winFrames.slice(wThird, Math.max(wThird + 1, winFrames.length - wThird));
    const laterality = observeLaterality(coreFrames, side);
    const h = observeHead(frames, win, fmIndex, W, H);
    head = h.head;
    headRange = h.range;
    annotation.segments = annotation.segments.map((s) => {
      if (s.type !== "M") return s;
      const prov = { ...s.provenance };
      const extra: Partial<PSHRSegment> = {};
      if (laterality) {
        extra.laterality = laterality;
        prov.laterality = "auto";
      }
      if (head !== "NONE") {
        extra.head_movement = head;
        prov.head_movement = "auto";
      }
      return { ...s, ...extra, provenance: prov };
    });

    // Mano no dominante: CM y OR propias (el analizador solo da la relación)
    const others = phon
      .filter((p, i) => p.otherHand && !isFlatHand(winFrames[i].hand_src?.[picks[i].other ?? -1]))
      .map((p) => p.otherHand!);
    if (suggestion.nondominant_relation && others.length >= 3) {
      const best = rankCMs(others.map(observeHandShape), 1)[0];
      if (best) ndCm = { id: best.cm_id, score: r3(best.score) };
      const ors = others.map((h2) => observeOrientation(h2, side !== "left"));
      const modeOf = (v: string[]) =>
        [...v.reduce((m2, x) => m2.set(x, (m2.get(x) ?? 0) + 1), new Map<string, number>())].sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0];
      const nd = annotation.nondominant!;
      const own = nd.relation === "BASE_PASIVA" || nd.relation === "INDEPENDIENTE";
      if (own && ndCm) {
        annotation.nondominant = {
          ...nd,
          cm_id: ndCm.id,
          palm_facing: modeOf(ors.map((o) => o.palm)) as typeof nd.palm_facing,
          finger_pointing: modeOf(ors.map((o) => o.fingers)) as typeof nd.finger_pointing,
          provenance: { ...nd.provenance, cm_id: "auto", palm_facing: "auto", finger_pointing: "auto" },
        };
      }
    }
  }

  // ── Fonología resumida ──
  const core = annotation.segments.find((s) => s.type === "M") ?? annotation.segments[0];
  let phonology: Phonology | null = null;
  if (suggestion && core) {
    const cmEntry = core.cm_id !== undefined ? CM_INVENTORY.find((c) => c.cm_id === core.cm_id) : undefined;
    const top = suggestion.cmCandidates[0];
    phonology = {
      structure: annotation.segments.map((s) => s.type).join(""),
      cm: cmEntry
        ? {
            id: cmEntry.cm_id,
            notation: cmEntry.cruz_aldrete_notation,
            alpha_code: cmEntry.alpha_code,
            example_sign: cmEntry.example_sign,
            score: r3(top?.score ?? 0),
            candidates: suggestion.cmCandidates.map((c) => ({ cm_id: c.cm_id, score: r3(c.score) })),
          }
        : null,
      ub: core.location_code
        ? {
            code: core.location_code,
            name: core.location ?? null,
            region: core.body_region ?? null,
            contact: core.contact,
            laterality: core.laterality,
          }
        : null,
      or: { palm: core.palm_facing, fingers: core.finger_pointing },
      mov: suggestion.contour
        ? {
            contour: suggestion.contour,
            plane: suggestion.plane,
            direction: suggestion.direction,
            repetition: suggestion.repetition,
          }
        : null,
      bimanual: {
        two_handed: annotation.two_handed,
        relation: annotation.nondominant?.relation ?? null,
        nondominant_cm: ndCm,
      },
    };
  }

  // ── Esqueleto canónico ──
  const hands: HandCanonical[] = [];
  const seenCm = new Set<number>();
  for (const s of annotation.segments) {
    for (const cmId of [s.cm_id, s.end_cm_id]) {
      if (cmId === undefined || seenCm.has(cmId)) continue;
      const cm = CM_INVENTORY.find((c) => c.cm_id === cmId);
      if (cm) {
        hands.push(canonicalHand(cm, "dominant"));
        seenCm.add(cmId);
      }
    }
  }
  const nd = annotation.nondominant;
  if (nd) {
    const ndId = nd.cm_id ?? (nd.relation === "SIMETRICA" || nd.relation === "ALTERNADA" ? core?.cm_id : undefined);
    const cm = ndId !== undefined ? CM_INVENTORY.find((c) => c.cm_id === ndId) : undefined;
    if (cm) hands.push(canonicalHand(cm, "nondominant"));
  }
  const codes = [...new Set(annotation.segments.map((s) => s.location_code).filter((c): c is string => Boolean(c)))];
  if (nd?.location_code) codes.push(nd.location_code);
  const locations = codes.map(ubAnchor);

  // ── Esqueleto observado (núcleo de la ventana) ──
  let obsDom: HandObserved | null = null;
  let obsNd: HandObserved | null = null;
  let armDom: ArmObserved | null = null;
  let armNd: ArmObserved | null = null;
  if (winFrames.length) {
    const third = Math.floor(winFrames.length / 3);
    const coreFrames = winFrames.slice(third, Math.max(third + 1, winFrames.length - third));
    const domS: ReturnType<typeof handJoints>[] = [];
    const ndS: ReturnType<typeof handJoints>[] = [];
    const aD: Omit<ArmObserved, "frames">[] = [];
    const aN: Omit<ArmObserved, "frames">[] = [];
    const ndSide = dominant_hand === "RIGHT" ? "LEFT" : "RIGHT";
    for (const f of coreFrames) {
      const { dom, other } = pickHands(f, side);
      const deep = (k?: number): k is number => k !== undefined && Boolean(f.hands_world[k]?.length) && !isFlatHand(f.hand_src?.[k]);
      if (deep(dom)) domS.push(handJoints(f.hands_world[dom].map(toPt)));
      if (deep(other)) ndS.push(handJoints(f.hands_world[other].map(toPt)));
      if (f.pose_world && f.pose) {
        const pw = f.pose_world.map(toPt);
        const vis = f.pose.map((p) => p[3]);
        const a = armAngles(pw, vis, dominant_hand);
        if (a) aD.push(a);
        if (annotation.two_handed) {
          const b = armAngles(pw, vis, ndSide);
          if (b) aN.push(b);
        }
      }
    }
    obsDom = medianHand(domS);
    obsNd = annotation.two_handed ? medianHand(ndS) : null;
    armDom = medianArm(aD);
    armNd = annotation.two_handed ? medianArm(aN) : null;
  }

  const eyebrows: EyebrowPosition = core?.eyebrows ?? "NEUTRAL";
  const mouth: MouthShape = core?.mouth ?? "NEUTRAL";
  const face = faceSummary(frames, win, eyebrows, mouth, head, headRange, fmIndex, W, H);

  // ── QA ──
  let confidence = 0;
  if (suggestion && phonology?.cm) {
    const coverage = suggestion.framesWithHand / Math.max(1, suggestion.framesAnalyzed);
    confidence = r3(phonology.cm.score * 0.7 + Math.min(1, coverage) * 0.3);
    if (phonology.cm.score < 0.75) flags.push("cm_dudosa");
    if (cmTied) flags.push("cm_empate");
    if (suggestion.framesWithHand < 6) flags.push("pocos_cuadros");
    if (!phonology.ub) flags.push("sin_ub");
  }

  const entry: LexiconEntry = {
    schema: LEXICON_SCHEMA,
    id,
    gloss: meta.gloss,
    spanish: meta.spanish,
    synonyms: meta.synonyms,
    label,
    variant: meta.variant,
    variety: meta.variety,
    qualifiers: meta.qualifiers,
    kind: meta.kind,
    source,
    video: {
      duration_ms: ff?.video?.duration_ms ?? 0,
      width: W,
      height: H,
      fps: ff?.video?.fps ?? 0,
      sampled_frames: frames.length,
      frames_with_hand: frames.filter((f) => f.hands.length > 0).length,
      hand_recovery: cleaned.stats,
      window_ms: win ? [t0, t1] : null,
    },
    annotation,
    notation: annotation.segments.length ? notationOf(annotation) : "—",
    phonology,
    skeleton: {
      rig: "Lexsi (Mixamo) — avatar_hand_bones.ts, ub_bone_map.ts",
      convention:
        "Lexsi es el espejo de quien aprende: huesos Left* = mano dominante de la persona señante, Right* = no dominante. Euler XYZ en grados sobre la pose de enlace, como AvatarModel.applyPose.",
      dominant_hand,
      canonical: { hands, locations },
      observed: { dominant: obsDom, nondominant: obsNd, arm_dominant: armDom, arm_nondominant: armNd },
    },
    face,
    tracks: ff && !ff.error && frames.length ? `tracks/${id}.json.gz` : null,
    qa: { confidence, flags, status: "auto" },
  };

  return { entry, track: entry.tracks ? buildTrack(id, { ...ff!, frames }, side, win) : null };
}
