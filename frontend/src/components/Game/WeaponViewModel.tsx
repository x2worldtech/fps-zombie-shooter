import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WeaponName } from '../../types/weapon';
import { useToonMaterial, useOutlineMaterial } from './ToonMaterial';

interface WeaponViewModelProps {
  weapon: WeaponName;
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
}

// Animated glow material for upgraded weapons
function GlowOverlay({ tier, position, args }: {
  tier: number;
  position: [number, number, number];
  args: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current || tier === 0) return;
    const t = Date.now() * 0.001;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (tier === 1) mat.emissiveIntensity = 1.5 + Math.sin(t * 2.0) * 1.0;
    else if (tier === 2) mat.emissiveIntensity = 2.0 + Math.sin(t * 3.5) * 1.5;
    else if (tier === 3) mat.emissiveIntensity = 2.5 + Math.sin(t * 6.0) * 2.0 + Math.sin(t * 11.3) * 0.5;
  });

  if (tier === 0) return null;
  const color = tier === 1 ? '#0066ff' : tier === 2 ? '#8800ff' : '#ffaa00';
  const emissive = tier === 1 ? '#0044cc' : tier === 2 ? '#6600cc' : '#cc8800';

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[args[0] + 0.015, args[1] + 0.015, args[2] + 0.015]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={2.0} transparent opacity={tier === 3 ? 0.8 : 0.7} side={THREE.FrontSide} depthWrite={false} />
    </mesh>
  );
}

