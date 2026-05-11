import { useFrame } from "@react-three/fiber";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Enemy } from "../../types/enemy";
import { useStandardMaterial } from "./ToonMaterial";

interface EnemyMeshProps {
  enemy: Enemy;
  onHitFlashDone: (id: string) => void;
  playerPositionRef: React.MutableRefObject<[number, number, number]>;
}

// ─── Shared subassemblies ─────────────────────────────────────────────────────

/**
 * Realistischer Stumpf mit sichtbarem Knochen-Querschnitt + Fleisch-Ring + tropfendem Blut.
 * Wird sowohl von intakten/abgetrennten Limbs als auch vom Hals genutzt.
 */
const Stump: React.FC<{
  position: [number, number, number];
  radius?: number;
  showBoneCore?: boolean;
  bloodMat: THREE.Material;
  boneMat: THREE.Material;
  fleshMat: THREE.Material;
  drip?: boolean;
}> = ({
  position,
  radius = 0.1,
  showBoneCore = true,
  bloodMat,
  boneMat,
  fleshMat,
  drip = true,
}) => {
  // Mehrere Schichten: rohes Fleisch außen → Knochenkern in der Mitte
  return (
    <group position={position}>
      {/* Außenschicht — frisches rohes Fleisch */}
      <mesh material={fleshMat}>
        <sphereGeometry args={[radius * 1.05, 8, 6]} />
      </mesh>
      {/* Innerer Bluttropfen-Klumpen */}
      <mesh material={bloodMat} position={[0, -radius * 0.2, 0]}>
        <sphereGeometry args={[radius * 0.85, 8, 6]} />
      </mesh>
      {/* Knochen-Querschnitt sichtbar */}
      {showBoneCore && (
        <mesh material={boneMat} position={[0, radius * 0.05, 0]}>
          <cylinderGeometry args={[radius * 0.35, radius * 0.35, radius * 0.12, 8]} />
        </mesh>
      )}
      {/* Tropfender Blut-Strang nach unten */}
      {drip && (
        <mesh material={bloodMat} position={[0, -radius * 0.85, 0]}>
          <capsuleGeometry args={[radius * 0.18, radius * 0.7, 3, 6]} />
        </mesh>
      )}
    </group>
  );
};

// ─── Falling Limb (mit Blut-Trail) ────────────────────────────────────────────
interface FallingLimbProps {
  startPosition: [number, number, number];
  color: string;
  limbType: "arm" | "leg" | "head";
  onComplete: () => void;
}

function FallingLimb({
  startPosition,
  color,
  limbType,
  onComplete,
}: FallingLimbProps) {
  const groupRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const TRAIL_COUNT = 12;

  const velRef = useRef(
    new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      2.5 + Math.random() * 2,
      (Math.random() - 0.5) * 5,
    ),
  );
  const angVelRef = useRef(
    new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
    ),
  );
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);
  // Trail-Positionen (Ring-Buffer)
  const trailPositions = useRef<{ pos: THREE.Vector3; age: number }[]>([]);
  const lastTrailTime = useRef(0);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const zeroMatrix = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);

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

    // Blut-Trail nur in der Luft & nicht zu oft
    lastTrailTime.current += delta;
    if (
      groupRef.current.position.y > 0.2 &&
      lastTrailTime.current > 0.04 &&
      trailPositions.current.length < TRAIL_COUNT
    ) {
      lastTrailTime.current = 0;
      trailPositions.current.push({
        pos: groupRef.current.position.clone(),
        age: 0,
      });
    }
    // Update + render trail
    if (trailRef.current) {
      let i = 0;
      for (const t of trailPositions.current) {
        t.age += delta;
        const fade = Math.max(0, 1 - t.age / 1.0);
        const s = 0.06 * fade;
        if (s > 0.001) {
          dummy.position.copy(t.pos);
          dummy.position.y -= t.age * 1.5; // tropft nach unten
          dummy.scale.set(s, s * 2.2, s);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          trailRef.current.setMatrixAt(i, dummy.matrix);
        } else {
          trailRef.current.setMatrixAt(i, zeroMatrix);
        }
        i++;
      }
      for (; i < TRAIL_COUNT; i++) {
        trailRef.current.setMatrixAt(i, zeroMatrix);
      }
      trailRef.current.instanceMatrix.needsUpdate = true;
    }

    if (elapsedRef.current > 2.5 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <>
      {/* Blut-Trail (separates Mesh, kein Parenting an die Limb) */}
      <instancedMesh
        ref={trailRef}
        args={[undefined, undefined, TRAIL_COUNT]}
        frustumCulled={false}
      >
        <capsuleGeometry args={[0.5, 1.0, 3, 5]} />
        <meshStandardMaterial
          color="#8a0000"
          roughness={0.4}
          emissive="#220000"
          emissiveIntensity={0.3}
        />
      </instancedMesh>

      <group ref={groupRef} position={startPosition}>
        {limbType === "head" && (
          <>
            {/* Schädel mit Wunden */}
            <mesh>
              <boxGeometry args={[0.36, 0.38, 0.32]} />
              <meshStandardMaterial color={color} roughness={0.85} />
            </mesh>
            {/* Sichtbarer Hals-Stumpf an der Unterseite */}
            <mesh position={[0, -0.18, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.08, 8]} />
              <meshStandardMaterial color="#6a0000" roughness={0.5} />
            </mesh>
            {/* Knochenkern */}
            <mesh position={[0, -0.14, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.06, 6]} />
              <meshStandardMaterial color="#d4c89a" roughness={0.8} />
            </mesh>
            {/* Blut auf Stirn */}
            <mesh position={[0, 0.1, 0.17]}>
              <boxGeometry args={[0.16, 0.1, 0.01]} />
              <meshStandardMaterial color="#6a0000" roughness={0.4} />
            </mesh>
          </>
        )}
        {limbType === "arm" && (
          <>
            <mesh>
              <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
              <meshStandardMaterial color={color} roughness={0.85} />
            </mesh>
            {/* Bluiger Stumpf am oberen Ende */}
            <mesh position={[0, 0.32, 0]}>
              <sphereGeometry args={[0.1, 8, 6]} />
              <meshStandardMaterial color="#6a0000" roughness={0.5} />
            </mesh>
            {/* Knochen ragt aus Stumpf */}
            <mesh position={[0, 0.39, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.1, 6]} />
              <meshStandardMaterial color="#d4c89a" roughness={0.8} />
            </mesh>
          </>
        )}
        {limbType === "leg" && (
          <>
            <mesh>
              <capsuleGeometry args={[0.09, 0.6, 4, 8]} />
              <meshStandardMaterial color={color} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[0.12, 8, 6]} />
              <meshStandardMaterial color="#6a0000" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.48, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.12, 6]} />
              <meshStandardMaterial color="#d4c89a" roughness={0.8} />
            </mesh>
          </>
        )}
      </group>
    </>
  );
}

