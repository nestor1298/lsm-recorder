"use client";

import { useRef, useMemo, useCallback, useState } from "react";
import { useFrame, useLoader, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneWithSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { UB_LOCATIONS, REGION_COLORS } from "@/lib/ub_inventory";
import type { CMEntry } from "@/lib/types";
import {
  cmEntryToHandPose,
  RESTING_POSE,
  type HandPose,
  type FingerPose,
  type ThumbPose,
  type FingerName,
} from "@/lib/hand_pose";
import {
  cuaternionManoMundo,
  cuaternionManoDesde,
  type CalibracionMano,
} from "@/lib/orientation";
import {
  AVATAR_FINGER_BONES,
  AVATAR_THUMB_BONES,
  ARM_CHAINS,
  mirrorOrientation,
  getRightFingerBones,
  AVATAR_RIGHT_THUMB_BONES,
} from "@/lib/avatar_hand_bones";
import {
  medirBrazo,
  resolverBrazo,
  crearObjetivos,
  crearResultado,
  centroPalmaLocal,
  munecaParaPalma,
  violacionCono,
  type MedidasBrazo,
} from "@/lib/brazo_ik";
import { calcularAnclasUB, LectorUB } from "@/lib/ub_anatomia";
import {
  applyArmFK,
  solveFKCoordinateDescent,
  type ArmJointAngles,
  type ArmFKState,
  type AutoSolveRequest,
  type CapturedPose,
} from "@/lib/arm_fk";
import { interpolateMovementPosition } from "@/lib/sign_playback";

const AVATAR_PATH = "/models/lexsi.glb";

// ── Types ────────────────────────────────────────────────────────

// ── Movement interpolation data (passed during M segments) ──────

export interface MovementInterpolation {
  /** Smooth-stepped interpolation factor 0..1 */
  t: number;
  /** UB code of the "from" hold */
  fromUBCode: string | null;
  /** UB code of the "to" hold */
  toUBCode: string | null;
  /** CM entry of the "from" hold */
  fromCM: CMEntry | null;
  /** CM entry of the "to" hold */
  toCM: CMEntry | null;
  /** Orientation of the "from" hold */
  fromOrientation: { palm: string; fingers: string };
  /** Orientation of the "to" hold */
  toOrientation: { palm: string; fingers: string };
  /** Movement contour: STRAIGHT, ARC, CIRCLE, ZIGZAG, SEVEN */
  contour: string;
  /** Movement plane: VERTICAL, HORIZONTAL, SAGITTAL, OBLIQUE */
  plane: string;
  /** Local movement: WIGGLE, TWIST, etc. */
  local: string | null;
  /** Hand mode during this movement */
  handMode: "dominant" | "both_symmetric";
}

export interface UBTarget {
  code: string;
  region: string;
  name: string;
  /** SVG coordinates from the 200×280 body diagram */
  x: number;
  y: number;
}

export interface RNMTarget {
  eyebrows: "NEUTRAL" | "RAISED" | "FURROWED";
  mouth: "NEUTRAL" | "OPEN" | "CLOSED" | "ROUNDED" | "STRETCHED";
  head:
    | "NONE"
    | "NOD"
    | "SHAKE"
    | "TILT_LEFT"
    | "TILT_RIGHT"
    | "TILT_BACK"
    | "TILT_DOWN";
}

interface AvatarModelProps {
  ubLocation?: UBTarget | null;
  rnm?: RNMTarget | null;
  autoRotate?: boolean;
  /** Show all 80 UB points as interactive spheres */
  showAllUBPoints?: boolean;
  /** Selected UB code for point cloud highlighting (separate from IK target) */
  selectedUBCode?: string | null;
  /** Filter spheres by region */
  ubRegionFilter?: string | null;
  /** Callback when a UB sphere is clicked */
  onUBClick?: (code: string) => void;
  /** Current CM entry for dominant hand finger posing */
  cm?: CMEntry | null;
  /** Orientation for wrist rotation */
  orientation?: { palm: string; fingers: string };
  /** Hand mode: dominant only or both symmetric */
  handMode?: "dominant" | "both_symmetric";
  /** Movement interpolation data (during M segment playback) */
  movementInterp?: MovementInterpolation | null;
  /** Manual FK joint angles — when provided, bypasses IK for left arm */
  armAngles?: ArmJointAngles | null;
  /** Shared ref for FK state reporting (centroid pos, UB distance, etc.) */
  armFKStateRef?: React.MutableRefObject<ArmFKState | null>;
  /** Auto-solve request: solve FK for a batch of UB codes */
  autoSolveRequest?: AutoSolveRequest | null;
}

// ── Bone lookup helpers ─────────────────────────────────────────

function buildBoneMap(root: THREE.Object3D): Map<string, THREE.Bone> {
  const map = new Map<string, THREE.Bone>();
  root.traverse((child) => {
    if ((child as THREE.Bone).isBone) {
      // Store both the original name and a stripped name (without "mixamorig:" prefix)
      // so that our Mixamo bone constants (e.g. "LeftArm") work with any FBX variant
      map.set(child.name, child as THREE.Bone);
      const stripped = child.name.replace(/^mixamorig:/, "");
      if (stripped !== child.name) {
        map.set(stripped, child as THREE.Bone);
      }
    }
  });
  return map;
}

// ── Posición de mundo de un lugar (UB) ───────────────────────────
// Las anclas las calcula ub_anatomia sobre la malla al cargar y siguen a
// su hueso (cara → cabeza, brazo base → brazo base). `espejo` da el punto
// para la otra mano.

function computeUBWorldPosition(
  code: string,
  lector: LectorUB,
  espejo = false,
): THREE.Vector3 | null {
  return lector.posicion(code, espejo, new THREE.Vector3());
}

/**
 * Punto UB empujado hacia fuera por la normal de superficie (solo para el
 * auto-solve de calibración FK). `surfaceOffset` va en unidades del
 * modelo, como antes.
 */
function computeUBWorldPositionWithSurfaceOffset(
  code: string,
  lector: LectorUB,
  surfaceOffset: number,
): THREE.Vector3 | null {
  const p = lector.posicion(code, false, new THREE.Vector3());
  const n = lector.normal(code, false, new THREE.Vector3());
  if (!p || !n) return null;
  return p.addScaledVector(n, surfaceOffset * lector.escala());
}

function computeUBWorldPositionMirrored(
  code: string,
  lector: LectorUB,
): THREE.Vector3 | null {
  return lector.posicion(code, true, new THREE.Vector3());
}

// ── UB Point — individual interactive sphere ─────────────────────

interface UBPointProps {
  code: string;
  region: string;
  isSelected: boolean;
  lector: LectorUB;
  onClick: (code: string) => void;
  /** If true, render this point mirrored on the opposite side (Left↔Right) */
  mirrored?: boolean;
}

function UBPoint({
  code,
  region,
  isSelected,
  lector,
  onClick,
  mirrored = false,
}: UBPointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = REGION_COLORS[region] ?? "#ffffff";

  useFrame(() => {
    if (!meshRef.current) return;
    const pos = mirrored
      ? computeUBWorldPositionMirrored(code, lector)
      : computeUBWorldPosition(code, lector);
    if (!pos) return;

    meshRef.current.position.copy(pos);
    if (glowRef.current) glowRef.current.position.copy(pos);

    // Pulse animation for selected
    if (isSelected) {
      const t = Date.now() * 0.003;
      const scale = 1 + Math.sin(t) * 0.3;
      if (glowRef.current) glowRef.current.scale.setScalar(scale);
    }
  });

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onClick(code);
    },
    [code, onClick],
  );

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  const radius = isSelected ? 0.045 : hovered ? 0.038 : 0.028;
  const emissiveIntensity = isSelected ? 2.5 : hovered ? 1.8 : 1.2;

  return (
    <>
      {/* Glow ring for selected */}
      {isSelected && (
        <mesh ref={glowRef} renderOrder={0}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.25}
            emissive={color}
            emissiveIntensity={0.6}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      )}
      {/* Main sphere — rendered on top of avatar mesh */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        renderOrder={1}
      >
        <sphereGeometry args={[radius, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={isSelected ? 1 : hovered ? 0.9 : 0.7}
          depthTest={false}
        />
      </mesh>
    </>
  );
}

// ── UB Point Cloud — renders filtered UB locations ───────────────

interface UBPointCloudProps {
  lector: LectorUB;
  selectedCode: string | null;
  regionFilter: string | null;
  onMarkerClick: (code: string) => void;
}

// Lugares del brazo base: se muestran también en el otro brazo (los que
// tocaría la otra mano)
const MIRRORED_REGIONS = new Set(["ARM", "FOREARM", "HAND"]);

function UBPointCloud({
  lector,
  selectedCode,
  regionFilter,
  onMarkerClick,
}: UBPointCloudProps) {
  const filteredLocations = useMemo(() => {
    if (!regionFilter) return UB_LOCATIONS;
    return UB_LOCATIONS.filter((loc) => loc.region === regionFilter);
  }, [regionFilter]);

  return (
    <>
      {filteredLocations.map((loc) => (
        <UBPoint
          key={loc.code}
          code={loc.code}
          region={loc.region}
          isSelected={selectedCode === loc.code}
          lector={lector}
          onClick={onMarkerClick}
        />
      ))}
      {/* Mirror arm/forearm/hand points on the opposite side */}
      {filteredLocations
        .filter((loc) => MIRRORED_REGIONS.has(loc.region))
        .map((loc) => (
          <UBPoint
            key={`${loc.code}_R`}
            code={loc.code}
            region={loc.region}
            isSelected={selectedCode === loc.code}
            lector={lector}
            onClick={onMarkerClick}
            mirrored
          />
        ))}
    </>
  );
}

// ── Neutral arms-down pose helper ────────────────────────────────
// Slerps arm bones from bind (T-pose) toward a natural arms-down stance.
// Uses a small delta on upperArm to rotate the arm downward (≈ -75° on local Z).

const _neutralEuler = new THREE.Euler();
const _neutralDelta = new THREE.Quaternion();
const _neutralTarget = new THREE.Quaternion();

function poseArmDown(
  refs: {
    clavicle: THREE.Bone;
    upperArm: THREE.Bone;
    foreArm: THREE.Bone;
    hand: THREE.Bone;
  },
  bind: {
    clavicle: THREE.Quaternion;
    upperArm: THREE.Quaternion;
    foreArm: THREE.Quaternion;
    hand: THREE.Quaternion;
  },
  isLeftArm: boolean,
  factor: number,
) {
  const sign = isLeftArm ? 1 : -1;

  // Clavicle: slight depression (≈ -3°)
  _neutralEuler.set(0, 0, -3 * (Math.PI / 180) * sign, "XYZ");
  _neutralDelta.setFromEuler(_neutralEuler);
  _neutralTarget.copy(bind.clavicle).multiply(_neutralDelta);
  refs.clavicle.quaternion.slerp(_neutralTarget, factor * 3);

  // Upper arm: rotate down from T-pose using YXZ (Mixamo shoulder convention)
  // Positive X = adduction (arm DOWN from T-pose toward body)
  _neutralEuler.set(
    88 * (Math.PI / 180), // X: adduction → bring arm down from T-pose
    5 * (Math.PI / 180) * sign, // Y: slight forward swing
    0, // Z: no axial twist
    "YXZ",
  );
  _neutralDelta.setFromEuler(_neutralEuler);
  _neutralTarget.copy(bind.upperArm).multiply(_neutralDelta);
  refs.upperArm.quaternion.slerp(_neutralTarget, factor * 3);

  // Forearm: slight bend at elbow (≈ 8°)
  _neutralEuler.set(-8 * (Math.PI / 180), 0, 0, "XYZ");
  _neutralDelta.setFromEuler(_neutralEuler);
  _neutralTarget.copy(bind.foreArm).multiply(_neutralDelta);
  refs.foreArm.quaternion.slerp(_neutralTarget, factor * 3);

  // Hand: return to bind pose
  refs.hand.quaternion.slerp(bind.hand, factor * 3);
}

// ── Orientación anatómica de la mano ────────────────────────────
// La orientación pide una rotación de MUNDO para la mano. Se reparte como
// en el cuerpo: el giro sobre el eje del antebrazo (pronación/supinación)
// lo hace el antebrazo; lo que queda lo hace la muñeca dentro de su rango:
// flexión 75°, extensión 70°, desviación radial 20° y cubital 30°, y casi
// nada de giro propio (la muñeca no rota sobre su eje). Si la orientación
// no es alcanzable con la postura del brazo, queda la más cercana posible.
//
// Rango del antebrazo, medido en el propio rig: en la pose T de Lexsi las
// palmas miran abajo pero la bisagra del codo levanta la mano hacia arriba
// (plano frontal), lo que en un cuerpo real corresponde a un antebrazo ya
// PRONADO ~80°. Desde ahí quedan ~10° de pronación y hasta ~170° de
// supinación (80° para volver a neutro + 85–90° de supinación real). Con un
// rango simétrico ±85° la palma hacia dentro con el brazo al frente queda
// inalcanzable (haría falta −110°). En el brazo izquierdo la supinación es
// giro negativo en Y local; el derecho es su espejo.

const DEG_OR = Math.PI / 180;
/** Grados, en el convenio "valor × lado" (el brazo derecho es el espejo). */
const ANTEBRAZO_SUPINACION_MAX = 170;
const ANTEBRAZO_PRONACION_MAX = 10;
const MUNIECA_FLEX = 75 * DEG_OR;
const MUNIECA_EXT = 70 * DEG_OR;
const MUNIECA_RADIAL = 20 * DEG_OR;
const MUNIECA_CUBITAL = 30 * DEG_OR;
const MUNIECA_AXIAL = 10 * DEG_OR;

const _ejeY = new THREE.Vector3(0, 1, 0);
const _padreW = new THREE.Quaternion();
const _antebrazoW = new THREE.Quaternion();
const _deltaMano = new THREE.Quaternion();
const _bindInv = new THREE.Quaternion();
const _giroQ = new THREE.Quaternion();
const _eulerMun = new THREE.Euler();

const limitar = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Ángulo con signo del giro de q alrededor de su eje Y local. */
function giroY(q: THREE.Quaternion): number {
  if (Math.hypot(q.y, q.w) < 1e-6) return 0;
  let a = 2 * Math.atan2(q.y, q.w);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Giro del codo alrededor de la recta hombro–muñeca (grados): se prueba
 *  la vuelta completa; el costo decide cuánto alejarse de la postura base. */
const CODO_GIRO_MAX = 180;
const CODO_GIRO_PASO = 10;

const _claviculaW = new THREE.Quaternion();
const _brazoW = new THREE.Quaternion();
const _abajoOr = new THREE.Vector3();
const _ladoOr = new THREE.Vector3();
const _frenteOr = new THREE.Vector3();
const _dirBrazoOr = new THREE.Vector3();
const _giroCodo = new THREE.Quaternion();
const _ejeCodo = new THREE.Vector3();
const _vecBrazo = new THREE.Vector3();
const _vecAntebrazo = new THREE.Vector3();
const _brazoPrueba = new THREE.Quaternion();
const _antebrazoPrueba = new THREE.Quaternion();
const _manoPrueba = new THREE.Quaternion();
const _logrado = new THREE.Quaternion();
const _antebrazoBase = new THREE.Quaternion();
const _brazoBaseQ = new THREE.Quaternion();

/**
 * Con el brazo en `brazoW` (rotación de mundo), reparte la orientación
 * entre pronación/supinación del antebrazo y la muñeca, ambos limitados.
 * `antebrazo` entra con su objetivo y sale con el giro; `mano` sale.
 */
function repartirAntebrazoMunieca(
  brazoW: THREE.Quaternion,
  bind: { foreArm: THREE.Quaternion; hand: THREE.Quaternion },
  antebrazo: THREE.Quaternion,
  mano: THREE.Quaternion,
  objetivo: THREE.Quaternion,
  isLeftArm: boolean,
) {
  const calcularDelta = () => {
    _antebrazoW.copy(brazoW).multiply(antebrazo);
    _deltaMano.copy(_antebrazoW).invert().multiply(objetivo);
    _deltaMano.premultiply(_bindInv.copy(bind.hand).invert());
  };

  // 1. Pronación/supinación. En «valor × lado» ambos brazos comparten rango.
  calcularDelta();
  const lado = isLeftArm ? 1 : -1;
  const giroActual =
    giroY(_bindInv.copy(bind.foreArm).invert().multiply(antebrazo)) * lado;
  const min = -ANTEBRAZO_SUPINACION_MAX * DEG_OR;
  const max = ANTEBRAZO_PRONACION_MAX * DEG_OR;
  // El mismo giro se logra con ±360°: se toma el equivalente más cercano
  // al centro del rango y luego se limita.
  const centro = (min + max) / 2;
  let giroDeseado = giroActual + giroY(_deltaMano) * lado - centro;
  giroDeseado =
    Math.atan2(Math.sin(giroDeseado), Math.cos(giroDeseado)) + centro;
  const giroTotal = limitar(giroDeseado, min, max);
  antebrazo.multiply(
    _giroQ.setFromAxisAngle(_ejeY, (giroTotal - giroActual) * lado),
  );

  // 2. Muñeca: lo que falta, dentro de su rango
  calcularDelta();
  _eulerMun.setFromQuaternion(_deltaMano, "XZY");
  // +Z lleva los dedos hacia el pulgar en la mano izquierda (radial);
  // en la derecha, espejo, hacia el meñique (cubital).
  const [zMin, zMax] = isLeftArm
    ? [-MUNIECA_CUBITAL, MUNIECA_RADIAL]
    : [-MUNIECA_RADIAL, MUNIECA_CUBITAL];
  _eulerMun.set(
    limitar(_eulerMun.x, -MUNIECA_EXT, MUNIECA_FLEX),
    limitar(_eulerMun.y, -MUNIECA_AXIAL, MUNIECA_AXIAL),
    limitar(_eulerMun.z, zMin, zMax),
    "XZY",
  );
  mano.copy(bind.hand).multiply(_deltaMano.setFromEuler(_eulerMun));
}

/**
 * Ajusta los objetivos locales de brazo, antebrazo y mano para que la mano
 * quede con la rotación de mundo `objetivo` sin moverla de su lugar.
 *
 * Como una persona que seña, primero acomoda el codo: gira el brazo
 * alrededor de la recta hombro–muñeca (la muñeca no se mueve), hasta
 * ±60°, y elige el giro con el que pronación/supinación y muñeca, dentro
 * de su rango, dejan la mano más cerca de lo pedido. Los objetivos se
 * modifican en su lugar.
 */
function resolverOrientacion(
  chain: { clavicle: THREE.Bone; foreArm: THREE.Bone; hand: THREE.Bone },
  bind: { foreArm: THREE.Quaternion; hand: THREE.Quaternion },
  tClavicula: THREE.Quaternion,
  tBrazo: THREE.Quaternion,
  tAntebrazo: THREE.Quaternion,
  tMano: THREE.Quaternion,
  objetivo: THREE.Quaternion,
  isLeftArm: boolean,
  cuerpoQ: THREE.Quaternion,
) {
  if (chain.clavicle.parent) chain.clavicle.parent.getWorldQuaternion(_padreW);
  else _padreW.identity();
  _claviculaW.copy(_padreW).multiply(tClavicula);
  const lado = isLeftArm ? 1 : -1;
  _abajoOr.set(0, -1, 0).applyQuaternion(cuerpoQ);
  _ladoOr.set(lado, 0, 0).applyQuaternion(cuerpoQ);
  _frenteOr.set(0, 0, 1).applyQuaternion(cuerpoQ);

  // Eje hombro→muñeca de la postura OBJETIVO (no de la actual, que ya
  // viene girada): brazo y antebrazo como vectores en su propio espacio.
  _brazoW.copy(_claviculaW).multiply(tBrazo);
  _vecBrazo.copy(chain.foreArm.position).applyQuaternion(_brazoW);
  _antebrazoW.copy(_brazoW).multiply(tAntebrazo);
  _vecAntebrazo.copy(chain.hand.position).applyQuaternion(_antebrazoW);
  _ejeCodo.addVectors(_vecBrazo, _vecAntebrazo);
  const conEje = _ejeCodo.lengthSq() > 1e-12;
  if (conEje) _ejeCodo.normalize();

  _antebrazoBase.copy(tAntebrazo);
  _brazoBaseQ.copy(tBrazo); // los candidatos parten de la postura base, no de la ya elegida
  let mejor = Infinity;
  for (let g = -CODO_GIRO_MAX; g < CODO_GIRO_MAX; g += CODO_GIRO_PASO) {
    if (!conEje && g !== 0) continue;
    // brazo girado en mundo alrededor del eje hombro–muñeca
    _giroCodo.setFromAxisAngle(_ejeCodo, g * DEG_OR);
    _brazoW.copy(_claviculaW).multiply(_brazoBaseQ).premultiply(_giroCodo);
    _brazoPrueba.copy(_claviculaW).invert().multiply(_brazoW);

    _antebrazoPrueba.copy(_antebrazoBase);
    repartirAntebrazoMunieca(
      _brazoW,
      bind,
      _antebrazoPrueba,
      _manoPrueba,
      objetivo,
      isLeftArm,
    );

    _logrado.copy(_brazoW).multiply(_antebrazoPrueba).multiply(_manoPrueba);
    // error angular + un poco de costo por mover el codo + castigo por
    // sacar el brazo de su cono fisiológico
    _dirBrazoOr.copy(chain.foreArm.position).applyQuaternion(_brazoW).normalize();
    // (el codo por encima del hombro cuesta: se prefiere abrirlo al lado)
    const error =
      2 * Math.acos(Math.min(1, Math.abs(_logrado.dot(objetivo)))) +
      0.1 * Math.abs(g * DEG_OR) +
      1.5 * violacionCono(_dirBrazoOr, _abajoOr, _ladoOr, _frenteOr) +
      2.0 * Math.max(0, -_dirBrazoOr.dot(_abajoOr));
    if (error < mejor) {
      mejor = error;
      tBrazo.copy(_brazoPrueba);
      tAntebrazo.copy(_antebrazoPrueba);
      tMano.copy(_manoPrueba);
    }
  }
}

/**
 * Ejes de la mano en su espacio local, medidos en el propio modelo: los
 * dedos van de la muñeca al nudillo del medio; la palma es hacia donde
 * se flexionan (+Z del dedo, porque +X flexiona hacia la palma).
 */
function calibrarMano(
  refs: HandBoneRefs,
  bind: HandBindPoses,
): CalibracionMano {
  return {
    dedos: refs.fingers.middle.carpal.position.clone().normalize(),
    palma: new THREE.Vector3(0, 0, 1).applyQuaternion(
      bind.fingers.middle.carpal,
    ),
  };
}

const _tClav = new THREE.Quaternion();
const _tBrazo = new THREE.Quaternion();
const _tAntebrazo = new THREE.Quaternion();
const _tMano = new THREE.Quaternion();

// ── Temp animation variables ─────────────────────────────────────

const _headEuler = new THREE.Euler();
const _headQuat = new THREE.Quaternion();
const _neckEuler = new THREE.Euler();
const _neckQuat = new THREE.Quaternion();
const _poseEuler = new THREE.Euler();
const _poseDelta = new THREE.Quaternion();

// ── applyPose: rotation delta on top of bind pose ───────────────

function applyPose(
  bone: THREE.Bone,
  bindQuat: THREE.Quaternion,
  dx: number,
  dy: number,
  dz: number,
) {
  _poseEuler.set(dx, dy, dz, "XYZ");
  _poseDelta.setFromEuler(_poseEuler);
  bone.quaternion.copy(bindQuat).multiply(_poseDelta);
}

// ── Morph target index mapping ──────────────────────────────────

type MorphMap = Record<string, number>;

function buildMorphMap(mesh: THREE.Mesh): MorphMap {
  const dict = mesh.morphTargetDictionary;
  if (!dict) return {};
  return dict;
}

// ── RNM state → morph target weights ────────────────────────────

function rnmToMorphWeights(
  rnm: RNMTarget,
  morphMap: MorphMap,
): Record<number, number> {
  const w: Record<number, number> = {};

  function set(name: string, value: number) {
    if (name in morphMap) {
      w[morphMap[name]] = value;
    }
  }

  // ── Eyebrows ──
  switch (rnm.eyebrows) {
    case "RAISED":
      set("browInnerUpL", 0.9);
      set("browInnerUpR", 0.9);
      set("browOuterUpL", 0.7);
      set("browOuterUpR", 0.7);
      set("eyeWidenUpperL", 0.9);
      set("eyeWidenUpperR", 0.9);
      break;
    case "FURROWED":
      set("browInnerDnL", 0.8);
      set("browInnerDnR", 0.8);
      set("browSqueezeL", 0.7);
      set("browSqueezeR", 0.7);
      set("eyeSquintL", 0.85);
      set("eyeSquintR", 0.85);
      break;
  }

  // ── Mouth ──
  switch (rnm.mouth) {
    case "OPEN":
      set("jawOpen", 0.7);
      set("lipFunnelerLower", 0.2);
      break;
    case "CLOSED":
      set("lipCloseLower", 0.8);
      set("lipCloseUpper", 0.8);
      set("lipPresserL", 0.5);
      set("lipPresserR", 0.5);
      break;
    case "ROUNDED":
      set("lipPucker", 0.8);
      set("lipFunnelerLower", 0.6);
      set("lipFunnelerUpper", 0.5);
      set("jawOpen", 0.15);
      break;
    case "STRETCHED":
      set("lipWidenL", 0.7);
      set("lipWidenR", 0.7);
      set("lipSmileOpenL", 0.5);
      set("lipSmileOpenR", 0.5);
      set("lipCornerUpL", 0.4);
      set("lipCornerUpR", 0.4);
      set("cheekUpL", 0.3);
      set("cheekUpR", 0.3);
      break;
  }

  return w;
}

// ── Finger + Thumb animation state (mutable for useFrame) ────────

interface AnimState {
  index: FingerPose;
  middle: FingerPose;
  ring: FingerPose;
  pinky: FingerPose;
  thumb: ThumbPose;
}

function createAnimState(): AnimState {
  return {
    index: { ...RESTING_POSE.index },
    middle: { ...RESTING_POSE.middle },
    ring: { ...RESTING_POSE.ring },
    pinky: { ...RESTING_POSE.pinky },
    thumb: { ...RESTING_POSE.thumb },
  };
}

// ── Finger bone refs + bind poses for one hand ───────────────────

interface HandBoneRefs {
  fingers: Record<
    FingerName,
    {
      carpal: THREE.Bone;
      bones: [THREE.Bone, THREE.Bone, THREE.Bone];
    }
  >;
  thumb: [THREE.Bone, THREE.Bone, THREE.Bone];
  armChain: {
    clavicle: THREE.Bone;
    upperArm: THREE.Bone;
    foreArm: THREE.Bone;
    hand: THREE.Bone;
  };
}

interface HandBindPoses {
  fingers: Record<
    FingerName,
    {
      carpal: THREE.Quaternion;
      bones: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
    }
  >;
  thumb: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
  armChain: {
    clavicle: THREE.Quaternion;
    upperArm: THREE.Quaternion;
    foreArm: THREE.Quaternion;
    hand: THREE.Quaternion;
  };
}

function collectHandBones(
  boneMap: Map<string, THREE.Bone>,
  side: "left" | "right",
): HandBoneRefs | null {
  const fingerMapping =
    side === "left" ? AVATAR_FINGER_BONES : getRightFingerBones();
  const thumbBoneNames =
    side === "left" ? AVATAR_THUMB_BONES : AVATAR_RIGHT_THUMB_BONES;
  const chain = ARM_CHAINS[side];

  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  const fingers = {} as HandBoneRefs["fingers"];

  for (const name of fingerNames) {
    const cfg = fingerMapping[name];
    const carpal = boneMap.get(cfg.carpal);
    const b0 = boneMap.get(cfg.bones[0]);
    const b1 = boneMap.get(cfg.bones[1]);
    const b2 = boneMap.get(cfg.bones[2]);
    if (!carpal || !b0 || !b1 || !b2) return null;
    fingers[name] = { carpal, bones: [b0, b1, b2] };
  }

  const t0 = boneMap.get(thumbBoneNames[0]);
  const t1 = boneMap.get(thumbBoneNames[1]);
  const t2 = boneMap.get(thumbBoneNames[2]);
  if (!t0 || !t1 || !t2) return null;

  const clavicle = boneMap.get(chain.shoulder);
  const upperArm = boneMap.get(chain.upperArm);
  const foreArm = boneMap.get(chain.foreArm);
  const hand = boneMap.get(chain.hand);
  if (!clavicle || !upperArm || !foreArm || !hand) return null;

  return {
    fingers,
    thumb: [t0, t1, t2],
    armChain: { clavicle, upperArm, foreArm, hand },
  };
}

function snapshotHandBindPoses(refs: HandBoneRefs): HandBindPoses {
  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  const fingers = {} as HandBindPoses["fingers"];

  for (const name of fingerNames) {
    const f = refs.fingers[name];
    fingers[name] = {
      carpal: f.carpal.quaternion.clone(),
      bones: [
        f.bones[0].quaternion.clone(),
        f.bones[1].quaternion.clone(),
        f.bones[2].quaternion.clone(),
      ],
    };
  }

  return {
    fingers,
    thumb: [
      refs.thumb[0].quaternion.clone(),
      refs.thumb[1].quaternion.clone(),
      refs.thumb[2].quaternion.clone(),
    ],
    armChain: {
      clavicle: refs.armChain.clavicle.quaternion.clone(),
      upperArm: refs.armChain.upperArm.quaternion.clone(),
      foreArm: refs.armChain.foreArm.quaternion.clone(),
      hand: refs.armChain.hand.quaternion.clone(),
    },
  };
}

// ── Hand centroid: average position of all hand bones ────────────

const _handWorldQ = new THREE.Quaternion();

/**
 * Compute the average world position of all hand bones (centroid).
 * Used by FK mode to measure distance to UB target.
 */
const _centroidWorldTmp = new THREE.Vector3();

function computeHandCentroidWorldPos(refs: HandBoneRefs): THREE.Vector3 {
  const centroid = new THREE.Vector3();
  let count = 0;

  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  for (const name of fingerNames) {
    const finger = refs.fingers[name];
    finger.carpal.getWorldPosition(_centroidWorldTmp);
    centroid.add(_centroidWorldTmp);
    count++;
    for (const bone of finger.bones) {
      bone.getWorldPosition(_centroidWorldTmp);
      centroid.add(_centroidWorldTmp);
      count++;
    }
  }
  for (const bone of refs.thumb) {
    bone.getWorldPosition(_centroidWorldTmp);
    centroid.add(_centroidWorldTmp);
    count++;
  }

  return centroid.divideScalar(count);
}

// ── Animate fingers on one hand ──────────────────────────────────

function animateFingers(
  anim: AnimState,
  targetPose: HandPose,
  refs: HandBoneRefs,
  bindPoses: HandBindPoses,
  factor: number,
) {
  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  // La mano derecha es el espejo de la izquierda: la flexión (X) conserva
  // su signo, la separación (Z) y la rotación del pulgar (Y) lo invierten.
  const espejo = refs.armChain.hand.name.includes("Right") ? -1 : 1;

  for (const name of fingerNames) {
    const s = anim[name];
    const t = targetPose[name];
    s.carpalSpread += (t.carpalSpread - s.carpalSpread) * factor;
    s.carpalFlex += (t.carpalFlex - s.carpalFlex) * factor;
    s.mcpFlex += (t.mcpFlex - s.mcpFlex) * factor;
    s.pipFlex += (t.pipFlex - s.pipFlex) * factor;
    s.dipFlex += (t.dipFlex - s.dipFlex) * factor;

    const boneRefs = refs.fingers[name];
    const bind = bindPoses.fingers[name];

    // Mixamo: *Index1 es la falange proximal (gira en la base, MCP),
    // *Index2 la media (PIP), *Index3 la distal (DIP) y *Index4 solo la
    // punta. X positiva flexiona hacia la palma; Z separa los dedos.
    // No hay hueso metacarpiano, así que el ahuecado (carpalFlex) no aplica.
    applyPose(
      boneRefs.carpal,
      bind.carpal,
      s.mcpFlex,
      0,
      -s.carpalSpread * espejo,
    ); // MCP + separación
    applyPose(boneRefs.bones[0], bind.bones[0], s.pipFlex, 0, 0); // PIP
    applyPose(boneRefs.bones[1], bind.bones[1], s.dipFlex, 0, 0); // DIP
    boneRefs.bones[2].quaternion.copy(bind.bones[2]); // punta
  }

  // Thumb — Mixamo uses flipped X/Y for opposition
  const ts = anim.thumb;
  const tt = targetPose.thumb;
  ts.cmcOpposition += (tt.cmcOpposition - ts.cmcOpposition) * factor;
  ts.cmcRotation += (tt.cmcRotation - ts.cmcRotation) * factor;
  ts.mcpFlex += (tt.mcpFlex - ts.mcpFlex) * factor;
  ts.ipFlex += (tt.ipFlex - ts.ipFlex) * factor;

  applyPose(
    refs.thumb[0],
    bindPoses.thumb[0],
    -ts.cmcOpposition,
    -ts.cmcRotation * espejo,
    0,
  );
  applyPose(refs.thumb[1], bindPoses.thumb[1], ts.mcpFlex, 0, 0);
  applyPose(refs.thumb[2], bindPoses.thumb[2], ts.ipFlex, 0, 0);
}

// ── Blend hand poses for movement interpolation ─────────────────

function blendHandPoses(from: HandPose, to: HandPose, t: number): HandPose {
  const fingerNames: FingerName[] = ["index", "middle", "ring", "pinky"];
  const result = {} as Record<FingerName, FingerPose>;
  for (const name of fingerNames) {
    const f = from[name];
    const tt = to[name];
    result[name] = {
      carpalSpread: f.carpalSpread + (tt.carpalSpread - f.carpalSpread) * t,
      carpalFlex: f.carpalFlex + (tt.carpalFlex - f.carpalFlex) * t,
      mcpFlex: f.mcpFlex + (tt.mcpFlex - f.mcpFlex) * t,
      pipFlex: f.pipFlex + (tt.pipFlex - f.pipFlex) * t,
      dipFlex: f.dipFlex + (tt.dipFlex - f.dipFlex) * t,
    };
  }
  return {
    index: result.index,
    middle: result.middle,
    ring: result.ring,
    pinky: result.pinky,
    thumb: {
      cmcOpposition:
        from.thumb.cmcOpposition +
        (to.thumb.cmcOpposition - from.thumb.cmcOpposition) * t,
      cmcRotation:
        from.thumb.cmcRotation +
        (to.thumb.cmcRotation - from.thumb.cmcRotation) * t,
      mcpFlex: from.thumb.mcpFlex + (to.thumb.mcpFlex - from.thumb.mcpFlex) * t,
      ipFlex: from.thumb.ipFlex + (to.thumb.ipFlex - from.thumb.ipFlex) * t,
    },
  };
}

// ── Blend hand orientations for movement segments ───────────────

function mezclarOrientacion(
  calib: CalibracionMano,
  from: { palm: string; fingers: string },
  to: { palm: string; fingers: string },
  t: number,
): THREE.Quaternion {
  return cuaternionManoMundo(calib, from.palm, from.fingers).slerp(
    cuaternionManoMundo(calib, to.palm, to.fingers),
    t,
  );
}

// ── Pre-allocated scratch vector for movement interpolation ─────

const _interpPosVec = new THREE.Vector3();

// ── Apply local movement overlays ───────────────────────────────

function applyLocalMovement(
  refs: HandBoneRefs,
  local: string,
  t: number,
  elapsedTime: number,
) {
  const wrist = refs.armChain.hand;
  switch (local) {
    case "WIGGLE":
      // Sequential finger wave
      for (const [i, name] of (
        ["index", "middle", "ring", "pinky"] as FingerName[]
      ).entries()) {
        const wave = Math.sin(elapsedTime * 10 + i * 1.2) * 0.3;
        refs.fingers[name].bones[2].rotateX(wave);
      }
      break;
    case "TWIST":
      wrist.rotateZ(Math.sin(elapsedTime * 3) * 0.4);
      break;
    case "CIRCULAR":
      wrist.rotateX(Math.sin(elapsedTime * 3) * 0.15);
      wrist.rotateZ(Math.cos(elapsedTime * 3) * 0.15);
      break;
    case "NOD":
      wrist.rotateX(Math.sin(elapsedTime * 3) * 0.3);
      break;
    case "SCRATCH":
      // Rapid DIP flexion on all fingers
      for (const name of ["index", "middle", "ring", "pinky"] as FingerName[]) {
        refs.fingers[name].bones[2].rotateX(Math.sin(elapsedTime * 14) * 0.2);
      }
      break;
    case "OSCILLATE":
      wrist.rotateY(Math.sin(elapsedTime * 4) * 0.25);
      break;
    case "RELEASE":
      // Cyclic finger open/close
      for (const name of ["index", "middle", "ring", "pinky"] as FingerName[]) {
        const cycle = Math.sin(elapsedTime * 3) * 0.5 + 0.5; // 0..1
        refs.fingers[name].bones[0].rotateX(cycle * 0.4);
        refs.fingers[name].bones[1].rotateX(cycle * 0.3);
      }
      break;
    case "FLATTEN":
      // MCP closing
      for (const name of ["index", "middle", "ring", "pinky"] as FingerName[]) {
        refs.fingers[name].bones[0].rotateX(Math.sin(elapsedTime * 3) * 0.3);
      }
      break;
    case "PROGRESSIVE":
      // Sequential finger closure with phase offset
      for (const [i, name] of (
        ["index", "middle", "ring", "pinky"] as FingerName[]
      ).entries()) {
        const phase = Math.max(0, Math.sin(elapsedTime * 2.5 - i * 0.6));
        refs.fingers[name].bones[0].rotateX(phase * 0.5);
        refs.fingers[name].bones[1].rotateX(phase * 0.4);
      }
      break;
    case "VIBRATE":
      // High-frequency jitter on wrist
      wrist.rotateX(Math.sin(elapsedTime * 25) * 0.02);
      wrist.rotateY(Math.cos(elapsedTime * 25) * 0.02);
      break;
    case "RUB":
      // Subtle finger oscillation
      for (const name of ["index", "middle", "ring", "pinky"] as FingerName[]) {
        refs.fingers[name].bones[2].rotateX(Math.sin(elapsedTime * 8) * 0.1);
      }
      break;
  }
}

// ── Animate arm IK for one hand (anatomically constrained) ──────

// Scratch vectors for centroid offset and rest pose

/** Datos que llena colocarBrazo para las esferas de depuración */
interface DebugIKInfo {
  ikTarget: THREE.Vector3; // verde: muñeca objetivo
  ubTarget: THREE.Vector3; // azul: punto UB (meta del centro de la palma)
  handWorldPos: THREE.Vector3; // rojo: posición real del hueso de la mano
  active: boolean;
}

// ── Colocar el brazo: la palma sobre un punto, con la orientación pedida ──

const _cuerpoQ = new THREE.Quaternion();
const _ubPunto = new THREE.Vector3();
const _ubNormal = new THREE.Vector3();
const _ubPuntoB = new THREE.Vector3();
const _ubNormalB = new THREE.Vector3();
const _ubNormalMezcla = new THREE.Vector3();
const _entradaBrazo = {
  claviculaPos: new THREE.Vector3(),
  padreClaviculaQ: new THREE.Quaternion(),
  cuerpoQ: new THREE.Quaternion(),
  muneca: new THREE.Vector3(),
};
const _objetivosBrazo = crearObjetivos();
const _resultadoBrazo = crearResultado();
const _manoDeseada = new THREE.Quaternion();
const _manoLograda = new THREE.Quaternion();
const _manoObjetivo = new THREE.Quaternion();
const _palmaDir = new THREE.Vector3();
const _dedosDir = new THREE.Vector3();
const _dedosPrueba = new THREE.Vector3();
const _normalDefecto = new THREE.Vector3();
const _hombroPos = new THREE.Vector3();
const _lejos = new THREE.Vector3();
const _cand = Array.from({ length: 6 }, () => new THREE.Vector3());
const _manoPrueba2 = new THREE.Quaternion();
const _munecaPrueba = new THREE.Vector3();
const _contacto = new THREE.Vector3();
const _centroContacto = new THREE.Vector3();
const _palmaMundo = new THREE.Vector3();
const _palmaPredicha = new THREE.Vector3();
const _mejorMunecaObj = new THREE.Vector3();
const _mejorClav = new THREE.Quaternion();
const _mejorBrazoQ = new THREE.Quaternion();
const _mejorAntebrazoQ = new THREE.Quaternion();
const _mejorManoQ = new THREE.Quaternion();
const _baseObjetivo = new THREE.Vector3();
const _manoBaseQ = new THREE.Quaternion();
const _baseDedos = new THREE.Vector3();
const _basePalma = new THREE.Vector3();
const _baseOrient = new THREE.Quaternion();

/**
 * Lleva el CENTRO DE LA PALMA al punto `punto` (mundo) con la orientación
 * `orient` (rotación de mundo de la mano) o, si no hay, con la palma hacia
 * el cuerpo (contra la normal de superficie) y los dedos hacia arriba.
 *
 * Varias pasadas: la muñeca objetivo depende de la orientación de la mano,
 * y la orientación que se logra (dentro de los rangos de codo, antebrazo y
 * muñeca) puede no ser la pedida; las pasadas siguientes recolocan la
 * muñeca con la orientación realmente lograda para que la palma quede en
 * el punto.
 * Los huesos se acercan a sus objetivos con slerp (factor).
 */
function colocarBrazo(
  punto: THREE.Vector3,
  normal: THREE.Vector3 | null,
  orient: THREE.Quaternion | null,
  refs: HandBoneRefs,
  bindPoses: HandBindPoses,
  medidas: MedidasBrazo,
  calib: CalibracionMano,
  centroPalma: THREE.Vector3,
  cuerpoQ: THREE.Quaternion,
  factor: number,
  isLeftArm: boolean,
  debugInfo?: DebugIKInfo,
) {
  const rate = Math.min(1, factor * 2);

  // 1. Entrada del solver
  const chain = refs.armChain;
  chain.clavicle.updateWorldMatrix(true, false);
  chain.clavicle.getWorldPosition(_entradaBrazo.claviculaPos);
  if (chain.clavicle.parent) {
    chain.clavicle.parent.getWorldQuaternion(_entradaBrazo.padreClaviculaQ);
  } else {
    _entradaBrazo.padreClaviculaQ.identity();
  }
  _entradaBrazo.cuerpoQ.copy(cuerpoQ);
  chain.upperArm.updateWorldMatrix(true, false);
  chain.upperArm.getWorldPosition(_hombroPos);

  // 2. Orientación deseada de la mano (mundo)
  if (orient) {
    _manoDeseada.copy(orient);
  } else {
    // palma hacia el cuerpo (contra la normal); dedos hacia arriba salvo
    // que así la muñeca quede fuera de alcance o demasiado pegada al
    // hombro: entonces se elige, entre arriba, abajo, hacia el hombro,
    // lejos del hombro, al frente y atrás, la dirección más cómoda
    const n = normal ?? _normalDefecto.set(0, 0, 1).applyQuaternion(cuerpoQ);
    _palmaDir.copy(n).negate();
    const L = medidas.L1 + medidas.L2;
    // (el mínimo queda por encima del alcance con el codo al máximo, ~0.34 L)
    const comodoMin = 0.38 * L;
    const comodoMax = 0.92 * L;
    _lejos.copy(punto).sub(_hombroPos).normalize();
    // en orden de preferencia: arriba, atrás, lejos del hombro, hacia el
    // hombro, al frente y abajo (dedos hacia abajo es lo menos natural)
    const candidatos: THREE.Vector3[] = [
      _cand[0].set(0, 1, 0).applyQuaternion(cuerpoQ),
      _cand[1].set(0, 0, -1).applyQuaternion(cuerpoQ),
      _cand[2].copy(_lejos),
      _cand[3].copy(_lejos).negate(),
      _cand[4].set(0, 0, 1).applyQuaternion(cuerpoQ),
      _cand[5].set(0, -1, 0).applyQuaternion(cuerpoQ),
    ];
    const sesgo = [0, 0.02, 0.03, 0.04, 0.06, 0.1];
    // se evalúa cada dirección con el contacto en la palma y corrido hacia
    // las yemas (k), porque para un punto pegado al hombro conviene apuntar
    // los dedos hacia él y tocar con las yemas
    const largoPalma0 = centroPalma.length() / Math.hypot(0.55, 0.12);
    let mejor = Infinity;
    for (let i = 0; i < candidatos.length; i++) {
      const c = candidatos[i];
      // perpendicular a la palma
      _dedosPrueba.copy(c).addScaledVector(_palmaDir, -c.dot(_palmaDir));
      if (_dedosPrueba.lengthSq() < 0.05) continue;
      _dedosPrueba.normalize();
      cuaternionManoDesde(calib, _dedosPrueba, _palmaDir, _manoPrueba2);
      for (let k = 0; k <= 1.0001; k += 0.25) {
        _contacto.copy(centroPalma).addScaledVector(calib.dedos, k * largoPalma0);
        munecaParaPalma(punto, _manoPrueba2, _contacto, medidas.escala, _munecaPrueba);
        const d = _munecaPrueba.distanceTo(_hombroPos);
        // costo: salirse de la zona cómoda, tocar con la palma antes que con
        // los dedos, y un pequeño sesgo por orden de preferencia
        const fuera = Math.max(0, d - comodoMax) + Math.max(0, comodoMin - d);
        const costo = fuera * 10 + k * 0.15 + sesgo[i];
        if (costo < mejor) {
          mejor = costo;
          _dedosDir.copy(_dedosPrueba);
        }
      }
    }
    if (!isFinite(mejor)) _dedosDir.set(0, 1, 0).applyQuaternion(cuerpoQ);
    cuaternionManoDesde(calib, _dedosDir, _palmaDir, _manoDeseada);
  }

  // 3. Cuatro pasadas. La muñeca de cada pasada se calcula con la
  //    orientación que de verdad se logró en la anterior (ya dentro de los
  //    rangos), así la palma cae en el punto aunque la orientación exacta
  //    no sea alcanzable. Las dos primeras piden la orientación deseada;
  //    las dos últimas piden la lograda (punto fijo: máxima precisión de
  //    palma). En cada pasada el punto de contacto se corre de la palma
  //    hacia las yemas solo si con la palma la muñeca quedaría fuera de
  //    alcance o pegada al hombro (como al tocar la coronilla con los
  //    dedos). Se conserva la pasada con mejor suma de error de palma y de
  //    orientación.
  const largoPalma = centroPalma.length() / Math.hypot(0.55, 0.12);
  const alcance = medidas.L1 + medidas.L2;
  _manoLograda.copy(_manoDeseada);
  let mejorError = Infinity;
  for (let pasada = 0; pasada < 4; pasada++) {
    if (pasada === 2) _manoObjetivo.copy(_manoLograda);
    // Si la palma (con la orientación que se va a lograr) mira hacia fuera
    // de la superficie, lo que toca es el DORSO: el punto de contacto pasa
    // al otro lado del grosor de la mano; si no, la mano se hundiría en el
    // cuerpo. Se decide con la orientación lograda, no con la pedida, para
    // que la mano nunca quede dentro aunque la orientación no se alcance.
    _centroContacto.copy(centroPalma);
    if (normal) {
      _palmaMundo.copy(calib.palma).applyQuaternion(_manoLograda);
      if (_palmaMundo.dot(normal) > 0.3) {
        _centroContacto.addScaledVector(calib.palma, -2 * 0.12 * largoPalma);
      }
    }
    let mejorK = 0;
    let mejorFuera = Infinity;
    for (let k = 0; k <= 1.0001; k += 0.25) {
      _contacto.copy(_centroContacto).addScaledVector(calib.dedos, k * largoPalma);
      munecaParaPalma(punto, _manoLograda, _contacto, medidas.escala, _munecaPrueba);
      const d = _munecaPrueba.distanceTo(_hombroPos);
      const fuera = Math.max(0, d - 0.95 * alcance) + Math.max(0, 0.38 * alcance - d);
      if (fuera < mejorFuera - 1e-6) {
        mejorFuera = fuera;
        mejorK = k;
      }
      if (fuera === 0) break;
    }
    _contacto.copy(_centroContacto).addScaledVector(calib.dedos, mejorK * largoPalma);
    munecaParaPalma(punto, _manoLograda, _contacto, medidas.escala, _entradaBrazo.muneca);
    resolverBrazo(medidas, _entradaBrazo, _objetivosBrazo, _resultadoBrazo);
    _tClav.copy(_objetivosBrazo.clavicula);
    _tBrazo.copy(_objetivosBrazo.brazo);
    _tAntebrazo.copy(_objetivosBrazo.antebrazo);
    _tMano.copy(bindPoses.armChain.hand);
    resolverOrientacion(
      chain,
      bindPoses.armChain,
      _tClav,
      _tBrazo,
      _tAntebrazo,
      _tMano,
      pasada < 2 ? _manoDeseada : _manoObjetivo,
      isLeftArm,
      cuerpoQ,
    );
    _manoLograda
      .copy(_entradaBrazo.padreClaviculaQ)
      .multiply(_tClav)
      .multiply(_tBrazo)
      .multiply(_tAntebrazo)
      .multiply(_tMano);
    // palma predicha con lo logrado (la muñeca no cambia con la orientación)
    _palmaPredicha
      .copy(_contacto)
      .multiplyScalar(medidas.escala)
      .applyQuaternion(_manoLograda)
      .add(_resultadoBrazo.muneca);
    // Qué pesa más: si hay superficie (contacto) manda la palma en el
    // punto (1 cm ≈ 7° con orientación pedida; casi todo si es la de
    // defecto); en el espacio neutro, sin nada que tocar, manda la
    // orientación pedida (1 cm ≈ 1.5°).
    const errOr = 2 * Math.acos(Math.min(1, Math.abs(_manoLograda.dot(_manoDeseada))));
    const pesoOr = !orient ? 0.15 : normal ? 0.6 : 3.0;
    let err = _palmaPredicha.distanceTo(punto) * 8 + errOr * pesoOr;
    // Con orientación pedida y superficie, la palma lograda debe mirar hacia
    // el mismo lado que la pedida (hacia el cuerpo o hacia fuera): voltearla
    // cambia el sentido de la seña. Con la orientación por defecto no
    // importa: manda tocar el lugar (con la palma o con el dorso).
    if (normal && orient) {
      _palmaMundo.copy(calib.palma).applyQuaternion(_manoDeseada);
      const ladoPedido = Math.sign(_palmaMundo.dot(normal));
      _palmaMundo.copy(calib.palma).applyQuaternion(_manoLograda);
      if (Math.sign(_palmaMundo.dot(normal)) !== ladoPedido) err += 2.0;
    }
    if (err < mejorError) {
      mejorError = err;
      _mejorMunecaObj.copy(_entradaBrazo.muneca);
      _mejorClav.copy(_tClav);
      _mejorBrazoQ.copy(_tBrazo);
      _mejorAntebrazoQ.copy(_tAntebrazo);
      _mejorManoQ.copy(_tMano);
    }
  }

  chain.clavicle.quaternion.slerp(_mejorClav, rate);
  chain.upperArm.quaternion.slerp(_mejorBrazoQ, rate);
  chain.foreArm.quaternion.slerp(_mejorAntebrazoQ, rate);
  chain.hand.quaternion.slerp(_mejorManoQ, rate);

  if (debugInfo) {
    debugInfo.ubTarget.copy(punto);
    debugInfo.ikTarget.copy(_mejorMunecaObj);
    debugInfo.active = true;
    chain.hand.updateWorldMatrix(true, false);
    chain.hand.getWorldPosition(debugInfo.handWorldPos);
  }
}

// ── Debug sphere component ──────────────────────────────────────
// Uses useFrame to continuously sync with the mutated Vector3 ref,
// since R3F only copies the position prop on mount/reconciliation.

function DebugSphere({
  position,
  color,
}: {
  position: THREE.Vector3;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(position);
    }
  });
  return (
    <mesh ref={meshRef} renderOrder={10}>
      <sphereGeometry args={[0.04, 12, 12]} />
      <meshBasicMaterial
        color={color}
        depthTest={false}
        transparent
        opacity={0.95}
      />
    </mesh>
  );
}

