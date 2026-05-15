import { useMemo } from "react";
import * as THREE from "three";

/**
 * Mountain Barrier — echte Bergkette aus Heightmap.
 *
 * Statt einer deformierten Cylinder-Wand (sah uniform aus) bauen wir hier
 * eine PlaneGeometry um den Spielfeld-Mittelpunkt gekrümmt: jeder Vertex
 * hat eine **echte Höhe** abhängig von Position. Das ergibt scharfe Gipfel
 * und tiefe Täler — natürliche Bergsilhouette.
 *
 * Per-Vertex-Color statt einheitlichem Material: jeder Vertex bekommt einen
 * Felston aus einer Palette (warmes Grau, Ocker, dunkler Schiefer, Sandstein),
 * gemischt nach Position+Höhe → realistische Farbvariation wie bei echtem Fels.
 *
 * Zwei überlappende Ringe (vorne+hinten, leicht versetzt in Höhe und Radius)
 * für echte Tiefen-Schichtung statt einer einzelnen "Wand".
 */

// Konstanten
const RING_INNER_RADIUS = 78; // innerer Radius (Spielfeld-Seite)
const RING_DEPTH = 28; // wie tief die Bergkette ist (radial)
const BASE_HEIGHT = 8; // Mindesthöhe der Berge (manche Stellen niedrig)
const PEAK_HEIGHT = 55; // Maximale Höhe der höchsten Gipfel
const RADIAL_SEGMENTS = 384; // sehr hohe Auflösung um den Ring (kein "wandig" mehr)
const DEPTH_SEGMENTS = 32; // Auflösung in Berg-Tiefe-Richtung

// Felston-Palette — manche heller, manche dunkler, verschiedene Töne
const ROCK_PALETTE = [
  new THREE.Color("#8c8278"), // helles warmes Grau
  new THREE.Color("#a89c88"), // sandiges Hellgrau
  new THREE.Color("#766a5c"), // mittleres Braun-Grau
  new THREE.Color("#9e9285"), // ocker-grau
  new THREE.Color("#5e564c"), // dunkler Schiefer
  new THREE.Color("#b3a896"), // sehr heller Sandstein (Sonnenseite)
  new THREE.Color("#6a5e50"), // dunkleres Felsbraun
  new THREE.Color("#827568"), // mittlerer Ton
];

// ─── Hash-Funktionen für Multi-Frequency-Noise ──────────────────────────────
function hash1(n: number): number {
  return (((Math.sin(n * 12.9898) * 43758.5453) % 1) + 1) % 1;
}

function smooth1D(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i) * (1 - u) + hash1(i + 1) * u;
}

function smooth2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash1(ix * 374.7 + iy * 121.3);
  const b = hash1((ix + 1) * 374.7 + iy * 121.3);
  const c = hash1(ix * 374.7 + (iy + 1) * 121.3);
  const d = hash1((ix + 1) * 374.7 + (iy + 1) * 121.3);
  return (
    a * (1 - ux) * (1 - uy) +
    b * ux * (1 - uy) +
    c * (1 - ux) * uy +
    d * ux * uy
  );
}

/**
 * Höhen-Funktion: für einen gegebenen Winkel + radialen Versatz
 * (0 = Innenrand, 1 = Außenrand) berechnet die Höhe an dieser Stelle.
 *
 * Die Höhe ist Multi-Frequency-Noise — manche Winkel sind hohe Gipfel,
 * andere tiefe Täler. Die Form fällt nach außen ab (Bergrücken endet).
 */
