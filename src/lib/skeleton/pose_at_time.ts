/**
 * pose_at_time.ts — la única entrada del renderer:
 *   poseAtTime(annotation, t_ms) → SkeletonPose  (determinista y pura)
 *
 * Localiza el segmento activo; en D mantiene la pose; en M interpola
 * entre la pose del segmento anterior y la del siguiente con easing,
 * desplazando la trayectoria según contour/direction/repetition y
 * aplicando el movimiento local. La mano no dominante se resuelve con
 * la tipología bimanual (simétrica/alternada/base pasiva/independiente).
 */

import type {
  SignAnnotation,
  PSHRSegment,
  CMEntry,
  EyebrowPosition,
  MouthShape,
  HeadMovement,
} from "@/lib/types";
import { CM_INVENTORY } from "@/lib/data";
import {
  v3,
  add,
  sub,
  scale,
  lerpV,
  normalize,
  cross,
  norm,
  easeInOut,
  slerp,
  QUAT_IDENTITY,
  type Vec3,
  type Quat,
} from "./geometry";
import {
  fingerAnglesFromCM,
  lerpHandPose,
  RESTING_POSE,
  type HandPose,
} from "./cm_kinematics";
import { wristTargetFromUB, neutralPoint } from "./ub_anchors";
import { wristRotationFromOR } from "./or_rotation";

// ── Dimensiones del esqueleto (metros aprox.) ───────────────────

export const SKEL = {
  shoulderY: 0.16,
  shoulderX: 0.18,
  upperArm: 0.27,
  forearm: 0.25,
  headCenter: v3(0, 0.34, 0),
  headRadius: 0.11,
} as const;

export interface ArmPose {
  shoulder: Vec3;
  elbow: Vec3;
  wrist: Vec3;
  wristQuat: Quat;
  hand: HandPose;
}

export interface SkeletonPose {
  left: ArmPose;
  right: ArmPose;
  eyebrows: EyebrowPosition;
  mouth: MouthShape;
  head: HeadMovement;
  /** ángulo de cabeceo/inclinación ya resuelto para el renderer */
  headTilt: { x: number; z: number };
}

// ── IK analítica de dos huesos ──────────────────────────────────

/** Codo hacia abajo-afuera; sin solvers iterativos. */
export function armFromWrist(target: Vec3, side: "L" | "R"): {
  shoulder: Vec3;
  elbow: Vec3;
  wrist: Vec3;
} {
  const sx = side === "R" ? SKEL.shoulderX : -SKEL.shoulderX;
  const shoulder = v3(sx, SKEL.shoulderY, 0);
  const L1 = SKEL.upperArm;
  const L2 = SKEL.forearm;
  let d = sub(target, shoulder);
  let dist = norm(d);
  const maxReach = (L1 + L2) * 0.999;
  if (dist > maxReach) {
    d = scale(normalize(d), maxReach);
    dist = maxReach;
    target = add(shoulder, d);
  }
  if (dist < 1e-4) {
    return { shoulder, elbow: add(shoulder, v3(0, -L1, 0)), wrist: target };
  }
  // ley de cosenos
  const cosA = Math.min(
    1,
    Math.max(-1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist)),
  );
  const a = Math.acos(cosA);
  const axis = normalize(d);
  // plano del codo: hacia abajo-afuera
  const hint = normalize(v3(side === "R" ? 0.6 : -0.6, -1, -0.1));
  let planeN = cross(axis, hint);
  if (norm(planeN) < 1e-4) planeN = v3(0, 0, 1);
  const inPlane = normalize(cross(normalize(planeN), axis));
  const elbow = add(
    shoulder,
    add(scale(axis, Math.cos(a) * L1), scale(inPlane, Math.sin(a) * L1)),
  );
  return { shoulder, elbow, wrist: target };
}

// ── Utilidades de segmento ──────────────────────────────────────

const cmById = (id?: number): CMEntry | undefined =>
  id === undefined ? undefined : CM_INVENTORY.find((c) => c.cm_id === id);

interface KeyPose {
  wrist: Vec3;
  quat: Quat;
  hand: HandPose;
}

function keyPoseOfSegment(
  seg: PSHRSegment | undefined,
  side: "L" | "R",
  fallback: KeyPose,
): KeyPose {
  if (!seg) return fallback;
  const cm = cmById(seg.cm_id);
  return {
    wrist: seg.location_code
      ? wristTargetFromUB(seg.location_code, side, seg.contact)
      : fallback.wrist,
    quat: wristRotationFromOR(
      seg.palm_facing,
      seg.finger_pointing,
      side,
      seg.forearm_rotation,
    ).quat,
    hand: cm ? fingerAnglesFromCM(cm) : fallback.hand,
  };
}

