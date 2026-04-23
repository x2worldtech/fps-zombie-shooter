import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export const NUCLEAR_MACHINE_POSITION: [number, number, number] = [8, 0, 0];

// Static geometry data — defined once, not inside render
const STRIPE_INDICES = [0, 1, 2, 3, 4];
const BLADE_ANGLES = [0, 1, 2].map((i) => (i / 3) * Math.PI * 2 + Math.PI / 6);
const LED_X = [-0.35, -0.1, 0.15, 0.4];
const VENT_Y = [0.35, 0.45, 0.55, 0.65, 0.75, 0.85];
const SIDE_X: [number, number][] = [
  [-0.76, 0],
  [0.76, 1],
];
const BOLT_Y = [-0.7, -0.3, 0.1, 0.5, 0.9];

interface NuclearMachineProps {
  position: [number, number, number];
  onActivate: () => void;
  playerPosRef: React.MutableRefObject<[number, number, number]>;
  isActivated?: boolean;
}

export function NuclearMachine({
  position,
  onActivate: _onActivate,
  playerPosRef: _playerPosRef,
  isActivated = false,
}: NuclearMachineProps) {
  const [isUsed, setIsUsed] = useState(false);
  const [showLaunchText, setShowLaunchText] = useState(false);

  const warningLightRef1 = useRef<THREE.Mesh>(null);
  const warningLightRef2 = useRef<THREE.Mesh>(null);
  const screenRef = useRef<THREE.Mesh>(null);
  const warningLightPointRef1 = useRef<THREE.PointLight>(null);
  const warningLightPointRef2 = useRef<THREE.PointLight>(null);
  const isUsedRef = useRef(false);

  // Sync isActivated prop → visual activated state
  useEffect(() => {
    if (isActivated && !isUsedRef.current) {
      isUsedRef.current = true;
      setIsUsed(true);
      setShowLaunchText(true);
    }
  }, [isActivated]);

  // ── Materials ──────────────────────────────────────────────────────────────
  const cabinetMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#2d3a1e"),
        roughness: 0.75,
        metalness: 0.4,
      }),
    [],
  );
  const darkMetalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1a2010"),
        roughness: 0.6,
        metalness: 0.7,
      }),
    [],
  );
  const warningStripeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#f5c300"),
        roughness: 0.5,
        metalness: 0.1,
        emissive: new THREE.Color("#f5c300"),
        emissiveIntensity: 0.2,
      }),
    [],
  );
  const darkStripeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#111111"),
        roughness: 0.8,
        metalness: 0.2,
      }),
    [],
  );
  const redButtonMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#cc0000"),
        roughness: 0.4,
        metalness: 0.2,
        emissive: new THREE.Color("#440000"),
        emissiveIntensity: 0.5,
      }),
    [],
  );
  const flipCoverMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#880000"),
        roughness: 0.5,
        metalness: 0.3,
      }),
    [],
  );
  const screenMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#00ff44"),
        emissive: new THREE.Color("#00ff44"),
        emissiveIntensity: showLaunchText ? 3.0 : 1.2,
      }),
    [showLaunchText],
  );
  const screenFrameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#111111"),
        roughness: 0.9,
        metalness: 0.5,
      }),
    [],
  );
  const warningLightMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#ffaa00"),
        emissive: new THREE.Color("#ffaa00"),
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  );
  const radiationSignMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#f5c300"),
        emissive: new THREE.Color("#f5c300"),
        emissiveIntensity: 0.3,
        roughness: 0.6,
      }),
    [],
  );
  const grayPanelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3a4530"),
        roughness: 0.7,
        metalness: 0.5,
      }),
    [],
  );

  useFrame(() => {
    const t = Date.now() * 0.001;
    const flashOn = Math.sin(t * 4) > 0;
    if (warningLightRef1.current) {
      (
        warningLightRef1.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = flashOn ? 3.5 : 0.2;
    }
    if (warningLightRef2.current) {
      (
        warningLightRef2.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = !flashOn ? 3.5 : 0.2;
    }
    if (warningLightPointRef1.current)
      warningLightPointRef1.current.intensity = flashOn ? 2.5 : 0;
    if (warningLightPointRef2.current)
      warningLightPointRef2.current.intensity = !flashOn ? 2.5 : 0;
    if (screenRef.current && !isUsedRef.current) {
      const flicker =
        (showLaunchText ? 2.5 : 1.0) +
        Math.sin(t * 11.3) * 0.15 +
        Math.sin(t * 7.1) * 0.1;
      (
        screenRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = flicker;
    }
  });

  const [px, , pz] = position;

  return (
    <group position={[px, 0, pz]}>
      {/* Point lights from warning lamps */}
      <pointLight
        ref={warningLightPointRef1}
        position={[-0.4, 2.3, 0]}
        intensity={2.5}
        distance={10}
        color="#ffaa00"
      />
      <pointLight
        ref={warningLightPointRef2}
        position={[0.4, 2.3, 0]}
        intensity={0}
        distance={10}
        color="#ffaa00"
      />

      {/* Main cabinet body */}
      <mesh
        material={cabinetMat}
        position={[0, 1.0, 0]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1.5, 2.0, 0.8]} />
      </mesh>
      <mesh
        material={darkMetalMat}
        position={[0, 2.05, 0]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1.6, 0.1, 0.9]} />
      </mesh>
      <mesh
        material={darkMetalMat}
        position={[0, 0.05, 0]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1.7, 0.1, 1.0]} />
      </mesh>

      {/* Warning stripes front */}
      {STRIPE_INDICES.map((i) => (
        <mesh
          key={`sf${i}`}
          material={i % 2 === 0 ? warningStripeMat : darkStripeMat}
          position={[-0.6 + i * 0.3, 0.22, 0.41]}
          rotation={[0, 0, Math.PI / 4]}
          frustumCulled={false}
        >
          <boxGeometry args={[0.08, 0.8, 0.015]} />
        </mesh>
      ))}

      {/* Warning stripes top */}
      {STRIPE_INDICES.map((i) => (
        <mesh
          key={`st${i}`}
          material={i % 2 === 0 ? warningStripeMat : darkStripeMat}
          position={[-0.6 + i * 0.3, 1.85, 0.41]}
          rotation={[0, 0, -Math.PI / 4]}
          frustumCulled={false}
        >
          <boxGeometry args={[0.08, 0.8, 0.015]} />
        </mesh>
      ))}

      {/* Radiation symbol */}
      <mesh
        material={radiationSignMat}
        position={[-0.5, 1.5, 0.405]}
        frustumCulled={false}
      >
        <circleGeometry args={[0.18, 12]} />
      </mesh>
      <mesh
        material={cabinetMat}
        position={[-0.5, 1.5, 0.41]}
        frustumCulled={false}
      >
        <circleGeometry args={[0.09, 12]} />
      </mesh>
      {BLADE_ANGLES.map((angle) => (
        <mesh
          key={angle}
          material={radiationSignMat}
          position={[-0.5, 1.5, 0.412]}
          rotation={[0, 0, angle]}
          frustumCulled={false}
        >
          <boxGeometry args={[0.05, 0.14, 0.01]} />
        </mesh>
      ))}

      {/* Countdown display screen */}
      <mesh
        material={screenFrameMat}
        position={[0.25, 1.45, 0.405]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.65, 0.45, 0.02]} />
      </mesh>
      <mesh
        ref={screenRef}
        material={screenMat}
        position={[0.25, 1.45, 0.415]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.55, 0.35, 0.01]} />
      </mesh>

      {/* Control panel */}
      <mesh
        material={grayPanelMat}
        position={[0, 0.9, 0.41]}
        frustumCulled={false}
      >
        <boxGeometry args={[1.2, 0.5, 0.02]} />
      </mesh>

      {/* LED indicator lights */}
      {LED_X.map((x, idx) => (
        <mesh key={x} position={[x, 0.92, 0.425]} frustumCulled={false}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial
            color={idx % 2 === 0 ? "#00ff00" : "#ff4400"}
            emissive={idx % 2 === 0 ? "#00ff00" : "#ff4400"}
            emissiveIntensity={1.2}
          />
        </mesh>
      ))}

      {/* Flip cover */}
      <mesh
        material={flipCoverMat}
        position={[0, 0.62, 0.43]}
        rotation={[isUsed ? -Math.PI / 2.5 : 0, 0, 0]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.22, 0.08, 0.18]} />
      </mesh>

      {/* Red launch button */}
      <mesh
        material={redButtonMat}
        position={[0, 0.62, 0.44]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.07, 0.08, 0.06, 12]} />
      </mesh>
      <mesh
        material={darkMetalMat}
        position={[0, 0.58, 0.43]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.1, 0.1, 0.04, 12]} />
      </mesh>

      {/* Ventilation grill */}
      {VENT_Y.map((y) => (
        <mesh
          key={y}
          material={darkMetalMat}
          position={[0.55, y, 0.41]}
          frustumCulled={false}
        >
          <boxGeometry args={[0.3, 0.018, 0.02]} />
        </mesh>
      ))}

      {/* Warning light beacons */}
      <mesh
        ref={warningLightRef1}
        material={warningLightMat}
        position={[-0.4, 2.18, 0]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      <mesh
        material={darkMetalMat}
        position={[-0.4, 2.12, 0]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.07, 0.09, 0.1, 8]} />
      </mesh>
      <mesh
        ref={warningLightRef2}
        material={warningLightMat}
        position={[0.4, 2.18, 0]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      <mesh
        material={darkMetalMat}
        position={[0.4, 2.12, 0]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.07, 0.09, 0.1, 8]} />
      </mesh>

      {/* Side panels */}
      {SIDE_X.map(([sx, si]) => (
        <group key={sx}>
          <mesh
            material={darkMetalMat}
            position={[sx, 1.0, 0]}
            frustumCulled={false}
          >
            <boxGeometry args={[0.04, 1.8, 0.78]} />
          </mesh>
          {BOLT_Y.map((by) => (
            <mesh
              key={by}
              material={cabinetMat}
              position={[sx + (si === 0 ? -0.01 : 0.01), by, 0.3]}
              frustumCulled={false}
            >
              <sphereGeometry args={[0.02, 6, 4]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
