import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface JuggernogMachineProps {
  position: [number, number, number];
  purchaseCount: number;
}

export default function JuggernogMachine({ position, purchaseCount }: JuggernogMachineProps) {
  const glowRef = useRef<THREE.PointLight>(null);
  const screenRef = useRef<THREE.Mesh>(null);
  const particleRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  // Toon materials
  const bodyMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#cc1111' }), []);
  const darkRedMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#880000' }), []);
  const chromeMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#aaaaaa' }), []);
  const blackMaterial = useMemo(() => new THREE.MeshToonMaterial({ color: '#111111' }), []);
  const screenMaterial = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        color: purchaseCount >= 2 ? '#444444' : '#ff4444',
        emissive: purchaseCount >= 2 ? '#000000' : '#cc0000',
        emissiveIntensity: 0.8,
      }),
    [purchaseCount]
  );
  const labelMaterial = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        color: purchaseCount >= 2 ? '#555555' : '#ffdd00',
        emissive: purchaseCount >= 2 ? '#000000' : '#aa8800',
        emissiveIntensity: 0.5,
      }),
    [purchaseCount]
  );
  const glassMaterial = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        color: '#88ccff',
        transparent: true,
        opacity: 0.5,
      }),
    []
  );

  // Particle geometry for floating red sparks
  const particleGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = 30;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 1] = Math.random() * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const particleMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#ff2200',
        size: 0.08,
        transparent: true,
        opacity: 0.8,
      }),
    []
  );

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (glowRef.current && purchaseCount < 2) {
      glowRef.current.intensity = 1.2 + Math.sin(t * 2.5) * 0.4;
    }

    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshToonMaterial;
      if (purchaseCount < 2) {
        mat.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.3;
      }
    }

    if (particleRef.current && purchaseCount < 2) {
      const positions = particleRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] += delta * 0.5;
        if (positions[i * 3 + 1] > 3.5) {
          positions[i * 3 + 1] = 0;
        }
      }
      particleRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      {/* Glow light */}
      {purchaseCount < 2 && (
        <pointLight ref={glowRef} color="#ff2200" intensity={1.5} distance={6} position={[0, 1.5, 0.6]} />
      )}

      {/* Main body */}
      <mesh material={bodyMaterial} position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[1.0, 2.4, 0.7]} />
      </mesh>

      {/* Top cap */}
      <mesh material={darkRedMaterial} position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[1.05, 0.2, 0.75]} />
      </mesh>

      {/* Bottom base */}
      <mesh material={darkRedMaterial} position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[1.1, 0.1, 0.8]} />
      </mesh>

      {/* Side trim left */}
      <mesh material={darkRedMaterial} position={[-0.52, 1.2, 0]}>
        <boxGeometry args={[0.06, 2.4, 0.72]} />
      </mesh>

      {/* Side trim right */}
      <mesh material={darkRedMaterial} position={[0.52, 1.2, 0]}>
        <boxGeometry args={[0.06, 2.4, 0.72]} />
      </mesh>

      {/* Glass front panel (drink display) */}
      <mesh material={glassMaterial} position={[0, 1.4, 0.36]}>
        <boxGeometry args={[0.75, 1.2, 0.02]} />
      </mesh>

      {/* Screen / display */}
      <mesh ref={screenRef} material={screenMaterial} position={[0, 0.45, 0.36]}>
        <boxGeometry args={[0.7, 0.35, 0.02]} />
      </mesh>

      {/* Label panel (JUGGERNOG text area) */}
      <mesh material={labelMaterial} position={[0, 2.1, 0.36]}>
        <boxGeometry args={[0.85, 0.25, 0.02]} />
      </mesh>

      {/* Coin slot */}
      <mesh material={chromeMaterial} position={[0.3, 0.7, 0.36]}>
        <boxGeometry args={[0.12, 0.04, 0.02]} />
      </mesh>

      {/* Button panel */}
      <mesh material={chromeMaterial} position={[0, 0.7, 0.36]}>
        <boxGeometry args={[0.5, 0.18, 0.02]} />
      </mesh>

      {/* Red button */}
      <mesh material={new THREE.MeshToonMaterial({ color: '#ff0000', emissive: '#880000', emissiveIntensity: 0.5 })} position={[-0.15, 0.7, 0.375]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 8]} />
      </mesh>

      {/* Vending slot at bottom */}
      <mesh material={blackMaterial} position={[0, 0.18, 0.36]}>
        <boxGeometry args={[0.5, 0.1, 0.02]} />
      </mesh>

      {/* Chrome legs */}
      <mesh material={chromeMaterial} position={[-0.35, -0.05, 0.2]}>
        <boxGeometry args={[0.08, 0.1, 0.08]} />
      </mesh>
      <mesh material={chromeMaterial} position={[0.35, -0.05, 0.2]}>
        <boxGeometry args={[0.08, 0.1, 0.08]} />
      </mesh>
      <mesh material={chromeMaterial} position={[-0.35, -0.05, -0.2]}>
        <boxGeometry args={[0.08, 0.1, 0.08]} />
      </mesh>
      <mesh material={chromeMaterial} position={[0.35, -0.05, -0.2]}>
        <boxGeometry args={[0.08, 0.1, 0.08]} />
      </mesh>

      {/* Floating particles */}
      {purchaseCount < 2 && (
        <points ref={particleRef} geometry={particleGeometry} material={particleMaterial} position={[0, 0, 0]} />
      )}

      {/* Grayed-out overlay when maxed */}
      {purchaseCount >= 2 && (
        <mesh position={[0, 1.2, 0.37]}>
          <boxGeometry args={[1.0, 2.4, 0.01]} />
          <meshToonMaterial color="#333333" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
