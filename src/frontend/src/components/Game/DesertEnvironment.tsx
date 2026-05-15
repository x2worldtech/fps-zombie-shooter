import { memo, useMemo } from "react";
import * as THREE from "three";
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

/**
 * Sonnen-Position als feste Modul-Konstante.
 *
 * Wird sowohl vom directionalLight als auch vom sichtbaren 3D-Sonnen-Mesh
 * und (über Uniform) vom Sky-Shader genutzt — so kommt die Beleuchtung
 * exakt aus der Richtung, in der der Spieler die Sonne sieht. Schatten
 * fallen logisch in die richtige Richtung.
 *
 * Wir platzieren sie hoch und etwas nach Osten/Süden — typisches Mittag-
 * bis Nachmittags-Golden-Hour-Setup. Schattenwurf: leicht in Richtung
 * -X / -Z (Häuser/Palmen werfen Schatten nach links/hinten).
 */
const SUN_DIR = new THREE.Vector3(0.7, 0.65, 0.3).normalize();
// Position für Light + Mesh in Welt-Koordinaten
const SUN_DISTANCE = 220;
const SUN_POSITION: [number, number, number] = [
  SUN_DIR.x * SUN_DISTANCE,
  SUN_DIR.y * SUN_DISTANCE,
  SUN_DIR.z * SUN_DISTANCE,
];

/**
 * Sichtbare 3D-Sonne am Himmel: leuchtender Disk + Halo.
 * Liegt am Skydome-Rand (220m vom Zentrum) — kein Sammelpunkt von Licht
 * mehr, sondern eine klar sichtbare Lichtquelle.
 */
function Sun() {
  const sunDiskMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#fff5d0",
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        toneMapped: false, // bleibt strahlend hell auch bei ACES-Tone-Mapping
      }),
    [],
  );
  const sunHaloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffd084",
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const sunHalo2Mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ff8030",
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  // Sonne soll der Kamera entgegen orientiert sein — wir rotieren die Mesh-
  // Quad-Plane so dass sie zum Zentrum (Spieler-Spawn) zeigt. Da der Spieler
  // sich bewegt, lassen wir die Plane einfach in Welt-Z stehen und
  // hoffen dass die Sonne weit genug entfernt ist (220m) damit Parallax
  // unsichtbar ist.
  // Stattdessen: wir nutzen 3 konzentrische Sphären — kameraunabhängig.
  return (
    <group position={SUN_POSITION}>
      {/* Innerer heller Sonnen-Disc (Core) */}
      <mesh material={sunDiskMat}>
        <sphereGeometry args={[4.5, 24, 16]} />
      </mesh>
      {/* Mittlerer Halo */}
      <mesh material={sunHaloMat}>
        <sphereGeometry args={[8, 24, 16]} />
      </mesh>
      {/* Äußerer großer Glow */}
      <mesh material={sunHalo2Mat}>
        <sphereGeometry args={[16, 20, 14]} />
      </mesh>
    </group>
  );
}

interface DesertEnvironmentProps {
  upgradeTier?: number;
  juggernogPurchaseCount?: number;
}

// ─── Shared PBR material helpers ─────────────────────────────────────────────
// PERF: Module-Level-Cache für non-textured PBR-Materialien.
// Vorher: usePBRMat erzeugt pro Component-Instanz ein eigenes Material →
// Window ruft den Hook 2× auf (frame + sill), bei ~470 Windows × 2 Aufrufe
// × ~10 Buildings mit derselben Farbe = viel Duplikat. Jetzt: identische
// (color, roughness, metalness, emissive, emissiveIntensity)-Kombinationen
// teilen sich eine Material-Instanz, deutlich weniger Material-State-
// Switches im Renderer.
const __pbrMatCache = new Map<string, THREE.MeshStandardMaterial>();

