import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { WeaponName } from "../../types/weapon";
import { MuzzleFlash } from "./MuzzleFlash";

interface WeaponViewModelProps {
  weapon: WeaponName;
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
  /** Zeitpunkt des letzten Schusses (Date.now()) — triggert MuzzleFlash */
  lastFireTime: number;
  /** 0–1 während Reload, sonst 0 */
  reloadProgress: number;
  /** Right-mouse aim-down-sights aktiv */
  isAiming?: boolean;
  /** Ref zum Movement-State (wird im useFrame ausgelesen — kein Re-Render) */
  movementStateRef?: React.MutableRefObject<{
    isMoving: boolean;
    isSprinting: boolean;
    stepPhase: number;
  }>;
}

// Animated glow material for upgraded weapons
// biome-ignore lint/correctness/noUnusedVariables: used indirectly
function useGlowMaterial(tier: number) {
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);

  if (!matRef.current) {
    matRef.current = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0,
      emissiveIntensity: 0,
    });
  }

  if (matRef.current) {
    if (tier === 1) {
      matRef.current.color.set(0x0066ff);
      matRef.current.emissive.set(0x0044cc);
      matRef.current.opacity = 0.7;
    } else if (tier === 2) {
      matRef.current.color.set(0x8800ff);
      matRef.current.emissive.set(0x6600cc);
      matRef.current.opacity = 0.7;
    } else if (tier === 3) {
      matRef.current.color.set(0xffaa00);
      matRef.current.emissive.set(0xcc8800);
      matRef.current.opacity = 0.8;
    } else {
      matRef.current.opacity = 0;
    }
  }

  return matRef.current;
}