// ─── Standard Zombie ──────────────────────────────────────────────────────────
function StandardZombie({
  enemy,
  onHitFlashDone,
  playerPositionRef,
}: EnemyMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const hitFlashRef = useRef(0);

  // Material-Palette — leicht differenzierter
  const skinMat = useStandardMaterial("#7a9470", hitFlashRef.current);
  const skinPaleMat = useStandardMaterial("#92a888", hitFlashRef.current);
  const necroMat = useStandardMaterial("#3d5238", hitFlashRef.current);
  const necroDeepMat = useStandardMaterial("#26321f", hitFlashRef.current);
  const clothMat = useStandardMaterial("#2e2318", hitFlashRef.current);
  const clothTornMat = useStandardMaterial("#1e1510", hitFlashRef.current);
  const bloodMat = useStandardMaterial("#6a0000", hitFlashRef.current);
  const bloodFreshMat = useStandardMaterial("#8a0a0a", hitFlashRef.current);
  const fleshMat = useStandardMaterial("#5a1010", hitFlashRef.current);
  const eyeMat = useStandardMaterial("#0d0d0d", hitFlashRef.current);
  const boneMat = useStandardMaterial("#d4c89a", hitFlashRef.current);
  const teethMat = useStandardMaterial("#a89a70", hitFlashRef.current);

  // Leuchtende Augen — additives Material
  const eyeGlowMat = useRef<THREE.MeshBasicMaterial | null>(null);
  if (!eyeGlowMat.current) {
    eyeGlowMat.current = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffd400"),
    });
  }
  const eyeCoreMat = useRef<THREE.MeshBasicMaterial | null>(null);
  if (!eyeCoreMat.current) {
    eyeCoreMat.current = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffffff"),
    });
  }

  const allMats = [
    skinMat,
    skinPaleMat,
    necroMat,
    necroDeepMat,
    clothMat,
    clothTornMat,
    bloodMat,
    bloodFreshMat,
    fleshMat,
    boneMat,
    teethMat,
  ];

  const [fallingLimbs, setFallingLimbs] = useState<
    Array<{
      id: number;
      position: [number, number, number];
      color: string;
      limbType: "arm" | "leg" | "head";
    }>
  >([]);
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
      offsetX: number,
      offsetY: number,
      offsetZ: number,
      color: string,
      limbType: "arm" | "leg" | "head",
    ) => {
      setFallingLimbs((p) => [
        ...p,
        {
          id: fallingLimbIdRef.current++,
          position: [
            ex + offsetX + (Math.random() - 0.5) * 0.3,
            ey + offsetY,
            ez + offsetZ + (Math.random() - 0.5) * 0.3,
          ],
          color,
          limbType,
        },
      ]);
    };

    if (enemy.headDetached && !prev.headDetached) {
      spawnLimb(0, 1.7, 0, "#7a9470", "head");
    }
    if (enemy.leftArmDetached && !prev.leftArmDetached) {
      spawnLimb(-0.4, 1.1, 0, "#2e2318", "arm");
    }
    if (enemy.rightArmDetached && !prev.rightArmDetached) {
      spawnLimb(0.4, 1.1, 0, "#2e2318", "arm");
    }
    if (enemy.leftLegDetached && !prev.leftLegDetached) {
      spawnLimb(-0.18, 0.6, 0, "#1e1510", "leg");
    }
    if (enemy.rightLegDetached && !prev.rightLegDetached) {
      spawnLimb(0.18, 0.6, 0, "#1e1510", "leg");
    }

    prevDismember.current = {
      headDetached: !!enemy.headDetached,
      leftArmDetached: !!enemy.leftArmDetached,
      rightArmDetached: !!enemy.rightArmDetached,
      leftLegDetached: !!enemy.leftLegDetached,
      rightLegDetached: !!enemy.rightLegDetached,
    };
  }, [
    enemy.headDetached,
    enemy.leftArmDetached,
    enemy.rightArmDetached,
    enemy.leftLegDetached,
    enemy.rightLegDetached,
    enemy.position,
  ]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const [tx, ty, tz] = enemy.position;
    groupRef.current.position.lerp(
      new THREE.Vector3(tx, ty, tz),
      Math.min(delta * 12, 1),
    );

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
        // leichtes Schwanken
        torsoRef.current.rotation.z = Math.sin(t * 3.2) * 0.03;
      }
      // Kopf wackelt subtil
      if (headRef.current && !enemy.headDetached) {
        headRef.current.rotation.z = Math.sin(t * 5) * 0.08;
        headRef.current.rotation.x = Math.sin(t * 3) * 0.04;
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

    if (enemy.isHit) {
      hitFlashRef.current = Math.min(hitFlashRef.current + delta * 8, 1);
      for (const mat of allMats) {
        if (mat)
          mat.emissive.setRGB(
            hitFlashRef.current * 0.7,
            hitFlashRef.current * 0.05,
            hitFlashRef.current * 0.05,
          );
      }
      if (hitFlashRef.current >= 0.9) {
        onHitFlashDone(enemy.id);
        hitFlashRef.current = 0;
      }
    } else {
      hitFlashRef.current = Math.max(hitFlashRef.current - delta * 8, 0);
      for (const mat of allMats) {
        if (mat) mat.emissive.setRGB(0, 0, 0);
      }
    }

    if (enemy.isDead) {
      const elapsed = (Date.now() - enemy.deathTime) / 1000;
      const opacity = Math.max(0, 1 - elapsed * 1.5);
      groupRef.current.scale.y = Math.max(0.01, 1 - elapsed * 1.2);
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.Material).opacity = opacity;
          (child.material as THREE.Material).transparent = true;
        }
      });
    }
  });

  return (
    <>
      {fallingLimbs.map((limb) => (
        <FallingLimb
          key={limb.id}
          startPosition={limb.position}
          color={limb.color}
          limbType={limb.limbType}
          onComplete={() =>
            setFallingLimbs((p) => p.filter((l) => l.id !== limb.id))
          }
        />
      ))}

      <group ref={groupRef} position={enemy.position}>
        {/* ── TORSO GROUP ── */}
        <group ref={torsoRef} position={[0, 0.1, 0]} rotation={[0.32, 0, 0]}>
          {/* Hauptrumpf */}
          <mesh material={skinMat} position={[0, 0, 0]}>
            <boxGeometry args={[0.62, 0.82, 0.34]} />
          </mesh>
          {/* Bauchwölbung — etwas heller */}
          <mesh material={skinPaleMat} position={[0, -0.18, 0.13]}>
            <boxGeometry args={[0.42, 0.32, 0.12]} />
          </mesh>

          {/* Zerrissenes Hemd vorne */}
          <mesh material={clothMat} position={[0, 0.05, 0.18]}>
            <boxGeometry args={[0.58, 0.72, 0.02]} />
          </mesh>
          {/* Zerrissene Hemd-Streifen seitlich */}
          <mesh material={clothTornMat} position={[-0.32, -0.1, 0]}>
            <boxGeometry args={[0.02, 0.5, 0.36]} />
          </mesh>
          <mesh material={clothTornMat} position={[0.32, -0.1, 0]}>
            <boxGeometry args={[0.02, 0.5, 0.36]} />
          </mesh>
          {/* Zusätzliche Stoff-Fetzen die runterhängen */}
          <mesh
            material={clothTornMat}
            position={[-0.12, -0.4, 0.18]}
            rotation={[0.2, 0, 0.1]}
          >
            <boxGeometry args={[0.08, 0.18, 0.02]} />
          </mesh>
          <mesh
            material={clothTornMat}
            position={[0.16, -0.42, 0.18]}
            rotation={[0.15, 0, -0.15]}
          >
            <boxGeometry args={[0.06, 0.22, 0.02]} />
          </mesh>

          {/* Freiliegende Rippen — mehr Detail */}
          {[-0.18, -0.05, 0.08, 0.21].map((yOff, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry array
            <group key={i}>
              <mesh
                material={boneMat}
                position={[-0.18, yOff, 0.185]}
                rotation={[0, 0, 0.28]}
              >
                <boxGeometry args={[0.22, 0.045, 0.025]} />
              </mesh>
              <mesh
                material={boneMat}
                position={[0.18, yOff, 0.185]}
                rotation={[0, 0, -0.28]}
              >
                <boxGeometry args={[0.22, 0.045, 0.025]} />
              </mesh>
              {/* Kleine Schatten-Linien zwischen Rippen */}
              <mesh
                material={fleshMat}
                position={[0, yOff + 0.022, 0.183]}
              >
                <boxGeometry args={[0.32, 0.012, 0.02]} />
              </mesh>
            </group>
          ))}
          {/* Brustbein vertikal */}
          <mesh material={boneMat} position={[0, 0.04, 0.19]}>
            <boxGeometry args={[0.045, 0.42, 0.025]} />
          </mesh>

          {/* Faulendes Fleisch-Patch links */}
          <mesh material={necroDeepMat} position={[-0.22, 0.18, 0.18]}>
            <boxGeometry args={[0.14, 0.22, 0.012]} />
          </mesh>
          <mesh material={necroMat} position={[-0.22, 0.18, 0.185]}>
            <boxGeometry args={[0.1, 0.18, 0.008]} />
          </mesh>

          {/* Blutflecken — mehrlagig (alt + frisch) */}
          <mesh material={bloodMat} position={[0.1, 0.1, 0.19]}>
            <boxGeometry args={[0.18, 0.22, 0.01]} />
          </mesh>
          <mesh material={bloodFreshMat} position={[0.13, 0.16, 0.193]}>
            <boxGeometry args={[0.08, 0.1, 0.008]} />
          </mesh>
          <mesh material={bloodMat} position={[-0.08, -0.15, 0.19]}>
            <boxGeometry args={[0.12, 0.14, 0.01]} />
          </mesh>
          {/* Tropfender Blutstreifen */}
          <mesh material={bloodFreshMat} position={[0.15, -0.05, 0.193]}>
            <boxGeometry args={[0.025, 0.28, 0.008]} />
          </mesh>

          {/* Wunde mit Loch (Schusswunde) */}
          <mesh material={eyeMat} position={[0.05, 0.0, 0.192]}>
            <circleGeometry args={[0.05, 10]} />
          </mesh>
          {/* Wundenrand — geschwollen */}
          <mesh material={fleshMat} position={[0.05, 0.0, 0.191]}>
            <ringGeometry args={[0.05, 0.07, 12]} />
          </mesh>

          {/* ── HALS ── */}
          <mesh material={skinMat} position={[0, 0.5, -0.04]}>
            <boxGeometry args={[0.2, 0.18, 0.2]} />
          </mesh>
          {/* Adern am Hals (dunkel) */}
          <mesh material={necroDeepMat} position={[-0.06, 0.5, 0.07]}>
            <boxGeometry args={[0.015, 0.16, 0.005]} />
          </mesh>
          <mesh material={necroDeepMat} position={[0.06, 0.5, 0.07]}>
            <boxGeometry args={[0.015, 0.16, 0.005]} />
          </mesh>

          {/* Hals-Stumpf wenn Kopf ab */}
          {enemy.headDetached && (
            <Stump
              position={[0, 0.62, -0.04]}
              radius={0.13}
              bloodMat={bloodMat}
              boneMat={boneMat}
              fleshMat={fleshMat}
            />
          )}

          {/* ── KOPF ── */}
          {!enemy.headDetached && (
            <group
              ref={headRef}
              position={[0, 0.72, -0.06]}
              userData={{ isHead: true }}
            >
              {/* Schädel */}
              <mesh
                material={skinMat}
                position={[0, 0, 0]}
                userData={{ isHead: true }}
              >
                <boxGeometry args={[0.46, 0.52, 0.44]} />
              </mesh>

              {/* Stirn — dunkler nekrotischer Patch */}
              <mesh material={necroMat} position={[0, 0.18, 0.22]}>
                <boxGeometry args={[0.38, 0.1, 0.02]} />
              </mesh>
              {/* Eingedrückte Wunde an Schläfe */}
              <mesh material={necroDeepMat} position={[-0.21, 0.08, 0.1]}>
                <boxGeometry args={[0.04, 0.14, 0.16]} />
              </mesh>
              <mesh material={bloodFreshMat} position={[-0.225, 0.06, 0.1]}>
                <boxGeometry args={[0.015, 0.1, 0.12]} />
              </mesh>

              {/* Kiefer */}
              <mesh material={skinMat} position={[0, -0.2, 0.04]}>
                <boxGeometry args={[0.38, 0.16, 0.38]} />
              </mesh>

              {/* Aufgerissener Mund */}
              <mesh material={eyeMat} position={[0, -0.16, 0.22]}>
                <boxGeometry args={[0.22, 0.1, 0.02]} />
              </mesh>
              {/* Inneres Maul (Zunge/Rachen) */}
              <mesh material={fleshMat} position={[0, -0.16, 0.215]}>
                <boxGeometry args={[0.18, 0.07, 0.005]} />
              </mesh>
              {/* Zähne — mehr und unregelmäßiger */}
              {[-0.085, -0.04, 0.0, 0.04, 0.085].map((tx) => (
                <mesh
                  key={`top-${tx}`}
                  material={teethMat}
                  position={[tx, -0.118, 0.222]}
                >
                  <boxGeometry args={[0.028, 0.045, 0.018]} />
                </mesh>
              ))}
              {/* Unterzähne (versetzt) */}
              {[-0.06, -0.015, 0.03, 0.075].map((tx) => (
                <mesh
                  key={`bot-${tx}`}
                  material={teethMat}
                  position={[tx, -0.198, 0.222]}
                >
                  <boxGeometry args={[0.024, 0.04, 0.018]} />
                </mesh>
              ))}
              {/* Eckzahn */}
              <mesh
                material={teethMat}
                position={[0.11, -0.12, 0.222]}
                rotation={[0, 0, -0.1]}
              >
                <coneGeometry args={[0.018, 0.07, 4]} />
              </mesh>
              {/* Sabber/Blut aus dem Mund tropfend */}
              <mesh material={bloodFreshMat} position={[-0.04, -0.24, 0.225]}>
                <boxGeometry args={[0.02, 0.12, 0.005]} />
              </mesh>

              {/* Augenhöhlen (eingesunken, dunkel) */}
              <mesh material={eyeMat} position={[-0.13, 0.06, 0.22]}>
                <boxGeometry args={[0.13, 0.11, 0.05]} />
              </mesh>
              <mesh material={eyeMat} position={[0.13, 0.06, 0.22]}>
                <boxGeometry args={[0.13, 0.11, 0.05]} />
              </mesh>
              {/* Augäpfel weiß-gelb */}
              <mesh material={teethMat} position={[-0.13, 0.06, 0.235]}>
                <sphereGeometry args={[0.045, 8, 6]} />
              </mesh>
              <mesh material={teethMat} position={[0.13, 0.06, 0.235]}>
                <sphereGeometry args={[0.045, 8, 6]} />
              </mesh>
              {/* Glühende Pupillen */}
              <mesh position={[-0.13, 0.06, 0.255]}>
                <sphereGeometry args={[0.025, 6, 6]} />
                <primitive object={eyeGlowMat.current} attach="material" />
              </mesh>
              <mesh position={[0.13, 0.06, 0.255]}>
                <sphereGeometry args={[0.025, 6, 6]} />
                <primitive object={eyeGlowMat.current} attach="material" />
              </mesh>
              {/* Augen-Tränen aus Blut */}
              <mesh material={bloodMat} position={[-0.13, -0.02, 0.232]}>
                <boxGeometry args={[0.014, 0.08, 0.005]} />
              </mesh>

              {/* Brauenwulst (verstärkt) */}
              <mesh material={necroMat} position={[0, 0.14, 0.22]}>
                <boxGeometry args={[0.42, 0.06, 0.04]} />
              </mesh>
              <mesh material={necroDeepMat} position={[-0.13, 0.13, 0.235]}>
                <boxGeometry args={[0.12, 0.04, 0.012]} />
              </mesh>
              <mesh material={necroDeepMat} position={[0.13, 0.13, 0.235]}>
                <boxGeometry args={[0.12, 0.04, 0.012]} />
              </mesh>

              {/* Eingefallene Wangenknochen */}
              <mesh material={necroMat} position={[-0.22, -0.02, 0.18]}>
                <boxGeometry args={[0.06, 0.1, 0.06]} />
              </mesh>
              <mesh material={necroMat} position={[0.22, -0.02, 0.18]}>
                <boxGeometry args={[0.06, 0.1, 0.06]} />
              </mesh>
              {/* Eingefallene Wange-Vertiefung */}
              <mesh material={necroDeepMat} position={[-0.18, -0.05, 0.205]}>
                <boxGeometry args={[0.05, 0.08, 0.012]} />
              </mesh>
              <mesh material={necroDeepMat} position={[0.18, -0.05, 0.205]}>
                <boxGeometry args={[0.05, 0.08, 0.012]} />
              </mesh>

              {/* Riss in der Haut — sichtbares Fleisch */}
              <mesh material={fleshMat} position={[0.08, 0.0, 0.225]}>
                <boxGeometry args={[0.025, 0.18, 0.008]} />
              </mesh>

              {/* Blut auf Gesicht */}
              <mesh material={bloodMat} position={[-0.05, -0.1, 0.23]}>
                <boxGeometry args={[0.1, 0.12, 0.005]} />
              </mesh>
              <mesh material={bloodFreshMat} position={[0.1, 0.15, 0.23]}>
                <boxGeometry args={[0.06, 0.06, 0.005]} />
              </mesh>
              <mesh material={bloodMat} position={[0.04, -0.05, 0.232]}>
                <boxGeometry args={[0.025, 0.32, 0.005]} />
              </mesh>

              {/* Zerzaustes Haar — mehrere Büschel */}
              <mesh material={clothMat} position={[0, 0.28, 0]}>
                <boxGeometry args={[0.48, 0.08, 0.46]} />
              </mesh>
              <mesh
                material={clothMat}
                position={[-0.16, 0.34, -0.05]}
                rotation={[-0.2, 0, -0.3]}
              >
                <boxGeometry args={[0.08, 0.1, 0.06]} />
              </mesh>
              <mesh
                material={clothMat}
                position={[0.18, 0.32, 0.08]}
                rotation={[0.1, 0, 0.4]}
              >
                <boxGeometry args={[0.06, 0.12, 0.06]} />
              </mesh>
              {/* Glatzen-Patch (Skalp fehlt) */}
              <mesh material={fleshMat} position={[0.05, 0.32, 0.05]}>
                <boxGeometry args={[0.18, 0.005, 0.16]} />
              </mesh>
            </group>
          )}

          {/* ── LINKER ARM ── */}
          {!enemy.leftArmDetached ? (
            <group
              ref={leftArmRef}
              position={[-0.38, 0.28, 0]}
              rotation={[-1.1, 0, 0.15]}
            >
              <mesh material={clothMat} position={[0, -0.2, 0]}>
                <boxGeometry args={[0.2, 0.38, 0.2]} />
              </mesh>
              {/* Unterarm Haut */}
              <mesh material={skinMat} position={[0, -0.52, 0]}>
                <boxGeometry args={[0.17, 0.34, 0.17]} />
              </mesh>
              {/* Adern am Unterarm */}
              <mesh material={necroDeepMat} position={[0, -0.5, 0.087]}>
                <boxGeometry args={[0.012, 0.28, 0.005]} />
              </mesh>
              {/* Klauen-Hand */}
              <mesh material={necroMat} position={[0, -0.74, 0]}>
                <boxGeometry args={[0.16, 0.16, 0.1]} />
              </mesh>
              {/* Klauen-Finger — länger, krumm */}
              {[-0.05, 0, 0.05].map((fx, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static geometry array
                <group key={i}>
                  <mesh material={skinPaleMat} position={[fx, -0.85, 0]}>
                    <boxGeometry args={[0.025, 0.12, 0.025]} />
                  </mesh>
                  {/* Knochen-Klaue an der Spitze */}
                  <mesh
                    material={boneMat}
                    position={[fx, -0.93, 0.005]}
                    rotation={[0.2, 0, 0]}
                  >
                    <coneGeometry args={[0.014, 0.05, 4]} />
                  </mesh>
                </group>
              ))}
              {/* Daumen */}
              <mesh
                material={skinPaleMat}
                position={[0.07, -0.82, 0]}
                rotation={[0, 0, -0.4]}
              >
                <boxGeometry args={[0.022, 0.08, 0.022]} />
              </mesh>
              {/* Zerrissener Ärmel */}
              <mesh material={clothTornMat} position={[0.1, -0.38, 0.1]}>
                <boxGeometry args={[0.04, 0.18, 0.04]} />
              </mesh>
              {/* Blut auf Arm */}
              <mesh material={bloodMat} position={[0.09, -0.45, 0.09]}>
                <boxGeometry args={[0.04, 0.1, 0.02]} />
              </mesh>
              {/* Frische Wunde am Unterarm */}
              <mesh material={fleshMat} position={[-0.087, -0.55, 0]}>
                <boxGeometry args={[0.005, 0.08, 0.04]} />
              </mesh>
            </group>
          ) : (
            <Stump
              position={[-0.38, 0.28, 0]}
              radius={0.12}
              bloodMat={bloodMat}
              boneMat={boneMat}
              fleshMat={fleshMat}
            />
          )}

          {/* ── RECHTER ARM ── */}
          {!enemy.rightArmDetached ? (
            <group
              ref={rightArmRef}
              position={[0.38, 0.28, 0]}
              rotation={[-1.1, 0, -0.15]}
            >
              <mesh material={clothMat} position={[0, -0.2, 0]}>
                <boxGeometry args={[0.2, 0.38, 0.2]} />
              </mesh>
              <mesh material={skinMat} position={[0, -0.52, 0]}>
                <boxGeometry args={[0.17, 0.34, 0.17]} />
              </mesh>
              <mesh material={necroDeepMat} position={[0, -0.5, 0.087]}>
                <boxGeometry args={[0.012, 0.28, 0.005]} />
              </mesh>
              <mesh material={necroMat} position={[0, -0.74, 0]}>
                <boxGeometry args={[0.16, 0.16, 0.1]} />
              </mesh>
              {[-0.05, 0, 0.05].map((fx, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static geometry array
                <group key={i}>
                  <mesh material={skinPaleMat} position={[fx, -0.85, 0]}>
                    <boxGeometry args={[0.025, 0.12, 0.025]} />
                  </mesh>
                  <mesh
                    material={boneMat}
                    position={[fx, -0.93, 0.005]}
                    rotation={[0.2, 0, 0]}
                  >
                    <coneGeometry args={[0.014, 0.05, 4]} />
                  </mesh>
                </group>
              ))}
              <mesh
                material={skinPaleMat}
                position={[-0.07, -0.82, 0]}
                rotation={[0, 0, 0.4]}
              >
                <boxGeometry args={[0.022, 0.08, 0.022]} />
              </mesh>
              <mesh material={clothTornMat} position={[-0.1, -0.38, 0.1]}>
                <boxGeometry args={[0.04, 0.18, 0.04]} />
              </mesh>
              {/* Frische Bisswunde */}
              <mesh material={fleshMat} position={[0.087, -0.42, 0]}>
                <boxGeometry args={[0.005, 0.06, 0.06]} />
              </mesh>
              <mesh material={bloodFreshMat} position={[0.088, -0.46, 0.05]}>
                <boxGeometry args={[0.003, 0.18, 0.012]} />
              </mesh>
            </group>
          ) : (
            <Stump
              position={[0.38, 0.28, 0]}
              radius={0.12}
              bloodMat={bloodMat}
              boneMat={boneMat}
              fleshMat={fleshMat}
            />
          )}
        </group>

        {/* ── BECKEN ── */}
        <mesh material={clothMat} position={[0, -0.42, 0]}>
          <boxGeometry args={[0.58, 0.22, 0.32]} />
        </mesh>
        {/* Gürtel */}
        <mesh material={necroDeepMat} position={[0, -0.34, 0.16]}>
          <boxGeometry args={[0.6, 0.05, 0.025]} />
        </mesh>

        {/* ── LINKES BEIN ── */}
        {!enemy.leftLegDetached ? (
          <group ref={leftLegRef} position={[-0.18, -0.62, 0]}>
            <mesh material={clothTornMat} position={[0, -0.2, 0]}>
              <boxGeometry args={[0.24, 0.38, 0.24]} />
            </mesh>
            <mesh material={clothTornMat} position={[0, -0.52, 0]}>
              <boxGeometry args={[0.2, 0.34, 0.2]} />
            </mesh>
            {/* Freiliegender Schienbein-Knochen — größerer Bereich */}
            <mesh material={fleshMat} position={[0.06, -0.5, 0.115]}>
              <boxGeometry args={[0.05, 0.22, 0.012]} />
            </mesh>
            <mesh material={boneMat} position={[0.06, -0.48, 0.118]}>
              <boxGeometry args={[0.03, 0.18, 0.012]} />
            </mesh>
            {/* Stiefel/Fuß */}
            <mesh material={eyeMat} position={[0, -0.74, 0.04]}>
              <boxGeometry args={[0.22, 0.14, 0.28]} />
            </mesh>
            {/* Kaputte Stiefelspitze */}
            <mesh material={fleshMat} position={[0, -0.74, 0.2]}>
              <boxGeometry args={[0.16, 0.08, 0.04]} />
            </mesh>
          </group>
        ) : (
          <Stump
            position={[-0.18, -0.62, 0]}
            radius={0.13}
            bloodMat={bloodMat}
            boneMat={boneMat}
            fleshMat={fleshMat}
          />
        )}

        {/* ── RECHTES BEIN ── */}
        {!enemy.rightLegDetached ? (
          <group ref={rightLegRef} position={[0.18, -0.62, 0]}>
            <mesh material={clothTornMat} position={[0, -0.2, 0]}>
              <boxGeometry args={[0.24, 0.38, 0.24]} />
            </mesh>
            <mesh material={clothTornMat} position={[0, -0.52, 0]}>
              <boxGeometry args={[0.2, 0.34, 0.2]} />
            </mesh>
            {/* Blut-Streifen runterlaufend */}
            <mesh material={bloodMat} position={[-0.085, -0.45, 0.105]}>
              <boxGeometry args={[0.012, 0.32, 0.008]} />
            </mesh>
            <mesh material={eyeMat} position={[0, -0.74, 0.04]}>
              <boxGeometry args={[0.22, 0.14, 0.28]} />
            </mesh>
            <mesh material={fleshMat} position={[0, -0.74, 0.2]}>
              <boxGeometry args={[0.16, 0.08, 0.04]} />
            </mesh>
          </group>
        ) : (
          <Stump
            position={[0.18, -0.62, 0]}
            radius={0.13}
            bloodMat={bloodMat}
            boneMat={boneMat}
            fleshMat={fleshMat}
          />
        )}
      </group>
    </>
  );
}