function usePBRMat(
  color: string,
  roughness = 0.82,
  metalness = 0.0,
  emissive?: string,
  emissiveIntensity = 0,
) {
  return useMemo(() => {
    const key = `${color}|${roughness}|${metalness}|${emissive ?? ""}|${emissiveIntensity}`;
    const cached = __pbrMatCache.get(key);
    if (cached) return cached;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness,
      emissive: emissive ? new THREE.Color(emissive) : undefined,
      emissiveIntensity,
    });
    __pbrMatCache.set(key, mat);
    return mat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, roughness, metalness, emissive, emissiveIntensity]);
}

/**
 * Procedural Adobe/Stucco wall material with detailed albedo + bump.
 * Gives houses a textured wall surface instead of flat solid color.
 * Each instance gets a unique noise pattern via `seed`.
 *
 * PERF: Module-Level-Cache. Beim ersten Mount mit einer (color, seed)-Kombi
 * wird das Material generiert und gespeichert. Spätere Re-Mounts (z.B. nach
 * Portal-Wechsel Warzone → Desert) bekommen das Material instant zurück, ohne
 * das 512×512 Canvas + Per-Pixel-Korn neu zu rechnen. Visuell 1:1 identisch,
 * da Seed und Color exakt erhalten bleiben.
 *
 * Erst-Last: jedes Building hat einen positionsabhängigen Seed → eindeutig pro
 * Gebäude → kein Cache-Hit beim allerersten Mount. Folge-Mounts (Portal-Loop
 * Desert↔Warzone↔Desert) sind nahezu kostenlos.
 */
const adobeWallMatCache = new Map<string, THREE.MeshStandardMaterial>();