function GlowOverlay({
  tier,
  position,
  args,
  rotation,
}: {
  tier: number;
  position: [number, number, number];
  args: [number, number, number];
  rotation?: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current || tier === 0) return;
    const t = Date.now() * 0.001;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;

    if (tier === 1) {
      mat.emissiveIntensity = 1.5 + Math.sin(t * 2.0) * 1.0;
    } else if (tier === 2) {
      mat.emissiveIntensity = 2.0 + Math.sin(t * 3.5) * 1.5;
    } else if (tier === 3) {
      mat.emissiveIntensity =
        2.5 + Math.sin(t * 6.0) * 2.0 + Math.sin(t * 11.3) * 0.5;
    }
  });

  if (tier === 0) return null;

  const color = tier === 1 ? "#0066ff" : tier === 2 ? "#8800ff" : "#ffaa00";
  const emissive = tier === 1 ? "#0044cc" : tier === 2 ? "#6600cc" : "#cc8800";

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <boxGeometry args={[args[0] + 0.012, args[1] + 0.012, args[2] + 0.012]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={2.0}
        transparent
        opacity={tier === 3 ? 0.8 : 0.7}
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// Tier 3 sparkle particles around the weapon
function GoldSparkles({ active }: { active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current || !active) return;
    const t = Date.now() * 0.001;
    groupRef.current.children.forEach((child, i) => {
      const offset = (i / 6) * Math.PI * 2;
      child.position.x = Math.cos(t * 2 + offset) * 0.18;
      child.position.y =
        Math.sin(t * 1.5 + offset) * 0.12 + Math.sin(t * 3 + offset * 2) * 0.05;
      child.position.z = Math.sin(t * 2 + offset) * 0.12;
      const scale = 0.3 + 0.7 * Math.abs(Math.sin(t * 4 + offset));
      child.scale.setScalar(scale * 0.025);
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {Array.from({ length: 6 }, (_, i) => i).map((val) => (
        <mesh key={val}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#ffcc00"
            emissive="#ffaa00"
            emissiveIntensity={3}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PISTOL — Colt M1911 (highly detailed, realistic PBR materials)
// ─────────────────────────────────────────────────────────────────────────────
function PistolModel({
  recoilOffset,
  isReloading,
  upgradeTier,
  lastFireTime,
  reloadProgress,
  isAiming,
}: {
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
  lastFireTime: number;
  reloadProgress: number;
  isAiming: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const magazineRef = useRef<THREE.Group>(null);
  const droppedMagRef = useRef<THREE.Group>(null);
  const dropMagDataRef = useRef({ active: false, startTime: 0 });

  const {
    steelBlued,
    steelBright,
    gripMat,
    gripLightMat,
    rubberMat,
    brassMat,
  } = useMemo(() => {
    return {
      steelBlued: new THREE.MeshStandardMaterial({
        color: "#1a1c20",
        metalness: 1.0,
        roughness: 0.12,
      }),
      steelBright: new THREE.MeshStandardMaterial({
        color: "#3a3d42",
        metalness: 0.95,
        roughness: 0.2,
      }),
      gripMat: new THREE.MeshStandardMaterial({
        color: "#2a1a0e",
        metalness: 0,
        roughness: 0.95,
      }),
      gripLightMat: new THREE.MeshStandardMaterial({
        color: "#3d2510",
        metalness: 0,
        roughness: 0.9,
      }),
      rubberMat: new THREE.MeshStandardMaterial({
        color: "#111111",
        metalness: 0,
        roughness: 1.0,
      }),
      brassMat: new THREE.MeshStandardMaterial({
        color: "#b8942a",
        metalness: 0.85,
        roughness: 0.25,
      }),
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Reload-Phasen:
    //   0.0–0.20  Hochkippen
    //   0.20–0.35 Magazin rausfallen
    //   0.35–0.65 neues Magazin reinschieben
    //   0.65–0.85 Slide-Pull-Geste (über Recoil-Tilt simuliert)
    //   0.85–1.00 Wieder runter
    let tiltX = 0;
    let magOffsetY = 0;

    if (isReloading && reloadProgress > 0) {
      const p = reloadProgress;
      if (p < 0.2) {
        tiltX = (p / 0.2) * 0.35;
      } else if (p < 0.35) {
        tiltX = 0.35;
        if (!dropMagDataRef.current.active) {
          dropMagDataRef.current.active = true;
          dropMagDataRef.current.startTime = performance.now();
        }
        magOffsetY = -1; // Magazin unsichtbar
      } else if (p < 0.65) {
        tiltX = 0.32;
        const localT = (p - 0.35) / 0.3;
        magOffsetY = -0.06 * (1 - localT);
      } else if (p < 0.85) {
        tiltX = 0.25;
        const localT = (p - 0.65) / 0.2;
        // Slide-Pull-Bewegung simulieren: Waffe ruckartig hin und zurück
        if (localT < 0.5) {
          tiltX = 0.25 + (localT / 0.5) * 0.08;
        } else {
          tiltX = 0.33 - ((localT - 0.5) / 0.5) * 0.08;
        }
      } else {
        tiltX = 0.2 * (1 - (p - 0.85) / 0.15);
      }
    } else {
      dropMagDataRef.current.active = false;
    }

    // Magazin-Animation
    if (magazineRef.current) {
      if (magOffsetY <= -0.99) {
        magazineRef.current.visible = false;
      } else {
        magazineRef.current.visible = true;
        magazineRef.current.position.y +=
          (magOffsetY - magazineRef.current.position.y) *
          Math.min(delta * 25, 1);
      }
    }

    // ADS (Aim-Down-Sights): wenn aktiv, Pistole zur Mitte hoch, näher zur Kamera
    // Standard (hip): x=0.22, y=-0.25, z=-0.5
    // ADS:            x=0,    y=-0.13, z=-0.32
    //
    // Recoil ist HORIZONTAL: Waffe wird zum Schützen zurückgestoßen (Z positiver),
    // Lauf kippt nach OBEN (positive rotation.x) — echter Schuss-Rückstoß.
    const targetX = isAiming ? 0 : 0.22;
    const targetY = isAiming ? -0.13 : -0.25;
    const baseZ = isAiming ? -0.32 : -0.5;
    const targetZ = baseZ + recoilOffset * 0.12; // Waffe wandert zur Kamera
    groupRef.current.position.x +=
      (targetX - groupRef.current.position.x) * Math.min(delta * 15, 1);
    groupRef.current.position.y +=
      (targetY - groupRef.current.position.y) * Math.min(delta * 15, 1);
    groupRef.current.position.z +=
      (targetZ - groupRef.current.position.z) * Math.min(delta * 15, 1);
    groupRef.current.rotation.x +=
      (recoilOffset * 0.35 + tiltX - groupRef.current.rotation.x) *
      Math.min(delta * 12, 1);

    // Fallendes Magazin
    if (droppedMagRef.current) {
      if (dropMagDataRef.current.active) {
        const elapsed =
          (performance.now() - dropMagDataRef.current.startTime) / 1000;
        if (elapsed < 1.2) {
          droppedMagRef.current.visible = true;
          droppedMagRef.current.position.y = -0.05 - 4.5 * elapsed * elapsed;
          droppedMagRef.current.position.x = 0.08;
          droppedMagRef.current.position.z = 0.05 - elapsed * 0.3;
          droppedMagRef.current.rotation.x = elapsed * 5;
          droppedMagRef.current.rotation.z = elapsed * 3;
        } else {
          droppedMagRef.current.visible = false;
        }
      } else {
        droppedMagRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0.22, -0.25, -0.5]}>
      {/* ══ FRAME (lower receiver) ══ */}
      {/* Main frame body */}
      <mesh material={steelBlued} position={[0, 0.005, 0.01]}>
        <boxGeometry args={[0.058, 0.085, 0.21]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.005, 0.01]}
        args={[0.058, 0.085, 0.21]}
      />

      {/* Frame dust cover (under barrel, front) */}
      <mesh material={steelBlued} position={[0, -0.022, -0.08]}>
        <boxGeometry args={[0.058, 0.032, 0.09]} />
      </mesh>

      {/* Frame rails – left and right */}
      <mesh material={steelBright} position={[0.031, 0.045, 0.01]}>
        <boxGeometry args={[0.002, 0.008, 0.18]} />
      </mesh>
      <mesh material={steelBright} position={[-0.031, 0.045, 0.01]}>
        <boxGeometry args={[0.002, 0.008, 0.18]} />
      </mesh>

      {/* Trigger guard – bottom bar */}
      <mesh material={steelBlued} position={[0, -0.03, -0.04]}>
        <boxGeometry args={[0.055, 0.01, 0.09]} />
      </mesh>
      {/* Trigger guard – front vertical (squared, M1911 signature) */}
      <mesh material={steelBlued} position={[0, -0.005, -0.085]}>
        <boxGeometry args={[0.055, 0.05, 0.01]} />
      </mesh>

      {/* ══ SLIDE ══ */}
      {/* Main slide body */}
      <mesh material={steelBlued} position={[0, 0.07, -0.02]}>
        <boxGeometry args={[0.062, 0.052, 0.255]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.07, -0.02]}
        args={[0.062, 0.052, 0.255]}
      />

      {/* Slide top flat */}
      <mesh material={steelBright} position={[0, 0.098, -0.02]}>
        <boxGeometry args={[0.058, 0.008, 0.24]} />
      </mesh>

      {/* Rear slide serrations – 8 vertical grooves (M1911 signature) */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((val) => (
        <mesh
          key={`ser-${val}`}
          material={rubberMat}
          position={[0, 0.07, 0.07 + val * 0.012]}
        >
          <boxGeometry args={[0.064, 0.054, 0.004]} />
        </mesh>
      ))}

      {/* Ejection port – right side */}
      <mesh material={rubberMat} position={[0.033, 0.072, -0.01]}>
        <boxGeometry args={[0.007, 0.025, 0.065]} />
      </mesh>

      {/* Slide stop notch cutout – left */}
      <mesh material={rubberMat} position={[-0.033, 0.048, 0.01]}>
        <boxGeometry args={[0.007, 0.018, 0.022]} />
      </mesh>

      {/* ══ BARREL ══ */}
      {/* Barrel tube */}
      <mesh
        material={steelBlued}
        position={[0, 0.07, -0.155]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.013, 0.013, 0.11, 12]} />
      </mesh>

      {/* Barrel bushing – wider ring at muzzle (M1911 signature) */}
      <mesh
        material={steelBright}
        position={[0, 0.07, -0.225]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.018, 0.018, 0.024, 12]} />
      </mesh>

      {/* Muzzle crown */}
      <mesh
        material={steelBright}
        position={[0, 0.07, -0.24]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.016, 0.013, 0.008, 12]} />
      </mesh>

      {/* Recoil spring plug (round plug below barrel at muzzle) */}
      <mesh
        material={steelBright}
        position={[0, 0.044, -0.23]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.013, 0.013, 0.02, 10]} />
      </mesh>

      {/* ══ SIGHTS ══ */}
      {/* Front sight – tall narrow post (GI style) */}
      <mesh material={steelBright} position={[0, 0.103, -0.19]}>
        <boxGeometry args={[0.006, 0.016, 0.007]} />
      </mesh>

      {/* Rear sight – two-post U-notch */}
      <mesh material={steelBright} position={[0.014, 0.103, 0.085]}>
        <boxGeometry args={[0.007, 0.014, 0.01]} />
      </mesh>
      <mesh material={steelBright} position={[-0.014, 0.103, 0.085]}>
        <boxGeometry args={[0.007, 0.014, 0.01]} />
      </mesh>

      {/* ══ EXTERNAL HAMMER (M1911 signature) ══ */}
      {/* Hammer body */}
      <mesh material={steelBlued} position={[0, 0.098, 0.1]}>
        <boxGeometry args={[0.018, 0.028, 0.016]} />
      </mesh>
      {/* Hammer spur */}
      <mesh
        material={steelBlued}
        position={[0, 0.108, 0.112]}
        rotation={[-0.4, 0, 0]}
      >
        <boxGeometry args={[0.016, 0.012, 0.022]} />
      </mesh>
      {/* Half-cock notch visual */}
      <mesh material={rubberMat} position={[0, 0.085, 0.098]}>
        <boxGeometry args={[0.01, 0.006, 0.004]} />
      </mesh>

      {/* ══ GRIP SAFETY (M1911 signature) ══ */}
      {/* Grip safety body */}
      <mesh material={steelBlued} position={[0, 0.018, 0.105]}>
        <boxGeometry args={[0.062, 0.045, 0.016]} />
      </mesh>
      {/* Beavertail extension */}
      <mesh material={steelBlued} position={[0, 0.038, 0.108]}>
        <boxGeometry args={[0.058, 0.022, 0.014]} />
      </mesh>

      {/* ══ THUMB SAFETY – left side ══ */}
      {/* Safety lever */}
      <mesh material={steelBlued} position={[-0.042, 0.042, 0.065]}>
        <boxGeometry args={[0.022, 0.012, 0.028]} />
      </mesh>
      {/* Safety pivot */}
      <mesh
        material={steelBright}
        position={[-0.042, 0.042, 0.052]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <cylinderGeometry args={[0.005, 0.005, 0.015, 8]} />
      </mesh>

      {/* ══ SLIDE STOP LEVER – left side ══ */}
      <mesh material={steelBlued} position={[-0.042, 0.028, 0.01]}>
        <boxGeometry args={[0.022, 0.008, 0.048]} />
      </mesh>

      {/* ══ GRIP PANELS (checkered walnut) ══ */}
      {/* Left panel */}
      <mesh material={gripMat} position={[-0.036, -0.055, 0.065]}>
        <boxGeometry args={[0.007, 0.115, 0.1]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[-0.036, -0.055, 0.065]}
        args={[0.007, 0.115, 0.1]}
      />
      {/* Right panel */}
      <mesh material={gripMat} position={[0.036, -0.055, 0.065]}>
        <boxGeometry args={[0.007, 0.115, 0.1]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0.036, -0.055, 0.065]}
        args={[0.007, 0.115, 0.1]}
      />

      {/* Wood grain lines – left panel (3 vertical lines) */}
      {[0, 1, 2].map((val) => (
        <mesh
          key={`wg-l-${val}`}
          material={gripLightMat}
          position={[-0.036, -0.055, 0.02 + val * 0.035]}
        >
          <boxGeometry args={[0.008, 0.113, 0.003]} />
        </mesh>
      ))}
      {/* Wood grain lines – right panel */}
      {[0, 1, 2].map((val) => (
        <mesh
          key={`wg-r-${val}`}
          material={gripLightMat}
          position={[0.036, -0.055, 0.02 + val * 0.035]}
        >
          <boxGeometry args={[0.008, 0.113, 0.003]} />
        </mesh>
      ))}

      {/* Diamond checkering simulation – left (6 horizontal ridges) */}
      {[0, 1, 2, 3, 4, 5].map((val) => (
        <mesh
          key={`chk-l-${val}`}
          material={gripMat}
          position={[-0.036, -0.02 + val * 0.02, 0.065]}
        >
          <boxGeometry args={[0.008, 0.006, 0.098]} />
        </mesh>
      ))}
      {/* Diamond checkering simulation – right */}
      {[0, 1, 2, 3, 4, 5].map((val) => (
        <mesh
          key={`chk-r-${val}`}
          material={gripMat}
          position={[0.036, -0.02 + val * 0.02, 0.065]}
        >
          <boxGeometry args={[0.008, 0.006, 0.098]} />
        </mesh>
      ))}

      {/* ══ MAINSPRING HOUSING (flat, bottom rear of grip) ══ */}
      <mesh material={steelBlued} position={[0, -0.085, 0.112]}>
        <boxGeometry args={[0.056, 0.035, 0.012]} />
      </mesh>
      {/* Lanyard loop */}
      <mesh material={steelBright} position={[0, -0.098, 0.112]}>
        <boxGeometry args={[0.024, 0.008, 0.016]} />
      </mesh>

      {/* ══ MAGAZINE ══ */}
      {/* Mag body */}
      <mesh material={steelBlued} position={[0, -0.1, 0.065]}>
        <boxGeometry args={[0.05, 0.1, 0.088]} />
      </mesh>
      {/* Mag base plate */}
      <mesh material={steelBright} position={[0, -0.152, 0.065]}>
        <boxGeometry args={[0.053, 0.012, 0.09]} />
      </mesh>
      {/* Witness holes – right side (3) */}
      {[0, 1, 2].map((val) => (
        <mesh
          key={`wh-${val}`}
          material={rubberMat}
          position={[0.027, -0.075 + val * 0.025, 0.065]}
        >
          <boxGeometry args={[0.007, 0.006, 0.086]} />
        </mesh>
      ))}

      {/* ══ TRIGGER (longer than Glock, M1911 style) ══ */}
      {/* Trigger bow */}
      <mesh
        material={steelBright}
        position={[0, -0.008, -0.01]}
        rotation={[0.25, 0, 0]}
      >
        <boxGeometry args={[0.01, 0.048, 0.009]} />
      </mesh>
      {/* Trigger shoe */}
      <mesh material={steelBright} position={[0, -0.028, -0.018]}>
        <boxGeometry args={[0.012, 0.014, 0.014]} />
      </mesh>

      {/* ══ PICATINNY RAIL (under dust cover) ══ */}
      <mesh material={steelBlued} position={[0, -0.038, -0.07]}>
        <boxGeometry args={[0.062, 0.008, 0.075]} />
      </mesh>
      {/* 2 cross slots */}
      {[0, 1].map((val) => (
        <mesh
          key={`rail-${val}`}
          material={rubberMat}
          position={[0, -0.038, -0.045 + val * 0.03]}
        >
          <boxGeometry args={[0.064, 0.009, 0.005]} />
        </mesh>
      ))}

      {/* ══ BRASS accent — front sight dot ══ */}
      <mesh material={brassMat} position={[0, 0.105, -0.19]}>
        <sphereGeometry args={[0.003, 6, 6]} />
      </mesh>

      {/* ══ MAGAZIN (animiert während Reload) ══ */}
      <group ref={magazineRef} position={[0, 0, 0]}>
        {/* Magazin-Körper unten am Griff */}
        <mesh material={steelBlued} position={[0, -0.13, 0.04]}>
          <boxGeometry args={[0.046, 0.06, 0.082]} />
        </mesh>
        {/* Magazin-Bodenplatte */}
        <mesh material={steelBright} position={[0, -0.165, 0.04]}>
          <boxGeometry args={[0.05, 0.008, 0.086]} />
        </mesh>
        {/* Sichtbarer Patrone in Mag-Top (Brass) */}
        <mesh material={brassMat} position={[0, -0.099, 0.06]}>
          <cylinderGeometry args={[0.0055, 0.0055, 0.012, 8]} />
        </mesh>
      </group>

      {/* ══ FALLENDES Magazin (separates Item nach Drop) ══ */}
      <group ref={droppedMagRef} visible={false}>
        <mesh material={steelBlued}>
          <boxGeometry args={[0.046, 0.07, 0.082]} />
        </mesh>
        <mesh material={steelBright} position={[0, -0.038, 0]}>
          <boxGeometry args={[0.05, 0.008, 0.086]} />
        </mesh>
      </group>

      {/* ══ MÜNDUNGSFEUER am Lauf-Ende ══ */}
      <MuzzleFlash
        fireTimestamp={lastFireTime}
        position={[0, 0.07, -0.265]}
        scale={0.85}
        compact
      />

      <GoldSparkles active={upgradeTier === 3} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOTGUN — Mossberg 590 pump-action (highly detailed, realistic)
// ─────────────────────────────────────────────────────────────────────────────
function ShotgunModel({
  recoilOffset,
  isReloading,
  upgradeTier,
  lastFireTime,
  reloadProgress,
  isAiming,
}: {
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
  lastFireTime: number;
  reloadProgress: number;
  isAiming: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Group>(null);
  const ejectedShellRef = useRef<THREE.Group>(null);
  const ejectShellDataRef = useRef({ active: false, startTime: 0 });

  const {
    metalMat,
    metalLightMat,
    metalBlued,
    woodMat,
    woodDarkMat,
    rubberMat,
    brassMat,
    beadMat,
    redDotMat,
    shellHullMat,
  } = useMemo(() => {
    return {
      metalMat: new THREE.MeshStandardMaterial({
        color: "#1e1e1e",
        metalness: 0.95,
        roughness: 0.2,
      }),
      metalLightMat: new THREE.MeshStandardMaterial({
        color: "#3a3a3a",
        metalness: 0.9,
        roughness: 0.25,
      }),
      metalBlued: new THREE.MeshStandardMaterial({
        color: "#151820",
        metalness: 1.0,
        roughness: 0.15,
      }),
      woodMat: new THREE.MeshStandardMaterial({
        color: "#5c3210",
        metalness: 0,
        roughness: 0.85,
      }),
      woodDarkMat: new THREE.MeshStandardMaterial({
        color: "#3d1f08",
        metalness: 0,
        roughness: 0.9,
      }),
      rubberMat: new THREE.MeshStandardMaterial({
        color: "#111111",
        metalness: 0,
        roughness: 0.95,
      }),
      brassMat: new THREE.MeshStandardMaterial({
        color: "#c8a035",
        metalness: 0.9,
        roughness: 0.2,
      }),
      beadMat: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        emissive: "#aaaaaa",
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2,
      }),
      redDotMat: new THREE.MeshStandardMaterial({
        color: "#cc0000",
        emissive: "#880000",
        emissiveIntensity: 1,
      }),
      shellHullMat: new THREE.MeshStandardMaterial({
        color: "#a01818",
        roughness: 0.6,
        metalness: 0.05,
      }),
    };
  }, []);

  const pumpRecoilRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Shotgun-Reload-Phasen:
    //  0.0–0.15 Hochkippen
    //  0.15–0.45 Patrone unten reinschieben (sichtbarer Shell)
    //  0.45–0.65 Pump-Action: Pump nach hinten
    //  0.65–0.85 Pump nach vorne (lädt durch)
    //  0.85–1.00 Wieder runter
    let tiltX = 0;
    let pumpZ = 0;
    let shellY = -1; // -1 = unsichtbar

    if (isReloading && reloadProgress > 0) {
      const p = reloadProgress;
      if (p < 0.15) {
        tiltX = (p / 0.15) * 0.2;
      } else if (p < 0.45) {
        tiltX = 0.2;
        const localT = (p - 0.15) / 0.3;
        // Shell taucht von unten auf, fährt nach oben in den Loader
        shellY = -0.08 + localT * 0.06;
      } else if (p < 0.65) {
        tiltX = 0.18;
        const localT = (p - 0.45) / 0.2;
        pumpZ = 0.06 * localT; // Pump nach hinten (positiv Z = zum Spieler)
        // Trigger ejected shell wenn nicht aktiv
        if (!ejectShellDataRef.current.active && localT > 0.5) {
          ejectShellDataRef.current.active = true;
          ejectShellDataRef.current.startTime = performance.now();
        }
      } else if (p < 0.85) {
        tiltX = 0.18;
        const localT = (p - 0.65) / 0.2;
        pumpZ = 0.06 * (1 - localT); // Pump zurück nach vorne
      } else {
        tiltX = 0.15 * (1 - (p - 0.85) / 0.15);
      }
    } else {
      ejectShellDataRef.current.active = false;
    }

    // Pump-Recoil nach jedem Schuss (auto-pump nicht echt, aber visuell)
    const sinceShot = (Date.now() - lastFireTime) / 1000;
    if (sinceShot < 0.18 && lastFireTime > 0) {
      const t = sinceShot / 0.18;
      // Pump zuckt schnell zurück und vor
      pumpRecoilRef.current = Math.sin(t * Math.PI) * 0.04;
    } else {
      pumpRecoilRef.current *= 0.6;
    }

    if (groupRef.current) {
      // Pump-Bewegung als ganze-Waffe-Z-Drift simulieren
      // (statt einzelne Pump-Geometrie zu animieren)
      // ADS: Shotgun zur Mitte hoch, näher zur Kamera
      // Standard (hip): x=0.3, y=-0.3, z=-0.65
      // ADS:            x=0.04, y=-0.18, z=-0.42
      //
      // Recoil ist HORIZONTAL: Waffe wird zum Schützen zurückgestoßen.
      // pumpZ + pumpRecoilRef bringt die Pump-Z-Bewegung, plus recoilOffset
      // dazu für den horizontalen Schuss-Rückstoß zum Schützen hin.
      const baseZ = isAiming ? -0.42 : -0.65;
      const pumpTotalZ = pumpZ + pumpRecoilRef.current;
      // Shotgun: starker horizontaler Rückstoß (× 0.25)
      const targetZ = baseZ + pumpTotalZ * 0.6 + recoilOffset * 0.25;
      groupRef.current.position.z +=
        (targetZ - groupRef.current.position.z) * Math.min(delta * 25, 1);
    }

    if (shellRef.current) {
      if (shellY <= -0.99) {
        shellRef.current.visible = false;
      } else {
        shellRef.current.visible = true;
        shellRef.current.position.y +=
          (shellY - shellRef.current.position.y) * Math.min(delta * 25, 1);
      }
    }

    const targetX = isAiming ? 0.04 : 0.3;
    const targetY = isAiming ? -0.18 : -0.3;
    groupRef.current.position.x +=
      (targetX - groupRef.current.position.x) * Math.min(delta * 12, 1);
    groupRef.current.position.y +=
      (targetY - groupRef.current.position.y) * Math.min(delta * 12, 1);
    // Lauf kippt nach OBEN beim Rückstoß (positive rotation.x)
    groupRef.current.rotation.x +=
      (recoilOffset * 0.6 + tiltX - groupRef.current.rotation.x) *
      Math.min(delta * 12, 1);

    // Ausgeworfene Hülse
    if (ejectedShellRef.current) {
      if (ejectShellDataRef.current.active) {
        const elapsed =
          (performance.now() - ejectShellDataRef.current.startTime) / 1000;
        if (elapsed < 1.0) {
          ejectedShellRef.current.visible = true;
          // fliegt nach rechts oben raus, fällt
          ejectedShellRef.current.position.x = 0.05 + elapsed * 0.6;
          ejectedShellRef.current.position.y =
            0.04 + elapsed * 0.6 - 5 * elapsed * elapsed;
          ejectedShellRef.current.position.z = -0.05;
          ejectedShellRef.current.rotation.x = elapsed * 12;
          ejectedShellRef.current.rotation.z = elapsed * 8;
        } else {
          ejectedShellRef.current.visible = false;
        }
      } else {
        ejectedShellRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0.3, -0.3, -0.65]}>
      {/* ══ STOCK (rear, z positive) ══ */}
      {/* Main stock body */}
      <mesh material={woodMat} position={[0, 0, 0.32]}>
        <boxGeometry args={[0.07, 0.1, 0.3]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0, 0.32]}
        args={[0.07, 0.1, 0.3]}
      />

      {/* Stock cheekpiece */}
      <mesh material={woodMat} position={[0, 0.06, 0.25]}>
        <boxGeometry args={[0.068, 0.02, 0.18]} />
      </mesh>

      {/* Stock taper */}
      <mesh material={woodMat} position={[0, -0.005, 0.46]}>
        <boxGeometry args={[0.065, 0.085, 0.06]} />
      </mesh>

      {/* Butt pad rubber */}
      <mesh material={rubberMat} position={[0, -0.005, 0.5]}>
        <boxGeometry args={[0.072, 0.105, 0.018]} />
      </mesh>

      {/* Wood grain lines on stock */}
      <mesh material={woodDarkMat} position={[0.025, 0, 0.32]}>
        <boxGeometry args={[0.003, 0.102, 0.29]} />
      </mesh>
      <mesh material={woodDarkMat} position={[-0.025, 0, 0.32]}>
        <boxGeometry args={[0.003, 0.102, 0.29]} />
      </mesh>

      {/* ══ PISTOL GRIP AREA ══ */}
      <mesh material={woodMat} position={[0, -0.028, 0.14]}>
        <boxGeometry args={[0.068, 0.075, 0.06]} />
      </mesh>

      {/* ══ RECEIVER ══ */}
      {/* Main receiver */}
      <mesh material={metalMat} position={[0, 0.005, 0.0]}>
        <boxGeometry args={[0.082, 0.108, 0.24]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.005, 0.0]}
        args={[0.082, 0.108, 0.24]}
      />

      {/* Receiver top flat */}
      <mesh material={metalLightMat} position={[0, 0.06, 0.0]}>
        <boxGeometry args={[0.078, 0.012, 0.22]} />
      </mesh>

      {/* Ejection port right side */}
      <mesh material={rubberMat} position={[0.044, 0.01, 0.01]}>
        <boxGeometry args={[0.006, 0.05, 0.09]} />
      </mesh>

      {/* Loading port bottom */}
      <mesh material={rubberMat} position={[0, -0.048, 0.02]}>
        <boxGeometry args={[0.045, 0.008, 0.065]} />
      </mesh>

      {/* Safety tang top rear */}
      <mesh material={metalLightMat} position={[0, 0.072, 0.105]}>
        <boxGeometry args={[0.025, 0.018, 0.03]} />
      </mesh>
      {/* Red dot safety indicator */}
      <mesh material={redDotMat} position={[0, 0.082, 0.105]}>
        <sphereGeometry args={[0.005, 6, 6]} />
      </mesh>

      {/* Action bar left */}
      <mesh material={metalLightMat} position={[-0.045, -0.025, 0.0]}>
        <boxGeometry args={[0.006, 0.012, 0.16]} />
      </mesh>
      {/* Action bar right */}
      <mesh material={metalLightMat} position={[0.045, -0.025, 0.0]}>
        <boxGeometry args={[0.006, 0.012, 0.16]} />
      </mesh>

      {/* ══ TRIGGER GUARD ══ */}
      {/* Bottom bar */}
      <mesh material={metalMat} position={[0, -0.05, 0.04]}>
        <boxGeometry args={[0.065, 0.012, 0.1]} />
      </mesh>
      {/* Front vertical */}
      <mesh material={metalMat} position={[0, -0.02, -0.01]}>
        <boxGeometry args={[0.065, 0.06, 0.012]} />
      </mesh>
      {/* Trigger */}
      <mesh
        material={metalLightMat}
        position={[0, -0.02, 0.06]}
        rotation={[0.3, 0, 0]}
      >
        <boxGeometry args={[0.012, 0.045, 0.009]} />
      </mesh>

      {/* ══ MAGAZINE TUBE ══ */}
      {/* Main tube */}
      <mesh
        material={metalBlued}
        position={[0, -0.03, -0.2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.022, 0.022, 0.46, 12]} />
      </mesh>
      {/* End cap */}
      <mesh
        material={metalLightMat}
        position={[0, -0.03, -0.44]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.026, 0.026, 0.02, 12]} />
      </mesh>
      {/* Tube clamp ring */}
      <mesh
        material={metalMat}
        position={[0, -0.018, -0.42]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.028, 0.028, 0.016, 12]} />
      </mesh>

      {/* ══ PUMP FOREND ══ */}
      {/* Main forend */}
      <mesh material={woodMat} position={[0, -0.02, -0.17]}>
        <boxGeometry args={[0.078, 0.065, 0.145]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, -0.02, -0.17]}
        args={[0.078, 0.065, 0.145]}
      />

      {/* 5 finger grooves */}
      {[0, 1, 2, 3, 4].map((val) => (
        <mesh
          key={`fg-${val}`}
          material={woodDarkMat}
          position={[0, -0.02, -0.105 + val * 0.028]}
        >
          <boxGeometry args={[0.08, 0.067, 0.008]} />
        </mesh>
      ))}

      {/* Forend rubber strip bottom */}
      <mesh material={rubberMat} position={[0, -0.055, -0.17]}>
        <boxGeometry args={[0.076, 0.008, 0.14]} />
      </mesh>

      {/* ══ BARREL ══ */}
      {/* Main barrel */}
      <mesh
        material={metalBlued}
        position={[0, 0.028, -0.26]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.028, 0.028, 0.48, 14]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.028, -0.26]}
        args={[0.056, 0.056, 0.48]}
      />

      {/* Barrel ring at receiver */}
      <mesh
        material={metalMat}
        position={[0, 0.028, -0.08]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.034, 0.034, 0.024, 14]} />
      </mesh>

      {/* ══ HEAT SHIELD ══ */}
      {/* Heat shield base */}
      <mesh material={metalMat} position={[0, 0.065, -0.22]}>
        <boxGeometry args={[0.065, 0.014, 0.32]} />
      </mesh>
      {/* 7 heat slots */}
      {[0, 1, 2, 3, 4, 5, 6].map((val) => (
        <mesh
          key={`hs-${val}`}
          material={rubberMat}
          position={[0, 0.065, -0.07 - val * 0.05]}
        >
          <boxGeometry args={[0.058, 0.016, 0.022]} />
        </mesh>
      ))}

      {/* ══ VENTILATED RIB ══ */}
      {/* Rib rail */}
      <mesh material={metalLightMat} position={[0, 0.073, -0.22]}>
        <boxGeometry args={[0.008, 0.007, 0.38]} />
      </mesh>
      {/* 8 rib posts */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((val) => (
        <mesh
          key={`rp-${val}`}
          material={metalLightMat}
          position={[0, 0.076, -0.06 - val * 0.05]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.004, 0.004, 0.018, 6]} />
        </mesh>
      ))}

      {/* ══ MUZZLE ══ */}
      {/* Muzzle choke */}
      <mesh
        material={metalLightMat}
        position={[0, 0.028, -0.51]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.032, 0.028, 0.028, 14]} />
      </mesh>
      {/* Muzzle crown */}
      <mesh
        material={metalMat}
        position={[0, 0.028, -0.526]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.03, 0.03, 0.01, 14]} />
      </mesh>
      {/* Front bead sight */}
      <mesh material={beadMat} position={[0, 0.065, -0.5]}>
        <sphereGeometry args={[0.009, 8, 8]} />
      </mesh>

      {/* ══ SIDE SADDLE SHELL HOLDER ══ */}
      {/* Saddle base */}
      <mesh material={rubberMat} position={[-0.046, 0.005, 0.01]}>
        <boxGeometry args={[0.008, 0.075, 0.16]} />
      </mesh>
      {/* 6 shell tubes */}
      {[0, 1, 2, 3, 4, 5].map((val) => (
        <mesh
          key={`sh-${val}`}
          material={brassMat}
          position={[-0.055, -0.025 + val * 0.015, 0.01 + (val % 2) * 0.01]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.009, 0.009, 0.065, 8]} />
        </mesh>
      ))}

      {/* ══ SLING SWIVEL ══ */}
      <mesh
        material={metalLightMat}
        position={[0, -0.055, -0.39]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.006, 0.006, 0.025, 8]} />
      </mesh>

      {/* ══ EINZUSCHIEBENDE Patrone (sichtbar während Reload-Phase 2) ══ */}
      <group ref={shellRef} visible={false}>
        {/* Rote Hülse */}
        <mesh
          material={shellHullMat}
          position={[0, 0, -0.05]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.011, 0.011, 0.06, 10]} />
        </mesh>
        {/* Brass-Boden */}
        <mesh
          material={brassMat}
          position={[0, 0, -0.085]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.012, 0.012, 0.012, 10]} />
        </mesh>
      </group>

      {/* ══ AUSGEWORFENE Hülse ══ */}
      <group ref={ejectedShellRef} visible={false}>
        <mesh material={shellHullMat} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.06, 10]} />
        </mesh>
        <mesh
          material={brassMat}
          position={[0, 0, -0.035]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.012, 0.012, 0.012, 10]} />
        </mesh>
      </group>

      {/* ══ MÜNDUNGSFEUER am Lauf-Ende ══ */}
      <MuzzleFlash
        fireTimestamp={lastFireTime}
        position={[0, 0.028, -0.51]}
        scale={1.6}
      />

      <GoldSparkles active={upgradeTier === 3} />
    </group>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// ASSAULT RIFLE — M4A1/HK416 style (realistic PBR materials, no cell shading)
