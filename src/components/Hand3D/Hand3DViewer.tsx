"use client";

import React, { Suspense, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment } from "@react-three/drei";

/** Instancia de los controles de órbita (tipo derivado del propio drei). */
type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>;
import type { CMEntry } from "@/lib/types";
import type {
  ArmJointAngles,
  ArmFKState,
  AutoSolveRequest,
} from "@/lib/arm_fk";
import RiggedHand from "./RiggedHand";
import AvatarModel from "./AvatarModel";
import type { UBTarget, RNMTarget, MovementInterpolation } from "./AvatarModel";

function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#818cf8" wireframe />
    </mesh>
  );
}

interface Hand3DViewerProps {
  cm: CMEntry | null;
  className?: string;
  height?: string;
  autoRotate?: boolean;
  /** Cámara fija: el modelo no gira solo ni con el cursor */
  fija?: boolean;
  /** Sin esquinas redondeadas ni degradado (visor a pantalla completa) */
  sinMarco?: boolean;
  /** "torso" encuadra de la cadera a la coronilla, donde ocurre la seña */
  encuadre?: "cuerpo" | "torso";
  /**
   * Fracción del visor tapada por paneles encimados (0–1 por lado). Con
   * encuadre "torso", la cámara centra y ajusta al avatar en lo que queda
   * libre para que los paneles no le tapen las manos.
   */
  tapado?: Tapado;
  orientation?: { palm: string; fingers: string };
  movement?: { contour: string; local: string | null; plane: string };
  /** When set, shows full-body avatar instead of hand */
  activeChannel?: string;
  ubLocation?: UBTarget | null;
  rnm?: RNMTarget | null;
  /** Selected UB code for point cloud highlighting (separate from IK target) */
  selectedUBCode?: string | null;
  /** Show all 80 UB points as interactive spheres */
  showAllUBPoints?: boolean;
  /** Filter spheres by region */
  ubRegionFilter?: string | null;
  /** Callback when a UB sphere is clicked on the 3D avatar */
  onUBClick?: (code: string) => void;
  /** Build mode: always show avatar instead of isolated hand */
  isBuildMode?: boolean;
  /** Siempre el avatar: el modelo de la mano aislada queda descartado */
  forceAvatar?: boolean;
  /** Hand mode for avatar posing */
  handMode?: "dominant" | "both_symmetric";
  /** Movement interpolation data for smooth M-segment animation */
  movementInterp?: MovementInterpolation | null;
  /** Manual FK joint angles — when provided, bypasses IK for left arm */
  armAngles?: ArmJointAngles | null;
  /** Shared ref for FK state reporting (centroid pos, UB distance, etc.) */
  armFKStateRef?: React.MutableRefObject<ArmFKState | null>;
  /** Auto-solve request for batch FK solving */
  autoSolveRequest?: AutoSolveRequest | null;
}

/** Centro (mundo) del espacio de la seña en Lexsi: del vientre (≈ 0.15)
 *  a la coronilla (≈ 1.23), donde caen los lugares del cuerpo. */
const MIRA_TORSO_Y = 0.75;
/** Lo que debe verse completo del torso (mundo): alto y ancho con brazos. */
const TORSO_ALTO = 1.35;
const TORSO_ANCHO = 1.3;

export interface Tapado {
  izq: number;
  der: number;
  arr: number;
  aba: number;
  /** Bloque en la esquina superior izquierda (fracciones de ancho y alto):
   *  se trata como franja de arriba o de la izquierda, lo que deje más
   *  grande al avatar. */
  esquina?: { ancho: number; alto: number };
}

const _objetivoTorso = new THREE.Vector3();
const _miraFija = new THREE.Vector3();
const _desplazamiento = new THREE.Vector3();

/**
 * Cámara del encuadre torso: coloca el torso completo y centrado en el
 * rectángulo que no tapan los paneles, con transición suave al abrir o
 * cerrar un panel. Convive con la órbita: el usuario gira (arrastrar) y
 * acerca (rueda o pellizco) alrededor de ese centro; aquí solo se mueve
 * el punto de mira y se escala la distancia base, así que su ángulo y su
 * acercamiento relativo se conservan.
 */
