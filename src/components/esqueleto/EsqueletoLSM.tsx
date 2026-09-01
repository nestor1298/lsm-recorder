"use client";

/**
 * EsqueletoLSM — recuadro 3D que posa un esqueleto procedural SOLO a
 * partir de las matrices anotadas (poseAtTime). Nada viene de los
 * landmarks del video: si la anotación está mal, el muñeco se ve mal —
 * esa es su función.
 *
 * Procedural con R3F (three ya vive en el bundle por el visor de Lexsi).
 * frameloop="demand": solo re-renderiza cuando cambia la pose.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SignAnnotation } from "@/lib/types";
import {
  poseAtTime,
  SKEL,
  type ArmPose,
  type SkeletonPose,
} from "@/lib/skeleton/pose_at_time";
import type { HandPose, FingerPose } from "@/lib/skeleton/cm_kinematics";
import { describeSegmentPose } from "@/lib/anotar_labels";

// ── Tokens de marca → colores three (leídos del tema en runtime) ─

function cssColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return v || fallback;
}

function useBrandColors() {
  return useMemo(
    () => ({
      paper: cssColor("--color-paper", "#FFFFFF"),
      ink: cssColor("--color-ink", "#0B0B0C"),
      accent: cssColor("--color-accent", "#2B5BF7"),
      green: cssColor("--color-green", "#00A878"),
      greenTint: cssColor("--color-green-tint", "#D9F2EA"),
    }),
    [],
  );
}

// ── Piezas geométricas ──────────────────────────────────────────

function Bone({
  from,
  to,
  radius,
  color,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  radius: number;
  color: string;
}) {
  // Transform declarativo (sin efectos): garantiza el primer frame.
  const len = from.distanceTo(to);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    to.clone().sub(from).normalize(),
  );
  return (
    <mesh
      position={[mid.x, mid.y, mid.z]}
      quaternion={[quat.x, quat.y, quat.z, quat.w]}
    >
      <capsuleGeometry args={[radius, Math.max(0.001, len - radius), 4, 10]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Joint({
  at,
  r,
  color,
}: {
  at: THREE.Vector3;
  r: number;
  color: string;
}) {
  return (
    <mesh position={at}>
      <sphereGeometry args={[r, 12, 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// ── Mano: paleta + 5 dedos × falanges, desde HandPose ───────────

const FINGER_OFFSETS: { key: keyof HandPose; x: number }[] = [
  { key: "index", x: 0.028 },
  { key: "middle", x: 0.01 },
  { key: "ring", x: -0.008 },
  { key: "pinky", x: -0.026 },
];
const PHALANX_LEN = [0.032, 0.024, 0.018];

function Finger({
  pose,
  x,
  side,
  color,
}: {
  pose: FingerPose;
  x: number;
  side: "L" | "R";
  color: string;
}) {
  const sx = side === "R" ? 1 : -1;
  const spread = pose.carpalSpread * sx * 2;
  const seg = (i: number, flex: number, children?: React.ReactNode) => (
    <group rotation={[flex, 0, i === 0 ? spread : 0]}>
      <mesh position={[0, PHALANX_LEN[i] / 2, 0]}>
        <capsuleGeometry args={[0.0055, PHALANX_LEN[i] - 0.008, 3, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <group position={[0, PHALANX_LEN[i], 0]}>{children}</group>
    </group>
  );
  return (
    <group position={[x * sx, 0.078, 0]} rotation={[pose.carpalFlex, 0, 0]}>
      {seg(0, pose.mcpFlex, seg(1, pose.pipFlex, seg(2, pose.dipFlex)))}
    </group>
  );
}

function Thumb({
  pose,
  side,
  color,
}: {
  pose: HandPose["thumb"];
  side: "L" | "R";
  color: string;
}) {
  const sx = side === "R" ? 1 : -1;
  return (
    <group
      position={[0.038 * sx, 0.02, 0.01]}
      rotation={[pose.cmcOpposition, pose.cmcRotation * sx, -0.6 * sx]}
    >
      <group rotation={[pose.mcpFlex, 0, 0]}>
        <mesh position={[0, 0.016, 0]}>
          <capsuleGeometry args={[0.0065, 0.022, 3, 6]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <group position={[0, 0.032, 0]} rotation={[pose.ipFlex, 0, 0]}>
          <mesh position={[0, 0.011, 0]}>
            <capsuleGeometry args={[0.0055, 0.014, 3, 6]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Hand({
  arm,
  side,
  color,
}: {
  arm: ArmPose;
  side: "L" | "R";
  color: string;
}) {
  const q = arm.wristQuat;
  return (
    <group
      position={[arm.wrist.x, arm.wrist.y, arm.wrist.z]}
      quaternion={[q.x, q.y, q.z, q.w]}
    >
      {/* palma */}
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[0.075, 0.075, 0.022]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {FINGER_OFFSETS.map(({ key, x }) => (
        <Finger
          key={key}
          pose={arm.hand[key] as FingerPose}
          x={x}
          side={side}
          color={color}
        />
      ))}
      <Thumb pose={arm.hand.thumb} side={side} color={color} />
    </group>
  );
}

