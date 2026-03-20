import { useMemo } from "react";
import * as THREE from "three";
import {
  type MountainSegmentData,
  generateMountainRingGeometry,
} from "../../utils/proceduralGeometry";

// Realistic stone color palette
const STONE_BASE_COLORS = [
  "#6b6055", // warm grey-brown
  "#635a50", // dark warm grey
  "#726860", // mid grey
  "#5c5248", // dark slate
  "#7a7068", // lighter grey
  "#68605a", // medium brown-grey
];

const STONE_MID_COLORS = [
  "#7a7068", // lighter grey
  "#726860", // mid grey
  "#807870", // sandy grey
  "#6a6258", // medium grey
  "#887e74", // light ochre-grey
  "#767068", // warm grey
];

const STONE_DARK_COLORS = [
  "#4a4540", // deep shadow
  "#3e3830", // near black slate
  "#524840", // dark sandy
  "#383230", // darkest
  "#4e4840", // dark ochre
  "#444038", // dark brown-grey
];

// Desert reddish rock for some boulders
const DESERT_ROCK_COLOR = "#8a6555";

// Seeded RNG for vertex displacement (deterministic)
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Simple multi-octave noise using seeded RNG
// Returns value in [-1, 1]
function fbmNoise(
  rng: () => number,
  octaves: number,
  persistence: number,
): number {
  let value = 0;
  let amplitude = 1.0;
  let totalAmp = 0;
  for (let o = 0; o < octaves; o++) {
    value += (rng() - 0.5) * 2 * amplitude;
    totalAmp += amplitude;
    amplitude *= persistence;
  }
  return value / totalAmp;
}

/**
 * Creates a realistic rocky mountain peak geometry.
 * Uses multi-octave noise displacement and a shoulder bulge effect.
 */
