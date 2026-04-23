import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export const SPEED_COLA_POSITION = new THREE.Vector3(-10, 0, 5);
export const SPEED_COLA_INTERACT_RANGE = 3.0;

// AABB collision box — machine body is ~1.2w x 0.7d, expanded by player radius 0.4
export const SPEED_COLA_AABB = {
  minX: SPEED_COLA_POSITION.x - 0.6 - 0.4,
  maxX: SPEED_COLA_POSITION.x + 0.6 + 0.4,
  minZ: SPEED_COLA_POSITION.z - 0.35 - 0.4,
  maxZ: SPEED_COLA_POSITION.z + 0.35 + 0.4,
};

// Static geometry helpers — defined once outside the component
const BOTTLE_ANGLES = [0, 1, 2, 3, 4].map((i) => (i / 5) * Math.PI * 2);
const VENT_Y = [0.55, 0.65, 0.75, 0.85, 0.95];
const LED_X = [-0.32, -0.08, 0.16, 0.4];
const BOLT_Y = [-0.7, -0.3, 0.1, 0.5, 0.9];
const SIDE_OFFSETS: [number, number][] = [
  [-0.76, -1],
  [0.76, 1],
];

interface SpeedColaMachineProps {
  onPurchase: () => void;
  isPurchased: boolean;
}

