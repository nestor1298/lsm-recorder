"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment } from "@react-three/drei";
import type { CMEntry } from "@/lib/types";
import RiggedHand from "./RiggedHand";

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
}

export default function Hand3DViewer({
  cm,
  className = "",
  height = "400px",
  autoRotate = true,
}: Hand3DViewerProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ height }}>
      <Canvas
        camera={{ position: [0, 0.5, 3.5], fov: 35 }}
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
          <RiggedHand cm={cm} autoRotate={autoRotate} />
          <ContactShadows position={[0, -1.2, 0]} opacity={0.25} scale={6} blur={2.5} />
          <Environment preset="studio" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1.5}
          maxDistance={8}
        />
      </Canvas>

      {/* Bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
}
