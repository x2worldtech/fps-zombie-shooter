import { useMemo } from 'react';
import * as THREE from 'three';
import { sandVertexShader, sandFragmentShader } from '../../shaders/sandShader';
import { skyVertexShader, skyFragmentShader } from '../../shaders/skyShader';
import { generateBuildingData, BuildingData, PALM_TREE_POSITIONS, JUGGERNOG_POSITION } from '../../utils/proceduralGeometry';
import { useToonMaterial, useOutlineMaterial } from './ToonMaterial';
import { PackAPunchMachine } from './PackAPunchMachine';
import { MountainBarrier } from './MountainBarrier';
import { PalmTree } from './PalmTree';
import JuggernogMachine from './JuggernogMachine';

interface DesertEnvironmentProps {
  upgradeTier?: number;
  juggernogPurchaseCount?: number;
}

// ─── Realistic intact building ───────────────────────────────────────────────
function IntactBuilding({ position, width, height, depth, color }: {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  color: string;
}) {
  const wallMat = useToonMaterial(color);
  const outlineMat = useOutlineMaterial(0.1);
  // Slightly darker shade for window recesses and trim
  const trimColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.65);
    return '#' + c.getHexString();
  }, [color]);
  const trimMat = useToonMaterial(trimColor);
  // Dark window glass
  const windowMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.05, 0.08, 0.15),
    roughness: 0.1,
    metalness: 0.6,
    emissive: new THREE.Color(0.02, 0.04, 0.08),
    emissiveIntensity: 0.5,
  }), []);

  // Parapet height on top
  const parapetH = 0.4;
  // Number of window rows/columns based on building size
  const windowCols = Math.max(1, Math.floor(width / 2.5));
  const windowRows = Math.max(1, Math.floor(height / 3.5));
  const windowW = 0.55;
  const windowH = 0.75;
  const windowDepth = 0.08;

  // Generate window positions on front face (z = depth/2)
  const windows = useMemo(() => {
    const wins: { x: number; y: number }[] = [];
    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        const x = (col - (windowCols - 1) / 2) * (width / windowCols);
        const y = (row + 0.5) * (height / (windowRows + 0.5)) - height / 2 + 0.5;
        wins.push({ x, y });
      }
    }
    return wins;
  }, [windowCols, windowRows, width, height]);

  return (
    <group position={position}>
      {/* Main body */}
      <mesh material={wallMat} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      <mesh material={outlineMat}>
        <boxGeometry args={[width + 0.05, height + 0.05, depth + 0.05]} />
      </mesh>

      {/* Parapet / roofline ledge */}
      <mesh material={trimMat} position={[0, height / 2 + parapetH / 2, 0]} castShadow>
        <boxGeometry args={[width + 0.3, parapetH, depth + 0.3]} />
      </mesh>
      <mesh material={outlineMat} position={[0, height / 2 + parapetH / 2, 0]}>
        <boxGeometry args={[width + 0.35, parapetH + 0.05, depth + 0.35]} />
      </mesh>

      {/* Roof slab */}
      <mesh material={trimMat} position={[0, height / 2 + parapetH + 0.08, 0]}>
        <boxGeometry args={[width + 0.1, 0.16, depth + 0.1]} />
      </mesh>

      {/* Horizontal floor-band trim (every ~3 units of height) */}
      {Array.from({ length: Math.floor(height / 3) }).map((_, i) => (
        <mesh
          key={`band-${i}`}
          material={trimMat}
          position={[0, -height / 2 + (i + 1) * (height / (Math.floor(height / 3) + 1)), 0]}
        >
          <boxGeometry args={[width + 0.15, 0.12, depth + 0.15]} />
        </mesh>
      ))}

      {/* Corner pilasters (vertical strips on corners) */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={`pilaster-${i}`} material={trimMat}
          position={[sx * (width / 2 + 0.06), 0, sz * (depth / 2 + 0.06)]}
          castShadow
        >
          <boxGeometry args={[0.22, height + parapetH * 2, 0.22]} />
        </mesh>
      ))}

      {/* Windows on front face */}
      {windows.map((w, i) => (
        <group key={`win-front-${i}`} position={[w.x, w.y, depth / 2 + 0.01]}>
          {/* Window recess frame */}
          <mesh material={trimMat}>
            <boxGeometry args={[windowW + 0.14, windowH + 0.14, windowDepth + 0.02]} />
          </mesh>
          {/* Window glass */}
          <mesh material={windowMat} position={[0, 0, 0.02]}>
            <boxGeometry args={[windowW, windowH, windowDepth]} />
          </mesh>
        </group>
      ))}

      {/* Windows on back face */}
      {windows.map((w, i) => (
        <group key={`win-back-${i}`} position={[w.x, w.y, -(depth / 2 + 0.01)]}>
          <mesh material={trimMat}>
            <boxGeometry args={[windowW + 0.14, windowH + 0.14, windowDepth + 0.02]} />
          </mesh>
          <mesh material={windowMat} position={[0, 0, -0.02]}>
            <boxGeometry args={[windowW, windowH, windowDepth]} />
          </mesh>
        </group>
      ))}

      {/* Door opening on front face (ground floor) */}
      <mesh material={trimMat} position={[0, -height / 2 + 1.1, depth / 2 + 0.01]}>
        <boxGeometry args={[1.0, 2.2, 0.1]} />
      </mesh>
      <mesh
        position={[0, -height / 2 + 1.1, depth / 2 + 0.06]}
      >
        <boxGeometry args={[0.8, 2.0, 0.08]} />
        <meshStandardMaterial color={new THREE.Color(0.04, 0.03, 0.02)} roughness={0.9} />
      </mesh>
    </group>
  );
}

