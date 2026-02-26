import { useMemo } from 'react';
import * as THREE from 'three';

interface PalmTreeProps {
  position: [number, number, number];
  seed?: number;
}

// Seeded RNG for deterministic per-tree variation
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Creates a tapered trunk geometry: wider at base, narrower at top.
 * The trunk bottom is at y=0, top at y=trunkHeight.
 * Uses a CylinderGeometry with different top/bottom radii and vertex displacement
 * for a natural, slightly curved look.
 */
function createTrunkGeometry(
  trunkHeight: number,
  baseRadius: number,
  topRadius: number,
  seed: number
): THREE.BufferGeometry {
  const rng = seededRng(seed);
  // 8 radial segments, 10 height segments for smooth taper and curvature
  const geo = new THREE.CylinderGeometry(topRadius, baseRadius, trunkHeight, 8, 10, false);
  const positions = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    // Normalized height 0=base, 1=top
    const t = (y + trunkHeight / 2) / trunkHeight;

    // Slight horizontal sway — palms lean naturally
    const swayX = Math.sin(t * Math.PI) * 0.3 * (rng() - 0.3);
    const swayZ = Math.sin(t * Math.PI) * 0.2 * (rng() - 0.3);

    // Ring-like bumps on the trunk surface (characteristic palm texture)
    const ringBump = Math.sin(t * Math.PI * 14) * 0.04 * (1 - t * 0.5);

    // Radial direction
    const len = Math.sqrt(x * x + z * z);
    if (len > 0.001) {
      const nx = x / len;
      const nz = z / len;
      positions.setXYZ(
        i,
        x + nx * ringBump + swayX,
        y,
        z + nz * ringBump + swayZ
      );
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a single palm frond as a flat, elongated shape that curves downward.
 * The frond originates at the origin (top of trunk) and extends outward + droops.
 */
function createFrondGeometry(
  length: number,
  width: number,
  droop: number,
  seed: number
): THREE.BufferGeometry {
  const rng = seededRng(seed);
  // Build frond as a series of quads along its length
  const segments = 12;
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Frond extends along +Z axis, droops downward with a curve
    const z = t * length;
    // Droop: parabolic curve, more droop toward tip
    const y = -droop * t * t;
    // Width tapers from base to tip
    const w = width * (1 - t * 0.75) * (0.5 + rng() * 0.15);
    // Slight lateral wave for realism
    const wave = Math.sin(t * Math.PI * 3) * 0.08 * length;

    // Left vertex
    vertices.push(-w, y + wave * 0.3, z);
    normals.push(0, 1, 0);
    uvs.push(0, t);

    // Right vertex
    vertices.push(w, y - wave * 0.3, z);
    normals.push(0, 1, 0);
    uvs.push(1, t);
  }

  // Build quad indices
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = i * 2 + 2;
    const d = i * 2 + 3;
    indices.push(a, b, c);
    indices.push(b, d, c);
    // Back face
    indices.push(c, b, a);
    indices.push(c, d, b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a coconut cluster geometry (small sphere group at crown).
 */
function CoconutCluster({ trunkHeight }: { trunkHeight: number }) {
  const coconutMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3d2b1a'),
    roughness: 0.9,
    metalness: 0.0,
    flatShading: false,
  }), []);

  const offsets: [number, number, number][] = [
    [0.3, 0, 0.2],
    [-0.25, 0, 0.3],
    [0.1, 0.15, -0.3],
    [-0.2, 0.1, -0.1],
  ];

  return (
    <group position={[0, trunkHeight, 0]}>
      {offsets.map((off, i) => (
        <mesh key={i} material={coconutMat} position={off} castShadow>
          <sphereGeometry args={[0.22, 6, 5]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A single palm frond rendered at a given angle around the crown.
 */
function PalmFrond({
  trunkHeight,
  angle,
  length,
  width,
  droop,
  tiltUp,
  seed,
}: {
  trunkHeight: number;
  angle: number;
  length: number;
  width: number;
  droop: number;
  tiltUp: number;
  seed: number;
}) {
  const frondGeo = useMemo(
    () => createFrondGeometry(length, width, droop, seed),
    [length, width, droop, seed]
  );

  // Deep green frond material with slight variation
  const frondMat = useMemo(() => {
    const rng = seededRng(seed + 100);
    const greenVariation = 0.85 + rng() * 0.3;
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.08 * greenVariation, 0.28 * greenVariation, 0.06 * greenVariation),
      roughness: 0.75,
      metalness: 0.0,
      side: THREE.DoubleSide,
      flatShading: false,
    });
  }, [seed]);

  // Frond midrib (spine) — thin dark green cylinder along the frond
  const midribMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.05, 0.18, 0.04),
    roughness: 0.8,
    metalness: 0.0,
  }), []);

  return (
    <group
      position={[0, trunkHeight, 0]}
      rotation={[0, angle, 0]}
    >
      {/* Tilt the frond upward from horizontal then let it droop */}
      <group rotation={[-tiltUp, 0, 0]}>
        {/* Frond blade */}
        <mesh geometry={frondGeo} material={frondMat} castShadow />
        {/* Midrib spine */}
        <mesh material={midribMat} position={[0, 0, length * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.07, length * 0.9, 4, 1]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Realistic palm tree component.
 * - Trunk base is at y=0 (ground level), top at y=trunkHeight
 * - 7–8 large fronds fan out from the crown
 * - Coconut cluster at the crown
 */
export function PalmTree({ position, seed = 0 }: PalmTreeProps) {
  const rng = useMemo(() => seededRng(seed + 999), [seed]);

  // Tree dimensions — large, prominent palms
  const trunkHeight = useMemo(() => 9 + rng() * 3, [seed]);
  const baseRadius = useMemo(() => 0.38 + rng() * 0.12, [seed]);
  const topRadius = useMemo(() => 0.18 + rng() * 0.06, [seed]);

  // Trunk geometry
  const trunkGeo = useMemo(
    () => createTrunkGeometry(trunkHeight, baseRadius, topRadius, seed),
    [trunkHeight, baseRadius, topRadius, seed]
  );

  // Trunk material — warm sandy brown with ring texture feel
  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#7a5c2e'),
    roughness: 0.95,
    metalness: 0.0,
    flatShading: false,
  }), []);

  // Trunk outline (dark back-face pass for toon look)
  const trunkOutlineMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.08, 0.05, 0.02),
    side: THREE.BackSide,
    roughness: 1,
  }), []);

  // Base skirt — small flared base where trunk meets ground
  const baseMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5a3e1a'),
    roughness: 0.98,
    metalness: 0.0,
    flatShading: true,
  }), []);

  // Generate frond parameters
  const frondCount = 8;
  const fronds = useMemo(() => {
    const rngF = seededRng(seed + 77);
    return Array.from({ length: frondCount }, (_, i) => {
      const baseAngle = (i / frondCount) * Math.PI * 2;
      const angleJitter = (rngF() - 0.5) * 0.35;
      return {
        angle: baseAngle + angleJitter,
        length: 5.5 + rngF() * 2.5,
        width: 0.55 + rngF() * 0.25,
        droop: 2.5 + rngF() * 1.5,
        tiltUp: 0.25 + rngF() * 0.3, // radians upward from horizontal
        seed: seed * 100 + i * 17,
      };
    });
  }, [seed, frondCount]);

  // Trunk center is at y = trunkHeight/2 (since CylinderGeometry is centered)
  const trunkCenterY = trunkHeight / 2;

  return (
    <group position={position}>
      {/* Ground base flare — connects trunk to ground visually */}
      <mesh material={baseMat} position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[baseRadius * 1.6, baseRadius * 2.2, 0.3, 8, 1]} />
      </mesh>

      {/* Trunk — centered at trunkHeight/2 so bottom is at y=0 */}
      <mesh
        geometry={trunkGeo}
        material={trunkMat}
        position={[0, trunkCenterY, 0]}
        castShadow
        receiveShadow
      />
      {/* Trunk outline pass */}
      <mesh
        geometry={trunkGeo}
        material={trunkOutlineMat}
        position={[0, trunkCenterY, 0]}
        scale={[1.04, 1.005, 1.04]}
      />

      {/* Crown base — thickened knob where fronds emerge */}
      <mesh material={baseMat} position={[0, trunkHeight, 0]} castShadow>
        <sphereGeometry args={[topRadius * 2.2, 8, 6]} />
      </mesh>

      {/* Palm fronds */}
      {fronds.map((f, i) => (
        <PalmFrond
          key={i}
          trunkHeight={trunkHeight}
          angle={f.angle}
          length={f.length}
          width={f.width}
          droop={f.droop}
          tiltUp={f.tiltUp}
          seed={f.seed}
        />
      ))}

      {/* Coconut cluster */}
      <CoconutCluster trunkHeight={trunkHeight} />
    </group>
  );
}
