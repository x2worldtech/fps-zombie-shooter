import { useFrame } from "@react-three/fiber";
import type React from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Enemy } from "../../types/enemy";
import { computeRagdollPose } from "../../utils/ragdollPose";
import { useStandardMaterial } from "./ToonMaterial";

interface EnemyMeshProps {
  enemy: Enemy;
  onHitFlashDone: (id: string) => void;
  playerPositionRef: React.MutableRefObject<[number, number, number]>;
  /**
   * PERF: Map mit der aktuellen (per-Frame mutierten) Position jedes Enemies.
   * Wird in useFrame gelesen statt `enemy.position` aus dem React-State, damit
   * setEnemies(...) nicht jeden Frame neu feuern muss. Siehe useEnemySystem.
   */
  enemyPositionsRef: React.MutableRefObject<
    Map<string, [number, number, number]>
  >;
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
          <cylinderGeometry
            args={[radius * 0.35, radius * 0.35, radius * 0.12, 8]}
          />
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
  enemyPositionsRef,
}: EnemyMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const hitFlashRef = useRef(0);
  // PERF: stabiler Vector3 für lerp-Target — keine neue Allokation pro Frame
  const lerpTargetRef = useRef(new THREE.Vector3());
  // PERF: einmal-gebaute Liste der UNIKE Materials für das Death-Fade-Out,
  // statt jeden Frame die gesamte Mesh-Hierarchie zu traversen. Wird beim
  // ersten Death-Frame befüllt.
  const deadMaterialsRef = useRef<THREE.Material[] | null>(null);

  // Material-Palette — leicht differenzierter
  const skinMat = useStandardMaterial("#7a9470");
  const skinPaleMat = useStandardMaterial("#92a888");
  const necroMat = useStandardMaterial("#3d5238");
  const necroDeepMat = useStandardMaterial("#26321f");
  const clothMat = useStandardMaterial("#2e2318");
  const clothTornMat = useStandardMaterial("#1e1510");
  const bloodMat = useStandardMaterial("#6a0000");
  const bloodFreshMat = useStandardMaterial("#8a0a0a");
  const fleshMat = useStandardMaterial("#5a1010");
  const eyeMat = useStandardMaterial("#0d0d0d");
  const boneMat = useStandardMaterial("#d4c89a");
  const teethMat = useStandardMaterial("#a89a70");

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

    // ── TOTE/DESPAWNENDE ZOMBIES: Ragdoll + Fade ────────────────────────────
    // Position auf der zuletzt geltenden Welt-Position einfrieren (lebende
    // Position-Updates greifen nicht mehr), Bewegungslogik überspringen.
    if (enemy.isDead) {
      const refPos = enemyPositionsRef.current.get(enemy.id);
      const baseX = refPos ? refPos[0] : enemy.position[0];
      const baseZ = refPos ? refPos[2] : enemy.position[2];

      const elapsed = (Date.now() - enemy.deathTime) / 1000;

      // Ragdoll-Pose berechnen (geht für ragdoll- + resting-Phase, weil pose
      // bei elapsed >= DURATION konstant bleibt — kein Pop, kein Glitch).
      const hitDirX = enemy.deathHitDirX ?? 0;
      const hitDirZ = enemy.deathHitDirZ ?? 1;
      // Yaw rekonstruieren: lebend war rotation.y = atan2(playerDx, playerDz).
      // deathHitDir zeigt vom Spieler weg → -deathHitDir zeigt zum Spieler.
      // Also facingYaw = atan2(-hitDirX, -hitDirZ).
      const yaw = Math.atan2(-hitDirX, -hitDirZ);
      const seed = enemy.ragdollSeed ?? 0;
      // STANDARD-Zombie: lebend bei y≈1.2, liegend Wurzel bei y≈0.25
      const pose = computeRagdollPose(
        elapsed,
        hitDirX,
        hitDirZ,
        yaw,
        1.2,
        0.25,
        seed,
        false,
      );

      groupRef.current.position.x = baseX;
      groupRef.current.position.y = pose.groupY;
      groupRef.current.position.z = baseZ;
      groupRef.current.rotation.set(
        pose.groupPitch,
        pose.groupYaw,
        pose.groupRoll,
      );
      groupRef.current.scale.y = 1; // Skalierungs-Hack aus dem alten Tod-Code raus

      if (torsoRef.current) {
        torsoRef.current.rotation.set(pose.torsoPitch, 0, pose.torsoRoll);
      }
      if (headRef.current && !enemy.headDetached) {
        headRef.current.rotation.set(pose.headPitch, 0, pose.headRoll);
      }
      if (leftArmRef.current && !enemy.leftArmDetached) {
        leftArmRef.current.rotation.set(pose.leftArmPitch, 0, pose.leftArmRoll);
      }
      if (rightArmRef.current && !enemy.rightArmDetached) {
        rightArmRef.current.rotation.set(
          pose.rightArmPitch,
          0,
          pose.rightArmRoll,
        );
      }
      if (leftLegRef.current && !enemy.leftLegDetached) {
        leftLegRef.current.rotation.set(pose.leftLegPitch, 0, pose.leftLegRoll);
      }
      if (rightLegRef.current && !enemy.rightLegDetached) {
        rightLegRef.current.rotation.set(
          pose.rightLegPitch,
          0,
          pose.rightLegRoll,
        );
      }

      // ── Fade-Out wenn die Leiche zum Despawn markiert wurde ──
      // Material-Cache wird hier befüllt (einmalig), sodass wir nicht jeden
      // Frame traversieren. Im "resting"-Zustand bleibt Opacity = 1.
      let mats = deadMaterialsRef.current;
      if (!mats) {
        const set = new Set<THREE.Material>();
        groupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            set.add(child.material as THREE.Material);
          }
        });
        mats = Array.from(set);
        deadMaterialsRef.current = mats;
        for (const m of mats) m.transparent = true;
      }

      if (
        enemy.corpseState === "fadingOut" &&
        enemy.fadeStartTime !== undefined
      ) {
        const fadeElapsed = (Date.now() - enemy.fadeStartTime) / 1000;
        const opacity = Math.max(0, 1 - fadeElapsed / 0.6); // FADE_DURATION_MS=600
        for (const m of mats) m.opacity = opacity;
      } else {
        // resting / ragdoll: voll sichtbar
        for (const m of mats) m.opacity = 1;
      }
      return; // KEINE Lebend-Logik weiter
    }

    // ── LEBEND ──
    // PERF: aktuelle Position aus dem Ref (per-Frame mutiert ohne React-Render).
    // Fallback auf enemy.position, falls der Eintrag fehlt (z.B. direkt nach Tod
    // und Cleanup) — dann bleibt der Zombie an Ort und Stelle für die Death-
    // Animation.
    const refPos = enemyPositionsRef.current.get(enemy.id);
    const tx = refPos ? refPos[0] : enemy.position[0];
    const ty = refPos ? refPos[1] : enemy.position[1];
    const tz = refPos ? refPos[2] : enemy.position[2];
    lerpTargetRef.current.set(tx, ty, tz);
    groupRef.current.position.lerp(
      lerpTargetRef.current,
      Math.min(delta * 12, 1),
    );

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

    if (enemy.isHit) {
      // Hit-Flash-Timer läuft weiter, damit onHitFlashDone() korrekt feuert
      // und useEnemySystem.clearHitFlash() den isHit-State zurücksetzt.
      // ENTFERNT: Rotes Aufleuchten der Materials (war hier ein emissive.setRGB-
      // Loop) — vom Spieler so gewünscht. Treffer-Feedback läuft jetzt nur noch
      // über Blut-Partikel + Blut-Splatter-Decal.
      hitFlashRef.current = Math.min(hitFlashRef.current + delta * 8, 1);
      if (hitFlashRef.current >= 0.9) {
        onHitFlashDone(enemy.id);
        hitFlashRef.current = 0;
      }
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
        {/* ══════════════════════════════════════════════════════════════════
            HIGH-END ZOMBIE BODY — realistic human proportions (1.75m total).
            Coord system: y=0 at center, body extends -1.20 (boden) to +0.55 (Kopf-Top).
            All refs preserved for existing walk-cycle animation.

            Vertical anatomy layout (y relative to enemy.position):
              +0.55  Kopf-Top (Haar)
              +0.40  Augen
              +0.22  Kinn
              +0.15  Hals-Top
              +0.08  Schulter (Joint)
               0.00  Brustmitte
              -0.18  Bauchnabel
              -0.32  Becken-Mitte
              -0.45  Schritt / Hüftgelenk (Bein-Anfang)
              -0.82  Knie
              -1.15  Knöchel
              -1.20  Boden (Stiefel-Sohle)
            ══════════════════════════════════════════════════════════════════ */}

        {/* ══ TORSO GROUP — schlanker schmaler Brustkorb ══ */}
        <group ref={torsoRef} position={[0, -0.05, 0]} rotation={[0.25, 0, 0]}>
          {/* Brustkorb — länger schmaler oval (NICHT mehr breit klobig) */}
          <mesh material={skinMat} position={[0, 0.15, 0]} scale={[1, 1, 0.7]}>
            <capsuleGeometry args={[0.22, 0.3, 10, 20]} />
          </mesh>
          {/* Bauch — verjüngt sich nach unten */}
          <mesh
            material={skinPaleMat}
            position={[0, -0.13, 0.04]}
            scale={[0.95, 1, 0.62]}
          >
            <capsuleGeometry args={[0.2, 0.16, 8, 16]} />
          </mesh>

          {/* ── HEMD/OVERALL über dem Torso (deutlich erkennbar) ── */}
          <mesh
            material={clothMat}
            position={[0, 0.05, 0]}
            scale={[1.05, 1.05, 0.72]}
          >
            <capsuleGeometry args={[0.23, 0.42, 10, 20]} />
          </mesh>

          {/* Reißverschluss-Öffnung (Brust sichtbar) */}
          <mesh material={skinMat} position={[0, 0.05, 0.175]}>
            <boxGeometry args={[0.06, 0.5, 0.005]} />
          </mesh>
          <mesh material={necroDeepMat} position={[0, 0.05, 0.182]}>
            <boxGeometry args={[0.01, 0.5, 0.005]} />
          </mesh>
          {/* V-Kragen */}
          <mesh
            material={clothMat}
            position={[-0.06, 0.28, 0.165]}
            rotation={[0, 0, 0.35]}
          >
            <boxGeometry args={[0.035, 0.14, 0.018]} />
          </mesh>
          <mesh
            material={clothMat}
            position={[0.06, 0.28, 0.165]}
            rotation={[0, 0, -0.35]}
          >
            <boxGeometry args={[0.035, 0.14, 0.018]} />
          </mesh>
          {/* Brusttaschen */}
          <mesh material={clothTornMat} position={[-0.12, 0.12, 0.18]}>
            <boxGeometry args={[0.09, 0.11, 0.006]} />
          </mesh>
          <mesh material={clothTornMat} position={[0.12, 0.12, 0.18]}>
            <boxGeometry args={[0.09, 0.11, 0.006]} />
          </mesh>
          <mesh material={necroDeepMat} position={[-0.12, 0.17, 0.184]}>
            <boxGeometry args={[0.09, 0.022, 0.005]} />
          </mesh>
          <mesh material={necroDeepMat} position={[0.12, 0.17, 0.184]}>
            <boxGeometry args={[0.09, 0.022, 0.005]} />
          </mesh>
          <mesh material={boneMat} position={[-0.12, 0.17, 0.188]}>
            <cylinderGeometry args={[0.009, 0.009, 0.003, 8]} />
          </mesh>
          <mesh material={boneMat} position={[0.12, 0.17, 0.188]}>
            <cylinderGeometry args={[0.009, 0.009, 0.003, 8]} />
          </mesh>
          {/* Namens-Patch */}
          <mesh material={skinPaleMat} position={[0.13, -0.02, 0.185]}>
            <boxGeometry args={[0.09, 0.032, 0.004]} />
          </mesh>

          {/* Zerlumpte Stoff-Fetzen unten am Hemd */}
          <mesh
            material={clothTornMat}
            position={[-0.14, -0.24, 0.13]}
            rotation={[0.25, 0, 0.18]}
            scale={[1, 1.5, 1]}
          >
            <boxGeometry args={[0.05, 0.13, 0.012]} />
          </mesh>
          <mesh
            material={clothTornMat}
            position={[0.16, -0.22, 0.11]}
            rotation={[0.2, 0, -0.22]}
            scale={[1, 1.7, 1]}
          >
            <boxGeometry args={[0.045, 0.14, 0.012]} />
          </mesh>
          <mesh
            material={clothTornMat}
            position={[0.04, -0.26, 0.14]}
            rotation={[0.3, 0, 0.04]}
            scale={[1, 1.4, 1]}
          >
            <boxGeometry args={[0.05, 0.11, 0.012]} />
          </mesh>

          {/* Blut-Spritzer */}
          <mesh material={bloodMat} position={[-0.06, 0.18, 0.184]}>
            <sphereGeometry args={[0.038, 8, 6]} />
          </mesh>
          <mesh material={bloodFreshMat} position={[0.04, -0.05, 0.184]}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
          <mesh
            material={bloodMat}
            position={[-0.11, -0.12, 0.178]}
            scale={[0.6, 2.4, 1]}
          >
            <sphereGeometry args={[0.018, 6, 5]} />
          </mesh>
          <mesh
            material={bloodFreshMat}
            position={[0.14, 0.02, 0.184]}
            scale={[0.5, 1.8, 1]}
          >
            <sphereGeometry args={[0.016, 6, 5]} />
          </mesh>

          {/* ══ HALS — lang, schmal (typisch menschlich) ══ */}
          {!enemy.headDetached && (
            <mesh material={skinMat} position={[0, 0.36, -0.01]}>
              <capsuleGeometry args={[0.062, 0.1, 6, 12]} />
            </mesh>
          )}
          {enemy.headDetached && (
            <Stump
              position={[0, 0.4, -0.01]}
              radius={0.08}
              bloodMat={bloodMat}
              boneMat={boneMat}
              fleshMat={fleshMat}
            />
          )}
          {/* Adamsapfel */}
          {!enemy.headDetached && (
            <mesh material={skinMat} position={[0, 0.36, 0.05]}>
              <sphereGeometry args={[0.025, 8, 6]} />
            </mesh>
          )}

          {/* ══ KOPF ══ menschliche Schädelform, leicht verjüngt zum Kinn */}
          {!enemy.headDetached && (
            <group
              ref={headRef}
              position={[0, 0.52, -0.02]}
              userData={{ isHead: true }}
            >
              {/* Schädel oben — sphere */}
              <mesh
                material={skinMat}
                position={[0, 0.02, 0]}
                scale={[1, 1.1, 1.05]}
                userData={{ isHead: true }}
              >
                <sphereGeometry args={[0.16, 24, 20]} />
              </mesh>

              {/* Unteres Gesicht / Kiefer — schmaler, mehr nach vorn */}
              <mesh
                material={skinMat}
                position={[0, -0.11, 0.025]}
                scale={[0.88, 0.55, 0.95]}
              >
                <sphereGeometry args={[0.15, 18, 14]} />
              </mesh>

              {/* Stirn-Patch (nekrotisch) */}
              <mesh
                material={necroMat}
                position={[0, 0.1, 0.135]}
                scale={[1.8, 0.5, 0.1]}
                rotation={[0.15, 0, 0]}
              >
                <sphereGeometry args={[0.085, 12, 8]} />
              </mesh>

              {/* Schläfe-Wunde links */}
              <mesh
                material={necroDeepMat}
                position={[-0.145, 0.04, 0.05]}
                scale={[0.35, 1.3, 1.5]}
              >
                <sphereGeometry args={[0.045, 8, 6]} />
              </mesh>
              <mesh
                material={bloodFreshMat}
                position={[-0.15, 0.025, 0.05]}
                scale={[0.3, 1, 1.5]}
              >
                <sphereGeometry args={[0.038, 8, 6]} />
              </mesh>

              {/* Eingefallene Wangen */}
              <mesh
                material={necroMat}
                position={[-0.13, -0.04, 0.105]}
                scale={[0.5, 1.1, 0.5]}
              >
                <sphereGeometry args={[0.04, 10, 8]} />
              </mesh>
              <mesh
                material={necroMat}
                position={[0.13, -0.04, 0.105]}
                scale={[0.5, 1.1, 0.5]}
              >
                <sphereGeometry args={[0.04, 10, 8]} />
              </mesh>

              {/* ── AUGEN — eingesunkene Höhlen ── */}
              <mesh
                material={eyeMat}
                position={[-0.075, 0.03, 0.13]}
                scale={[1, 0.8, 0.4]}
              >
                <sphereGeometry args={[0.042, 10, 8]} />
              </mesh>
              <mesh
                material={eyeMat}
                position={[0.075, 0.03, 0.13]}
                scale={[1, 0.8, 0.4]}
              >
                <sphereGeometry args={[0.042, 10, 8]} />
              </mesh>
              {/* Augäpfel weiß-gelblich */}
              <mesh material={teethMat} position={[-0.075, 0.03, 0.142]}>
                <sphereGeometry args={[0.027, 12, 10]} />
              </mesh>
              <mesh material={teethMat} position={[0.075, 0.03, 0.142]}>
                <sphereGeometry args={[0.027, 12, 10]} />
              </mesh>
              {/* Glühende Pupillen */}
              <mesh position={[-0.075, 0.03, 0.16]}>
                <sphereGeometry args={[0.016, 10, 8]} />
                <primitive object={eyeGlowMat.current} attach="material" />
              </mesh>
              <mesh position={[0.075, 0.03, 0.16]}>
                <sphereGeometry args={[0.016, 10, 8]} />
                <primitive object={eyeGlowMat.current} attach="material" />
              </mesh>

              {/* Brauenwülste */}
              <mesh
                material={necroMat}
                position={[-0.075, 0.085, 0.145]}
                rotation={[0, 0, -0.2]}
                scale={[1.7, 0.45, 0.35]}
              >
                <sphereGeometry args={[0.04, 10, 8]} />
              </mesh>
              <mesh
                material={necroMat}
                position={[0.075, 0.085, 0.145]}
                rotation={[0, 0, 0.2]}
                scale={[1.7, 0.45, 0.35]}
              >
                <sphereGeometry args={[0.04, 10, 8]} />
              </mesh>

              {/* ── NASE — schmal, knöchern, leicht hervorstehend ── */}
              <mesh
                material={skinPaleMat}
                position={[0, -0.015, 0.16]}
                rotation={[0.6, 0, 0]}
                scale={[0.55, 1.5, 0.85]}
              >
                <sphereGeometry args={[0.032, 10, 8]} />
              </mesh>
              {/* Nasenrücken */}
              <mesh
                material={skinPaleMat}
                position={[0, 0.025, 0.15]}
                rotation={[0.3, 0, 0]}
                scale={[0.3, 1.4, 0.6]}
              >
                <sphereGeometry args={[0.022, 8, 6]} />
              </mesh>
              {/* Nasenlöcher */}
              <mesh material={eyeMat} position={[-0.018, -0.05, 0.17]}>
                <sphereGeometry args={[0.009, 6, 5]} />
              </mesh>
              <mesh material={eyeMat} position={[0.018, -0.05, 0.17]}>
                <sphereGeometry args={[0.009, 6, 5]} />
              </mesh>

              {/* ── MUND — weit aufgerissen, CoD-Zombie typisch ── */}
              {/* Schwarze Mundöffnung */}
              <mesh
                material={eyeMat}
                position={[0, -0.105, 0.145]}
                scale={[1.3, 0.7, 0.55]}
              >
                <sphereGeometry args={[0.07, 14, 10]} />
              </mesh>
              {/* Zunge/Rachen */}
              <mesh
                material={fleshMat}
                position={[0, -0.115, 0.15]}
                scale={[1, 0.4, 0.5]}
              >
                <sphereGeometry args={[0.05, 10, 8]} />
              </mesh>
              {/* Obere Zahnreihe */}
              {[-0.055, -0.028, 0, 0.028, 0.055].map((tx) => (
                <mesh
                  key={`top-${tx}`}
                  material={teethMat}
                  position={[tx, -0.075, 0.163]}
                >
                  <boxGeometry args={[0.018, 0.03, 0.015]} />
                </mesh>
              ))}
              {/* Untere Zahnreihe versetzt */}
              {[-0.04, -0.012, 0.02, 0.045].map((tx) => (
                <mesh
                  key={`bot-${tx}`}
                  material={teethMat}
                  position={[tx, -0.13, 0.163]}
                >
                  <boxGeometry args={[0.016, 0.026, 0.015]} />
                </mesh>
              ))}
              {/* Eckzahn */}
              <mesh
                material={teethMat}
                position={[0.072, -0.092, 0.163]}
                rotation={[0, 0, -0.1]}
              >
                <coneGeometry args={[0.011, 0.048, 6]} />
              </mesh>
              {/* Lippen — dünne Capsules */}
              <mesh
                material={necroDeepMat}
                position={[0, -0.06, 0.155]}
                scale={[1.4, 0.3, 0.4]}
              >
                <torusGeometry args={[0.05, 0.012, 6, 16]} />
              </mesh>

              {/* Blut tropfend aus dem Mund */}
              <mesh
                material={bloodFreshMat}
                position={[-0.03, -0.17, 0.16]}
                scale={[1, 2.8, 1]}
              >
                <sphereGeometry args={[0.009, 6, 5]} />
              </mesh>
              <mesh
                material={bloodMat}
                position={[0.04, -0.16, 0.16]}
                scale={[1, 2, 1]}
              >
                <sphereGeometry args={[0.007, 6, 5]} />
              </mesh>

              {/* Wunde Wange rechts */}
              <mesh
                material={fleshMat}
                position={[0.06, -0.01, 0.155]}
                rotation={[0, 0, 0.4]}
                scale={[0.3, 1.6, 0.3]}
              >
                <sphereGeometry args={[0.03, 8, 6]} />
              </mesh>

              {/* Blut-Streifen über Gesicht */}
              <mesh
                material={bloodMat}
                position={[0.03, -0.04, 0.16]}
                scale={[0.3, 3.2, 0.3]}
              >
                <sphereGeometry args={[0.02, 6, 5]} />
              </mesh>
              <mesh
                material={bloodMat}
                position={[-0.06, -0.06, 0.16]}
                scale={[0.5, 2.5, 0.3]}
              >
                <sphereGeometry args={[0.016, 6, 5]} />
              </mesh>
              <mesh
                material={bloodFreshMat}
                position={[0.085, 0.105, 0.16]}
                scale={[1.2, 1, 0.3]}
              >
                <sphereGeometry args={[0.022, 8, 6]} />
              </mesh>

              {/* Ohren */}
              <mesh
                material={skinMat}
                position={[-0.16, 0.01, 0.02]}
                rotation={[0, -0.3, 0]}
                scale={[0.25, 1, 0.65]}
              >
                <sphereGeometry args={[0.05, 10, 8]} />
              </mesh>
              <mesh
                material={skinMat}
                position={[0.16, 0.01, 0.02]}
                rotation={[0, 0.3, 0]}
                scale={[0.25, 1, 0.65]}
              >
                <sphereGeometry args={[0.05, 10, 8]} />
              </mesh>
              {/* Zerfetztes Ohr links */}
              <mesh
                material={fleshMat}
                position={[-0.17, -0.02, 0.015]}
                scale={[0.18, 0.55, 0.35]}
              >
                <sphereGeometry args={[0.032, 8, 6]} />
              </mesh>

              {/* ── HAAR — Sphären-Klumpen, zerzaust ── */}
              <mesh
                material={clothMat}
                position={[0, 0.14, -0.01]}
                scale={[1.18, 0.75, 1.12]}
              >
                <sphereGeometry args={[0.16, 18, 12]} />
              </mesh>
              <mesh
                material={clothMat}
                position={[-0.09, 0.17, -0.04]}
                rotation={[-0.2, 0, -0.3]}
                scale={[0.65, 1.3, 0.65]}
              >
                <sphereGeometry args={[0.055, 10, 8]} />
              </mesh>
              <mesh
                material={clothMat}
                position={[0.11, 0.16, 0.04]}
                rotation={[0.1, 0, 0.4]}
                scale={[0.6, 1.4, 0.6]}
              >
                <sphereGeometry args={[0.05, 10, 8]} />
              </mesh>
              {/* Skalp-Wunde (Haarausfall + sichtbares Fleisch) */}
              <mesh
                material={fleshMat}
                position={[0.04, 0.18, 0.02]}
                scale={[1.5, 0.2, 1.3]}
              >
                <sphereGeometry args={[0.06, 10, 8]} />
              </mesh>
            </group>
          )}

          {/* ══ SCHULTERN — WEIT auseinander, deutlich über Brustkorb ══ */}
          {/* (Schulter-Joints sind innerhalb der Arm-Groups, hier nur Position) */}

          {/* ══ LINKER ARM ══ ausgehend von Schulter bei x=-0.3 (über Brust) */}
          {!enemy.leftArmDetached ? (
            <group
              ref={leftArmRef}
              position={[-0.3, 0.18, 0]}
              rotation={[-1.1, 0, 0.15]}
            >
              {/* Schulter-Joint — passt zum Hemd */}
              <mesh material={clothMat} position={[0, 0, 0]}>
                <sphereGeometry args={[0.085, 14, 10]} />
              </mesh>
              {/* Oberarm — schlank */}
              <mesh material={clothMat} position={[0, -0.2, 0]}>
                <capsuleGeometry args={[0.06, 0.36, 8, 14]} />
              </mesh>
              {/* Ellbogen */}
              <mesh material={skinMat} position={[0, -0.41, 0]}>
                <sphereGeometry args={[0.06, 12, 10]} />
              </mesh>
              {/* Unterarm — exponiert (Hemdärmel hochgekrempelt/zerrissen) */}
              <mesh material={skinMat} position={[0, -0.6, 0]}>
                <capsuleGeometry args={[0.052, 0.34, 8, 14]} />
              </mesh>
              {/* Adern */}
              <mesh material={necroDeepMat} position={[0, -0.58, 0.048]}>
                <capsuleGeometry args={[0.005, 0.24, 3, 6]} />
              </mesh>
              <mesh material={necroDeepMat} position={[-0.025, -0.6, 0.045]}>
                <capsuleGeometry args={[0.004, 0.2, 3, 6]} />
              </mesh>
              {/* Hochgekrempelte Stoff-Manschette */}
              <mesh material={clothTornMat} position={[0, -0.42, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.04, 14]} />
              </mesh>
              {/* Handgelenk */}
              <mesh material={skinPaleMat} position={[0, -0.79, 0]}>
                <sphereGeometry args={[0.05, 12, 10]} />
              </mesh>
              {/* Handfläche — flach-länglich */}
              <mesh
                material={skinPaleMat}
                position={[0, -0.86, 0.008]}
                scale={[1, 1.1, 0.55]}
              >
                <sphereGeometry args={[0.06, 14, 10]} />
              </mesh>
              {/* 4 Klauen-Finger (länger, organischer) */}
              {[-0.038, -0.012, 0.015, 0.04].map((fx, idx) => (
                <group key={`l-finger-${fx}`}>
                  <mesh
                    material={skinPaleMat}
                    position={[fx, -0.97, 0.005]}
                    rotation={[idx * 0.04, 0, 0]}
                  >
                    <capsuleGeometry args={[0.011, 0.085, 4, 8]} />
                  </mesh>
                  {/* Klauen-Nagel */}
                  <mesh
                    material={boneMat}
                    position={[fx, -1.05, 0.012]}
                    rotation={[0.4, 0, 0]}
                  >
                    <coneGeometry args={[0.01, 0.038, 5]} />
                  </mesh>
                </group>
              ))}
              {/* Daumen seitlich abgespreizt */}
              <mesh
                material={skinPaleMat}
                position={[-0.067, -0.93, 0.005]}
                rotation={[0, 0, 0.7]}
              >
                <capsuleGeometry args={[0.011, 0.07, 4, 8]} />
              </mesh>
              <mesh
                material={boneMat}
                position={[-0.092, -0.96, 0.012]}
                rotation={[0, 0, 1.4]}
              >
                <coneGeometry args={[0.009, 0.034, 5]} />
              </mesh>
              {/* Bisswunde */}
              <mesh
                material={fleshMat}
                position={[-0.05, -0.5, 0]}
                scale={[0.4, 1.4, 1.4]}
              >
                <sphereGeometry args={[0.032, 8, 6]} />
              </mesh>
              <mesh
                material={bloodFreshMat}
                position={[-0.052, -0.56, 0.03]}
                scale={[0.3, 2.5, 0.5]}
              >
                <sphereGeometry args={[0.014, 6, 5]} />
              </mesh>
            </group>
          ) : (
            <Stump
              position={[-0.3, 0.18, 0]}
              radius={0.1}
              bloodMat={bloodMat}
              boneMat={boneMat}
              fleshMat={fleshMat}
            />
          )}

          {/* ══ RECHTER ARM ══ */}
          {!enemy.rightArmDetached ? (
            <group
              ref={rightArmRef}
              position={[0.3, 0.18, 0]}
              rotation={[-1.0, 0, -0.15]}
            >
              <mesh material={clothMat} position={[0, 0, 0]}>
                <sphereGeometry args={[0.085, 14, 10]} />
              </mesh>
              <mesh material={clothMat} position={[0, -0.2, 0]}>
                <capsuleGeometry args={[0.06, 0.36, 8, 14]} />
              </mesh>
              <mesh material={skinMat} position={[0, -0.41, 0]}>
                <sphereGeometry args={[0.06, 12, 10]} />
              </mesh>
              <mesh material={skinMat} position={[0, -0.6, 0]}>
                <capsuleGeometry args={[0.052, 0.34, 8, 14]} />
              </mesh>
              <mesh material={necroDeepMat} position={[0, -0.58, 0.048]}>
                <capsuleGeometry args={[0.005, 0.24, 3, 6]} />
              </mesh>
              <mesh material={clothTornMat} position={[0, -0.42, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.04, 14]} />
              </mesh>
              <mesh material={skinPaleMat} position={[0, -0.79, 0]}>
                <sphereGeometry args={[0.05, 12, 10]} />
              </mesh>
              <mesh
                material={skinPaleMat}
                position={[0, -0.86, 0.008]}
                scale={[1, 1.1, 0.55]}
              >
                <sphereGeometry args={[0.06, 14, 10]} />
              </mesh>
              {[-0.038, -0.012, 0.015, 0.04].map((fx, idx) => (
                <group key={`r-finger-${fx}`}>
                  <mesh
                    material={skinPaleMat}
                    position={[fx, -0.97, 0.005]}
                    rotation={[idx * 0.04, 0, 0]}
                  >
                    <capsuleGeometry args={[0.011, 0.085, 4, 8]} />
                  </mesh>
                  <mesh
                    material={boneMat}
                    position={[fx, -1.05, 0.012]}
                    rotation={[0.4, 0, 0]}
                  >
                    <coneGeometry args={[0.01, 0.038, 5]} />
                  </mesh>
                </group>
              ))}
              <mesh
                material={skinPaleMat}
                position={[0.067, -0.93, 0.005]}
                rotation={[0, 0, -0.7]}
              >
                <capsuleGeometry args={[0.011, 0.07, 4, 8]} />
              </mesh>
              <mesh
                material={boneMat}
                position={[0.092, -0.96, 0.012]}
                rotation={[0, 0, -1.4]}
              >
                <coneGeometry args={[0.009, 0.034, 5]} />
              </mesh>
              {/* Hängender Hemd-Fetzen */}
              <mesh
                material={clothTornMat}
                position={[0.08, -0.46, 0.06]}
                rotation={[0.3, 0, 0.25]}
                scale={[0.3, 2, 0.5]}
              >
                <sphereGeometry args={[0.04, 8, 6]} />
              </mesh>
            </group>
          ) : (
            <Stump
              position={[0.3, 0.18, 0]}
              radius={0.1}
              bloodMat={bloodMat}
              boneMat={boneMat}
              fleshMat={fleshMat}
            />
          )}
        </group>

        {/* ══ BECKEN ══ Hose oben, klar abgesetzt vom Torso */}
        <mesh
          material={clothTornMat}
          position={[0, -0.36, 0]}
          scale={[1, 0.6, 0.6]}
        >
          <sphereGeometry args={[0.24, 18, 12]} />
        </mesh>
        {/* Gürtel */}
        <mesh material={necroDeepMat} position={[0, -0.3, 0.13]}>
          <torusGeometry args={[0.23, 0.018, 8, 24]} />
        </mesh>
        <mesh material={boneMat} position={[0, -0.3, 0.155]}>
          <boxGeometry args={[0.05, 0.035, 0.012]} />
        </mesh>

        {/* ══ LINKES BEIN ══ Oberschenkel ab Hüfte, Knie, Wade, Stiefel */}
        {!enemy.leftLegDetached ? (
          <group ref={leftLegRef} position={[-0.11, -0.45, 0]}>
            {/* Oberschenkel — Hose, ca. 36cm lang */}
            <mesh material={clothTornMat} position={[0, -0.2, 0]}>
              <capsuleGeometry args={[0.095, 0.34, 8, 14]} />
            </mesh>
            {/* Knie-Gelenk */}
            <mesh material={clothTornMat} position={[0, -0.4, 0]}>
              <sphereGeometry args={[0.09, 14, 10]} />
            </mesh>
            {/* Wade — schmaler */}
            <mesh material={clothTornMat} position={[0, -0.58, 0]}>
              <capsuleGeometry args={[0.085, 0.32, 8, 14]} />
            </mesh>
            {/* Schienbein-Wunde (Knochen sichtbar) */}
            <mesh
              material={fleshMat}
              position={[0.035, -0.58, 0.075]}
              scale={[0.3, 2, 0.3]}
            >
              <sphereGeometry args={[0.045, 8, 6]} />
            </mesh>
            <mesh
              material={boneMat}
              position={[0.035, -0.56, 0.08]}
              scale={[0.25, 1.8, 0.25]}
            >
              <sphereGeometry args={[0.032, 8, 6]} />
            </mesh>
            {/* Knöchel */}
            <mesh material={skinPaleMat} position={[0, -0.76, 0]}>
              <sphereGeometry args={[0.058, 10, 8]} />
            </mesh>
            {/* Stiefel — LANG nach vorne (Schuhform), Sphere mit z-scale */}
            <mesh
              material={eyeMat}
              position={[0, -0.78, 0.08]}
              scale={[0.85, 0.5, 1.8]}
            >
              <sphereGeometry args={[0.1, 14, 10]} />
            </mesh>
            {/* Stiefel-Schaft */}
            <mesh material={eyeMat} position={[0, -0.72, 0]}>
              <cylinderGeometry args={[0.088, 0.083, 0.07, 14]} />
            </mesh>
            {/* Sohle */}
            <mesh
              material={necroDeepMat}
              position={[0, -0.83, 0.08]}
              scale={[0.85, 0.2, 1.8]}
            >
              <sphereGeometry args={[0.095, 12, 8]} />
            </mesh>
            {/* Kaputte Stiefelspitze (Zeh durchbricht) */}
            <mesh material={fleshMat} position={[0, -0.78, 0.22]}>
              <sphereGeometry args={[0.035, 8, 6]} />
            </mesh>
          </group>
        ) : (
          <Stump
            position={[-0.11, -0.45, 0]}
            radius={0.12}
            bloodMat={bloodMat}
            boneMat={boneMat}
            fleshMat={fleshMat}
          />
        )}

        {/* ══ RECHTES BEIN ══ */}
        {!enemy.rightLegDetached ? (
          <group ref={rightLegRef} position={[0.11, -0.45, 0]}>
            <mesh material={clothTornMat} position={[0, -0.2, 0]}>
              <capsuleGeometry args={[0.095, 0.34, 8, 14]} />
            </mesh>
            <mesh material={clothTornMat} position={[0, -0.4, 0]}>
              <sphereGeometry args={[0.09, 14, 10]} />
            </mesh>
            <mesh material={clothTornMat} position={[0, -0.58, 0]}>
              <capsuleGeometry args={[0.085, 0.32, 8, 14]} />
            </mesh>
            {/* Blut-Streifen runterlaufend */}
            <mesh
              material={bloodMat}
              position={[-0.06, -0.5, 0.075]}
              scale={[0.25, 3, 0.3]}
            >
              <sphereGeometry args={[0.014, 6, 5]} />
            </mesh>
            <mesh material={skinPaleMat} position={[0, -0.76, 0]}>
              <sphereGeometry args={[0.058, 10, 8]} />
            </mesh>
            <mesh
              material={eyeMat}
              position={[0, -0.78, 0.08]}
              scale={[0.85, 0.5, 1.8]}
            >
              <sphereGeometry args={[0.1, 14, 10]} />
            </mesh>
            <mesh material={eyeMat} position={[0, -0.72, 0]}>
              <cylinderGeometry args={[0.088, 0.083, 0.07, 14]} />
            </mesh>
            <mesh
              material={necroDeepMat}
              position={[0, -0.83, 0.08]}
              scale={[0.85, 0.2, 1.8]}
            >
              <sphereGeometry args={[0.095, 12, 8]} />
            </mesh>
            <mesh material={fleshMat} position={[0, -0.78, 0.22]}>
              <sphereGeometry args={[0.035, 8, 6]} />
            </mesh>
          </group>
        ) : (
          <Stump
            position={[0.11, -0.45, 0]}
            radius={0.12}
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
  enemyPositionsRef,
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
  // PERF: stabiler Vector3 für lerp-Target — keine neue Allokation pro Frame
  const lerpTargetRef = useRef(new THREE.Vector3());
  // PERF: siehe StandardZombie — Material-Cache für Dead-Fade-Out
  const deadMaterialsRef = useRef<THREE.Material[] | null>(null);

  const skinMat = useStandardMaterial("#4a5c3a");
  const skinPaleMat = useStandardMaterial("#5e7048");
  const necroMat = useStandardMaterial("#2e3d22");
  const necroDeepMat = useStandardMaterial("#1a2412");
  const clothMat = useStandardMaterial("#1a1208");
  const clothTornMat = useStandardMaterial("#120e06");
  const bloodMat = useStandardMaterial("#6a0000");
  const bloodFreshMat = useStandardMaterial("#8a0a0a");
  const fleshMat = useStandardMaterial("#5a1010");
  const boneMat = useStandardMaterial("#c8c0b0");
  const teethMat = useStandardMaterial("#a89a70");

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

    // ── TOTE/DESPAWNENDE BOSS: Ragdoll + Fade (siehe StandardZombie) ────────
    if (enemy.isDead) {
      const refPos = enemyPositionsRef.current.get(enemy.id);
      const baseX = refPos ? refPos[0] : enemy.position[0];
      const baseZ = refPos ? refPos[2] : enemy.position[2];

      const elapsed = (Date.now() - enemy.deathTime) / 1000;
      const hitDirX = enemy.deathHitDirX ?? 0;
      const hitDirZ = enemy.deathHitDirZ ?? 1;
      // Yaw rekonstruieren (siehe StandardZombie für Begründung)
      const yaw = Math.atan2(-hitDirX, -hitDirZ);
      const seed = enemy.ragdollSeed ?? 0;
      // BOSS: lebend bei y≈1.5, liegend Wurzel bei y≈0.35 (etwas höher wegen
      // bulligerem Körper)
      const pose = computeRagdollPose(
        elapsed,
        hitDirX,
        hitDirZ,
        yaw,
        1.5,
        0.35,
        seed,
        true,
      );

      groupRef.current.position.x = baseX;
      groupRef.current.position.y = pose.groupY;
      groupRef.current.position.z = baseZ;
      groupRef.current.rotation.set(
        pose.groupPitch,
        pose.groupYaw,
        pose.groupRoll,
      );
      groupRef.current.scale.y = 1;

      if (torsoRef.current) {
        torsoRef.current.rotation.set(pose.torsoPitch, 0, pose.torsoRoll);
      }
      if (headRef.current && !enemy.headDetached) {
        headRef.current.rotation.set(pose.headPitch, 0, pose.headRoll);
      }
      if (leftArmRef.current && !enemy.leftArmDetached) {
        leftArmRef.current.rotation.set(pose.leftArmPitch, 0, pose.leftArmRoll);
      }
      if (rightArmRef.current && !enemy.rightArmDetached) {
        rightArmRef.current.rotation.set(
          pose.rightArmPitch,
          0,
          pose.rightArmRoll,
        );
      }
      if (leftLegRef.current && !enemy.leftLegDetached) {
        leftLegRef.current.rotation.set(pose.leftLegPitch, 0, pose.leftLegRoll);
      }
      if (rightLegRef.current && !enemy.rightLegDetached) {
        rightLegRef.current.rotation.set(
          pose.rightLegPitch,
          0,
          pose.rightLegRoll,
        );
      }

      let mats = deadMaterialsRef.current;
      if (!mats) {
        const set = new Set<THREE.Material>();
        groupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            set.add(child.material as THREE.Material);
          }
        });
        mats = Array.from(set);
        deadMaterialsRef.current = mats;
        for (const m of mats) m.transparent = true;
      }

      if (
        enemy.corpseState === "fadingOut" &&
        enemy.fadeStartTime !== undefined
      ) {
        const fadeElapsed = (Date.now() - enemy.fadeStartTime) / 1000;
        const opacity = Math.max(0, 1 - fadeElapsed / 0.6);
        for (const m of mats) m.opacity = opacity;
      } else {
        for (const m of mats) m.opacity = 1;
      }
      return;
    }

    // ── LEBEND ──
    // PERF: aktuelle Position aus Ref (siehe StandardZombie für Details)
    const refPos = enemyPositionsRef.current.get(enemy.id);
    const tx = refPos ? refPos[0] : enemy.position[0];
    const ty = refPos ? refPos[1] : enemy.position[1];
    const tz = refPos ? refPos[2] : enemy.position[2];
    lerpTargetRef.current.set(tx, ty, tz);
    groupRef.current.position.lerp(
      lerpTargetRef.current,
      Math.min(delta * 8, 1),
    );

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

    if (enemy.isHit) {
      // Hit-Flash-Timer läuft weiter, damit onHitFlashDone() korrekt feuert
      // und useEnemySystem.clearHitFlash() den isHit-State zurücksetzt.
      // ENTFERNT: Rotes Aufleuchten der Materials (war hier ein emissive.setRGB-
      // Loop) — vom Spieler so gewünscht. Treffer-Feedback läuft jetzt nur noch
      // über Blut-Partikel + Blut-Splatter-Decal.
      hitFlashRef.current = Math.min(hitFlashRef.current + delta * 8, 1);
      if (hitFlashRef.current >= 0.9) {
        onHitFlashDone(enemy.id);
        hitFlashRef.current = 0;
      }
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
// PERF: `memo` verhindert ein Re-Render aller Enemy-Meshes wenn nur der Parent
// (GameScene) re-rendert ohne dass das jeweilige Enemy-Objekt sich geändert hat.
// Da updateEnemyPositions nicht mehr durch React-State läuft, ändert sich das
// Enemy-Objekt nur bei echten Events (Damage, Tod, Dismemberment, HitFlash).
// shallow compare reicht: alle anderen Props (Refs, Callbacks) sind stabil.
function EnemyMeshInner({
  enemy,
  onHitFlashDone,
  playerPositionRef,
  enemyPositionsRef,
}: EnemyMeshProps) {
  if (enemy.type === "boss") {
    return (
      <BossZombie
        enemy={enemy}
        onHitFlashDone={onHitFlashDone}
        playerPositionRef={playerPositionRef}
        enemyPositionsRef={enemyPositionsRef}
      />
    );
  }
  return (
    <StandardZombie
      enemy={enemy}
      onHitFlashDone={onHitFlashDone}
      playerPositionRef={playerPositionRef}
      enemyPositionsRef={enemyPositionsRef}
    />
  );
}

export const EnemyMesh = memo(EnemyMeshInner);
