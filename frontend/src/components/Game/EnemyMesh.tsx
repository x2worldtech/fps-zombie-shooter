import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Enemy } from '../../types/enemy';
import { useToonMaterial, useOutlineMaterial } from './ToonMaterial';

interface EnemyMeshProps {
  enemy: Enemy;
  onHitFlashDone: (id: string) => void;
  playerPositionRef: React.MutableRefObject<[number, number, number]>;
}

// ─── Falling Limb ─────────────────────────────────────────────────────────────
interface FallingLimbProps {
  startPosition: [number, number, number];
  color: string;
  limbType: 'arm' | 'leg' | 'head';
  onComplete: () => void;
}

function FallingLimb({ startPosition, color, limbType, onComplete }: FallingLimbProps) {
  const groupRef = useRef<THREE.Group>(null);
  const velRef = useRef(new THREE.Vector3(
    (Math.random() - 0.5) * 5,
    2.5 + Math.random() * 2,
    (Math.random() - 0.5) * 5
  ));
  const angVelRef = useRef(new THREE.Vector3(
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10
  ));
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current || doneRef.current) return;
    elapsedRef.current += delta;

    velRef.current.y -= 12 * delta;
    groupRef.current.position.addScaledVector(velRef.current, delta);

    if (groupRef.current.position.y < 0.08) {
      groupRef.current.position.y = 0.08;
      velRef.current.y = 0;
      velRef.current.x *= 0.55;
      velRef.current.z *= 0.55;
      angVelRef.current.multiplyScalar(0.8);
    }

    groupRef.current.rotation.x += angVelRef.current.x * delta;
    groupRef.current.rotation.y += angVelRef.current.y * delta;
    groupRef.current.rotation.z += angVelRef.current.z * delta;

    if (elapsedRef.current > 2.5 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={startPosition}>
      {limbType === 'head' && (
        <mesh>
          <boxGeometry args={[0.34, 0.36, 0.3]} />
          <meshToonMaterial color={color} />
        </mesh>
      )}
      {limbType === 'arm' && (
        <mesh>
          <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
          <meshToonMaterial color={color} />
        </mesh>
      )}
      {limbType === 'leg' && (
        <mesh>
          <capsuleGeometry args={[0.09, 0.6, 4, 8]} />
          <meshToonMaterial color={color} />
        </mesh>
      )}
    </group>
  );
}

