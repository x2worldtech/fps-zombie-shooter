import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  playNuclearImpact,
  playNuclearSiren,
  playRocketApproach,
} from "../../utils/audioSynthesis";
import { WARZONE_BUILDING_DEFS } from "./WarzoneEnvironment";

const IMPACT_POINT = new THREE.Vector3(-80, 0, -80);
const ROCKET_START = new THREE.Vector3(200, 800, -300);
const ROCKET_TRAVEL_S = 9;

interface DebrisChunk {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  angularV: THREE.Vector3;
  scale: number;
  born: number;
  lifespan: number;
}

interface NuclearEventProps {
  active: boolean;
  onComplete: () => void;
  playerPosRef: React.MutableRefObject<[number, number, number]>;
  destroyedBuildingIds: React.MutableRefObject<Set<number>>;
  flashRef: React.RefObject<HTMLDivElement | null>;
  onCountdownUpdate: (count: number | null, showHUD: boolean) => void;
  /** Called each frame as shockwave expands — ids of zombies inside blast radius */
  onKillZombiesByShockwave?: (killedIds: string[]) => void;
  /** Current enemies list, needed to check shockwave overlap */
  enemies?: Array<{
    id: string;
    position: [number, number, number];
    isDead: boolean;
  }>;
}

// ── Debris chunk ───────────────────────────────────────────────────────────────
function DebrisMesh({
  chunk,
  elapsed,
}: { chunk: DebrisChunk; elapsed: number }) {
  const age = elapsed - chunk.born;
  if (age < 0 || age > chunk.lifespan) return null;
  const t = age / chunk.lifespan;
  const gravity = 0.5 * 18 * age * age;
  const pos = new THREE.Vector3(
    chunk.position.x + chunk.velocity.x * age,
    chunk.position.y + chunk.velocity.y * age - gravity,
    chunk.position.z + chunk.velocity.z * age,
  );
  const rx = chunk.rotation.x + chunk.angularV.x * age;
  const ry = chunk.rotation.y + chunk.angularV.y * age;
  const rz = chunk.rotation.z + chunk.angularV.z * age;
  return (
    <mesh
      position={[pos.x, pos.y, pos.z]}
      rotation={[rx, ry, rz]}
      scale={chunk.scale}
    >
      <boxGeometry args={[1, 0.6, 0.8]} />
      <meshStandardMaterial
        color="#3a3228"
        roughness={0.9}
        transparent
        opacity={Math.max(0, 1 - t)}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Dust particle (follows shockwave wall) ────────────────────────────────────
function DustParticle({
  angle,
  radius,
  opacity,
  y,
  scale,
}: {
  angle: number;
  radius: number;
  opacity: number;
  y: number;
  scale: number;
}) {
  const x = IMPACT_POINT.x + Math.cos(angle) * radius;
  const z = IMPACT_POINT.z + Math.sin(angle) * radius;
  if (opacity <= 0) return null;
  return (
    <mesh position={[x, y, z]} scale={scale}>
      <sphereGeometry args={[1, 5, 4]} />
      <meshStandardMaterial
        color="#8a6a3a"
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Main Nuclear Event Component ───────────────────────────────────────────────
export function NuclearEvent({
  active,
  onComplete,
  destroyedBuildingIds,
  flashRef,
  onCountdownUpdate,
  onKillZombiesByShockwave,
  enemies = [],
}: NuclearEventProps) {
  const { camera } = useThree();
  const startTimeRef = useRef<number | null>(null);
  const sirenStopRef = useRef<(() => void) | null>(null);
  const rocketStopRef = useRef<(() => void) | null>(null);
  const shakeRef = useRef({ active: false, intensity: 0, end: 0 });
  const completedRef = useRef(false);
  const debrisRef = useRef<DebrisChunk[]>([]);
  const debrisIdRef = useRef(0);
  // Track which zombies already got burned so we don't kill them twice
  const burnedZombieIds = useRef(new Set<string>());

  // 3D refs — rocket
  const rocketGroupRef = useRef<THREE.Group>(null);

  // 3D refs — explosion layers
  const fireballCoreRef = useRef<THREE.Mesh>(null);
  const fireballOuterRef = useRef<THREE.Mesh>(null);
  const fireballPulse1Ref = useRef<THREE.Mesh>(null);
  const fireballPulse2Ref = useRef<THREE.Mesh>(null);
  const groundBurstRef = useRef<THREE.Mesh>(null);
  const stemGroupRef = useRef<THREE.Group>(null);
  const stemCylRef = useRef<THREE.Mesh>(null);
  const stemInnerRef = useRef<THREE.Mesh>(null);
  const capGroupRef = useRef<THREE.Group>(null);
  const capRingRef = useRef<THREE.Mesh>(null);
  const anvilRef = useRef<THREE.Mesh>(null);
  const condensationRingRef = useRef<THREE.Mesh>(null);

  // 3D refs — shockwave
  const shockwaveGroundRef = useRef<THREE.Mesh>(null);
  const shockwaveAtmoRef = useRef<THREE.Mesh>(null);

  const nuclearLightRef = useRef<THREE.PointLight>(null);
  const nuclearLight2Ref = useRef<THREE.PointLight>(null);

  const showCountdownHUDRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [debrisSnapshot, setDebrisSnapshot] = useState<DebrisChunk[]>([]);

  const onCountdownUpdateRef = useRef(onCountdownUpdate);
  useEffect(() => {
    onCountdownUpdateRef.current = onCountdownUpdate;
  });

  const onKillRef = useRef(onKillZombiesByShockwave);
  useEffect(() => {
    onKillRef.current = onKillZombiesByShockwave;
  });

  const enemiesRef = useRef(enemies);
  useEffect(() => {
    enemiesRef.current = enemies;
  });

  const flashActiveRef = useRef(false);
  const impactFiredRef = useRef(false);
  const destroyedSet = useRef(new Set<number>());

  // Current shockwave radius for external callers — updated each frame
  const swRadiusRef = useRef(0);

  // ── Reset ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) {
      startTimeRef.current = null;
      completedRef.current = false;
      impactFiredRef.current = false;
      flashActiveRef.current = false;
      showCountdownHUDRef.current = false;
      destroyedSet.current.clear();
      burnedZombieIds.current.clear();
      debrisRef.current = [];
      swRadiusRef.current = 0;
      sirenStopRef.current?.();
      sirenStopRef.current = null;
      rocketStopRef.current?.();
      rocketStopRef.current = null;
      onCountdownUpdate(null, false);
      setDebrisSnapshot([]);
      const flashEl = flashRef.current;
      if (flashEl) {
        flashEl.style.transition = "none";
        flashEl.style.opacity = "0";
        flashEl.style.display = "none";
        flashEl.style.visibility = "hidden";
      }
      return;
    }

    startTimeRef.current = performance.now() / 1000;
    completedRef.current = false;
    impactFiredRef.current = false;
    flashActiveRef.current = false;
    showCountdownHUDRef.current = true;
    destroyedSet.current.clear();
    burnedZombieIds.current.clear();
    debrisRef.current = [];
    swRadiusRef.current = 0;
    onCountdownUpdate(10, true);

    try {
      sirenStopRef.current = playNuclearSiren();
    } catch (_) {}
  }, [active, flashRef, onCountdownUpdate]);

  // ── White flash ──────────────────────────────────────────────────────────────
  const triggerWhiteFlash = () => {
    if (flashActiveRef.current) return;
    flashActiveRef.current = true;
    const el = flashRef.current;
    if (!el) return;
    el.style.display = "block";
    el.style.visibility = "visible";
    el.style.transition = "none";
    el.style.opacity = "1";
    void el.offsetHeight;
    setTimeout(() => {
      if (!el) return;
      el.style.transition = "opacity 2s ease-out";
      el.style.opacity = "0";
    }, 150);
    setTimeout(() => {
      if (!el) return;
      el.style.display = "none";
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.transition = "none";
      flashActiveRef.current = false;
    }, 2300);
  };

  useFrame(() => {
    if (!active || startTimeRef.current === null) return;

    const now = performance.now() / 1000;
    const t = now - startTimeRef.current;

    setElapsed(t);

    // ── PHASE 1: Countdown ──────────────────────────────────────────────────
    if (t < 10) {
      const remaining = Math.ceil(10 - t);
      onCountdownUpdateRef.current(remaining, true);
    }
    if (t >= 10 && showCountdownHUDRef.current) {
      showCountdownHUDRef.current = false;
      onCountdownUpdateRef.current(null, false);
    }

    // ── PHASE 2: Rocket approach (t=1 to t=10) ──────────────────────────────
    if (t >= 1 && t < 10 && rocketGroupRef.current) {
      const rocketT = Math.min(1, (t - 1) / ROCKET_TRAVEL_S);
      const rPos = ROCKET_START.clone().lerp(IMPACT_POINT, rocketT);
      rocketGroupRef.current.visible = true;
      rocketGroupRef.current.position.copy(rPos);
      const dir = IMPACT_POINT.clone().sub(rPos).normalize();
      rocketGroupRef.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir,
      );

      if (t >= 1 && t < 1.1 && !rocketStopRef.current) {
        try {
          rocketStopRef.current = playRocketApproach(9000);
        } catch (_) {}
      }
    } else if (rocketGroupRef.current) {
      rocketGroupRef.current.visible = t >= 1 && t < 10;
    }

    // ── PHASE 3: Impact (fires once at t=10) ────────────────────────────────
    if (t >= 10 && !impactFiredRef.current) {
      impactFiredRef.current = true;
      sirenStopRef.current?.();
      sirenStopRef.current = null;
      rocketStopRef.current?.();
      rocketStopRef.current = null;
      shakeRef.current = { active: true, intensity: 5.5, end: now + 5.0 };
      triggerWhiteFlash();
      try {
        playNuclearImpact();
      } catch (_) {}
    }

    // ── Screen shake (decays over 5s) ───────────────────────────────────────
    if (shakeRef.current.active) {
      if (now < shakeRef.current.end) {
        const elapsed_ = shakeRef.current.end - 5.0;
        const decay = 1 - (now - elapsed_) / 5.0;
        const i = shakeRef.current.intensity * Math.max(0, decay);
        camera.position.x += (Math.random() - 0.5) * i * 0.14;
        camera.position.y += (Math.random() - 0.5) * i * 0.09;
        camera.position.z += (Math.random() - 0.5) * i * 0.14;
      } else {
        shakeRef.current.active = false;
      }
    }

    // ── PHASE 4: Mushroom cloud ─────────────────────────────────────────────
    if (t >= 10.1) {
      const ct = t - 10.1;
      const totalDuration = 45;
      const fadeFactor = ct > 35 ? Math.max(0, 1 - (ct - 35) / 10) : 1;

      // --- FIREBALL: massive pulsing ground sphere (t=10.1 to t=14) ---
      const fbAlive = ct < 14;
      const fbFade = fbAlive ? Math.max(0, 1 - ct / 14) : 0;

      if (fireballCoreRef.current) {
        const r = Math.min(60, 5 + ct * 22);
        fireballCoreRef.current.visible = fbAlive;
        fireballCoreRef.current.scale.setScalar(r);
        const mat = fireballCoreRef.current
          .material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 10 - ct * 0.5;
        mat.opacity = fbFade * 0.95;
      }
      if (fireballOuterRef.current) {
        const r = Math.min(75, 8 + ct * 26);
        fireballOuterRef.current.visible = fbAlive;
        fireballOuterRef.current.scale.setScalar(r);
        const mat = fireballOuterRef.current
          .material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = Math.max(0, 6 - ct * 0.8);
        mat.opacity = fbFade * 0.7;
      }
      // Pulsing turbulence layers
      if (fireballPulse1Ref.current && fbAlive) {
        const pulse = 0.85 + Math.sin(ct * 12) * 0.15;
        const r = Math.min(50, 4 + ct * 18) * pulse;
        fireballPulse1Ref.current.visible = true;
        fireballPulse1Ref.current.scale.setScalar(r);
        (
          fireballPulse1Ref.current.material as THREE.MeshStandardMaterial
        ).opacity = fbFade * 0.65;
      } else if (fireballPulse1Ref.current) {
        fireballPulse1Ref.current.visible = false;
      }
      if (fireballPulse2Ref.current && fbAlive) {
        const pulse = 0.85 + Math.sin(ct * 8 + 1.5) * 0.15;
        const r = Math.min(45, 3 + ct * 16) * pulse;
        fireballPulse2Ref.current.visible = true;
        fireballPulse2Ref.current.scale.setScalar(r);
        (
          fireballPulse2Ref.current.material as THREE.MeshStandardMaterial
        ).opacity = fbFade * 0.55;
      } else if (fireballPulse2Ref.current) {
        fireballPulse2Ref.current.visible = false;
      }

      // --- GROUND BURST BASE / SKIRT (t=10.1 to t=20): wide fire ring at y=0 ---
      if (groundBurstRef.current) {
        const gbT = Math.min(1, ct / 10);
        const gbRadius = 5 + gbT * 150;
        groundBurstRef.current.visible = true;
        groundBurstRef.current.scale.set(gbRadius / 60, 1, gbRadius / 60);
        groundBurstRef.current.position.set(
          IMPACT_POINT.x,
          1.0,
          IMPACT_POINT.z,
        );
        const mat = groundBurstRef.current
          .material as THREE.MeshStandardMaterial;
        const gbFade = ct > 8 ? Math.max(0, 1 - (ct - 8) / 12) : 1;
        mat.opacity = 0.75 * gbFade * fadeFactor;
        const heatColor =
          ct < 3
            ? new THREE.Color(1.0, 0.5 + Math.sin(ct * 6) * 0.1, 0.0)
            : new THREE.Color(0.7 - ct * 0.02, 0.3 - ct * 0.015, 0.1);
        mat.color.copy(heatColor);
        mat.emissiveIntensity = Math.max(0, 3 - ct * 0.3);
      }

      // --- STEM / TRUNK (t=10.2 onwards): rising column of smoke + fire ---
      if (stemGroupRef.current) {
        stemGroupRef.current.visible = true;
        stemGroupRef.current.position.set(IMPACT_POINT.x, 0, IMPACT_POINT.z);
      }
      if (stemCylRef.current) {
        const stemH = Math.min(130, ct * 18);
        const stemW = Math.min(15, 5 + ct * 0.6);
        stemCylRef.current.visible = true;
        stemCylRef.current.scale.set(stemW / 4, stemH / 10, stemW / 4);
        stemCylRef.current.position.set(0, stemH / 2, 0);
        const mat = stemCylRef.current.material as THREE.MeshStandardMaterial;
        const smokeRatio = Math.min(1, ct / 6);
        mat.color.setRGB(0.5 - smokeRatio * 0.25, 0.35 - smokeRatio * 0.2, 0.1);
        mat.emissive.setRGB(0.6 - smokeRatio * 0.5, 0.15, 0);
        mat.emissiveIntensity = Math.max(0, 2.5 - ct * 0.18);
        mat.opacity = Math.min(0.92, ct * 0.4) * fadeFactor;
      }
      if (stemInnerRef.current) {
        const stemH = Math.min(120, ct * 16);
        const stemW = Math.min(8, 3 + ct * 0.3);
        stemInnerRef.current.visible = ct > 0.5;
        stemInnerRef.current.scale.set(stemW / 4, stemH / 10, stemW / 4);
        stemInnerRef.current.position.set(0, stemH / 2, 0);
        const mat = stemInnerRef.current.material as THREE.MeshStandardMaterial;
        const innerFire = Math.min(1, ct / 4);
        mat.color.setRGB(1.0 - innerFire * 0.5, 0.5 - innerFire * 0.35, 0);
        mat.emissive.setRGB(0.9 - innerFire * 0.7, 0.25, 0);
        mat.emissiveIntensity = Math.max(0, 3 - ct * 0.22);
        mat.opacity = Math.min(0.8, ct * 0.5) * fadeFactor;
      }

      // --- MUSHROOM CAP (t=12 to t=45): the iconic toroidal billowing cap ---
      const capStartT = 2.0;
      if (capGroupRef.current && ct > capStartT) {
        const capT = Math.min(1, (ct - capStartT) / 10);
        const capRadius = 15 + capT * 80;
        // Cap rises from y=70 to y=145 as it forms
        const capY = 70 + capT * 75;
        capGroupRef.current.visible = true;
        capGroupRef.current.position.set(IMPACT_POINT.x, capY, IMPACT_POINT.z);
        capGroupRef.current.scale.setScalar(capRadius / 30);
        // Slowly rotate cap for turbulence feel
        capGroupRef.current.rotation.y += 0.004;
      } else if (capGroupRef.current && ct <= capStartT) {
        capGroupRef.current.visible = false;
      }
      // Update cap ring material opacity
      if (capRingRef.current && ct > capStartT) {
        const mat = capRingRef.current.material as THREE.MeshStandardMaterial;
        const capAge = ct - capStartT;
        mat.opacity = Math.min(0.88, capAge * 0.18) * fadeFactor;
      }

      // --- ANVIL CLOUD (t=15 to t=45): flat spreading top ---
      const anvilStart = 5;
      if (anvilRef.current && ct > anvilStart) {
        const anvilT = Math.min(1, (ct - anvilStart) / 12);
        const anvilR = 30 + anvilT * 200;
        const anvilY = 135 + anvilT * 20;
        anvilRef.current.visible = true;
        anvilRef.current.scale.set(anvilR / 80, 1, anvilR / 80);
        anvilRef.current.position.set(IMPACT_POINT.x, anvilY, IMPACT_POINT.z);
        const mat = anvilRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = Math.min(0.65, (ct - anvilStart) * 0.08) * fadeFactor;
      } else if (anvilRef.current) {
        anvilRef.current.visible = false;
      }

      // --- CONDENSATION RING ---
      if (condensationRingRef.current && ct > 2) {
        const ringT = Math.min(1, (ct - 2) / 3);
        condensationRingRef.current.visible = true;
        condensationRingRef.current.scale.set(
          (30 + ringT * 100) / 50,
          1,
          (30 + ringT * 100) / 50,
        );
        condensationRingRef.current.position.set(
          IMPACT_POINT.x,
          65 + ringT * 20,
          IMPACT_POINT.z,
        );
        (
          condensationRingRef.current.material as THREE.MeshStandardMaterial
        ).opacity = Math.max(0, 0.7 - ringT * 0.55) * fadeFactor;
      }

      // Nuclear lights fade over 20s
      if (nuclearLightRef.current) {
        nuclearLightRef.current.intensity = Math.max(
          0,
          400 * Math.max(0, 1 - ct / 20),
        );
        nuclearLightRef.current.visible = true;
      }
      if (nuclearLight2Ref.current) {
        const lift = Math.min(80, ct * 16);
        nuclearLight2Ref.current.position.set(
          IMPACT_POINT.x,
          lift,
          IMPACT_POINT.z,
        );
        nuclearLight2Ref.current.intensity = Math.max(
          0,
          250 * Math.max(0, 1 - ct / 15),
        );
      }

      // Hide everything after total duration
      if (ct > totalDuration) {
        for (const r of [
          fireballCoreRef,
          fireballOuterRef,
          fireballPulse1Ref,
          fireballPulse2Ref,
          groundBurstRef,
          stemCylRef,
          stemInnerRef,
          capGroupRef,
          anvilRef,
          condensationRingRef,
          shockwaveGroundRef,
          shockwaveAtmoRef,
        ]) {
          if (r.current) r.current.visible = false;
        }
      }
    }

    // ── PHASE 5: Shockwave (t=10.5, expands to 300 in 3s) ─────────────────
    if (t >= 10.5) {
      const swT = t - 10.5;
      // Fast — reaches 300 units in ~3 seconds
      const swRadius = Math.min(300, swT * 100);
      swRadiusRef.current = swRadius;

      // Ground shockwave ring
      if (shockwaveGroundRef.current) {
        shockwaveGroundRef.current.visible = true;
        shockwaveGroundRef.current.scale.set(swRadius / 5, 1, swRadius / 5);
        shockwaveGroundRef.current.position.set(
          IMPACT_POINT.x,
          0.4,
          IMPACT_POINT.z,
        );
        const mat = shockwaveGroundRef.current
          .material as THREE.MeshStandardMaterial;
        // Bright at front, fades quickly as it passes
        const frontOpacity = Math.max(0, 0.9 - swT * 0.22);
        mat.opacity = frontOpacity;
        // Orange-white color fades to blue-white as it travels
        const blueShift = Math.min(1, swT / 3);
        mat.color.setRGB(1.0, 0.85 - blueShift * 0.35, 0.5 + blueShift * 0.5);
        mat.emissiveIntensity = Math.max(0, 2 - swT * 0.6);
      }

      // Atmospheric blast ring (slightly above, faster)
      if (shockwaveAtmoRef.current) {
        const atmoRadius = Math.min(320, swT * 115);
        shockwaveAtmoRef.current.visible = atmoRadius < 320;
        shockwaveAtmoRef.current.scale.set(
          atmoRadius / 5,
          1 + swT * 0.3,
          atmoRadius / 5,
        );
        shockwaveAtmoRef.current.position.set(
          IMPACT_POINT.x,
          8 + swT * 2,
          IMPACT_POINT.z,
        );
        const mat = shockwaveAtmoRef.current
          .material as THREE.MeshStandardMaterial;
        mat.opacity = Math.max(0, 0.6 - swT * 0.18);
      }

      // ── Burn zombies as shockwave passes over them ─────────────────────
      const curEnemies = enemiesRef.current;
      if (curEnemies.length > 0) {
        const newlyBurned: string[] = [];
        for (const enemy of curEnemies) {
          if (enemy.isDead || burnedZombieIds.current.has(enemy.id)) continue;
          const [ex, , ez] = enemy.position;
          const dx = ex - IMPACT_POINT.x;
          const dz = ez - IMPACT_POINT.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist <= swRadius) {
            burnedZombieIds.current.add(enemy.id);
            newlyBurned.push(enemy.id);
          }
        }
        if (newlyBurned.length > 0) {
          onKillRef.current?.(newlyBurned);
        }
      }

      // Destroy buildings
      WARZONE_BUILDING_DEFS.forEach((def, idx) => {
        if (destroyedSet.current.has(idx)) return;
        const dx = def.x - IMPACT_POINT.x;
        const dz = def.z - IMPACT_POINT.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= swRadius) {
          destroyedSet.current.add(idx);
          destroyedBuildingIds.current.add(idx);
          const numChunks = 14 + Math.floor(Math.random() * 10);
          for (let c = 0; c < numChunks; c++) {
            const angle = Math.random() * Math.PI * 2;
            const outward = 5 + Math.random() * 10;
            const upward = 8 + Math.random() * 16;
            debrisRef.current.push({
              id: debrisIdRef.current++,
              position: new THREE.Vector3(def.x, def.groundY, def.z),
              velocity: new THREE.Vector3(
                Math.cos(angle) * outward * 0.5,
                upward,
                Math.sin(angle) * outward * 0.5,
              ),
              rotation: new THREE.Euler(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI,
              ),
              angularV: new THREE.Vector3(
                (Math.random() - 0.5) * 7,
                (Math.random() - 0.5) * 7,
                (Math.random() - 0.5) * 7,
              ),
              scale: 0.4 + Math.random() * 1.4,
              born: t,
              lifespan: 2.5 + Math.random() * 2,
            });
          }
          setDebrisSnapshot([...debrisRef.current]);
        }
      });
    }

    // ── Complete after 45s ──────────────────────────────────────────────────
    if (t >= 46 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  });

  if (!active) return null;

  return (
    <>
      {/* ── Rocket ─────────────────────────────────────────────────────── */}
      <group ref={rocketGroupRef} visible={false}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.8, 1.2, 18, 12]} />
          <meshStandardMaterial
            color="#b0b8c0"
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>
        <mesh position={[0, 10, 0]}>
          <coneGeometry args={[0.8, 5, 12]} />
          <meshStandardMaterial
            color="#9aa0a8"
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 1.1, -7, Math.sin(angle) * 1.1]}
              rotation={[0, angle, Math.PI / 6]}
            >
              <boxGeometry args={[0.15, 4, 2.2]} />
              <meshStandardMaterial
                color="#8a9098"
                roughness={0.4}
                metalness={0.7}
              />
            </mesh>
          );
        })}
        <mesh position={[0, -9.5, 0]}>
          <coneGeometry args={[1.0, 4, 12]} />
          <meshStandardMaterial
            color="#ff8800"
            emissive="#ff4400"
            emissiveIntensity={4.0}
            transparent
            opacity={0.85}
          />
        </mesh>
        <pointLight
          position={[0, -10, 0]}
          intensity={80}
          distance={60}
          color="#ff6600"
        />
        <group>
          {Array.from({ length: 12 }, (_, i) => -12 - i * 4).map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <sphereGeometry args={[0.6 + ((-y - 12) / 4) * 0.15, 6, 4]} />
              <meshStandardMaterial
                color="#ffffff"
                transparent
                opacity={Math.max(0, 0.4 - ((-y - 12) / 4) * 0.03)}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── Fireball Core — blindingly bright white-orange sphere ────── */}
      <mesh
        ref={fireballCoreRef}
        position={[IMPACT_POINT.x, 0, IMPACT_POINT.z]}
        visible={false}
      >
        <sphereGeometry args={[1, 24, 18]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffcc44"
          emissiveIntensity={10}
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </mesh>

      {/* Fireball Outer — orange bloom ring */}
      <mesh
        ref={fireballOuterRef}
        position={[IMPACT_POINT.x, 0, IMPACT_POINT.z]}
        visible={false}
      >
        <sphereGeometry args={[1, 20, 14]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff3300"
          emissiveIntensity={6}
          transparent
          opacity={0.7}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Fireball Pulse 1 */}
      <mesh
        ref={fireballPulse1Ref}
        position={[IMPACT_POINT.x, 0, IMPACT_POINT.z]}
        visible={false}
      >
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial
          color="#ff9922"
          emissive="#ff5500"
          emissiveIntensity={5}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>

      {/* Fireball Pulse 2 */}
      <mesh
        ref={fireballPulse2Ref}
        position={[IMPACT_POINT.x, 6, IMPACT_POINT.z]}
        visible={false}
      >
        <sphereGeometry args={[1, 14, 8]} />
        <meshStandardMaterial
          color="#ffaa33"
          emissive="#ff7700"
          emissiveIntensity={4}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* ── Ground Burst / Skirt — wide flat fire ring ─────────────── */}
      <mesh
        ref={groundBurstRef}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[30, 60, 48]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff3300"
          emissiveIntensity={3}
          transparent
          opacity={0.75}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Stem group — stays at impact point base ─────────────────── */}
      <group ref={stemGroupRef} visible={false}>
        {/* Outer smoke cylinder */}
        <mesh ref={stemCylRef} visible={false}>
          <cylinderGeometry args={[3, 8, 10, 16, 4, true]} />
          <meshStandardMaterial
            color="#4a3820"
            emissive="#882200"
            emissiveIntensity={2.5}
            transparent
            opacity={0.88}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* Inner fire column */}
        <mesh ref={stemInnerRef} visible={false}>
          <cylinderGeometry args={[1.5, 4, 10, 12, 3, true]} />
          <meshStandardMaterial
            color="#ff8800"
            emissive="#ff4400"
            emissiveIntensity={3}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* Swirling torus bands up the stem — static decoration */}
        {[10, 25, 45, 65, 85].map((yOff) => (
          <mesh
            key={yOff}
            position={[0, yOff, 0]}
            rotation={[Math.PI / 2, 0, yOff * 0.1]}
          >
            <torusGeometry args={[6 - yOff * 0.015, 3, 6, 20]} />
            <meshStandardMaterial
              color="#5a4020"
              emissive="#441100"
              emissiveIntensity={1.2}
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* ── Mushroom Cap — ring of massive cloud spheres ─────────────── */}
      <group ref={capGroupRef} visible={false}>
        {/* Outer ring of large cloud puffs */}
        {Array.from({ length: 20 }, (_, i) => {
          const angle = (i / 20) * Math.PI * 2;
          const r = 30;
          const colors = [
            "#e8dcc8",
            "#c8b890",
            "#a89060",
            "#8a7050",
            "#6a5038",
          ];
          const color = colors[i % colors.length];
          return (
            <mesh
              key={`cap-outer-a${angle.toFixed(4)}`}
              position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            >
              <sphereGeometry args={[14, 10, 8]} />
              <meshStandardMaterial
                color={color}
                roughness={1}
                transparent
                opacity={0.85}
                depthWrite={false}
              />
            </mesh>
          );
        })}
        {/* Inner secondary ring — tighter, lower */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * Math.PI * 2 + 0.26;
          const r = 18;
          return (
            <mesh
              key={`cap-inner-a${angle.toFixed(4)}`}
              position={[Math.cos(angle) * r, -5, Math.sin(angle) * r]}
            >
              <sphereGeometry args={[10, 8, 6]} />
              <meshStandardMaterial
                color="#9a7850"
                roughness={1}
                transparent
                opacity={0.8}
                depthWrite={false}
              />
            </mesh>
          );
        })}
        {/* Central fill dome — orange-gray core */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[22, 14, 10]} />
          <meshStandardMaterial
            color="#7a5828"
            emissive="#aa6600"
            emissiveIntensity={1.2}
            transparent
            opacity={0.65}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Cap torus ring */}
        <mesh ref={capRingRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[28, 10, 8, 32]} />
          <meshStandardMaterial
            color="#d4b888"
            emissive="#aa7733"
            emissiveIntensity={0.6}
            transparent
            opacity={0.88}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ── Anvil Cloud — huge flat spreading disc at top ─────────────── */}
      <mesh ref={anvilRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[80, 40]} />
        <meshStandardMaterial
          color="#d8cec0"
          transparent
          opacity={0.55}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Condensation ring ────────────────────────────────────────── */}
      <mesh
        ref={condensationRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[50, 8, 6, 36]} />
        <meshStandardMaterial
          color="#d8eeff"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* ── Shockwave: ground ring ───────────────────────────────────── */}
      <mesh
        ref={shockwaveGroundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[5, 1.8, 8, 64]} />
        <meshStandardMaterial
          color="#ffcc88"
          emissive="#ff8800"
          emissiveIntensity={2}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>

      {/* Shockwave: atmospheric ring (slightly above, cylindrical) */}
      <mesh
        ref={shockwaveAtmoRef}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <torusGeometry args={[5, 1.2, 6, 64]} />
        <meshStandardMaterial
          color="#aaddff"
          emissive="#4488ff"
          emissiveIntensity={1.5}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* Dust particles in shockwave — ring of particles around blast radius */}
      {elapsed >= 10.5 &&
        (() => {
          const swT = elapsed - 10.5;
          const swRadius = Math.min(300, swT * 100);
          const dustOpacity = Math.max(0, 0.7 - swT * 0.15);
          if (dustOpacity <= 0 || swRadius <= 0) return null;
          return Array.from({ length: 24 }, (_, i) => {
            const dustAngle = (i / 24) * Math.PI * 2;
            return (
              <DustParticle
                key={`dust-${dustAngle.toFixed(4)}`}
                angle={dustAngle}
                radius={swRadius - 5 - Math.random() * 20}
                opacity={dustOpacity * (0.6 + Math.random() * 0.4)}
                y={2 + Math.random() * 8}
                scale={4 + Math.random() * 6}
              />
            );
          });
        })()}

      {/* ── Nuclear lights ──────────────────────────────────────────── */}
      <pointLight
        ref={nuclearLightRef}
        position={[IMPACT_POINT.x, 5, IMPACT_POINT.z]}
        intensity={0}
        distance={600}
        color="#ff8844"
        visible={false}
      />
      <pointLight
        ref={nuclearLight2Ref}
        position={[IMPACT_POINT.x, 40, IMPACT_POINT.z]}
        intensity={0}
        distance={400}
        color="#ffcc44"
      />

      {/* ── Debris ──────────────────────────────────────────────────── */}
      {debrisSnapshot.map((chunk) => (
        <DebrisMesh key={chunk.id} chunk={chunk} elapsed={elapsed} />
      ))}
    </>
  );
}

