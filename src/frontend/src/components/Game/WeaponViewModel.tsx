import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { WeaponName } from "../../types/weapon";

interface WeaponViewModelProps {
  weapon: WeaponName;
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
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
      {Array.from({ length: 6 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <mesh key={i}>
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
}: {
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

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
    const targetY = -0.25 - recoilOffset * 0.35;
    const targetZ = -0.5 + recoilOffset * 0.08;
    const reloadBob = isReloading ? Math.sin(Date.now() * 0.005) * 0.05 : 0;
    groupRef.current.position.y +=
      (targetY + reloadBob - groupRef.current.position.y) *
      Math.min(delta * 15, 1);
    groupRef.current.position.z +=
      (targetZ - groupRef.current.position.z) * Math.min(delta * 15, 1);
    groupRef.current.rotation.x +=
      (-recoilOffset * 0.3 - groupRef.current.rotation.x) *
      Math.min(delta * 15, 1);
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
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
          key={`ser-${i}`}
          material={rubberMat}
          position={[0, 0.07, 0.07 + i * 0.012]}
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
      {[0, 1, 2].map((j) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
          key={`wg-l-${j}`}
          material={gripLightMat}
          position={[-0.036, -0.055, 0.02 + j * 0.035]}
        >
          <boxGeometry args={[0.008, 0.113, 0.003]} />
        </mesh>
      ))}
      {/* Wood grain lines – right panel */}
      {[0, 1, 2].map((j) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
          key={`wg-r-${j}`}
          material={gripLightMat}
          position={[0.036, -0.055, 0.02 + j * 0.035]}
        >
          <boxGeometry args={[0.008, 0.113, 0.003]} />
        </mesh>
      ))}

      {/* Diamond checkering simulation – left (6 horizontal ridges) */}
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
          key={`chk-l-${k}`}
          material={gripMat}
          position={[-0.036, -0.02 + k * 0.02, 0.065]}
        >
          <boxGeometry args={[0.008, 0.006, 0.098]} />
        </mesh>
      ))}
      {/* Diamond checkering simulation – right */}
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
          key={`chk-r-${k}`}
          material={gripMat}
          position={[0.036, -0.02 + k * 0.02, 0.065]}
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
      {[0, 1, 2].map((m) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
          key={`wh-${m}`}
          material={rubberMat}
          position={[0.027, -0.075 + m * 0.025, 0.065]}
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
      {[0, 1].map((n) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
          key={`rail-${n}`}
          material={rubberMat}
          position={[0, -0.038, -0.045 + n * 0.03]}
        >
          <boxGeometry args={[0.064, 0.009, 0.005]} />
        </mesh>
      ))}

      {/* ══ BRASS accent — front sight dot ══ */}
      <mesh material={brassMat} position={[0, 0.105, -0.19]}>
        <sphereGeometry args={[0.003, 6, 6]} />
      </mesh>

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
}: {
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

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
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetY = -0.3 - recoilOffset * 0.6;
    const reloadBob = isReloading ? Math.sin(Date.now() * 0.004) * 0.07 : 0;
    groupRef.current.position.y +=
      (targetY + reloadBob - groupRef.current.position.y) *
      Math.min(delta * 12, 1);
    groupRef.current.rotation.x +=
      (-recoilOffset * 0.55 - groupRef.current.rotation.x) *
      Math.min(delta * 12, 1);
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
      {[0, 1, 2, 3, 4].map((i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <mesh
          key={`fg-${i}`}
          material={woodDarkMat}
          position={[0, -0.02, -0.105 + i * 0.028]}
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
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <mesh
          key={`hs-${i}`}
          material={rubberMat}
          position={[0, 0.065, -0.07 - i * 0.05]}
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
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <mesh
          key={`rp-${i}`}
          material={metalLightMat}
          position={[0, 0.076, -0.06 - i * 0.05]}
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
      {[0, 1, 2, 3, 4, 5].map((i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <mesh
          key={`sh-${i}`}
          material={brassMat}
          position={[-0.055, -0.025 + i * 0.015, 0.01 + (i % 2) * 0.01]}
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
}: {
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const { steelMat, steelLtMat, woodMat, woodDarkMat, detailMat, chromeMat } =
    useMemo(() => {
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
      };
    }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetY = -0.26 - recoilOffset * 0.22;
    const reloadBob = isReloading ? Math.sin(Date.now() * 0.006) * 0.04 : 0;
    groupRef.current.position.y +=
      (targetY + reloadBob - groupRef.current.position.y) *
      Math.min(delta * 18, 1);
    groupRef.current.rotation.x +=
      (-recoilOffset * 0.2 - groupRef.current.rotation.x) *
      Math.min(delta * 18, 1);
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
      {[-0.02, 0, 0.02].map((xOff, i) => (
        <mesh
          // biome-ignore lint: pre-existing issue
          key={`hg-grain-${i}`}
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
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
        <mesh
          // biome-ignore lint: pre-existing issue
          key={`prong-${i}`}
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
      {[-0.03, -0.01, 0.01, 0.03].map((yOff, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry array
          key={`grip-groove-${i}`}
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

      {/* ── CURVED MAGAZINE (AK-style) ── */}
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
      {[-0.03, 0, 0.03].map((yOff, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry array
          key={`mag-rib-${i}`}
          material={detailMat}
          position={[0, -0.115 + yOff, 0.01]}
          rotation={[0.35, 0, 0]}
        >
          <boxGeometry args={[0.052, 0.008, 0.067]} />
        </mesh>
      ))}

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
      {[-0.015, 0.015].map((xOff, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry array
          key={`stock-grain-${i}`}
          material={woodDarkMat}
          position={[xOff, -0.01, 0.27]}
        >
          <boxGeometry args={[0.005, 0.072, 0.19]} />
        </mesh>
      ))}

      <GoldSparkles active={upgradeTier === 3} />
    </group>
  );
}

export function WeaponViewModel({
  weapon,
  recoilOffset,
  isReloading,
  upgradeTier,
}: WeaponViewModelProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(camera.position);
    groupRef.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={groupRef}>
      {weapon === "pistol" && (
        <PistolModel
          recoilOffset={recoilOffset}
          isReloading={isReloading}
          upgradeTier={upgradeTier}
        />
      )}
      {weapon === "shotgun" && (
        <ShotgunModel
          recoilOffset={recoilOffset}
          isReloading={isReloading}
          upgradeTier={upgradeTier}
        />
      )}
      {weapon === "assault_rifle" && (
        <AssaultRifleModel
          recoilOffset={recoilOffset}
          isReloading={isReloading}
          upgradeTier={upgradeTier}
        />
      )}
    </group>
  );
}
