import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Pickup } from '../../types/enemy';

interface PickupMeshProps {
  pickup: Pickup;
  playerPos: [number, number, number];
  onCollect: (id: string) => void;
  onPickupSound: () => void;
  onHealthPickup: (amount: number) => void;
  onAmmoPickup: (weapon: string) => void;
}

export function PickupMesh({
  pickup,
  playerPos,
  onCollect,
  onPickupSound,
  onHealthPickup,
  onAmmoPickup,
}: PickupMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const collectedRef = useRef(false);

  useFrame((_, delta) => {
    if (!meshRef.current || collectedRef.current) return;

    // Float animation
    meshRef.current.position.y = pickup.position[1] + Math.sin(Date.now() * 0.003) * 0.15 + 0.3;
    meshRef.current.rotation.y += delta * 2;

    // Check collection
    const dx = playerPos[0] - pickup.position[0];
    const dz = playerPos[2] - pickup.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 1.5) {
      collectedRef.current = true;
      onCollect(pickup.id);
      onPickupSound();
      if (pickup.type === 'health') {
        onHealthPickup(25);
      } else {
        onAmmoPickup('current');
      }
    }
  });

  if (pickup.collected) return null;

  const color = pickup.type === 'health' ? '#ff2222' : '#ffcc00';

  return (
    <mesh ref={meshRef} position={pickup.position}>
      {pickup.type === 'health' ? (
        <boxGeometry args={[0.4, 0.4, 0.4]} />
      ) : (
        <cylinderGeometry args={[0.2, 0.2, 0.4, 6]} />
      )}
      <meshBasicMaterial color={color} />
    </mesh>
  );
}