// ─── Boss Zombie ──────────────────────────────────────────────────────────────
function BossZombie({
  enemy,
  onHitFlashDone,
  playerPositionRef,
}: EnemyMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const eyeGlow1Ref = useRef<THREE.Mesh>(null);
  const eyeGlow2Ref = useRef<THREE.Mesh>(null);
  const hitFlashRef = useRef(0);

  const skinMat = useStandardMaterial("#4a5c3a", hitFlashRef.current);
  const skinPaleMat = useStandardMaterial("#5e7048", hitFlashRef.current);
  const necroMat = useStandardMaterial("#2e3d22", hitFlashRef.current);
  const necroDeepMat = useStandardMaterial("#1a2412", hitFlashRef.current);
  const clothMat = useStandardMaterial("#1a1208", hitFlashRef.current);
  const clothTornMat = useStandardMaterial("#120e06", hitFlashRef.current);
  const bloodMat = useStandardMaterial("#6a0000", hitFlashRef.current);
  const bloodFreshMat = useStandardMaterial("#8a0a0a", hitFlashRef.current);
  const fleshMat = useStandardMaterial("#5a1010", hitFlashRef.current);
  const boneMat = useStandardMaterial("#c8c0b0", hitFlashRef.current);
  const teethMat = useStandardMaterial("#a89a70", hitFlashRef.current);

  const eyeGlowMat = useRef<THREE.MeshBasicMaterial | null>(null);
  if (!eyeGlowMat.current) {
    eyeGlowMat.current = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ff2200"),
    });
  }
  const eyeSocketMat = useRef<THREE.MeshBasicMaterial | null>(null);
  if (!eyeSocketMat.current) {
    eyeSocketMat.current = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#0a0000"),
    });
  }

  const allMats = [
    skinMat,
    skinPaleMat,
    necroMat,
    necroDeepMat,
    clothMat,
    clothTornMat,
    bloodMat,
    bloodFreshMat,
    fleshMat,
    boneMat,
    teethMat,
  ];

  const [fallingLimbs, setFallingLimbs] = useState<
    Array<{
      id: number;
      position: [number, number, number];
      color: string;
      limbType: "arm" | "leg" | "head";
    }>
  >([]);
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
      offsetX: number,
      offsetY: number,
      offsetZ: number,
      color: string,
      limbType: "arm" | "leg" | "head",
    ) => {
      setFallingLimbs((p) => [
        ...p,
        {
          id: fallingLimbIdRef.current++,
          position: [
            ex + offsetX + (Math.random() - 0.5) * 0.4,
            ey + offsetY,
            ez + offsetZ + (Math.random() - 0.5) * 0.4,
          ],
          color,
          limbType,
        },
      ]);
    };

    if (enemy.headDetached && !prev.headDetached)
      spawnLimb(0, 2.4, 0, "#4a5c3a", "head");
    if (enemy.leftArmDetached && !prev.leftArmDetached)
      spawnLimb(-0.9, 1.6, 0, "#1a1208", "arm");
    if (enemy.rightArmDetached && !prev.rightArmDetached)
      spawnLimb(0.9, 1.6, 0, "#1a1208", "arm");
    if (enemy.leftLegDetached && !prev.leftLegDetached)
      spawnLimb(-0.3, 0.8, 0, "#120e06", "leg");
    if (enemy.rightLegDetached && !prev.rightLegDetached)
      spawnLimb(0.3, 0.8, 0, "#120e06", "leg");

    prevDismember.current = {
      headDetached: !!enemy.headDetached,
      leftArmDetached: !!enemy.leftArmDetached,
      rightArmDetached: !!enemy.rightArmDetached,
      leftLegDetached: !!enemy.leftLegDetached,
      rightLegDetached: !!enemy.rightLegDetached,
    };
  }, [
    enemy.headDetached,
    enemy.leftArmDetached,
    enemy.rightArmDetached,
    enemy.leftLegDetached,
    enemy.rightLegDetached,
    enemy.position,
  ]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const [tx, ty, tz] = enemy.position;
    groupRef.current.position.lerp(
      new THREE.Vector3(tx, ty, tz),
      Math.min(delta * 8, 1),
    );

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
        torsoRef.current.rotation.z = Math.sin(t * 1.6) * 0.04;
      }
      if (headRef.current && !enemy.headDetached) {
        headRef.current.rotation.z = Math.sin(t * 2.5) * 0.06;
      }
      // Augen-Pulsing für mehr Drohgebärde
      if (eyeGlowMat.current) {
        const pulse = 0.7 + Math.sin(t * 6) * 0.3;
        eyeGlowMat.current.color.setRGB(pulse, pulse * 0.15, 0);
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
      for (const mat of allMats) {
        if (mat)
          mat.emissive.setRGB(
            hitFlashRef.current * 0.7,
            hitFlashRef.current * 0.05,
            hitFlashRef.current * 0.05,
          );
      }
      if (hitFlashRef.current >= 0.9) {
        onHitFlashDone(enemy.id);
        hitFlashRef.current = 0;
      }
    } else {
      hitFlashRef.current = Math.max(hitFlashRef.current - delta * 8, 0);
      for (const mat of allMats) {
        if (mat) mat.emissive.setRGB(0, 0, 0);
      }
    }

    if (enemy.isDead) {
      const elapsed = (Date.now() - enemy.deathTime) / 1000;
      groupRef.current.scale.y = Math.max(0.01, 1 - elapsed * 0.8);
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.Material).opacity = Math.max(
            0,
            1 - elapsed * 1.0,
          );
          (child.material as THREE.Material).transparent = true;
        }
      });
    }
  });

  return (
    <>
      {fallingLimbs.map((limb) => (
        <FallingLimb
          key={limb.id}
          startPosition={limb.position}
          color={limb.color}
          limbType={limb.limbType}
          onComplete={() =>
            setFallingLimbs((p) => p.filter((l) => l.id !== limb.id))
          }
        />
      ))}

      <group ref={groupRef} position={enemy.position}>
        {/* ── TORSO ── */}
        <group ref={torsoRef} position={[0, 0.2, 0]} rotation={[0.28, 0, 0]}>
          {/* Hauptrumpf — breit & bullig */}
          <mesh material={skinMat} position={[0, 0, 0]}>
            <boxGeometry args={[1.3, 1.4, 0.7]} />
          </mesh>
          {/* Wuchtiger Bauch */}
          <mesh material={skinPaleMat} position={[0, -0.3, 0.27]}>
            <boxGeometry args={[0.86, 0.62, 0.18]} />
          </mesh>
          {/* Bauchnabel-Wunde */}
          <mesh material={fleshMat} position={[0, -0.3, 0.36]}>
            <circleGeometry args={[0.07, 10]} />
          </mesh>

          {/* Zerrissene Kleidung */}
          <mesh material={clothMat} position={[0, 0.1, 0.36]}>
            <boxGeometry args={[1.1, 1.1, 0.02]} />
          </mesh>
          <mesh material={clothTornMat} position={[-0.6, -0.3, 0]}>
            <boxGeometry args={[0.08, 0.6, 0.72]} />
          </mesh>
          <mesh material={clothTornMat} position={[0.6, -0.3, 0]}>
            <boxGeometry args={[0.08, 0.6, 0.72]} />
          </mesh>
          {/* Hängende Stoff-Streifen */}
          <mesh
            material={clothTornMat}
            position={[-0.3, -0.6, 0.36]}
            rotation={[0.1, 0, 0.1]}
          >
            <boxGeometry args={[0.12, 0.4, 0.02]} />
          </mesh>
          <mesh
            material={clothTornMat}
            position={[0.32, -0.65, 0.36]}
            rotation={[0.15, 0, -0.2]}
          >
            <boxGeometry args={[0.1, 0.45, 0.02]} />
          </mesh>

          {/* Freiliegende Rippen — mehr Detail */}
          {[-0.3, -0.12, 0.06, 0.24, 0.42].map((yOff, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry array
            <group key={i}>
              <mesh
                material={boneMat}
                position={[-0.36, yOff, 0.37]}
                rotation={[0, 0, 0.32]}
              >
                <boxGeometry args={[0.34, 0.07, 0.04]} />
              </mesh>
              <mesh
                material={boneMat}
                position={[0.36, yOff, 0.37]}
                rotation={[0, 0, -0.32]}
              >
                <boxGeometry args={[0.34, 0.07, 0.04]} />
              </mesh>
              {/* Schatten-Linie zwischen Rippen */}
              <mesh material={fleshMat} position={[0, yOff + 0.04, 0.366]}>
                <boxGeometry args={[0.6, 0.018, 0.025]} />
              </mesh>
            </group>
          ))}
          <mesh material={boneMat} position={[0, 0.08, 0.38]}>
            <boxGeometry args={[0.08, 0.7, 0.04]} />
          </mesh>

          {/* Gewaltige Wundklaffung in der Brust */}
          <mesh material={eyeSocketMat.current} position={[0.0, 0.15, 0.385]}>
            <circleGeometry args={[0.1, 12]} />
          </mesh>
          <mesh material={fleshMat} position={[0.0, 0.15, 0.382]}>
            <ringGeometry args={[0.1, 0.14, 14]} />
          </mesh>

          {/* Blut auf Brust — mehrlagig */}
          <mesh material={bloodMat} position={[0.2, 0.2, 0.385]}>
            <boxGeometry args={[0.3, 0.4, 0.01]} />
          </mesh>
          <mesh material={bloodFreshMat} position={[0.18, 0.05, 0.388]}>
            <boxGeometry args={[0.04, 0.5, 0.008]} />
          </mesh>
          <mesh material={bloodMat} position={[-0.3, -0.1, 0.385]}>
            <boxGeometry args={[0.22, 0.28, 0.01]} />
          </mesh>
          <mesh material={bloodFreshMat} position={[-0.32, -0.4, 0.388]}>
            <boxGeometry args={[0.06, 0.4, 0.008]} />
          </mesh>

          {/* Asymmetrische Schultern */}
          <mesh material={necroMat} position={[-0.78, 0.5, 0]}>
            <boxGeometry args={[0.42, 0.38, 0.6]} />
          </mesh>
          {/* Knochen ragt aus linker Schulter */}
          <mesh material={boneMat} position={[-0.9, 0.72, 0]}>
            <boxGeometry args={[0.1, 0.22, 0.1]} />
          </mesh>
          <mesh
            material={boneMat}
            position={[-0.94, 0.86, 0]}
            rotation={[0, 0, 0.3]}
          >
            <coneGeometry args={[0.05, 0.16, 5]} />
          </mesh>
          <mesh material={necroMat} position={[0.72, 0.38, 0]}>
            <boxGeometry args={[0.36, 0.3, 0.56]} />
          </mesh>
          {/* Brand/Eiterwunde rechte Schulter */}
          <mesh material={necroDeepMat} position={[0.72, 0.48, 0.28]}>
            <boxGeometry args={[0.18, 0.16, 0.012]} />
          </mesh>
          <mesh material={fleshMat} position={[0.72, 0.48, 0.286]}>
            <boxGeometry args={[0.12, 0.1, 0.008]} />
          </mesh>

          {/* Hals */}
          <mesh material={skinMat} position={[0, 0.82, -0.05]}>
            <boxGeometry args={[0.38, 0.28, 0.36]} />
          </mesh>
          {/* Hervorstehende Wirbelsäule am Hals (von hinten) */}
          <mesh material={boneMat} position={[0, 0.82, -0.22]}>
            <boxGeometry args={[0.06, 0.22, 0.04]} />
          </mesh>

          {/* Hals-Stumpf */}
          {enemy.headDetached && (
            <Stump
              position={[0, 1.0, -0.05]}
              radius={0.22}
              bloodMat={bloodMat}
              boneMat={boneMat}
              fleshMat={fleshMat}
            />
          )}

          {/* ── KOPF ── */}
          {!enemy.headDetached && (
            <group ref={headRef} position={[0, 1.22, -0.08]}>
              <mesh
                material={skinMat}
                position={[0, 0, 0]}
                userData={{ isHead: true }}
              >
                <boxGeometry args={[0.92, 0.96, 0.82]} />
              </mesh>

              {/* Deformierter Schädelhöcker */}
              <mesh material={necroMat} position={[-0.3, 0.42, 0]}>
                <boxGeometry args={[0.38, 0.28, 0.7]} />
              </mesh>
              {/* Tumor-artige Beule */}
              <mesh material={necroDeepMat} position={[-0.45, 0.55, 0.18]}>
                <sphereGeometry args={[0.12, 8, 6]} />
              </mesh>

              {/* Massiver Kiefer */}
              <mesh material={skinMat} position={[0, -0.42, 0.08]}>
                <boxGeometry args={[0.78, 0.28, 0.7]} />
              </mesh>

              {/* Gewaltiges Maul */}
              <mesh position={[0, -0.38, 0.42]}>
                <boxGeometry args={[0.5, 0.16, 0.04]} />
                <primitive object={eyeSocketMat.current} attach="material" />
              </mesh>
              {/* Inneres Maul (Zunge) */}
              <mesh material={fleshMat} position={[0, -0.38, 0.41]}>
                <boxGeometry args={[0.42, 0.1, 0.012]} />
              </mesh>
              {/* Reißzähne */}
              {[-0.18, -0.08, 0.02, 0.12, 0.22].map((tx, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static geometry array
                <mesh key={i} material={teethMat} position={[tx, -0.34, 0.43]}>
                  <boxGeometry args={[0.07, 0.1, 0.03]} />
                </mesh>
              ))}
              {/* Untere Zähne (versetzt) */}
              {[-0.13, -0.03, 0.07, 0.17].map((tx) => (
                <mesh
                  key={`b${tx}`}
                  material={teethMat}
                  position={[tx, -0.46, 0.43]}
                >
                  <boxGeometry args={[0.06, 0.09, 0.03]} />
                </mesh>
              ))}
              {/* Lange Eckzähne */}
              <mesh
                material={teethMat}
                position={[-0.23, -0.4, 0.435]}
                rotation={[0, 0, 0.05]}
              >
                <coneGeometry args={[0.025, 0.14, 4]} />
              </mesh>
              <mesh
                material={teethMat}
                position={[0.27, -0.4, 0.435]}
                rotation={[0, 0, -0.05]}
              >
                <coneGeometry args={[0.025, 0.14, 4]} />
              </mesh>
              {/* Sabbernde Bluttropfen aus dem Mund */}
              <mesh material={bloodFreshMat} position={[-0.1, -0.5, 0.44]}>
                <boxGeometry args={[0.04, 0.18, 0.008]} />
              </mesh>
              <mesh material={bloodFreshMat} position={[0.13, -0.55, 0.44]}>
                <boxGeometry args={[0.03, 0.24, 0.008]} />
              </mesh>

              {/* Brauenwulst */}
              <mesh material={necroMat} position={[0, 0.22, 0.42]}>
                <boxGeometry args={[0.86, 0.12, 0.06]} />
              </mesh>

              {/* Augenhöhlen */}
              <mesh position={[-0.22, 0.1, 0.42]}>
                <boxGeometry args={[0.22, 0.2, 0.06]} />
                <primitive object={eyeSocketMat.current} attach="material" />
              </mesh>
              <mesh position={[0.22, 0.1, 0.42]}>
                <boxGeometry args={[0.22, 0.2, 0.06]} />
                <primitive object={eyeSocketMat.current} attach="material" />
              </mesh>
              {/* Glühende rote Augen — pulsen */}
              <mesh ref={eyeGlow1Ref} position={[-0.22, 0.1, 0.46]}>
                <sphereGeometry args={[0.08, 8, 6]} />
                <primitive object={eyeGlowMat.current} attach="material" />
              </mesh>
              <mesh ref={eyeGlow2Ref} position={[0.22, 0.1, 0.46]}>
                <sphereGeometry args={[0.08, 8, 6]} />
                <primitive object={eyeGlowMat.current} attach="material" />
              </mesh>
              {/* Augen-Glow als zweite Schicht (größer, transparent) */}
              <mesh position={[-0.22, 0.1, 0.46]}>
                <sphereGeometry args={[0.13, 6, 6]} />
                <meshBasicMaterial
                  color="#ff4400"
                  transparent
                  opacity={0.35}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              <mesh position={[0.22, 0.1, 0.46]}>
                <sphereGeometry args={[0.13, 6, 6]} />
                <meshBasicMaterial
                  color="#ff4400"
                  transparent
                  opacity={0.35}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              {/* Blut auf Gesicht */}
              <mesh material={bloodMat} position={[0.1, -0.1, 0.42]}>
                <boxGeometry args={[0.2, 0.3, 0.012]} />
              </mesh>
              <mesh material={bloodFreshMat} position={[-0.2, 0.05, 0.42]}>
                <boxGeometry args={[0.14, 0.18, 0.012]} />
              </mesh>
              {/* Tropfender Blutstreifen vom Mund nach unten */}
              <mesh material={bloodFreshMat} position={[0.05, -0.55, 0.42]}>
                <boxGeometry args={[0.04, 0.4, 0.012]} />
              </mesh>

              {/* Hörner */}
              <mesh material={necroDeepMat} position={[-0.22, 0.56, 0]}>
                <coneGeometry args={[0.09, 0.36, 6]} />
              </mesh>
              <mesh material={necroDeepMat} position={[0.22, 0.56, 0]}>
                <coneGeometry args={[0.09, 0.36, 6]} />
              </mesh>
              {/* Mittlerer Stachel */}
              <mesh material={bloodMat} position={[0, 0.62, 0]}>
                <coneGeometry args={[0.06, 0.42, 6]} />
              </mesh>
              {/* Knochen-Auswüchse seitlich am Schädel */}
              <mesh
                material={boneMat}
                position={[-0.42, 0.3, 0]}
                rotation={[0, 0, -0.6]}
              >
                <coneGeometry args={[0.05, 0.2, 4]} />
              </mesh>
              <mesh
                material={boneMat}
                position={[0.42, 0.3, 0]}
                rotation={[0, 0, 0.6]}
              >
                <coneGeometry args={[0.05, 0.2, 4]} />
              </mesh>

              {/* Risse im Schädel — sichtbares Fleisch */}
              <mesh
                material={fleshMat}
                position={[0.15, 0.15, 0.42]}
                rotation={[0, 0, 0.2]}
              >
                <boxGeometry args={[0.04, 0.32, 0.012]} />
              </mesh>
            </group>
          )}

          {/* ── LINKER ARM ── */}
          {!enemy.leftArmDetached ? (
            <group
              ref={leftArmRef}
              position={[-0.82, 0.4, 0]}
              rotation={[-0.9, 0, 0.2]}
            >
              <mesh material={necroMat} position={[0, -0.3, 0]}>
                <boxGeometry args={[0.38, 0.58, 0.38]} />
              </mesh>
              <mesh material={skinMat} position={[0, -0.72, 0]}>
                <boxGeometry args={[0.32, 0.5, 0.32]} />
              </mesh>
              {/* Adern Unterarm */}
              <mesh material={necroDeepMat} position={[0, -0.7, 0.165]}>
                <boxGeometry args={[0.022, 0.38, 0.005]} />
              </mesh>
              {/* Massive Klauen-Hand */}
              <mesh material={necroMat} position={[0, -1.06, 0]}>
                <boxGeometry args={[0.3, 0.24, 0.2]} />
              </mesh>
              {[-0.1, -0.03, 0.04, 0.11].map((fx, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static geometry array
                <group key={i}>
                  <mesh material={skinPaleMat} position={[fx, -1.24, 0]}>
                    <boxGeometry args={[0.04, 0.18, 0.04]} />
                  </mesh>
                  <mesh
                    material={boneMat}
                    position={[fx, -1.36, 0.005]}
                    rotation={[0.25, 0, 0]}
                  >
                    <coneGeometry args={[0.022, 0.08, 4]} />
                  </mesh>
                </group>
              ))}
              {/* Blut auf Arm */}
              <mesh material={bloodMat} position={[0.16, -0.6, 0.16]}>
                <boxGeometry args={[0.06, 0.2, 0.025]} />
              </mesh>
              <mesh material={bloodFreshMat} position={[0.165, -0.4, 0.16]}>
                <boxGeometry args={[0.025, 0.5, 0.012]} />
              </mesh>
            </group>
          ) : (
            <Stump
              position={[-0.82, 0.4, 0]}
              radius={0.24}
              bloodMat={bloodMat}
              boneMat={boneMat}
              fleshMat={fleshMat}
            />
          )}

          {/* ── RECHTER ARM ── */}
          {!enemy.rightArmDetached ? (
            <group
              ref={rightArmRef}
              position={[0.82, 0.4, 0]}
              rotation={[-0.9, 0, -0.2]}
            >
              <mesh material={necroMat} position={[0, -0.3, 0]}>
                <boxGeometry args={[0.38, 0.58, 0.38]} />
              </mesh>
              <mesh material={skinMat} position={[0, -0.72, 0]}>
                <boxGeometry args={[0.32, 0.5, 0.32]} />
              </mesh>
              <mesh material={necroDeepMat} position={[0, -0.7, 0.165]}>
                <boxGeometry args={[0.022, 0.38, 0.005]} />
              </mesh>
              <mesh material={necroMat} position={[0, -1.06, 0]}>
                <boxGeometry args={[0.3, 0.24, 0.2]} />
              </mesh>
              {[-0.1, -0.03, 0.04, 0.11].map((fx, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static geometry array
                <group key={i}>
                  <mesh material={skinPaleMat} position={[fx, -1.24, 0]}>
                    <boxGeometry args={[0.04, 0.18, 0.04]} />
                  </mesh>
                  <mesh
                    material={boneMat}
                    position={[fx, -1.36, 0.005]}
                    rotation={[0.25, 0, 0]}
                  >
                    <coneGeometry args={[0.022, 0.08, 4]} />
                  </mesh>
                </group>
              ))}
              {/* Tiefe Schnittwunde */}
              <mesh material={fleshMat} position={[-0.165, -0.7, 0]}>
                <boxGeometry args={[0.005, 0.18, 0.18]} />
              </mesh>
            </group>
          ) : (
            <Stump
              position={[0.82, 0.4, 0]}
              radius={0.24}
              bloodMat={bloodMat}
              boneMat={boneMat}
              fleshMat={fleshMat}
            />
          )}
        </group>

        {/* ── BECKEN ── */}
        <mesh material={clothMat} position={[0, -0.6, 0]}>
          <boxGeometry args={[1.1, 0.4, 0.6]} />
        </mesh>
        {/* Gürtel */}
        <mesh material={necroDeepMat} position={[0, -0.45, 0.305]}>
          <boxGeometry args={[1.12, 0.08, 0.025]} />
        </mesh>

        {/* ── LINKES BEIN ── */}
        {!enemy.leftLegDetached ? (
          <group ref={leftLegRef} position={[-0.32, -1.0, 0]}>
            <mesh material={clothTornMat} position={[0, -0.3, 0]}>
              <boxGeometry args={[0.44, 0.58, 0.44]} />
            </mesh>
            <mesh material={clothTornMat} position={[0, -0.76, 0]}>
              <boxGeometry args={[0.38, 0.5, 0.38]} />
            </mesh>
            {/* Großer freiliegender Knochen */}
            <mesh material={fleshMat} position={[0.1, -0.72, 0.2]}>
              <boxGeometry args={[0.07, 0.32, 0.012]} />
            </mesh>
            <mesh material={boneMat} position={[0.1, -0.7, 0.205]}>
              <boxGeometry args={[0.05, 0.28, 0.012]} />
            </mesh>
            {/* Stiefel */}
            <mesh material={necroMat} position={[0, -1.1, 0.08]}>
              <boxGeometry args={[0.42, 0.24, 0.5]} />
            </mesh>
            <mesh material={fleshMat} position={[0, -1.1, 0.36]}>
              <boxGeometry args={[0.32, 0.16, 0.06]} />
            </mesh>
          </group>
        ) : (
          <Stump
            position={[-0.32, -1.0, 0]}
            radius={0.26}
            bloodMat={bloodMat}
            boneMat={boneMat}
            fleshMat={fleshMat}
          />
        )}

        {/* ── RECHTES BEIN ── */}
        {!enemy.rightLegDetached ? (
          <group ref={rightLegRef} position={[0.32, -1.0, 0]}>
            <mesh material={clothTornMat} position={[0, -0.3, 0]}>
              <boxGeometry args={[0.44, 0.58, 0.44]} />
            </mesh>
            <mesh material={clothTornMat} position={[0, -0.76, 0]}>
              <boxGeometry args={[0.38, 0.5, 0.38]} />
            </mesh>
            {/* Blutstreifen runterlaufend */}
            <mesh material={bloodMat} position={[-0.13, -0.5, 0.19]}>
              <boxGeometry args={[0.022, 0.5, 0.008]} />
            </mesh>
            <mesh material={necroMat} position={[0, -1.1, 0.08]}>
              <boxGeometry args={[0.42, 0.24, 0.5]} />
            </mesh>
            <mesh material={fleshMat} position={[0, -1.1, 0.36]}>
              <boxGeometry args={[0.32, 0.16, 0.06]} />
            </mesh>
          </group>
        ) : (
          <Stump
            position={[0.32, -1.0, 0]}
            radius={0.26}
            bloodMat={bloodMat}
            boneMat={boneMat}
            fleshMat={fleshMat}
          />
        )}
      </group>
    </>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export function EnemyMesh({
  enemy,
  onHitFlashDone,
  playerPositionRef,
}: EnemyMeshProps) {
  if (enemy.type === "boss") {
    return (
      <BossZombie
        enemy={enemy}
        onHitFlashDone={onHitFlashDone}
        playerPositionRef={playerPositionRef}
      />
    );
  }
  return (
    <StandardZombie
      enemy={enemy}
      onHitFlashDone={onHitFlashDone}
      playerPositionRef={playerPositionRef}
    />
  );
}