// ─── Ruined / damaged building ────────────────────────────────────────────────
function RuinedBuilding({ position, width, height, depth, color }: {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  color: string;
}) {
  const wallMat = useToonMaterial(color);
  const outlineMat = useOutlineMaterial(0.1);
  const darkColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.55);
    return '#' + c.getHexString();
  }, [color]);
  const darkMat = useToonMaterial(darkColor);
  const rubbleMat = useToonMaterial('#7a6040');

  // Broken top — irregular heights for wall sections
  const wallSections = useMemo(() => [
    { xOff: -width * 0.25, hMult: 0.9, wFrac: 0.45 },
    { xOff: width * 0.25, hMult: 0.6, wFrac: 0.45 },
  ], [width]);

  return (
    <group position={position}>
      {/* Base slab */}
      <mesh material={wallMat} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      <mesh material={outlineMat}>
        <boxGeometry args={[width + 0.05, height + 0.05, depth + 0.05]} />
      </mesh>

      {/* Broken wall sections rising above main body */}
      {wallSections.map((s, i) => (
        <mesh
          key={`wall-${i}`}
          material={i % 2 === 0 ? wallMat : darkMat}
          position={[s.xOff, height / 2 + (height * s.hMult * 0.25), 0]}
          castShadow
        >
          <boxGeometry args={[width * s.wFrac, height * s.hMult * 0.5, depth * 0.9]} />
        </mesh>
      ))}

      {/* Exposed interior dark fill */}
      <mesh material={darkMat} position={[0, height * 0.1, 0]}>
        <boxGeometry args={[width * 0.7, height * 0.6, depth * 0.7]} />
      </mesh>

      {/* Crumbled rubble at base */}
      {[-1, 0, 1].map((xi, i) => (
        <mesh
          key={`rubble-${i}`}
          material={rubbleMat}
          position={[xi * width * 0.3, -height / 2 + 0.25, depth / 2 + 0.3 + i * 0.2]}
          scale={[0.6 + i * 0.15, 0.4, 0.5 + i * 0.1]}
        >
          <icosahedronGeometry args={[0.5, 0]} />
        </mesh>
      ))}

      {/* Cracked window openings */}
      {[{ x: -width * 0.2, y: height * 0.1 }, { x: width * 0.2, y: -height * 0.05 }].map((w, i) => (
        <mesh key={`crack-${i}`} position={[w.x, w.y, depth / 2 + 0.02]}>
          <boxGeometry args={[0.7, 0.9, 0.12]} />
          <meshStandardMaterial color={new THREE.Color(0.03, 0.02, 0.01)} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Concrete barrier ─────────────────────────────────────────────────────────
function Barrier({ position, width, height, depth }: {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
}) {
  const concreteMat = useToonMaterial('#9e9080');
  const darkMat = useToonMaterial('#6b5f52');
  const outlineMat = useOutlineMaterial(0.07);

  return (
    <group position={position}>
      {/* Main barrier body */}
      <mesh material={concreteMat} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      <mesh material={outlineMat}>
        <boxGeometry args={[width + 0.04, height + 0.04, depth + 0.04]} />
      </mesh>
      {/* Top bevel */}
      <mesh material={darkMat} position={[0, height / 2 - 0.08, 0]}>
        <boxGeometry args={[width - 0.1, 0.16, depth - 0.1]} />
      </mesh>
      {/* Horizontal groove */}
      <mesh material={darkMat} position={[0, 0, depth / 2 + 0.01]}>
        <boxGeometry args={[width - 0.05, 0.08, 0.04]} />
      </mesh>
    </group>
  );
}

// ─── Rubble pile ──────────────────────────────────────────────────────────────
function RubblePile({ position }: { position: [number, number, number] }) {
  const toonMat = useToonMaterial('#7a6040');
  const darkMat = useToonMaterial('#5a4530');
  const outlineMat = useOutlineMaterial(0.06);

  return (
    <group position={position}>
      {[0, 1, 2, 3].map(i => (
        <group key={i} position={[
          (i - 1.5) * 0.55 + Math.sin(i * 2.1) * 0.25,
          i * 0.12,
          Math.cos(i * 1.7) * 0.35
        ]}>
          <mesh
            material={i % 2 === 0 ? toonMat : darkMat}
            scale={[0.45 + i * 0.18, 0.35 + i * 0.08, 0.45 + i * 0.12]}
          >
            <icosahedronGeometry args={[0.6, 0]} />
          </mesh>
          <mesh
            material={outlineMat}
            scale={[0.45 + i * 0.18, 0.35 + i * 0.08, 0.45 + i * 0.12]}
          >
            <icosahedronGeometry args={[0.6, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SandGround() {
  const sandMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: sandVertexShader,
    fragmentShader: sandFragmentShader,
    side: THREE.FrontSide,
  }), []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[300, 300, 64, 64]} />
      <primitive object={sandMaterial} attach="material" />
    </mesh>
  );
}

function SkyDome() {
  const skyMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
  }), []);

  return (
    <mesh>
      <sphereGeometry args={[250, 32, 16]} />
      <primitive object={skyMaterial} attach="material" />
    </mesh>
  );
}

// ─── Dispatcher: pick the right building component by type ───────────────────
function BuildingDispatcher({ b }: { b: BuildingData }) {
  const [bx, by, bz] = b.position;
  const pos: [number, number, number] = [bx, by, bz];

  if (b.type === 'building') {
    return (
      <IntactBuilding
        position={pos}
        width={b.width}
        height={b.height}
        depth={b.depth}
        color={b.color}
      />
    );
  }
  if (b.type === 'ruin') {
    return (
      <RuinedBuilding
        position={pos}
        width={b.width}
        height={b.height}
        depth={b.depth}
        color={b.color}
      />
    );
  }
  if (b.type === 'barrier') {
    return (
      <Barrier
        position={pos}
        width={b.width}
        height={b.height}
        depth={b.depth}
      />
    );
  }
  // rubble
  return <RubblePile position={[bx, 0, bz]} />;
}

export function DesertEnvironment({ upgradeTier = 0, juggernogPurchaseCount = 0 }: DesertEnvironmentProps) {
  const buildings = useMemo(() => generateBuildingData(), []);

  // Decorative rubble positions (no collision needed — purely cosmetic)
  const rubblePositions = useMemo<[number, number, number][]>(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.3;
      const r = 6 + Math.sin(i * 1.3) * 3 + i * 0.8;
      positions.push([Math.cos(angle) * r, 0, Math.sin(angle) * r]);
    }
    return positions;
  }, []);

  return (
    <group>
      <SkyDome />
      <SandGround />

      {buildings.map((b, i) => (
        <BuildingDispatcher key={i} b={b} />
      ))}

      {rubblePositions.map((pos, i) => (
        <RubblePile key={`deco-${i}`} position={pos} />
      ))}

      {/* 10 large realistic palm trees scattered across the map */}
      {PALM_TREE_POSITIONS.map((pos, i) => (
        <PalmTree key={`palm-${i}`} position={pos} seed={i * 137 + 42} />
      ))}

      {/* Pack-a-Punch Machine */}
      <PackAPunchMachine upgradeTier={upgradeTier} />

      {/* Juggernog Machine — placed at validated outdoor position */}
      <JuggernogMachine position={JUGGERNOG_POSITION} purchaseCount={juggernogPurchaseCount} />

      {/* Mountain ring barrier surrounding the map perimeter */}
      <MountainBarrier />

      {/* Ambient + directional light */}
      <ambientLight intensity={0.4} color="#ff9944" />
      <directionalLight
        position={[50, 80, 30]}
        intensity={1.2}
        color="#ffcc88"
        castShadow
      />
      <hemisphereLight args={['#ff8833', '#442200', 0.3]} />
    </group>
  );
}