function getHeight(angle: number, radialT: number, seedOffset = 0): number {
  // Höhen-Profil entlang des Winkels — bestimmt Gipfel-Verteilung
  const peak1 = smooth1D(angle * 1.2 + seedOffset); // ~3 Hauptgipfel
  const peak2 = smooth1D(angle * 3.1 + 27 + seedOffset); // mittlere Variation
  const peak3 = smooth1D(angle * 7.3 + 91 + seedOffset); // kleinere Spitzen
  const peak4 = smooth1D(angle * 15.7 + 153 + seedOffset); // Detail-Variation

  // Kombiniert: Gipfel reichen von 0.15 (Talsohle) bis 1.0 (höchster Gipfel)
  // Wichtig: starke Variation zwischen f1 (Hauptpeaks) damit Täler tief sind
  let heightProfile =
    peak1 * peak1 * 0.65 + peak2 * 0.25 + peak3 * 0.07 + peak4 * 0.03;
  // Schärfen — Gipfel höher, Täler tiefer
  heightProfile = heightProfile ** 1.4;

  // 2D-Variation: Höhe variiert auch entlang der radialen Richtung
  // (= Bergrücken sind hinten höher, ergeben Schichtung)
  const radialMod = smooth2D(angle * 4.5 + seedOffset, radialT * 6) * 0.3 + 0.7;

  // Höhen-Falloff zum Außenrand: in der Mitte des Bergrückens am höchsten,
  // an den Rändern niedriger (kein gerader Abschnitt)
  const radialFalloff = Math.sin(radialT * Math.PI); // 0 an Rändern, 1 in Mitte

  const fullHeight = BASE_HEIGHT + heightProfile * (PEAK_HEIGHT - BASE_HEIGHT);
  return fullHeight * radialMod * radialFalloff;
}

/**
 * Baut die Heightmap-Geometrie als gekrümmte Plane.
 *
 * Plane wird in der XZ-Ebene angeordnet, Y ist Höhe. Wir parametrisieren
 * jeden Vertex über (angleNorm, radialT):
 *  - angleNorm: 0..1 entlang des Rings (also × 2π = Winkel)
 *  - radialT: 0 (innen) bis 1 (außen)
 * und mappen auf X/Z basierend auf Radius + Winkel.
 */
