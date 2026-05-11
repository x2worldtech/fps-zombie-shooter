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
  // Höhere Subdivision: 18 radial × 32 vertikal — keine sichtbaren Polygone mehr,
  // glatte runde Form ohne Lücken zwischen Segmenten
  const geo = new THREE.CylinderGeometry(
    topRadius,
    baseRadius,
    trunkHeight,
    18,
    32,
    false,
  );
  const positions = geo.attributes.position as THREE.BufferAttribute;

  // ── Deterministische Werte pro Trunk (kein per-Vertex-Random) ──
  // Sway-Richtung: feste Achse über die ganze Trunk-Länge (echte Palmen-Lean)
  const rngTrunk = seededRng(seed);
  const swayDirX = (rngTrunk() - 0.5) * 1.2; // Lean-Richtung X
  const swayDirZ = (rngTrunk() - 0.5) * 1.2; // Lean-Richtung Z
  const swayAmount = 0.35 + rngTrunk() * 0.25; // wie stark gebogen

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    // Höhen-Parameter t: 0 (Boden) bis 1 (Spitze)
    const t = (y + trunkHeight / 2) / trunkHeight;

    // ── Natürliche S-Kurve mit fester Richtung ──
    // Sin-Kurve startet bei 0 am Boden, kommt am oberen Drittel zur stärksten Auslenkung
    // (echte Palmen wachsen leicht gebogen — kein Random pro Vertex)
    const sway = Math.sin(t * Math.PI * 0.7) * swayAmount;
    const offsetX = swayDirX * sway;
    const offsetZ = swayDirZ * sway;

    // ── Wurzelbasis-Verbreiterung in den untersten 15% ──
    // Exponentieller Anstieg zur Basis (1.0 → 1.4 als Multiplier)
    const baseFlare = t < 0.15
      ? 1 + ((0.15 - t) / 0.15) ** 2 * 0.4
      : 1;

    // ── Ring-Wachstumsringe als sichtbare Vertikalstruktur ──
    // Charakteristische Palmenringe — markant, gleichmäßig
    const ringFreq = 22; // Anzahl der Ringe entlang der Trunk-Länge
    const ringPhase = t * Math.PI * ringFreq;
    // Sägezahn-artig: scharf nach außen springen, sanft nach innen — wie echte Ringe
    const ringBump = Math.sin(ringPhase) * 0.025 * (1 - t * 0.35);

    // ── Vertikale Faser (subtle 8-fach Bark-Riefen) ──
    const angle = Math.atan2(z, x);
    const fiberBump = Math.sin(angle * 8) * 0.012;

    // Radiale Position neu berechnen
    const len = Math.sqrt(x * x + z * z);
    if (len > 0.001) {
      const nx = x / len;
      const nz = z / len;
      const newR = len * baseFlare + ringBump + fiberBump;
      positions.setXYZ(
        i,
        nx * newR + offsetX,
        y,
        nz * newR + offsetZ,
      );
    } else {
      // Top/Bottom-Vertices (Mittelpunkte): nur Sway anwenden
      positions.setXYZ(i, x + offsetX, y, z + offsetZ);
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
      {offsets.map((off) => (
        <mesh
          key={`coco-${off[0]}-${off[1]}-${off[2]}`}
          material={coconutMat}
          position={off}
          castShadow
        >
          <sphereGeometry args={[0.2, 14, 10]} />
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

  const trunkMat = useMemo(() => {
    const size = 512;
    // ── Albedo: Palmen-Bark mit horizontalen Wachstumsringen, Faserung, Patches ──
    const albedoCanvas = document.createElement("canvas");
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    const aCtx = albedoCanvas.getContext("2d");
    if (aCtx) {
      // Basis: warmer Holzton
      aCtx.fillStyle = "#7a5c2e";
      aCtx.fillRect(0, 0, size, size);

      // Horizontale Bands (Wachstumsringe) als dunklere Streifen
      // Palmenstämme haben ~20 sichtbare Ringe über die Länge
      const ringCount = 24;
      const ringH = size / ringCount;
      for (let r = 0; r < ringCount; r++) {
        const y = r * ringH;
        // Variation: manche Ringe dunkler, manche heller
        const isDark = Math.random() > 0.6;
        if (isDark) {
          // Dunkler Ring (Schatten in der Vertiefung)
          aCtx.fillStyle = `rgba(40,28,12,${0.3 + Math.random() * 0.2})`;
          aCtx.fillRect(0, y + ringH * 0.7, size, ringH * 0.3);
        } else {
          // Heller Ring (Wachstumsband)
          aCtx.fillStyle = `rgba(150,118,70,${0.18 + Math.random() * 0.18})`;
          aCtx.fillRect(0, y + ringH * 0.1, size, ringH * 0.25);
        }
      }

      // Vertikale Faser-Strähnen
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * size;
        const len = 40 + Math.random() * 180;
        const startY = Math.random() * size;
        aCtx.strokeStyle = `rgba(${50 + Math.random() * 40 | 0},${35 + Math.random() * 30 | 0},${15 + Math.random() * 15 | 0},${0.3 + Math.random() * 0.25})`;
        aCtx.lineWidth = 0.6 + Math.random() * 1.2;
        aCtx.beginPath();
        aCtx.moveTo(x, startY);
        // Leicht wellige Faser
        let cy = startY;
        for (let s = 0; s < len / 8; s++) {
          cy += 8;
          const dx = (Math.random() - 0.5) * 2;
          aCtx.lineTo(x + dx, cy);
        }
        aCtx.stroke();
      }

      // Dunkle Flecken (Schadensstellen, abgefallene Frondbasen)
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 4 + Math.random() * 14;
        const g = aCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(25,15,5,${0.5 + Math.random() * 0.3})`);
        g.addColorStop(1, "rgba(25,15,5,0)");
        aCtx.fillStyle = g;
        aCtx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Helle Highlights für sonnige Stellen
      for (let i = 0; i < 25; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 8 + Math.random() * 20;
        const g = aCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(190,160,110,${0.2 + Math.random() * 0.2})`);
        g.addColorStop(1, "rgba(190,160,110,0)");
        aCtx.fillStyle = g;
        aCtx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Per-Pixel-Korn für Holz-Körnung
      const img = aCtx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 20;
        img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
        img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.9));
        img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.7));
      }
      aCtx.putImageData(img, 0, 0);
    }
    const albedoTex = new THREE.CanvasTexture(albedoCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    // Kacheln: 1× horizontal um den Stamm, 1× vertikal (Stamm ist ca. 10m hoch,
    // Textur ist eine vollständige Stamm-Variation)
    albedoTex.repeat.set(1, 1);
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = 8;

    // ── Bump: Horizontale Ringe vertieft + vertikale Fasern ──
    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext("2d");
    if (bCtx) {
      bCtx.fillStyle = "#7f7f7f";
      bCtx.fillRect(0, 0, size, size);

      // Horizontale Ringe als tiefe schwarze Linien
      const ringCount = 24;
      const ringH = size / ringCount;
      for (let r = 0; r < ringCount; r++) {
        const y = r * ringH;
        // Helle obere Kante des Rings
        bCtx.fillStyle = "rgba(255,255,255,0.5)";
        bCtx.fillRect(0, y, size, 2);
        // Dunkle Ring-Vertiefung
        bCtx.fillStyle = "rgba(0,0,0,0.7)";
        bCtx.fillRect(0, y + 4, size, 4);
      }

      // Vertikale Fasern als helle Linien
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * size;
        bCtx.strokeStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${0.2 + Math.random() * 0.2})`;
        bCtx.lineWidth = 0.5 + Math.random() * 1;
        bCtx.beginPath();
        bCtx.moveTo(x, 0);
        bCtx.lineTo(x + (Math.random() - 0.5) * 6, size);
        bCtx.stroke();
      }

      // Per-Pixel-Korn
      const img = bCtx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 60;
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
    bumpTex.repeat.set(1, 1);
    bumpTex.anisotropy = 8;

    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#a4824a"),
      map: albedoTex,
      bumpMap: bumpTex,
      bumpScale: 0.03,
      roughness: 0.95,
      metalness: 0,
    });
  }, []);

  const baseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#5a3e1a"),
        roughness: 0.98,
        metalness: 0.0,
      }),
    [],
  );

  // 16 fronds — dense, realistic palm crown
  const frondCount = 16;
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
          args={[baseRadius * 1.5, baseRadius * 2.1, 0.3, 18, 1]}
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
        <sphereGeometry args={[topRadius * 2.4, 16, 12]} />
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