// ─── Standard Zombie ──────────────────────────────────────────────────────────
function StandardZombie({ enemy, onHitFlashDone, playerPositionRef }: EnemyMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const hitFlashRef = useRef(0);

  // Skin: pale greenish-grey necrotic tone
  const skinMat = useToonMaterial('#7a9470', hitFlashRef.current);
  // Darker necrotic patches
  const necroMat = useToonMaterial('#3d5238', hitFlashRef.current);
  // Clothing: dark brown/black torn rags
  const clothMat = useToonMaterial('#2e2318', hitFlashRef.current);
  // Torn cloth variant
  const clothTornMat = useToonMaterial('#1e1510', hitFlashRef.current);
  // Blood accents: vivid dark red
  const bloodMat = useToonMaterial('#8b0000', hitFlashRef.current);
  // Eye sockets: very dark recessed
  const eyeMat = useToonMaterial('#0d0d0d', hitFlashRef.current);
  // Glowing yellow eyes
  const eyeGlowMat = useRef<THREE.MeshBasicMaterial | null>(null);
  if (!eyeGlowMat.current) {
    eyeGlowMat.current = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ddcc00') });
  }
  // Bone color
  const boneMat = useToonMaterial('#d4c89a', hitFlashRef.current);
  // Teeth
  const teethMat = useToonMaterial('#e8e0c0', hitFlashRef.current);
  // Outline
  const outlineMat = useOutlineMaterial(0.055);
  const outlineThickMat = useOutlineMaterial(0.07);

  // Track dismemberment changes to spawn falling limbs
  const [fallingLimbs, setFallingLimbs] = useState<Array<{
    id: number;
    position: [number, number, number];
    color: string;
    limbType: 'arm' | 'leg' | 'head';
  }>>([]);
  const prevDismember = useRef({
    headDetached: false,
    leftArmDetached: false,
    rightArmDetached: false,
    leftLegDetached: false,
    rightLegDetached: false,
  });
  const fallingLimbIdRef = useRef(0);

  useEffect(() => {
    const prev = prevDismember.current;
    const [ex, ey, ez] = enemy.position;

    const spawnLimb = (
      offsetX: number, offsetY: number, offsetZ: number,
      color: string, limbType: 'arm' | 'leg' | 'head'
    ) => {
      setFallingLimbs(p => [...p, {
        id: fallingLimbIdRef.current++,
        position: [
          ex + offsetX + (Math.random() - 0.5) * 0.3,
          ey + offsetY,
          ez + offsetZ + (Math.random() - 0.5) * 0.3,
        ],
        color,
        limbType,
      }]);
    };

    if (enemy.headDetached && !prev.headDetached) {
      spawnLimb(0, 1.7, 0, '#7a9470', 'head');
    }
    if (enemy.leftArmDetached && !prev.leftArmDetached) {
      spawnLimb(-0.4, 1.1, 0, '#2e2318', 'arm');
    }
    if (enemy.rightArmDetached && !prev.rightArmDetached) {
      spawnLimb(0.4, 1.1, 0, '#2e2318', 'arm');
    }
    if (enemy.leftLegDetached && !prev.leftLegDetached) {
      spawnLimb(-0.18, 0.6, 0, '#1e1510', 'leg');
    }
    if (enemy.rightLegDetached && !prev.rightLegDetached) {
      spawnLimb(0.18, 0.6, 0, '#1e1510', 'leg');
    }

    prevDismember.current = {
      headDetached: !!enemy.headDetached,
      leftArmDetached: !!enemy.leftArmDetached,
      rightArmDetached: !!enemy.rightArmDetached,
      leftLegDetached: !!enemy.leftLegDetached,
      rightLegDetached: !!enemy.rightLegDetached,
    };
  }, [
    enemy.headDetached, enemy.leftArmDetached, enemy.rightArmDetached,
    enemy.leftLegDetached, enemy.rightLegDetached,
    enemy.position,
  ]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const [tx, ty, tz] = enemy.position;
    groupRef.current.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(delta * 12, 1));

    if (!enemy.isDead) {
      const [px, , pz] = playerPositionRef.current;
      const dx = px - tx;
      const dz = pz - tz;
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        groupRef.current.rotation.y = Math.atan2(dx, dz);
      }

      const t = Date.now() * 0.001;
      const bob = Math.sin(t * 8) * 0.04;
      groupRef.current.position.y = ty + bob;

      if (torsoRef.current) {
        torsoRef.current.rotation.x = 0.32 + Math.sin(t * 4) * 0.04;
      }

      if (!enemy.leftArmDetached && leftArmRef.current) {
        leftArmRef.current.rotation.x = -1.1 + Math.sin(t * 8) * 0.18;
        leftArmRef.current.rotation.z = 0.15 + Math.sin(t * 4) * 0.06;
      }
      if (!enemy.rightArmDetached && rightArmRef.current) {
        rightArmRef.current.rotation.x = -1.1 - Math.sin(t * 8) * 0.18;
        rightArmRef.current.rotation.z = -0.15 - Math.sin(t * 4) * 0.06;
      }

      if (!enemy.leftLegDetached && leftLegRef.current) {
        leftLegRef.current.rotation.x = Math.sin(t * 8) * 0.35;
      }
      if (!enemy.rightLegDetached && rightLegRef.current) {
        rightLegRef.current.rotation.x = -Math.sin(t * 8) * 0.35;
      }
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
      groupRef.current.traverse(child => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.Material).opacity = opacity;
          (child.material as THREE.Material).transparent = true;
        }
      });
    }
  });

  return (
    <>
      {/* Falling detached limbs */}
      {fallingLimbs.map(limb => (
        <FallingLimb
          key={limb.id}
          startPosition={limb.position}
          color={limb.color}
          limbType={limb.limbType}
          onComplete={() => setFallingLimbs(p => p.filter(l => l.id !== limb.id))}
        />
      ))}

      <group ref={groupRef} position={enemy.position}>

        {/* ── TORSO GROUP (hunched forward) ── */}
        <group ref={torsoRef} position={[0, 0.1, 0]} rotation={[0.32, 0, 0]}>

          {/* Main torso */}
          <mesh material={skinMat} position={[0, 0, 0]}>
            <boxGeometry args={[0.62, 0.82, 0.34]} />
          </mesh>
          <mesh material={outlineMat} position={[0, 0, 0]}>
            <boxGeometry args={[0.62, 0.82, 0.34]} />
          </mesh>

          {/* Torn shirt */}
          <mesh material={clothMat} position={[0, 0.05, 0.18]}>
            <boxGeometry args={[0.58, 0.72, 0.02]} />
          </mesh>
          {/* Torn shirt strips */}
          <mesh material={clothTornMat} position={[-0.32, -0.1, 0]}>
            <boxGeometry args={[0.02, 0.5, 0.36]} />
          </mesh>
          <mesh material={clothTornMat} position={[0.32, -0.1, 0]}>
            <boxGeometry args={[0.02, 0.5, 0.36]} />
          </mesh>

          {/* Exposed ribs */}
          {[-0.1, 0.05, 0.2].map((yOff, i) => (
            <group key={i}>
              <mesh material={boneMat} position={[-0.22, yOff, 0.18]} rotation={[0, 0, 0.25]}>
                <boxGeometry args={[0.2, 0.04, 0.03]} />
              </mesh>
              <mesh material={boneMat} position={[0.22, yOff, 0.18]} rotation={[0, 0, -0.25]}>
                <boxGeometry args={[0.2, 0.04, 0.03]} />
              </mesh>
            </group>
          ))}

          {/* Blood stains on torso */}
          <mesh material={bloodMat} position={[0.1, 0.1, 0.19]}>
            <boxGeometry args={[0.18, 0.22, 0.01]} />
          </mesh>
          <mesh material={bloodMat} position={[-0.08, -0.15, 0.19]}>
            <boxGeometry args={[0.12, 0.14, 0.01]} />
          </mesh>
          {/* Wound hole */}
          <mesh material={eyeMat} position={[0.05, 0.0, 0.19]}>
            <circleGeometry args={[0.05, 8]} />
          </mesh>

          {/* ── NECK ── */}
          <mesh material={skinMat} position={[0, 0.5, -0.04]}>
            <boxGeometry args={[0.2, 0.18, 0.2]} />
          </mesh>

          {/* Neck stump when head detached */}
          {enemy.headDetached && (
            <mesh material={bloodMat} position={[0, 0.62, -0.04]}>
              <cylinderGeometry args={[0.1, 0.12, 0.1, 8]} />
            </mesh>
          )}

          {/* ── HEAD GROUP ── */}
          {!enemy.headDetached && (
            <group position={[0, 0.72, -0.06]} userData={{ isHead: true }}>
              {/* Skull */}
              <mesh material={skinMat} position={[0, 0, 0]} userData={{ isHead: true }}>
                <boxGeometry args={[0.46, 0.52, 0.44]} />
              </mesh>
              <mesh material={outlineThickMat} position={[0, 0, 0]}>
                <boxGeometry args={[0.46, 0.52, 0.44]} />
              </mesh>

              {/* Forehead dark patch */}
              <mesh material={necroMat} position={[0, 0.18, 0.22]}>
                <boxGeometry args={[0.38, 0.1, 0.02]} />
              </mesh>

              {/* Jaw */}
              <mesh material={skinMat} position={[0, -0.2, 0.04]}>
                <boxGeometry args={[0.38, 0.16, 0.38]} />
              </mesh>

              {/* Gaping mouth */}
              <mesh material={eyeMat} position={[0, -0.16, 0.22]}>
                <boxGeometry args={[0.22, 0.08, 0.02]} />
              </mesh>
              {/* Teeth */}
              {[-0.07, -0.02, 0.03, 0.08].map((tx, i) => (
                <mesh key={i} material={teethMat} position={[tx, -0.13, 0.22]}>
                  <boxGeometry args={[0.04, 0.05, 0.02]} />
                </mesh>
              ))}

              {/* Left eye socket */}
              <mesh material={eyeMat} position={[-0.13, 0.06, 0.22]}>
                <boxGeometry args={[0.12, 0.1, 0.04]} />
              </mesh>
              {/* Right eye socket */}
              <mesh material={eyeMat} position={[0.13, 0.06, 0.22]}>
                <boxGeometry args={[0.12, 0.1, 0.04]} />
              </mesh>
              {/* Glowing eyes */}
              <mesh position={[-0.13, 0.06, 0.24]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <primitive object={eyeGlowMat.current} attach="material" />
              </mesh>
              <mesh position={[0.13, 0.06, 0.24]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <primitive object={eyeGlowMat.current} attach="material" />
              </mesh>

              {/* Brow ridge */}
              <mesh material={necroMat} position={[0, 0.14, 0.22]}>
                <boxGeometry args={[0.42, 0.06, 0.04]} />
              </mesh>

              {/* Gaunt cheekbones */}
              <mesh material={necroMat} position={[-0.22, -0.02, 0.18]}>
                <boxGeometry args={[0.06, 0.1, 0.06]} />
              </mesh>
              <mesh material={necroMat} position={[0.22, -0.02, 0.18]}>
                <boxGeometry args={[0.06, 0.1, 0.06]} />
              </mesh>

              {/* Blood on face */}
              <mesh material={bloodMat} position={[-0.05, -0.1, 0.23]}>
                <boxGeometry args={[0.1, 0.12, 0.01]} />
              </mesh>
              {/* Wound on forehead */}
              <mesh material={bloodMat} position={[0.1, 0.15, 0.23]}>
                <boxGeometry args={[0.06, 0.06, 0.01]} />
              </mesh>

              {/* Hair (tattered) */}
              <mesh material={clothMat} position={[0, 0.28, 0]}>
                <boxGeometry args={[0.48, 0.08, 0.46]} />
              </mesh>
            </group>
          )}

          {/* ── LEFT ARM GROUP ── */}
          {!enemy.leftArmDetached ? (
            <group ref={leftArmRef} position={[-0.38, 0.28, 0]} rotation={[-1.1, 0, 0.15]}>
              <mesh material={clothMat} position={[0, -0.2, 0]}>
                <boxGeometry args={[0.2, 0.38, 0.2]} />
              </mesh>
              <mesh material={skinMat} position={[0, -0.52, 0]}>
                <boxGeometry args={[0.17, 0.34, 0.17]} />
              </mesh>
              {/* Claw hand */}
              <mesh material={necroMat} position={[0, -0.74, 0]}>
                <boxGeometry args={[0.16, 0.16, 0.1]} />
              </mesh>
              {/* Claw fingers */}
              {[-0.05, 0, 0.05].map((fx, i) => (
                <mesh key={i} material={boneMat} position={[fx, -0.86, 0]}>
                  <boxGeometry args={[0.025, 0.1, 0.025]} />
                </mesh>
              ))}
              {/* Torn sleeve */}
              <mesh material={clothTornMat} position={[0.1, -0.38, 0.1]}>
                <boxGeometry args={[0.04, 0.18, 0.04]} />
              </mesh>
              {/* Blood on arm */}
              <mesh material={bloodMat} position={[0.09, -0.45, 0.09]}>
                <boxGeometry args={[0.04, 0.1, 0.02]} />
              </mesh>
              <mesh material={outlineMat} position={[0, -0.35, 0]}>
                <boxGeometry args={[0.22, 0.72, 0.22]} />
              </mesh>
            </group>
          ) : (
            /* Arm stump */
            <mesh material={bloodMat} position={[-0.38, 0.28, 0]}>
              <sphereGeometry args={[0.1, 6, 6]} />
            </mesh>
          )}

          {/* ── RIGHT ARM GROUP ── */}
          {!enemy.rightArmDetached ? (
            <group ref={rightArmRef} position={[0.38, 0.28, 0]} rotation={[-1.1, 0, -0.15]}>
              <mesh material={clothMat} position={[0, -0.2, 0]}>
                <boxGeometry args={[0.2, 0.38, 0.2]} />
              </mesh>
              <mesh material={skinMat} position={[0, -0.52, 0]}>
                <boxGeometry args={[0.17, 0.34, 0.17]} />
              </mesh>
              <mesh material={necroMat} position={[0, -0.74, 0]}>
                <boxGeometry args={[0.16, 0.16, 0.1]} />
              </mesh>
              {[-0.05, 0, 0.05].map((fx, i) => (
                <mesh key={i} material={boneMat} position={[fx, -0.86, 0]}>
                  <boxGeometry args={[0.025, 0.1, 0.025]} />
                </mesh>
              ))}
              <mesh material={clothTornMat} position={[-0.1, -0.38, 0.1]}>
                <boxGeometry args={[0.04, 0.18, 0.04]} />
              </mesh>
              <mesh material={outlineMat} position={[0, -0.35, 0]}>
                <boxGeometry args={[0.22, 0.72, 0.22]} />
              </mesh>
            </group>
          ) : (
            <mesh material={bloodMat} position={[0.38, 0.28, 0]}>
              <sphereGeometry args={[0.1, 6, 6]} />
            </mesh>
          )}
        </group>

        {/* ── PELVIS / WAIST ── */}
        <mesh material={clothMat} position={[0, -0.42, 0]}>
          <boxGeometry args={[0.58, 0.22, 0.32]} />
        </mesh>

        {/* ── LEFT LEG GROUP ── */}
        {!enemy.leftLegDetached ? (
          <group ref={leftLegRef} position={[-0.18, -0.62, 0]}>
            <mesh material={clothTornMat} position={[0, -0.2, 0]}>
              <boxGeometry args={[0.24, 0.38, 0.24]} />
            </mesh>
            <mesh material={clothTornMat} position={[0, -0.52, 0]}>
              <boxGeometry args={[0.2, 0.34, 0.2]} />
            </mesh>
            {/* Exposed bone on shin */}
            <mesh material={boneMat} position={[0.06, -0.48, 0.11]}>
              <boxGeometry args={[0.03, 0.18, 0.02]} />
            </mesh>
            <mesh material={eyeMat} position={[0, -0.74, 0.04]}>
              <boxGeometry args={[0.22, 0.14, 0.28]} />
            </mesh>
            <mesh material={outlineMat} position={[0, -0.44, 0]}>
              <boxGeometry args={[0.26, 0.76, 0.26]} />
            </mesh>
          </group>
        ) : (
          <mesh material={bloodMat} position={[-0.18, -0.62, 0]}>
            <cylinderGeometry args={[0.09, 0.1, 0.12, 8]} />
          </mesh>
        )}

        {/* ── RIGHT LEG GROUP ── */}
        {!enemy.rightLegDetached ? (
          <group ref={rightLegRef} position={[0.18, -0.62, 0]}>
            <mesh material={clothTornMat} position={[0, -0.2, 0]}>
              <boxGeometry args={[0.24, 0.38, 0.24]} />
            </mesh>
            <mesh material={clothTornMat} position={[0, -0.52, 0]}>
              <boxGeometry args={[0.2, 0.34, 0.2]} />
            </mesh>
            <mesh material={eyeMat} position={[0, -0.74, 0.04]}>
              <boxGeometry args={[0.22, 0.14, 0.28]} />
            </mesh>
            <mesh material={outlineMat} position={[0, -0.44, 0]}>
              <boxGeometry args={[0.26, 0.76, 0.26]} />
            </mesh>
          </group>
        ) : (
          <mesh material={bloodMat} position={[0.18, -0.62, 0]}>
            <cylinderGeometry args={[0.09, 0.1, 0.12, 8]} />
          </mesh>
        )}

      </group>
    </>
  );
}

// ─── Boss Zombie ──────────────────────────────────────────────────────────────
function BossZombie({ enemy, onHitFlashDone, playerPositionRef }: EnemyMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const hitFlashRef = useRef(0);

  const skinMat = useToonMaterial('#4a5c3a', hitFlashRef.current);
  const necroMat = useToonMaterial('#2e3d22', hitFlashRef.current);
  const clothMat = useToonMaterial('#1a1208', hitFlashRef.current);
  const clothTornMat = useToonMaterial('#120e06', hitFlashRef.current);
  const bloodMat = useToonMaterial('#8b0000', hitFlashRef.current);
  const boneMat = useToonMaterial('#c8c0b0', hitFlashRef.current);
  const teethMat = useToonMaterial('#d8d0b0', hitFlashRef.current);
  const outlineMat = useOutlineMaterial(0.09);
  const outlineThickMat = useOutlineMaterial(0.12);

  const eyeGlowMat = useRef<THREE.MeshBasicMaterial | null>(null);
  if (!eyeGlowMat.current) {
    eyeGlowMat.current = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2200') });
  }
  const eyeSocketMat = useRef<THREE.MeshBasicMaterial | null>(null);
  if (!eyeSocketMat.current) {
    eyeSocketMat.current = new THREE.MeshBasicMaterial({ color: new THREE.Color('#0a0000') });
  }

  // Falling limbs for boss
  const [fallingLimbs, setFallingLimbs] = useState<Array<{
    id: number;
    position: [number, number, number];
    color: string;
    limbType: 'arm' | 'leg' | 'head';
  }>>([]);
  const prevDismember = useRef({
    headDetached: false,
    leftArmDetached: false,
    rightArmDetached: false,
    leftLegDetached: false,
    rightLegDetached: false,
  });
  const fallingLimbIdRef = useRef(0);

  useEffect(() => {
    const prev = prevDismember.current;
    const [ex, ey, ez] = enemy.position;

    const spawnLimb = (
      offsetX: number, offsetY: number, offsetZ: number,
      color: string, limbType: 'arm' | 'leg' | 'head'
    ) => {
      setFallingLimbs(p => [...p, {
        id: fallingLimbIdRef.current++,
        position: [
          ex + offsetX + (Math.random() - 0.5) * 0.4,
          ey + offsetY,
          ez + offsetZ + (Math.random() - 0.5) * 0.4,
        ],
        color,
        limbType,
      }]);
    };

    if (enemy.headDetached && !prev.headDetached) spawnLimb(0, 2.4, 0, '#4a5c3a', 'head');
    if (enemy.leftArmDetached && !prev.leftArmDetached) spawnLimb(-0.9, 1.6, 0, '#1a1208', 'arm');
    if (enemy.rightArmDetached && !prev.rightArmDetached) spawnLimb(0.9, 1.6, 0, '#1a1208', 'arm');
    if (enemy.leftLegDetached && !prev.leftLegDetached) spawnLimb(-0.3, 0.8, 0, '#120e06', 'leg');
    if (enemy.rightLegDetached && !prev.rightLegDetached) spawnLimb(0.3, 0.8, 0, '#120e06', 'leg');

    prevDismember.current = {
      headDetached: !!enemy.headDetached,
      leftArmDetached: !!enemy.leftArmDetached,
      rightArmDetached: !!enemy.rightArmDetached,
      leftLegDetached: !!enemy.leftLegDetached,
      rightLegDetached: !!enemy.rightLegDetached,
    };
  }, [
    enemy.headDetached, enemy.leftArmDetached, enemy.rightArmDetached,
    enemy.leftLegDetached, enemy.rightLegDetached,
    enemy.position,
  ]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const [tx, ty, tz] = enemy.position;
    groupRef.current.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(delta * 8, 1));

    if (!enemy.isDead) {
      const [px, , pz] = playerPositionRef.current;
      const dx = px - tx;
      const dz = pz - tz;
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        groupRef.current.rotation.y = Math.atan2(dx, dz);
      }

      const t = Date.now() * 0.001;
      const bob = Math.sin(t * 4) * 0.1;
      groupRef.current.position.y = ty + bob;

      if (torsoRef.current) {
        torsoRef.current.rotation.x = 0.28 + Math.sin(t * 2) * 0.05;
      }
      if (!enemy.leftArmDetached && leftArmRef.current) {
        leftArmRef.current.rotation.x = -0.9 + Math.sin(t * 4) * 0.15;
        leftArmRef.current.rotation.z = 0.2 + Math.sin(t * 2) * 0.05;
      }
      if (!enemy.rightArmDetached && rightArmRef.current) {
        rightArmRef.current.rotation.x = -0.9 - Math.sin(t * 4) * 0.15;
        rightArmRef.current.rotation.z = -0.2 - Math.sin(t * 2) * 0.05;
      }
      if (!enemy.leftLegDetached && leftLegRef.current) {
        leftLegRef.current.rotation.x = Math.sin(t * 4) * 0.3;
      }
      if (!enemy.rightLegDetached && rightLegRef.current) {
        rightLegRef.current.rotation.x = -Math.sin(t * 4) * 0.3;
      }
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
      groupRef.current.traverse(child => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.Material).opacity = Math.max(0, 1 - elapsed * 1.0);
          (child.material as THREE.Material).transparent = true;
        }
      });
    }
  });

  return (
    <>
      {fallingLimbs.map(limb => (
        <FallingLimb
          key={limb.id}
          startPosition={limb.position}
          color={limb.color}
          limbType={limb.limbType}
          onComplete={() => setFallingLimbs(p => p.filter(l => l.id !== limb.id))}
        />
      ))}

      <group ref={groupRef} position={enemy.position}>

        {/* ── TORSO GROUP ── */}
        <group ref={torsoRef} position={[0, 0.2, 0]} rotation={[0.28, 0, 0]}>

          {/* Main torso — wide and bulky */}
          <mesh material={skinMat} position={[0, 0, 0]}>
            <boxGeometry args={[1.3, 1.4, 0.7]} />
          </mesh>
          <mesh material={outlineMat} position={[0, 0, 0]}>
            <boxGeometry args={[1.3, 1.4, 0.7]} />
          </mesh>

          {/* Torn clothing */}
          <mesh material={clothMat} position={[0, 0.1, 0.36]}>
            <boxGeometry args={[1.1, 1.1, 0.02]} />
          </mesh>
          <mesh material={clothTornMat} position={[-0.6, -0.3, 0]}>
            <boxGeometry args={[0.08, 0.6, 0.72]} />
          </mesh>
          <mesh material={clothTornMat} position={[0.6, -0.3, 0]}>
            <boxGeometry args={[0.08, 0.6, 0.72]} />
          </mesh>

          {/* Exposed ribs */}
          {[-0.28, -0.1, 0.08, 0.26, 0.44].map((yOff, i) => (
            <group key={i}>
              <mesh material={boneMat} position={[-0.38, yOff, 0.36]} rotation={[0, 0, 0.3]}>
                <boxGeometry args={[0.32, 0.06, 0.04]} />
              </mesh>
              <mesh material={boneMat} position={[0.38, yOff, 0.36]} rotation={[0, 0, -0.3]}>
                <boxGeometry args={[0.32, 0.06, 0.04]} />
              </mesh>
            </group>
          ))}
          <mesh material={boneMat} position={[0, 0.08, 0.38]}>
            <boxGeometry args={[0.08, 0.7, 0.04]} />
          </mesh>

          {/* Blood on chest */}
          <mesh material={bloodMat} position={[0.2, 0.2, 0.38]}>
            <boxGeometry args={[0.3, 0.4, 0.01]} />
          </mesh>
          <mesh material={bloodMat} position={[-0.3, -0.1, 0.38]}>
            <boxGeometry args={[0.22, 0.28, 0.01]} />
          </mesh>
          {/* Wound holes */}
          <mesh position={[0.0, 0.15, 0.39]}>
            <circleGeometry args={[0.07, 8]} />
            <primitive object={eyeSocketMat.current} attach="material" />
          </mesh>

          {/* Asymmetric shoulders */}
          <mesh material={necroMat} position={[-0.78, 0.5, 0]}>
            <boxGeometry args={[0.42, 0.38, 0.6]} />
          </mesh>
          <mesh material={outlineMat} position={[-0.78, 0.5, 0]}>
            <boxGeometry args={[0.42, 0.38, 0.6]} />
          </mesh>
          <mesh material={boneMat} position={[-0.9, 0.72, 0]}>
            <boxGeometry args={[0.1, 0.22, 0.1]} />
          </mesh>
          <mesh material={necroMat} position={[0.72, 0.38, 0]}>
            <boxGeometry args={[0.36, 0.3, 0.56]} />
          </mesh>
          <mesh material={outlineMat} position={[0.72, 0.38, 0]}>
            <boxGeometry args={[0.36, 0.3, 0.56]} />
          </mesh>

          {/* Neck */}
          <mesh material={skinMat} position={[0, 0.82, -0.05]}>
            <boxGeometry args={[0.38, 0.28, 0.36]} />
          </mesh>

          {/* Neck stump when head detached */}
          {enemy.headDetached && (
            <mesh material={bloodMat} position={[0, 1.0, -0.05]}>
              <cylinderGeometry args={[0.16, 0.19, 0.14, 8]} />
            </mesh>
          )}

          {/* ── HEAD GROUP ── */}
          {!enemy.headDetached && (
            <group position={[0, 1.22, -0.08]}>
              <mesh material={skinMat} position={[0, 0, 0]} userData={{ isHead: true }}>
                <boxGeometry args={[0.92, 0.96, 0.82]} />
              </mesh>
              <mesh material={outlineThickMat} position={[0, 0, 0]}>
                <boxGeometry args={[0.92, 0.96, 0.82]} />
              </mesh>

              {/* Deformed skull bump */}
              <mesh material={necroMat} position={[-0.3, 0.42, 0]}>
                <boxGeometry args={[0.38, 0.28, 0.7]} />
              </mesh>

              {/* Massive jaw */}
              <mesh material={skinMat} position={[0, -0.42, 0.08]}>
                <boxGeometry args={[0.78, 0.28, 0.7]} />
              </mesh>

              {/* Gaping mouth */}
              <mesh position={[0, -0.38, 0.42]}>
                <boxGeometry args={[0.5, 0.14, 0.04]} />
                <primitive object={eyeSocketMat.current} attach="material" />
              </mesh>
              {/* Teeth */}
              {[-0.18, -0.08, 0.02, 0.12, 0.22].map((tx, i) => (
                <mesh key={i} material={teethMat} position={[tx, -0.34, 0.43]}>
                  <boxGeometry args={[0.07, 0.1, 0.03]} />
                </mesh>
              ))}

              {/* Brow ridge */}
              <mesh material={necroMat} position={[0, 0.22, 0.42]}>
                <boxGeometry args={[0.86, 0.12, 0.06]} />
              </mesh>

              {/* Eye sockets */}
              <mesh position={[-0.22, 0.1, 0.42]}>
                <boxGeometry args={[0.22, 0.2, 0.06]} />
                <primitive object={eyeSocketMat.current} attach="material" />
              </mesh>
              <mesh position={[0.22, 0.1, 0.42]}>
                <boxGeometry args={[0.22, 0.2, 0.06]} />
                <primitive object={eyeSocketMat.current} attach="material" />
              </mesh>
              {/* Glowing red eyes */}
              <mesh position={[-0.22, 0.1, 0.46]}>
                <sphereGeometry args={[0.08, 6, 6]} />
                <primitive object={eyeGlowMat.current} attach="material" />
              </mesh>
              <mesh position={[0.22, 0.1, 0.46]}>
                <sphereGeometry args={[0.08, 6, 6]} />
                <primitive object={eyeGlowMat.current} attach="material" />
              </mesh>

              {/* Blood on face */}
              <mesh material={bloodMat} position={[0.1, -0.1, 0.42]}>
                <boxGeometry args={[0.2, 0.3, 0.02]} />
              </mesh>
              <mesh material={bloodMat} position={[-0.2, 0.05, 0.42]}>
                <boxGeometry args={[0.14, 0.18, 0.02]} />
              </mesh>

              {/* Boss horns */}
              <mesh material={necroMat} position={[-0.2, 0.56, 0]}>
                <coneGeometry args={[0.08, 0.32, 6]} />
              </mesh>
              <mesh material={necroMat} position={[0.2, 0.56, 0]}>
                <coneGeometry args={[0.08, 0.32, 6]} />
              </mesh>
              <mesh material={bloodMat} position={[0, 0.62, 0]}>
                <coneGeometry args={[0.06, 0.42, 6]} />
              </mesh>
            </group>
          )}

          {/* ── LEFT ARM ── */}
          {!enemy.leftArmDetached ? (
            <group ref={leftArmRef} position={[-0.82, 0.4, 0]} rotation={[-0.9, 0, 0.2]}>
              <mesh material={necroMat} position={[0, -0.3, 0]}>
                <boxGeometry args={[0.38, 0.58, 0.38]} />
              </mesh>
              <mesh material={skinMat} position={[0, -0.72, 0]}>
                <boxGeometry args={[0.32, 0.5, 0.32]} />
              </mesh>
              {/* Massive claw hand */}
              <mesh material={necroMat} position={[0, -1.06, 0]}>
                <boxGeometry args={[0.3, 0.24, 0.2]} />
              </mesh>
              {[-0.1, -0.03, 0.04, 0.11].map((fx, i) => (
                <mesh key={i} material={boneMat} position={[fx, -1.24, 0]}>
                  <boxGeometry args={[0.04, 0.18, 0.04]} />
                </mesh>
              ))}
              {/* Blood on arm */}
              <mesh material={bloodMat} position={[0.16, -0.6, 0.16]}>
                <boxGeometry args={[0.06, 0.2, 0.03]} />
              </mesh>
              <mesh material={outlineMat} position={[0, -0.55, 0]}>
                <boxGeometry args={[0.42, 1.1, 0.42]} />
              </mesh>
            </group>
          ) : (
            <mesh material={bloodMat} position={[-0.82, 0.4, 0]}>
              <sphereGeometry args={[0.2, 6, 6]} />
            </mesh>
          )}

          {/* ── RIGHT ARM ── */}
          {!enemy.rightArmDetached ? (
            <group ref={rightArmRef} position={[0.82, 0.4, 0]} rotation={[-0.9, 0, -0.2]}>
              <mesh material={necroMat} position={[0, -0.3, 0]}>
                <boxGeometry args={[0.38, 0.58, 0.38]} />
              </mesh>
              <mesh material={skinMat} position={[0, -0.72, 0]}>
                <boxGeometry args={[0.32, 0.5, 0.32]} />
              </mesh>
              <mesh material={necroMat} position={[0, -1.06, 0]}>
                <boxGeometry args={[0.3, 0.24, 0.2]} />
              </mesh>
              {[-0.1, -0.03, 0.04, 0.11].map((fx, i) => (
                <mesh key={i} material={boneMat} position={[fx, -1.24, 0]}>
                  <boxGeometry args={[0.04, 0.18, 0.04]} />
                </mesh>
              ))}
              <mesh material={outlineMat} position={[0, -0.55, 0]}>
                <boxGeometry args={[0.42, 1.1, 0.42]} />
              </mesh>
            </group>
          ) : (
            <mesh material={bloodMat} position={[0.82, 0.4, 0]}>
              <sphereGeometry args={[0.2, 6, 6]} />
            </mesh>
          )}
        </group>

        {/* ── PELVIS ── */}
        <mesh material={clothMat} position={[0, -0.6, 0]}>
          <boxGeometry args={[1.1, 0.4, 0.6]} />
        </mesh>

        {/* ── LEFT LEG ── */}
        {!enemy.leftLegDetached ? (
          <group ref={leftLegRef} position={[-0.32, -1.0, 0]}>
            <mesh material={clothTornMat} position={[0, -0.3, 0]}>
              <boxGeometry args={[0.44, 0.58, 0.44]} />
            </mesh>
            <mesh material={clothTornMat} position={[0, -0.76, 0]}>
              <boxGeometry args={[0.38, 0.5, 0.38]} />
            </mesh>
            {/* Exposed bone */}
            <mesh material={boneMat} position={[0.1, -0.7, 0.2]}>
              <boxGeometry args={[0.05, 0.28, 0.04]} />
            </mesh>
            <mesh material={necroMat} position={[0, -1.1, 0.08]}>
              <boxGeometry args={[0.42, 0.24, 0.5]} />
            </mesh>
            <mesh material={outlineMat} position={[0, -0.66, 0]}>
              <boxGeometry args={[0.48, 1.1, 0.48]} />
            </mesh>
          </group>
        ) : (
          <mesh material={bloodMat} position={[-0.32, -1.0, 0]}>
            <cylinderGeometry args={[0.18, 0.2, 0.2, 8]} />
          </mesh>
        )}

        {/* ── RIGHT LEG ── */}
        {!enemy.rightLegDetached ? (
          <group ref={rightLegRef} position={[0.32, -1.0, 0]}>
            <mesh material={clothTornMat} position={[0, -0.3, 0]}>
              <boxGeometry args={[0.44, 0.58, 0.44]} />
            </mesh>
            <mesh material={clothTornMat} position={[0, -0.76, 0]}>
              <boxGeometry args={[0.38, 0.5, 0.38]} />
            </mesh>
            <mesh material={necroMat} position={[0, -1.1, 0.08]}>
              <boxGeometry args={[0.42, 0.24, 0.5]} />
            </mesh>
            <mesh material={outlineMat} position={[0, -0.66, 0]}>
              <boxGeometry args={[0.48, 1.1, 0.48]} />
            </mesh>
          </group>
        ) : (
          <mesh material={bloodMat} position={[0.32, -1.0, 0]}>
            <cylinderGeometry args={[0.18, 0.2, 0.2, 8]} />
          </mesh>
        )}

      </group>
    </>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export function EnemyMesh({ enemy, onHitFlashDone, playerPositionRef }: EnemyMeshProps) {
  if (enemy.type === 'boss') {
    return <BossZombie enemy={enemy} onHitFlashDone={onHitFlashDone} playerPositionRef={playerPositionRef} />;
  }
  return <StandardZombie enemy={enemy} onHitFlashDone={onHitFlashDone} playerPositionRef={playerPositionRef} />;
}