// ─────────────────────────────────────────────────────────────────────────────
function AssaultRifleModel({
  recoilOffset,
  isReloading,
  upgradeTier,
  lastFireTime,
  reloadProgress,
  isAiming,
}: {
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
  lastFireTime: number;
  reloadProgress: number;
  isAiming: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const magazineRef = useRef<THREE.Group>(null);
  const droppedMagRef = useRef<THREE.Group>(null);
  const dropMagDataRef = useRef({ active: false, startTime: 0 });
  // Auto-Eject pro Schuss
  const autoEjectRef = useRef<THREE.Group>(null);
  const autoEjectDataRef = useRef({ lastShotProcessed: 0, startTime: 0 });

  const {
    steelMat,
    steelLtMat,
    woodMat,
    woodDarkMat,
    detailMat,
    chromeMat,
    brassShellMat,
  } = useMemo(() => {
    return {
      steelMat: new THREE.MeshStandardMaterial({
        color: "#2e2e2e",
        metalness: 0.95,
        roughness: 0.15,
      }),
      steelLtMat: new THREE.MeshStandardMaterial({
        color: "#484848",
        metalness: 0.9,
        roughness: 0.2,
      }),
      woodMat: new THREE.MeshStandardMaterial({
        color: "#5c3317",
        metalness: 0,
        roughness: 0.85,
      }),
      woodDarkMat: new THREE.MeshStandardMaterial({
        color: "#3d2010",
        metalness: 0,
        roughness: 0.9,
      }),
      detailMat: new THREE.MeshStandardMaterial({
        color: "#1a1a1a",
        metalness: 0.8,
        roughness: 0.3,
      }),
      chromeMat: new THREE.MeshStandardMaterial({
        color: "#707070",
        metalness: 1.0,
        roughness: 0.1,
      }),
      brassShellMat: new THREE.MeshStandardMaterial({
        color: "#c8a035",
        metalness: 0.9,
        roughness: 0.2,
      }),
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Reload-Phasen für AR (Magazin-Wechsel mit Knopfdruck):
    //  0.0–0.15  Hochkippen
    //  0.15–0.30 Magazin rausziehen (nach unten + leicht vorne)
    //  0.30–0.55 neues Magazin rein (von unten)
    //  0.55–0.75 Bolt-Release (kurzer Tilt)
    //  0.75–1.00 Wieder runter
    let tiltX = 0;
    let magOffsetY = 0;
    let magOffsetZ = 0;
    let magVisible = true;

    if (isReloading && reloadProgress > 0) {
      const p = reloadProgress;
      if (p < 0.15) {
        tiltX = (p / 0.15) * 0.25;
      } else if (p < 0.3) {
        tiltX = 0.25;
        const localT = (p - 0.15) / 0.15;
        magOffsetY = -0.06 * localT;
        magOffsetZ = 0.02 * localT;
        if (!dropMagDataRef.current.active) {
          dropMagDataRef.current.active = true;
          dropMagDataRef.current.startTime = performance.now();
        }
      } else if (p < 0.55) {
        tiltX = 0.22;
        magVisible = false; // alte Mag schon weg
      } else if (p < 0.75) {
        tiltX = 0.18;
        const localT = (p - 0.55) / 0.2;
        // Neue Mag von unten
        magOffsetY = -0.08 * (1 - localT);
        // Bolt-Release-Snap am Ende
        if (localT > 0.7) {
          tiltX = 0.18 + Math.sin((localT - 0.7) * 10) * 0.04;
        }
      } else {
        tiltX = 0.15 * (1 - (p - 0.75) / 0.25);
      }
    } else {
      dropMagDataRef.current.active = false;
    }

    if (magazineRef.current) {
      if (!magVisible) {
        magazineRef.current.visible = false;
      } else {
        magazineRef.current.visible = true;
        magazineRef.current.position.y +=
          (magOffsetY - magazineRef.current.position.y) *
          Math.min(delta * 25, 1);
        magazineRef.current.position.z +=
          (magOffsetZ - magazineRef.current.position.z) *
          Math.min(delta * 25, 1);
      }
    }

    // ADS (Aim-Down-Sights): AR zur Mitte hoch, näher zur Kamera
    // Standard (hip): x=0.26, y=-0.26, z=-0.55
    // ADS:            x=0.02, y=-0.14, z=-0.36
    //
    // Recoil ist HORIZONTAL: AR wird zum Schützen zurückgestoßen,
    // Lauf kippt nach OBEN. Sturmgewehr hat mittleren Rückstoß.
    const targetX = isAiming ? 0.02 : 0.26;
    const targetY = isAiming ? -0.14 : -0.26;
    const baseZ = isAiming ? -0.36 : -0.55;
    const targetZ = baseZ + recoilOffset * 0.15;
    groupRef.current.position.x +=
      (targetX - groupRef.current.position.x) * Math.min(delta * 18, 1);
    groupRef.current.position.y +=
      (targetY - groupRef.current.position.y) * Math.min(delta * 18, 1);
    groupRef.current.position.z +=
      (targetZ - groupRef.current.position.z) * Math.min(delta * 18, 1);
    groupRef.current.rotation.x +=
      (recoilOffset * 0.22 + tiltX - groupRef.current.rotation.x) *
      Math.min(delta * 18, 1);

    // Fallendes Magazin
    if (droppedMagRef.current) {
      if (dropMagDataRef.current.active) {
        const elapsed =
          (performance.now() - dropMagDataRef.current.startTime) / 1000;
        if (elapsed < 1.4) {
          droppedMagRef.current.visible = true;
          droppedMagRef.current.position.y = -0.07 - 4.5 * elapsed * elapsed;
          droppedMagRef.current.position.x = 0.05 + elapsed * 0.1;
          droppedMagRef.current.position.z = 0.02 - elapsed * 0.4;
          droppedMagRef.current.rotation.x = elapsed * 4;
          droppedMagRef.current.rotation.z = elapsed * 2;
        } else {
          droppedMagRef.current.visible = false;
        }
      } else {
        droppedMagRef.current.visible = false;
      }
    }

    // Auto-Hülsen-Auswurf bei jedem Schuss.
    // Beim ersten Render: lastFireTime nur "registrieren", keinen Trigger auslösen
    // (verhindert falsches Eject beim Waffenwechsel).
    if (autoEjectDataRef.current.lastShotProcessed === 0) {
      autoEjectDataRef.current.lastShotProcessed = lastFireTime;
    } else if (
      lastFireTime > 0 &&
      lastFireTime !== autoEjectDataRef.current.lastShotProcessed
    ) {
      autoEjectDataRef.current.lastShotProcessed = lastFireTime;
      autoEjectDataRef.current.startTime = performance.now();
    }
    if (autoEjectRef.current) {
      const elapsed =
        (performance.now() - autoEjectDataRef.current.startTime) / 1000;
      if (elapsed < 0.5 && autoEjectDataRef.current.startTime > 0) {
        autoEjectRef.current.visible = true;
        autoEjectRef.current.position.x = 0.04 + elapsed * 0.5;
        autoEjectRef.current.position.y =
          0.04 + elapsed * 0.4 - 4 * elapsed * elapsed;
        autoEjectRef.current.position.z = -0.05;
        autoEjectRef.current.rotation.x = elapsed * 14;
        autoEjectRef.current.rotation.z = elapsed * 10;
      } else {
        autoEjectRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0.26, -0.26, -0.55]}>
      {/* ── RECEIVER (upper + lower) ── */}
      {/* Upper receiver – main rectangular body */}
      <mesh material={steelMat} position={[0, 0.02, -0.02]}>
        <boxGeometry args={[0.068, 0.075, 0.38]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.02, -0.02]}
        args={[0.068, 0.075, 0.38]}
      />

      {/* Dust cover – hinged panel on top of receiver */}
      <mesh material={steelLtMat} position={[0, 0.062, -0.02]}>
        <boxGeometry args={[0.065, 0.01, 0.28]} />
      </mesh>

      {/* Ejection port – right side */}
      <mesh material={detailMat} position={[0.036, 0.015, -0.04]}>
        <boxGeometry args={[0.006, 0.035, 0.08]} />
      </mesh>

      {/* Charging handle – right side protrusion */}
      <mesh material={steelLtMat} position={[0.042, 0.025, 0.1]}>
        <boxGeometry args={[0.022, 0.018, 0.028]} />
      </mesh>

      {/* Rear sight block */}
      <mesh material={steelLtMat} position={[0, 0.072, 0.12]}>
        <boxGeometry args={[0.03, 0.022, 0.035]} />
      </mesh>

      {/* Front sight post */}
      <mesh material={steelMat} position={[0, 0.075, -0.2]}>
        <boxGeometry args={[0.022, 0.04, 0.022]} />
      </mesh>
      <mesh material={chromeMat} position={[0, 0.092, -0.2]}>
        <boxGeometry args={[0.006, 0.01, 0.006]} />
      </mesh>

      {/* ── HANDGUARD ── */}
      {/* Upper handguard – wood */}
      <mesh material={woodMat} position={[0, 0.04, -0.19]}>
        <boxGeometry args={[0.065, 0.038, 0.18]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.04, -0.19]}
        args={[0.065, 0.038, 0.18]}
      />

      {/* Lower handguard – wood */}
      <mesh material={woodMat} position={[0, -0.01, -0.19]}>
        <boxGeometry args={[0.065, 0.032, 0.18]} />
      </mesh>

      {/* Wood grain on handguard */}
      {[-0.02, 0, 0.02].map((xOff) => (
        <mesh
          key={`hg-grain-${xOff}`}
          material={woodDarkMat}
          position={[xOff, 0.04, -0.19]}
        >
          <boxGeometry args={[0.005, 0.04, 0.17]} />
        </mesh>
      ))}

      {/* Handguard retaining ring (front) */}
      <mesh material={steelMat} position={[0, 0.02, -0.285]}>
        <boxGeometry args={[0.072, 0.075, 0.018]} />
      </mesh>

      {/* ── GAS TUBE (above barrel) ── */}
      <mesh
        material={steelMat}
        position={[0, 0.065, -0.19]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.008, 0.008, 0.18, 8]} />
      </mesh>

      {/* ── BARREL ── */}
      {/* Main barrel */}
      <mesh
        material={steelMat}
        position={[0, 0.02, -0.32]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.016, 0.016, 0.26, 10]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.02, -0.32]}
        args={[0.032, 0.032, 0.26]}
      />

      {/* ── FLASH HIDER / MUZZLE DEVICE ── */}
      {/* Main flash hider body */}
      <mesh
        material={steelLtMat}
        position={[0, 0.02, -0.46]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.02, 0.018, 0.04, 8]} />
      </mesh>

      {/* Flash hider prongs (4 prongs) */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle) => (
        <mesh
          key={`prong-${angle.toFixed(4)}`}
          material={steelMat}
          position={[
            Math.cos(angle) * 0.018,
            0.02 + Math.sin(angle) * 0.018,
            -0.49,
          ]}
        >
          <boxGeometry args={[0.007, 0.007, 0.03]} />
        </mesh>
      ))}

      {/* ── PISTOL GRIP ── */}
      {/* Main grip body – angled */}
      <mesh
        material={steelMat}
        position={[0, -0.065, 0.1]}
        rotation={[0.25, 0, 0]}
      >
        <boxGeometry args={[0.055, 0.115, 0.065]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, -0.065, 0.1]}
        args={[0.055, 0.115, 0.065]}
      />

      {/* Grip finger grooves */}
      {[-0.03, -0.01, 0.01, 0.03].map((yOff) => (
        <mesh
          key={`grip-groove-${yOff}`}
          material={detailMat}
          position={[0, -0.055 + yOff, 0.1]}
          rotation={[0.25, 0, 0]}
        >
          <boxGeometry args={[0.057, 0.008, 0.067]} />
        </mesh>
      ))}

      {/* ── TRIGGER GUARD ── */}
      {/* Bottom bar */}
      <mesh material={steelMat} position={[0, -0.025, 0.02]}>
        <boxGeometry args={[0.055, 0.01, 0.1]} />
      </mesh>
      {/* Front vertical */}
      <mesh material={steelMat} position={[0, 0.005, -0.03]}>
        <boxGeometry args={[0.055, 0.06, 0.01]} />
      </mesh>

      {/* Trigger */}
      <mesh
        material={chromeMat}
        position={[0, -0.005, 0.01]}
        rotation={[0.3, 0, 0]}
      >
        <boxGeometry args={[0.01, 0.04, 0.008]} />
      </mesh>

      {/* ── CURVED MAGAZINE (AK-style) — animierbar ── */}
      <group ref={magazineRef}>
        {/* Upper magazine body – connects to receiver */}
        <mesh material={steelMat} position={[0, -0.07, 0.04]}>
          <boxGeometry args={[0.052, 0.06, 0.075]} />
        </mesh>
        <GlowOverlay
          tier={upgradeTier}
          position={[0, -0.07, 0.04]}
          args={[0.052, 0.06, 0.075]}
        />

        {/* Lower magazine body – curved forward (AK banana mag) */}
        <mesh
          material={steelMat}
          position={[0, -0.115, 0.01]}
          rotation={[0.35, 0, 0]}
        >
          <boxGeometry args={[0.05, 0.075, 0.065]} />
        </mesh>

        {/* Magazine base plate */}
        <mesh
          material={steelLtMat}
          position={[0, -0.155, -0.01]}
          rotation={[0.35, 0, 0]}
        >
          <boxGeometry args={[0.053, 0.012, 0.068]} />
        </mesh>

        {/* Magazine ribs (AK-style horizontal ridges) */}
        {[-0.03, 0, 0.03].map((yOff) => (
          <mesh
            key={`mag-rib-${yOff}`}
            material={detailMat}
            position={[0, -0.115 + yOff, 0.01]}
            rotation={[0.35, 0, 0]}
          >
            <boxGeometry args={[0.052, 0.008, 0.067]} />
          </mesh>
        ))}
      </group>

      {/* ── STOCK (AK-style solid wood) ── */}
      {/* Main stock body */}
      <mesh material={woodMat} position={[0, -0.01, 0.27]}>
        <boxGeometry args={[0.055, 0.07, 0.2]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, -0.01, 0.27]}
        args={[0.055, 0.07, 0.2]}
      />

      {/* Stock taper toward butt */}
      <mesh material={woodMat} position={[0, -0.015, 0.36]}>
        <boxGeometry args={[0.052, 0.06, 0.04]} />
      </mesh>

      {/* Butt plate */}
      <mesh material={detailMat} position={[0, -0.01, 0.385]}>
        <boxGeometry args={[0.055, 0.072, 0.01]} />
      </mesh>

      {/* Wood grain on stock */}
      {[-0.015, 0.015].map((xOff) => (
        <mesh
          key={`stock-grain-${xOff}`}
          material={woodDarkMat}
          position={[xOff, -0.01, 0.27]}
        >
          <boxGeometry args={[0.005, 0.072, 0.19]} />
        </mesh>
      ))}

      {/* ══ FALLENDES Magazin (separates Item nach Drop) ══ */}
      <group ref={droppedMagRef} visible={false}>
        <mesh material={steelMat}>
          <boxGeometry args={[0.052, 0.13, 0.075]} />
        </mesh>
        <mesh material={steelLtMat} position={[0, -0.07, 0]}>
          <boxGeometry args={[0.053, 0.012, 0.078]} />
        </mesh>
      </group>

      {/* ══ AUTO-AUSGEWORFENE Hülse pro Schuss ══ */}
      <group ref={autoEjectRef} visible={false}>
        <mesh material={brassShellMat} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.03, 8]} />
        </mesh>
      </group>

      {/* ══ MÜNDUNGSFEUER am Lauf-Ende (nach Flash Hider) ══ */}
      <MuzzleFlash
        fireTimestamp={lastFireTime}
        position={[0, 0.02, -0.51]}
        scale={1.1}
      />

      <GoldSparkles active={upgradeTier === 3} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SNIPER RIFLE — AWP/L96/Remington 700 style (bolt-action, realistic PBR)