/** Desplazamiento de trayectoria por contorno, en el plano indicado. */
function contourOffset(seg: PSHRSegment, from: Vec3, to: Vec3, t: number): Vec3 {
  const contour = seg.contour_movement;
  if (!contour) return v3(0, 0, 0);
  const cycles = Math.max(1, seg.repetition?.count ?? 1);
  const dir = sub(to, from);
  const travel = norm(dir);
  const amp = Math.max(0.03, Math.min(0.09, travel * 0.35 + 0.02));
  // normal del plano de movimiento
  const planeN =
    seg.movement_plane === "HORIZONTAL"
      ? v3(0, 1, 0)
      : seg.movement_plane === "SAGITTAL"
        ? v3(1, 0, 0)
        : v3(0, 0, 1); // vertical/oblicuo: frente
  let lateral = travel > 1e-4 ? cross(normalize(dir), planeN) : v3(1, 0, 0);
  if (norm(lateral) < 1e-4) lateral = v3(0, 1, 0);
  lateral = normalize(lateral);
  const up = travel > 1e-4 ? normalize(cross(lateral, normalize(dir))) : v3(0, 1, 0);

  switch (contour) {
    case "STRAIGHT":
      return v3(0, 0, 0);
    case "ARC":
      return scale(up, Math.sin(t * Math.PI) * amp);
    case "CIRCLE": {
      const ang = t * 2 * Math.PI * cycles;
      return add(
        scale(lateral, Math.sin(ang) * amp),
        scale(up, (1 - Math.cos(ang)) * amp * 0.5),
      );
    }
    case "ZIGZAG":
      return scale(up, Math.sign(Math.sin(t * Math.PI * 2 * Math.max(2, cycles + 1))) * amp * 0.6 * Math.sin(t * Math.PI));
    case "SEVEN": {
      // dos tramos rectos con quiebre
      return t < 0.5 ? v3(0, 0, 0) : scale(up, -(t - 0.5) * 2 * amp);
    }
  }
}

/** Movimiento local: modula muñeca/quat/mano. Distinguible, no realista. */
function applyLocal(
  seg: PSHRSegment,
  t: number,
  pose: KeyPose,
  endHand: HandPose | null,
): KeyPose {
  const local = seg.local_movement;
  if (!local) return pose;
  const cycles = Math.max(2, (seg.repetition?.count ?? 2) * 2);
  const osc = Math.sin(t * Math.PI * cycles);
  switch (local) {
    case "TWIST": {
      // rotación de muñeca sobre el eje del antebrazo (aprox: eje y local)
      const twist = { x: 0, y: Math.sin((osc * Math.PI) / 5), z: 0, w: Math.cos((osc * Math.PI) / 5) };
      return { ...pose, quat: slerp(pose.quat, { ...twist }, 0.5) };
    }
    case "OSCILLATE":
    case "PROGRESSIVE":
      if (endHand) {
        const k = local === "PROGRESSIVE" ? t : (osc + 1) / 2;
        return { ...pose, hand: lerpHandPose(pose.hand, endHand, k) };
      }
      return pose;
    case "VIBRATE":
      return { ...pose, wrist: add(pose.wrist, v3(osc * 0.008, 0, 0)) };
    case "WIGGLE":
    case "SCRATCH":
      return {
        ...pose,
        hand: lerpHandPose(pose.hand, RESTING_POSE, (osc + 1) / 4),
      };
    case "NOD":
      return { ...pose, wrist: add(pose.wrist, v3(0, osc * 0.015, 0)) };
    case "RUB":
      return { ...pose, wrist: add(pose.wrist, v3(osc * 0.02, 0, 0)) };
    case "CIRCULAR":
      return {
        ...pose,
        wrist: add(pose.wrist, v3(Math.sin(t * Math.PI * cycles) * 0.015, Math.cos(t * Math.PI * cycles) * 0.015, 0)),
      };
    default:
      return pose;
  }
}

// ── Pose de reposo ──────────────────────────────────────────────

function restKeyPose(side: "L" | "R"): KeyPose {
  return {
    wrist: v3(side === "R" ? 0.22 : -0.22, -0.35, 0.08),
    quat: QUAT_IDENTITY,
    hand: RESTING_POSE,
  };
}

// ── poseAtTime ──────────────────────────────────────────────────

