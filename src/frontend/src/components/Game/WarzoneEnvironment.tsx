import { useFrame } from "@react-three/fiber";
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { NUCLEAR_MACHINE_POSITION, NuclearMachine } from "./NuclearMachine";

// Module-level map: building index → group (THREE.Group) for imperative opacity control
export const buildingGroupRefs = new Map<number, THREE.Group>();

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── CoD-style building layout ────────────────────────────────────────────────
// All properties — including groundY — computed ONCE at module load.
// groundY must be computed here by replaying the exact same RNG sequence
// that DestroyedBuilding uses internally, in the exact same order:
//   call 1 → concreteMat lightness (consumed, discarded)
//   call 2 → collapseStyle         (consumed, discarded)
//   call 3 → mff = 0.3 + rng()*0.5 → groundY = h * mff / 2
// The group's Y is set to groundY so the building base sits at y=0.

interface BuildingDef {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  seed: number;
  groundY: number; // pre-computed — never changes
}

function computeGroundY(h: number, seed: number): number {
  const rng = seededRandom(seed);
  rng(); // concreteMat lightness — discard
  rng(); // collapseStyle — discard
  const mff = 0.3 + rng() * 0.5;
  return (h * mff) / 2;
}

// All building definitions with groundY pre-computed at module load.
// These values never change — the module evaluates once when first imported.
export const WARZONE_BUILDING_DEFS: BuildingDef[] = (
  [
    // ── Plaza ring (8 buildings) ──────────────────────────────────────────────
    { x: -12, z: -26, w: 10, d: 7, h: 11, seed: 101 },
    { x: 12, z: -26, w: 10, d: 7, h: 13, seed: 102 },
    { x: 26, z: -10, w: 7, d: 10, h: 10, seed: 103 },
    { x: 26, z: 10, w: 7, d: 10, h: 12, seed: 104 },
    { x: -26, z: -10, w: 7, d: 10, h: 12, seed: 105 },
    { x: -26, z: 10, w: 7, d: 10, h: 10, seed: 106 },
    { x: -14, z: 27, w: 9, d: 7, h: 11, seed: 107 },
    { x: 14, z: 27, w: 9, d: 7, h: 11, seed: 108 },
    // ── North street buildings (6) ────────────────────────────────────────────
    { x: -18, z: -35, w: 9, d: 8, h: 14, seed: 201 },
    { x: 18, z: -35, w: 9, d: 8, h: 16, seed: 202 },
    { x: -17, z: -46, w: 8, d: 9, h: 18, seed: 203 },
    { x: 17, z: -46, w: 8, d: 9, h: 15, seed: 204 },
    { x: -14, z: -55, w: 10, d: 7, h: 20, seed: 205 },
    { x: 14, z: -55, w: 10, d: 7, h: 22, seed: 206 },
    // ── South street buildings (6) ────────────────────────────────────────────
    { x: -18, z: 37, w: 9, d: 8, h: 13, seed: 301 },
    { x: 18, z: 37, w: 9, d: 8, h: 15, seed: 302 },
    { x: -16, z: 47, w: 8, d: 9, h: 17, seed: 303 },
    { x: 16, z: 47, w: 8, d: 9, h: 16, seed: 304 },
    { x: -13, z: 56, w: 11, d: 8, h: 21, seed: 305 },
    { x: 13, z: 56, w: 11, d: 8, h: 19, seed: 306 },
    // ── East street buildings (6) ─────────────────────────────────────────────
    { x: 36, z: -16, w: 8, d: 9, h: 14, seed: 401 },
    { x: 36, z: 16, w: 8, d: 9, h: 12, seed: 402 },
    { x: 47, z: -14, w: 9, d: 8, h: 18, seed: 403 },
    { x: 47, z: 14, w: 9, d: 8, h: 16, seed: 404 },
    { x: 56, z: -10, w: 8, d: 11, h: 22, seed: 405 },
    { x: 56, z: 10, w: 8, d: 11, h: 20, seed: 406 },
    // ── Corner/block buildings (4) ────────────────────────────────────────────
    { x: 38, z: -38, w: 12, d: 11, h: 24, seed: 501 },
    { x: -38, z: -38, w: 11, d: 12, h: 26, seed: 502 },
    { x: 38, z: 38, w: 12, d: 11, h: 22, seed: 503 },
    { x: -38, z: 38, w: 11, d: 12, h: 24, seed: 504 },
  ] as Omit<BuildingDef, "groundY">[]
).map((b) => ({ ...b, groundY: computeGroundY(b.h, b.seed) }));

// ─── Collision AABB ───────────────────────────────────────────────────────────
export interface WarzoneAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// Pure function — reads from module-level constant, no RNG, no React state.
export function generateWarzoneAABBs(playerRadius = 0.4): WarzoneAABB[] {
  return WARZONE_BUILDING_DEFS.map((b) => ({
    minX: b.x - b.w / 2 - playerRadius,
    maxX: b.x + b.w / 2 + playerRadius,
    minZ: b.z - b.d / 2 - playerRadius,
    maxZ: b.z + b.d / 2 + playerRadius,
  }));
}

// ─── Material helpers ─────────────────────────────────────────────────────────
function mat(
  color: string,
  roughness = 0.88,
  metalness = 0.0,
  emissive?: string,
  emissiveIntensity = 0,
) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
    emissive: emissive ? new THREE.Color(emissive) : undefined,
    emissiveIntensity,
  });
}

