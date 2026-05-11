import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

interface AsteroidData {
  id: number;
  size: number;
  initialPos: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationAxis: THREE.Vector3;
  rotationSpeed: number;
  /** Zufallsseed für Vertex-Verzerrung (0-1) */
  shapeSeed: number;
  /** Detail-Level: kleine Asteroiden weniger detailliert für Performance */
  detail: number;
  /** Helligkeits-Multiplikator (Albedo-Variation) */
  albedo: number;
}

// Boundaries — Asteroiden wrappen um zu loopen ohne sichtbare Sprünge
const BOUNDS_X = 60;
const BOUNDS_Y = 35;
const BOUNDS_Z_NEAR = -8;
const BOUNDS_Z_FAR = -55;

// ── Seeded RNG für deterministische Layout ──────────────────────────────────
function seededRand(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/**
 * Prozedurale Stein-Albedo-Textur: dunkle Basis mit hellen Mineral-Adern,
 * dunklen Flecken und feinem Korn-Noise.
 * Wird einmalig erstellt und von allen Asteroiden geteilt.
 */
function createRockAlbedoTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  const rng = seededRand(7777);

  // Basis-Farbe: dunkles Felsgrau
  ctx.fillStyle = "#3a342c";
  ctx.fillRect(0, 0, size, size);

  // Helle Mineral-Adern (dünne unregelmäßige Linien)
  ctx.lineCap = "round";
  for (let v = 0; v < 18; v++) {
    const x0 = rng() * size;
    const y0 = rng() * size;
    const segments = 5 + Math.floor(rng() * 8);
    let x = x0;
    let y = y0;
    ctx.strokeStyle = `rgba(180,160,130,${0.15 + rng() * 0.2})`;
    ctx.lineWidth = 0.6 + rng() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < segments; s++) {
      x += (rng() - 0.5) * 60;
      y += (rng() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Dunkle Flecken (Schatten/Krater-Dunkelheit)
  for (let p = 0; p < 60; p++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const r = 8 + rng() * 28;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(15,12,10,${0.3 + rng() * 0.3})`);
    grad.addColorStop(1, "rgba(15,12,10,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Helle kleine Punkte (Mineralpartikel, reflektierende Stellen)
  for (let p = 0; p < 250; p++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = `rgba(200,180,150,${0.1 + rng() * 0.15})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + rng() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pixel-Korn (Per-Pixel-Noise) für feine Steinkörnung
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.5) * 24;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.9));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.8));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Prozedurale Bump-Map: hochfrequentes Helligkeits-Pattern als Heightmap.
 * Three.js MeshStandardMaterial nutzt die Helligkeit pro Pixel als Höhen-
 * Information → simuliert reliefartige Steinoberfläche ohne Geometrie zu ändern.
 */
function createRockBumpTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  const rng = seededRand(8888);

  // Mittelgrau-Basis (= keine Höhenänderung)
  ctx.fillStyle = "#7f7f7f";
  ctx.fillRect(0, 0, size, size);

  // Mittelgrosse Buckel (helle Flecken = erhaben)
  for (let p = 0; p < 90; p++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const r = 12 + rng() * 32;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(255,255,255,${0.25 + rng() * 0.3})`);
    grad.addColorStop(0.7, "rgba(127,127,127,0)");
    grad.addColorStop(1, "rgba(127,127,127,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Vertiefungen (dunkle Flecken = eingedrückt)
  for (let p = 0; p < 120; p++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const r = 6 + rng() * 20;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(0,0,0,${0.25 + rng() * 0.3})`);
    grad.addColorStop(0.7, "rgba(127,127,127,0)");
    grad.addColorStop(1, "rgba(127,127,127,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Per-Pixel hochfrequentes Korn — gibt die feine Stein-Textur
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    // Stark hochfrequenter Noise: Pro-Pixel ±60
    const n = (rng() - 0.5) * 90;
    const v = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Bump-Map ist KEINE Color-Information → linear belassen
  return tex;
}

/**
 * Prozedurale Roughness-Map: Variation in der Rauheit für realistischere
 * Reflexion (manche Stellen polieren mehr, andere weniger).
 */
function createRockRoughnessTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  const rng = seededRand(9999);

  // Basis: hohe Rauheit (Stein ist matt)
  ctx.fillStyle = "#d0d0d0";
  ctx.fillRect(0, 0, size, size);

  // Etwas glattere Patches (poliertere Stellen, leicht reflektierend)
  for (let p = 0; p < 40; p++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const r = 5 + rng() * 20;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(80,80,80,${0.4 + rng() * 0.3})`);
    grad.addColorStop(1, "rgba(208,208,208,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Erzeugt eine deformierte solide Asteroid-Geometrie.
 * Statt Icosahedron mit flach-shaded Dreiecken nutzen wir eine SphereGeometry
 * mit hoher Subdivision und smooth normals — die Form wird durch
 * mehrschichtiges Noise + zufällig platzierte Krater verformt.
 */
function createAsteroidGeometry(seed: number, sizeClass: 0 | 1 | 2): THREE.BufferGeometry {
  // Subdivision pro Größenklasse — kleine Asteroiden brauchen weniger Polygone
  // 0 = far/small (24x12 = ~290 verts), 1 = mid (40x20 = ~840), 2 = near/large (56x28 = ~1640)
  const widthSeg = sizeClass === 0 ? 24 : sizeClass === 1 ? 40 : 56;
  const heightSeg = sizeClass === 0 ? 12 : sizeClass === 1 ? 20 : 28;

  const geo = new THREE.SphereGeometry(1, widthSeg, heightSeg);
  const pos = geo.attributes.position;
  const rng = seededRand(seed * 9999);

  // ── Krater-Definitionen: 3-7 zufällig platzierte Einschlagstellen ──
  const craterCount = 3 + Math.floor(rng() * 5);
  const craters: { x: number; y: number; z: number; radius: number; depth: number }[] = [];
  for (let c = 0; c < craterCount; c++) {
    // Zufällige Position auf der Einheitskugel
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    craters.push({
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.sin(phi) * Math.sin(theta),
      z: Math.cos(phi),
      radius: 0.25 + rng() * 0.4,
      depth: 0.06 + rng() * 0.12,
    });
  }

  // Globale Form-Variation per Asteroid (deformiert die Grundkugel zu unregelmäßigem Klumpen)
  const ax = 0.85 + rng() * 0.3; // X-Squash
  const ay = 0.85 + rng() * 0.3; // Y-Squash
  const az = 0.85 + rng() * 0.3; // Z-Squash
  // Zufälliger Phasenversatz für Noise-Wellen — sorgt dafür, dass jeder Asteroid anders aussieht
  const px1 = rng() * Math.PI * 2;
  const py1 = rng() * Math.PI * 2;
  const pz1 = rng() * Math.PI * 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Multi-Frequency-Noise (kombinierte Sinus/Cosinus-Wellen)
    // Niedrige Frequenzen → grosse Beulen, hohe Frequenzen → feine Oberflächen-Variation
    const lowFreq =
      Math.sin(x * 1.3 + px1) * 0.18 +
      Math.cos(y * 1.5 + py1) * 0.16 +
      Math.sin(z * 1.7 + pz1) * 0.14;
    const midFreq =
      Math.sin(x * 3.7 + py1 * 2) * 0.06 +
      Math.cos(y * 4.1 + pz1 * 2) * 0.05 +
      Math.sin(z * 4.5 + px1 * 2) * 0.05;
    // High-Frequency stark verstärkt — gibt der Oberfläche körnige Felsstruktur
    const highFreq =
      Math.sin(x * 9.3 + y * 7.1 + px1) * 0.045 +
      Math.cos(y * 11.7 + z * 8.3 + py1) * 0.038 +
      Math.sin(z * 13.1 + x * 10.7 + pz1) * 0.032;
    // Sehr hohe Frequenz für feine Stein-Körnung (vertices nah beieinander → kleine Buckel)
    const microFreq =
      Math.sin(x * 28.0 + y * 23.0) * 0.012 +
      Math.cos(y * 31.0 + z * 26.0) * 0.010 +
      Math.sin(z * 35.0 + x * 29.0) * 0.008;

    // Krater-Beitrag: für jeden Krater, wenn dieser Vertex nahe genug ist, Vertiefung erzeugen
    let craterDisplacement = 0;
    for (const c of craters) {
      const dx = x - c.x;
      const dy = y - c.y;
      const dz = z - c.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < c.radius) {
        // Smoothstep-Falloff: zentrum tief, Rand erhöht (Krater-Wall)
        const t = dist / c.radius;
        if (t < 0.7) {
          // Innerer Krater — nach innen drücken
          const inner = 1 - t / 0.7;
          craterDisplacement -= c.depth * inner * inner;
        } else {
          // Krater-Rand leicht angehoben (typisches Auswurf-Material)
          const outer = (t - 0.7) / 0.3;
          craterDisplacement += c.depth * 0.25 * (1 - outer) * outer * 4;
        }
      }
    }

    // Globaler Squash + Noise + Krater anwenden
    const displacement = 1 + lowFreq + midFreq + highFreq + microFreq + craterDisplacement;
    pos.setXYZ(i, x * ax * displacement, y * ay * displacement, z * az * displacement);
  }

  // WICHTIG: Smooth normals (kein flatShading!) — sphereGeometry hat ohnehin shared
  // vertices an Polen, computeVertexNormals interpoliert sauber.
  geo.computeVertexNormals();
  return geo;
}

/** Einzelner Asteroid */
interface AsteroidTextures {
  albedo: THREE.Texture;
  bump: THREE.Texture;
  roughness: THREE.Texture;
}

/** Einzelner Asteroid */
function Asteroid({
  data,
  geometry,
  textures,
}: {
  data: AsteroidData;
  geometry: THREE.BufferGeometry;
  textures: AsteroidTextures;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Material mit pro-Asteroid-Variation
  const material = useMemo(() => {
    // Basis-Farbe-Multiplier: dunkles felsiges Grau-Braun mit pro-Asteroid Variation
    // (color × albedo-map ergibt finalen Pixel-Wert)
    const tint = 0.6 + data.albedo * 0.5; // 0.6..1.1
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(tint * 0.55, tint * 0.45, tint * 0.38),
      // Albedo-Map gibt der Oberfläche helle Adern, dunkle Flecken, Korn-Noise
      map: textures.albedo,
      // Bump-Map simuliert reliefartige Steinoberfläche (hochfrequente Buckel/Vertiefungen)
      // ohne die Geometrie zu erhöhen → echte Felsstruktur-Optik
      bumpMap: textures.bump,
      bumpScale: 0.04,
      // Roughness-Map variiert Rauheit pro Stelle (manche Bereiche etwas glatter,
      // andere komplett matt) → realistischere Reflexion
      roughnessMap: textures.roughness,
      roughness: 0.92,
      metalness: 0.08,
    });
  }, [data.albedo, textures]);

  useFrame((_, delta) => {
    const m = meshRef.current;
    if (!m) return;

    // Lineare Drift — nicht zurück und vor wie die alte CSS-Animation
    m.position.addScaledVector(data.velocity, delta);

    // Wrap-around: wenn aus dem Bild raus, auf gegenüberliegender Seite re-spawnen
    if (m.position.x > BOUNDS_X) m.position.x = -BOUNDS_X;
    else if (m.position.x < -BOUNDS_X) m.position.x = BOUNDS_X;
    if (m.position.y > BOUNDS_Y) m.position.y = -BOUNDS_Y;
    else if (m.position.y < -BOUNDS_Y) m.position.y = BOUNDS_Y;

    // 3D-Rotation um zufällige Achse (echt, nicht nur 2D-spin wie CSS)
    m.rotateOnAxis(data.rotationAxis, data.rotationSpeed * delta);
  });

  return (
    <mesh
      ref={meshRef}
      position={data.initialPos}
      scale={data.size}
      geometry={geometry}
      material={material}
    />
  );
}

/** Inner scene with lights and all asteroids */
function AsteroidScene() {
  // Texturen einmalig erstellen — alle Asteroiden teilen sich diese 3
  // (geringer GPU-Speicher, einmalige Setup-Kosten)
  const textures = useMemo<AsteroidTextures>(
    () => ({
      albedo: createRockAlbedoTexture(),
      bump: createRockBumpTexture(),
      roughness: createRockRoughnessTexture(),
    }),
    [],
  );

  // Mehr Geometrie-Varianten pro Größenklasse → gleicher Asteroid taucht
  // nicht 35x identisch auf. Per sizeClass: 0=512v, 1=1170v, 2=2080v.
  const geometries = useMemo(() => {
    return [
      // Far/small (sizeClass 0) — 3 Varianten
      createAsteroidGeometry(101, 0),
      createAsteroidGeometry(127, 0),
      createAsteroidGeometry(143, 0),
      // Mid (sizeClass 1) — 3 Varianten
      createAsteroidGeometry(202, 1),
      createAsteroidGeometry(231, 1),
      createAsteroidGeometry(258, 1),
      // Near/large (sizeClass 2) — 3 Varianten
      createAsteroidGeometry(404, 2),
      createAsteroidGeometry(437, 2),
      createAsteroidGeometry(463, 2),
    ];
  }, []);

  // Asteroiden-Layout: deterministisch + 3 Tiefen-Layer für echtes Parallax
  const asteroids = useMemo<AsteroidData[]>(() => {
    const rng = seededRand(42);
    const list: AsteroidData[] = [];
    let id = 0;

    // FAR layer: 35 kleine, langsame, dunkle Asteroiden weit hinten
    for (let i = 0; i < 35; i++) {
      const z = BOUNDS_Z_FAR + rng() * 15;
      const size = 0.25 + rng() * 0.45;
      // Leichter Bias rechts (wo die Lichtquelle scheint, wie Referenzbild)
      const x = (rng() - 0.3) * BOUNDS_X * 1.6;
      const y = (rng() - 0.5) * BOUNDS_Y * 1.6;
      // Drift überwiegend nach links (von der Lichtquelle weg)
      const vx = -0.6 - rng() * 0.4;
      const vy = (rng() - 0.5) * 0.3;
      list.push({
        id: id++,
        size,
        initialPos: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(vx, vy, 0),
        rotationAxis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        rotationSpeed: 0.05 + rng() * 0.15,
        shapeSeed: i,
        detail: 0,
        albedo: rng(),
      });
    }

    // MID layer: 22 mittelgroße Asteroiden, mittlere Geschwindigkeit
    for (let i = 0; i < 22; i++) {
      const z = -25 + rng() * 12;
      const size = 0.5 + rng() * 0.9;
      const x = (rng() - 0.3) * BOUNDS_X * 1.4;
      const y = (rng() - 0.5) * BOUNDS_Y * 1.4;
      const vx = -1.0 - rng() * 0.7;
      const vy = (rng() - 0.5) * 0.5;
      list.push({
        id: id++,
        size,
        initialPos: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(vx, vy, 0),
        rotationAxis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        rotationSpeed: 0.1 + rng() * 0.3,
        shapeSeed: i + 100,
        detail: 1,
        albedo: rng(),
      });
    }

    // NEAR layer: 12 große Asteroiden, schnelle Drift
    for (let i = 0; i < 12; i++) {
      const z = BOUNDS_Z_NEAR + rng() * 4;
      const size = 1.2 + rng() * 1.6;
      const x = (rng() - 0.3) * BOUNDS_X * 1.2;
      const y = (rng() - 0.5) * BOUNDS_Y * 1.3;
      const vx = -1.6 - rng() * 1.0;
      const vy = (rng() - 0.5) * 0.7;
      list.push({
        id: id++,
        size,
        initialPos: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(vx, vy, 0),
        rotationAxis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        rotationSpeed: 0.15 + rng() * 0.4,
        shapeSeed: i + 200,
        detail: 2,
        albedo: rng(),
      });
    }
    return list;
  }, []);

  // Map jeden Asteroiden zu einer Geometrie aus dem Pool (deterministisch via shapeSeed)
  const getGeometry = (a: AsteroidData) => {
    if (a.detail === 0) return geometries[a.shapeSeed % 3]; // 0,1,2
    if (a.detail === 1) return geometries[3 + (a.shapeSeed % 3)]; // 3,4,5
    return geometries[6 + (a.shapeSeed % 3)]; // 6,7,8
  };

  return (
    <>
      {/* Hauptlicht — warmes Sun/Explosion-artiges Licht von rechts oben */}
      <directionalLight
        position={[20, 12, 5]}
        intensity={2.4}
        color="#ffb060"
      />
      {/* Sekundäres weiches Fill-Licht — Amber */}
      <directionalLight
        position={[15, -5, 8]}
        intensity={0.8}
        color="#ff8830"
      />
      {/* Sehr schwaches kaltes Rim-Light von hinten links für Tiefe */}
      <directionalLight
        position={[-15, 5, -10]}
        intensity={0.25}
        color="#3a4a6a"
      />
      {/* Minimal-Ambient für sichtbare Schattenseiten (sonst pechschwarz) */}
      <ambientLight intensity={0.06} color="#2a1810" />

      {asteroids.map((a) => (
        <Asteroid
          key={a.id}
          data={a}
          geometry={getGeometry(a)}
          textures={textures}
        />
      ))}
    </>
  );
}

/**
 * Hintergrund-Asteroidenfeld für das Hauptmenü.
 * Liegt absolut positioniert und transparent — das CSS-Atmosphäre-Layer
 * scheint durch.
 */
export function MenuAsteroidField() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 3 }}
    >
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
        // Pixel-Ratio cap — keine 4K-native Rendering, spart enorm Performance
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 10], fov: 60, near: 0.1, far: 200 }}
        style={{ background: "transparent" }}
      >
        <AsteroidScene />
      </Canvas>
    </div>
  );
}