export function poseAtTime(
  annotation: SignAnnotation,
  t_ms: number,
): SkeletonPose {
  const segs = [...annotation.segments].sort((a, b) => a.start_ms - b.start_ms);
  const domSide: "L" | "R" = annotation.dominant_hand === "LEFT" ? "L" : "R";
  const rest = restKeyPose(domSide);

  let dom: KeyPose = rest;
  let active: PSHRSegment | undefined;
  let phase = 0; // t normalizado dentro del segmento activo

  if (segs.length > 0) {
    const first = segs[0];
    const last = segs[segs.length - 1];
    if (t_ms <= first.start_ms) {
      dom = keyPoseOfSegment(first, domSide, rest);
      active = first;
    } else if (t_ms >= last.end_ms) {
      dom = keyPoseOfSegment(last, domSide, rest);
      active = last;
    } else {
      const idx = segs.findIndex((s) => t_ms >= s.start_ms && t_ms <= s.end_ms);
      const seg = idx >= 0 ? segs[idx] : segs.find((s) => s.start_ms > t_ms)!;
      const i = idx >= 0 ? idx : segs.indexOf(seg);
      active = seg;
      const span = Math.max(1, seg.end_ms - seg.start_ms);
      phase = Math.min(1, Math.max(0, (t_ms - seg.start_ms) / span));

      const isMovement = seg.type === "M" || seg.phase === "STROKE";
      if (!isMovement) {
        dom = keyPoseOfSegment(seg, domSide, rest);
      } else {
        // M: interpola de la pose previa (o la del propio M) a la siguiente
        const prev = keyPoseOfSegment(segs[i - 1] ?? seg, domSide, rest);
        const self = keyPoseOfSegment(seg, domSide, prev);
        const next = keyPoseOfSegment(segs[i + 1] ?? seg, domSide, self);
        const from = segs[i - 1] ? prev : self;
        let to = segs[i + 1] ? next : self;

        // dirección explícita cuando no hay cambio de UB entre segmentos
        if (
          seg.direction &&
          norm(sub(to.wrist, from.wrist)) < 0.01
        ) {
          const d = normalize(
            v3(seg.direction.x, seg.direction.y, seg.direction.z),
          );
          const reach = 0.12;
          to = { ...to, wrist: add(from.wrist, scale(d, reach)) };
        }

        const k = easeInOut(phase);
        const endHand = seg.end_cm_id
          ? fingerAnglesFromCM(cmById(seg.end_cm_id)!)
          : null;
        let pose: KeyPose = {
          wrist: add(
            lerpV(from.wrist, to.wrist, k),
            contourOffset(seg, from.wrist, to.wrist, phase),
          ),
          quat: slerp(from.quat, to.quat, k),
          hand: endHand
            ? lerpHandPose(from.hand, endHand, k)
            : lerpHandPose(from.hand, to.hand, k),
        };
        pose = applyLocal(seg, phase, pose, endHand);
        dom = pose;
      }
    }
  }

  // ── Mano no dominante ─────────────────────────────────────────
  const baseSide: "L" | "R" = domSide === "R" ? "L" : "R";
  let base: KeyPose = restKeyPose(baseSide);
  const nd = annotation.nondominant;
  if (nd) {
    const mirror = (p: KeyPose): KeyPose => ({
      wrist: v3(-p.wrist.x, p.wrist.y, p.wrist.z),
      quat: { x: p.quat.x, y: -p.quat.y, z: -p.quat.z, w: p.quat.w },
      hand: p.hand,
    });
    if (nd.relation === "SIMETRICA") {
      base = mirror(dom);
    } else if (nd.relation === "ALTERNADA") {
      // misma pose con fase desplazada medio ciclo
      const half = poseDominantAtShiftedPhase(annotation, t_ms, segs, domSide);
      base = mirror(half);
    } else {
      // base pasiva / independiente: su propia CM/OR/UB, quieta
      const cm = cmById(nd.cm_id);
      base = {
        wrist: nd.location_code
          ? wristTargetFromUB(nd.location_code, baseSide, "NEAR")
          : neutralPoint(baseSide),
        quat: wristRotationFromOR(
          nd.palm_facing,
          nd.finger_pointing,
          baseSide,
        ).quat,
        hand: cm ? fingerAnglesFromCM(cm) : RESTING_POSE,
      };
    }
  }

  const domArm = armFromWrist(dom.wrist, domSide);
  const baseArm = armFromWrist(base.wrist, baseSide);
  const mk = (arm: typeof domArm, kp: KeyPose): ArmPose => ({
    ...arm,
    wristQuat: kp.quat,
    hand: kp.hand,
  });

  const eyebrows = active?.eyebrows ?? "NEUTRAL";
  const mouth = active?.mouth ?? "NEUTRAL";
  const head = active?.head_movement ?? "NONE";
  const headTilt = {
    x:
      head === "NOD"
        ? Math.sin(phase * Math.PI * 2) * 0.2
        : head === "TILT_BACK"
          ? -0.25
          : head === "TILT_DOWN"
            ? 0.25
            : 0,
    z:
      head === "TILT_LEFT"
        ? 0.25
        : head === "TILT_RIGHT"
          ? -0.25
          : head === "SHAKE"
            ? Math.sin(phase * Math.PI * 2) * 0.2
            : 0,
  };

  const left = domSide === "L" ? mk(domArm, dom) : mk(baseArm, base);
  const right = domSide === "R" ? mk(domArm, dom) : mk(baseArm, base);
  return { left, right, eyebrows, mouth, head, headTilt };
}

/** Pose dominante con fase desplazada medio ciclo (mano alternada). */
function poseDominantAtShiftedPhase(
  annotation: SignAnnotation,
  t_ms: number,
  segs: PSHRSegment[],
  domSide: "L" | "R",
): KeyPose {
  if (segs.length === 0) return restKeyPose(domSide);
  const first = segs[0].start_ms;
  const last = segs[segs.length - 1].end_ms;
  const span = Math.max(1, last - first);
  const shifted = first + (((t_ms - first) / span + 0.5) % 1) * span;
  const p = poseAtTime(
    { ...annotation, nondominant: undefined },
    shifted,
  );
  return domSide === "R"
    ? { wrist: p.right.wrist, quat: p.right.wristQuat, hand: p.right.hand }
    : { wrist: p.left.wrist, quat: p.left.wristQuat, hand: p.left.hand };
}
