/**
 * phon_features.ts — de landmarks por frame a rasgos fonológicos LSM-PN.
 *
 * Capa pura (sin MediaPipe): recibe landmarks ya extraídos y produce
 * la sugerencia agregada (CM candidatas, UB+contacto, contorno MV, RNM).
 * Todo es una *sugerencia* con confianza — la herramienta guiada la
 * pre-llena y la persona anotadora la corrige.
 */

import type {
  CMEntry,
  FlexionLevel,
  ContactType,
  ContourMovement,
  MovementPlane,
  EyebrowPosition,
  MouthShape,
  MovementDirection,
  PalmFacing,
  FingerPointing,
  NonDominantRelation,
  Repetition,
} from "@/lib/types";
import { CM_INVENTORY } from "@/lib/data";

export interface Pt {
  x: number;
  y: number;
  z: number;
}

/** Un frame analizado (todo opcional: los detectores pueden fallar). */
export interface PhonFrame {
  timestampMs: number;
  /** 21 landmarks de la mano dominante detectada (normalizados 0..1) */
  hand?: Pt[];
  /** 21 landmarks de la otra mano (cuando hay dos) */
  otherHand?: Pt[];
  /** ¿se detectaron 2 manos en este frame? */
  twoHands?: boolean;
  /** 33 landmarks de pose (normalizados) */
  pose?: Pt[];
  /** blendshapes faciales por nombre (0..1) */
  face?: Record<string, number>;
}

export interface CMCandidate {
  cm_id: number;
  score: number; // 0..1, mayor = mejor
}

export interface PhonSuggestion {
  cmCandidates: CMCandidate[];
  location_code?: string;
  contact?: ContactType;
  contour?: ContourMovement;
  plane?: MovementPlane;
  direction?: MovementDirection;
  repetition?: Repetition;
  palm_facing?: PalmFacing;
  finger_pointing?: FingerPointing;
  eyebrows?: EyebrowPosition;
  mouth?: MouthShape;
  two_handed?: boolean;
  /** Relación bimanual inferida de las trayectorias de ambas manos */
  nondominant_relation?: NonDominantRelation;
  /** Corte D-M-D: extremos quietos con lugar distinto al núcleo */
  inicio?: { location_code?: string };
  fin?: { location_code?: string };
  framesAnalyzed: number;
  framesWithHand: number;
}

// ── Flexión por dedo (landmarks de mano MediaPipe) ──────────────
// Índices: 0 muñeca; pulgar 1-4; índice 5-8; medio 9-12; anular 13-16;
// meñique 17-20 (mcp, pip, dip, tip por dedo).

const FINGER_IDX = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
} as const;

type FingerName = keyof typeof FINGER_IDX;
const FINGERS: FingerName[] = ["index", "middle", "ring", "pinky"];

function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function norm(v: Pt): number {
  return Math.hypot(v.x, v.y, v.z);
}
function dist(a: Pt, b: Pt): number {
  return norm(sub(a, b));
}
function angleBetween(a: Pt, b: Pt): number {
  const d = (a.x * b.x + a.y * b.y + a.z * b.z) / (norm(a) * norm(b) || 1);
  return Math.acos(Math.min(1, Math.max(-1, d)));
}

/** Curvatura total de un dedo (rad): flexión en MCP + PIP + DIP. */
function fingerCurl(hand: Pt[], finger: FingerName): number {
  const [mcp, pip, dip, tip] = FINGER_IDX[finger].map((i) => hand[i]);
  const wrist = hand[0];
  const mcpBend = angleBetween(sub(mcp, wrist), sub(pip, mcp));
  const pipBend = angleBetween(sub(pip, mcp), sub(dip, pip));
  const dipBend = angleBetween(sub(dip, pip), sub(tip, dip));
  return mcpBend + pipBend + dipBend;
}

function curlToLevel(curl: number): FlexionLevel {
  if (curl < 0.75) return "EXTENDED";
  if (curl < 1.5) return "CURVED";
  if (curl < 2.5) return "BENT";
  return "CLOSED";
}

export interface HandShapeObs {
  flexion: Record<FingerName, FlexionLevel>;
  thumbContact: boolean;
  spread: boolean;
}