function createRockyPeakGeometry(
  baseRadius: number,
  height: number,
  seed: number,
): THREE.BufferGeometry {
  const rng = seededRng(seed);
  // Higher segments for smoother silhouette
  const geo = new THREE.ConeGeometry(
    baseRadius,
    height,
    18, // radialSegments
    12, // heightSegments
    false,
  );
  const positions = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    // Normalized height (0 = base, 1 = apex)
    const t = (y + height / 2) / height;

    // Shoulder bulge: mountains are wider in the middle third
    // Bulge factor peaks around t=0.33
    const shoulderBulge = Math.sin(Math.min(t * Math.PI * 1.2, Math.PI)) * 0.18;

    // Multi-octave radial displacement — large warps + smaller details
    const lowFreqNoise =
      fbmNoise(rng, 2, 0.6) * baseRadius * 0.3 * (1 - t * 0.75);
    const highFreqNoise =
      fbmNoise(rng, 3, 0.5) * baseRadius * 0.12 * (1 - t * 0.5);
    const totalRadialNoise = lowFreqNoise + highFreqNoise;

    // Vertical noise for uneven ridges
    const vertNoise = fbmNoise(rng, 2, 0.5) * height * 0.1 * (1 - t);

    const len = Math.sqrt(x * x + z * z);
    if (len > 0.001) {
      const nx = x / len;
      const nz = z / len;
      const newLen = len * (1 + shoulderBulge) + totalRadialNoise;
      positions.setXYZ(i, nx * newLen, y + vertNoise, nz * newLen);
    } else {
      // Apex — only vertical noise
      positions.setXYZ(i, x, y + fbmNoise(rng, 2, 0.5) * height * 0.06, z);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a realistic rocky ridge using an elongated, distorted CylinderGeometry.
 */
function createRockyRidgeGeometry(
  w: number,
  h: number,
  d: number,
  seed: number,
): THREE.BufferGeometry {
  const rng = seededRng(seed);
  // Use a cylinder for organic elongated ridge shape
  const radiusBottom = Math.max(w, d) * 0.5;
  const radiusTop = radiusBottom * 0.1;
  const geo = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    h,
    10, // radialSegments
    6, // heightSegments
    false,
  );
  const positions = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    const t = (y + h / 2) / h; // 0 = base, 1 = top
    const noiseScale = 0.22 * (1 - t * 0.7);

    // Stretch in one axis to make elongated ridge shape
    const stretchX = 0.7 + rng() * 0.6;
    const stretchZ = 1.2 + rng() * 0.8;

    positions.setXYZ(
      i,
      x * stretchX + fbmNoise(rng, 2, 0.5) * radiusBottom * noiseScale,
      y + fbmNoise(rng, 2, 0.5) * h * 0.08,
      z * stretchZ + fbmNoise(rng, 2, 0.5) * radiusBottom * noiseScale,
    );
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a distorted icosahedron for boulder clusters.
 */
function createBoulderGeometry(
  radius: number,
  seed: number,
): THREE.BufferGeometry {
  const rng = seededRng(seed);
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const positions = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const noise = 0.7 + rng() * 0.6;
    positions.setXYZ(i, x * noise, y * noise * 0.65, z * noise);
  }

  geo.computeVertexNormals();
  return geo;
}

// ─── Single mountain peak component ──────────────────────────────────────────
function MountainPeak({
  seg,
  index,
}: { seg: MountainSegmentData; index: number }) {
  const baseColor = STONE_BASE_COLORS[seg.colorIndex];
  const midColor = STONE_MID_COLORS[seg.colorIndex];
  const darkColor = STONE_DARK_COLORS[seg.colorIndex];

  // Sun-facing side: slightly lighter tint of base color
  const sunFaceColor = useMemo(() => {
    const c = new THREE.Color(midColor);
    c.multiplyScalar(1.12);
    return `#${c.getHexString()}`;
  }, [midColor]);

  // Rock materials
  const baseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseColor),
        roughness: 0.94,
        metalness: 0.02,
        flatShading: true,
      }),
    [baseColor],
  );

  const midMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(midColor),
        roughness: 0.94,
        metalness: 0.02,
        flatShading: true,
      }),
    [midColor],
  );

  const darkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(darkColor),
        roughness: 0.94,
        metalness: 0.02,
        flatShading: true,
      }),
    [darkColor],
  );

  const sunFaceMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(sunFaceColor),
        roughness: 0.92,
        metalness: 0.03,
        flatShading: true,
        transparent: true,
        opacity: 0.55,
      }),
    [sunFaceColor],
  );

  const desertRockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(DESERT_ROCK_COLOR),
        roughness: 0.94,
        metalness: 0.02,
        flatShading: true,
      }),
    [],
  );

  // Scree/talus skirt material — darker rocky color
  const screeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(darkColor),
        roughness: 0.97,
        metalness: 0.01,
        flatShading: true,
      }),
    [darkColor],
  );

  // Main peak geometry
  const peakGeo = useMemo(
    () =>
      createRockyPeakGeometry(
        seg.baseWidth / 2,
        seg.peakHeight,
        index * 31 + 7,
      ),
    [seg.baseWidth, seg.peakHeight, index],
  );

  // Ridge geometries
  const ridgeGeos = useMemo(
    () =>
      seg.ridgeOffsets.map((r, ri) =>
        createRockyRidgeGeometry(r.w, r.h, r.d, index * 17 + ri * 13 + 3),
      ),
    [seg.ridgeOffsets, index],
  );

  // Boulder geometries
  const boulderGeos = useMemo(
    () =>
      seg.boulderOffsets.map((b, bi) =>
        createBoulderGeometry(b.r, index * 23 + bi * 11 + 5),
      ),
    [seg.boulderOffsets, index],
  );

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

      {/* Sun-facing side layer — slightly lighter, offset in +X to simulate illuminated face */}
      <mesh
        geometry={peakGeo}
        material={sunFaceMat}
        position={[seg.baseWidth * 0.04, seg.peakHeight / 2, 0]}
        castShadow
      />

      {/* Scree / talus slope ring at base */}
      <mesh material={screeMat} position={[0, 0.18, 0]} receiveShadow>
        <torusGeometry
          args={[
            seg.baseWidth * 0.58, // ring radius
            seg.baseWidth * 0.18, // tube radius (flattened below)
            3, // tubular segments (flat)
            16, // radial segments
          ]}
        />
      </mesh>

      {/* Ridge sub-peaks */}
      {seg.ridgeOffsets.map((r, ri) => (
        // biome-ignore lint: pre-existing issue
        <group key={`ridge-${ri}`} position={[r.x, r.h / 2, r.z]}>
          <mesh
            geometry={ridgeGeos[ri]}
            material={ri % 3 === 0 ? midMat : ri % 3 === 1 ? baseMat : darkMat}
            castShadow
            receiveShadow
          />
        </group>
      ))}

      {/* Boulder clusters at base — half dark rock, half desert reddish rock */}
      {seg.boulderOffsets.map((b, bi) => (
        // biome-ignore lint: pre-existing issue
        <group key={`boulder-${bi}`} position={[b.x, b.h * 0.35, b.z]}>
          <mesh
            geometry={boulderGeos[bi]}
            material={bi % 2 === 0 ? darkMat : desertRockMat}
            castShadow
            receiveShadow
          />
        </group>
      ))}

      {/* Base skirt — wide flat slab to blend into desert floor */}
      <mesh material={darkMat} position={[0, 0.3, 0]} receiveShadow>
        <cylinderGeometry
          args={[seg.baseWidth * 0.65, seg.baseWidth * 0.88, 1.4, 10, 1]}
        />
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
        // biome-ignore lint: pre-existing issue
        <MountainPeak key={i} seg={seg} index={i} />
      ))}
    </group>
  );
}