function GlowOverlayCylinder({ tier, position, args, rotation }: {
  tier: number;
  position: [number, number, number];
  args: [number, number, number, number];
  rotation?: [number, number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current || tier === 0) return;
    const t = Date.now() * 0.001;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (tier === 1) mat.emissiveIntensity = 1.5 + Math.sin(t * 2.0) * 1.0;
    else if (tier === 2) mat.emissiveIntensity = 2.0 + Math.sin(t * 3.5) * 1.5;
    else if (tier === 3) mat.emissiveIntensity = 2.5 + Math.sin(t * 6.0) * 2.0;
  });

  if (tier === 0) return null;
  const color = tier === 1 ? '#0066ff' : tier === 2 ? '#8800ff' : '#ffaa00';
  const emissive = tier === 1 ? '#0044cc' : tier === 2 ? '#6600cc' : '#cc8800';

  return (
    <mesh ref={meshRef} position={position} rotation={rotation ? new THREE.Euler(...rotation) : undefined}>
      <cylinderGeometry args={[args[0] + 0.008, args[1] + 0.008, args[2] + 0.01, args[3]]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={2.0} transparent opacity={0.65} side={THREE.FrontSide} depthWrite={false} />
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
      child.position.y = Math.sin(t * 1.5 + offset) * 0.12 + Math.sin(t * 3 + offset * 2) * 0.05;
      child.position.z = Math.sin(t * 2 + offset) * 0.12;
      const scale = 0.3 + 0.7 * Math.abs(Math.sin(t * 4 + offset));
      child.scale.setScalar(scale * 0.025);
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#ffcc00" emissive="#ffaa00" emissiveIntensity={3} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Realistic Glock-style Pistol with Right Hand & Arm ──────────────────────
function PistolModel({ recoilOffset, isReloading, upgradeTier }: {
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Weapon materials
  const slideMat = useToonMaterial('#2a2a2a');
  const frameMat = useToonMaterial('#1a1a1a');
  const barrelMat = useToonMaterial('#1e1e1e');
  const accentMat = useToonMaterial('#3a3a3a');
  const outlineMat = useOutlineMaterial(0.035);

  // Hand / arm materials
  const skinMat = useToonMaterial('#c68642');
  const sleeveMat = useToonMaterial('#3b4a2f');

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetY = -0.28 - recoilOffset * 0.3;
    const targetZ = -0.48 + recoilOffset * 0.1;
    const reloadBob = isReloading ? Math.sin(Date.now() * 0.005) * 0.05 : 0;
    const reloadTilt = isReloading ? Math.sin(Date.now() * 0.004) * 0.06 : 0;
    groupRef.current.position.y += (targetY + reloadBob - groupRef.current.position.y) * Math.min(delta * 15, 1);
    groupRef.current.position.z += (targetZ - groupRef.current.position.z) * Math.min(delta * 15, 1);
    groupRef.current.rotation.x += (-recoilOffset * 0.3 + reloadTilt - groupRef.current.rotation.x) * Math.min(delta * 15, 1);
  });

  return (
    <group ref={groupRef} position={[0.22, -0.28, -0.48]} rotation={[0, 0.06, 0]}>

      {/* ── SLIDE (top rectangular block) ── */}
      <mesh material={slideMat} position={[0, 0.025, -0.04]}>
        <boxGeometry args={[0.055, 0.042, 0.175]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, 0.025, -0.04]} args={[0.055, 0.042, 0.175]} />
      <mesh material={outlineMat} position={[0, 0.025, -0.04]}>
        <boxGeometry args={[0.055, 0.042, 0.175]} />
      </mesh>

      {/* Slide serrations (rear) */}
      {[0.04, 0.06, 0.08].map((z, i) => (
        <mesh key={i} material={accentMat} position={[0, 0.025, z]}>
          <boxGeometry args={[0.057, 0.044, 0.006]} />
        </mesh>
      ))}

      {/* Slide top flat rib */}
      <mesh material={accentMat} position={[0, 0.048, -0.04]}>
        <boxGeometry args={[0.018, 0.006, 0.16]} />
      </mesh>

      {/* Front sight */}
      <mesh material={accentMat} position={[0, 0.052, -0.115]}>
        <boxGeometry args={[0.006, 0.012, 0.006]} />
      </mesh>
      {/* Rear sight */}
      <mesh material={accentMat} position={[0, 0.052, 0.065]}>
        <boxGeometry args={[0.022, 0.010, 0.008]} />
      </mesh>

      {/* ── BARREL (protruding from slide front) ── */}
      <mesh material={barrelMat} position={[0, 0.022, -0.145]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.010, 0.010, 0.06, 10]} />
      </mesh>
      <GlowOverlayCylinder tier={upgradeTier} position={[0, 0.022, -0.145]} args={[0.010, 0.010, 0.06, 10]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh material={outlineMat} position={[0, 0.022, -0.145]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.010, 0.010, 0.06, 10]} />
      </mesh>

      {/* ── FRAME (lower, angled grip) ── */}
      <mesh material={frameMat} position={[0, -0.002, -0.02]}>
        <boxGeometry args={[0.052, 0.028, 0.155]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, -0.002, -0.02]} args={[0.052, 0.028, 0.155]} />

      {/* ── TRIGGER GUARD ── */}
      <mesh material={frameMat} position={[0, -0.028, -0.025]}>
        <boxGeometry args={[0.050, 0.010, 0.075]} />
      </mesh>
      <mesh material={frameMat} position={[0, -0.016, -0.065]}>
        <boxGeometry args={[0.050, 0.028, 0.010]} />
      </mesh>
      {/* Trigger */}
      <mesh material={accentMat} position={[0, -0.018, -0.018]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.008, 0.022, 0.010]} />
      </mesh>

      {/* ── GRIP (angled downward ~15 deg) ── */}
      <mesh material={frameMat} position={[0, -0.095, 0.055]} rotation={[-0.26, 0, 0]}>
        <boxGeometry args={[0.050, 0.115, 0.048]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, -0.095, 0.055]} args={[0.050, 0.115, 0.048]} />
      <mesh material={outlineMat} position={[0, -0.095, 0.055]} rotation={[-0.26, 0, 0]}>
        <boxGeometry args={[0.050, 0.115, 0.048]} />
      </mesh>
      {/* Grip texture stippling */}
      {[-0.03, 0.0, 0.03].map((y, i) => (
        <mesh key={i} material={accentMat} position={[0, -0.095 + y, 0.055]} rotation={[-0.26, 0, 0]}>
          <boxGeometry args={[0.052, 0.008, 0.050]} />
        </mesh>
      ))}

      {/* ── MAGAZINE BASE (visible at bottom of grip) ── */}
      <mesh material={accentMat} position={[0, -0.158, 0.068]} rotation={[-0.26, 0, 0]}>
        <boxGeometry args={[0.054, 0.014, 0.052]} />
      </mesh>

      {/* ══════════════════════════════════════════════════════════
          RIGHT HAND & ARM (gripping the pistol)
      ══════════════════════════════════════════════════════════ */}

      {/* Right forearm sleeve */}
      <mesh material={sleeveMat} position={[0.07, -0.22, 0.20]} rotation={[-0.50, 0.12, 0.20]}>
        <cylinderGeometry args={[0.036, 0.042, 0.26, 8]} />
      </mesh>
      <mesh material={outlineMat} position={[0.07, -0.22, 0.20]} rotation={[-0.50, 0.12, 0.20]}>
        <cylinderGeometry args={[0.036, 0.042, 0.26, 8]} />
      </mesh>

      {/* Right wrist (skin transition) */}
      <mesh material={skinMat} position={[0.048, -0.145, 0.075]} rotation={[-0.50, 0.12, 0.20]}>
        <cylinderGeometry args={[0.031, 0.035, 0.065, 8]} />
      </mesh>

      {/* Right palm wrapping the grip */}
      <mesh material={skinMat} position={[0.032, -0.105, 0.058]} rotation={[-0.26, 0.08, 0.12]}>
        <boxGeometry args={[0.062, 0.072, 0.055]} />
      </mesh>
      <mesh material={outlineMat} position={[0.032, -0.105, 0.058]} rotation={[-0.26, 0.08, 0.12]}>
        <boxGeometry args={[0.062, 0.072, 0.055]} />
      </mesh>

      {/* Right thumb */}
      <mesh material={skinMat} position={[0.058, -0.082, 0.038]} rotation={[0.15, -0.35, 0.55]}>
        <cylinderGeometry args={[0.011, 0.013, 0.052, 6]} />
      </mesh>

      {/* Right index finger (near trigger guard) */}
      <mesh material={skinMat} position={[0.008, -0.072, 0.010]} rotation={[0.20, 0.05, -0.08]}>
        <cylinderGeometry args={[0.009, 0.011, 0.045, 6]} />
      </mesh>

      {/* Right middle finger */}
      <mesh material={skinMat} position={[0.008, -0.098, 0.048]} rotation={[-0.26, 0.05, -0.05]}>
        <cylinderGeometry args={[0.010, 0.012, 0.048, 6]} />
      </mesh>

      {/* Right ring finger */}
      <mesh material={skinMat} position={[0.008, -0.108, 0.062]} rotation={[-0.26, 0.05, -0.05]}>
        <cylinderGeometry args={[0.009, 0.011, 0.044, 6]} />
      </mesh>

      {/* Right pinky finger */}
      <mesh material={skinMat} position={[0.008, -0.118, 0.074]} rotation={[-0.26, 0.05, -0.05]}>
        <cylinderGeometry args={[0.008, 0.010, 0.038, 6]} />
      </mesh>

      <GoldSparkles active={upgradeTier === 3} />
    </group>
  );
}

