import { useMemo } from "react";
import * as THREE from "three";
import { sandFragmentShader, sandVertexShader } from "../../shaders/sandShader";
import { skyFragmentShader, skyVertexShader } from "../../shaders/skyShader";
import {
  type BuildingData,
  JUGGERNOG_POSITION,
  PALM_TREE_POSITIONS,
  generateBuildingData,
} from "../../utils/proceduralGeometry";
import JuggernogMachine from "./JuggernogMachine";
import { MountainBarrier } from "./MountainBarrier";
import { PackAPunchMachine } from "./PackAPunchMachine";
import { PalmTree } from "./PalmTree";
import { useOutlineMaterial } from "./ToonMaterial";

interface DesertEnvironmentProps {
  upgradeTier?: number;
  juggernogPurchaseCount?: number;
}

// ─── Shared PBR material helpers ─────────────────────────────────────────────
function usePBRMat(
  color: string,
  roughness = 0.82,
  metalness = 0.0,
  emissive?: string,
  emissiveIntensity = 0,
) {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness,
        metalness,
        emissive: emissive ? new THREE.Color(emissive) : undefined,
        emissiveIntensity,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, roughness, metalness, emissive, emissiveIntensity],
  );
}

// ─── Window component ─────────────────────────────────────────────────────────
function Window({
  position,
  width = 0.7,
  height = 1.0,
  frameColor,
  hasLight = false,
}: {
  position: [number, number, number];
  width?: number;
  height?: number;
  frameColor: string;
  hasLight?: boolean;
}) {
  const frameMat = usePBRMat(frameColor, 0.75);
  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: hasLight
          ? new THREE.Color(0.9, 0.8, 0.5)
          : new THREE.Color(0.04, 0.07, 0.14),
        roughness: 0.05,
        metalness: 0.6,
        emissive: hasLight
          ? new THREE.Color(0.4, 0.3, 0.1)
          : new THREE.Color(0.01, 0.02, 0.05),
        emissiveIntensity: hasLight ? 0.8 : 0.3,
        transparent: true,
        opacity: hasLight ? 0.85 : 0.7,
      }),
    [hasLight],
  );
  const sillMat = usePBRMat(frameColor, 0.6);

  return (
    <group position={position}>
      {/* Outer frame recess */}
      <mesh material={frameMat}>
        <boxGeometry args={[width + 0.14, height + 0.14, 0.12]} />
      </mesh>
      {/* Glass pane */}
      <mesh material={glassMat} position={[0, 0, 0.04]}>
        <boxGeometry args={[width, height, 0.04]} />
      </mesh>
      {/* Window sill below */}
      <mesh material={sillMat} position={[0, -(height / 2 + 0.08), 0.04]}>
        <boxGeometry args={[width + 0.24, 0.1, 0.18]} />
      </mesh>
      {/* Window lintel above */}
      <mesh material={sillMat} position={[0, height / 2 + 0.07, 0]}>
        <boxGeometry args={[width + 0.2, 0.08, 0.12]} />
      </mesh>
      {/* Vertical divider */}
      <mesh material={frameMat} position={[0, 0, 0.06]}>
        <boxGeometry args={[0.04, height - 0.04, 0.03]} />
      </mesh>
    </group>
  );
}