// ─────────────────────────────────────────────────────────────────────────────
function SniperRifleModel({
  recoilOffset,
  isReloading,
  upgradeTier,
  lastFireTime,
  reloadProgress,
}: {
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
  lastFireTime: number;
  reloadProgress: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const boltRef = useRef<THREE.Group>(null);
  const ejectedShellRef = useRef<THREE.Group>(null);
  const ejectShellDataRef = useRef({ active: false, startTime: 0 });
  // Auto-Bolt-Cycle nach jedem Schuss (wie ein Bolt-Action-Sniper)
  const autoBoltRef = useRef({ lastShot: 0, startTime: 0, active: false });

  const {
    steelMat,
    steelDarkMat,
    steelLightMat,
    stockMat,
    scopeMat,
    scopeGlassMat,
    brassRingMat,
    rubberMat,
    polymerMat,
    fluteMat,
  } = useMemo(() => {
    // ── Prozedurale Textur 1: Mattlackiertes Metall mit Mikrokratzern ──
    const makeMetalTexture = (baseHex: string, scratchAlpha: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Basis-Farbe
        ctx.fillStyle = baseHex;
        ctx.fillRect(0, 0, 256, 256);
        // Subtile horizontale Brushed-Metal-Linien
        for (let i = 0; i < 380; i++) {
          const y = Math.random() * 256;
          const x = Math.random() * 256;
          const len = 8 + Math.random() * 30;
          const a = 0.05 + Math.random() * 0.12;
          ctx.strokeStyle = `rgba(255,255,255,${a * 0.3})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + len, y + (Math.random() - 0.5) * 1.2);
          ctx.stroke();
        }
        // Mikrokratzer (heller, kürzer, schräger)
        for (let i = 0; i < 18; i++) {
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          const len = 2 + Math.random() * 8;
          const angle = (Math.random() - 0.5) * 0.4;
          ctx.strokeStyle = `rgba(255,255,255,${scratchAlpha})`;
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
          ctx.stroke();
        }
        // Punkt-Noise (sehr subtil)
        const img = ctx.getImageData(0, 0, 256, 256);
        for (let i = 0; i < img.data.length; i += 4) {
          const n = (Math.random() - 0.5) * 12;
          img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
          img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
          img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
        }
        ctx.putImageData(img, 0, 0);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    // ── Prozedurale Textur 2: Stippling auf Soft-Touch-Polymer (Schaft) ──
    const makePolymerTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0e0e10";
        ctx.fillRect(0, 0, 256, 256);
        // Stippling-Pattern (zufällige helle Punkte)
        for (let i = 0; i < 1800; i++) {
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          const a = 0.06 + Math.random() * 0.12;
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.beginPath();
          ctx.arc(x, y, 0.6 + Math.random() * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        // Dunkle Schatten-Punkte für Tiefe
        for (let i = 0; i < 600; i++) {
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          ctx.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.2})`;
          ctx.beginPath();
          ctx.arc(x, y, 0.5 + Math.random() * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const metalDarkTex = makeMetalTexture("#1e2022", 0.4);
    const metalLightTex = makeMetalTexture("#3a3d42", 0.5);
    const polymerTex = makePolymerTexture();

    return {
      steelMat: new THREE.MeshStandardMaterial({
        color: "#1e2022",
        metalness: 0.95,
        roughness: 0.32,
        map: metalDarkTex,
      }),
      steelDarkMat: new THREE.MeshStandardMaterial({
        color: "#111315",
        metalness: 1.0,
        roughness: 0.28,
        map: metalDarkTex,
      }),
      steelLightMat: new THREE.MeshStandardMaterial({
        color: "#3a3d42",
        metalness: 0.9,
        roughness: 0.35,
        map: metalLightTex,
      }),
      stockMat: new THREE.MeshStandardMaterial({
        color: "#1a1a1a",
        metalness: 0.0,
        roughness: 0.85,
        map: polymerTex,
      }),
      scopeMat: new THREE.MeshStandardMaterial({
        color: "#0e0e10",
        metalness: 0.7,
        roughness: 0.4,
        map: metalDarkTex,
      }),
      scopeGlassMat: new THREE.MeshStandardMaterial({
        color: "#0a1a1a",
        metalness: 0.3,
        roughness: 0.05,
        transparent: true,
        opacity: 0.75,
        // Leichter blau-grüner Glow für Anti-Reflex-Coating
        emissive: "#0a2a30",
        emissiveIntensity: 0.4,
      }),
      brassRingMat: new THREE.MeshStandardMaterial({
        color: "#b8902a",
        metalness: 0.9,
        roughness: 0.15,
      }),
      rubberMat: new THREE.MeshStandardMaterial({
        color: "#0d0d0d",
        metalness: 0.0,
        roughness: 1.0,
      }),
      // Polymer für Pistolengriff/Wangenauflage
      polymerMat: new THREE.MeshStandardMaterial({
        color: "#1a1a1c",
        metalness: 0.0,
        roughness: 0.92,
        map: polymerTex,
      }),
      // Helleres Metall für Lauf-Fluting (zeigt sich im Schatten der Riffel)
      fluteMat: new THREE.MeshStandardMaterial({
        color: "#2a2c30",
        metalness: 0.92,
        roughness: 0.4,
      }),
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Sniper-Reload-Phasen (Bolt-Action, einzelne Patrone laden):
    //  0.0–0.15 Hochkippen
    //  0.15–0.35 Bolt hochheben + zurückziehen (Kombi-Bewegung)
    //  0.35–0.55 Bolt zurück (Hülse fliegt raus, neue Patrone wird sichtbar)
    //  0.55–0.75 Bolt wieder vor + runterdrücken
    //  0.75–1.00 Wieder runter
    let tiltX = 0;
    let boltZ = 0;
    let boltY = 0; // hochheben

    if (isReloading && reloadProgress > 0) {
      const p = reloadProgress;
      if (p < 0.15) {
        tiltX = (p / 0.15) * 0.2;
      } else if (p < 0.35) {
        tiltX = 0.2;
        const localT = (p - 0.15) / 0.2;
        boltY = 0.012 * localT; // hochheben
      } else if (p < 0.55) {
        tiltX = 0.2;
        const localT = (p - 0.35) / 0.2;
        boltY = 0.012;
        boltZ = 0.05 * localT; // nach hinten
        // Hülse triggern wenn Bolt halb zurück
        if (!ejectShellDataRef.current.active && localT > 0.3) {
          ejectShellDataRef.current.active = true;
          ejectShellDataRef.current.startTime = performance.now();
        }
      } else if (p < 0.75) {
        tiltX = 0.18;
        const localT = (p - 0.55) / 0.2;
        boltY = 0.012 * (1 - localT);
        boltZ = 0.05 * (1 - localT);
      } else {
        tiltX = 0.15 * (1 - (p - 0.75) / 0.25);
      }
    } else {
      ejectShellDataRef.current.active = false;
    }

    // Auto-Bolt-Cycle nach jedem Schuss (eigene Animation, separat von Reload).
    // Beim ersten Render nur registrieren — verhindert falschen Bolt-Cycle beim Wechsel.
    if (autoBoltRef.current.lastShot === 0) {
      autoBoltRef.current.lastShot = lastFireTime;
    } else if (
      lastFireTime > 0 &&
      lastFireTime !== autoBoltRef.current.lastShot
    ) {
      autoBoltRef.current.lastShot = lastFireTime;
      autoBoltRef.current.startTime = performance.now();
      autoBoltRef.current.active = true;
    }
    if (autoBoltRef.current.active) {
      const elapsed =
        (performance.now() - autoBoltRef.current.startTime) / 1000;
      if (elapsed < 0.6) {
        // Bolt-Cycle: 0..0.3s zurück+hülse aus, 0.3..0.6s vor
        if (elapsed < 0.3) {
          const lt = elapsed / 0.3;
          boltY = Math.max(boltY, 0.012 * lt);
          boltZ = Math.max(boltZ, 0.05 * lt);
        } else {
          const lt = (elapsed - 0.3) / 0.3;
          boltY = Math.max(boltY, 0.012 * (1 - lt));
          boltZ = Math.max(boltZ, 0.05 * (1 - lt));
        }
        // Hülse beim Zurückziehen ausgeworfen (einmalig pro Schuss)
        if (
          elapsed > 0.1 &&
          elapsed < 0.15 &&
          !ejectShellDataRef.current.active
        ) {
          ejectShellDataRef.current.active = true;
          ejectShellDataRef.current.startTime = performance.now();
        }
      } else {
        autoBoltRef.current.active = false;
      }
    }

    if (boltRef.current) {
      boltRef.current.position.y +=
        (boltY - boltRef.current.position.y) * Math.min(delta * 25, 1);
      boltRef.current.position.z +=
        (boltZ - boltRef.current.position.z) * Math.min(delta * 25, 1);
    }

    // Sniper-Rückstoß: HORIZONTAL — kräftiger Stoß zum Schützen
    // (Sniper-Rounds haben den heftigsten Rückstoß aller Waffen).
    // Lauf kippt deutlich nach OBEN.
    const targetY = -0.27;
    const targetZ = -0.72 + recoilOffset * 0.3;
    groupRef.current.position.y +=
      (targetY - groupRef.current.position.y) * Math.min(delta * 12, 1);
    groupRef.current.position.z +=
      (targetZ - groupRef.current.position.z) * Math.min(delta * 12, 1);
    groupRef.current.rotation.x +=
      (recoilOffset * 0.45 + tiltX - groupRef.current.rotation.x) *
      Math.min(delta * 12, 1);

    // Ausgeworfene Hülse
    if (ejectedShellRef.current) {
      if (ejectShellDataRef.current.active) {
        const elapsed =
          (performance.now() - ejectShellDataRef.current.startTime) / 1000;
        if (elapsed < 1.2) {
          ejectedShellRef.current.visible = true;
          // Größere Sniper-Patrone, weiter rechts oben raus
          ejectedShellRef.current.position.x = 0.04 + elapsed * 0.7;
          ejectedShellRef.current.position.y =
            0.05 + elapsed * 0.7 - 5 * elapsed * elapsed;
          ejectedShellRef.current.position.z = 0.05;
          ejectedShellRef.current.rotation.x = elapsed * 12;
          ejectedShellRef.current.rotation.z = elapsed * 8;
        } else {
          ejectedShellRef.current.visible = false;
        }
      } else {
        ejectedShellRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0.18, -0.27, -0.72]}>
      {/* STOCK */}
      <mesh material={stockMat} position={[0, 0.01, 0.38]}>
        <boxGeometry args={[0.065, 0.09, 0.32]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.01, 0.38]}
        args={[0.065, 0.09, 0.32]}
      />
      <mesh material={stockMat} position={[0, 0.06, 0.28]}>
        <boxGeometry args={[0.062, 0.025, 0.22]} />
      </mesh>
      <mesh material={rubberMat} position={[0, 0.01, 0.545]}>
        <boxGeometry args={[0.068, 0.095, 0.022]} />
      </mesh>
      <mesh
        material={stockMat}
        position={[0, -0.055, 0.21]}
        rotation={[0.35, 0, 0]}
      >
        <boxGeometry args={[0.058, 0.085, 0.072]} />
      </mesh>

      {/* RECEIVER */}
      <mesh material={steelDarkMat} position={[0, 0.015, 0.08]}>
        <boxGeometry args={[0.068, 0.07, 0.22]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.015, 0.08]}
        args={[0.068, 0.07, 0.22]}
      />
      <mesh material={steelMat} position={[0, 0.055, 0.08]}>
        <boxGeometry args={[0.022, 0.012, 0.22]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6].map((val) => (
        <mesh
          key={`rs-${val}`}
          material={steelDarkMat}
          position={[0, 0.057, -0.04 + val * 0.03]}
        >
          <boxGeometry args={[0.024, 0.006, 0.008]} />
        </mesh>
      ))}
      <mesh material={steelMat} position={[0, -0.028, 0.06]}>
        <boxGeometry args={[0.056, 0.01, 0.1]} />
      </mesh>
      <mesh material={steelMat} position={[0, 0.0, 0.01]}>
        <boxGeometry args={[0.056, 0.06, 0.01]} />
      </mesh>
      <mesh
        material={steelLightMat}
        position={[0, -0.012, 0.04]}
        rotation={[0.25, 0, 0]}
      >
        <boxGeometry args={[0.008, 0.04, 0.007]} />
      </mesh>
      <mesh material={steelMat} position={[0, -0.075, 0.07]}>
        <boxGeometry args={[0.056, 0.065, 0.085]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, -0.075, 0.07]}
        args={[0.056, 0.065, 0.085]}
      />
      <mesh material={steelLightMat} position={[0, -0.113, 0.07]}>
        <boxGeometry args={[0.058, 0.01, 0.088]} />
      </mesh>

      {/* BOLT HANDLE — animierbar */}
      <group ref={boltRef}>
        <mesh
          material={steelLightMat}
          position={[0.042, 0.015, 0.095]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.008, 0.008, 0.035, 8]} />
        </mesh>
        <mesh material={steelMat} position={[0.065, -0.005, 0.095]}>
          <sphereGeometry args={[0.014, 10, 10]} />
        </mesh>
      </group>

      {/* BARREL */}
      <mesh
        material={steelDarkMat}
        position={[0, 0.015, -0.38]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.022, 0.018, 0.78, 16]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.015, -0.38]}
        args={[0.044, 0.044, 0.78]}
      />

      {/* LAUF-FLUTING — 6 Längsrillen typisch für Präzisionsgewehre */}
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const angle = (deg / 180) * Math.PI;
        const r = 0.0205;
        return (
          <mesh
            key={`flute-${deg}`}
            material={fluteMat}
            position={[Math.cos(angle) * r, 0.015 + Math.sin(angle) * r, -0.38]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <boxGeometry args={[0.005, 0.6, 0.003]} />
          </mesh>
        );
      })}

      {/* MÜNDUNGSBREMSE — detailliert mit Schlitzen */}
      {/* Hauptkörper (länger und etwas breiter als alte) */}
      <mesh
        material={steelLightMat}
        position={[0, 0.015, -0.81]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.03, 0.028, 0.085, 14]} />
      </mesh>
      {/* Vorderer Ring */}
      <mesh
        material={steelMat}
        position={[0, 0.015, -0.852]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.032, 0.032, 0.012, 14]} />
      </mesh>
      {/* Schlitze in der Mündungsbremse (4 horizontale Schlitze pro Seite) */}
      {[
        { y: 0.022, side: 1, id: "tr" },
        { y: 0.008, side: 1, id: "br" },
        { y: 0.022, side: -1, id: "tl" },
        { y: 0.008, side: -1, id: "bl" },
      ].map((s) => (
        <mesh
          key={`brake-slot-${s.id}`}
          position={[s.side * 0.028, 0.015 + s.y - 0.015, -0.81]}
        >
          <boxGeometry args={[0.012, 0.004, 0.06]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
      ))}
      {/* Vordere Mündungs-Öffnung (Loch) */}
      <mesh position={[0, 0.015, -0.86]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.012, 14]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* BIPOD — entfaltet, mit Schwenkpunkt + Beinen + Gummifüßen */}
      {/* Schwenk-Mount unter dem Lauf */}
      <mesh material={steelMat} position={[0, -0.005, -0.22]}>
        <boxGeometry args={[0.04, 0.022, 0.05]} />
      </mesh>
      {/* Mount-Verstärkung */}
      <mesh material={steelDarkMat} position={[0, -0.018, -0.22]}>
        <boxGeometry args={[0.046, 0.012, 0.04]} />
      </mesh>
      {/* Linkes Bein — schräg nach unten + außen */}
      <mesh
        material={steelDarkMat}
        position={[-0.045, -0.085, -0.218]}
        rotation={[0, 0, 0.55]}
      >
        <cylinderGeometry args={[0.005, 0.005, 0.16, 8]} />
      </mesh>
      {/* Linkes Bein — Verlängerungs-Segment (typisch teleskop) */}
      <mesh
        material={steelLightMat}
        position={[-0.078, -0.155, -0.218]}
        rotation={[0, 0, 0.55]}
      >
        <cylinderGeometry args={[0.006, 0.006, 0.06, 8]} />
      </mesh>
      {/* Linker Gummifuß */}
      <mesh material={rubberMat} position={[-0.092, -0.185, -0.218]}>
        <cylinderGeometry args={[0.011, 0.011, 0.012, 8]} />
      </mesh>
      {/* Rechtes Bein */}
      <mesh
        material={steelDarkMat}
        position={[0.045, -0.085, -0.218]}
        rotation={[0, 0, -0.55]}
      >
        <cylinderGeometry args={[0.005, 0.005, 0.16, 8]} />
      </mesh>
      <mesh
        material={steelLightMat}
        position={[0.078, -0.155, -0.218]}
        rotation={[0, 0, -0.55]}
      >
        <cylinderGeometry args={[0.006, 0.006, 0.06, 8]} />
      </mesh>
      <mesh material={rubberMat} position={[0.092, -0.185, -0.218]}>
        <cylinderGeometry args={[0.011, 0.011, 0.012, 8]} />
      </mesh>
      {/* Schwenk-Bolzen (sichtbar mittig) */}
      <mesh
        material={steelLightMat}
        position={[0, -0.005, -0.22]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.004, 0.004, 0.05, 8]} />
      </mesh>

      {/* SCOPE TUBE */}
      <mesh
        material={scopeMat}
        position={[0, 0.095, -0.04]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.028, 0.028, 0.44, 16]} />
      </mesh>
      <GlowOverlay
        tier={upgradeTier}
        position={[0, 0.095, -0.04]}
        args={[0.056, 0.056, 0.44]}
      />
      {/* Objective bell */}
      <mesh
        material={scopeMat}
        position={[0, 0.095, -0.3]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.042, 0.028, 0.08, 16]} />
      </mesh>
      <mesh
        material={scopeGlassMat}
        position={[0, 0.095, -0.342]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.04, 0.04, 0.008, 16]} />
      </mesh>
      <mesh
        material={brassRingMat}
        position={[0, 0.095, -0.346]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.043, 0.043, 0.005, 16]} />
      </mesh>
      {/* Eyepiece bell */}
      <mesh
        material={scopeMat}
        position={[0, 0.095, 0.22]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.036, 0.028, 0.07, 16]} />
      </mesh>
      <mesh
        material={scopeGlassMat}
        position={[0, 0.095, 0.258]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.033, 0.033, 0.008, 16]} />
      </mesh>
      {/* Elevation turret */}
      <mesh material={steelLightMat} position={[0, 0.127, 0.03]}>
        <cylinderGeometry args={[0.012, 0.012, 0.024, 10]} />
      </mesh>
      <mesh material={rubberMat} position={[0, 0.14, 0.03]}>
        <cylinderGeometry args={[0.011, 0.011, 0.006, 10]} />
      </mesh>
      {/* Windage turret */}
      <mesh
        material={steelLightMat}
        position={[0.04, 0.095, 0.03]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.012, 0.012, 0.022, 10]} />
      </mesh>
      <mesh
        material={rubberMat}
        position={[0.053, 0.095, 0.03]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.011, 0.011, 0.005, 10]} />
      </mesh>
      {/* Scope rings */}
      {[-0.08, 0.14].map((zOff) => (
        <mesh
          key={`sr-${zOff}`}
          material={steelMat}
          position={[0, 0.075, zOff]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.032, 0.032, 0.018, 14]} />
        </mesh>
      ))}
      {[-0.08, 0.14].map((zOff) => (
        <mesh
          key={`rb-${zOff}`}
          material={steelDarkMat}
          position={[0, 0.059, zOff]}
        >
          <boxGeometry args={[0.028, 0.012, 0.022]} />
        </mesh>
      ))}

      {/* ── PICATINNY RAIL auf dem Receiver (zwischen den Scope-Ringen) ── */}
      <mesh material={steelDarkMat} position={[0, 0.052, 0.03]}>
        <boxGeometry args={[0.026, 0.005, 0.18]} />
      </mesh>
      {/* Rail-Slots — typisches Zickzack-Pattern */}
      {[-0.06, -0.03, 0.0, 0.03, 0.06, 0.09].map((zOff) => (
        <mesh
          key={`rail-slot-${zOff}`}
          material={steelLightMat}
          position={[0, 0.054, zOff]}
        >
          <boxGeometry args={[0.028, 0.002, 0.008]} />
        </mesh>
      ))}

      {/* ── DBM MAGAZIN (Detachable Box Magazine vor Abzugsbügel) ── */}
      <mesh material={steelDarkMat} position={[0, -0.13, 0.025]}>
        <boxGeometry args={[0.05, 0.075, 0.07]} />
      </mesh>
      {/* Magazin-Bodenplatte */}
      <mesh material={steelLightMat} position={[0, -0.172, 0.025]}>
        <boxGeometry args={[0.054, 0.01, 0.075]} />
      </mesh>
      {/* Magazin-Greifrille */}
      <mesh material={steelMat} position={[0, -0.13, 0.063]}>
        <boxGeometry args={[0.052, 0.005, 0.005]} />
      </mesh>
      {/* Magazin-Release-Hebel (Knopf vor Magazin) */}
      <mesh material={steelLightMat} position={[0.028, -0.105, -0.02]}>
        <boxGeometry args={[0.008, 0.012, 0.018]} />
      </mesh>

      {/* ── WANGENAUFLAGE (verstellbar, oben am Schaft) ── */}
      <mesh material={polymerMat} position={[0, 0.08, 0.32]}>
        <boxGeometry args={[0.062, 0.04, 0.18]} />
      </mesh>
      {/* Wangenauflage-Verstellrad rechts */}
      <mesh
        material={steelLightMat}
        position={[0.034, 0.07, 0.4]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.011, 0.011, 0.008, 12]} />
      </mesh>

      {/* ── PISTOLENGRIFF (separater Polymer-Griff statt Stockstumpf-Vorderteil) ── */}
      <mesh
        material={polymerMat}
        position={[0, -0.06, 0.21]}
        rotation={[0.3, 0, 0]}
      >
        <boxGeometry args={[0.04, 0.11, 0.05]} />
      </mesh>
      {/* Griff-Fingerkerben (3 horizontale Riffeln vorne) */}
      {[-0.02, 0.0, 0.02].map((yOff) => (
        <mesh
          key={`grip-line-${yOff}`}
          material={steelDarkMat}
          position={[0, -0.06 + yOff, 0.235]}
          rotation={[0.3, 0, 0]}
        >
          <boxGeometry args={[0.041, 0.004, 0.005]} />
        </mesh>
      ))}

      {/* ── SLING SWIVELS (Trageriemen-Ösen) ── */}
      {/* Vordere Sling-Swivel an der Bipod-Mount */}
      <mesh
        material={steelLightMat}
        position={[0, -0.025, -0.16]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <torusGeometry args={[0.011, 0.0025, 6, 12]} />
      </mesh>
      {/* Hintere Sling-Swivel am Schaft */}
      <mesh
        material={steelLightMat}
        position={[0, -0.04, 0.45]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <torusGeometry args={[0.011, 0.0025, 6, 12]} />
      </mesh>

      {/* ── ZOOM-RING am Scope (Rändelung) ── */}
      <mesh
        material={steelLightMat}
        position={[0, 0.095, 0.16]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.031, 0.031, 0.022, 18]} />
      </mesh>
      {/* Zoom-Ring Rändel-Riefen */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const angle = (deg / 180) * Math.PI;
        return (
          <mesh
            key={`zoom-knurl-${deg}`}
            material={steelDarkMat}
            position={[
              Math.cos(angle) * 0.0315,
              0.095 + Math.sin(angle) * 0.0315,
              0.16,
            ]}
            rotation={[Math.PI / 2, angle, 0]}
          >
            <boxGeometry args={[0.001, 0.018, 0.003]} />
          </mesh>
        );
      })}

      {/* ── ABZUG (sichtbar in einem Bügel) ── */}
      <mesh
        material={steelLightMat}
        position={[0, -0.08, -0.02]}
        rotation={[0.2, 0, 0]}
      >
        <boxGeometry args={[0.005, 0.025, 0.012]} />
      </mesh>
      {/* Abzugsbügel (Trigger Guard) */}
      <mesh material={steelDarkMat} position={[0, -0.092, -0.005]}>
        <torusGeometry args={[0.022, 0.0035, 4, 12, Math.PI]} />
      </mesh>

      {/* ══ AUSGEWORFENE Sniper-Patrone (groß, fliegt weiter) ══ */}
      <group ref={ejectedShellRef} visible={false}>
        <mesh material={brassRingMat} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.05, 8]} />
        </mesh>
      </group>

      {/* ══ MÜNDUNGSFEUER am Lauf-Ende ══ */}
      <MuzzleFlash
        fireTimestamp={lastFireTime}
        position={[0, 0.015, -0.83]}
        scale={1.4}
      />

      <GoldSparkles active={upgradeTier === 3} />
    </group>
  );
}