// ─── Realistic Mossberg-style Pump-Action Shotgun with Two Hands ─────────────
function ShotgunModel({ recoilOffset, isReloading, upgradeTier }: {
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Weapon materials
  const metalMat = useToonMaterial('#2c2c2c');
  const woodMat = useToonMaterial('#7a3b10');
  const darkMat = useToonMaterial('#1a1a1a');
  const accentMat = useToonMaterial('#3e3e3e');
  const outlineMat = useOutlineMaterial(0.038);

  // Hand / arm materials
  const skinMat = useToonMaterial('#c68642');
  const sleeveMat = useToonMaterial('#3b4a2f');

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetY = -0.30 - recoilOffset * 0.5;
    const targetZ = -0.58 + recoilOffset * 0.06;
    const reloadBob = isReloading ? Math.sin(Date.now() * 0.004) * 0.06 : 0;
    const reloadTilt = isReloading ? Math.sin(Date.now() * 0.003) * 0.07 : 0;
    groupRef.current.position.y += (targetY + reloadBob - groupRef.current.position.y) * Math.min(delta * 12, 1);
    groupRef.current.position.z += (targetZ - groupRef.current.position.z) * Math.min(delta * 12, 1);
    groupRef.current.rotation.x += (-recoilOffset * 0.5 + reloadTilt - groupRef.current.rotation.x) * Math.min(delta * 12, 1);
    groupRef.current.rotation.z += (reloadTilt * 0.2 - groupRef.current.rotation.z) * Math.min(delta * 8, 1);
  });

  return (
    <group ref={groupRef} position={[0.20, -0.30, -0.58]} rotation={[0, 0.06, 0]}>

      {/* ── MAIN BARREL (long cylinder) ── */}
      <mesh material={metalMat} position={[0, 0.028, -0.30]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.024, 0.62, 12]} />
      </mesh>
      <GlowOverlayCylinder tier={upgradeTier} position={[0, 0.028, -0.30]} args={[0.022, 0.024, 0.62, 12]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh material={outlineMat} position={[0, 0.028, -0.30]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.024, 0.62, 12]} />
      </mesh>

      {/* Muzzle end cap */}
      <mesh material={darkMat} position={[0, 0.028, -0.618]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 0.012, 12]} />
      </mesh>

      {/* Front bead sight */}
      <mesh material={accentMat} position={[0, 0.054, -0.595]}>
        <sphereGeometry args={[0.006, 6, 6]} />
      </mesh>

      {/* ── MAGAZINE TUBE (under barrel) ── */}
      <mesh material={metalMat} position={[0, -0.002, -0.26]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.52, 10]} />
      </mesh>
      <GlowOverlayCylinder tier={upgradeTier} position={[0, -0.002, -0.26]} args={[0.016, 0.016, 0.52, 10]} rotation={[Math.PI / 2, 0, 0]} />

      {/* Magazine tube cap */}
      <mesh material={accentMat} position={[0, -0.002, -0.525]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.020, 0.020, 0.012, 10]} />
      </mesh>

      {/* ── RECEIVER BODY ── */}
      <mesh material={metalMat} position={[0, 0.015, 0.02]}>
        <boxGeometry args={[0.072, 0.075, 0.22]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, 0.015, 0.02]} args={[0.072, 0.075, 0.22]} />
      <mesh material={outlineMat} position={[0, 0.015, 0.02]}>
        <boxGeometry args={[0.072, 0.075, 0.22]} />
      </mesh>

      {/* Ejection port (right side detail) */}
      <mesh material={darkMat} position={[0.038, 0.022, 0.01]}>
        <boxGeometry args={[0.006, 0.032, 0.065]} />
      </mesh>

      {/* Loading port (bottom of receiver) */}
      <mesh material={darkMat} position={[0, -0.025, 0.04]}>
        <boxGeometry args={[0.040, 0.008, 0.055]} />
      </mesh>

      {/* ── TRIGGER GUARD ── */}
      <mesh material={metalMat} position={[0, -0.040, 0.055]}>
        <boxGeometry args={[0.055, 0.010, 0.065]} />
      </mesh>
      <mesh material={metalMat} position={[0, -0.025, 0.020]}>
        <boxGeometry args={[0.055, 0.030, 0.010]} />
      </mesh>
      {/* Trigger */}
      <mesh material={accentMat} position={[0, -0.030, 0.048]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.008, 0.025, 0.010]} />
      </mesh>

      {/* ── PUMP FOREND (sliding grip under barrel) ── */}
      <mesh material={woodMat} position={[0, 0.010, -0.20]}>
        <boxGeometry args={[0.068, 0.052, 0.145]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, 0.010, -0.20]} args={[0.068, 0.052, 0.145]} />
      <mesh material={outlineMat} position={[0, 0.010, -0.20]}>
        <boxGeometry args={[0.068, 0.052, 0.145]} />
      </mesh>
      {/* Forend grooves */}
      {[-0.22, -0.20, -0.18].map((z, i) => (
        <mesh key={i} material={darkMat} position={[0, 0.010, z]}>
          <boxGeometry args={[0.070, 0.054, 0.006]} />
        </mesh>
      ))}

      {/* ── STOCK (wood, extends toward camera) ── */}
      <mesh material={woodMat} position={[0, 0.008, 0.195]}>
        <boxGeometry args={[0.065, 0.068, 0.22]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, 0.008, 0.195]} args={[0.065, 0.068, 0.22]} />
      <mesh material={outlineMat} position={[0, 0.008, 0.195]}>
        <boxGeometry args={[0.065, 0.068, 0.22]} />
      </mesh>
      {/* Stock wrist */}
      <mesh material={woodMat} position={[0, 0.005, 0.125]}>
        <boxGeometry args={[0.058, 0.058, 0.06]} />
      </mesh>
      {/* Cheek piece */}
      <mesh material={woodMat} position={[0, 0.048, 0.21]}>
        <boxGeometry args={[0.065, 0.020, 0.16]} />
      </mesh>
      {/* Butt pad */}
      <mesh material={darkMat} position={[0, 0.008, 0.310]}>
        <boxGeometry args={[0.068, 0.075, 0.018]} />
      </mesh>

      {/* ══════════════════════════════════════════════════════════
          RIGHT HAND & ARM (trigger/stock area)
      ══════════════════════════════════════════════════════════ */}

      {/* Right forearm sleeve */}
      <mesh material={sleeveMat} position={[0.08, -0.20, 0.24]} rotation={[-0.52, 0.14, 0.22]}>
        <cylinderGeometry args={[0.038, 0.044, 0.28, 8]} />
      </mesh>
      <mesh material={outlineMat} position={[0.08, -0.20, 0.24]} rotation={[-0.52, 0.14, 0.22]}>
        <cylinderGeometry args={[0.038, 0.044, 0.28, 8]} />
      </mesh>

      {/* Right wrist */}
      <mesh material={skinMat} position={[0.055, -0.130, 0.105]} rotation={[-0.52, 0.14, 0.22]}>
        <cylinderGeometry args={[0.033, 0.037, 0.065, 8]} />
      </mesh>

      {/* Right palm (wrapping stock/trigger area) */}
      <mesh material={skinMat} position={[0.038, -0.095, 0.085]} rotation={[0.05, 0.08, 0.12]}>
        <boxGeometry args={[0.065, 0.072, 0.058]} />
      </mesh>
      <mesh material={outlineMat} position={[0.038, -0.095, 0.085]} rotation={[0.05, 0.08, 0.12]}>
        <boxGeometry args={[0.065, 0.072, 0.058]} />
      </mesh>

      {/* Right thumb */}
      <mesh material={skinMat} position={[0.065, -0.072, 0.065]} rotation={[0.18, -0.38, 0.55]}>
        <cylinderGeometry args={[0.012, 0.014, 0.052, 6]} />
      </mesh>

      {/* Right index finger (near trigger) */}
      <mesh material={skinMat} position={[0.010, -0.065, 0.048]} rotation={[0.22, 0.05, -0.08]}>
        <cylinderGeometry args={[0.010, 0.012, 0.046, 6]} />
      </mesh>

      {/* Right middle finger */}
      <mesh material={skinMat} position={[0.010, -0.090, 0.082]} rotation={[0.05, 0.05, -0.05]}>
        <cylinderGeometry args={[0.011, 0.013, 0.050, 6]} />
      </mesh>

      {/* Right ring finger */}
      <mesh material={skinMat} position={[0.010, -0.100, 0.095]} rotation={[0.05, 0.05, -0.05]}>
        <cylinderGeometry args={[0.010, 0.012, 0.046, 6]} />
      </mesh>

      {/* Right pinky */}
      <mesh material={skinMat} position={[0.010, -0.110, 0.106]} rotation={[0.05, 0.05, -0.05]}>
        <cylinderGeometry args={[0.009, 0.011, 0.040, 6]} />
      </mesh>

      {/* ══════════════════════════════════════════════════════════
          LEFT HAND & ARM (pump forend area)
      ══════════════════════════════════════════════════════════ */}

      {/* Left forearm sleeve */}
      <mesh material={sleeveMat} position={[-0.06, -0.14, -0.28]} rotation={[0.45, -0.12, -0.18]}>
        <cylinderGeometry args={[0.036, 0.042, 0.26, 8]} />
      </mesh>
      <mesh material={outlineMat} position={[-0.06, -0.14, -0.28]} rotation={[0.45, -0.12, -0.18]}>
        <cylinderGeometry args={[0.036, 0.042, 0.26, 8]} />
      </mesh>

      {/* Left wrist */}
      <mesh material={skinMat} position={[-0.038, -0.075, -0.195]} rotation={[0.45, -0.12, -0.18]}>
        <cylinderGeometry args={[0.031, 0.035, 0.062, 8]} />
      </mesh>

      {/* Left palm (wrapping pump forend) */}
      <mesh material={skinMat} position={[-0.022, -0.042, -0.195]} rotation={[0.05, -0.08, -0.10]}>
        <boxGeometry args={[0.060, 0.068, 0.055]} />
      </mesh>
      <mesh material={outlineMat} position={[-0.022, -0.042, -0.195]} rotation={[0.05, -0.08, -0.10]}>
        <boxGeometry args={[0.060, 0.068, 0.055]} />
      </mesh>

      {/* Left thumb */}
      <mesh material={skinMat} position={[-0.052, -0.022, -0.178]} rotation={[0.12, 0.32, -0.52]}>
        <cylinderGeometry args={[0.011, 0.013, 0.050, 6]} />
      </mesh>

      {/* Left index finger */}
      <mesh material={skinMat} position={[-0.008, -0.018, -0.218]} rotation={[-0.05, -0.08, 0.06]}>
        <cylinderGeometry args={[0.010, 0.012, 0.046, 6]} />
      </mesh>

      {/* Left middle finger */}
      <mesh material={skinMat} position={[-0.008, -0.038, -0.195]} rotation={[0.05, -0.08, 0.05]}>
        <cylinderGeometry args={[0.011, 0.013, 0.048, 6]} />
      </mesh>

      {/* Left ring finger */}
      <mesh material={skinMat} position={[-0.008, -0.048, -0.182]} rotation={[0.05, -0.08, 0.05]}>
        <cylinderGeometry args={[0.010, 0.012, 0.044, 6]} />
      </mesh>

      {/* Left pinky */}
      <mesh material={skinMat} position={[-0.008, -0.058, -0.170]} rotation={[0.05, -0.08, 0.05]}>
        <cylinderGeometry args={[0.009, 0.011, 0.038, 6]} />
      </mesh>

      <GoldSparkles active={upgradeTier === 3} />
    </group>
  );
}