// ── Cara (RNM básico) ───────────────────────────────────────────

function Face({ pose, ink }: { pose: SkeletonPose; ink: string }) {
  const browY =
    pose.eyebrows === "RAISED" ? 0.02 : pose.eyebrows === "FURROWED" ? -0.012 : 0;
  const mouthScale =
    pose.mouth === "OPEN"
      ? 1.6
      : pose.mouth === "ROUNDED"
        ? 0.9
        : pose.mouth === "STRETCHED"
          ? 2
          : 1;
  const hc = SKEL.headCenter;
  return (
    <group
      position={[hc.x, hc.y, hc.z]}
      rotation={[pose.headTilt.x, 0, pose.headTilt.z]}
    >
      {[-0.038, 0.038].map((x) => (
        <mesh key={x} position={[x, 0.03 + browY, SKEL.headRadius - 0.005]}>
          <torusGeometry args={[0.016, 0.004, 6, 10, Math.PI * 0.7]} />
          <meshStandardMaterial color={ink} />
        </mesh>
      ))}
      <mesh
        position={[0, -0.045, SKEL.headRadius - 0.004]}
        rotation={[0, 0, Math.PI]}
        scale={[mouthScale, pose.mouth === "OPEN" ? 1.5 : 1, 1]}
      >
        <torusGeometry args={[0.018, 0.004, 6, 10, Math.PI * 0.8]} />
        <meshStandardMaterial color={ink} />
      </mesh>
    </group>
  );
}

// ── Escena ──────────────────────────────────────────────────────

function SkeletonScene({
  pose,
  lateral,
}: {
  pose: SkeletonPose;
  lateral: boolean;
}) {
  const colors = useBrandColors();
  const { camera, invalidate } = useThree();

  useEffect(() => {
    if (lateral) camera.position.set(1.05, 0.28, 0.2);
    else camera.position.set(0, 0.25, 1.15);
    camera.lookAt(0, 0.06, 0);
    invalidate();
  }, [lateral, camera, invalidate]);

  const V = (v: { x: number; y: number; z: number }) =>
    new THREE.Vector3(v.x, v.y, v.z);
  const hc = SKEL.headCenter;

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[1, 2, 2]} intensity={0.9} />
      {/* tronco y cabeza */}
      <mesh position={[0, -0.08, 0]}>
        <capsuleGeometry args={[0.15, 0.3, 4, 12]} />
        <meshStandardMaterial color={colors.ink} />
      </mesh>
      <group rotation={[pose.headTilt.x, 0, pose.headTilt.z]}>
        <mesh position={[hc.x, hc.y, hc.z]}>
          <sphereGeometry args={[SKEL.headRadius, 16, 16]} />
          <meshStandardMaterial color={colors.ink} />
        </mesh>
      </group>
      <Face pose={pose} ink={colors.paper} />
      {/* brazos */}
      {(["left", "right"] as const).map((sideKey) => {
        const arm = pose[sideKey];
        const side = sideKey === "right" ? "R" : "L";
        const handColor = sideKey === "right" ? colors.green : colors.greenTint;
        return (
          <group key={sideKey}>
            <Bone
              from={V(arm.shoulder)}
              to={V(arm.elbow)}
              radius={0.028}
              color={colors.ink}
            />
            <Bone
              from={V(arm.elbow)}
              to={V(arm.wrist)}
              radius={0.024}
              color={colors.ink}
            />
            <Joint at={V(arm.shoulder)} r={0.032} color={colors.accent} />
            <Joint at={V(arm.elbow)} r={0.026} color={colors.accent} />
            <Joint at={V(arm.wrist)} r={0.02} color={colors.accent} />
            <Hand arm={arm} side={side} color={handColor} />
          </group>
        );
      })}
    </>
  );
}