/** Rasgos de configuración de mano de un frame. */
export function observeHandShape(hand: Pt[]): HandShapeObs {
  const flexion = {} as Record<FingerName, FlexionLevel>;
  for (const f of FINGERS) flexion[f] = curlToLevel(fingerCurl(hand, f));

  const palmWidth = dist(hand[5], hand[17]) || 1e-6;
  const thumbTip = hand[4];
  const minThumbToTip = Math.min(
    ...FINGERS.map((f) => dist(thumbTip, hand[FINGER_IDX[f][3]])),
  );
  const thumbContact = minThumbToTip < palmWidth * 0.35;

  // Separación: puntas índice-medio relativas al ancho de palma
  const spread = dist(hand[8], hand[12]) > palmWidth * 0.55;

  return { flexion, thumbContact, spread };
}

// ── Score contra el inventario de CM ────────────────────────────

const LEVEL_ORD: Record<FlexionLevel, number> = {
  EXTENDED: 0,
  CURVED: 1,
  BENT: 2,
  CLOSED: 3,
};

/** Flexión esperada por dedo según la CM (regla de hand_pose.ts). */
function expectedFlexion(cm: CMEntry, finger: FingerName): FlexionLevel {
  const num = { index: 1, middle: 2, ring: 3, pinky: 4 }[finger];
  if (cm.selected_fingers.includes(num)) return cm[finger];
  return cm.non_selected_above ? "EXTENDED" : "CLOSED";
}

export function scoreCM(cm: CMEntry, obs: HandShapeObs): number {
  let d = 0;
  for (const f of FINGERS) {
    d += Math.abs(LEVEL_ORD[expectedFlexion(cm, f)] - LEVEL_ORD[obs.flexion[f]]);
  }
  if (cm.thumb_contact !== obs.thumbContact) d += 1.5;
  if ((cm.spread === "SPREAD") !== obs.spread) d += 0.5;
  // distancia máx razonable = 4*3 + 1.5 + 0.5 = 14
  return Math.max(0, 1 - d / 14);
}

