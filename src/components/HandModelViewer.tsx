"use client";

import { Suspense, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

/**
 * Traverses the loaded GLTF scene and replaces the default white material
 * with a realistic skin-toned PBR material.
 */
function applyHandMaterial(scene: THREE.Object3D) {
  const skinMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#d4a574"),          // warm skin tone
    roughness: 0.65,
    metalness: 0.0,
    clearcoat: 0.15,                            // subtle sheen (skin-like)
    clearcoatRoughness: 0.4,
    sheen: 0.3,                                 // soft velvet-like diffuse
    sheenColor: new THREE.Color("#e8c4a0"),
    sheenRoughness: 0.5,
    side: THREE.DoubleSide,
  });

  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.material = skinMaterial;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

function HandModel({ autoRotate = true }: { autoRotate?: boolean }) {
  const { scene } = useGLTF("/models/hand.glb");
  const ref = useRef<THREE.Group>(null);

  // Clone the scene once and apply the skin material
  const clonedScene = useRef<THREE.Object3D | null>(null);
  if (!clonedScene.current) {
    clonedScene.current = scene.clone();
    applyHandMaterial(clonedScene.current);
  }

  useFrame((_, delta) => {
    if (ref.current && autoRotate) {
      ref.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={ref} scale={2.5} position={[0, -0.5, 0]}>
      <primitive object={clonedScene.current} />
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
        shadows
      >
        {/* Key light — warm, from upper right */}
        <directionalLight
          position={[4, 6, 4]}
          intensity={1.5}
          color="#fff5e6"
          castShadow
        />
        {/* Fill light — cool, from left */}
        <directionalLight
          position={[-4, 3, -2]}
          intensity={0.5}
          color="#c4d4ff"
        />
        {/* Rim light — accent from behind */}
        <directionalLight
          position={[0, 2, -5]}
          intensity={0.6}
          color="#a78bfa"
        />
        {/* Ambient base */}
        <ambientLight intensity={0.3} color="#e8e0f0" />

        <Suspense fallback={<LoadingFallback />}>
          <HandModel autoRotate={autoRotate} />
          <ContactShadows
            position={[0, -1.5, 0]}
            opacity={0.3}
            scale={8}
            blur={2}
          />
          <Environment preset="studio" environmentIntensity={0.4} />
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