// ─── Shaders ──────────────────────────────────────────────────────────────────
const concreteVertexShader = `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const concreteFragShader = `
  varying vec2 vUv;
  varying vec3 vPos;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++) { v+=a*noise(p); p*=2.1; a*=0.5; }
    return v;
  }
  void main() {
    vec2 uv = vUv * 24.0;
    float base = fbm(uv * 0.5);
    float cracks = smoothstep(0.6, 0.65, fbm(uv * 2.0));
    float dirt = noise(uv * 0.8 + 3.7) * 0.3;
    vec3 col = mix(vec3(0.18, 0.17, 0.15), vec3(0.28, 0.26, 0.23), base);
    col = mix(col, vec3(0.06, 0.05, 0.04), cracks * 0.8);
    col = mix(col, vec3(0.22, 0.18, 0.12), dirt);
    float blood = smoothstep(0.72, 0.76, noise(uv * 0.3 + 8.1)) * 0.55;
    col = mix(col, vec3(0.22, 0.04, 0.04), blood);
    float scorch = smoothstep(0.68, 0.72, fbm(uv * 0.7 + 5.5)) * 0.4;
    col = mix(col, vec3(0.03, 0.03, 0.02), scorch);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const warSkyFragShader = `
  varying vec3 vPos;
  void main() {
    float y = normalize(vPos).y;
    vec3 low = vec3(0.09, 0.09, 0.12);
    vec3 high = vec3(0.16, 0.16, 0.2);
    gl_FragColor = vec4(mix(low, high, clamp(y, 0.0, 1.0)), 1.0);
  }
`;
const warSkyVertexShader = `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Ground ───────────────────────────────────────────────────────────────────
function WarzoneGround() {
  const groundMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: concreteVertexShader,
        fragmentShader: concreteFragShader,
        side: THREE.FrontSide,
      }),
    [],
  );
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
    >
      <planeGeometry args={[300, 300, 64, 64]} />
      <primitive object={groundMat} attach="material" />
    </mesh>
  );
}

// ─── Sky ──────────────────────────────────────────────────────────────────────
function WarzoneSky() {
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: warSkyVertexShader,
        fragmentShader: warSkyFragShader,
        side: THREE.BackSide,
      }),
    [],
  );
  return (
    <mesh>
      <sphereGeometry args={[250, 32, 16]} />
      <primitive object={skyMat} attach="material" />
    </mesh>
  );
}

// ─── Detailed destroyed building ──────────────────────────────────────────────
// React.memo with `() => true` equality: the component body NEVER runs after
// initial mount, regardless of parent re-renders, bird useFrame callbacks, or
// any game state changes. Position/size/seed are derived from module-level
// constants and never change, so skipping re-render is always correct.
export const DestroyedBuilding = React.memo(
  function DestroyedBuilding({
    position,
    width,
    height,
    depth,
    seed,
    buildingIndex,
  }: {
    position: [number, number, number];
    width: number;
    height: number;
    depth: number;
    seed: number;
    buildingIndex: number;
  }) {
    const groupRef = useRef<THREE.Group>(null);

    // Register the group ref in the module-level map on mount
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — buildingIndex is stable
    React.useEffect(() => {
      if (groupRef.current) {
        buildingGroupRefs.set(buildingIndex, groupRef.current);
      }
      return () => {
        buildingGroupRefs.delete(buildingIndex);
      };
    }, []);
    // rng is a stateful closure — we call it in a fixed, deterministic sequence.
    // Because this component never re-renders (memo equality always true),
    // the sequence is executed exactly once at mount time.
    const rng = seededRandom(seed);

    // ── Materials ─────────────────────────────────────────────────────────────
    const lightness = 0.2 + rng() * 0.1; // call 1
    const concreteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.06, 0.04, lightness),
      roughness: 0.85,
      metalness: 0.0,
    });
    const darkConcreteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0d0c0a"),
      roughness: 0.96,
      metalness: 0,
    });
    const rebarMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#4a3318"),
      roughness: 0.7,
      metalness: 0.9,
    });
    const scorchMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0b0907"),
      roughness: 1.0,
      metalness: 0,
    });
    const rubbleMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#5e5348"),
      roughness: 0.95,
      metalness: 0,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#8ab0c0"),
      roughness: 0.1,
      metalness: 0.0,
      transparent: true,
      opacity: 0.35,
    });
    const stainMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#2a2218"),
      roughness: 1,
      transparent: true,
      opacity: 0.6,
    });
    const floorBandMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1a1916"),
      roughness: 0.92,
      metalness: 0,
    });

    // ── Geometry parameters — must consume rng in same order as before ────────
    const collapseStyle = Math.floor(rng() * 3); // call 2
    const mff = 0.3 + rng() * 0.5; // call 3 — missedFloorFrac
    const intactH = height * mff;

    const floorCount = Math.floor(intactH / 3);
    const winsX = Math.max(1, Math.floor(width / 2.5));
    const winsZ = Math.max(1, Math.floor(depth / 2.5));
    const floorsForWin = Math.max(1, Math.floor(intactH / 3));
    const roofRubbleCount = 3 + Math.floor(rng() * 4);
    const blastFace = Math.floor(rng() * 4);
    const blastY = intactH * (0.2 + rng() * 0.5);
    const blastW = 1.2 + rng() * 1.8;
    const blastH2 = 1.2 + rng() * 1.5;

    // ── Pre-compute all window shattered states (calls rng per window) ────────
    // Done here in render body — but since memo never re-renders, this is fine.
    const frontWinShattered = Array.from(
      { length: winsX * floorsForWin },
      () => rng() > 0.65,
    );
    const backWinShattered = Array.from(
      { length: winsX * floorsForWin },
      () => rng() > 0.65,
    );
    const leftWinShattered = Array.from(
      { length: winsZ * floorsForWin },
      () => rng() > 0.65,
    );
    const rightWinShattered = Array.from(
      { length: winsZ * floorsForWin },
      () => rng() > 0.65,
    );

    // Stain position
    const stainX = rng() * width * 0.3;
    const stainW = width * 0.35 + rng() * 0.5;
    const scorchRot = (rng() - 0.5) * 0.3;

    // ── Pre-compute rebar rod positions ────────────────────────────────────────
    const rebarRods = Array.from({ length: 6 }, () => {
      const ox = (rng() - 0.5) * width * 0.7;
      const oz = (rng() - 0.5) * depth * 0.5;
      const rebarH = 0.7 + rng() * 1.8;
      const rx = (rng() - 0.5) * 0.5;
      const rz = (rng() - 0.5) * 0.45;
      return { ox, oz, rebarH, rx, rz };
    });

    // ── Pre-compute corner rebar positions ────────────────────────────────────
    const cornerRebar = (
      [
        [width / 2, depth / 2],
        [-width / 2, depth / 2],
        [width / 2, -depth / 2],
        [-width / 2, -depth / 2],
      ] as [number, number][]
    ).map(([cx, cz]) => {
      const rH = 0.5 + rng() * 1.0;
      const rx = (rng() - 0.5) * 0.6;
      const rz = (rng() - 0.5) * 0.6;
      return { cx, cz, rH, rx, rz };
    });

    // ── Pre-compute rooftop rubble ─────────────────────────────────────────────
    const roofRubble = Array.from({ length: roofRubbleCount }, () => ({
      px: (rng() - 0.5) * width * 0.75,
      pz: (rng() - 0.5) * depth * 0.75,
      rx: rng() * 0.6,
      ry: rng() * Math.PI,
      rz: rng() * 0.6,
      sx: 0.3 + rng() * 0.5,
      sy: 0.2 + rng() * 0.3,
      sz: 0.3 + rng() * 0.5,
    }));

    // ── Pre-compute parapet ────────────────────────────────────────────────────
    const parapetCount = Math.floor(width / 3);
    const parapets = Array.from({ length: parapetCount }, (_, i) => {
      const visible = rng() > 0.3;
      const pw = 0.55 + rng() * 0.3;
      const ph = 0.6 + rng() * 0.5;
      return { i, visible, pw, ph };
    });

    // ── Pre-compute ground-level rubble ────────────────────────────────────────
    const groundRubble = Array.from({ length: 5 }, () => ({
      px: (rng() - 0.5) * width * 1.1,
      pz: depth / 2 + 0.3 + rng() * 0.8,
      rx: rng() * 0.5,
      ry: rng() * Math.PI,
      rz: rng() * 0.5,
      sx: 0.4 + rng() * 0.9,
      sy: 0.25 + rng() * 0.4,
      sz: 0.4 + rng() * 0.8,
    }));

    return (
      // frustumCulled={false} on the group AND every child mesh — prevents
      // the camera frustum from toggling mesh visibility which causes flicker.
      <group ref={groupRef} position={position} frustumCulled={false}>
        {/* ── Main intact body ────────────────────────────────────────────── */}
        <mesh
          material={concreteMat}
          castShadow
          receiveShadow
          frustumCulled={false}
        >
          <boxGeometry args={[width, intactH, depth]} />
        </mesh>

        {/* ── Dark interior cavity ─────────────────────────────────────────── */}
        <mesh
          material={darkConcreteMat}
          position={[0, intactH * 0.05, 0]}
          frustumCulled={false}
        >
          <boxGeometry args={[width * 0.72, intactH * 0.82, depth * 0.72]} />
        </mesh>

        {/* ── Floor bands ──────────────────────────────────────────────────── */}
        {Array.from({ length: floorCount }).map((_, fi) => {
          const bandY = -intactH / 2 + (fi + 1) * 3.0 - 0.06;
          const bandYKey = Math.round(bandY * 1000);
          return (
            <mesh
              key={`fb-${bandYKey}`}
              material={floorBandMat}
              position={[0, bandY, 0]}
              castShadow
              frustumCulled={false}
            >
              <boxGeometry args={[width + 0.14, 0.18, depth + 0.14]} />
            </mesh>
          );
        })}

        {/* ── Windows — front face (Z+) ─────────────────────────────────── */}
        {Array.from({ length: winsX * floorsForWin }).map((_, idx) => {
          const col = idx % winsX;
          const row = Math.floor(idx / winsX);
          const wx = (col - (winsX - 1) / 2) * (width / winsX);
          const wy = -intactH / 2 + 1.5 + row * 3.0;
          return (
            <mesh
              key={`wf-c${col}-r${row}`}
              material={frontWinShattered[idx] ? glassMat : darkConcreteMat}
              position={[wx, wy, depth / 2 + 0.04]}
              frustumCulled={false}
            >
              <boxGeometry args={[0.8, 1.1, 0.12]} />
            </mesh>
          );
        })}

        {/* ── Windows — back face (Z-) ──────────────────────────────────── */}
        {Array.from({ length: winsX * floorsForWin }).map((_, idx) => {
          const col = idx % winsX;
          const row = Math.floor(idx / winsX);
          const wx = (col - (winsX - 1) / 2) * (width / winsX);
          const wy = -intactH / 2 + 1.5 + row * 3.0;
          return (
            <mesh
              key={`wb-c${col}-r${row}`}
              material={backWinShattered[idx] ? glassMat : darkConcreteMat}
              position={[wx, wy, -(depth / 2 + 0.04)]}
              frustumCulled={false}
            >
              <boxGeometry args={[0.8, 1.1, 0.12]} />
            </mesh>
          );
        })}

        {/* ── Windows — left face (X-) ─────────────────────────────────── */}
        {Array.from({ length: winsZ * floorsForWin }).map((_, idx) => {
          const col = idx % winsZ;
          const row = Math.floor(idx / winsZ);
          const wz = (col - (winsZ - 1) / 2) * (depth / winsZ);
          const wy = -intactH / 2 + 1.5 + row * 3.0;
          return (
            <mesh
              key={`wl-c${col}-r${row}`}
              material={leftWinShattered[idx] ? glassMat : darkConcreteMat}
              position={[-(width / 2 + 0.04), wy, wz]}
              rotation={[0, Math.PI / 2, 0]}
              frustumCulled={false}
            >
              <boxGeometry args={[0.8, 1.1, 0.12]} />
            </mesh>
          );
        })}

        {/* ── Windows — right face (X+) ────────────────────────────────── */}
        {Array.from({ length: winsZ * floorsForWin }).map((_, idx) => {
          const col = idx % winsZ;
          const row = Math.floor(idx / winsZ);
          const wz = (col - (winsZ - 1) / 2) * (depth / winsZ);
          const wy = -intactH / 2 + 1.5 + row * 3.0;
          return (
            <mesh
              key={`wr-c${col}-r${row}`}
              material={rightWinShattered[idx] ? glassMat : darkConcreteMat}
              position={[width / 2 + 0.04, wy, wz]}
              rotation={[0, Math.PI / 2, 0]}
              frustumCulled={false}
            >
              <boxGeometry args={[0.8, 1.1, 0.12]} />
            </mesh>
          );
        })}

        {/* ── Blast hole ───────────────────────────────────────────────────── */}
        <mesh
          material={darkConcreteMat}
          position={
            blastFace === 0
              ? [0, blastY - intactH / 2, depth / 2 + 0.05]
              : blastFace === 1
                ? [0, blastY - intactH / 2, -(depth / 2 + 0.05)]
                : blastFace === 2
                  ? [-(width / 2 + 0.05), blastY - intactH / 2, 0]
                  : [width / 2 + 0.05, blastY - intactH / 2, 0]
          }
          rotation={blastFace >= 2 ? [0, Math.PI / 2, 0] : [0, 0, 0]}
          frustumCulled={false}
        >
          <boxGeometry args={[blastW, blastH2, 0.18]} />
        </mesh>

        {/* ── Weathering stain ─────────────────────────────────────────────── */}
        <mesh
          material={stainMat}
          position={[stainX, 0, depth / 2 + 0.06]}
          frustumCulled={false}
        >
          <planeGeometry args={[stainW, intactH * 0.4]} />
        </mesh>

        {/* ── Scorch mark ──────────────────────────────────────────────────── */}
        <mesh
          material={scorchMat}
          position={[0, intactH * 0.22, depth / 2 + 0.07]}
          rotation={[0, 0, scorchRot]}
          frustumCulled={false}
        >
          <planeGeometry args={[width * 0.5, intactH * 0.35]} />
        </mesh>

        {/* ── Blown-out upper remnant walls ─────────────────────────────────── */}
        {collapseStyle < 2 && (
          <mesh
            material={concreteMat}
            position={[
              -width * 0.28,
              intactH * 0.5 + height * (1 - mff) * 0.28,
              0,
            ]}
            castShadow
            frustumCulled={false}
          >
            <boxGeometry
              args={[width * 0.38, height * (1 - mff) * 0.55, depth * 0.85]}
            />
          </mesh>
        )}
        {collapseStyle === 0 && (
          <mesh
            material={concreteMat}
            position={[
              width * 0.3,
              intactH * 0.5 + height * (1 - mff) * 0.15,
              0,
            ]}
            castShadow
            frustumCulled={false}
          >
            <boxGeometry
              args={[width * 0.3, height * (1 - mff) * 0.3, depth * 0.7]}
            />
          </mesh>
        )}

        {/* ── Rebar rods at top ─────────────────────────────────────────────── */}
        {rebarRods.map((r) => (
          <mesh
            key={`rr-${Math.round(r.ox * 100)}-${Math.round(r.oz * 100)}`}
            material={rebarMat}
            position={[r.ox, intactH / 2 + r.rebarH / 2, r.oz]}
            rotation={[r.rx, 0, r.rz]}
            castShadow
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.035, 0.04, r.rebarH, 5]} />
          </mesh>
        ))}

        {/* ── Damaged corner rebar ─────────────────────────────────────────── */}
        {cornerRebar.map((r) => (
          <mesh
            key={`cr-${Math.round(r.cx * 10)}-${Math.round(r.cz * 10)}`}
            material={rebarMat}
            position={[r.cx * 0.9, intactH / 2 - r.rH / 2, r.cz * 0.9]}
            rotation={[r.rx, 0, r.rz]}
            castShadow
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.03, 0.04, r.rH, 4]} />
          </mesh>
        ))}

        {/* ── Rooftop rubble ────────────────────────────────────────────────── */}
        {roofRubble.map((r) => (
          <mesh
            key={`rub-${Math.round(r.px * 100)}-${Math.round(r.pz * 100)}`}
            material={rubbleMat}
            position={[r.px, intactH / 2 + 0.18, r.pz]}
            rotation={[r.rx, r.ry, r.rz]}
            scale={[r.sx, r.sy, r.sz]}
            castShadow
            frustumCulled={false}
          >
            <dodecahedronGeometry args={[0.55, 0]} />
          </mesh>
        ))}

        {/* ── Broken parapet on roof ────────────────────────────────────────── */}
        {parapets.map((p) => {
          if (!p.visible) return null;
          return (
            <mesh
              key={`par-${p.i}`}
              material={concreteMat}
              position={[
                (p.i - parapetCount / 2 + 0.5) * 3,
                intactH / 2 + 0.35,
                -(depth / 2 + 0.06),
              ]}
              castShadow
              frustumCulled={false}
            >
              <boxGeometry args={[p.pw, p.ph, 0.22]} />
            </mesh>
          );
        })}

        {/* ── Ground-level rubble heap ──────────────────────────────────────── */}
        {groundRubble.map((r) => (
          <mesh
            key={`gr-${Math.round(r.px * 100)}-${Math.round(r.pz * 100)}`}
            material={rubbleMat}
            position={[r.px, -intactH / 2 + 0.2, r.pz]}
            rotation={[r.rx, r.ry, r.rz]}
            scale={[r.sx, r.sy, r.sz]}
            castShadow
            frustumCulled={false}
          >
            <dodecahedronGeometry args={[0.55, 0]} />
          </mesh>
        ))}
      </group>
    );
  },
  // Always return true — buildings are static geometry and NEVER need to re-render.
  () => true,
);

// ─── Burned vehicle ───────────────────────────────────────────────────────────
function BurnedVehicle({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  const hullMat = useMemo(() => mat("#1a1510", 0.88, 0.35), []);
  const rustMat = useMemo(() => mat("#5a2a0a", 0.8, 0.2), []);
  const trackMat = useMemo(() => mat("#111008", 0.95, 0.1), []);
  return (
    <group position={position} rotation={[0, rotation ?? 0, 0]}>
      <mesh material={hullMat} castShadow receiveShadow frustumCulled>
        <boxGeometry args={[4.5, 1.1, 2.2]} />
      </mesh>
      <mesh
        material={hullMat}
        position={[0.3, 0.8, 0]}
        castShadow
        frustumCulled
      >
        <boxGeometry args={[1.8, 0.75, 1.4]} />
      </mesh>
      <mesh
        material={rustMat}
        position={[1.4, 0.95, 0]}
        rotation={[0, 0, -0.25]}
        castShadow
        frustumCulled
      >
        <cylinderGeometry args={[0.08, 0.08, 2.2, 8]} />
      </mesh>
      {([-1.2, 0, 1.2] as number[]).map((x) => (
        <mesh
          key={`plank-${x}`}
          material={rustMat}
          position={[x, 0.56, 1.12]}
          frustumCulled
        >
          <planeGeometry args={[0.8, 0.5]} />
        </mesh>
      ))}
      {([-1.14, 1.14] as number[]).map((z) => (
        <mesh
          key={`track-${z}`}
          material={trackMat}
          position={[0, -0.25, z]}
          castShadow
          frustumCulled
        >
          <boxGeometry args={[5.0, 0.55, 0.48]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Blast crater ─────────────────────────────────────────────────────────────
function BlastCrater({ position }: { position: [number, number, number] }) {
  const scorchMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0a0806"),
        roughness: 1,
        transparent: true,
        opacity: 0.85,
      }),
    [],
  );
  const rimMat = useMemo(() => mat("#4a3e30", 0.95), []);
  return (
    <group position={position}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        frustumCulled
      >
        <circleGeometry args={[2.2, 20]} />
        <primitive object={scorchMat} attach="material" />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={i}
            material={rimMat}
            position={[Math.cos(angle) * 1.8, 0.15, Math.sin(angle) * 1.8]}
            rotation={[0, angle, 0.2]}
            scale={[0.6, 0.25, 0.5]}
            castShadow
            frustumCulled
          >
            <dodecahedronGeometry args={[0.6, 0]} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Jersey barrier ───────────────────────────────────────────────────────────
function JerseyBarrier({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  const concreteMat = useMemo(() => mat("#888278", 0.88), []);
  const topMat = useMemo(() => mat("#6e6860", 0.8), []);
  return (
    <group position={position} rotation={[0, rotation ?? 0, 0]}>
      <mesh
        material={concreteMat}
        position={[0, 0.18, 0]}
        castShadow
        frustumCulled
      >
        <boxGeometry args={[2.2, 0.36, 0.75]} />
      </mesh>
      <mesh
        material={concreteMat}
        position={[0, 0.64, 0]}
        castShadow
        frustumCulled
      >
        <boxGeometry args={[1.6, 0.55, 0.45]} />
      </mesh>
      <mesh material={topMat} position={[0, 0.96, 0]} frustumCulled>
        <boxGeometry args={[1.65, 0.1, 0.48]} />
      </mesh>
    </group>
  );
}

// ─── Sandbag pile ─────────────────────────────────────────────────────────────
function SandbagPile({ position }: { position: [number, number, number] }) {
  const bagMat = useMemo(() => mat("#8a7050", 0.95), []);
  return (
    <group position={position}>
      {([-0.55, 0, 0.55] as number[]).map((x, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
          key={i}
          material={bagMat}
          position={[x, 0.2, 0]}
          rotation={[0, i * 0.15, 0]}
          castShadow
          frustumCulled
        >
          <capsuleGeometry args={[0.22, 0.5, 6, 8]} />
        </mesh>
      ))}
      {([-0.28, 0.28] as number[]).map((x, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
          key={i}
          material={bagMat}
          position={[x, 0.5, 0]}
          rotation={[0, (i + 0.5) * 0.2, 0]}
          castShadow
          frustumCulled
        >
          <capsuleGeometry args={[0.2, 0.45, 6, 8]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Fire ember ───────────────────────────────────────────────────────────────
function FireEmber({ position }: { position: [number, number, number] }) {
  const fireMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#ff4400"),
        emissive: new THREE.Color("#ff2200"),
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );
  return (
    <group position={position}>
      <mesh material={fireMat} frustumCulled>
        <planeGeometry args={[0.6, 1.4]} />
      </mesh>
      <mesh material={fireMat} rotation={[0, Math.PI / 2, 0]} frustumCulled>
        <planeGeometry args={[0.6, 1.4]} />
      </mesh>
      <pointLight
        position={[0, 0.5, 0]}
        intensity={1.8}
        distance={7}
        color="#ff4400"
      />
    </group>
  );
}

// ─── Perimeter silhouette ─────────────────────────────────────────────────────
function PerimeterSilhouette({
  position,
  height,
}: {
  position: [number, number, number];
  height: number;
}) {
  const silMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0e0e12"),
        roughness: 1,
        metalness: 0,
      }),
    [],
  );
  return (
    <mesh material={silMat} position={position} castShadow frustumCulled>
      <boxGeometry args={[8 + Math.sin(position[0]) * 3, height, 3]} />
    </mesh>
  );
}

// ─── Military Watchtower ──────────────────────────────────────────────────────
const Watchtower = React.memo(
  function Watchtower({
    position,
    rotation = 0,
  }: { position: [number, number, number]; rotation?: number }) {
    const woodMat = useMemo(() => mat("#3b2a18", 0.9, 0.0), []);
    const darkWoodMat = useMemo(() => mat("#251a0e", 0.95, 0.0), []);
    const floorMat = useMemo(() => mat("#4a3520", 0.88, 0.0), []);

    const legPositions: [number, number, number][] = [
      [-1.5, 4.0, -1.5],
      [1.5, 4.0, -1.5],
      [-1.5, 4.0, 1.5],
      [1.5, 4.0, 1.5],
    ];

    return (
      <group position={position} rotation={[0, rotation, 0]}>
        {legPositions.map((lp, i) => (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={i}
            material={darkWoodMat}
            position={lp}
            castShadow
            frustumCulled
          >
            <boxGeometry args={[0.22, 8.0, 0.22]} />
          </mesh>
        ))}
        {(
          [
            [-1.5, -1.5],
            [1.5, -1.5],
            [-1.5, 1.5],
            [1.5, 1.5],
          ] as [number, number][]
        ).map(([_lx, lz], i) => (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={i}
            material={woodMat}
            position={[0, 2.0, lz]}
            rotation={[0, 0, Math.PI / 4]}
            castShadow
            frustumCulled
          >
            <boxGeometry args={[0.14, 2.4, 0.12]} />
          </mesh>
        ))}
        {(
          [
            [-1.5, -1.5],
            [1.5, -1.5],
            [-1.5, 1.5],
            [1.5, 1.5],
          ] as [number, number][]
        ).map(([lx, _lz], i) => (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={i}
            material={woodMat}
            position={[lx, 2.0, 0]}
            rotation={[Math.PI / 4, 0, 0]}
            castShadow
            frustumCulled
          >
            <boxGeometry args={[0.12, 2.4, 0.14]} />
          </mesh>
        ))}
        <mesh
          material={floorMat}
          position={[0, 8.12, 0]}
          castShadow
          receiveShadow
          frustumCulled
        >
          <boxGeometry args={[4.2, 0.18, 4.2]} />
        </mesh>
        {(
          [
            [0, 8.5, 2.1, 4.2, 0.7, 0.1],
            [0, 8.5, -2.1, 4.2, 0.7, 0.1],
            [2.1, 8.5, 0, 0.1, 0.7, 4.2],
            [-2.1, 8.5, 0, 0.1, 0.7, 4.2],
          ] as [number, number, number, number, number, number][]
        ).map((r, i) => (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={i}
            material={woodMat}
            position={[r[0], r[1], r[2]]}
            castShadow
            frustumCulled
          >
            <boxGeometry args={[r[3], r[4], r[5]]} />
          </mesh>
        ))}
        <mesh
          material={darkWoodMat}
          position={[0, 9.5, 0]}
          castShadow
          frustumCulled
        >
          <boxGeometry args={[3.2, 2.0, 3.2]} />
        </mesh>
        <mesh position={[0, 9.5, 0]} frustumCulled>
          <boxGeometry args={[2.6, 1.7, 2.6]} />
          <meshStandardMaterial color="#0a0808" roughness={1} />
        </mesh>
        <mesh
          material={woodMat}
          position={[0, 10.65, 0]}
          castShadow
          frustumCulled
        >
          <boxGeometry args={[3.6, 0.28, 3.6]} />
        </mesh>
        {([0, Math.PI / 2, Math.PI, -Math.PI / 2] as number[]).map((ry, i) => (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={i}
            position={[Math.sin(ry) * 1.61, 9.5, Math.cos(ry) * 1.61]}
            rotation={[0, ry, 0]}
            frustumCulled
          >
            <boxGeometry args={[0.9, 0.35, 0.12]} />
            <meshStandardMaterial color="#060505" roughness={1} />
          </mesh>
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={i}
            material={woodMat}
            position={[1.6, 1.0 + i * 0.9, -1.5]}
            castShadow
            frustumCulled
          >
            <boxGeometry args={[0.08, 0.08, 0.5]} />
          </mesh>
        ))}
      </group>
    );
  },
  () => true,
);

// ─── Catenary cable helper ────────────────────────────────────────────────────
function CatenaryCable({
  from,
  to,
  sag = 1.5,
  segments = 6,
  wireMat,
}: {
  from: [number, number, number];
  to: [number, number, number];
  sag?: number;
  segments?: number;
  wireMat: THREE.Material;
}) {
  const ax = from[0];
  const ay = from[1];
  const az = from[2];
  const bx = to[0];
  const by = to[1];
  const bz = to[2];
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2 - sag;
  const cz = (az + bz) / 2;

  const points: [number, number, number][] = [];
  const n = segments + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    points.push([
      mt * mt * ax + 2 * mt * t * cx + t * t * bx,
      mt * mt * ay + 2 * mt * t * cy + t * t * by,
      mt * mt * az + 2 * mt * t * cz + t * t * bz,
    ]);
  }

  const segments2 = points.length - 1;
  return (
    <>
      {Array.from({ length: segments2 }).map((_, i) => {
        const p0 = points[i];
        const p1 = points[i + 1];
        const dx = p1[0] - p0[0];
        const dy = p1[1] - p0[1];
        const dz = p1[2] - p0[2];
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const mx = (p0[0] + p1[0]) / 2;
        const my = (p0[1] + p1[1]) / 2;
        const mz = (p0[2] + p1[2]) / 2;

        const dir = new THREE.Vector3(dx, dy, dz).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
        const euler = new THREE.Euler().setFromQuaternion(quat);

        return (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={i}
            material={wireMat}
            position={[mx, my, mz]}
            rotation={euler}
            frustumCulled
          >
            <cylinderGeometry args={[0.016, 0.016, length, 3]} />
          </mesh>
        );
      })}
    </>
  );
}

// ─── Power pole layout constants (module-level = stable) ──────────────────────
const POLE_COUNT = 10;
const POLE_Z = -45;
const POLE_X_START = -55;
const POLE_X_END = 55;
const INSULATOR_X = [-2.1, 0, 2.1];
const POLE_H = 13.0;
const INSULATOR_Y = POLE_H - 0.72;

// Pre-compute pole tilts at module level — seededRandom(77) is stable
const POLE_TILTS: number[] = (() => {
  const rng = seededRandom(77);
  return Array.from({ length: POLE_COUNT }).map((_, i) => {
    if (i === 2 || i === 5 || i === 8)
      return (rng() * 0.06 + 0.02) * (rng() > 0.5 ? 1 : -1);
    rng();
    return 0;
  });
})();

// Pre-compute pole insulator attachment points at module level
const POLE_ATTACHMENTS: { x: number; y: number; z: number }[][] = Array.from({
  length: POLE_COUNT,
}).map((_, pi) => {
  const t = pi / (POLE_COUNT - 1);
  const px = POLE_X_START + t * (POLE_X_END - POLE_X_START);
  const pz = POLE_Z;
  const py = INSULATOR_Y;
  return INSULATOR_X.map((ix) => ({ x: px + ix, y: py, z: pz }));
});

// Pre-compute silhouette data at module level
const SILHOUETTE_DATA: { pos: [number, number, number]; height: number }[] =
  (() => {
    const rng = seededRandom(77);
    return Array.from({ length: 24 }).map((_, i) => {
      const angle = (i / 24) * Math.PI * 2;
      const radius = 82;
      const h = 3 + rng() * 9;
      return {
        pos: [Math.cos(angle) * radius, h / 2, Math.sin(angle) * radius] as [
          number,
          number,
          number,
        ],
        height: h,
      };
    });
  })();

// ─── PowerPolePost ────────────────────────────────────────────────────────────
const PowerPolePost = React.memo(
  function PowerPolePost({
    position,
    tilt = 0,
    insulatorPositionsX,
  }: {
    position: [number, number, number];
    tilt?: number;
    insulatorPositionsX: number[];
  }) {
    const poleMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#2a1e12"),
          roughness: 0.93,
          metalness: 0.04,
        }),
      [],
    );
    const crossarmMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#1e1408"),
          roughness: 0.92,
          metalness: 0.03,
        }),
      [],
    );
    const insulatorMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#d8c8a0"),
          roughness: 0.55,
          metalness: 0.0,
        }),
      [],
    );
    const poleH = 13.0;

    return (
      <group position={position} rotation={[tilt, 0, 0]}>
        <mesh
          material={poleMat}
          position={[0, poleH / 2, 0]}
          castShadow
          frustumCulled
        >
          <cylinderGeometry args={[0.1, 0.18, poleH, 9]} />
        </mesh>
        <mesh
          material={crossarmMat}
          position={[0, poleH - 0.8, 0]}
          castShadow
          frustumCulled
        >
          <boxGeometry
            args={[
              insulatorPositionsX[insulatorPositionsX.length - 1] * 2 + 0.5,
              0.15,
              0.15,
            ]}
          />
        </mesh>
        {([-1, 1] as number[]).map((side, i) => (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={i}
            material={crossarmMat}
            position={[
              side *
                (insulatorPositionsX[insulatorPositionsX.length - 1] * 0.55),
              poleH - 1.25,
              0,
            ]}
            rotation={[0, 0, side * -0.38]}
            castShadow
            frustumCulled
          >
            <boxGeometry args={[0.1, 0.9, 0.1]} />
          </mesh>
        ))}
        {insulatorPositionsX.map((ix, i) => (
          <group
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={i}
            position={[ix, poleH - 0.72, 0]}
          >
            <mesh
              material={insulatorMat}
              position={[0, 0.1, 0]}
              castShadow
              frustumCulled
            >
              <cylinderGeometry args={[0.1, 0.08, 0.08, 8]} />
            </mesh>
            <mesh
              material={insulatorMat}
              position={[0, -0.04, 0]}
              castShadow
              frustumCulled
            >
              <cylinderGeometry args={[0.08, 0.12, 0.1, 8]} />
            </mesh>
            <mesh
              material={insulatorMat}
              position={[0, -0.16, 0]}
              castShadow
              frustumCulled
            >
              <cylinderGeometry args={[0.04, 0.04, 0.16, 6]} />
            </mesh>
          </group>
        ))}
        <mesh
          material={poleMat}
          position={[0, poleH * 0.4, 0.13]}
          rotation={[0, 0, 0.1]}
          frustumCulled
        >
          <planeGeometry args={[0.22, 1.5]} />
        </mesh>
      </group>
    );
  },
  () => true,
);

// ─── Bird — fully self-contained, isolated useFrame ──────────────────────────
// Bird position state lives in refs INSIDE this component.
// The parent WarzoneEnvironment NEVER re-renders due to bird movement.
interface BirdData {
  orbitRadius: number;
  orbitSpeed: number;
  phase: number;
  height: number;
  figureEight: boolean;
  scale: number;
  wingPhase: number;
  wingSpeed: number;
}

const Bird = React.memo(function Bird({ data }: { data: BirdData }) {
  const groupRef = useRef<THREE.Group>(null!);
  const leftWingRef = useRef<THREE.Mesh>(null!);
  const rightWingRef = useRef<THREE.Mesh>(null!);

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1a1a1a"),
        roughness: 0.9,
        metalness: 0.0,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      const angle = t * data.orbitSpeed + data.phase;
      let x: number;
      let z: number;
      if (data.figureEight) {
        x = Math.cos(angle) * data.orbitRadius;
        z = Math.sin(angle * 2) * (data.orbitRadius * 0.5);
      } else {
        x = Math.cos(angle) * data.orbitRadius;
        z = Math.sin(angle) * data.orbitRadius;
      }
      const y = data.height + Math.sin(t * 0.4 + data.phase) * 1.2;
      groupRef.current.position.set(x, y, z);
      const dx = -Math.sin(angle) * data.orbitSpeed;
      const dz = Math.cos(angle) * data.orbitSpeed * (data.figureEight ? 2 : 1);
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }
    const flapAngle = Math.sin(t * data.wingSpeed + data.wingPhase) * 0.35;
    if (leftWingRef.current) leftWingRef.current.rotation.z = -flapAngle;
    if (rightWingRef.current) rightWingRef.current.rotation.z = flapAngle;
  });

  return (
    <group ref={groupRef} scale={[data.scale, data.scale, data.scale]}>
      <mesh material={bodyMat} rotation={[0, 0, Math.PI / 2]} frustumCulled>
        <capsuleGeometry args={[0.06, 0.28, 4, 6]} />
      </mesh>
      <mesh
        ref={leftWingRef}
        material={bodyMat}
        position={[-0.28, 0, 0]}
        rotation={[0.1, 0.15, -0.2]}
        frustumCulled
      >
        <boxGeometry args={[0.52, 0.04, 0.18]} />
      </mesh>
      <mesh
        material={bodyMat}
        position={[-0.52, 0.04, -0.06]}
        rotation={[0.15, 0.3, -0.35]}
        frustumCulled
      >
        <boxGeometry args={[0.28, 0.03, 0.1]} />
      </mesh>
      <mesh
        ref={rightWingRef}
        material={bodyMat}
        position={[0.28, 0, 0]}
        rotation={[0.1, -0.15, 0.2]}
        frustumCulled
      >
        <boxGeometry args={[0.52, 0.04, 0.18]} />
      </mesh>
      <mesh
        material={bodyMat}
        position={[0.52, 0.04, -0.06]}
        rotation={[0.15, -0.3, 0.35]}
        frustumCulled
      >
        <boxGeometry args={[0.28, 0.03, 0.1]} />
      </mesh>
      <mesh
        material={bodyMat}
        position={[0, -0.02, 0.2]}
        rotation={[-0.2, 0, 0]}
        frustumCulled
      >
        <boxGeometry args={[0.16, 0.03, 0.22]} />
      </mesh>
    </group>
  );
});

// ─── Bird data — module-level constant, never recomputed ─────────────────────
const BIRD_DATA: BirdData[] = (() => {
  const rng = seededRandom(42);
  return Array.from({ length: 10 }).map((_, i) => ({
    orbitRadius: 18 + rng() * 30,
    orbitSpeed: 0.08 + rng() * 0.12,
    phase: (i / 10) * Math.PI * 2,
    height: 18 + rng() * 12,
    figureEight: i % 3 === 0,
    scale: 0.5 + rng() * 0.5,
    wingPhase: rng() * Math.PI * 2,
    wingSpeed: 2.5 + rng() * 2.0,
  }));
})();

// ─── Static scene data — all at module level ──────────────────────────────────
const VEHICLES: { pos: [number, number, number]; rot: number }[] = [
  { pos: [-8, 0.55, 5], rot: 0.4 },
  { pos: [7, 0.55, -4], rot: 1.9 },
];

const CRATERS: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, -32],
  [0, 0, 32],
  [32, 0, 0],
  [-5, 0, -10],
];

const BARRIERS: { pos: [number, number, number]; rot: number }[] = [
  { pos: [-6, 0.36, -22], rot: 0 },
  { pos: [6, 0.36, -22], rot: 0 },
  { pos: [-8, 0.36, 22], rot: 0 },
  { pos: [8, 0.36, 22], rot: 0 },
  { pos: [22, 0.36, -5], rot: Math.PI / 2 },
  { pos: [22, 0.36, 5], rot: Math.PI / 2 },
  { pos: [-22, 0.36, -5], rot: Math.PI / 2 },
  { pos: [-22, 0.36, 5], rot: Math.PI / 2 },
];

const SANDBAGS: [number, number, number][] = [
  [-15, 0, -15],
  [15, 0, -15],
  [-15, 0, 15],
  [15, 0, 15],
  [0, 0, -18],
  [-3, 0, 18],
];

const FIRES: [number, number, number][] = [
  [-12, 0.5, -26],
  [12, 0.5, -26],
  [-16, 0.5, 27],
  [14, 0.5, 27],
  [36, 0.5, -16],
  [-18, 0.5, -35],
];

const WATCHTOWERS: { pos: [number, number, number]; rot: number }[] = [
  { pos: [-55, 0, -55], rot: Math.PI / 4 },
  { pos: [55, 0, -55], rot: -Math.PI / 4 },
  { pos: [55, 0, 55], rot: Math.PI + Math.PI / 4 },
  { pos: [-55, 0, 55], rot: Math.PI - Math.PI / 4 },
];

// ─── Main Environment ─────────────────────────────────────────────────────────
export function WarzoneEnvironment({
  onActivateNuclear,
  playerPosRef,
  nuclearEventActive = false,
}: {
  onActivateNuclear?: () => void;
  playerPosRef?: React.MutableRefObject<[number, number, number]>;
  nuclearEventActive?: boolean;
}) {
  // Wire material — shared across all catenary cables
  const wireMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#2a2a2a"),
        roughness: 0.6,
        metalness: 0.6,
      }),
    [],
  );

  return (
    <group>
      <WarzoneSky />
      <WarzoneGround />

      {/* ── Destroyed buildings ───────────────────────────────────── */}
      {/* Map directly over module-level constant — no inline array creation,
          no computed props that could differ between renders. */}
      {WARZONE_BUILDING_DEFS.map((def, idx) => (
        <DestroyedBuilding
          key={`building-${def.x}-${def.z}`}
          position={[def.x, def.groundY, def.z]}
          width={def.w}
          height={def.h}
          depth={def.d}
          seed={def.seed}
          buildingIndex={idx}
        />
      ))}

      {/* ── Burned vehicles ──────────────────────────────────────── */}
      {VEHICLES.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <BurnedVehicle key={i} position={v.pos} rotation={v.rot} />
      ))}

      {/* ── Blast craters ────────────────────────────────────────── */}
      {CRATERS.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <BlastCrater key={i} position={c} />
      ))}

      {/* ── Jersey barriers ──────────────────────────────────────── */}
      {BARRIERS.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <JerseyBarrier key={i} position={b.pos} rotation={b.rot} />
      ))}

      {/* ── Sandbag piles ────────────────────────────────────────── */}
      {SANDBAGS.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <SandbagPile key={i} position={s} />
      ))}

      {/* ── Fires ────────────────────────────────────────────────── */}
      {FIRES.map((f, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <FireEmber key={i} position={f} />
      ))}

      {/* ── Perimeter silhouettes ─────────────────────────────────── */}
      {SILHOUETTE_DATA.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <PerimeterSilhouette key={i} position={s.pos} height={s.height} />
      ))}

      {/* ── Watchtowers ──────────────────────────────────────────── */}
      {WATCHTOWERS.map((w, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <Watchtower key={i} position={w.pos} rotation={w.rot} />
      ))}

      {/* ── Power poles — straight line ───────────────────────────── */}
      {Array.from({ length: POLE_COUNT }).map((_, pi) => {
        const t = pi / (POLE_COUNT - 1);
        const px = POLE_X_START + t * (POLE_X_END - POLE_X_START);
        return (
          <PowerPolePost
            // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
            key={pi}
            position={[px, 0, POLE_Z]}
            tilt={POLE_TILTS[pi]}
            insulatorPositionsX={INSULATOR_X}
          />
        );
      })}

      {/* ── Catenary cables between adjacent poles (3 wires each span) ── */}
      {Array.from({ length: POLE_COUNT - 1 }).map((_, spanIdx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <group key={spanIdx}>
          {INSULATOR_X.map((_, wireIdx) => {
            const a = POLE_ATTACHMENTS[spanIdx][wireIdx];
            const b = POLE_ATTACHMENTS[spanIdx + 1][wireIdx];
            return (
              <CatenaryCable
                // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
                key={wireIdx}
                from={[a.x, a.y, a.z]}
                to={[b.x, b.y, b.z]}
                sag={1.5}
                segments={7}
                wireMat={wireMat}
              />
            );
          })}
        </group>
      ))}

      {/* ── Birds — each fully self-contained, no parent re-render ─── */}
      {BIRD_DATA.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: animated birds
        <Bird key={i} data={b} />
      ))}

      {/* ── Lighting ─────────────────────────────────────────────── */}
      <ambientLight intensity={0.3} color="#5a6070" />
      <directionalLight
        position={[40, 70, 30]}
        intensity={1.0}
        color="#8090aa"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <pointLight
        position={[-8, 4, 5]}
        intensity={1.2}
        distance={28}
        color="#ff4400"
      />
      <pointLight
        position={[7, 4, -4]}
        intensity={0.9}
        distance={22}
        color="#ff6600"
      />
      <hemisphereLight args={["#404560", "#1a1208", 0.25]} />

      {/* ── Nuclear Machine ───────────────────────────────────────── */}
      {onActivateNuclear && playerPosRef && (
        <NuclearMachine
          position={NUCLEAR_MACHINE_POSITION}
          onActivate={onActivateNuclear}
          playerPosRef={playerPosRef}
          isActivated={nuclearEventActive}
        />
      )}
    </group>
  );
}
