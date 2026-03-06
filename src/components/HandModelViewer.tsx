"use client";

import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

/**
 * Apply a realistic skin-toned PBR material to every mesh in the scene.
 */
function applyHandMaterial(obj: THREE.Object3D) {
  const skinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#c8956c"),
    roughness: 0.6,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.material = skinMat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

function HandModel({ autoRotate = true }: { autoRotate?: boolean }) {
  const { scene } = useGLTF("/models/hand.glb");
  const ref = useRef<THREE.Group>(null);

  // Clone, centre, scale, and apply material — once
  const prepared = useMemo(() => {
    const clone = scene.clone(true);

    // Compute the world-space bounding box of the entire model
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Normalise so the longest side ≈ 2 world units
    const targetSize = 2;
    const s = targetSize / maxDim;
    clone.scale.setScalar(s);

    // Shift so the model is centred at the origin
    clone.position.set(-center.x * s, -center.y * s, -center.z * s);

    applyHandMaterial(clone);
    return clone;
  }, [scene]);

  useFrame((_, delta) => {
    if (ref.current && autoRotate) {
      ref.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group ref={ref}>
      <primitive object={prepared} />
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
          <HandModel autoRotate={autoRotate} />
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

useGLTF.preload("/models/hand.glb");