function buildMountainHeightmap(
  seedOffset: number,
  radiusOffset = 0,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();

  const verts: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const innerR = RING_INNER_RADIUS + radiusOffset;

  // Vertices generieren
  for (let v = 0; v <= DEPTH_SEGMENTS; v++) {
    const radialT = v / DEPTH_SEGMENTS;
    const radius = innerR + radialT * RING_DEPTH;

    for (let u = 0; u <= RADIAL_SEGMENTS; u++) {
      const angleNorm = u / RADIAL_SEGMENTS;
      const angle = angleNorm * Math.PI * 2;

      // Höhe bestimmen
      const height = getHeight(angle, radialT, seedOffset);
      // Feiner Rauheits-Noise (für Felsen-Variation auf großen Flächen)
      const roughness =
        (smooth2D(angle * 30 + seedOffset, radialT * 50) - 0.5) * 1.5;

      const x = Math.cos(angle) * radius;
      const y = height + roughness;
      const z = Math.sin(angle) * radius;

      verts.push(x, y, z);

      // ─── Vertex-Color: Felston abhängig von Position + Höhe ───
      // Verschiedene Felstöne je nach 2D-Position, gemischt mit Höhe (oben heller)
      const colorNoise = smooth2D(angle * 2.3 + seedOffset, radialT * 1.7);
      // Wähle einen Felston aus Palette (deterministisch über Noise)
      const idxFloat = colorNoise * (ROCK_PALETTE.length - 0.001);
      const idx1 = Math.floor(idxFloat);
      const idx2 = (idx1 + 1) % ROCK_PALETTE.length;
      const blend = idxFloat - idx1;
      const c1 = ROCK_PALETTE[idx1];
      const c2 = ROCK_PALETTE[idx2];
      // Linear interpolieren zwischen zwei Farbtönen
      const baseR = c1.r * (1 - blend) + c2.r * blend;
      const baseG = c1.g * (1 - blend) + c2.g * blend;
      const baseB = c1.b * (1 - blend) + c2.b * blend;

      // Höhen-Modifikator: Gipfel etwas heller (sonnenbeschienen),
      // Täler dunkler (Schatten)
      const heightFrac = height / PEAK_HEIGHT; // 0..1
      const heightMod = 0.85 + heightFrac * 0.4; // 0.85..1.25

      // Sonnenseite vs Schattenseite: Berge im Osten/Süden heller (Sonne kommt
      // aus +X/+Z laut DesertEnvironment Beleuchtung)
      const sunDot = Math.cos(angle - 0.6); // -1..1, peak bei angle ~0.6 rad
      const sunMod = 1 + sunDot * 0.18; // 0.82..1.18

      const finalR = Math.min(1, baseR * heightMod * sunMod);
      const finalG = Math.min(1, baseG * heightMod * sunMod);
      const finalB = Math.min(1, baseB * heightMod * sunMod);

      colors.push(finalR, finalG, finalB);

      uvs.push(angleNorm * 12, radialT); // 12x kacheln für Felsendetail
    }
  }

  // Indices generieren (Triangulation)
  for (let v = 0; v < DEPTH_SEGMENTS; v++) {
    for (let u = 0; u < RADIAL_SEGMENTS; u++) {
      const a = v * (RADIAL_SEGMENTS + 1) + u;
      const b = a + 1;
      const c = a + (RADIAL_SEGMENTS + 1);
      const d = c + 1;
      // Zwei Dreiecke pro Quad
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ─── Prozedurale Felstextur (Bump-Map nur, Color kommt von Vertex-Colors) ───
function createRockBump(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");

  const rng = (() => {
    let s = 9876;
    return () => {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) % 1000000) / 1000000;
    };
  })();

  // Grau-Basis (= keine Höhenänderung)
  ctx.fillStyle = "#7f7f7f";
  ctx.fillRect(0, 0, size, size);

  // Felsen-Erhebungen
  for (let i = 0; i < 160; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 25 + rng() * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.25 + rng() * 0.3})`);
    g.addColorStop(0.7, "rgba(127,127,127,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Vertiefungen (Felsspalten)
  for (let i = 0; i < 180; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 15 + rng() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${0.3 + rng() * 0.3})`);
    g.addColorStop(0.7, "rgba(127,127,127,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Vertikale Risse — typische Felskanten
  ctx.lineCap = "round";
  for (let i = 0; i < 100; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 60 + rng() * 200;
    const baseAngle = (rng() - 0.5) * 0.6 + Math.PI / 2;
    ctx.strokeStyle = `rgba(0,0,0,${0.45 + rng() * 0.35})`;
    ctx.lineWidth = 1 + rng() * 2.8;
    ctx.beginPath();
    let cx = x;
    let cy = y;
    ctx.moveTo(cx, cy);
    const segments = 5 + Math.floor(rng() * 7);
    let a = baseAngle;
    for (let s = 0; s < segments; s++) {
      a += (rng() - 0.5) * 0.4;
      cx += Math.cos(a) * (len / segments);
      cy += Math.sin(a) * (len / segments);
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Diagonale Strata-Linien (geologische Schichtung — typisch für Felsformationen)
  for (let i = 0; i < 30; i++) {
    const y = rng() * size;
    const a = (rng() - 0.5) * 0.3;
    ctx.strokeStyle = `rgba(0,0,0,${0.2 + rng() * 0.15})`;
    ctx.lineWidth = 1 + rng() * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    let cy = y;
    for (let x = 0; x < size; x += 40) {
      cy += Math.sin(x * 0.05) * 6 + (rng() - 0.5) * 4;
      ctx.lineTo(x, cy + Math.tan(a) * x);
    }
    ctx.stroke();
  }

  // Per-Pixel hochfrequentes Korn
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.5) * 100;
    const v = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MountainBarrier() {
  const { frontGeo, backGeo, material } = useMemo(() => {
    // Vorne: Hauptkette
    const fGeo = buildMountainHeightmap(0, 0);
    // Hinten: zweite Kette, leicht versetzt — gibt Tiefen-Schichtung
    const bGeo = buildMountainHeightmap(50, 18);

    const bump = createRockBump();
    const mat = new THREE.MeshStandardMaterial({
      // Vertex-Colors aktivieren → Color kommt aus Geometrie nicht aus map
      vertexColors: true,
      bumpMap: bump,
      bumpScale: 0.45,
      roughness: 0.92,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    return { frontGeo: fGeo, backGeo: bGeo, material: mat };
  }, []);

  return (
    <group>
      {/* Hintere Kette — etwas weiter weg, höhere Gipfel für Tiefe */}
      <mesh geometry={backGeo} material={material} receiveShadow castShadow />
      {/* Vordere Hauptkette */}
      <mesh geometry={frontGeo} material={material} receiveShadow castShadow />
    </group>
  );
}
