"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

function HandModel({ autoRotate = true }: { autoRotate?: boolean }) {
  const { scene } = useGLTF("/models/hand.glb");
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current && autoRotate) {
      ref.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={ref} scale={2.5} position={[0, -0.5, 0]}>
      <primitive object={scene.clone()} />
    </group>
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#818cf8" wireframe />
    </mesh>
  );
}

interface HandModelViewerProps {
  className?: string;
  autoRotate?: boolean;
  height?: string;
}

export default function HandModelViewer({
  className = "",
  autoRotate = true,
  height = "400px",
}: HandModelViewerProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ height }}>
      <Canvas
        camera={{ position: [0, 1, 4], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-3, 3, -3]} intensity={0.3} color="#818cf8" />
        <Suspense fallback={<LoadingFallback />}>
          <HandModel autoRotate={autoRotate} />
          <ContactShadows
            position={[0, -1.5, 0]}
            opacity={0.3}
            scale={8}
            blur={2}
          />
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={2}
          maxDistance={8}
          autoRotate={false}
        />
      </Canvas>

      {/* Gradient overlay at bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
}

// Preload the model
useGLTF.preload("/models/hand.glb");