// ── Main component ──────────────────────────────────────────────

export default function AvatarModel({
  ubLocation,
  rnm,
  autoRotate = false,
  showAllUBPoints = false,
  selectedUBCode: selectedUBCodeProp = null,
  ubRegionFilter = null,
  onUBClick,
  cm,
  orientation,
  handMode = "dominant",
  movementInterp,
  armAngles,
  armFKStateRef,
  autoSolveRequest,
}: AvatarModelProps) {
  // Load GLB model
  const gltf = useLoader(GLTFLoader, AVATAR_PATH, (loader) => {
    // MeshoptDecoder only needed for meshopt-compressed models (original wscharacter.glb)
    if (
      AVATAR_PATH.includes("wscharacter.glb") &&
      !AVATAR_PATH.includes("_new")
    ) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
  });
  const groupRef = useRef<THREE.Group>(null);

  // Clone the scene
  const clonedScene = useMemo(() => {
    const clone = cloneWithSkeleton(gltf.scene);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Ensure double-sided rendering
        const fixMaterial = (mat: THREE.Material): THREE.Material => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.side = THREE.DoubleSide;
          }
          return mat;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(fixMaterial);
        } else {
          mesh.material = fixMaterial(mesh.material);
        }
      }
    });

    // Center and scale
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = 2.5 / maxDim;

    clone.scale.setScalar(s);
    clone.position.set(-center.x * s, -center.y * s, -center.z * s);

    return clone;
  }, [gltf.scene]);

  // Build full bone map for O(1) lookup
  const boneMap = useMemo(() => buildBoneMap(clonedScene), [clonedScene]);

  // Find ALL meshes with morph targets. glTF splits the character into one
  // primitive per material (eyes / face skin / body), and three.js turns each
  // primitive into its own Mesh with its own morphTargetInfluences and
  // dictionary — animating only one of them freezes the rest of the face.
  const morphMeshesRef = useRef<THREE.Mesh[]>([]);
  useMemo(() => {
    const found: THREE.Mesh[] = [];
    clonedScene.traverse((child) => {
      if (
        (child as THREE.Mesh).isMesh &&
        (child as THREE.Mesh).morphTargetInfluences &&
        (child as THREE.Mesh).morphTargetInfluences!.length > 0
      ) {
        found.push(child as THREE.Mesh);
      }
    });
    morphMeshesRef.current = found;
  }, [clonedScene]);

  // Morph name → index mapping, per mesh (indices can differ per primitive)
  const morphMaps = useMemo<MorphMap[]>(() => {
    return morphMeshesRef.current.map((m) => buildMorphMap(m));
  }, [clonedScene]); // eslint-disable-line react-hooks/exhaustive-deps

  // Named bone references for head/neck animation
  const bones = useMemo(
    () => ({
      head: boneMap.get("Head") ?? null,
      neck: boneMap.get("Neck") ?? null,
    }),
    [boneMap],
  );

  // Store bind-pose quaternions for head/neck
  const bindPoses = useMemo(
    () => ({
      head: bones.head?.quaternion.clone() ?? new THREE.Quaternion(),
      neck: bones.neck?.quaternion.clone() ?? new THREE.Quaternion(),
    }),
    [bones],
  );

  // ── Hand bone refs + bind poses ──

  const leftHandRefs = useMemo(
    () => collectHandBones(boneMap, "left"),
    [boneMap],
  );
  const rightHandRefs = useMemo(
    () => collectHandBones(boneMap, "right"),
    [boneMap],
  );

  const leftHandBindPoses = useMemo(
    () => (leftHandRefs ? snapshotHandBindPoses(leftHandRefs) : null),
    [leftHandRefs],
  );
  const rightHandBindPoses = useMemo(
    () => (rightHandRefs ? snapshotHandBindPoses(rightHandRefs) : null),
    [rightHandRefs],
  );

  // ── Lugares (UB) sobre la malla, en bind, y su lector ──
  const anclasUB = useMemo(
    () => calcularAnclasUB(clonedScene, boneMap),
    [clonedScene, boneMap],
  );
  const lector = useMemo(() => new LectorUB(anclasUB, boneMap), [anclasUB, boneMap]);

  // ── Medidas del brazo para la IK (ejes, longitudes y bind) ──
  const medidasIzq = useMemo<MedidasBrazo | null>(
    () =>
      leftHandRefs && leftHandBindPoses
        ? medirBrazo(leftHandRefs.armChain, leftHandBindPoses.armChain, true)
        : null,
    [leftHandRefs, leftHandBindPoses],
  );
  const medidasDer = useMemo<MedidasBrazo | null>(
    () =>
      rightHandRefs && rightHandBindPoses
        ? medirBrazo(rightHandRefs.armChain, rightHandBindPoses.armChain, false)
        : null,
    [rightHandRefs, rightHandBindPoses],
  );

  // ── Debug IK state (for rendering debug spheres) ──
  const debugIK = useRef<DebugIKInfo>({
    ikTarget: new THREE.Vector3(),
    ubTarget: new THREE.Vector3(),
    handWorldPos: new THREE.Vector3(),
    active: false,
  });

  // ── Animation state refs (mutable) ──

  const leftAnimState = useRef<AnimState>(createAnimState());
  const rightAnimState = useRef<AnimState>(createAnimState());

  // ── Computed targets ──

  const targetPose = useMemo<HandPose>(() => {
    return cm ? cmEntryToHandPose(cm) : RESTING_POSE;
  }, [cm]);

  // Calibración de cada mano (ejes locales medidos en el modelo)
  const leftCalib = useMemo(
    () =>
      leftHandRefs && leftHandBindPoses
        ? calibrarMano(leftHandRefs, leftHandBindPoses)
        : null,
    [leftHandRefs, leftHandBindPoses],
  );
  const rightCalib = useMemo(
    () =>
      rightHandRefs && rightHandBindPoses
        ? calibrarMano(rightHandRefs, rightHandBindPoses)
        : null,
    [rightHandRefs, rightHandBindPoses],
  );

  // Centro de la palma en el espacio local de cada mano (para la IK)
  const centroPalmaIzq = useMemo(
    () =>
      leftHandRefs && leftCalib
        ? centroPalmaLocal(
            leftHandRefs.fingers.middle.carpal.position,
            leftCalib.palma,
            new THREE.Vector3(),
          )
        : null,
    [leftHandRefs, leftCalib],
  );
  const centroPalmaDer = useMemo(
    () =>
      rightHandRefs && rightCalib
        ? centroPalmaLocal(
            rightHandRefs.fingers.middle.carpal.position,
            rightCalib.palma,
            new THREE.Vector3(),
          )
        : null,
    [rightHandRefs, rightCalib],
  );

  // Rotación de mundo que pide la orientación, por mano
  const targetOrient = useMemo<THREE.Quaternion | null>(() => {
    if (!orientation || !leftCalib) return null;
    return cuaternionManoMundo(leftCalib, orientation.palm, orientation.fingers);
  }, [orientation, leftCalib]);

  // Mirror orientation for symmetric mode
  const mirroredOrient = useMemo<THREE.Quaternion | null>(() => {
    if (!orientation || !rightCalib) return null;
    const mirrored = mirrorOrientation(orientation);
    return cuaternionManoMundo(rightCalib, mirrored.palm, mirrored.fingers);
  }, [orientation, rightCalib]);

  // Compute target morph weights from RNM state — one index→weight map per mesh
  const targetMorphWeights = useMemo(() => {
    if (!rnm) return morphMaps.map(() => ({}) as Record<number, number>);
    return morphMaps.map((mm) => rnmToMorphWeights(rnm, mm));
  }, [rnm, morphMaps]);

  // Selected UB code (from props or 3D click)
  // Use explicit selectedUBCode prop if provided, otherwise fall back to ubLocation
  const selectedUBCode = selectedUBCodeProp ?? ubLocation?.code ?? null;

  // Handle 3D sphere click → propagate to parent
  const handleUBMarkerClick = useCallback(
    (code: string) => {
      onUBClick?.(code);
    },
    [onUBClick],
  );

  // ── Auto-solve processing (incremental FK solver — 1 code per frame) ──
  const autoSolveProcessedRef = useRef<AutoSolveRequest | null>(null);
  const autoSolveIndexRef = useRef(0);
  const autoSolveResultsRef = useRef<CapturedPose[]>([]);
  const autoSolveDoneRef = useRef(false);

  // Animation loop
  useFrame((rs, delta) => {
    if (!groupRef.current) return;
    groupRef.current.getWorldQuaternion(_cuerpoQ);
    // las esferas de depuración solo las enciende el modo FK de calibración
    debugIK.current.active = false;

    /** Palma de la mano izquierda (dominante) sobre un lugar, o null si no se puede */
    const brazoIzqA = (
      punto: THREE.Vector3,
      normal: THREE.Vector3 | null,
      orient: THREE.Quaternion | null,
      f: number,
    ) => {
      if (!leftHandRefs || !leftHandBindPoses || !medidasIzq || !leftCalib || !centroPalmaIzq)
        return false;
      colocarBrazo(
        punto,
        normal,
        orient,
        leftHandRefs,
        leftHandBindPoses,
        medidasIzq,
        leftCalib,
        centroPalmaIzq,
        _cuerpoQ,
        f,
        true,
      );
      return true;
    };
    /**
     * Brazo base (el que no seña) presentado al frente cuando el lugar está
     * sobre él: antebrazo cruzado frente al vientre, dedos hacia el lado
     * dominante y la palma hacia arriba si el lugar es del lado de la palma.
     */
    const presentarBrazoBase = (code: string, espejo: boolean, f: number) => {
      const refs = espejo ? leftHandRefs : rightHandRefs;
      const bind = espejo ? leftHandBindPoses : rightHandBindPoses;
      const medidas = espejo ? medidasIzq : medidasDer;
      const calib = espejo ? leftCalib : rightCalib;
      const centro = espejo ? centroPalmaIzq : centroPalmaDer;
      const spine = boneMap.get("Spine2");
      if (!refs || !bind || !medidas || !calib || !centro || !spine) return false;
      const lado = espejo ? -1 : 1; // lado dominante en X
      spine.updateWorldMatrix(true, false);
      spine.getWorldPosition(_baseObjetivo);
      _baseObjetivo.add(
        _lejos.set(lado * 0.05, -0.14, 0.34).applyQuaternion(_cuerpoQ),
      );
      // ¿el lugar está del lado de la palma? Se compara en mundo: la normal
      // del lugar (en su hueso, que puede ser una falange) contra la palma
      // de la mano base con su postura actual.
      const nMundo = lector.normal(code, espejo, _ubNormalB);
      refs.armChain.hand.updateWorldMatrix(true, false);
      refs.armChain.hand.getWorldQuaternion(_manoBaseQ);
      _palmaMundo.copy(calib.palma).applyQuaternion(_manoBaseQ);
      const palmaArriba = nMundo ? nMundo.dot(_palmaMundo) > 0.3 : false;
      _baseDedos.set(lado, 0, 0).applyQuaternion(_cuerpoQ);
      _basePalma.set(0, palmaArriba ? 1 : -1, 0).applyQuaternion(_cuerpoQ);
      cuaternionManoDesde(calib, _baseDedos, _basePalma, _baseOrient);
      colocarBrazo(
        _baseObjetivo,
        null,
        _baseOrient,
        refs,
        bind,
        medidas,
        calib,
        centro,
        _cuerpoQ,
        f,
        espejo,
      );
      return true;
    };
    const brazoDerA = (
      punto: THREE.Vector3,
      normal: THREE.Vector3 | null,
      orient: THREE.Quaternion | null,
      f: number,
    ) => {
      if (!rightHandRefs || !rightHandBindPoses || !medidasDer || !rightCalib || !centroPalmaDer)
        return false;
      colocarBrazo(
        punto,
        normal,
        orient,
        rightHandRefs,
        rightHandBindPoses,
        medidasDer,
        rightCalib,
        centroPalmaDer,
        _cuerpoQ,
        f,
        false,
      );
      return true;
    };

    // ─ AUTO-SOLVE: Process one UB code per frame to avoid freezing ─
    if (
      autoSolveRequest &&
      leftHandRefs &&
      leftHandBindPoses &&
      boneMap.size > 0
    ) {
      // New request: initialize
      if (autoSolveRequest !== autoSolveProcessedRef.current) {
        autoSolveProcessedRef.current = autoSolveRequest;
        autoSolveIndexRef.current = 0;
        autoSolveResultsRef.current = [];
        autoSolveDoneRef.current = false;
      }

      // Skip if already finalized (waiting for React to clear the request)
      if (!autoSolveDoneRef.current) {
        const idx = autoSolveIndexRef.current;
        if (idx < autoSolveRequest.codes.length) {
          const code = autoSolveRequest.codes[idx];

          const armRefs = {
            clavicle: leftHandRefs.armChain.clavicle,
            upperArm: leftHandRefs.armChain.upperArm,
            foreArm: leftHandRefs.armChain.foreArm,
            hand: leftHandRefs.armChain.hand,
          };
          const armBind = {
            clavicle: leftHandBindPoses.armChain.clavicle,
            upperArm: leftHandBindPoses.armChain.upperArm,
            foreArm: leftHandBindPoses.armChain.foreArm,
            hand: leftHandBindPoses.armChain.hand,
          };

          // Use surface-offset target so the hand touches the surface
          // instead of the centroid penetrating through the mesh.
          // 0.08 = 8cm outward along approximate surface normal.
          const ubWorldPos = computeUBWorldPositionWithSurfaceOffset(
            code,
            lector,
            0.08,
          );
          if (ubWorldPos) {
            const applyAndMeasure = (testAngles: ArmJointAngles): number => {
              applyArmFK(testAngles, armRefs, armBind, true);
              leftHandRefs.armChain.clavicle.updateWorldMatrix(true, true);
              const centroid = computeHandCentroidWorldPos(leftHandRefs);
              return centroid.distanceTo(ubWorldPos);
            };

            const { angles: solvedAngles, distance } =
              solveFKCoordinateDescent(applyAndMeasure);

            // Read hand world quaternion
            leftHandRefs.armChain.hand.getWorldQuaternion(_handWorldQ);

            autoSolveResultsRef.current.push({
              ubCode: code,
              angles: { ...solvedAngles },
              handWorldQuat: [
                _handWorldQ.x,
                _handWorldQ.y,
                _handWorldQ.z,
                _handWorldQ.w,
              ],
              distanceToUB: distance,
              timestamp: Date.now(),
            });

            // Restore bind pose after each solve
            armRefs.clavicle.quaternion.copy(armBind.clavicle);
            armRefs.upperArm.quaternion.copy(armBind.upperArm);
            armRefs.foreArm.quaternion.copy(armBind.foreArm);
            armRefs.hand.quaternion.copy(armBind.hand);
          }

          autoSolveIndexRef.current = idx + 1;

          // Report progress
          if (autoSolveRequest.onProgress) {
            autoSolveRequest.onProgress(autoSolveResultsRef.current.length);
          }
        } else {
          // All codes processed — finalize
          autoSolveDoneRef.current = true;
          const results = [...autoSolveResultsRef.current];
          autoSolveRequest.onComplete(results);
        }
      }
    }

    const clampedDelta = Math.min(delta, 0.05);
    const factor = 1 - Math.pow(1 - 0.08, clampedDelta * 60);
    const t = rs.clock.elapsedTime;

    // ─ RNM: Morph target animation (blendshapes) — every morph primitive ─
    for (let m = 0; m < morphMeshesRef.current.length; m++) {
      const influences = morphMeshesRef.current[m].morphTargetInfluences;
      if (!influences) continue;
      const targets = targetMorphWeights[m] ?? {};
      for (let i = 0; i < influences.length; i++) {
        const target = targets[i] ?? 0;
        influences[i] += (target - influences[i]) * factor * 3;
        if (Math.abs(influences[i]) < 0.001) influences[i] = 0;
      }
    }

    // ─ RNM: Head & Neck bone animation ─
    if (rnm && bones.head && bones.neck) {
      let headRx = 0,
        headRy = 0,
        headRz = 0;
      let neckRx = 0,
        neckRy = 0,
        neckRz = 0;

      switch (rnm.head) {
        case "NOD":
          headRx = Math.sin(t * 3) * 0.25;
          neckRx = Math.sin(t * 3) * 0.1;
          break;
        case "SHAKE":
          headRy = Math.sin(t * 4) * 0.3;
          neckRy = Math.sin(t * 4) * 0.1;
          break;
        case "TILT_LEFT":
          headRz = 0.25;
          neckRz = 0.08;
          break;
        case "TILT_RIGHT":
          headRz = -0.25;
          neckRz = -0.08;
          break;
        case "TILT_BACK":
          headRx = -0.3;
          neckRx = -0.1;
          break;
        case "TILT_DOWN":
          headRx = 0.3;
          neckRx = 0.1;
          break;
      }

      _headEuler.set(headRx, headRy, headRz, "XYZ");
      _headQuat.setFromEuler(_headEuler);
      _headQuat.premultiply(bindPoses.head);
      bones.head.quaternion.slerp(_headQuat, factor * 3);

      _neckEuler.set(neckRx, neckRy, neckRz, "XYZ");
      _neckQuat.setFromEuler(_neckEuler);
      _neckQuat.premultiply(bindPoses.neck);
      bones.neck.quaternion.slerp(_neckQuat, factor * 3);
    } else if (bones.head && bones.neck) {
      bones.head.quaternion.slerp(bindPoses.head, factor);
      bones.neck.quaternion.slerp(bindPoses.neck, factor);
    }

    // ─ Determine effective hand mode ─
    const effectiveHandMode = movementInterp?.handMode ?? handMode;

    // ─ UB BROWSE MODE ─
    if (showAllUBPoints && leftHandRefs && leftHandBindPoses) {
      // Con un lugar elegido, la palma va a ese punto (palma hacia el cuerpo)
      const puntoUB =
        ubLocation && lector.posicion(ubLocation.code, false, _ubPunto);
      if (puntoUB) {
        const n = lector.normal(ubLocation!.code, false, _ubNormal);
        if (!brazoIzqA(puntoUB, n, null, factor)) {
          poseArmDown(leftHandRefs.armChain, leftHandBindPoses.armChain, true, factor);
        }
        animateFingers(
          leftAnimState.current,
          targetPose,
          leftHandRefs,
          leftHandBindPoses,
          factor,
        );
      } else {
        poseArmDown(
          leftHandRefs.armChain,
          leftHandBindPoses.armChain,
          true,
          factor,
        );
        animateFingers(
          leftAnimState.current,
          RESTING_POSE,
          leftHandRefs,
          leftHandBindPoses,
          factor,
        );
      }
      if (!puntoUB) debugIK.current.active = false;

      if (rightHandRefs && rightHandBindPoses) {
        if (!(ubLocation && lector.esBrazoBase(ubLocation.code, false) && presentarBrazoBase(ubLocation.code, false, factor))) {
          poseArmDown(
            rightHandRefs.armChain,
            rightHandBindPoses.armChain,
            false,
            factor,
          );
        }
        animateFingers(
          rightAnimState.current,
          RESTING_POSE,
          rightHandRefs,
          rightHandBindPoses,
          factor,
        );
      }
    }
    // ─ LEFT ARM: FK mode (manual joint angles) ─
    else if (armAngles && leftHandRefs && leftHandBindPoses) {
      // Check if all FK angles are at default (zero) — use arms-down pose instead of T-pose
      const fkHasInput = Object.values(armAngles).some((v) => v !== 0);

      if (!fkHasInput) {
        // All sliders at zero → same arms-down neutral as other modes
        poseArmDown(
          leftHandRefs.armChain,
          leftHandBindPoses.armChain,
          true,
          factor,
        );
        animateFingers(
          leftAnimState.current,
          targetPose,
          leftHandRefs,
          leftHandBindPoses,
          factor,
        );
        debugIK.current.active = false;
      } else {
        // 1. Apply FK angles directly to arm bones
        applyArmFK(
          armAngles,
          {
            clavicle: leftHandRefs.armChain.clavicle,
            upperArm: leftHandRefs.armChain.upperArm,
            foreArm: leftHandRefs.armChain.foreArm,
            hand: leftHandRefs.armChain.hand,
          },
          {
            clavicle: leftHandBindPoses.armChain.clavicle,
            upperArm: leftHandBindPoses.armChain.upperArm,
            foreArm: leftHandBindPoses.armChain.foreArm,
            hand: leftHandBindPoses.armChain.hand,
          },
          true, // isLeftArm
        );

        // 2. Animate fingers normally
        animateFingers(
          leftAnimState.current,
          targetPose,
          leftHandRefs,
          leftHandBindPoses,
          factor,
        );

        // 3. Force full world matrix update from clavicle down through fingers
        leftHandRefs.armChain.clavicle.updateWorldMatrix(true, true);

        // 4. Compute FK state, debug spheres, and write to shared ref
        const centroidPos = computeHandCentroidWorldPos(leftHandRefs);
        const ubWorldPos = ubLocation
          ? computeUBWorldPosition(ubLocation.code, lector)
          : null;
        const dist = ubWorldPos ? centroidPos.distanceTo(ubWorldPos) : Infinity;

        leftHandRefs.armChain.hand.getWorldQuaternion(_handWorldQ);

        if (armFKStateRef) {
          armFKStateRef.current = {
            centroidWorldPos: [centroidPos.x, centroidPos.y, centroidPos.z],
            ubWorldPos: ubWorldPos
              ? [ubWorldPos.x, ubWorldPos.y, ubWorldPos.z]
              : null,
            distanceToUB: dist,
            reached: dist < 0.05, // 5cm threshold
            handWorldQuat: [
              _handWorldQ.x,
              _handWorldQ.y,
              _handWorldQ.z,
              _handWorldQ.w,
            ],
          };
        }

        // Debug spheres: Blue=UB (if selected), Green=centroid (always in FK mode)
        debugIK.current.ikTarget.copy(centroidPos);
        debugIK.current.active = true;
        if (ubWorldPos) {
          debugIK.current.ubTarget.copy(ubWorldPos);
        } else {
          // No UB selected — hide blue sphere by placing it far off-screen
          debugIK.current.ubTarget.set(0, -100, 0);
        }
      } // end fkHasInput else
    } else if (leftHandRefs && leftHandBindPoses) {
      // ─ LEFT ARM: Finger posing + Arm IK (dominant hand) ─
      if (
        movementInterp &&
        movementInterp.fromUBCode &&
        movementInterp.toUBCode
      ) {
        // ── MOVEMENT SEGMENT: Smooth interpolation ──
        const mt = movementInterp.t;

        // 1. Blend finger pose between from/to CM
        const fromPose = movementInterp.fromCM
          ? cmEntryToHandPose(movementInterp.fromCM)
          : RESTING_POSE;
        const toPose = movementInterp.toCM
          ? cmEntryToHandPose(movementInterp.toCM)
          : RESTING_POSE;
        const blendedPose = blendHandPoses(fromPose, toPose, mt);
        animateFingers(
          leftAnimState.current,
          blendedPose,
          leftHandRefs,
          leftHandBindPoses,
          factor,
        );

        // 2. Interpolate UB world position along contour path
        const fromPos = lector.posicion(movementInterp.fromUBCode, false, _ubPunto);
        const toPos = lector.posicion(movementInterp.toUBCode, false, _ubPuntoB);
        if (fromPos && toPos) {
          const fromArr: [number, number, number] = [fromPos.x, fromPos.y, fromPos.z];
          const toArr: [number, number, number] = [toPos.x, toPos.y, toPos.z];
          const interpArr = interpolateMovementPosition(
            fromArr,
            toArr,
            movementInterp.contour,
            movementInterp.plane,
            mt,
          );
          _interpPosVec.set(interpArr[0], interpArr[1], interpArr[2]);

          // normal de superficie mezclada (para la palma por defecto)
          const nFrom = lector.normal(movementInterp.fromUBCode, false, _ubNormal);
          const nTo = lector.normal(movementInterp.toUBCode, false, _ubNormalB);
          const nMix =
            nFrom && nTo ? _ubNormalMezcla.copy(nFrom).lerp(nTo, mt).normalize() : null;

          // 3. Blend hand orientation between from/to
          const blendedOrient = leftCalib
            ? mezclarOrientacion(
                leftCalib,
                movementInterp.fromOrientation,
                movementInterp.toOrientation,
                mt,
              )
            : null;

          brazoIzqA(_interpPosVec, nMix, blendedOrient, factor);

          // 4. Apply local movement overlays (after IK)
          if (movementInterp.local) {
            applyLocalMovement(leftHandRefs, movementInterp.local, mt, t);
          }
        }
      } else {
        // ── HOLD SEGMENT: Static position ──
        animateFingers(
          leftAnimState.current,
          targetPose,
          leftHandRefs,
          leftHandBindPoses,
          factor,
        );

        const puntoHold =
          ubLocation && lector.posicion(ubLocation.code, false, _ubPunto);
        if (puntoHold) {
          // La palma al lugar, con la orientación OR pedida (o hacia el cuerpo)
          const n = lector.normal(ubLocation!.code, false, _ubNormal);
          brazoIzqA(puntoHold, n, targetOrient, factor);
        } else {
          // No UB target — neutral arms-down pose
          poseArmDown(
            leftHandRefs.armChain,
            leftHandBindPoses.armChain,
            true,
            factor,
          );
          debugIK.current.active = false;
        }
      }
    }

    // ─ RIGHT ARM: Mirror for symmetric mode ─
    // (skip if already posed in UB browse mode above)
    if (showAllUBPoints) {
      // Already handled above
    } else if (
      effectiveHandMode === "both_symmetric" &&
      rightHandRefs &&
      rightHandBindPoses
    ) {
      if (
        movementInterp &&
        movementInterp.fromUBCode &&
        movementInterp.toUBCode
      ) {
        // ── MOVEMENT SEGMENT: Mirrored smooth interpolation ──
        const mt = movementInterp.t;

        const fromPose = movementInterp.fromCM
          ? cmEntryToHandPose(movementInterp.fromCM)
          : RESTING_POSE;
        const toPose = movementInterp.toCM
          ? cmEntryToHandPose(movementInterp.toCM)
          : RESTING_POSE;
        const blendedPose = blendHandPoses(fromPose, toPose, mt);
        animateFingers(
          rightAnimState.current,
          blendedPose,
          rightHandRefs,
          rightHandBindPoses,
          factor,
        );

        const fromPos = lector.posicion(movementInterp.fromUBCode, true, _ubPunto);
        const toPos = lector.posicion(movementInterp.toUBCode, true, _ubPuntoB);
        if (fromPos && toPos) {
          const fromArr: [number, number, number] = [fromPos.x, fromPos.y, fromPos.z];
          const toArr: [number, number, number] = [toPos.x, toPos.y, toPos.z];
          const interpArr = interpolateMovementPosition(
            fromArr,
            toArr,
            movementInterp.contour,
            movementInterp.plane,
            mt,
          );
          _interpPosVec.set(interpArr[0], interpArr[1], interpArr[2]);

          const nFrom = lector.normal(movementInterp.fromUBCode, true, _ubNormal);
          const nTo = lector.normal(movementInterp.toUBCode, true, _ubNormalB);
          const nMix =
            nFrom && nTo ? _ubNormalMezcla.copy(nFrom).lerp(nTo, mt).normalize() : null;

          const blendedOrientR = rightCalib
            ? mezclarOrientacion(
                rightCalib,
                mirrorOrientation(movementInterp.fromOrientation),
                mirrorOrientation(movementInterp.toOrientation),
                mt,
              )
            : null;

          brazoDerA(_interpPosVec, nMix, blendedOrientR, factor);

          if (movementInterp.local) {
            applyLocalMovement(rightHandRefs, movementInterp.local, mt, t);
          }
        }
      } else {
        // ── HOLD SEGMENT: Static mirrored ──
        animateFingers(
          rightAnimState.current,
          targetPose,
          rightHandRefs,
          rightHandBindPoses,
          factor,
        );

        const puntoHoldR =
          ubLocation && lector.posicion(ubLocation.code, true, _ubPunto);
        if (puntoHoldR) {
          const n = lector.normal(ubLocation!.code, true, _ubNormal);
          brazoDerA(puntoHoldR, n, mirroredOrient, factor);
        } else {
          // No UB target — neutral arms-down pose
          poseArmDown(
            rightHandRefs.armChain,
            rightHandBindPoses.armChain,
            false,
            factor,
          );
        }
      }
    } else if (rightHandRefs && rightHandBindPoses) {
      // Una mano: el brazo derecho descansa, salvo que el lugar esté sobre
      // él (entonces se presenta al frente para que la otra mano lo toque)
      const codigoBase =
        movementInterp?.toUBCode && lector.esBrazoBase(movementInterp.toUBCode, false)
          ? movementInterp.toUBCode
          : movementInterp?.fromUBCode && lector.esBrazoBase(movementInterp.fromUBCode, false)
            ? movementInterp.fromUBCode
            : ubLocation && !movementInterp && lector.esBrazoBase(ubLocation.code, false)
              ? ubLocation.code
              : null;
      if (!(codigoBase && presentarBrazoBase(codigoBase, false, factor))) {
        poseArmDown(
          rightHandRefs.armChain,
          rightHandBindPoses.armChain,
          false,
          factor,
        );
      }
      animateFingers(
        rightAnimState.current,
        RESTING_POSE,
        rightHandRefs,
        rightHandBindPoses,
        factor,
      );
    }

    // ─ Auto-rotate ─
    if (autoRotate) {
      groupRef.current.rotation.y += clampedDelta * 0.3;
    }
  });

  // Snapshot debug positions for rendering (avoid creating new objects per frame)
  const dbg = debugIK.current;

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
      {/* All 80 interactive UB spheres */}
      {showAllUBPoints && (
        <UBPointCloud
          lector={lector}
          selectedCode={selectedUBCode}
          regionFilter={ubRegionFilter}
          onMarkerClick={handleUBMarkerClick}
        />
      )}
      {/* Debug spheres: Blue=UB target, Green=hand centroid */}
      {dbg.active && (
        <>
          <DebugSphere position={dbg.ubTarget} color="#3b82f6" />
          <DebugSphere position={dbg.ikTarget} color="#22c55e" />
        </>
      )}
    </group>
  );
}
