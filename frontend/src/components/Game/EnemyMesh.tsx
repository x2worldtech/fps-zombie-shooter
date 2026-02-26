import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Enemy } from '../../types/enemy';
import { useToonMaterial, useOutlineMaterial } from './ToonMaterial';

interface EnemyMeshProps {
  enemy: Enemy;
  onHitFlashDone: (id: string) => void;
}

function StandardZombie({ enemy, onHitFlashDone }: EnemyMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const hitFlashRef = useRef(0);
  const toonMat = useToonMaterial('#4a8a3a', hitFlashRef.current);
  const skinMat = useToonMaterial('#8a6a3a', hitFlashRef.current);
  const outlineMat = useOutlineMaterial(0.06);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Smooth position
    const [tx, ty, tz] = enemy.position;
    groupRef.current.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(delta * 12, 1));

    // Face player direction (simple bob animation)
    if (!enemy.isDead) {
      groupRef.current.rotation.y = Math.atan2(
        -enemy.velocity[0] || 0,
        -enemy.velocity[1] || 1
      );
      // Walk bob
      const bob = Math.sin(Date.now() * 0.008) * 0.05;
      groupRef.current.position.y = ty + bob;
    }

    // Hit flash
    if (enemy.isHit) {
      hitFlashRef.current = Math.min(hitFlashRef.current + delta * 8, 1);
      if (hitFlashRef.current >= 0.9) {
        onHitFlashDone(enemy.id);
        hitFlashRef.current = 0;
      }
    } else {
      hitFlashRef.current = Math.max(hitFlashRef.current - delta * 8, 0);
    }

    // Death fade
    if (enemy.isDead) {
      const elapsed = (Date.now() - enemy.deathTime) / 1000;
      const opacity = Math.max(0, 1 - elapsed * 1.5);
      groupRef.current.scale.y = Math.max(0.01, 1 - elapsed * 1.2);
      groupRef.current.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.Material).opacity = opacity;
          (child.material as THREE.Material).transparent = true;
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={enemy.position}>
      {/* Body */}
      <mesh material={toonMat} position={[0, 0, 0]}>
        <boxGeometry args={[0.7, 1.0, 0.4]} />
      </mesh>
      <mesh material={outlineMat} position={[0, 0, 0]}>
        <boxGeometry args={[0.7, 1.0, 0.4]} />
      </mesh>
      {/* Head — tagged with isHead for precise headshot detection */}
      <mesh material={skinMat} position={[0, 0.75, 0]} userData={{ isHead: true }}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
      </mesh>
      <mesh material={outlineMat} position={[0, 0.75, 0]} userData={{ isHead: true }}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
      </mesh>
      {/* Arms */}
      <mesh material={toonMat} position={[-0.55, 0.1, 0.1]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
      </mesh>
      <mesh material={toonMat} position={[0.55, 0.1, 0.1]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
      </mesh>
      {/* Legs */}
      <mesh material={toonMat} position={[-0.2, -0.7, 0]}>
        <boxGeometry args={[0.25, 0.6, 0.25]} />
      </mesh>
      <mesh material={toonMat} position={[0.2, -0.7, 0]}>
        <boxGeometry args={[0.25, 0.6, 0.25]} />
      </mesh>
    </group>
  );
}

function BossZombie({ enemy, onHitFlashDone }: EnemyMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const hitFlashRef = useRef(0);
  const toonMat = useToonMaterial('#8a1a1a', hitFlashRef.current);
  const darkMat = useToonMaterial('#4a0a0a', hitFlashRef.current);
  const outlineMat = useOutlineMaterial(0.1);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const [tx, ty, tz] = enemy.position;
    groupRef.current.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(delta * 8, 1));

    if (!enemy.isDead) {
      const bob = Math.sin(Date.now() * 0.004) * 0.08;
      groupRef.current.position.y = ty + bob;
    }

    if (enemy.isHit) {
      hitFlashRef.current = Math.min(hitFlashRef.current + delta * 8, 1);
      if (hitFlashRef.current >= 0.9) {
        onHitFlashDone(enemy.id);
        hitFlashRef.current = 0;
      }
    } else {
      hitFlashRef.current = Math.max(hitFlashRef.current - delta * 8, 0);
    }

    if (enemy.isDead) {
      const elapsed = (Date.now() - enemy.deathTime) / 1000;
      groupRef.current.scale.y = Math.max(0.01, 1 - elapsed * 0.8);
    }
  });

  const healthPct = enemy.health / enemy.maxHealth;

  return (
    <group ref={groupRef} position={enemy.position}>
      {/* Body */}
      <mesh material={toonMat} position={[0, 0, 0]}>
        <boxGeometry args={[1.4, 2.0, 0.8]} />
      </mesh>
      <mesh material={outlineMat} position={[0, 0, 0]}>
        <boxGeometry args={[1.4, 2.0, 0.8]} />
      </mesh>
      {/* Head — tagged with isHead for precise headshot detection */}
      <mesh material={darkMat} position={[0, 1.4, 0]} userData={{ isHead: true }}>
        <boxGeometry args={[1.0, 0.9, 0.9]} />
      </mesh>
      <mesh material={outlineMat} position={[0, 1.4, 0]} userData={{ isHead: true }}>
        <boxGeometry args={[1.0, 0.9, 0.9]} />
      </mesh>
      {/* Arms */}
      <mesh material={toonMat} position={[-1.1, 0.2, 0.2]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.4, 1.4, 0.4]} />
      </mesh>
      <mesh material={toonMat} position={[1.1, 0.2, 0.2]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.4, 1.4, 0.4]} />
      </mesh>
      {/* Legs */}
      <mesh material={darkMat} position={[-0.4, -1.4, 0]}>
        <boxGeometry args={[0.5, 1.0, 0.5]} />
      </mesh>
      <mesh material={darkMat} position={[0.4, -1.4, 0]}>
        <boxGeometry args={[0.5, 1.0, 0.5]} />
      </mesh>

      {/* Health bar (floating above) */}
      {!enemy.isDead && (
        <group position={[0, 2.8, 0]}>
          {/* Background */}
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[2.0, 0.2]} />
            <meshBasicMaterial color="#330000" />
          </mesh>
          {/* Fill */}
          <mesh position={[-(1.0 - healthPct), 0, 0.01]} scale={[healthPct, 1, 1]}>
            <planeGeometry args={[2.0, 0.18]} />
            <meshBasicMaterial color={healthPct > 0.5 ? '#cc2222' : '#ff4400'} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function EnemyMesh({ enemy, onHitFlashDone }: EnemyMeshProps) {
  if (enemy.type === 'boss') {
    return <BossZombie enemy={enemy} onHitFlashDone={onHitFlashDone} />;
  }
  return <StandardZombie enemy={enemy} onHitFlashDone={onHitFlashDone} />;
}