export function rankCMs(observations: HandShapeObs[], topN = 3): CMCandidate[] {
  if (observations.length === 0) return [];
  const totals = new Map<number, number>();
  for (const cm of CM_INVENTORY) {
    let s = 0;
    for (const obs of observations) s += scoreCM(cm, obs);
    totals.set(cm.cm_id, s / observations.length);
  }
  return [...totals.entries()]
    .map(([cm_id, score]) => ({ cm_id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// ── Ubicación (UB) desde pose ───────────────────────────────────
// Pose: 0 nariz, 2/5 ojos, 7/8 orejas, 9/10 boca, 11/12 hombros,
// 13/14 codos, 15/16 muñecas, 23/24 caderas.

interface Anchor {
  code: string;
  pt: Pt;
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}
function lerp(a: Pt, b: Pt, t: number): Pt {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/** Anclas UB construidas desde la pose de este frame. */
function buildAnchors(pose: Pt[], dominantSide: "left" | "right"): Anchor[] {
  const nose = pose[0];
  const eyeMid = mid(pose[2], pose[5]);
  const mouth = mid(pose[9], pose[10]);
  const shoulderMid = mid(pose[11], pose[12]);
  const hipMid = mid(pose[23], pose[24]);
  // Lado NO dominante: la mano base (para Palma/Car/antebrazo)
  const baseElbow = dominantSide === "right" ? pose[13] : pose[14];
  const baseWrist = dominantSide === "right" ? pose[15] : pose[16];

  const up = sub(eyeMid, mouth); // vector hacia arriba de la cara
  const fr = { x: eyeMid.x + up.x * 1.1, y: eyeMid.y + up.y * 1.1, z: eyeMid.z };
  const ca = { x: eyeMid.x + up.x * 2.0, y: eyeMid.y + up.y * 2.0, z: eyeMid.z };
  const chin = { x: mouth.x - up.x * 0.9, y: mouth.y - up.y * 0.9, z: mouth.z };

  return [
    { code: "Ca", pt: ca },
    { code: "Fr", pt: fr },
    { code: "Oc", pt: eyeMid },
    { code: "Au", pt: pose[7] },
    { code: "Na", pt: nose },
    { code: "Ge", pt: mid(mouth, pose[7]) },
    { code: "Os", pt: mouth },
    { code: "Me", pt: chin },
    { code: "Co", pt: lerp(shoulderMid, mouth, 0.45) },
    { code: "Um", pt: dominantSide === "right" ? pose[12] : pose[11] },
    { code: "Pe", pt: lerp(shoulderMid, hipMid, 0.3) },
    { code: "Ve", pt: lerp(shoulderMid, hipMid, 0.7) },
    { code: "Cut", pt: baseElbow },
    { code: "Abr", pt: mid(baseElbow, baseWrist) },
    { code: "Car", pt: baseWrist },
    { code: "Palma", pt: baseWrist },
  ].filter((a) => a.pt);
}

export interface LocationObs {
  code: string;
  /** distancia normalizada al ancla (unidades de ancho de hombros) */
  normDist: number;
}

/** Ancla UB más cercana al centroide de la mano dominante. */
export function observeLocation(
  hand: Pt[],
  pose: Pt[],
  dominantSide: "left" | "right",
): LocationObs | undefined {
  const shoulderW = dist(pose[11], pose[12]);
  if (!shoulderW || shoulderW < 1e-4) return undefined;
  // centroide de la mano (2D basta: z de pose y mano no son comparables)
  const cx = hand.reduce((s, p) => s + p.x, 0) / hand.length;
  const cy = hand.reduce((s, p) => s + p.y, 0) / hand.length;
  let best: LocationObs | undefined;
  for (const a of buildAnchors(pose, dominantSide)) {
    const d = Math.hypot(cx - a.pt.x, cy - a.pt.y) / shoulderW;
    if (!best || d < best.normDist) best = { code: a.code, normDist: d };
  }
  return best;
}

export function contactFromDistance(normDist: number): ContactType {
  if (normDist < 0.35) return "TOUCHING";
  if (normDist < 0.75) return "NEAR";
  return "DISTANT";
}

// ── Movimiento (MV) desde la trayectoria de la muñeca ───────────

export interface TrajectoryResult {
  contour?: ContourMovement;
  plane?: MovementPlane;
  moving: boolean;
}

/**
 * Clasifica el contorno con geometría de la trayectoria 2D:
 * desplazamiento vs longitud de camino (rectitud), giro acumulado
 * (arco/círculo) y reversiones de dirección (zigzag).
 */
export function classifyTrajectory(
  points: { x: number; y: number }[],
  shoulderW: number,
): TrajectoryResult {
  if (points.length < 4 || !shoulderW) return { moving: false };

  let pathLen = 0;
  for (let i = 1; i < points.length; i++) {
    pathLen += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  }
  const disp = Math.hypot(
    points[points.length - 1].x - points[0].x,
    points[points.length - 1].y - points[0].y,
  );

  // ¿Se mueve? camino total contra el tamaño del cuerpo
  if (pathLen < shoulderW * 0.35) return { moving: false };

  // Giro acumulado y reversiones
  let totalTurn = 0;
  let absTurn = 0;
  let reversals = 0;
  let prevSign = 0;
  for (let i = 2; i < points.length; i++) {
    const v1 = {
      x: points[i - 1].x - points[i - 2].x,
      y: points[i - 1].y - points[i - 2].y,
    };
    const v2 = {
      x: points[i].x - points[i - 1].x,
      y: points[i].y - points[i - 1].y,
    };
    const cross = v1.x * v2.y - v1.y * v2.x;
    const dot = v1.x * v2.x + v1.y * v2.y;
    const turn = Math.atan2(cross, dot);
    if (Math.abs(turn) > 0.25) {
      const sign = Math.sign(turn);
      if (prevSign !== 0 && sign !== prevSign && Math.abs(turn) > 0.6) {
        reversals++;
      }
      prevSign = sign;
    }
    totalTurn += turn;
    absTurn += Math.abs(turn);
  }

  // Plano por varianza de ejes
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const range = (v: number[]) => Math.max(...v) - Math.min(...v);
  const rx = range(xs);
  const ry = range(ys);
  let plane: MovementPlane | undefined;
  if (rx > ry * 1.7) plane = "HORIZONTAL";
  else if (ry > rx * 1.7) plane = "VERTICAL";
  else plane = "OBLIQUE";

  let contour: ContourMovement;
  const straightness = disp / (pathLen || 1e-6);
  if (reversals >= 2) contour = "ZIGZAG";
  else if (Math.abs(totalTurn) > 4.2) contour = "CIRCLE";
  else if (straightness > 0.82 && absTurn < 1.2) contour = "STRAIGHT";
  else if (Math.abs(totalTurn) > 0.9) contour = "ARC";
  else if (reversals === 1) contour = "SEVEN";
  else contour = "STRAIGHT";

  return { contour, plane, moving: true };
}

// ── Orientación (OR) desde los landmarks de la mano ─────────────
// Marco de la persona señante (video SIN espejo): x_señante = −x_imagen,
// y_arriba = −y_imagen, z_frente = −z_mediapipe (z crece alejándose de
// cámara y la cámara está de frente a la persona).

function toSigner(v: Pt): Pt {
  return { x: -v.x, y: -v.y, z: -v.z };
}

function classifyAxis(
  v: Pt,
): "UP" | "DOWN" | "FORWARD" | "BACK" | "LEFT" | "RIGHT" {
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  const az = Math.abs(v.z);
  if (ay >= ax && ay >= az) return v.y > 0 ? "UP" : "DOWN";
  if (ax >= az) return v.x > 0 ? "RIGHT" : "LEFT";
  return v.z > 0 ? "FORWARD" : "BACK";
}

/**
 * Palma y dedos desde los 21 landmarks. `signerRightHand` indica si la
 * mano observada es la derecha de la persona (invierte la normal).
 * Umbrales: el eje dominante gana; sin umbral mínimo porque siempre hay
 * una orientación (la incertidumbre se resuelve con la moda entre frames).
 */
export function observeOrientation(
  hand: Pt[],
  signerRightHand: boolean,
): { palm: PalmFacing; fingers: FingerPointing } {
  const wrist = hand[0];
  const idxMcp = hand[5];
  const pnkMcp = hand[17];
  const a = sub(idxMcp, wrist);
  const b = sub(pnkMcp, wrist);
  // normal en coords de imagen; para mano derecha real apunta fuera de
  // la palma con este orden de cross
  let n = {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
  if (!signerRightHand) n = { x: -n.x, y: -n.y, z: -n.z };
  const palmDir = toSigner(n);

  const fingersVec = toSigner(sub(mid(hand[8], hand[12]), mid(hand[5], hand[9])));

  return {
    palm: classifyAxis(palmDir),
    fingers: classifyAxis(fingersVec),
  };
}

// ── Dirección y repetición desde la trayectoria ─────────────────

/**
 * Dirección neta del movimiento (marco señante, solo x/y: la z de los
 * landmarks es demasiado ruidosa para dirección). Umbral: 15% del ancho
 * de hombros por eje.
 */
export function observeDirection(
  points: { x: number; y: number }[],
  shoulderW: number,
): MovementDirection | undefined {
  if (points.length < 3 || !shoulderW) return undefined;
  const dxImg = points[points.length - 1].x - points[0].x;
  const dyImg = points[points.length - 1].y - points[0].y;
  const th = shoulderW * 0.15;
  const x = -dxImg > th ? 1 : -dxImg < -th ? -1 : 0;
  const y = -dyImg > th ? 1 : -dyImg < -th ? -1 : 0;
  if (x === 0 && y === 0) return undefined;
  return { x: x as -1 | 0 | 1, y: y as -1 | 0 | 1, z: 0 };
}

/**
 * Repetición por reversiones sobre el eje principal de la trayectoria
 * (detrended): 2+ reversiones ≈ se repite. count 2 ó 3 (varias).
 */
export function observeRepetition(
  points: { x: number; y: number }[],
  shoulderW: number,
): Repetition | undefined {
  if (points.length < 6 || !shoulderW) return undefined;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const range = (v: number[]) => Math.max(...v) - Math.min(...v);
  const useX = range(xs) >= range(ys);
  const sig = useX ? xs : ys;
  const minSwing = shoulderW * 0.12;
  let reversals = 0;
  let dirSign = 0;
  let swing = 0;
  for (let i = 1; i < sig.length; i++) {
    const d = sig[i] - sig[i - 1];
    const s = Math.sign(d);
    if (s === 0) continue;
    if (dirSign === 0) dirSign = s;
    else if (s !== dirSign) {
      if (swing > minSwing) reversals++;
      dirSign = s;
      swing = 0;
    }
    swing += Math.abs(d);
  }
  if (reversals < 2) return undefined;
  return { count: reversals >= 4 ? 3 : 2, type: "IGUAL" };
}

/**
 * Relación bimanual desde las trayectorias de ambas manos:
 * base casi quieta (<25% del camino dominante) → base pasiva;
 * velocidades verticales correlacionadas → simétrica; anticorrelacionadas
 * → alternada.
 */
export function observeRelation(
  domTraj: { x: number; y: number }[],
  baseTraj: { x: number; y: number }[],
): NonDominantRelation {
  const pathLen = (pts: { x: number; y: number }[]) => {
    let l = 0;
    for (let i = 1; i < pts.length; i++)
      l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return l;
  };
  const domPath = pathLen(domTraj);
  const basePath = pathLen(baseTraj);
  if (domPath < 1e-6 || basePath < domPath * 0.25) return "BASE_PASIVA";
  const n = Math.min(domTraj.length, baseTraj.length);
  let corr = 0;
  for (let i = 1; i < n; i++) {
    const vd = domTraj[i].y - domTraj[i - 1].y;
    const vb = baseTraj[i].y - baseTraj[i - 1].y;
    corr += vd * vb;
  }
  return corr >= 0 ? "SIMETRICA" : "ALTERNADA";
}

// ── RNM desde blendshapes faciales ──────────────────────────────

export function observeFace(face: Record<string, number>): {
  eyebrows: EyebrowPosition;
  mouth: MouthShape;
} {
  const g = (k: string) => face[k] ?? 0;
  const browUp =
    Math.max(g("browInnerUp"), (g("browOuterUpLeft") + g("browOuterUpRight")) / 2);
  const browDown = (g("browDownLeft") + g("browDownRight")) / 2;
  let eyebrows: EyebrowPosition = "NEUTRAL";
  if (browDown > 0.32 && browDown > browUp) eyebrows = "FURROWED";
  else if (browUp > 0.35) eyebrows = "RAISED";

  const jawOpen = g("jawOpen");
  const pucker = Math.max(g("mouthPucker"), g("mouthFunnel"));
  const stretch = Math.max(
    (g("mouthStretchLeft") + g("mouthStretchRight")) / 2,
    (g("mouthSmileLeft") + g("mouthSmileRight")) / 2,
  );
  let mouth: MouthShape = "NEUTRAL";
  if (jawOpen > 0.32) mouth = "OPEN";
  else if (pucker > 0.4) mouth = "ROUNDED";
  else if (stretch > 0.42) mouth = "STRETCHED";

  return { eyebrows, mouth };
}

// ── Agregación de frames → sugerencia ───────────────────────────

function mode<T extends string>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Agrega la línea de frames en una PhonSuggestion.
 * `dominantSide` = lado del cuerpo (en coordenadas de la imagen) donde
 * está la mano que más se movió.
 */
export function aggregate(
  frames: PhonFrame[],
  dominantSide: "left" | "right",
): PhonSuggestion {
  const withHand = frames.filter((f) => f.hand);

  // CM: usar los frames con mano; ponderar dando prioridad al tercio central
  // de la seña (la CM del stroke, no la de preparación/retracción).
  const third = Math.floor(withHand.length / 3);
  const core = withHand.slice(third, Math.max(third + 1, withHand.length - third));
  const cmFrames = core.length >= 3 ? core : withHand;
  const cmCandidates = rankCMs(cmFrames.map((f) => observeHandShape(f.hand!)));

  // UB: moda de la ancla más cercana + mediana de distancia en el núcleo
  const locObs = cmFrames
    .filter((f) => f.pose)
    .map((f) => observeLocation(f.hand!, f.pose!, dominantSide))
    .filter((o): o is LocationObs => Boolean(o));
  const location_code = mode(locObs.map((o) => o.code));
  let contact: ContactType | undefined;
  if (location_code) {
    const dists = locObs
      .filter((o) => o.code === location_code)
      .map((o) => o.normDist)
      .sort((a, b) => a - b);
    contact = contactFromDistance(dists[Math.floor(dists.length / 2)] ?? 1);
  }

  // MV: trayectoria del centroide de la mano en todos los frames con mano
  let contour: ContourMovement | undefined;
  let plane: MovementPlane | undefined;
  const firstPose = frames.find((f) => f.pose)?.pose;
  const shoulderW = firstPose ? dist(firstPose[11], firstPose[12]) : 0;
  const traj = withHand.map((f) => ({
    x: f.hand!.reduce((s, p) => s + p.x, 0) / f.hand!.length,
    y: f.hand!.reduce((s, p) => s + p.y, 0) / f.hand!.length,
  }));
  const t = classifyTrajectory(traj, shoulderW);
  if (t.moving) {
    contour = t.contour;
    plane = t.plane;
  }

  // OR: moda de palma/dedos en el núcleo. La mano del lado izquierdo de
  // la imagen es la derecha de la persona (video sin espejo).
  const signerRightHand = dominantSide === "left";
  const orients = cmFrames.map((f) =>
    observeOrientation(f.hand!, signerRightHand),
  );
  const palm_facing = mode(orients.map((o) => o.palm));
  const finger_pointing = mode(orients.map((o) => o.fingers));

  // Dirección y repetición sobre la trayectoria completa
  const direction = t.moving ? observeDirection(traj, shoulderW) : undefined;
  const repetition = t.moving ? observeRepetition(traj, shoulderW) : undefined;

  // Relación bimanual
  const twoHandedRatio =
    withHand.length > 0
      ? withHand.filter((f) => f.twoHands).length / withHand.length
      : 0;
  let nondominant_relation: NonDominantRelation | undefined;
  if (twoHandedRatio > 0.5) {
    const both = withHand.filter((f) => f.otherHand);
    const centroid = (h: Pt[]) => ({
      x: h.reduce((s, p) => s + p.x, 0) / h.length,
      y: h.reduce((s, p) => s + p.y, 0) / h.length,
    });
    if (both.length >= 4) {
      nondominant_relation = observeRelation(
        both.map((f) => centroid(f.hand!)),
        both.map((f) => centroid(f.otherHand!)),
      );
    } else {
      nondominant_relation = "SIMETRICA";
    }
  }

  // Corte D-M-D: ventanas quietas al inicio/fin con lugar distinto
  let inicio: { location_code?: string } | undefined;
  let fin: { location_code?: string } | undefined;
  if (withHand.length >= 8 && shoulderW > 0) {
    const speeds: number[] = [0];
    for (let i = 1; i < traj.length; i++) {
      speeds.push(
        Math.hypot(traj[i].x - traj[i - 1].x, traj[i].y - traj[i - 1].y),
      );
    }
    const maxS = Math.max(...speeds);
    const quiet = speeds.map((s) => s < Math.max(1e-4, maxS * 0.2));
    const locAt = (idxs: number[]): string | undefined => {
      const obs = idxs
        .map((i) => withHand[i])
        .filter((f) => f.pose)
        .map((f) => observeLocation(f.hand!, f.pose!, dominantSide))
        .filter((o): o is LocationObs => Boolean(o));
      return mode(obs.map((o) => o.code));
    };
    let lead = 0;
    while (lead < quiet.length && quiet[lead]) lead++;
    let trail = 0;
    while (trail < quiet.length && quiet[quiet.length - 1 - trail]) trail++;
    if (lead >= 3) {
      const loc = locAt([...Array(lead).keys()]);
      if (loc && loc !== location_code) inicio = { location_code: loc };
    }
    if (trail >= 3) {
      const idxs = Array.from(
        { length: trail },
        (_, k) => withHand.length - 1 - k,
      );
      const loc = locAt(idxs);
      if (loc && loc !== location_code) fin = { location_code: loc };
    }
  }

  // RNM: moda sobre frames con cara
  const faces = frames.filter((f) => f.face).map((f) => observeFace(f.face!));
  const eyebrows = mode(faces.map((f) => f.eyebrows));
  const mouth = mode(faces.map((f) => f.mouth));

  return {
    cmCandidates,
    location_code,
    contact,
    contour,
    plane,
    direction,
    repetition,
    palm_facing,
    finger_pointing,
    eyebrows: eyebrows === "NEUTRAL" ? undefined : eyebrows,
    mouth: mouth === "NEUTRAL" ? undefined : mouth,
    two_handed: twoHandedRatio > 0.5 ? true : undefined,
    nondominant_relation,
    inicio,
    fin,
    framesAnalyzed: frames.length,
    framesWithHand: withHand.length,
  };
}