function useAdobeWallMat(color: string, seed: number) {
  return useMemo(() => {
    const cacheKey = `${color}_${seed}`;
    const cached = adobeWallMatCache.get(cacheKey);
    if (cached) return cached;

    const size = 512;
    let s = seed | 0;
    const rng = () => {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) % 100000) / 100000;
    };

    // ── Albedo: warmer Lehm/Adobe-Putz mit Patches und Verwitterung ──
    const albedoCanvas = document.createElement("canvas");
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    const aCtx = albedoCanvas.getContext("2d");
    if (aCtx) {
      aCtx.fillStyle = color;
      aCtx.fillRect(0, 0, size, size);

      // Helle Sonnen-Patches (verblichener Putz)
      for (let i = 0; i < 35; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 40 + rng() * 120;
        const g = aCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,240,210,${0.12 + rng() * 0.15})`);
        g.addColorStop(1, "rgba(255,240,210,0)");
        aCtx.fillStyle = g;
        aCtx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Dunkle Verwitterungs-Patches (Schmutz, Schatten)
      for (let i = 0; i < 30; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 30 + rng() * 100;
        const g = aCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(60,40,20,${0.18 + rng() * 0.18})`);
        g.addColorStop(1, "rgba(60,40,20,0)");
        aCtx.fillStyle = g;
        aCtx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Vertikale Wasser-Streifen (Erosion vom Dach nach unten)
      for (let i = 0; i < 8; i++) {
        const x = rng() * size;
        const w = 4 + rng() * 12;
        const startY = rng() * size * 0.3;
        const grad = aCtx.createLinearGradient(0, startY, 0, size);
        grad.addColorStop(0, "rgba(40,28,15,0)");
        grad.addColorStop(0.3, `rgba(40,28,15,${0.2 + rng() * 0.2})`);
        grad.addColorStop(1, "rgba(40,28,15,0.05)");
        aCtx.fillStyle = grad;
        aCtx.fillRect(x, startY, w, size - startY);
      }

      // Putz-Risse
      aCtx.lineCap = "round";
      for (let i = 0; i < 25; i++) {
        const x0 = rng() * size;
        const y0 = rng() * size;
        let x = x0;
        let y = y0;
        aCtx.strokeStyle = `rgba(20,12,5,${0.4 + rng() * 0.3})`;
        aCtx.lineWidth = 0.5 + rng() * 1;
        aCtx.beginPath();
        aCtx.moveTo(x, y);
        const segs = 3 + Math.floor(rng() * 5);
        let angle = rng() * Math.PI * 2;
        for (let p = 0; p < segs; p++) {
          angle += (rng() - 0.5) * 0.8;
          x += Math.cos(angle) * (12 + rng() * 22);
          y += Math.sin(angle) * (12 + rng() * 22);
          aCtx.lineTo(x, y);
        }
        aCtx.stroke();
      }

      // Adobe-Stein-Sprenkel (kleine helle Punkte als Putz-Körnung)
      for (let i = 0; i < 600; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 0.6 + rng() * 1.4;
        const bright = 0.5 + rng() * 0.4;
        aCtx.fillStyle = `rgba(${(220 * bright) | 0},${(200 * bright) | 0},${(160 * bright) | 0},${0.25 + rng() * 0.3})`;
        aCtx.beginPath();
        aCtx.arc(x, y, r, 0, Math.PI * 2);
        aCtx.fill();
      }

      // Per-Pixel-Korn (feines Putz-Korn)
      const img = aCtx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (rng() - 0.5) * 20;
        img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
        img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.9));
        img.data[i + 2] = Math.max(
          0,
          Math.min(255, img.data[i + 2] + n * 0.75),
        );
      }
      aCtx.putImageData(img, 0, 0);
    }
    const albedoTex = new THREE.CanvasTexture(albedoCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.repeat.set(2, 2);
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = 8;

    // ── Bump: Putz-Buckel + Riss-Vertiefungen + Korn ──
    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext("2d");
    if (bCtx) {
      bCtx.fillStyle = "#7f7f7f";
      bCtx.fillRect(0, 0, size, size);

      // Mittelgrosse Putz-Buckel
      for (let i = 0; i < 90; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 15 + rng() * 50;
        const g = bCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.2 + rng() * 0.2})`);
        g.addColorStop(0.7, "rgba(127,127,127,0)");
        bCtx.fillStyle = g;
        bCtx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Vertiefungen
      for (let i = 0; i < 80; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 10 + rng() * 40;
        const g = bCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${0.2 + rng() * 0.25})`);
        g.addColorStop(0.7, "rgba(127,127,127,0)");
        bCtx.fillStyle = g;
        bCtx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Risse als tiefe schwarze Linien
      bCtx.lineCap = "round";
      for (let i = 0; i < 25; i++) {
        const x0 = rng() * size;
        const y0 = rng() * size;
        let x = x0;
        let y = y0;
        bCtx.strokeStyle = `rgba(0,0,0,${0.55 + rng() * 0.3})`;
        bCtx.lineWidth = 1 + rng() * 2;
        bCtx.beginPath();
        bCtx.moveTo(x, y);
        const segs = 3 + Math.floor(rng() * 5);
        let angle = rng() * Math.PI * 2;
        for (let p = 0; p < segs; p++) {
          angle += (rng() - 0.5) * 0.8;
          x += Math.cos(angle) * (12 + rng() * 22);
          y += Math.sin(angle) * (12 + rng() * 22);
          bCtx.lineTo(x, y);
        }
        bCtx.stroke();
      }

      // Hochfrequentes Per-Pixel-Korn
      const img = bCtx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (rng() - 0.5) * 75;
        const v = Math.max(0, Math.min(255, img.data[i] + n));
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
      }
      bCtx.putImageData(img, 0, 0);
    }
    const bumpTex = new THREE.CanvasTexture(bumpCanvas);
    bumpTex.wrapS = THREE.RepeatWrapping;
    bumpTex.wrapT = THREE.RepeatWrapping;
    bumpTex.repeat.set(2, 2);
    bumpTex.anisotropy = 8;

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      map: albedoTex,
      bumpMap: bumpTex,
      bumpScale: 0.04,
      roughness: 0.92,
      metalness: 0.0,
    });
    // PERF: ins Module-Cache speichern
    adobeWallMatCache.set(cacheKey, material);
    return material;
  }, [color, seed]);
}

// ─── Window component ─────────────────────────────────────────────────────────
// rotationY controls which direction the window faces outward:
//   Front wall  (+Z): rotationY = 0           (default)
//   Back wall   (-Z): rotationY = Math.PI
//   Right wall  (+X): rotationY = Math.PI / 2
//   Left wall   (-X): rotationY = -Math.PI / 2

