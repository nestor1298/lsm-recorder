"use client";

/**
 * EsqueletoMP3D — esqueleto 3D alámbrico que reconstruye lo detectado
 * por MediaPipe: misma topología que el overlay del video (pose 33 pts
 * + manos 21 pts), con las manos injertadas en las muñecas de la pose
 * (ver src/lib/vision/pose3d.ts). Órbita libre con el cursor.
 */

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  frameAt,
  frameBounds,
  type P3,
  type Pose3DTrack,
} from "@/lib/vision/pose3d";
import {
  POSE_CONNECTIONS,
  HAND_CONNECTIONS,
} from "@/lib/vision/connections";

function cssColor(v: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(v).trim() ||
    fallback
  );
}

const V = (p: P3) => new THREE.Vector3(p.x, p.y, p.z);

function Wire({
  a,
  b,
  color,
  r,
}: {
  a: P3;
  b: P3;
  color: string;
  r: number;
}) {
  const va = V(a);
  const vb = V(b);
  const len = va.distanceTo(vb);
  if (!isFinite(len) || len < 1e-6) return null;
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    vb.clone().sub(va).normalize(),
  );
  return (
    <mesh position={[mid.x, mid.y, mid.z]} quaternion={[q.x, q.y, q.z, q.w]}>
      <capsuleGeometry args={[r, Math.max(0.001, len - r), 3, 6]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function Points({
  pts,
  color,
  r,
}: {
  pts: P3[];
  color: string;
  r: number;
}) {
  return (
    <>
      {pts.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[r, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </>
  );
}

function Rig({
  track,
  timeMs,
}: {
  track: Pose3DTrack;
  timeMs: number;
}) {
  const { camera, invalidate } = useThree();
  const colors = useMemo(
    () => ({
      accent: cssColor("--color-accent", "#2B5BF7"),
      green: cssColor("--color-green", "#00A878"),
      ink: cssColor("--color-ink", "#0B0B0C"),
    }),
    [],
  );
  const fr = useMemo(() => frameAt(track, timeMs), [track, timeMs]);

  // Encuadre inicial a partir del primer cuadro con datos
  const bounds = useMemo(
    () => (track.frames[0] ? frameBounds(track.frames[0]) : null),
    [track],
  );
  useEffect(() => {
    if (!bounds) return;
    const d = bounds.radius * 3.2;
    camera.position.set(bounds.center.x, bounds.center.y + d * 0.15, d);
    camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
    invalidate();
  }, [bounds, camera, invalidate]);

  if (!fr) return null;
  const poseR = 0.008;
  const handR = 0.004;

  return (
    <>
      <OrbitControls
        makeDefault
        target={
          bounds
            ? [bounds.center.x, bounds.center.y, bounds.center.z]
            : [0, 0, 0]
        }
        enablePan={false}
      />
      {/* Pose */}
      {POSE_CONNECTIONS.map(([i, j]) =>
        fr.pose[i] && fr.pose[j] ? (
          <Wire
            key={`p-${i}-${j}`}
            a={fr.pose[i]}
            b={fr.pose[j]}
            color={colors.ink}
            r={poseR * 0.5}
          />
        ) : null,
      )}
      <Points pts={fr.pose.slice(11)} color={colors.accent} r={poseR} />
      {/* Manos */}
      {(["left", "right"] as const).map((side) => {
        const h = fr[side];
        if (!h) return null;
        const c = side === "right" ? colors.green : colors.accent;
        return (
          <group key={side}>
            {HAND_CONNECTIONS.map(([i, j]) =>
              h[i] && h[j] ? (
                <Wire
                  key={`${side}-${i}-${j}`}
                  a={h[i]}
                  b={h[j]}
                  color={c}
                  r={handR * 0.55}
                />
              ) : null,
            )}
            <Points pts={h} color={c} r={handR} />
          </group>
        );
      })}
    </>
  );
}

export interface EsqueletoMP3DProps {
  track: Pose3DTrack | null;
  timeMs: number;
  className?: string;
}

export default function EsqueletoMP3D({
  track,
  timeMs,
  className = "",
}: EsqueletoMP3DProps) {
  const [webgl, setWebgl] = useState(true);
  useEffect(() => {
    const c = document.createElement("canvas");
    setWebgl(Boolean(c.getContext("webgl2") ?? c.getContext("webgl")));
  }, []);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-gray-200 bg-paper ${className}`}
    >
      <div className="relative aspect-square w-full">
        {!track || track.frames.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500">
            Sube y analiza un video para reconstruir aquí el esqueleto en 3D.
          </div>
        ) : !webgl ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500">
            Tu navegador no puede mostrar 3D.
          </div>
        ) : (
          <Canvas
            frameloop="always"
            dpr={[1, 2]}
            camera={{ fov: 40, near: 0.01, far: 20 }}
            gl={{ antialias: true }}
          >
            <Rig track={track} timeMs={timeMs} />
          </Canvas>
        )}
      </div>
      <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
        Esqueleto reconstruido del video (MediaPipe 3D). Arrastra para girar,
        rueda para acercar.
      </p>
    </div>
  );
}
