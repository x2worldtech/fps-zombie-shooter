import { useMemo } from "react";
import * as THREE from "three";

interface PalmTreeProps {
  position: [number, number, number];
  seed?: number;
}

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function createTrunkGeometry(
  trunkHeight: number,
  baseRadius: number,
  topRadius: number,
  seed: number,
): THREE.BufferGeometry {
  const rng = seededRng(seed);
  const geo = new THREE.CylinderGeometry(
    topRadius,
    baseRadius,
    trunkHeight,
    10,
    16,
    false,
  );
  const positions = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const t = (y + trunkHeight / 2) / trunkHeight;

    // Natural lean with smooth curve
    const swayX = Math.sin(t * Math.PI * 0.8) * 0.5 * (rng() - 0.35);
    const swayZ = Math.sin(t * Math.PI * 0.8) * 0.35 * (rng() - 0.35);

    // Ring bumps (characteristic palm bark texture)
    const ringBump = Math.sin(t * Math.PI * 18) * 0.045 * (1 - t * 0.4);
    // Secondary roughness
    const roughBump = (rng() - 0.5) * 0.02;

    const len = Math.sqrt(x * x + z * z);
    if (len > 0.001) {
      const nx = x / len;
      const nz = z / len;
      positions.setXYZ(
        i,
        x + nx * (ringBump + roughBump) + swayX,
        y,
        z + nz * (ringBump + roughBump) + swayZ,
      );
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a pinnate (feather) palm frond — a central rachis with leaflets on each side.
 * This is the realistic structure of a coconut/date palm frond.
 */
function createFrondGeometry(
  length: number,
  width: number,
  droop: number,
  seed: number,
): THREE.BufferGeometry {
  const rng = seededRng(seed);
  const segments = 18;
  const leafletPairs = 14; // pairs of leaflets along the rachis

  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  // --- Central rachis (spine of the frond) ---
  const rachisPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = t * length;
    const y = -droop * t * t * 1.1;
    // Slight lateral curve
    const x = Math.sin(t * Math.PI) * 0.08 * length * (rng() - 0.5);
    rachisPoints.push(new THREE.Vector3(x, y, z));
  }

  // --- Leaflets as thin elongated quads fanning out from rachis ---
  // Each leaflet pair: left and right leaflets
  const leafletCount = leafletPairs * 2;
  // Place leaflets along rachis segments
  for (let p = 0; p < leafletCount; p++) {
    const side = p % 2 === 0 ? -1 : 1; // left or right
    const pairIndex = Math.floor(p / 2);
    // Distribute along the middle 80% of the rachis (skip tip and base)
    const t = 0.08 + (pairIndex / (leafletPairs - 1)) * 0.84;
    const segIdx = Math.min(Math.floor(t * segments), segments - 1);
    const origin = rachisPoints[segIdx].clone();
    const next = rachisPoints[Math.min(segIdx + 1, segments)].clone();
    const rachisDir = next.clone().sub(origin).normalize();

    // Leaflet length: full at middle, shorter near base and tip
    const tipFactor = Math.sin(t * Math.PI);
    const leafLen = width * (1.0 + tipFactor * 0.6) * (0.85 + rng() * 0.3);
    const leafWidth = leafLen * 0.12 * (0.8 + rng() * 0.4);
    const leafDroop = leafLen * 0.35 * (0.7 + rng() * 0.6);
    // Slight angle variation
    const spreadAngle = (0.45 + rng() * 0.25) * side;
    // Twist leaflets slightly downward along their length

    const leafSegs = 6;
    const baseIdx = vertices.length / 3;

    for (let ls = 0; ls <= leafSegs; ls++) {
      const lt = ls / leafSegs;
      // Leaflet extends perpendicular to rachis direction, with droop
      const lx =
        origin.x +
        Math.cos(spreadAngle) * lt * leafLen * side -
        rachisDir.z * lt * leafLen * 0.2;
      const lz =
        origin.z +
        rachisDir.z * lt * leafLen * 0.25 +
        lt * leafLen * Math.sin(Math.abs(spreadAngle)) * 0.5;
      const ly = origin.y - leafDroop * lt * lt;

      // Leaflet width tapers to tip
      const lw = leafWidth * (1.0 - lt * 0.85);

      // Perpendicular direction in XZ for leaf width
      const perpX = -rachisDir.z;
      const perpZ = rachisDir.x;

      vertices.push(lx + perpX * lw, ly + lw * 0.1, lz + perpZ * lw);
      normals.push(0, 1, 0);
      uvs.push(0, lt);

      vertices.push(lx - perpX * lw, ly - lw * 0.1, lz - perpZ * lw);
      normals.push(0, 1, 0);
      uvs.push(1, lt);
    }

    for (let ls = 0; ls < leafSegs; ls++) {
      const a = baseIdx + ls * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
      indices.push(c, b, a, c, d, b); // back face
    }
  }

  // --- Rachis itself as a thin strip ---
  const rachisBaseIdx = vertices.length / 3;
  const rachisW = 0.06;
  for (let i = 0; i <= segments; i++) {
    const p = rachisPoints[i];
    vertices.push(p.x - rachisW, p.y, p.z);
    normals.push(0, 1, 0);
    uvs.push(0, i / segments);
    vertices.push(p.x + rachisW, p.y, p.z);
    normals.push(0, 1, 0);
    uvs.push(1, i / segments);
  }
  for (let i = 0; i < segments; i++) {
    const a = rachisBaseIdx + i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
    indices.push(c, b, a, c, d, b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function CoconutCluster({ trunkHeight }: { trunkHeight: number }) {
  const coconutMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3d2b1a"),
        roughness: 0.95,
        metalness: 0.0,
      }),
    [],
  );

  const offsets: [number, number, number][] = [
    [0.28, 0.05, 0.18],
    [-0.22, 0, 0.28],
    [0.1, 0.18, -0.28],
    [-0.18, 0.08, -0.1],
    [0.32, -0.05, -0.15],
  ];

  return (
    <group position={[0, trunkHeight, 0]}>
      {offsets.map((off, i) => (
        // biome-ignore lint: pre-existing issue
        <mesh key={i} material={coconutMat} position={off} castShadow>
          <sphereGeometry args={[0.2, 7, 6]} />
        </mesh>
      ))}
    </group>
  );
}

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
    [length, width, droop, seed],
  );

  const frondMat = useMemo(() => {
    const rng = seededRng(seed + 100);
    const greenVariation = 0.78 + rng() * 0.44;
    const yellowTint = rng() * 0.04;
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(
        0.06 * greenVariation + yellowTint,
        0.32 * greenVariation,
        0.05 * greenVariation,
      ),
      roughness: 0.7,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
  }, [seed]);

  return (
    <group position={[0, trunkHeight, 0]} rotation={[0, angle, 0]}>
      <group rotation={[-tiltUp, 0, 0]}>
        <mesh geometry={frondGeo} material={frondMat} castShadow />
      </group>
    </group>
  );
}