// PERF: Module-Level-Cache für die Fenster-Glas-Materialien.
// Vorher: jedes <Window> erzeugte sein eigenes glassMaterial via useMemo →
// bei ~470 Fenstern in 26 Buildings = ~470 Material-Instanzen, davon ~470
// transparent (=teure Sortier-/Draw-Pässe). Jetzt: zwei geteilte Materialien
// (eines mit Licht, eines ohne) für alle Fenster. Visuell bit-identisch da
// die Material-Properties vorher schon ausschließlich von `hasLight` abhingen
// — kein per-Window-Variations-Verlust.
//
// Wirkung: Renderer kann gleichartige Fenster batchen (mit BatchedMesh-Logik
// auf GPU-Treiber-Ebene), Material-State-Switches drop von ~470 auf 2 pro
// Frame, deutlich weniger GC-Druck und Shader-Compile-Pässe.
let __windowGlassMatLit: THREE.MeshStandardMaterial | null = null;
let __windowGlassMatDark: THREE.MeshStandardMaterial | null = null;

function getSharedWindowGlassMat(hasLight: boolean): THREE.MeshStandardMaterial {
  if (hasLight) {
    if (!__windowGlassMatLit) {
      __windowGlassMatLit = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.9, 0.8, 0.5),
        roughness: 0.05,
        metalness: 0.6,
        emissive: new THREE.Color(0.4, 0.3, 0.1),
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.85,
      });
    }
    return __windowGlassMatLit;
  }
  if (!__windowGlassMatDark) {
    __windowGlassMatDark = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.04, 0.07, 0.14),
      roughness: 0.05,
      metalness: 0.6,
      emissive: new THREE.Color(0.01, 0.02, 0.05),
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.7,
    });
  }
  return __windowGlassMatDark;
}