// ─── Balcony component ────────────────────────────────────────────────────────
function Balcony({
  position,
  width,
  floorColor,
  railColor,
}: {
  position: [number, number, number];
  width: number;
  floorColor: string;
  railColor: string;
}) {
  const floorMat = usePBRMat(floorColor, 0.88);
  const railMat = usePBRMat(railColor, 0.7, 0.1);
  const postCount = Math.max(2, Math.floor(width / 0.6));

  return (
    <group position={position}>
      {/* Slab */}
      <mesh material={floorMat} castShadow>
        <boxGeometry args={[width + 0.3, 0.12, 0.9]} />
      </mesh>
      {/* Front rail */}
      <mesh material={railMat} position={[0, 0.45, 0.38]}>
        <boxGeometry args={[width + 0.28, 0.06, 0.04]} />
      </mesh>
      {/* Posts */}
      {Array.from({ length: postCount }).map((_, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={i}
          material={railMat}
          position={[-width / 2 + (i / (postCount - 1)) * width, 0.22, 0.38]}
        >
          <boxGeometry args={[0.06, 0.5, 0.06]} />
        </mesh>
      ))}
      {/* Side rails */}
      {[-1, 1].map((s, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={i}
          material={railMat}
          position={[s * (width / 2 + 0.14), 0.45, 0.18]}
        >
          <boxGeometry args={[0.06, 0.06, 0.42]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Rooftop AC Unit ─────────────────────────────────────────────────────────
function ACUnit({ position }: { position: [number, number, number] }) {
  const bodyMat = usePBRMat("#7a8088", 0.7, 0.3);
  const ventMat = usePBRMat("#55595e", 0.8, 0.2);
  return (
    <group position={position}>
      <mesh material={bodyMat} castShadow>
        <boxGeometry args={[0.9, 0.55, 0.7]} />
      </mesh>
      {/* Vent slats */}
      {[-0.2, 0, 0.2].map((y, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={i}
          material={ventMat}
          position={[0, y, 0.36]}
        >
          <boxGeometry args={[0.75, 0.07, 0.04]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Water Tank ───────────────────────────────────────────────────────────────
function WaterTank({ position }: { position: [number, number, number] }) {
  const tankMat = usePBRMat("#8a7060", 0.85);
  const bandMat = usePBRMat("#5a4030", 0.7, 0.1);
  return (
    <group position={position}>
      {/* Cylinder legs */}
      {[-0.3, 0.3].map((x, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={i}
          material={bandMat}
          position={[x, -0.3, 0]}
        >
          <boxGeometry args={[0.08, 0.5, 0.08]} />
        </mesh>
      ))}
      {/* Tank body */}
      <mesh material={tankMat} position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.7, 10]} />
      </mesh>
      {/* Bands */}
      {[-0.15, 0.15].map((y, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={i}
          material={bandMat}
          position={[0, y + 0.1, 0]}
        >
          <torusGeometry args={[0.36, 0.03, 6, 12]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Realistic intact building ───────────────────────────────────────────────
function IntactBuilding({
  position,
  width,
  height,
  depth,
  color,
}: {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  color: string;
}) {
  // Derive realistic colour palette from base color
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const wallColor = useMemo(() => {
    // Desaturate slightly & lighten for concrete/stucco feel
    const c = baseColor.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return `#${new THREE.Color().setHSL(hsl.h, hsl.s * 0.4, Math.min(1, hsl.l * 1.1)).getHexString()}`;
  }, [baseColor]);

  const trimColor = useMemo(() => {
    const c = baseColor.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return `#${new THREE.Color().setHSL(hsl.h, hsl.s * 0.3, Math.max(0, hsl.l * 0.75)).getHexString()}`;
  }, [baseColor]);

  const accentColor = useMemo(() => {
    const c = baseColor.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return `#${new THREE.Color().setHSL(hsl.h, hsl.s * 0.5, Math.min(1, hsl.l * 1.3)).getHexString()}`;
  }, [baseColor]);

  const wallMat = usePBRMat(wallColor, 0.88);
  const trimMat = usePBRMat(trimColor, 0.78);
  const accentMat = usePBRMat(accentColor, 0.65);
  const concreteMat = usePBRMat("#b0a898", 0.9);
  const outlineMat = useOutlineMaterial(0.08);

  const parapetH = 0.5;
  const floorH = 3.2;
  const numFloors = Math.max(1, Math.round(height / floorH));
  const windowCols = Math.max(1, Math.floor(width / 2.8));
  const windowW = 0.65;
  const windowH = 0.9;

  // Window grid
  const windowGrid = useMemo(() => {
    const wins: { x: number; y: number; hasLight: boolean }[] = [];
    for (let fl = 0; fl < numFloors; fl++) {
      const y = -height / 2 + (fl + 0.55) * (height / numFloors) + 0.2;
      for (let col = 0; col < windowCols; col++) {
        const x = (col - (windowCols - 1) / 2) * (width / windowCols);
        wins.push({ x, y, hasLight: Math.sin(fl * 3.1 + col * 1.7) > 0.2 });
      }
    }
    return wins;
  }, [numFloors, windowCols, width, height]);

  // Which floors get balconies (every other floor, skip ground)
  const balconyFloors = useMemo(() => {
    const floors: number[] = [];
    for (let fl = 1; fl < numFloors; fl += 2) {
      floors.push(fl);
    }
    return floors;
  }, [numFloors]);

  // Rooftop details
  const hasWaterTank = width > 5;
  const acUnitCount = Math.floor(width / 4);

  return (
    <group position={position}>
      {/* ── Main wall body ── */}
      <mesh material={wallMat} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      <mesh material={outlineMat}>
        <boxGeometry args={[width + 0.06, height + 0.06, depth + 0.06]} />
      </mesh>

      {/* ── Plinth / base band ── */}
      <mesh material={trimMat} position={[0, -height / 2 + 0.5, 0]} castShadow>
        <boxGeometry args={[width + 0.2, 1.0, depth + 0.2]} />
      </mesh>

      {/* ── Horizontal floor separation bands ── */}
      {Array.from({ length: numFloors - 1 }).map((_, i) => {
        const bandY = -height / 2 + (i + 1) * (height / numFloors);
        return (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static
            key={`band-${i}`}
            material={accentMat}
            position={[0, bandY, 0]}
          >
            <boxGeometry args={[width + 0.14, 0.18, depth + 0.14]} />
          </mesh>
        );
      })}

      {/* ── Corner pilasters full height ── */}
      {(
        [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ] as [number, number][]
      ).map(([sx, sz], i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={`pilaster-${i}`}
          material={trimMat}
          position={[sx * (width / 2 + 0.1), 0, sz * (depth / 2 + 0.1)]}
          castShadow
        >
          <boxGeometry args={[0.28, height + parapetH, 0.28]} />
        </mesh>
      ))}

      {/* ── Parapet ── */}
      <mesh
        material={concreteMat}
        position={[0, height / 2 + parapetH / 2, 0]}
        castShadow
      >
        <boxGeometry args={[width + 0.35, parapetH, depth + 0.35]} />
      </mesh>
      {/* Parapet merlons (crenellations) */}
      {Array.from({ length: Math.floor(width * 1.2) }).map((_, i, arr) => {
        const t = i / (arr.length - 1);
        const x = -width / 2 + t * width;
        return (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static
            key={`merlon-${i}`}
            material={concreteMat}
            position={[x, height / 2 + parapetH + 0.18, 0]}
          >
            <boxGeometry args={[0.22, 0.36, depth + 0.4]} />
          </mesh>
        );
      })}

      {/* ── Roof slab ── */}
      <mesh material={trimMat} position={[0, height / 2 + parapetH + 0.08, 0]}>
        <boxGeometry args={[width + 0.12, 0.14, depth + 0.12]} />
      </mesh>

      {/* ── Front face windows ── */}
      {windowGrid.map((w, i) => (
        <Window
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={`wf-${i}`}
          position={[w.x, w.y, depth / 2 + 0.05]}
          width={windowW}
          height={windowH}
          frameColor={trimColor}
          hasLight={w.hasLight}
        />
      ))}

      {/* ── Back face windows ── */}
      {windowGrid.map((w, i) => (
        <Window
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={`wb-${i}`}
          position={[w.x, w.y, -(depth / 2 + 0.05)]}
          width={windowW}
          height={windowH}
          frameColor={trimColor}
          hasLight={w.hasLight}
        />
      ))}

      {/* ── Side windows (left/right) ── */}
      {windowGrid
        .slice(0, Math.floor(windowGrid.length / windowCols))
        .map((w, i) => {
          const sideWins = Math.max(1, Math.floor(depth / 3.0));
          return Array.from({ length: sideWins }).map((_, j) => {
            const xOff = (j - (sideWins - 1) / 2) * (depth / sideWins);
            return (
              <group
                // biome-ignore lint/suspicious/noArrayIndexKey: static
                key={`ws-${i}-${j}`}
              >
                <Window
                  position={[-(width / 2 + 0.05), w.y, xOff]}
                  width={windowW * 0.85}
                  height={windowH}
                  frameColor={trimColor}
                  hasLight={w.hasLight}
                />
                <Window
                  position={[width / 2 + 0.05, w.y, xOff]}
                  width={windowW * 0.85}
                  height={windowH}
                  frameColor={trimColor}
                  hasLight={w.hasLight}
                />
              </group>
            );
          });
        })}

      {/* ── Balconies on alternating floors ── */}
      {balconyFloors.map((fl, i) => {
        const by = -height / 2 + (fl + 0.06) * (height / numFloors);
        return (
          <Balcony
            // biome-ignore lint/suspicious/noArrayIndexKey: static
            key={`bal-${i}`}
            position={[0, by, depth / 2 + 0.45]}
            width={width * 0.6}
            floorColor={trimColor}
            railColor={accentColor}
          />
        );
      })}

      {/* ── Main entrance ── */}
      <group position={[0, -height / 2 + 1.2, depth / 2 + 0.01]}>
        {/* Door arch surround */}
        <mesh material={accentMat}>
          <boxGeometry args={[1.4, 2.6, 0.18]} />
        </mesh>
        {/* Door panels */}
        <mesh position={[-0.33, -0.05, 0.1]}>
          <boxGeometry args={[0.52, 2.1, 0.08]} />
          <meshStandardMaterial color="#2a1a0a" roughness={0.9} />
        </mesh>
        <mesh position={[0.33, -0.05, 0.1]}>
          <boxGeometry args={[0.52, 2.1, 0.08]} />
          <meshStandardMaterial color="#2a1a0a" roughness={0.9} />
        </mesh>
        {/* Door frame top */}
        <mesh material={trimMat} position={[0, 1.15, 0.05]}>
          <boxGeometry args={[1.42, 0.18, 0.14]} />
        </mesh>
        {/* Overhang canopy */}
        <mesh material={concreteMat} position={[0, 1.45, 0.5]}>
          <boxGeometry args={[1.8, 0.1, 1.1]} />
        </mesh>
        {/* Canopy supports */}
        {[-0.65, 0.65].map((x, i) => (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: static
            key={i}
            material={trimMat}
            position={[x, 1.3, 0.9]}
          >
            <boxGeometry args={[0.1, 0.35, 0.1]} />
          </mesh>
        ))}
        {/* Steps */}
        <mesh material={trimMat} position={[0, -1.1, 0.35]}>
          <boxGeometry args={[1.6, 0.12, 0.7]} />
        </mesh>
        <mesh material={trimMat} position={[0, -1.2, 0.7]}>
          <boxGeometry args={[1.8, 0.1, 0.5]} />
        </mesh>
      </group>

      {/* ── Rooftop equipment ── */}
      {Array.from({ length: acUnitCount }).map((_, i) => (
        <ACUnit
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={`ac-${i}`}
          position={[
            -width / 2 + 1 + i * 2.2,
            height / 2 + parapetH + 0.42,
            depth * 0.2,
          ]}
        />
      ))}
      {hasWaterTank && (
        <WaterTank
          position={[
            width / 2 - 1.2,
            height / 2 + parapetH + 0.65,
            -depth * 0.2,
          ]}
        />
      )}
    </group>
  );
}

// ─── Ruined / damaged building ────────────────────────────────────────────────
function RuinedBuilding({
  position,
  width,
  height,
  depth,
  color,
}: {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
  color: string;
}) {
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const wallColor = useMemo(() => {
    const c = baseColor.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return `#${new THREE.Color().setHSL(hsl.h, hsl.s * 0.35, Math.min(1, hsl.l * 0.95)).getHexString()}`;
  }, [baseColor]);

  const darkColor = useMemo(() => {
    const c = baseColor.clone();
    c.multiplyScalar(0.45);
    return `#${c.getHexString()}`;
  }, [baseColor]);

  const wallMat = usePBRMat(wallColor, 0.92);
  const darkMat = usePBRMat(darkColor, 0.95);
  const exposedMat = usePBRMat("#8a7060", 0.93);
  const steelMat = usePBRMat("#5a4a3a", 0.6, 0.4);
  const rubbleMat = usePBRMat("#7a6a55", 0.95);
  const outlineMat = useOutlineMaterial(0.08);

  const wallSections = useMemo(
    () => [
      { xOff: -width * 0.22, hMult: 0.85, wFrac: 0.48 },
      { xOff: width * 0.26, hMult: 0.55, wFrac: 0.44 },
    ],
    [width],
  );

  return (
    <group position={position}>
      {/* Base */}
      <mesh material={wallMat} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      <mesh material={outlineMat}>
        <boxGeometry args={[width + 0.06, height + 0.06, depth + 0.06]} />
      </mesh>

      {/* Broken upper wall sections */}
      {wallSections.map((s, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={`ws-${i}`}
          material={i % 2 === 0 ? wallMat : darkMat}
          position={[s.xOff, height / 2 + height * s.hMult * 0.25, 0]}
          castShadow
        >
          <boxGeometry
            args={[width * s.wFrac, height * s.hMult * 0.5, depth * 0.9]}
          />
        </mesh>
      ))}

      {/* Exposed interior – dark cavity */}
      <mesh material={darkMat} position={[0, height * 0.08, 0]}>
        <boxGeometry args={[width * 0.7, height * 0.55, depth * 0.65]} />
      </mesh>

      {/* Exposed brick/rebar layer */}
      <mesh
        material={exposedMat}
        position={[width * 0.15, height * 0.1, depth / 2 - 0.05]}
      >
        <boxGeometry args={[width * 0.3, height * 0.4, 0.12]} />
      </mesh>

      {/* Rebar sticking out */}
      {[-0.15, 0, 0.15].map((ox, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={`rebar-${i}`}
          material={steelMat}
          position={[ox + width * 0.1, height / 2 + 0.6 + i * 0.12, 0]}
          rotation={[0.2 + i * 0.1, 0, -0.15 + ox * 0.4]}
        >
          <cylinderGeometry args={[0.03, 0.03, 1.1 + i * 0.2, 5]} />
        </mesh>
      ))}

      {/* Cracked window openings */}
      {(
        [
          { x: -width * 0.22, y: height * 0.08, w: 0.7, h: 0.95 },
          { x: width * 0.22, y: -height * 0.06, w: 0.55, h: 0.8 },
        ] as { x: number; y: number; w: number; h: number }[]
      ).map((wnd, i) => (
        <group
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={`cwin-${i}`}
          position={[wnd.x, wnd.y, depth / 2 + 0.02]}
        >
          <mesh>
            <boxGeometry args={[wnd.w + 0.14, wnd.h + 0.14, 0.14]} />
            <meshStandardMaterial color="#1a100a" roughness={1} />
          </mesh>
          {/* Broken frame shards */}
          <mesh position={[wnd.w / 3, wnd.h / 3, 0.04]} rotation={[0, 0, 0.4]}>
            <boxGeometry args={[0.12, 0.25, 0.06]} />
            <meshStandardMaterial color="#6a5540" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Rubble heap at base */}
      {([-0.4, 0, 0.4] as number[]).map((xi, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={`rubble-${i}`}
          material={rubbleMat}
          position={[
            xi * width * 0.35,
            -height / 2 + 0.3,
            depth / 2 + 0.35 + i * 0.22,
          ]}
          scale={[0.7 + i * 0.18, 0.45, 0.55 + i * 0.1]}
          rotation={[0.1 * i, 0.5 * i, 0.2 * i]}
        >
          <dodecahedronGeometry args={[0.5, 0]} />
        </mesh>
      ))}

      {/* Scorch mark */}
      <mesh
        position={[-width * 0.1, height * 0.18, depth / 2 + 0.02]}
        rotation={[0, 0, -0.15]}
      >
        <planeGeometry args={[width * 0.35, height * 0.25]} />
        <meshStandardMaterial
          color="#0a0806"
          roughness={1}
          transparent
          opacity={0.65}
        />
      </mesh>
    </group>
  );
}

// ─── Concrete barrier ─────────────────────────────────────────────────────────
function Barrier({
  position,
  width,
  height,
  depth,
}: {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
}) {
  const concreteMat = usePBRMat("#9e9585", 0.88);
  const darkMat = usePBRMat("#6e6358", 0.82);
  const outlineMat = useOutlineMaterial(0.06);

  return (
    <group position={position}>
      <mesh material={concreteMat} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      <mesh material={outlineMat}>
        <boxGeometry args={[width + 0.04, height + 0.04, depth + 0.04]} />
      </mesh>
      <mesh material={darkMat} position={[0, height / 2 - 0.08, 0]}>
        <boxGeometry args={[width - 0.1, 0.16, depth - 0.1]} />
      </mesh>
      <mesh material={darkMat} position={[0, 0, depth / 2 + 0.01]}>
        <boxGeometry args={[width - 0.05, 0.08, 0.04]} />
      </mesh>
    </group>
  );
}

// ─── Rubble pile ──────────────────────────────────────────────────────────────
function RubblePile({ position }: { position: [number, number, number] }) {
  const toonMat = usePBRMat("#7a6a50", 0.95);
  const darkMat = usePBRMat("#5a4a35", 0.92);
  const outlineMat = useOutlineMaterial(0.05);

  return (
    <group position={position}>
      {[0, 1, 2, 3].map((i) => (
        <group
          key={i}
          position={[
            (i - 1.5) * 0.55 + Math.sin(i * 2.1) * 0.25,
            i * 0.12,
            Math.cos(i * 1.7) * 0.35,
          ]}
        >
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
  const sandMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: sandVertexShader,
        fragmentShader: sandFragmentShader,
        side: THREE.FrontSide,
      }),
    [],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[300, 300, 64, 64]} />
      <primitive object={sandMaterial} attach="material" />
    </mesh>
  );
}

function SkyDome() {
  const skyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        side: THREE.BackSide,
      }),
    [],
  );

  return (
    <mesh>
      <sphereGeometry args={[250, 32, 16]} />
      <primitive object={skyMaterial} attach="material" />
    </mesh>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
function BuildingDispatcher({ b }: { b: BuildingData }) {
  const [bx, by, bz] = b.position;
  const pos: [number, number, number] = [bx, by, bz];

  if (b.type === "building") {
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
  if (b.type === "ruin") {
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
  if (b.type === "barrier") {
    return (
      <Barrier
        position={pos}
        width={b.width}
        height={b.height}
        depth={b.depth}
      />
    );
  }
  return <RubblePile position={[bx, 0, bz]} />;
}

export function DesertEnvironment({
  upgradeTier = 0,
  juggernogPurchaseCount = 0,
}: DesertEnvironmentProps) {
  const buildings = useMemo(() => generateBuildingData(), []);

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
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <BuildingDispatcher key={i} b={b} />
      ))}

      {rubblePositions.map((pos, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <RubblePile key={`deco-${i}`} position={pos} />
      ))}

      {PALM_TREE_POSITIONS.map((pos, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static geometry
        <PalmTree key={`palm-${i}`} position={pos} seed={i * 137 + 42} />
      ))}

      <PackAPunchMachine upgradeTier={upgradeTier} />

      <JuggernogMachine
        position={JUGGERNOG_POSITION}
        purchaseCount={juggernogPurchaseCount}
      />

      <MountainBarrier />

      {/* Lighting */}
      <ambientLight intensity={0.55} color="#ffbb77" />
      <directionalLight
        position={[60, 90, 40]}
        intensity={1.8}
        color="#ffe8aa"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <hemisphereLight args={["#ffaa55", "#5a3311", 0.35]} />
      {/* Fill light from opposite side */}
      <directionalLight
        position={[-30, 40, -20]}
        intensity={0.4}
        color="#aaccff"
      />
    </group>
  );
}
