import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { generateMountainRingGeometry, MountainSegmentData } from '../../utils/proceduralGeometry';

// Realistic stone color palette: grey, brown, ochre tones
const STONE_COLORS = [
  '#7a7268', // warm grey
  '#6b6358', // dark grey-brown
  '#8a7d6e', // sandy grey
  '#5e5650', // dark slate
  '#9e8e7a', // light ochre-grey
  '#7c6e5e', // medium brown-grey
];

const STONE_DARK_COLORS = [
  '#4a4540', // shadow grey
  '#3e3830', // deep shadow
  '#524a40', // dark sandy
  '#383230', // near black slate
  '#5e5248', // dark ochre
  '#4a4038', // dark brown-grey
];

// Seeded RNG for vertex displacement (deterministic)
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Creates a distorted cone geometry to simulate a rocky mountain peak.
 * Vertices are displaced radially and vertically for an irregular, rocky silhouette.
 */
function createRockyPeakGeometry(
  baseRadius: number,
  height: number,
  radialSegments: number,
  heightSegments: number,
  seed: number
): THREE.BufferGeometry {
  const rng = seededRng(seed);
  const geo = new THREE.ConeGeometry(baseRadius, height, radialSegments, heightSegments, false);
  const positions = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    // Normalized height (0 = base, 1 = apex)
    const t = (y + height / 2) / height;

    // Radial displacement — stronger near base, tapers to apex
    const radialNoise = (rng() - 0.5) * baseRadius * 0.35 * (1 - t * 0.8);
    // Vertical displacement — creates uneven ridges
    const vertNoise = (rng() - 0.5) * height * 0.12;

    // Direction from axis
    const len = Math.sqrt(x * x + z * z);
    if (len > 0.001) {
      const nx = x / len;
      const nz = z / len;
      positions.setXYZ(
        i,
        x + nx * radialNoise,
        y + vertNoise * (1 - t),
        z + nz * radialNoise
      );
    } else {
      // Apex — only vertical noise
      positions.setXYZ(i, x, y + (rng() - 0.5) * height * 0.08, z);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a distorted box geometry for rocky ridge sub-peaks.
 */
function createRockyRidgeGeometry(
  w: number,
  h: number,
  d: number,
  seed: number
): THREE.BufferGeometry {
  const rng = seededRng(seed);
  const geo = new THREE.BoxGeometry(w, h, d, 3, 4, 3);
  const positions = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    const t = (y + h / 2) / h; // 0 = base, 1 = top
    const noise = 0.18 * (1 - t * 0.6);

    positions.setXYZ(
      i,
      x + (rng() - 0.5) * w * noise,
      y + (rng() - 0.5) * h * 0.08,
      z + (rng() - 0.5) * d * noise
    );
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a distorted icosahedron for boulder clusters.
 */
function createBoulderGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const rng = seededRng(seed);
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const positions = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const noise = 0.75 + rng() * 0.5;
    positions.setXYZ(
      i,
      x * noise,
      y * noise * 0.65, // flatten slightly
      z * noise
    );
  }

  geo.computeVertexNormals();
  return geo;
}

// ─── Single mountain peak component ──────────────────────────────────────────
function MountainPeak({ seg, index }: { seg: MountainSegmentData; index: number }) {
  const baseColor = STONE_COLORS[seg.colorIndex];
  const darkColor = STONE_DARK_COLORS[seg.colorIndex];

  // Slightly lighter color for peak highlights
  const lightColor = useMemo(() => {
    const c = new THREE.Color(baseColor);
    c.multiplyScalar(1.18);
    return '#' + c.getHexString();
  }, [baseColor]);

  // Materials
  const baseMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor),
    roughness: 0.92,
    metalness: 0.04,
    flatShading: true,
  }), [baseColor]);

  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(darkColor),
    roughness: 0.95,
    metalness: 0.02,
    flatShading: true,
  }), [darkColor]);

  const lightMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(lightColor),
    roughness: 0.88,
    metalness: 0.05,
    flatShading: true,
  }), [lightColor]);

  // Outline material (dark, back-face)
  const outlineMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.05, 0.04, 0.03),
    side: THREE.BackSide,
    roughness: 1,
  }), []);

  // Main peak geometry (distorted cone)
  const peakGeo = useMemo(() =>
    createRockyPeakGeometry(
      seg.baseWidth / 2,
      seg.peakHeight,
      10,
      6,
      index * 31 + 7
    ), [seg.baseWidth, seg.peakHeight, index]);

  // Ridge geometries
  const ridgeGeos = useMemo(() =>
    seg.ridgeOffsets.map((r, ri) =>
      createRockyRidgeGeometry(r.w, r.h, r.d, index * 17 + ri * 13 + 3)
    ), [seg.ridgeOffsets, index]);

  // Boulder geometries
  const boulderGeos = useMemo(() =>
    seg.boulderOffsets.map((b, bi) =>
      createBoulderGeometry(b.r, index * 23 + bi * 11 + 5)
    ), [seg.boulderOffsets, index]);

  const [px, , pz] = seg.position;

  return (
    <group position={[px, -0.5, pz]} rotation={[0, seg.rotation, 0]}>
      {/* Main peak — primary stone color */}
      <mesh
        geometry={peakGeo}
        material={baseMat}
        position={[0, seg.peakHeight / 2, 0]}
        castShadow
        receiveShadow
      />
      {/* Outline pass */}
      <mesh
        geometry={peakGeo}
        material={outlineMat}
        position={[0, seg.peakHeight / 2, 0]}
        scale={[1.025, 1.015, 1.025]}
      />

      {/* Ridge sub-peaks */}
      {seg.ridgeOffsets.map((r, ri) => (
        <group key={`ridge-${ri}`} position={[r.x, r.h / 2, r.z]}>
          <mesh
            geometry={ridgeGeos[ri]}
            material={ri % 3 === 0 ? lightMat : ri % 3 === 1 ? baseMat : darkMat}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={ridgeGeos[ri]}
            material={outlineMat}
            scale={[1.03, 1.02, 1.03]}
          />
        </group>
      ))}

      {/* Boulder clusters at base */}
      {seg.boulderOffsets.map((b, bi) => (
        <group key={`boulder-${bi}`} position={[b.x, b.h * 0.35, b.z]}>
          <mesh
            geometry={boulderGeos[bi]}
            material={bi % 2 === 0 ? darkMat : baseMat}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={boulderGeos[bi]}
            material={outlineMat}
            scale={[1.04, 1.04, 1.04]}
          />
        </group>
      ))}

      {/* Base skirt — wide flat slab to blend into desert floor */}
      <mesh
        material={darkMat}
        position={[0, 0.3, 0]}
        receiveShadow
      >
        <cylinderGeometry args={[seg.baseWidth * 0.65, seg.baseWidth * 0.85, 1.2, 8, 1]} />
      </mesh>
    </group>
  );
}

// ─── Full mountain ring barrier ───────────────────────────────────────────────
export function MountainBarrier() {
  const segments = useMemo(() => generateMountainRingGeometry(), []);

  return (
    <group>
      {segments.map((seg, i) => (
        <MountainPeak key={i} seg={seg} index={i} />
      ))}
    </group>
  );
}
