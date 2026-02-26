import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Fixed position for the Pack-a-Punch machine in the desert arena
export const PACK_A_PUNCH_POSITION: [number, number, number] = [15, 0, -12];
export const PACK_A_PUNCH_INTERACT_RANGE = 3.5;

// Collision half-extents (used by FirstPersonCamera)
export const PACK_A_PUNCH_HALF_W = 0.7;
export const PACK_A_PUNCH_HALF_D = 0.55;

interface PackAPunchMachineProps {
  upgradeTier: number;
}

export function PackAPunchMachine({ upgradeTier }: PackAPunchMachineProps) {
  const glowRef = useRef<THREE.Mesh>(null);
  const topLightRef = useRef<THREE.PointLight>(null);
  const screenRef = useRef<THREE.Mesh>(null);
  const particleGroupRef = useRef<THREE.Group>(null);

  // Tier colors: base=purple, tier1=blue, tier2=purple, tier3=gold
  const tierColor = useMemo(() => {
    if (upgradeTier === 0) return new THREE.Color(0.4, 0.0, 0.8);
    if (upgradeTier === 1) return new THREE.Color(0.0, 0.4, 1.0);
    if (upgradeTier === 2) return new THREE.Color(0.6, 0.0, 1.0);
    return new THREE.Color(1.0, 0.75, 0.0);
  }, [upgradeTier]);

  // Glow material
  const glowMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: tierColor,
    emissive: tierColor,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.6,
  }), [tierColor]);

  // Screen material
  const screenMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: tierColor,
    emissive: tierColor,
    emissiveIntensity: 2.0,
  }), [tierColor]);

  // Body material
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.08, 0.06, 0.12),
    roughness: 0.3,
    metalness: 0.8,
  }), []);

  // Accent material
  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.15, 0.12, 0.2),
    roughness: 0.2,
    metalness: 0.9,
  }), []);

  // Particle positions (static offsets)
  const particleOffsets = useMemo(() => {
    const offsets: [number, number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      offsets.push([Math.cos(angle) * 0.6, 0.5 + Math.random() * 1.5, Math.sin(angle) * 0.6]);
    }
    return offsets;
  }, []);

  useFrame(() => {
    const t = Date.now() * 0.001;

    // Pulsing glow
    if (glowRef.current) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
      (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0 + pulse * 1.5;
      (glowRef.current.material as THREE.MeshStandardMaterial).opacity = 0.3 + pulse * 0.4;
    }

    // Screen flicker
    if (screenRef.current) {
      const flicker = 1.5 + Math.sin(t * 7.3) * 0.3 + Math.sin(t * 13.1) * 0.2;
      (screenRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = flicker;
    }

    // Point light pulse
    if (topLightRef.current) {
      topLightRef.current.intensity = 1.5 + Math.sin(t * 2.5) * 0.8;
      topLightRef.current.color.copy(tierColor);
    }

    // Floating particles
    if (particleGroupRef.current) {
      particleGroupRef.current.children.forEach((child, i) => {
        const offset = (i / 8) * Math.PI * 2;
        child.position.y = particleOffsets[i][1] + Math.sin(t * 1.5 + offset) * 0.3;
        child.rotation.y = t + offset;
        const scale = 0.5 + 0.5 * Math.sin(t * 3 + offset);
        child.scale.setScalar(scale * 0.08);
      });
    }
  });

  const [px, py, pz] = PACK_A_PUNCH_POSITION;

  return (
    <group position={[px, py, pz]}>
      {/* Point light for glow effect */}
      <pointLight
        ref={topLightRef}
        position={[0, 2.5, 0]}
        intensity={1.5}
        distance={8}
        color={tierColor}
      />

      {/* Main body */}
      <mesh material={bodyMat} position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[1.2, 2.0, 0.9]} />
      </mesh>

      {/* Top cap */}
      <mesh material={accentMat} position={[0, 2.1, 0]}>
        <boxGeometry args={[1.3, 0.2, 1.0]} />
      </mesh>

      {/* Bottom base */}
      <mesh material={accentMat} position={[0, 0.05, 0]}>
        <boxGeometry args={[1.4, 0.1, 1.1]} />
      </mesh>

      {/* Screen */}
      <mesh ref={screenRef} material={screenMat} position={[0, 1.3, 0.46]}>
        <boxGeometry args={[0.8, 0.5, 0.02]} />
      </mesh>

      {/* Screen border */}
      <mesh material={accentMat} position={[0, 1.3, 0.45]}>
        <boxGeometry args={[0.9, 0.6, 0.03]} />
      </mesh>

      {/* Side panels */}
      <mesh material={accentMat} position={[-0.62, 1.0, 0]}>
        <boxGeometry args={[0.04, 1.8, 0.85]} />
      </mesh>
      <mesh material={accentMat} position={[0.62, 1.0, 0]}>
        <boxGeometry args={[0.04, 1.8, 0.85]} />
      </mesh>

      {/* Decorative horizontal stripes */}
      <mesh material={accentMat} position={[0, 0.5, 0.46]}>
        <boxGeometry args={[1.1, 0.06, 0.02]} />
      </mesh>
      <mesh material={accentMat} position={[0, 1.8, 0.46]}>
        <boxGeometry args={[1.1, 0.06, 0.02]} />
      </mesh>

      {/* Glowing orb on top */}
      <mesh ref={glowRef} material={glowMat} position={[0, 2.5, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
      </mesh>

      {/* Outer glow sphere (larger, more transparent) */}
      <mesh position={[0, 2.5, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial
          color={tierColor}
          emissive={tierColor}
          emissiveIntensity={0.5}
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Floating particles */}
      <group ref={particleGroupRef}>
        {particleOffsets.map((offset, i) => (
          <mesh key={i} position={offset}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={tierColor}
              emissive={tierColor}
              emissiveIntensity={2}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
      </group>

      {/* Outline */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[1.25, 2.05, 0.95]} />
        <meshBasicMaterial color="#000000" side={THREE.BackSide} />
      </mesh>
    </group>
  );
}
