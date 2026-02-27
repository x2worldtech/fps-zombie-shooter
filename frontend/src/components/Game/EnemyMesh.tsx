import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Enemy } from '../../types/enemy';
import { useToonMaterial, useOutlineMaterial } from './ToonMaterial';

interface EnemyMeshProps {
  enemy: Enemy;
  onHitFlashDone: (id: string) => void;
  playerPositionRef: React.MutableRefObject<[number, number, number]>;
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
  const skinMat = useToonMaterial('#8fa88a', hitFlashRef.current);
  // Clothing: dark brown/black torn rags
  const clothMat = useToonMaterial('#2e2318', hitFlashRef.current);
  // Blood accents: dark red
  const bloodMat = useToonMaterial('#5a0a0a', hitFlashRef.current);
  // Eye sockets: very dark recessed
  const eyeMat = useToonMaterial('#0d0d0d', hitFlashRef.current);
  // Outline
  const outlineMat = useOutlineMaterial(0.055);
  const outlineThickMat = useOutlineMaterial(0.07);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const [tx, ty, tz] = enemy.position;
    groupRef.current.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(delta * 12, 1));

    if (!enemy.isDead) {
      // Rotate zombie to face the player — Y-axis only (no pitch/roll)
      const [px, , pz] = playerPositionRef.current;
      const dx = px - tx;
      const dz = pz - tz;
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        groupRef.current.rotation.y = Math.atan2(dx, dz);
      }

      const t = Date.now() * 0.001;
      // Walking bob
      const bob = Math.sin(t * 8) * 0.04;
      groupRef.current.position.y = ty + bob;

      // Torso forward lean (hunched CoD zombie posture)
      if (torsoRef.current) {
        torsoRef.current.rotation.x = 0.32 + Math.sin(t * 4) * 0.04;
      }

      // Arm swing — outstretched reaching forward like CoD zombie
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = -1.1 + Math.sin(t * 8) * 0.18;
        leftArmRef.current.rotation.z = 0.15 + Math.sin(t * 4) * 0.06;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -1.1 - Math.sin(t * 8) * 0.18;
        rightArmRef.current.rotation.z = -0.15 - Math.sin(t * 4) * 0.06;
      }

      // Leg walk cycle
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = Math.sin(t * 8) * 0.35;
      }
      if (rightLegRef.current) {
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

        {/* Torn shirt — dark cloth layer over torso */}
        <mesh material={clothMat} position={[0, 0.05, 0.18]}>
          <boxGeometry args={[0.58, 0.72, 0.02]} />
        </mesh>
        {/* Torn shirt side strips */}
        <mesh material={clothMat} position={[-0.32, -0.1, 0]}>
          <boxGeometry args={[0.02, 0.5, 0.36]} />
        </mesh>
        <mesh material={clothMat} position={[0.32, -0.1, 0]}>
          <boxGeometry args={[0.02, 0.5, 0.36]} />
        </mesh>
        {/* Blood stain on torso */}
        <mesh material={bloodMat} position={[0.1, 0.1, 0.19]}>
          <boxGeometry args={[0.18, 0.22, 0.01]} />
        </mesh>
        <mesh material={bloodMat} position={[-0.08, -0.15, 0.19]}>
          <boxGeometry args={[0.12, 0.14, 0.01]} />
        </mesh>

        {/* ── NECK ── */}
        <mesh material={skinMat} position={[0, 0.5, -0.04]}>
          <boxGeometry args={[0.2, 0.18, 0.2]} />
        </mesh>

        {/* ── HEAD GROUP ── */}
        <group position={[0, 0.72, -0.06]}>
          {/* Skull — slightly elongated, gaunt */}
          <mesh material={skinMat} position={[0, 0, 0]} userData={{ isHead: true }}>
            <boxGeometry args={[0.46, 0.52, 0.44]} />
          </mesh>
          <mesh material={outlineThickMat} position={[0, 0, 0]} userData={{ isHead: true }}>
            <boxGeometry args={[0.46, 0.52, 0.44]} />
          </mesh>

          {/* Jaw — slightly protruding lower jaw */}
          <mesh material={skinMat} position={[0, -0.2, 0.04]}>
            <boxGeometry args={[0.38, 0.16, 0.38]} />
          </mesh>

          {/* Left eye socket — sunken dark recess */}
          <mesh material={eyeMat} position={[-0.13, 0.06, 0.22]}>
            <boxGeometry args={[0.12, 0.1, 0.04]} />
          </mesh>
          {/* Right eye socket */}
          <mesh material={eyeMat} position={[0.13, 0.06, 0.22]}>
            <boxGeometry args={[0.12, 0.1, 0.04]} />
          </mesh>

          {/* Brow ridge — protruding bone */}
          <mesh material={skinMat} position={[0, 0.14, 0.22]}>
            <boxGeometry args={[0.42, 0.06, 0.04]} />
          </mesh>

          {/* Cheekbones — gaunt sunken cheeks */}
          <mesh material={skinMat} position={[-0.22, -0.02, 0.18]}>
            <boxGeometry args={[0.06, 0.1, 0.06]} />
          </mesh>
          <mesh material={skinMat} position={[0.22, -0.02, 0.18]}>
            <boxGeometry args={[0.06, 0.1, 0.06]} />
          </mesh>

          {/* Blood on face */}
          <mesh material={bloodMat} position={[-0.05, -0.1, 0.23]}>
            <boxGeometry args={[0.1, 0.12, 0.01]} />
          </mesh>
        </group>

        {/* ── LEFT ARM GROUP (outstretched reaching) ── */}
        <group ref={leftArmRef} position={[-0.38, 0.28, 0]} rotation={[-1.1, 0, 0.15]}>
          {/* Upper arm */}
          <mesh material={clothMat} position={[0, -0.2, 0]}>
            <boxGeometry args={[0.2, 0.38, 0.2]} />
          </mesh>
          {/* Forearm */}
          <mesh material={skinMat} position={[0, -0.52, 0]}>
            <boxGeometry args={[0.17, 0.34, 0.17]} />
          </mesh>
          {/* Hand */}
          <mesh material={skinMat} position={[0, -0.74, 0]}>
            <boxGeometry args={[0.16, 0.16, 0.1]} />
          </mesh>
          {/* Torn sleeve */}
          <mesh material={clothMat} position={[0.1, -0.38, 0.1]}>
            <boxGeometry args={[0.04, 0.18, 0.04]} />
          </mesh>
          <mesh material={outlineMat} position={[0, -0.35, 0]}>
            <boxGeometry args={[0.22, 0.72, 0.22]} />
          </mesh>
        </group>

        {/* ── RIGHT ARM GROUP (outstretched reaching) ── */}
        <group ref={rightArmRef} position={[0.38, 0.28, 0]} rotation={[-1.1, 0, -0.15]}>
          {/* Upper arm */}
          <mesh material={clothMat} position={[0, -0.2, 0]}>
            <boxGeometry args={[0.2, 0.38, 0.2]} />
          </mesh>
          {/* Forearm */}
          <mesh material={skinMat} position={[0, -0.52, 0]}>
            <boxGeometry args={[0.17, 0.34, 0.17]} />
          </mesh>
          {/* Hand */}
          <mesh material={skinMat} position={[0, -0.74, 0]}>
            <boxGeometry args={[0.16, 0.16, 0.1]} />
          </mesh>
          {/* Torn sleeve */}
          <mesh material={clothMat} position={[-0.1, -0.38, 0.1]}>
            <boxGeometry args={[0.04, 0.18, 0.04]} />
          </mesh>
          <mesh material={outlineMat} position={[0, -0.35, 0]}>
            <boxGeometry args={[0.22, 0.72, 0.22]} />
          </mesh>
        </group>
      </group>

      {/* ── PELVIS / WAIST ── */}
      <mesh material={clothMat} position={[0, -0.42, 0]}>
        <boxGeometry args={[0.58, 0.22, 0.32]} />
      </mesh>

      {/* ── LEFT LEG GROUP ── */}
      <group ref={leftLegRef} position={[-0.18, -0.62, 0]}>
        {/* Thigh */}
        <mesh material={clothMat} position={[0, -0.2, 0]}>
          <boxGeometry args={[0.24, 0.38, 0.24]} />
        </mesh>
        {/* Shin */}
        <mesh material={clothMat} position={[0, -0.52, 0]}>
          <boxGeometry args={[0.2, 0.34, 0.2]} />
        </mesh>
        {/* Boot/foot */}
        <mesh material={eyeMat} position={[0, -0.74, 0.04]}>
          <boxGeometry args={[0.22, 0.14, 0.28]} />
        </mesh>
        <mesh material={outlineMat} position={[0, -0.44, 0]}>
          <boxGeometry args={[0.26, 0.76, 0.26]} />
        </mesh>
      </group>

      {/* ── RIGHT LEG GROUP ── */}
      <group ref={rightLegRef} position={[0.18, -0.62, 0]}>
        {/* Thigh */}
        <mesh material={clothMat} position={[0, -0.2, 0]}>
          <boxGeometry args={[0.24, 0.38, 0.24]} />
        </mesh>
        {/* Shin */}
        <mesh material={clothMat} position={[0, -0.52, 0]}>
          <boxGeometry args={[0.2, 0.34, 0.2]} />
        </mesh>
        {/* Boot/foot */}
        <mesh material={eyeMat} position={[0, -0.74, 0.04]}>
          <boxGeometry args={[0.22, 0.14, 0.28]} />
        </mesh>
        <mesh material={outlineMat} position={[0, -0.44, 0]}>
          <boxGeometry args={[0.26, 0.76, 0.26]} />
        </mesh>
      </group>

    </group>
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

  // Boss skin: darker, more decayed necrotic tone
  const skinMat = useToonMaterial('#5a6b55', hitFlashRef.current);
  // Darker necrotic patches
  const necroMat = useToonMaterial('#3a4535', hitFlashRef.current);
  // Clothing: very dark, heavily damaged
  const clothMat = useToonMaterial('#1a1208', hitFlashRef.current);
  // Blood: dark red
  const bloodMat = useToonMaterial('#6a0808', hitFlashRef.current);
  // Bone/rib: light grey exposed bone
  const boneMat = useToonMaterial('#c8c0b0', hitFlashRef.current);
  // Outline
  const outlineMat = useOutlineMaterial(0.09);
  const outlineThickMat = useOutlineMaterial(0.12);

  // Glowing red eye material (emissive, no lighting)
  const eyeGlowMat = useRef<THREE.MeshBasicMaterial | null>(null);
  if (!eyeGlowMat.current) {
    eyeGlowMat.current = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1a00') });
  }
  const eyeSocketMat = useRef<THREE.MeshBasicMaterial | null>(null);
  if (!eyeSocketMat.current) {
    eyeSocketMat.current = new THREE.MeshBasicMaterial({ color: new THREE.Color('#0a0000') });
  }

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const [tx, ty, tz] = enemy.position;
    groupRef.current.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(delta * 8, 1));

    if (!enemy.isDead) {
      // Rotate boss zombie to face the player — Y-axis only (no pitch/roll)
      const [px, , pz] = playerPositionRef.current;
      const dx = px - tx;
      const dz = pz - tz;
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        groupRef.current.rotation.y = Math.atan2(dx, dz);
      }

      const t = Date.now() * 0.001;
      // Slower, heavier bob
      const bob = Math.sin(t * 4) * 0.1;
      groupRef.current.position.y = ty + bob;

      // Heavy forward lean
      if (torsoRef.current) {
        torsoRef.current.rotation.x = 0.28 + Math.sin(t * 2) * 0.05;
      }

      // Massive arms reaching forward
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = -0.9 + Math.sin(t * 4) * 0.15;
        leftArmRef.current.rotation.z = 0.2 + Math.sin(t * 2) * 0.05;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -0.9 - Math.sin(t * 4) * 0.15;
        rightArmRef.current.rotation.z = -0.2 - Math.sin(t * 2) * 0.05;
      }

      // Heavy leg stomp
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = Math.sin(t * 4) * 0.3;
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = -Math.sin(t * 4) * 0.3;
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
      groupRef.current.scale.y = Math.max(0.01, 1 - elapsed * 0.8);
      groupRef.current.traverse(child => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.Material).opacity = Math.max(0, 1 - elapsed * 1.0);
          (child.material as THREE.Material).transparent = true;
        }
      });
    }
  });

  const healthPct = enemy.health / enemy.maxHealth;

  return (
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

        {/* Torn clothing on torso */}
        <mesh material={clothMat} position={[0, 0.1, 0.36]}>
          <boxGeometry args={[1.1, 1.1, 0.02]} />
        </mesh>
        {/* Torn cloth strips */}
        <mesh material={clothMat} position={[-0.6, -0.3, 0]}>
          <boxGeometry args={[0.08, 0.6, 0.72]} />
        </mesh>
        <mesh material={clothMat} position={[0.6, -0.3, 0]}>
          <boxGeometry args={[0.08, 0.6, 0.72]} />
        </mesh>

        {/* ── EXPOSED RIBS on chest ── */}
        {[-0.28, -0.1, 0.08, 0.26, 0.44].map((yOff, i) => (
          <group key={i}>
            {/* Left rib */}
            <mesh material={boneMat} position={[-0.38, yOff, 0.36]} rotation={[0, 0, 0.3]}>
              <boxGeometry args={[0.32, 0.06, 0.04]} />
            </mesh>
            {/* Right rib */}
            <mesh material={boneMat} position={[0.38, yOff, 0.36]} rotation={[0, 0, -0.3]}>
              <boxGeometry args={[0.32, 0.06, 0.04]} />
            </mesh>
          </group>
        ))}
        {/* Sternum bone */}
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

        {/* ── ASYMMETRIC SHOULDERS ── */}
        {/* Left shoulder — larger/higher (mutated) */}
        <mesh material={necroMat} position={[-0.78, 0.5, 0]}>
          <boxGeometry args={[0.42, 0.38, 0.6]} />
        </mesh>
        <mesh material={outlineMat} position={[-0.78, 0.5, 0]}>
          <boxGeometry args={[0.42, 0.38, 0.6]} />
        </mesh>
        {/* Shoulder spike/bone protrusion */}
        <mesh material={boneMat} position={[-0.9, 0.72, 0]}>
          <boxGeometry args={[0.1, 0.22, 0.1]} />
        </mesh>

        {/* Right shoulder — normal but still bulky */}
        <mesh material={necroMat} position={[0.72, 0.38, 0]}>
          <boxGeometry args={[0.36, 0.3, 0.56]} />
        </mesh>
        <mesh material={outlineMat} position={[0.72, 0.38, 0]}>
          <boxGeometry args={[0.36, 0.3, 0.56]} />
        </mesh>

        {/* ── NECK ── */}
        <mesh material={skinMat} position={[0, 0.82, -0.05]}>
          <boxGeometry args={[0.38, 0.28, 0.36]} />
        </mesh>

        {/* ── HEAD GROUP — deformed oversized skull ── */}
        <group position={[0, 1.22, -0.08]}>
          {/* Main skull — wider and taller, deformed */}
          <mesh material={skinMat} position={[0, 0, 0]} userData={{ isHead: true }}>
            <boxGeometry args={[0.92, 0.96, 0.82]} />
          </mesh>
          <mesh material={outlineThickMat} position={[0, 0, 0]} userData={{ isHead: true }}>
            <boxGeometry args={[0.92, 0.96, 0.82]} />
          </mesh>

          {/* Deformed skull bump — asymmetric protrusion */}
          <mesh material={necroMat} position={[-0.3, 0.42, 0]}>
            <boxGeometry args={[0.38, 0.28, 0.7]} />
          </mesh>

          {/* Jaw — massive protruding jaw */}
          <mesh material={skinMat} position={[0, -0.42, 0.08]}>
            <boxGeometry args={[0.78, 0.28, 0.7]} />
          </mesh>

          {/* Brow ridge — heavy protruding bone */}
          <mesh material={necroMat} position={[0, 0.22, 0.42]}>
            <boxGeometry args={[0.86, 0.1, 0.08]} />
          </mesh>

          {/* Left eye socket — deep sunken */}
          <mesh material={eyeSocketMat.current!} position={[-0.24, 0.1, 0.42]}>
            <boxGeometry args={[0.22, 0.2, 0.06]} />
          </mesh>
          {/* Left glowing eye */}
          <mesh material={eyeGlowMat.current!} position={[-0.24, 0.1, 0.44]}>
            <sphereGeometry args={[0.08, 6, 6]} />
          </mesh>

          {/* Right eye socket — deep sunken */}
          <mesh material={eyeSocketMat.current!} position={[0.24, 0.1, 0.42]}>
            <boxGeometry args={[0.22, 0.2, 0.06]} />
          </mesh>
          {/* Right glowing eye */}
          <mesh material={eyeGlowMat.current!} position={[0.24, 0.1, 0.44]}>
            <sphereGeometry args={[0.08, 6, 6]} />
          </mesh>

          {/* Cheekbones — massive protruding */}
          <mesh material={necroMat} position={[-0.44, -0.08, 0.36]}>
            <boxGeometry args={[0.1, 0.18, 0.1]} />
          </mesh>
          <mesh material={necroMat} position={[0.44, -0.08, 0.36]}>
            <boxGeometry args={[0.1, 0.18, 0.1]} />
          </mesh>

          {/* Blood on face */}
          <mesh material={bloodMat} position={[0, -0.2, 0.42]}>
            <boxGeometry args={[0.3, 0.18, 0.01]} />
          </mesh>
          <mesh material={bloodMat} position={[-0.2, 0.05, 0.42]}>
            <boxGeometry args={[0.14, 0.22, 0.01]} />
          </mesh>
        </group>

        {/* ── LEFT ARM GROUP — elongated clawed ── */}
        <group ref={leftArmRef} position={[-0.82, 0.3, 0]} rotation={[-0.9, 0, 0.2]}>
          {/* Upper arm */}
          <mesh material={skinMat} position={[0, -0.28, 0]}>
            <boxGeometry args={[0.34, 0.54, 0.34]} />
          </mesh>
          {/* Forearm */}
          <mesh material={necroMat} position={[0, -0.72, 0]}>
            <boxGeometry args={[0.28, 0.46, 0.28]} />
          </mesh>
          {/* Hand/claw */}
          <mesh material={boneMat} position={[0, -1.06, 0]}>
            <boxGeometry args={[0.3, 0.22, 0.18]} />
          </mesh>
          {/* Claw fingers */}
          {[-0.1, 0, 0.1].map((xOff, i) => (
            <mesh key={i} material={boneMat} position={[xOff, -1.24, 0.04]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.06, 0.18, 0.06]} />
            </mesh>
          ))}
          <mesh material={outlineMat} position={[0, -0.6, 0]}>
            <boxGeometry args={[0.36, 1.1, 0.36]} />
          </mesh>
        </group>

        {/* ── RIGHT ARM GROUP — elongated clawed ── */}
        <group ref={rightArmRef} position={[0.82, 0.3, 0]} rotation={[-0.9, 0, -0.2]}>
          {/* Upper arm */}
          <mesh material={skinMat} position={[0, -0.28, 0]}>
            <boxGeometry args={[0.34, 0.54, 0.34]} />
          </mesh>
          {/* Forearm */}
          <mesh material={necroMat} position={[0, -0.72, 0]}>
            <boxGeometry args={[0.28, 0.46, 0.28]} />
          </mesh>
          {/* Hand/claw */}
          <mesh material={boneMat} position={[0, -1.06, 0]}>
            <boxGeometry args={[0.3, 0.22, 0.18]} />
          </mesh>
          {/* Claw fingers */}
          {[-0.1, 0, 0.1].map((xOff, i) => (
            <mesh key={i} material={boneMat} position={[xOff, -1.24, 0.04]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.06, 0.18, 0.06]} />
            </mesh>
          ))}
          <mesh material={outlineMat} position={[0, -0.6, 0]}>
            <boxGeometry args={[0.36, 1.1, 0.36]} />
          </mesh>
        </group>
      </group>

      {/* ── PELVIS / WAIST ── */}
      <mesh material={clothMat} position={[0, -0.72, 0]}>
        <boxGeometry args={[1.1, 0.38, 0.62]} />
      </mesh>

      {/* ── LEFT LEG GROUP ── */}
      <group ref={leftLegRef} position={[-0.32, -1.1, 0]}>
        {/* Thigh */}
        <mesh material={clothMat} position={[0, -0.28, 0]}>
          <boxGeometry args={[0.42, 0.54, 0.42]} />
        </mesh>
        {/* Shin */}
        <mesh material={clothMat} position={[0, -0.74, 0]}>
          <boxGeometry args={[0.36, 0.46, 0.36]} />
        </mesh>
        {/* Boot/foot */}
        <mesh material={eyeSocketMat.current!} position={[0, -1.06, 0.08]}>
          <boxGeometry args={[0.4, 0.22, 0.5]} />
        </mesh>
        <mesh material={outlineMat} position={[0, -0.62, 0]}>
          <boxGeometry args={[0.44, 1.1, 0.44]} />
        </mesh>
      </group>

      {/* ── RIGHT LEG GROUP ── */}
      <group ref={rightLegRef} position={[0.32, -1.1, 0]}>
        {/* Thigh */}
        <mesh material={clothMat} position={[0, -0.28, 0]}>
          <boxGeometry args={[0.42, 0.54, 0.42]} />
        </mesh>
        {/* Shin */}
        <mesh material={clothMat} position={[0, -0.74, 0]}>
          <boxGeometry args={[0.36, 0.46, 0.36]} />
        </mesh>
        {/* Boot/foot */}
        <mesh material={eyeSocketMat.current!} position={[0, -1.06, 0.08]}>
          <boxGeometry args={[0.4, 0.22, 0.5]} />
        </mesh>
        <mesh material={outlineMat} position={[0, -0.62, 0]}>
          <boxGeometry args={[0.44, 1.1, 0.44]} />
        </mesh>
      </group>

      {/* ── FLOATING HEALTH BAR ── */}
      <group position={[0, 3.2, 0]}>
        {/* Background bar */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.4, 0.18]} />
          <meshBasicMaterial color="#1a0000" />
        </mesh>
        {/* Health fill */}
        <mesh position={[(healthPct - 1) * 0.7, 0, 0.001]}>
          <planeGeometry args={[1.4 * healthPct, 0.14]} />
          <meshBasicMaterial color={healthPct > 0.5 ? '#22cc44' : healthPct > 0.25 ? '#ffaa00' : '#ff2200'} />
        </mesh>
      </group>

    </group>
  );
}

// ─── Public EnemyMesh dispatcher ─────────────────────────────────────────────
export function EnemyMesh({ enemy, onHitFlashDone, playerPositionRef }: EnemyMeshProps) {
  if (enemy.type === 'boss') {
    return <BossZombie enemy={enemy} onHitFlashDone={onHitFlashDone} playerPositionRef={playerPositionRef} />;
  }
  return <StandardZombie enemy={enemy} onHitFlashDone={onHitFlashDone} playerPositionRef={playerPositionRef} />;
}
