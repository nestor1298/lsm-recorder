"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment } from "@react-three/drei";
import type { CMEntry } from "@/lib/types";
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
  orientation?: { palm: string; fingers: string };
  movement?: { contour: string; local: string | null; plane: string };
  /** When set, shows full-body avatar instead of hand */
  activeChannel?: string;
  ubLocation?: UBTarget | null;
  rnm?: RNMTarget | null;
  /** Show all 80 UB points as interactive spheres */
  showAllUBPoints?: boolean;
  /** Filter spheres by region */
  ubRegionFilter?: string | null;
  /** Callback when a UB sphere is clicked on the 3D avatar */
  onUBClick?: (code: string) => void;
  /** Build mode: always show avatar instead of isolated hand */
  isBuildMode?: boolean;
  /** Hand mode for avatar posing */
  handMode?: "dominant" | "both_symmetric";
  /** Movement interpolation data for smooth M-segment animation */
  movementInterp?: MovementInterpolation | null;
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
  rnm,
  showAllUBPoints,
  ubRegionFilter,
  onUBClick,
  isBuildMode = false,
  handMode,
}: Hand3DViewerProps) {
  // Show avatar in build mode always, or in explore mode for UB/RNM channels
  const showAvatar = isBuildMode || activeChannel === "ub" || activeChannel === "rnm";
  // For avatar channels, pull camera back and look at full body
  const cameraPosition: [number, number, number] = showAvatar
    ? [0, 0.3, 4.5]
    : [0, 0.5, 3.5];
  const cameraFov = showAvatar ? 40 : 35;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ height }}>
      <Canvas
        camera={{ position: cameraPosition, fov: cameraFov }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        shadows
      >
        {/* 3-point lighting rig */}
        <directionalLight position={[4, 5, 4]} intensity={1.8} color="#fff5e6" castShadow />
        <directionalLight position={[-3, 3, -2]} intensity={0.6} color="#c8d8ff" />
        <directionalLight position={[0, 2, -5]} intensity={0.5} color="#a78bfa" />
        <ambientLight intensity={0.35} color="#f0e8f8" />

        <Suspense fallback={<LoadingFallback />}>
          {showAvatar ? (
            <AvatarModel
              ubLocation={ubLocation}
              rnm={rnm}
              autoRotate={autoRotate}
              showAllUBPoints={showAllUBPoints}
              ubRegionFilter={ubRegionFilter}
              onUBClick={onUBClick}
              cm={cm}
              orientation={orientation}
              handMode={handMode}
              movementInterp={movementInterp}
            />
          ) : (
            <RiggedHand
              cm={cm}
              autoRotate={autoRotate}
              orientation={orientation}
              movement={movement}
            />
          )}
          <ContactShadows position={[0, -1.4, 0]} opacity={0.25} scale={6} blur={2.5} />
          <Environment preset="studio" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1.5}
          maxDistance={8}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI * 5 / 6}
        />
      </Canvas>

      {/* Bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
}