export function WeaponViewModel({
  weapon,
  recoilOffset,
  isReloading,
  upgradeTier,
  lastFireTime,
  reloadProgress,
  isAiming = false,
  movementStateRef,
}: WeaponViewModelProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  // Innere Group: hält Sprint-Pose und Walk-Bob-Wackeln der Waffe.
  // Wird zwischen Camera-Group und einzelne Weapon-Models geschoben so dass
  // sich alle Waffen automatisch im selben Bewegungs-Rhythmus mitbewegen.
  const swayGroupRef = useRef<THREE.Group>(null);
  // Smooth Animations-Werte
  const sprintBlendRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(camera.position);
    groupRef.current.quaternion.copy(camera.quaternion);

    if (!swayGroupRef.current) return;
    const sway = swayGroupRef.current;

    // Movement-State aus Ref lesen (kein Re-Render pro Frame)
    const ms = movementStateRef?.current;
    const isMoving = ms?.isMoving ?? false;
    const isSprinting = ms?.isSprinting ?? false;
    const stepPhase = ms?.stepPhase ?? 0;

    // ── Sprint-Pose smooth Übergang (0=normal, 1=full sprint) ──
    const wantsSprint = isSprinting && !isReloading && !isAiming;
    const target = wantsSprint ? 1 : 0;
    sprintBlendRef.current +=
      (target - sprintBlendRef.current) * Math.min(delta * 8, 1);
    const sb = sprintBlendRef.current;

    // ── Walk-Sway: Waffe wackelt im Schritt-Rhythmus ──
    const aimReduce = isAiming ? 0.15 : 1.0;
    const walkAmp = isMoving ? 1.0 : 0.0;
    const sprintBoost = 1 + sb * 1.4;
    const swayAmount = aimReduce * walkAmp * sprintBoost;

    const walkBobY = Math.abs(Math.sin(stepPhase)) * 0.012 * swayAmount;
    const walkBobX = Math.sin(stepPhase) * 0.014 * swayAmount;
    const walkRoll = Math.sin(stepPhase) * 0.025 * swayAmount;

    // ── Sprint-Pose: Waffe schräg zur Seite gehalten ──
    const sprintPosX = sb * 0.08;
    const sprintPosY = sb * -0.06;
    const sprintPosZ = sb * 0.04;
    const sprintRotY = sb * -0.4;
    const sprintRotZ = sb * -0.45;
    const sprintRotX = sb * 0.15;

    sway.position.set(sprintPosX + walkBobX, sprintPosY + walkBobY, sprintPosZ);
    sway.rotation.set(sprintRotX, sprintRotY, sprintRotZ + walkRoll);
  });

  return (
    <group ref={groupRef}>
      <group ref={swayGroupRef}>
        {weapon === "pistol" && (
          <PistolModel
            recoilOffset={recoilOffset}
            isReloading={isReloading}
            upgradeTier={upgradeTier}
            lastFireTime={lastFireTime}
            reloadProgress={reloadProgress}
            isAiming={isAiming}
          />
        )}
        {weapon === "shotgun" && (
          <ShotgunModel
            recoilOffset={recoilOffset}
            isReloading={isReloading}
            upgradeTier={upgradeTier}
            lastFireTime={lastFireTime}
            reloadProgress={reloadProgress}
            isAiming={isAiming}
          />
        )}
        {weapon === "assault_rifle" && (
          <AssaultRifleModel
            recoilOffset={recoilOffset}
            isReloading={isReloading}
            upgradeTier={upgradeTier}
            lastFireTime={lastFireTime}
            reloadProgress={reloadProgress}
            isAiming={isAiming}
          />
        )}
        {weapon === "sniper_rifle" && (
          <SniperRifleModel
            recoilOffset={recoilOffset}
            isReloading={isReloading}
            upgradeTier={upgradeTier}
            lastFireTime={lastFireTime}
            reloadProgress={reloadProgress}
          />
        )}
      </group>
    </group>
  );
}