export function SpeedColaMachine({
  onPurchase: _onPurchase,
  isPurchased,
}: SpeedColaMachineProps) {
  const screenRef = useRef<THREE.Mesh>(null);
  const light1Ref = useRef<THREE.Mesh>(null);
  const light2Ref = useRef<THREE.Mesh>(null);
  const pointLight1Ref = useRef<THREE.PointLight>(null);
  const pointLight2Ref = useRef<THREE.PointLight>(null);

  // ── PBR Materials ───────────────────────────────────────────────────────────
  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1a6b1a"),
        roughness: 0.55,
        metalness: 0.45,
      }),
    [],
  );
  const darkBodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0f4a0f"),
        roughness: 0.6,
        metalness: 0.6,
      }),
    [],
  );
  const accentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0a3a0a"),
        roughness: 0.7,
        metalness: 0.5,
      }),
    [],
  );
  const screenFrameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0a1a0a"),
        roughness: 0.85,
        metalness: 0.5,
      }),
    [],
  );
  const screenMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: isPurchased
          ? new THREE.Color("#1a4a1a")
          : new THREE.Color("#00ff55"),
        emissive: isPurchased
          ? new THREE.Color("#0a2a0a")
          : new THREE.Color("#00ff55"),
        emissiveIntensity: isPurchased ? 0.3 : 1.5,
      }),
    [isPurchased],
  );
  const greenLightMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#00ff44"),
        emissive: new THREE.Color("#00ff44"),
        emissiveIntensity: isPurchased ? 0.3 : 2.5,
        transparent: true,
        opacity: 0.9,
      }),
    [isPurchased],
  );
  const coinSlotMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#888800"),
        roughness: 0.4,
        metalness: 0.8,
        emissive: new THREE.Color("#444400"),
        emissiveIntensity: 0.3,
      }),
    [],
  );
  const buttonMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#00cc44"),
        roughness: 0.35,
        metalness: 0.2,
        emissive: new THREE.Color("#004422"),
        emissiveIntensity: 0.6,
      }),
    [],
  );
  const darkMetalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0a1a0a"),
        roughness: 0.6,
        metalness: 0.75,
      }),
    [],
  );
  const bottleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#00aa33"),
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.75,
        emissive: new THREE.Color("#003311"),
        emissiveIntensity: 0.4,
      }),
    [],
  );
  const bottleCapMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#ffcc00"),
        roughness: 0.4,
        metalness: 0.6,
      }),
    [],
  );

  // ── Animation ───────────────────────────────────────────────────────────────
  useFrame(() => {
    if (isPurchased) return;
    const t = Date.now() * 0.001;

    // Alternate green beacons
    const flashOn = Math.sin(t * 3.5) > 0;
    if (light1Ref.current) {
      (
        light1Ref.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = flashOn ? 3.5 : 0.2;
    }
    if (light2Ref.current) {
      (
        light2Ref.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = !flashOn ? 3.5 : 0.2;
    }
    if (pointLight1Ref.current)
      pointLight1Ref.current.intensity = flashOn ? 2.5 : 0;
    if (pointLight2Ref.current)
      pointLight2Ref.current.intensity = !flashOn ? 2.5 : 0;

    // Screen flicker
    if (screenRef.current) {
      const flicker =
        1.5 + Math.sin(t * 12.7) * 0.15 + Math.sin(t * 5.3) * 0.08;
      (
        screenRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = flicker;
    }
  });

  const px = SPEED_COLA_POSITION.x;
  const pz = SPEED_COLA_POSITION.z;

  return (
    <group position={[px, 0, pz]} frustumCulled={false}>
      {/* Point lights from beacon lamps */}
      <pointLight
        ref={pointLight1Ref}
        position={[-0.4, 2.3, 0]}
        intensity={2.5}
        distance={10}
        color="#00ff44"
      />
      <pointLight
        ref={pointLight2Ref}
        position={[0.4, 2.3, 0]}
        intensity={0}
        distance={10}
        color="#00ff44"
      />

      {/* ── Main cabinet body ─────────────────────────────── */}
      <mesh
        material={bodyMat}
        position={[0, 1.1, 0]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1.5, 2.2, 0.7]} />
      </mesh>

      {/* Top cap */}
      <mesh
        material={darkBodyMat}
        position={[0, 2.15, 0]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1.62, 0.1, 0.82]} />
      </mesh>
      {/* Base plinth */}
      <mesh
        material={darkBodyMat}
        position={[0, 0.05, 0]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1.72, 0.12, 0.92]} />
      </mesh>

      {/* ── Front branding display screen ─────────────────── */}
      <mesh
        material={screenFrameMat}
        position={[0, 1.6, 0.36]}
        frustumCulled={false}
      >
        <boxGeometry args={[1.2, 0.9, 0.02]} />
      </mesh>
      <mesh
        ref={screenRef}
        material={screenMat}
        position={[0, 1.6, 0.37]}
        frustumCulled={false}
      >
        <boxGeometry args={[1.1, 0.8, 0.01]} />
      </mesh>

      {/* ── Brand name text block (raised slab on glass) ──── */}
      <mesh
        material={
          new THREE.MeshStandardMaterial({
            color: new THREE.Color("#ffffff"),
            emissive: new THREE.Color("#aaffaa"),
            emissiveIntensity: isPurchased ? 0.2 : 1.0,
          })
        }
        position={[0, 1.7, 0.378]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.9, 0.22, 0.005]} />
      </mesh>
      {/* "SPEED" label slab */}
      <mesh
        material={
          new THREE.MeshStandardMaterial({
            color: new THREE.Color("#00ff55"),
            emissive: new THREE.Color("#00ff55"),
            emissiveIntensity: isPurchased ? 0.1 : 0.8,
          })
        }
        position={[0, 1.52, 0.378]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.65, 0.14, 0.005]} />
      </mesh>

      {/* ── Bottle window (lower front display) ──────────── */}
      <mesh
        material={screenFrameMat}
        position={[0, 0.88, 0.36]}
        frustumCulled={false}
      >
        <boxGeometry args={[1.1, 0.6, 0.02]} />
      </mesh>
      <mesh
        material={bottleMat}
        position={[0, 0.88, 0.37]}
        frustumCulled={false}
      >
        <boxGeometry args={[1.0, 0.5, 0.01]} />
      </mesh>

      {/* Decorative bottles behind glass */}
      {BOTTLE_ANGLES.slice(0, 4).map((_angle, i) => {
        const bx = -0.42 + i * 0.28;
        const bottleKey = `bottle-${bx}`;
        return (
          <group
            key={bottleKey}
            position={[bx, 0.88, 0.3]}
            frustumCulled={false}
          >
            {/* Bottle body */}
            <mesh material={bottleMat} frustumCulled={false}>
              <cylinderGeometry args={[0.06, 0.06, 0.3, 8]} />
            </mesh>
            {/* Bottle neck */}
            <mesh
              material={bottleMat}
              position={[0, 0.22, 0]}
              frustumCulled={false}
            >
              <cylinderGeometry args={[0.03, 0.06, 0.1, 8]} />
            </mesh>
            {/* Cap */}
            <mesh
              material={bottleCapMat}
              position={[0, 0.28, 0]}
              frustumCulled={false}
            >
              <cylinderGeometry args={[0.04, 0.04, 0.04, 8]} />
            </mesh>
          </group>
        );
      })}

      {/* ── Control panel ─────────────────────────────────── */}
      <mesh
        material={accentMat}
        position={[0, 0.52, 0.36]}
        frustumCulled={false}
      >
        <boxGeometry args={[1.2, 0.3, 0.025]} />
      </mesh>

      {/* LED status lights */}
      {LED_X.map((x, idx) => (
        <mesh key={x} position={[x, 0.53, 0.38]} frustumCulled={false}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial
            color={idx % 2 === 0 ? "#00ff44" : "#88ff00"}
            emissive={idx % 2 === 0 ? "#00ff44" : "#88ff00"}
            emissiveIntensity={isPurchased ? 0.3 : 1.4}
          />
        </mesh>
      ))}

      {/* Coin slot */}
      <mesh
        material={coinSlotMat}
        position={[0.35, 0.52, 0.385]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.07, 0.02, 0.01]} />
      </mesh>
      <mesh
        material={accentMat}
        position={[0.35, 0.52, 0.39]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.11, 0.06, 0.01]} />
      </mesh>

      {/* Purchase button */}
      <mesh
        material={buttonMat}
        position={[-0.35, 0.52, 0.39]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.06, 0.07, 0.04, 12]} />
      </mesh>
      <mesh
        material={darkMetalMat}
        position={[-0.35, 0.48, 0.385]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.09, 0.09, 0.03, 12]} />
      </mesh>

      {/* ── Ventilation grilles ───────────────────────────── */}
      {VENT_Y.map((y) => (
        <mesh
          key={y}
          material={darkMetalMat}
          position={[0.55, y, 0.355]}
          frustumCulled={false}
        >
          <boxGeometry args={[0.3, 0.016, 0.02]} />
        </mesh>
      ))}

      {/* ── Beacon warning lights ─────────────────────────── */}
      <mesh
        ref={light1Ref}
        material={greenLightMat}
        position={[-0.4, 2.22, 0]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      <mesh
        material={darkMetalMat}
        position={[-0.4, 2.15, 0]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.07, 0.09, 0.1, 8]} />
      </mesh>

      <mesh
        ref={light2Ref}
        material={greenLightMat}
        position={[0.4, 2.22, 0]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      <mesh
        material={darkMetalMat}
        position={[0.4, 2.15, 0]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.07, 0.09, 0.1, 8]} />
      </mesh>

      {/* ── Side panels with bolts ────────────────────────── */}
      {SIDE_OFFSETS.map(([sx, side]) => (
        <group key={sx}>
          <mesh
            material={darkBodyMat}
            position={[sx, 1.1, 0]}
            frustumCulled={false}
          >
            <boxGeometry args={[0.04, 2.0, 0.68]} />
          </mesh>
          {BOLT_Y.map((by) => (
            <mesh
              key={by}
              material={bodyMat}
              position={[sx + side * 0.01, by, 0.25]}
              frustumCulled={false}
            >
              <sphereGeometry args={[0.02, 6, 4]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── Decorative cola can on top ────────────────────── */}
      <mesh material={bodyMat} position={[0, 2.32, 0]} frustumCulled={false}>
        <cylinderGeometry args={[0.12, 0.12, 0.24, 12]} />
      </mesh>
      <mesh
        material={bottleCapMat}
        position={[0, 2.46, 0]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.08, 0.12, 0.06, 12]} />
      </mesh>

      {/* ── Green ambient glow beneath machine ─────────────── */}
      {!isPurchased && (
        <pointLight
          position={[0, 0.1, 0]}
          intensity={0.6}
          distance={4}
          color="#00ff44"
        />
      )}
    </group>
  );
}
