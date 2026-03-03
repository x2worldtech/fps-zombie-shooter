import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BloodParticlesProps {
  position: [number, number, number];
  direction: [number, number, number];
  intensity?: number;
  onComplete?: () => void;
}

const BloodParticles: React.FC<BloodParticlesProps> = ({
  position,
  direction,
  intensity = 1.0,
  onComplete,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const completed = useRef(false);

  const count = Math.floor(10 + 8 * intensity);

  const particles = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const upPerp = new THREE.Vector3().crossVectors(right, dir).normalize();

    return Array.from({ length: count }, () => {
      const spread = (Math.PI / 4) * (1 + intensity * 0.2);
      const theta = (Math.random() - 0.5) * spread * 2;
      const phi = (Math.random() - 0.5) * spread * 2;
      const speed = 2.5 + Math.random() * 4.0 * intensity;

      const vel = dir.clone()
        .addScaledVector(right, Math.sin(theta))
        .addScaledVector(upPerp, Math.sin(phi))
        .normalize()
        .multiplyScalar(speed);

      return {
        velocity: vel,
        pos: new THREE.Vector3(...position),
        life: 0,
        maxLife: 0.5 + Math.random() * 0.9,
        scale: 0.03 + Math.random() * 0.05 * intensity,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const zeroMatrix = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current || completed.current) return;

    let allDone = true;
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      p.life += delta;

      if (p.life < p.maxLife) {
        allDone = false;
        p.velocity.y -= 9.8 * delta;
        p.pos.addScaledVector(p.velocity, delta);

        if (p.pos.y < 0.02) {
          p.pos.y = 0.02;
          p.velocity.y = Math.abs(p.velocity.y) * 0.15;
          p.velocity.x *= 0.65;
          p.velocity.z *= 0.65;
        }

        const t = p.life / p.maxLife;
        const s = p.scale * (1 - t * 0.4);
        dummy.position.copy(p.pos);
        dummy.scale.setScalar(Math.max(0.001, s));
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      } else {
        meshRef.current.setMatrixAt(i, zeroMatrix);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;

    if (allDone && !completed.current) {
      completed.current = true;
      onComplete?.();
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#cc0000" />
    </instancedMesh>
  );
};

export default BloodParticles;