function Window({
  position,
  rotationY = 0,
  width = 0.7,
  height = 1.0,
  frameColor,
  hasLight = false,
}: {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  frameColor: string;
  hasLight?: boolean;
}) {
  const frameMat = usePBRMat(frameColor, 0.75);
  // PERF: shared module-cached Material statt per-Component useMemo
  const glassMat = getSharedWindowGlassMat(hasLight);
  const sillMat = usePBRMat(frameColor, 0.6);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
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

  // Wand-Material mit prozeduraler Adobe/Putz-Textur (Albedo + Bump)
  const wallSeed = Math.floor(position[0] * 73 + position[2] * 137 + 1000);
  const wallMat = useAdobeWallMat(wallColor, wallSeed);
  const trimMat = usePBRMat(trimColor, 0.78);
  const accentMat = usePBRMat(accentColor, 0.65);
  const concreteMat = usePBRMat("#b0a898", 0.9);
  // Schmutz-Streaks unter Fenstern + Wasserablauf-Spuren (dunkler als Wand)
  const stainMat = usePBRMat("#3a2c1e", 0.98);

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

  return (
    <group position={position}>
      {/* ── Main wall body ── */}
      <mesh material={wallMat} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
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

      {/* ── Front face windows (faces +Z) ── */}
      {windowGrid.map((w, i) => (
        <Window
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={`wf-${i}`}
          position={[w.x, w.y, depth / 2 + 0.05]}
          rotationY={0}
          width={windowW}
          height={windowH}
          frameColor={trimColor}
          hasLight={w.hasLight}
        />
      ))}

      {/* ── Back face windows (faces -Z) ── */}
      {windowGrid.map((w, i) => (
        <Window
          // biome-ignore lint/suspicious/noArrayIndexKey: static
          key={`wb-${i}`}
          position={[w.x, w.y, -(depth / 2 + 0.05)]}
          rotationY={Math.PI}
          width={windowW}
          height={windowH}
          frameColor={trimColor}
          hasLight={w.hasLight}
        />
      ))}

      {/* ── Side windows (left faces -X, right faces +X) ── */}
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
                {/* Left wall — faces -X */}
                <Window
                  position={[-(width / 2 + 0.05), w.y, xOff]}
                  rotationY={-Math.PI / 2}
                  width={windowW * 0.85}
                  height={windowH}
                  frameColor={trimColor}
                  hasLight={w.hasLight}
                />
                {/* Right wall — faces +X */}
                <Window
                  position={[width / 2 + 0.05, w.y, xOff]}
                  rotationY={Math.PI / 2}
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

      {/* ── Wand-Schmutz-Streifen unter Fenstern (Wasserablauf-Spuren) ── */}
      {windowGrid.map((w) => (
        <mesh
          key={`stain-front-${w.x.toFixed(3)}-${w.y.toFixed(3)}`}
          material={stainMat}
          position={[w.x, w.y - windowH * 0.6, depth / 2 + 0.025]}
        >
          <boxGeometry args={[windowW * 0.65, windowH * 1.1, 0.005]} />
        </mesh>
      ))}
      {windowGrid.map((w) => (
        <mesh
          key={`stain-back-${w.x.toFixed(3)}-${w.y.toFixed(3)}`}
          material={stainMat}
          position={[w.x, w.y - windowH * 0.6, -(depth / 2 + 0.025)]}
        >
          <boxGeometry args={[windowW * 0.65, windowH * 1.1, 0.005]} />
        </mesh>
      ))}

      {/* ── Wand-Risse (kleine Patches an zufälligen Stellen) ── */}
      {[
        { x: -width * 0.35, y: height * 0.15, w: 0.04, h: 0.6, rot: 0.15 },
        { x: width * 0.28, y: -height * 0.25, w: 0.05, h: 0.45, rot: 0.25 },
      ].map((c) => (
        <mesh
          key={`crack-${c.x.toFixed(3)}-${c.y.toFixed(3)}`}
          material={stainMat}
          position={[c.x, c.y, depth / 2 + 0.022]}
          rotation={[0, 0, c.rot]}
        >
          <boxGeometry args={[c.w, c.h, 0.005]} />
        </mesh>
      ))}

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

      {/* ── Rooftop equipment — nur Wassertank (passt zur Wüstenarchitektur) ── */}
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

  // Wand-Material mit prozeduraler Adobe/Putz-Textur
  const wallSeed = Math.floor(position[0] * 91 + position[2] * 163 + 2000);
  const wallMat = useAdobeWallMat(wallColor, wallSeed);
  const darkMat = usePBRMat(darkColor, 0.95);
  const exposedMat = usePBRMat("#8a7060", 0.93);
  const steelMat = usePBRMat("#5a4a3a", 0.6, 0.4);
  const rubbleMat = usePBRMat("#7a6a55", 0.95);

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

  return (
    <group position={position}>
      <mesh material={concreteMat} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
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
        </group>
      ))}
    </group>
  );
}

