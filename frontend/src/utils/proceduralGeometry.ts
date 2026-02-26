import * as THREE from 'three';

export interface BuildingData {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  color: string;
  type: 'building' | 'ruin' | 'barrier' | 'rubble';
}

// Axis-aligned bounding box for collision detection (XZ plane)
export interface CollisionAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MountainSegmentData {
  position: [number, number, number];
  peakHeight: number;
  baseWidth: number;
  baseDepth: number;
  rotation: number;
  ridgeOffsets: { x: number; z: number; h: number; w: number; d: number }[];
  boulderOffsets: { x: number; z: number; h: number; r: number }[];
  colorIndex: number;
}

// Seeded pseudo-random for deterministic level generation
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function generateBuildingData(): BuildingData[] {
  const rng = seededRandom(42);
  const buildings: BuildingData[] = [];

  const desertColors = [
    '#c4a35a', '#b8864e', '#8b6914', '#a0522d', '#cd853f',
    '#d2691e', '#8b4513', '#a0522d', '#c19a6b', '#deb887',
  ];

  // Ring of buildings around the arena
  const ringPositions: [number, number][] = [];

  // Inner ring
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = 25 + rng() * 8;
    ringPositions.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }

  // Outer ring
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + 0.2;
    const radius = 45 + rng() * 12;
    ringPositions.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }

  // Scattered buildings
  for (let i = 0; i < 8; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 15 + rng() * 30;
    ringPositions.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }

  ringPositions.forEach(([x, z]) => {
    const typeRoll = rng();
    const color = desertColors[Math.floor(rng() * desertColors.length)];

    if (typeRoll < 0.5) {
      // Building
      const w = 4 + rng() * 8;
      const h = 5 + rng() * 15;
      const d = 4 + rng() * 8;
      buildings.push({
        position: [x, h / 2, z],
        width: w, height: h, depth: d,
        color, type: 'building',
      });
    } else if (typeRoll < 0.75) {
      // Ruin (shorter, irregular)
      const w = 5 + rng() * 6;
      const h = 2 + rng() * 5;
      const d = 5 + rng() * 6;
      buildings.push({
        position: [x, h / 2, z],
        width: w, height: h, depth: d,
        color, type: 'ruin',
      });
    } else if (typeRoll < 0.88) {
      // Barrier
      const w = 1 + rng() * 2;
      const h = 1.5 + rng() * 1.5;
      const d = 3 + rng() * 4;
      buildings.push({
        position: [x, h / 2, z],
        width: w, height: h, depth: d,
        color: '#8b7355', type: 'barrier',
      });
    } else {
      // Rubble pile
      buildings.push({
        position: [x, 0.5, z],
        width: 2 + rng() * 3,
        height: 1 + rng() * 2,
        depth: 2 + rng() * 3,
        color: '#7a6040', type: 'rubble',
      });
    }
  });

  return buildings;
}

/**
 * Generate collision AABBs for all buildings/objects.
 * Each AABB is slightly expanded by a margin to account for player radius.
 */
export function generateCollisionAABBs(playerRadius = 0.4): CollisionAABB[] {
  const buildings = generateBuildingData();
  const aabbs: CollisionAABB[] = [];

  for (const b of buildings) {
    const [bx, , bz] = b.position;
    const halfW = b.width / 2 + playerRadius;
    const halfD = b.depth / 2 + playerRadius;
    aabbs.push({
      minX: bx - halfW,
      maxX: bx + halfW,
      minZ: bz - halfD,
      maxZ: bz + halfD,
    });
  }

  return aabbs;
}

/**
 * Generate mountain ring segment data for the perimeter barrier.
 * Mountains are placed in a ring at radius ~62-80 units, with varied heights and profiles.
 */
export function generateMountainRingGeometry(): MountainSegmentData[] {
  const rng = seededRandom(137);
  const segments: MountainSegmentData[] = [];

  // Total number of mountain peaks around the ring
  const totalPeaks = 48;

  for (let i = 0; i < totalPeaks; i++) {
    const angle = (i / totalPeaks) * Math.PI * 2;
    // Vary the radius slightly for a natural, uneven ring
    const radius = 68 + rng() * 10;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Peak height varies significantly for natural skyline
    const peakHeight = 18 + rng() * 28;

    // Base dimensions — wider mountains have more ridges
    const baseWidth = 14 + rng() * 12;
    const baseDepth = 12 + rng() * 10;

    // Rotation faces inward (toward center) with slight variation
    const rotation = angle + Math.PI + (rng() - 0.5) * 0.4;

    // Ridge sub-peaks layered on the main peak
    const ridgeCount = 2 + Math.floor(rng() * 4);
    const ridgeOffsets: MountainSegmentData['ridgeOffsets'] = [];
    for (let r = 0; r < ridgeCount; r++) {
      ridgeOffsets.push({
        x: (rng() - 0.5) * baseWidth * 0.7,
        z: (rng() - 0.5) * baseDepth * 0.5,
        h: peakHeight * (0.35 + rng() * 0.55),
        w: baseWidth * (0.3 + rng() * 0.4),
        d: baseDepth * (0.3 + rng() * 0.35),
      });
    }

    // Boulder clusters at the base
    const boulderCount = 3 + Math.floor(rng() * 5);
    const boulderOffsets: MountainSegmentData['boulderOffsets'] = [];
    for (let b = 0; b < boulderCount; b++) {
      boulderOffsets.push({
        x: (rng() - 0.5) * baseWidth * 0.9,
        z: (rng() - 0.5) * baseDepth * 0.8,
        h: 1.5 + rng() * 3.5,
        r: 1.2 + rng() * 2.2,
      });
    }

    // Color index for stone palette variation
    const colorIndex = Math.floor(rng() * 6);

    segments.push({
      position: [x, 0, z],
      peakHeight,
      baseWidth,
      baseDepth,
      rotation,
      ridgeOffsets,
      boulderOffsets,
      colorIndex,
    });
  }

  return segments;
}