function EncuadreTorso({
  tapado,
  controles,
}: {
  tapado?: Tapado;
  controles: React.RefObject<OrbitControlsImpl | null>;
}) {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const size = useThree((st) => st.size);
  const primera = useRef(true);
  const distanciaBase = useRef(0);

  useFrame((_, delta) => {
    const base = tapado ?? { izq: 0, der: 0, arr: 0, aba: 0 };
    const aspecto = size.width / Math.max(1, size.height);
    // alto visible total para que el torso quepa en la parte libre
    const altoPara = (t: Tapado) =>
      Math.max(
        TORSO_ALTO / Math.max(0.25, 1 - t.arr - t.aba),
        TORSO_ANCHO / (Math.max(0.25, 1 - t.izq - t.der) * aspecto),
      );
    let t = base;
    if (base.esquina) {
      const comoIzq = { ...base, izq: Math.max(base.izq, base.esquina.ancho) };
      const comoArr = { ...base, arr: Math.max(base.arr, base.esquina.alto) };
      t = altoPara(comoArr) <= altoPara(comoIzq) ? comoArr : comoIzq;
    }
    const altoVisible = altoPara(t);
    const distancia = altoVisible / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const anchoVisible = altoVisible * aspecto;
    // mover la mira hacia lo tapado deja al avatar en el centro de lo libre
    const x = ((t.der - t.izq) / 2) * anchoVisible;
    const y = MIRA_TORSO_Y - ((t.aba - t.arr) / 2) * altoVisible;
    _objetivoTorso.set(x, y, 0);

    const k = primera.current ? 1 : 1 - Math.exp(-delta * 8);
    const ctl = controles.current;
    // sin controles (cámara fija) la mira vive en un vector propio
    const mira = ctl ? ctl.target : _miraFija;

    if (primera.current) {
      mira.copy(_objetivoTorso);
      camera.position.set(x, y, distancia);
      distanciaBase.current = distancia;
    } else {
      // dirección y acercamiento relativo actuales (los puso el usuario)
      _desplazamiento.copy(camera.position).sub(mira);
      const actual = _desplazamiento.length() || distancia;
      const nuevaBase =
        distanciaBase.current + (distancia - distanciaBase.current) * k;
      const escala = distanciaBase.current > 0 ? nuevaBase / distanciaBase.current : 1;
      distanciaBase.current = nuevaBase;
      mira.lerp(_objetivoTorso, k);
      camera.position
        .copy(mira)
        .addScaledVector(_desplazamiento.normalize(), actual * escala);
    }
    primera.current = false;
    camera.lookAt(mira);
    // drei ya llama controls.update() en su propio useFrame (prioridad −1)
  });
  return null;
}

export default function Hand3DViewer({
  cm,
  className = "",
  height = "400px",
  autoRotate = true,
  orientation,
  movement,
  movementInterp,
  activeChannel,
  ubLocation,
  selectedUBCode,
  rnm,
  showAllUBPoints,
  ubRegionFilter,
  onUBClick,
  isBuildMode = false,
  handMode,
  armAngles,
  armFKStateRef,
  autoSolveRequest,
  forceAvatar,
  fija = false,
  sinMarco = false,
  encuadre = "cuerpo",
  tapado,
}: Hand3DViewerProps) {
  // Show avatar in build mode always, or in explore mode for UB/RNM/FK channels
  const showAvatar =
    forceAvatar ||
    isBuildMode ||
    activeChannel === "ub" ||
    activeChannel === "rnm" ||
    activeChannel === "fk";
  // For avatar channels, pull camera back and look at full body
  const torso = showAvatar && encuadre === "torso";
  const cameraPosition: [number, number, number] = torso
    ? [0, MIRA_TORSO_Y, 2.9]
    : showAvatar
      ? [0, 0.3, 4.5]
      : [0, 0.5, 3.5];
  const cameraFov = torso ? 30 : showAvatar ? 40 : 35;
  const girar = autoRotate && !fija;
  const controles = useRef<OrbitControlsImpl | null>(null);

  return (
    <div
      className={`relative overflow-hidden ${sinMarco ? "" : "rounded-2xl"} ${className}`}
      style={{ height }}
    >
      <Canvas
        camera={{ position: cameraPosition, fov: cameraFov }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        shadows
      >
        {/* 3-point lighting rig */}
        <directionalLight
          position={[4, 5, 4]}
          intensity={1.8}
          color="#fff5e6"
          castShadow
        />
        <directionalLight
          position={[-3, 3, -2]}
          intensity={0.6}
          color="#c8d8ff"
        />
        <directionalLight
          position={[0, 2, -5]}
          intensity={0.5}
          color="#a78bfa"
        />
        <ambientLight intensity={0.35} color="#f0e8f8" />

        <Suspense fallback={<LoadingFallback />}>
          {showAvatar ? (
            <AvatarModel
              ubLocation={ubLocation}
              rnm={rnm}
              autoRotate={girar}
              showAllUBPoints={showAllUBPoints}
              selectedUBCode={selectedUBCode}
              ubRegionFilter={ubRegionFilter}
              onUBClick={onUBClick}
              cm={cm}
              orientation={orientation}
              handMode={handMode}
              movementInterp={movementInterp}
              armAngles={armAngles}
              armFKStateRef={armFKStateRef}
              autoSolveRequest={autoSolveRequest}
            />
          ) : (
            <RiggedHand
              cm={cm}
              autoRotate={girar}
              orientation={orientation}
              movement={movement}
            />
          )}
          <ContactShadows
            position={[0, -1.4, 0]}
            opacity={0.25}
            scale={6}
            blur={2.5}
          />
          <Environment preset="studio" />
        </Suspense>

        {torso && <EncuadreTorso tapado={tapado} controles={controles} />}
        {!fija && (
          <OrbitControls
            ref={controles}
            enablePan={false}
            enableZoom={true}
            zoomSpeed={0.8}
            rotateSpeed={0.7}
            minDistance={torso ? 0.9 : 1.5}
            maxDistance={8}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={(Math.PI * 5) / 6}
          />
        )}
      </Canvas>

      {/* Bottom gradient */}
      {!sinMarco && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-black/10" />
      )}
    </div>
  );
}