function SandGround() {
  const sandMaterial = useMemo(() => {
    const size = 1024;

    // ── Albedo-Textur: warmer Sand mit Patches, Körnung, vereinzelten Steinen ──
    const albedoCanvas = document.createElement("canvas");
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    const aCtx = albedoCanvas.getContext("2d");
    if (aCtx) {
      // Basis-Sandfarbe (warmer Goldton)
      aCtx.fillStyle = "#c9a567";
      aCtx.fillRect(0, 0, size, size);

      // Helle Patches (sonnenbeschienener trockener Sand)
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 80 + Math.random() * 180;
        const g = aCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(220,190,130,${0.15 + Math.random() * 0.2})`);
        g.addColorStop(1, "rgba(220,190,130,0)");
        aCtx.fillStyle = g;
        aCtx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Dunklere Patches (feuchtere Stellen, Schatten)
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 60 + Math.random() * 140;
        const g = aCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(140,100,50,${0.18 + Math.random() * 0.18})`);
        g.addColorStop(1, "rgba(140,100,50,0)");
        aCtx.fillStyle = g;
        aCtx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Subtile Rippeln/Wellen (kurze elliptische Schatten)
      for (let i = 0; i < 240; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const w = 12 + Math.random() * 28;
        const h = 1.5 + Math.random() * 2.5;
        const rot = Math.random() * Math.PI;
        aCtx.save();
        aCtx.translate(x, y);
        aCtx.rotate(rot);
        aCtx.fillStyle = `rgba(110,80,40,${0.18 + Math.random() * 0.15})`;
        aCtx.beginPath();
        aCtx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
        aCtx.fill();
        aCtx.restore();
      }

      // Vereinzelte kleine Steine
      for (let i = 0; i < 380; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 1 + Math.random() * 3.5;
        const dark = 0.4 + Math.random() * 0.3;
        aCtx.fillStyle = `rgba(${(60 * dark) | 0},${(50 * dark) | 0},${(35 * dark) | 0},${0.5 + Math.random() * 0.4})`;
        aCtx.beginPath();
        aCtx.arc(x, y, r, 0, Math.PI * 2);
        aCtx.fill();
        // kleiner Highlight oben links für 3D-Optik
        aCtx.fillStyle = `rgba(220,180,130,${0.3 + Math.random() * 0.3})`;
        aCtx.beginPath();
        aCtx.arc(x - r * 0.4, y - r * 0.4, r * 0.4, 0, Math.PI * 2);
        aCtx.fill();
      }

      // Pixel-Korn (feines Sandkörn-Noise)
      const img = aCtx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 38;
        img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
        img.data[i + 1] = Math.max(
          0,
          Math.min(255, img.data[i + 1] + n * 0.85),
        );
        img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.7));
      }
      aCtx.putImageData(img, 0, 0);
    }
    const albedoTex = new THREE.CanvasTexture(albedoCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.repeat.set(20, 20); // 20x kacheln über die 300x300 Plane → kleine Sandkörner-Skalierung
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = 8;

    // ── Bump-Textur: Sand-Rippeln + feine Körnung ──
    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext("2d");
    if (bCtx) {
      bCtx.fillStyle = "#7f7f7f";
      bCtx.fillRect(0, 0, size, size);

      // Mittelgrosse Sand-Hügelchen
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 30 + Math.random() * 80;
        const g = bCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.2 + Math.random() * 0.25})`);
        g.addColorStop(0.7, "rgba(127,127,127,0)");
        bCtx.fillStyle = g;
        bCtx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // Vertiefungen
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 20 + Math.random() * 60;
        const g = bCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${0.2 + Math.random() * 0.25})`);
        g.addColorStop(0.7, "rgba(127,127,127,0)");
        bCtx.fillStyle = g;
        bCtx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Sand-Rippeln (gerichtete Streifen)
      for (let i = 0; i < 160; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const w = 30 + Math.random() * 80;
        const rot = Math.PI * (0.1 + Math.random() * 0.2); // leicht geneigt
        bCtx.save();
        bCtx.translate(x, y);
        bCtx.rotate(rot);
        bCtx.fillStyle = `rgba(255,255,255,${0.12 + Math.random() * 0.15})`;
        bCtx.fillRect(-w / 2, -1, w, 2);
        bCtx.fillStyle = `rgba(0,0,0,${0.12 + Math.random() * 0.12})`;
        bCtx.fillRect(-w / 2, 1, w, 2);
        bCtx.restore();
      }

      // Hochfrequentes Per-Pixel-Korn
      const img = bCtx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 80;
        const v = Math.max(0, Math.min(255, img.data[i] + n));
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
      }
      bCtx.putImageData(img, 0, 0);
    }
    const bumpTex = new THREE.CanvasTexture(bumpCanvas);
    bumpTex.wrapS = THREE.RepeatWrapping;
    bumpTex.wrapT = THREE.RepeatWrapping;
    bumpTex.repeat.set(20, 20);

    return new THREE.MeshStandardMaterial({
      color: "#d4b378",
      map: albedoTex,
      bumpMap: bumpTex,
      bumpScale: 0.06,
      roughness: 0.96, // Sand ist sehr matt
      metalness: 0,
    });
  }, []);

  // Plane mit höherer Subdivision für Dünen-Verformung.
  // WICHTIG: Im Zentrum (Spielzone, R<70) bleibt der Boden flach bei y=0,
  // sonst versinken Zombies/Palmen/Gebäude. Außerhalb darf es Dünen geben
  // für visuelle Tiefe in der Ferne.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(300, 300, 80, 80);
    const pos = geo.attributes.position;
    const innerRadius = 70; // Spielzone — flach
    const outerRadius = 140; // Voller Effekt
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // PlaneGeometry: y ist die zweite Dimension
      const dist = Math.sqrt(x * x + y * y);
      // Smooth-fade-in: 0% bei innerRadius, 100% bei outerRadius
      let influence = 0;
      if (dist > innerRadius) {
        const t = Math.min(
          1,
          (dist - innerRadius) / (outerRadius - innerRadius),
        );
        // ease-in-out für sanften Übergang
        influence = t * t * (3 - 2 * t);
      }
      // Dünen-Noise — und WICHTIG: subtrahiert Maximalwert, damit dunes ≤ 0
      // (Sand-Boden bleibt unter y=0; wo es flach ist, ist er bei y=0)
      const noise =
        Math.sin(x * 0.05) * Math.cos(y * 0.05) * 0.6 +
        Math.sin(x * 0.12 + y * 0.08) * 0.25 +
        Math.cos(x * 0.3 + y * 0.2) * 0.08;
      // Dünen tauchen nur nach unten — kein Vertex über y=0
      const dune = (noise - 0.93) * influence;
      pos.setZ(i, dune);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      geometry={geometry}
      material={sandMaterial}
      receiveShadow
    />
  );
}