/**
 * Generate collision AABBs for the mountain ring perimeter.
 * Returns a continuous ring of overlapping AABBs that block player movement.
 */
export function generateMountainCollisionAABBs(playerRadius = 0.4): CollisionAABB[] {
  // Use a dense ring of rectangular collision boxes to form a continuous barrier
  // The ring starts at radius 60 (inner edge) and extends outward
  const aabbs: CollisionAABB[] = [];
  const innerRadius = 60;
  const outerRadius = 90;
  const segmentCount = 64; // Dense enough to have no gaps

  for (let i = 0; i < segmentCount; i++) {
    const angle = (i / segmentCount) * Math.PI * 2;
    const nextAngle = ((i + 1) / segmentCount) * Math.PI * 2;

    // Midpoint of this arc segment
    const midAngle = (angle + nextAngle) / 2;
    const midRadius = (innerRadius + outerRadius) / 2;
    const cx = Math.cos(midAngle) * midRadius;
    const cz = Math.sin(midAngle) * midRadius;

    // Width of the arc segment (chord length at inner radius + overlap)
    const chordLen = 2 * innerRadius * Math.tan(Math.PI / segmentCount) + 4;
    const depth = outerRadius - innerRadius + 4;

    // Rotate the AABB to align with the arc — approximate with a generous box
    // We use a rotated approach: compute the corners of the segment
    const cosA = Math.cos(midAngle);
    const sinA = Math.sin(midAngle);

    // Half-extents in local space (tangential x depth)
    const halfTangential = chordLen / 2 + playerRadius;
    const halfRadial = depth / 2 + playerRadius;

    // Project to world-axis-aligned box (conservative AABB of the rotated box)
    const projX = Math.abs(cosA) * halfRadial + Math.abs(sinA) * halfTangential;
    const projZ = Math.abs(sinA) * halfRadial + Math.abs(cosA) * halfTangential;

    aabbs.push({
      minX: cx - projX,
      maxX: cx + projX,
      minZ: cz - projZ,
      maxZ: cz + projZ,
    });
  }

  return aabbs;
}

export function createRubbleGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  // Distort vertices for irregular look
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const noise = 0.7 + Math.random() * 0.6;
    positions.setXYZ(i, x * noise, y * noise * 0.5, z * noise);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generate exactly 10 deterministic palm tree positions using rejection sampling.
 * Constraints:
 *  - Within playable arena (radius < 55 from center, away from mountain inner edge at ~60)
 *  - Not overlapping any building AABB (with palm trunk radius margin of 1.5)
 *  - Not too close to the Pack-a-Punch machine at [15, 0, -12]
 *  - Minimum 8-unit spacing between palms
 *  - Not in the very center spawn area (radius < 6)
 */
export function generatePalmTreePositions(): [number, number, number][] {
  const rng = seededRandom(314159);

  // Get building AABBs with extra margin for palm trunk
  const palmMargin = 2.5;
  const buildings = generateBuildingData();
  const buildingAABBs: CollisionAABB[] = buildings.map(b => {
    const [bx, , bz] = b.position;
    const halfW = b.width / 2 + palmMargin;
    const halfD = b.depth / 2 + palmMargin;
    return {
      minX: bx - halfW,
      maxX: bx + halfW,
      minZ: bz - halfD,
      maxZ: bz + halfD,
    };
  });

  // Pack-a-Punch machine position and exclusion zone
  const papX = 15;
  const papZ = -12;
  const papExclusionRadius = 5;

  // Playable arena constraints
  const maxRadius = 54; // well inside mountain inner edge (~60)
  const minRadius = 6;  // avoid player spawn area

  const positions: [number, number, number][] = [];
  const minPalmSpacing = 8;
  const maxAttempts = 10000;
  let attempts = 0;

  while (positions.length < 10 && attempts < maxAttempts) {
    attempts++;

    // Sample random position within arena using polar coords for uniform distribution
    const angle = rng() * Math.PI * 2;
    const r = minRadius + rng() * (maxRadius - minRadius);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    // Check distance from center (spawn area)
    const distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter < minRadius) continue;

    // Check within playable arena
    if (distFromCenter > maxRadius) continue;

    // Check against building AABBs
    let insideBuilding = false;
    for (const aabb of buildingAABBs) {
      if (x >= aabb.minX && x <= aabb.maxX && z >= aabb.minZ && z <= aabb.maxZ) {
        insideBuilding = true;
        break;
      }
    }
    if (insideBuilding) continue;

    // Check against Pack-a-Punch machine
    const distToPap = Math.sqrt((x - papX) ** 2 + (z - papZ) ** 2);
    if (distToPap < papExclusionRadius) continue;

    // Check minimum spacing from other palms
    let tooClose = false;
    for (const [px, , pz] of positions) {
      const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2);
      if (dist < minPalmSpacing) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    positions.push([x, 0, z]);
  }

  return positions;
}

// Pre-computed palm tree positions (deterministic, same every render)
export const PALM_TREE_POSITIONS: [number, number, number][] = generatePalmTreePositions();
