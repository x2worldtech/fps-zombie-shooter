import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MuzzleFlashProps {
  active: boolean;
  position: [number, number, number];
}

export function MuzzleFlash({ active, position }: MuzzleFlashProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (active) {
      startTimeRef.current = Date.now();
    }
  }, [active]);

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = Date.now() - startTimeRef.current;
    const duration = 80;
    if (elapsed < duration && active) {
      const t = 1 - elapsed / duration;
      meshRef.current.visible = true;
      meshRef.current.scale.setScalar(t * 0.3 + 0.1);
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = t;
    } else {
      meshRef.current.visible = false;
    }
  });

  return (
    <mesh ref={meshRef} position={position} visible={false}>
      <sphereGeometry args={[0.15, 8, 8]} />
      <meshBasicMaterial color="#ffaa00" transparent opacity={1} />
    </mesh>
  );
}