function SkyDome() {
  const skyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        side: THREE.BackSide,
        uniforms: {
          uSunDir: { value: SUN_DIR.clone() },
        },
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

function DesertEnvironmentInner({
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

      {/* ─── Atmosphäre: warme Fog für goldene Stunden-Tiefe ─── */}
      <fog attach="fog" args={["#d8a060", 60, 220]} />

      {/* ─── BELEUCHTUNG (Wüsten-Mittag/Nachmittag) ─── */}
      {/* Sichtbare 3D-Sonne am Himmel (synchronisiert mit Lichtquelle) */}
      <Sun />

      {/* Hemispherical Sky-Light: warm oben, sand-bounce unten */}
      <hemisphereLight args={["#ffd089", "#7a4818", 0.5]} />

      {/* Schwacher Ambient für Schattenseiten (sie sind nicht pechschwarz) */}
      <ambientLight intensity={0.28} color="#ffb070" />

      {/* HAUPTSONNE als directionalLight an SUN_POSITION
          → Schatten fallen exakt dorthin, wo der Spieler die Sonne sieht */}
      <directionalLight
        position={SUN_POSITION}
        intensity={2.4}
        color="#ffe6b8"
        castShadow
        // Höhere Shadow-Map für schärfere Häuser-/Palmen-Schatten
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        // Shadow-Bounds: deckt die ganze Spielfläche ab (bis ~R=80 wo Berge sind)
        shadow-camera-far={250}
        shadow-camera-near={1}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        // Bias-Tuning für saubere Schatten ohne Shadow-Acne und ohne Peter-Panning
        shadow-bias={-0.0003}
        shadow-normalBias={0.05}
      />

      {/* Schwaches kühles Sky-Bounce-Light von oben — ergänzt die warme
          Sonne und bringt etwas Tiefe in die Schattenseiten. */}
      <directionalLight
        position={[-40, 80, -30]}
        intensity={0.3}
        color="#88aacc"
      />
    </group>
  );
}

// PERF: memo verhindert, dass DesertEnvironment bei jedem GameScene-Re-Render
// seinen kompletten Sub-Tree (26 Buildings + Palmen + Trümmer + Machines + Sun
// + Lighting) reconciliert. Re-Render nur noch wenn upgradeTier oder
// juggernogPurchaseCount sich ändern — also bei Pack-a-Punch / Juggernog-Kauf.
export const DesertEnvironment = memo(DesertEnvironmentInner);