// ── Countdown HUD (rendered OUTSIDE Canvas by GameScene) ──────────────────────
export function NuclearCountdownHUD({ count }: { count: number }) {
  return (
    <div
      className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center"
      style={{ zIndex: 150 }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(180,0,0,0.45) 100%)",
          animation: "nuclearPulse 1s ease-in-out infinite",
        }}
      />
      <div className="relative flex flex-col items-center gap-3">
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: "1.2rem",
            letterSpacing: "0.25em",
            color: "#ff2222",
            textShadow: "0 0 20px #ff0000, 0 0 40px #ff0000",
            fontWeight: 700,
          }}
        >
          ⚠ NUCLEAR LAUNCH DETECTED ⚠
        </span>
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: count <= 3 ? "9rem" : "7rem",
            lineHeight: 1,
            color: count <= 3 ? "#ff4444" : "#cc0000",
            textShadow:
              count <= 3
                ? "0 0 30px #ff0000, 0 0 60px #ff0000, 0 0 100px #ff0000"
                : "0 0 20px #aa0000, 0 0 40px #880000",
            fontWeight: 900,
            letterSpacing: "0.05em",
            transition: "all 0.15s ease",
          }}
        >
          {count}
        </span>
        <span
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: "0.85rem",
            letterSpacing: "0.3em",
            color: "#ff666688",
            fontWeight: 400,
          }}
        >
          IMPACT IMMINENT
        </span>
      </div>
      <style>{`
        @keyframes nuclearPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1.0; }
        }
      `}</style>
    </div>
  );
}
