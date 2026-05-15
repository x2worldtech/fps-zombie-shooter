import { useFrame } from "@react-three/fiber";
import type React from "react";
import { memo, useRef } from "react";
import type * as THREE from "three";
import type { Pickup } from "../../types/enemy";

interface PickupMeshProps {
  pickup: Pickup;
  /**
   * PERF: stabile Ref auf die Spielerposition statt eines Tupels.
   * Das Tupel wechselte vorher seine Referenz jeden Frame → React.memo war
   * wirkungslos. Mit einer Ref bleibt die Prop stabil; PickupMesh re-rendert
   * nur noch wenn sich `pickup` ändert (Spawn / collected).
   */
  playerPosRef: React.MutableRefObject<[number, number, number]>;
  onCollect: (id: string) => void;
  onPickupSound: () => void;
  onHealthPickup: (amount: number) => void;
  onAmmoPickup: (weapon: string) => void;
}

function PickupMeshInner({
  pickup,
  playerPosRef,
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
    meshRef.current.position.y =
      pickup.position[1] + Math.sin(Date.now() * 0.003) * 0.15 + 0.3;
    meshRef.current.rotation.y += delta * 2;

    // Check collection — Position aus Ref lesen (per-Frame mutiert)
    const playerPos = playerPosRef.current;
    const dx = playerPos[0] - pickup.position[0];
    const dz = playerPos[2] - pickup.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 1.5) {
      collectedRef.current = true;
      onCollect(pickup.id);
      onPickupSound();
      if (pickup.type === "health") {
        onHealthPickup(25);
      } else {
        onAmmoPickup("current");
      }
    }
  });

  if (pickup.collected) return null;

  const color = pickup.type === "health" ? "#ff2222" : "#ffcc00";

  return (
    <mesh ref={meshRef} position={pickup.position}>
      {pickup.type === "health" ? (
        <boxGeometry args={[0.4, 0.4, 0.4]} />
      ) : (
        <cylinderGeometry args={[0.2, 0.2, 0.4, 6]} />
      )}
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

// PERF: memo verhindert Re-Renders wenn nur GameScene re-rendert. Da
// playerPosRef nun stabil ist, hängt die Render-Entscheidung nur noch am
// `pickup`-Objekt (referenz-stabil aus pickups-Array) und den Callbacks.
export const PickupMesh = memo(PickupMeshInner);