// ── Componente público ──────────────────────────────────────────

export interface EsqueletoLSMProps {
  annotation: SignAnnotation;
  /** tiempo actual en ms (controlado por el padre: video o scrubber) */
  timeMs: number;
  /** duración total para el scrubber propio (sin video) */
  durationMs?: number;
  /** si true, muestra scrubber + botón Ver (modo sin video) */
  standalone?: boolean;
  onTimeChange?: (ms: number) => void;
  className?: string;
}

export default function EsqueletoLSM({
  annotation,
  timeMs,
  durationMs = 1000,
  standalone = false,
  onTimeChange,
  className = "",
}: EsqueletoLSMProps) {
  const [lateral, setLateral] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef(0);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const c = document.createElement("canvas");
    setWebgl(Boolean(c.getContext("webgl2") ?? c.getContext("webgl")));
  }, []);

  // bucle "Ver" en modo standalone: el efecto captura el tiempo actual y
  // avanza un frame; al notificar onTimeChange cambia timeMs y el efecto
  // se re-crea, continuando desde ahí (sin refs mutados en render).
  useEffect(() => {
    if (!playing || !onTimeChange) return;
    const started = performance.now();
    rafRef.current = requestAnimationFrame((now) => {
      const dt = (now - started) * speed;
      onTimeChange((timeMs + dt) % durationMs);
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, speed, durationMs, onTimeChange, timeMs]);

  const pose = useMemo(
    () => poseAtTime(annotation, timeMs),
    [annotation, timeMs],
  );

  const activeSeg = useMemo(() => {
    const segs = [...annotation.segments].sort((a, b) => a.start_ms - b.start_ms);
    return (
      segs.find((s) => timeMs >= s.start_ms && timeMs <= s.end_ms) ??
      segs[segs.length - 1]
    );
  }, [annotation.segments, timeMs]);

  const descripcion = describeSegmentPose(activeSeg, annotation.dominant_hand);

  const toggleView = useCallback(() => setLateral((l) => !l), []);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-gray-200 bg-paper ${className}`}
    >
      <div className="relative aspect-square w-full" aria-label={descripcion} role="img">
        {webgl ? (
          // Posición inicial en el prop: R3F aplica `camera` después de
          // los efectos hijos, así que fijarla solo en un useEffect deja
          // el primer frame con la cámara default (z=5, en el far plane).
          <Canvas
            frameloop="always"
            dpr={[1, 2]}
            camera={{
              fov: 35,
              near: 0.05,
              far: 10,
              position: [0, 0.25, 1.15],
            }}
            gl={{ antialias: true }}
          >
            <SkeletonScene pose={pose} lateral={lateral} />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500">
            Tu navegador no puede mostrar el modelo 3D. La descripción de la
            pose: {descripcion}.
          </div>
        )}
        <button
          onClick={toggleView}
          className="absolute right-2 top-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
        >
          {lateral ? "Vista frontal" : "Vista lateral"}
        </button>
      </div>

      {/* Descripción textual (lectores de pantalla y validación humana) */}
      <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
        {descripcion}
      </p>

      {standalone && (
        <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-2">
          {!reducedMotion && (
            <button
              onClick={() => setPlaying((p) => !p)}
              className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper hover:bg-gray-800"
            >
              {playing ? "Pausar" : "Ver"}
            </button>
          )}
          <input
            type="range"
            min={0}
            max={durationMs}
            value={timeMs}
            onChange={(e) => {
              setPlaying(false);
              onTimeChange?.(Number(e.target.value));
            }}
            aria-label="Momento de la seña"
            className="flex-1 accent-[var(--color-accent,#2B5BF7)]"
          />
          <button
            onClick={() => setSpeed((s) => (s === 1 ? 0.5 : 1))}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          >
            {speed === 1 ? "1×" : "0.5×"}
          </button>
        </div>
      )}
    </div>
  );
}