// ─── Detailed Assault Rifle (Machine Gun) with FPS Hands ─────────────────────
function AssaultRifleModel({ recoilOffset, isReloading, upgradeTier }: {
  recoilOffset: number;
  isReloading: boolean;
  upgradeTier: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Weapon materials
  const receiverMat = useToonMaterial('#3a3a3a');
  const handguardMat = useToonMaterial('#2e2e2e');
  const stockMat = useToonMaterial('#1e1e1e');
  const barrelMat = useToonMaterial('#252525');
  const gripMat = useToonMaterial('#1a1a1a');
  const magMat = useToonMaterial('#222222');
  const railMat = useToonMaterial('#444444');
  const muzzleMat = useToonMaterial('#111111');
  const outlineMat = useOutlineMaterial(0.035);

  // Skin / arm materials
  const skinMat = useToonMaterial('#c68642');
  const sleeveMat = useToonMaterial('#3b4a2f');

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetY = -0.30 - recoilOffset * 0.22;
    const targetZ = -0.55 + recoilOffset * 0.08;
    const reloadBob = isReloading ? Math.sin(Date.now() * 0.006) * 0.045 : 0;
    const reloadTilt = isReloading ? Math.sin(Date.now() * 0.004) * 0.08 : 0;
    groupRef.current.position.y += (targetY + reloadBob - groupRef.current.position.y) * Math.min(delta * 18, 1);
    groupRef.current.position.z += (targetZ - groupRef.current.position.z) * Math.min(delta * 18, 1);
    groupRef.current.rotation.x += (-recoilOffset * 0.22 + reloadTilt - groupRef.current.rotation.x) * Math.min(delta * 18, 1);
    groupRef.current.rotation.z += (reloadTilt * 0.3 - groupRef.current.rotation.z) * Math.min(delta * 10, 1);
  });

  return (
    <group ref={groupRef} position={[0.22, -0.30, -0.55]} rotation={[0, 0.08, 0]}>

      {/* ── RECEIVER (upper + lower) ── */}
      <mesh material={receiverMat} position={[0, 0.025, -0.02]}>
        <boxGeometry args={[0.065, 0.065, 0.38]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, 0.025, -0.02]} args={[0.065, 0.065, 0.38]} />
      <mesh material={outlineMat} position={[0, 0.025, -0.02]}>
        <boxGeometry args={[0.065, 0.065, 0.38]} />
      </mesh>

      <mesh material={handguardMat} position={[0, -0.018, 0.01]}>
        <boxGeometry args={[0.058, 0.045, 0.30]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, -0.018, 0.01]} args={[0.058, 0.045, 0.30]} />

      {/* Ejection port cover */}
      <mesh material={railMat} position={[0.034, 0.02, -0.04]}>
        <boxGeometry args={[0.006, 0.03, 0.08]} />
      </mesh>

      {/* Charging handle */}
      <mesh material={railMat} position={[0, 0.062, -0.06]}>
        <boxGeometry args={[0.018, 0.018, 0.04]} />
      </mesh>
      <mesh material={railMat} position={[0, 0.072, -0.06]}>
        <boxGeometry args={[0.03, 0.01, 0.022]} />
      </mesh>

      {/* ── TOP RAIL (Picatinny) ── */}
      <mesh material={railMat} position={[0, 0.062, -0.02]}>
        <boxGeometry args={[0.04, 0.012, 0.36]} />
      </mesh>
      {[-0.12, -0.06, 0, 0.06, 0.12].map((z, i) => (
        <mesh key={i} material={gripMat} position={[0, 0.069, z]}>
          <boxGeometry args={[0.042, 0.006, 0.008]} />
        </mesh>
      ))}

      {/* ── RED DOT SIGHT ── */}
      <mesh material={railMat} position={[0, 0.082, 0.04]}>
        <boxGeometry args={[0.038, 0.032, 0.055]} />
      </mesh>
      <mesh position={[0, 0.082, 0.015]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.004, 12]} />
        <meshStandardMaterial color="#001133" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.082, 0.015]}>
        <sphereGeometry args={[0.003, 6, 6]} />
        <meshStandardMaterial color="#ff2200" emissive="#ff0000" emissiveIntensity={4} />
      </mesh>

      {/* ── HANDGUARD ── */}
      <mesh material={handguardMat} position={[0, 0.01, -0.22]}>
        <boxGeometry args={[0.068, 0.068, 0.22]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, 0.01, -0.22]} args={[0.068, 0.068, 0.22]} />
      <mesh material={outlineMat} position={[0, 0.01, -0.22]}>
        <boxGeometry args={[0.068, 0.068, 0.22]} />
      </mesh>
      {[-0.18, -0.22, -0.26].map((z, i) => (
        <mesh key={i} material={gripMat} position={[0, -0.026, z]}>
          <boxGeometry args={[0.04, 0.008, 0.018]} />
        </mesh>
      ))}

      {/* ── BARREL ── */}
      <mesh material={barrelMat} position={[0, 0.025, -0.38]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.018, 0.32, 10]} />
      </mesh>
      <GlowOverlayCylinder tier={upgradeTier} position={[0, 0.025, -0.38]} args={[0.016, 0.018, 0.32, 10]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh material={outlineMat} position={[0, 0.025, -0.38]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.018, 0.32, 10]} />
      </mesh>

      {/* Gas tube above barrel */}
      <mesh material={barrelMat} position={[0, 0.048, -0.30]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.20, 6]} />
      </mesh>

      {/* ── MUZZLE BRAKE ── */}
      <mesh material={muzzleMat} position={[0, 0.025, -0.555]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.022, 0.04, 10]} />
      </mesh>
      <mesh material={gripMat} position={[0, 0.038, -0.548]}>
        <boxGeometry args={[0.05, 0.01, 0.012]} />
      </mesh>
      <mesh material={gripMat} position={[0, 0.012, -0.548]}>
        <boxGeometry args={[0.05, 0.01, 0.012]} />
      </mesh>

      {/* ── PISTOL GRIP ── */}
      <mesh material={gripMat} position={[0, -0.075, 0.10]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.055, 0.115, 0.055]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, -0.075, 0.10]} args={[0.055, 0.115, 0.055]} />
      <mesh material={outlineMat} position={[0, -0.075, 0.10]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.055, 0.115, 0.055]} />
      </mesh>
      {[-0.04, -0.01, 0.02].map((y, i) => (
        <mesh key={i} material={receiverMat} position={[0, -0.075 + y, 0.10]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.057, 0.008, 0.057]} />
        </mesh>
      ))}

      {/* Trigger guard */}
      <mesh material={handguardMat} position={[0, -0.048, 0.065]}>
        <boxGeometry args={[0.05, 0.008, 0.07]} />
      </mesh>
      <mesh material={railMat} position={[0, -0.055, 0.055]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.008, 0.025, 0.01]} />
      </mesh>

      {/* ── MAGAZINE ── */}
      <mesh material={magMat} position={[0, -0.095, 0.025]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.048, 0.14, 0.058]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, -0.095, 0.025]} args={[0.048, 0.14, 0.058]} />
      <mesh material={outlineMat} position={[0, -0.095, 0.025]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.048, 0.14, 0.058]} />
      </mesh>
      <mesh material={railMat} position={[0, -0.168, 0.028]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.052, 0.012, 0.062]} />
      </mesh>

      {/* ── STOCK (collapsible-style) ── */}
      <mesh material={stockMat} position={[0, 0.005, 0.215]}>
        <boxGeometry args={[0.055, 0.055, 0.18]} />
      </mesh>
      <GlowOverlay tier={upgradeTier} position={[0, 0.005, 0.215]} args={[0.055, 0.055, 0.18]} />
      <mesh material={outlineMat} position={[0, 0.005, 0.215]}>
        <boxGeometry args={[0.055, 0.055, 0.18]} />
      </mesh>
      <mesh material={receiverMat} position={[0, 0.005, 0.155]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.06, 8]} />
      </mesh>
      <mesh material={stockMat} position={[0, 0.038, 0.24]}>
        <boxGeometry args={[0.055, 0.022, 0.12]} />
      </mesh>
      <mesh material={gripMat} position={[0, 0.005, 0.308]}>
        <boxGeometry args={[0.058, 0.062, 0.016]} />
      </mesh>

      {/* ── BOLT CARRIER GROUP detail ── */}
      <mesh material={railMat} position={[0.034, 0.025, 0.04]}>
        <boxGeometry args={[0.005, 0.02, 0.06]} />
      </mesh>

      {/* ══════════════════════════════════════════════════════════
          RIGHT ARM & HAND (pistol grip area)
      ══════════════════════════════════════════════════════════ */}

      {/* Right forearm (sleeve) */}
      <mesh material={sleeveMat} position={[0.09, -0.19, 0.22]} rotation={[-0.55, 0.15, 0.25]}>
        <cylinderGeometry args={[0.038, 0.044, 0.28, 8]} />
      </mesh>
      <mesh material={outlineMat} position={[0.09, -0.19, 0.22]} rotation={[-0.55, 0.15, 0.25]}>
        <cylinderGeometry args={[0.038, 0.044, 0.28, 8]} />
      </mesh>

      {/* Right wrist (skin) */}
      <mesh material={skinMat} position={[0.065, -0.115, 0.10]} rotation={[-0.55, 0.15, 0.25]}>
        <cylinderGeometry args={[0.033, 0.037, 0.07, 8]} />
      </mesh>

      {/* Right palm wrapping grip */}
      <mesh material={skinMat} position={[0.04, -0.085, 0.095]} rotation={[0.35, 0.1, 0.15]}>
        <boxGeometry args={[0.065, 0.075, 0.06]} />
      </mesh>
      <mesh material={outlineMat} position={[0.04, -0.085, 0.095]} rotation={[0.35, 0.1, 0.15]}>
        <boxGeometry args={[0.065, 0.075, 0.06]} />
      </mesh>

      {/* Right thumb */}
      <mesh material={skinMat} position={[0.068, -0.065, 0.075]} rotation={[0.2, -0.4, 0.6]}>
        <cylinderGeometry args={[0.012, 0.014, 0.055, 6]} />
      </mesh>

      {/* Right index finger (on trigger) */}
      <mesh material={skinMat} position={[0.01, -0.058, 0.058]} rotation={[0.25, 0.05, -0.1]}>
        <cylinderGeometry args={[0.010, 0.012, 0.048, 6]} />
      </mesh>

      {/* Right middle finger */}
      <mesh material={skinMat} position={[0.01, -0.082, 0.098]} rotation={[0.35, 0.05, -0.05]}>
        <cylinderGeometry args={[0.011, 0.013, 0.050, 6]} />
      </mesh>

      {/* Right ring finger */}
      <mesh material={skinMat} position={[0.01, -0.092, 0.110]} rotation={[0.35, 0.05, -0.05]}>
        <cylinderGeometry args={[0.010, 0.012, 0.046, 6]} />
      </mesh>

      {/* Right pinky */}
      <mesh material={skinMat} position={[0.01, -0.102, 0.120]} rotation={[0.35, 0.05, -0.05]}>
        <cylinderGeometry args={[0.009, 0.011, 0.040, 6]} />
      </mesh>

      {/* ══════════════════════════════════════════════════════════
          LEFT ARM & HAND (handguard area)
      ══════════════════════════════════════════════════════════ */}

      {/* Left forearm (sleeve) */}
      <mesh material={sleeveMat} position={[-0.07, -0.12, -0.28]} rotation={[0.48, -0.14, -0.22]}>
        <cylinderGeometry args={[0.036, 0.042, 0.26, 8]} />
      </mesh>
      <mesh material={outlineMat} position={[-0.07, -0.12, -0.28]} rotation={[0.48, -0.14, -0.22]}>
        <cylinderGeometry args={[0.036, 0.042, 0.26, 8]} />
      </mesh>

      {/* Left wrist (skin) */}
      <mesh material={skinMat} position={[-0.045, -0.062, -0.195]} rotation={[0.48, -0.14, -0.22]}>
        <cylinderGeometry args={[0.031, 0.035, 0.062, 8]} />
      </mesh>

      {/* Left palm wrapping handguard */}
      <mesh material={skinMat} position={[-0.025, -0.030, -0.195]} rotation={[0.05, -0.10, -0.12]}>
        <boxGeometry args={[0.062, 0.068, 0.058]} />
      </mesh>
      <mesh material={outlineMat} position={[-0.025, -0.030, -0.195]} rotation={[0.05, -0.10, -0.12]}>
        <boxGeometry args={[0.062, 0.068, 0.058]} />
      </mesh>

      {/* Left thumb */}
      <mesh material={skinMat} position={[-0.055, -0.012, -0.178]} rotation={[0.10, 0.30, -0.50]}>
        <cylinderGeometry args={[0.011, 0.013, 0.050, 6]} />
      </mesh>

      {/* Left index finger */}
      <mesh material={skinMat} position={[-0.008, -0.010, -0.220]} rotation={[-0.05, -0.10, 0.06]}>
        <cylinderGeometry args={[0.010, 0.012, 0.046, 6]} />
      </mesh>

      {/* Left middle finger */}
      <mesh material={skinMat} position={[-0.008, -0.030, -0.198]} rotation={[0.05, -0.10, 0.05]}>
        <cylinderGeometry args={[0.011, 0.013, 0.048, 6]} />
      </mesh>

      {/* Left ring finger */}
      <mesh material={skinMat} position={[-0.008, -0.040, -0.185]} rotation={[0.05, -0.10, 0.05]}>
        <cylinderGeometry args={[0.010, 0.012, 0.044, 6]} />
      </mesh>

      {/* Left pinky */}
      <mesh material={skinMat} position={[-0.008, -0.050, -0.172]} rotation={[0.05, -0.10, 0.05]}>
        <cylinderGeometry args={[0.009, 0.011, 0.038, 6]} />
      </mesh>

      <GoldSparkles active={upgradeTier === 3} />
    </group>
  );
}

export default function WeaponViewModel({ weapon, recoilOffset, isReloading, upgradeTier }: WeaponViewModelProps) {
  return (
    <>
      {weapon === 'pistol' && (
        <PistolModel recoilOffset={recoilOffset} isReloading={isReloading} upgradeTier={upgradeTier} />
      )}
      {weapon === 'shotgun' && (
        <ShotgunModel recoilOffset={recoilOffset} isReloading={isReloading} upgradeTier={upgradeTier} />
      )}
      {weapon === 'assault_rifle' && (
        <AssaultRifleModel recoilOffset={recoilOffset} isReloading={isReloading} upgradeTier={upgradeTier} />
      )}
    </>
  );
}