export function PalmTree({ position, seed = 0 }: PalmTreeProps) {
  const rng = useMemo(() => seededRng(seed + 999), [seed]);

  // biome-ignore lint: pre-existing issue
  const trunkHeight = useMemo(() => 9.5 + rng() * 3.5, [seed]);
  // biome-ignore lint: pre-existing issue
  const baseRadius = useMemo(() => 0.36 + rng() * 0.12, [seed]);
  // biome-ignore lint: pre-existing issue
  const topRadius = useMemo(() => 0.16 + rng() * 0.06, [seed]);

  const trunkGeo = useMemo(
    () => createTrunkGeometry(trunkHeight, baseRadius, topRadius, seed),
    [trunkHeight, baseRadius, topRadius, seed],
  );

  const trunkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#7a5c2e"),
        roughness: 0.95,
        metalness: 0.0,
      }),
    [],
  );

  const baseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#5a3e1a"),
        roughness: 0.98,
        metalness: 0.0,
        flatShading: true,
      }),
    [],
  );

  // 14 fronds — dense, realistic palm crown
  const frondCount = 14;
  // biome-ignore lint: pre-existing issue
  const fronds = useMemo(() => {
    const rngF = seededRng(seed + 77);
    return Array.from({ length: frondCount }, (_, i) => {
      const baseAngle = (i / frondCount) * Math.PI * 2;
      const angleJitter = (rngF() - 0.5) * 0.28;
      return {
        angle: baseAngle + angleJitter,
        length: 5.8 + rngF() * 2.8,
        width: 1.4 + rngF() * 0.6, // wider fronds = more leaflets
        droop: 2.8 + rngF() * 1.8,
        tiltUp: 0.18 + rngF() * 0.38,
        seed: seed * 100 + i * 17,
      };
    });
  }, [seed, frondCount]);

  const trunkCenterY = trunkHeight / 2;

  return (
    <group position={position}>
      {/* Ground base flare */}
      <mesh material={baseMat} position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry
          args={[baseRadius * 1.5, baseRadius * 2.1, 0.3, 9, 1]}
        />
      </mesh>

      {/* Trunk */}
      <mesh
        geometry={trunkGeo}
        material={trunkMat}
        position={[0, trunkCenterY, 0]}
        castShadow
        receiveShadow
      />

      {/* Crown knob */}
      <mesh material={baseMat} position={[0, trunkHeight, 0]} castShadow>
        <sphereGeometry args={[topRadius * 2.4, 9, 7]} />
      </mesh>

      {/* Palm fronds */}
      {fronds.map((f, i) => (
        <PalmFrond
          // biome-ignore lint: pre-existing issue
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
