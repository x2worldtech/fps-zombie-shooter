import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

// Fixed position for the Pack-a-Punch machine in the desert arena
export const PACK_A_PUNCH_POSITION: [number, number, number] = [15, 0, -12];
export const PACK_A_PUNCH_INTERACT_RANGE = 3.5;

// Collision half-extents (used by FirstPersonCamera) — UNCHANGED so the AABB
// matches the new geometry footprint
export const PACK_A_PUNCH_HALF_W = 0.7;
export const PACK_A_PUNCH_HALF_D = 0.55;

interface PackAPunchMachineProps {
  upgradeTier: number;
}

// ─── Procedural Grime Texture ─────────────────────────────────────────────────
// Dark, oily metal surface with scratches, oil stains, weld seams. Built once,
// cached at module level.
let __papBodyMatCache: THREE.MeshStandardMaterial | null = null;

function buildGrimyMetalMaterial(): THREE.MeshStandardMaterial {
  if (__papBodyMatCache) return __papBodyMatCache;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new THREE.MeshStandardMaterial({
      color: "#2a2a2e",
      roughness: 0.6,
      metalness: 0.7,
    });
    __papBodyMatCache = fallback;
    return fallback;
  }

  // Basis: dunkles Industrie-Grau-Blau
  ctx.fillStyle = "#26262b";
  ctx.fillRect(0, 0, size, size);

  // Subtile Höhenvariation (hellere Patches wo das Metall sauberer ist)
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 12 + Math.random() * 28;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, "rgba(80, 80, 88, 0.35)");
    grd.addColorStop(1, "rgba(80, 80, 88, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ölspritzer (sehr dunkel, fast schwarz)
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 12;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, "rgba(8, 6, 10, 0.95)");
    grd.addColorStop(1, "rgba(8, 6, 10, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kratzer (vertikal, hell)
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 8 + Math.random() * 28;
    ctx.strokeStyle = `rgba(${130 + Math.random() * 40}, ${130 + Math.random() * 40}, ${140 + Math.random() * 40}, 0.6)`;
    ctx.lineWidth = 0.7 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y + len);
    ctx.stroke();
  }

  // Rost-Beläge an Kanten
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 5 + Math.random() * 10;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, "rgba(100, 50, 20, 0.7)");
    grd.addColorStop(1, "rgba(100, 50, 20, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Feines Korn (Metall-Rauheit)
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: "#ffffff",
    roughness: 0.7,
    metalness: 0.55,
  });
  __papBodyMatCache = mat;
  return mat;
}

function PackAPunchMachineInner({ upgradeTier }: PackAPunchMachineProps) {
  const glowRef = useRef<THREE.Mesh>(null);
  const topLightRef = useRef<THREE.PointLight>(null);
  const screenRef = useRef<THREE.Mesh>(null);
  const sparkRef = useRef<THREE.Group>(null);

  // Tier colors: base=purple, tier1=blue, tier2=purple, tier3=gold
  const tierColor = useMemo(() => {
    if (upgradeTier === 0) return new THREE.Color(0.5, 0.1, 0.85);
    if (upgradeTier === 1) return new THREE.Color(0.0, 0.5, 1.0);
    if (upgradeTier === 2) return new THREE.Color(0.7, 0.0, 1.0);
    return new THREE.Color(1.0, 0.78, 0.05);
  }, [upgradeTier]);

  // ── MATERIALIEN ──
  // Hauptkorpus: dreckiges Industrie-Metall
  const bodyMat = useMemo(() => buildGrimyMetalMaterial(), []);

  // Sehr dunkler Akzent (Schweißnähte, Rahmen)
  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#16161a",
        roughness: 0.55,
        metalness: 0.7,
      }),
    [],
  );

  // Heller Stahl (Riffelblech, Schraubenköpfe)
  const steelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#9a9a9e",
        roughness: 0.5,
        metalness: 0.85,
      }),
    [],
  );

  // Rost-akzent (für die Bandage-/Patch-Stellen)
  const rustMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#7a4020",
        roughness: 0.95,
        metalness: 0.2,
      }),
    [],
  );

  // Display-Bildschirm (grobes CRT-Look, leuchtet in tier-Farbe)
  const screenMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: tierColor,
        emissive: tierColor,
        emissiveIntensity: 2.0,
        roughness: 0.4,
        metalness: 0.0,
      }),
    [tierColor],
  );

  // Pulsierender Energiekern (großer Glow oben drauf)
  const coreMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: tierColor,
        emissive: tierColor,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.85,
      }),
    [tierColor],
  );

  // Kabel-Material (schwarz, gummig)
  const cableMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0c0c10",
        roughness: 0.9,
        metalness: 0.1,
      }),
    [],
  );

  // Funken-Material (klein, leuchtend)
  const sparkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: tierColor,
        emissive: tierColor,
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 0.9,
      }),
    [tierColor],
  );

  // Innenseite Schlitz (sehr dunkles Loch — Waffen-Einschub)
  const slotInteriorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#050508",
        roughness: 1,
        metalness: 0,
      }),
    [],
  );

  // Manometer-Nadel (rot)
  const gaugeNeedleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c81010",
        emissive: "#5a0808",
        emissiveIntensity: 0.4,
      }),
    [],
  );

  // Warnhinweis (gelb-bronze, verblasst)
  const warningMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#9a8020",
        emissive: "#3a2810",
        emissiveIntensity: 0.2,
        roughness: 0.9,
      }),
    [],
  );

  // Lüftungsgitter
  const ventGrillMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0a0a0e",
        roughness: 0.95,
        metalness: 0.4,
      }),
    [],
  );

  // Statische Funken-Offsets (8 kleine Funken die um den Kern schweben)
  const sparkOffsets = useMemo(() => {
    const o: [number, number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      o.push([Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5]);
    }
    return o;
  }, []);

  useFrame(() => {
    const t = Date.now() * 0.001;

    // Energiekern pulsiert
    if (glowRef.current) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
      (
        glowRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = 1.2 + pulse * 1.6;
      (glowRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.5 + pulse * 0.35;
    }

    // Bildschirm-Flackern (alter CRT)
    if (screenRef.current) {
      const flicker = 1.6 + Math.sin(t * 7.3) * 0.35 + Math.sin(t * 14.1) * 0.2;
      (
        screenRef.current.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = flicker;
    }

    // Lampen-Pulsing
    if (topLightRef.current) {
      topLightRef.current.intensity = 1.4 + Math.sin(t * 2.5) * 0.7;
      topLightRef.current.color.copy(tierColor);
    }

    // Funken kreiseln um den Kern
    if (sparkRef.current) {
      sparkRef.current.rotation.y = t * 0.6;
      sparkRef.current.children.forEach((child, i) => {
        const offset = (i / 8) * Math.PI * 2;
        child.position.y = Math.sin(t * 1.8 + offset) * 0.18;
        const scale = 0.6 + 0.4 * Math.sin(t * 3 + offset);
        child.scale.setScalar(scale * 0.08);
      });
    }
  });

  const [px, py, pz] = PACK_A_PUNCH_POSITION;

  return (
    <group position={[px, py, pz]}>
      {/* ── Top-Light (leuchtet in tier-Farbe) ── */}
      <pointLight
        ref={topLightRef}
        position={[0, 2.4, 0]}
        intensity={1.5}
        distance={9}
        color={tierColor}
      />

      {/* ══════════════════════════════════════════════════════════════════
          INDUSTRIE-UPGRADE-STATION
          Industrial workbench/forge — heavy steel chassis with corrugated
          panels, scattered cables, oil-stained surfaces. Outer footprint
          ~1.4 × 1.1m (matches PACK_A_PUNCH_HALF_W/D).
          ══════════════════════════════════════════════════════════════════ */}

      {/* ── 1) FUSS-SOCKEL (heavy steel base) ── */}
      <mesh material={frameMat} position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.12, 1.1]} />
      </mesh>
      {/* Verstärkte Ecken-Pfosten */}
      {[
        [-0.62, -0.46],
        [0.62, -0.46],
        [-0.62, 0.46],
        [0.62, 0.46],
      ].map(([cx, cz]) => (
        <mesh
          key={`corner-${cx}-${cz}`}
          material={steelMat}
          position={[cx, 0.06, cz]}
        >
          <boxGeometry args={[0.1, 0.13, 0.1]} />
        </mesh>
      ))}

      {/* ── 2) HAUPTGEHÄUSE (dreckiges Industrie-Metall) ── */}
      <mesh material={bodyMat} position={[0, 1.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 1.78, 0.9]} />
      </mesh>

      {/* ── 3) RIFFELBLECH-PANELS (seitlich) ── */}
      <mesh material={steelMat} position={[-0.62, 1.05, 0]} castShadow>
        <boxGeometry args={[0.04, 1.7, 0.86]} />
      </mesh>
      <mesh material={steelMat} position={[0.62, 1.05, 0]} castShadow>
        <boxGeometry args={[0.04, 1.7, 0.86]} />
      </mesh>
      {/* Schraubenköpfe an den Seiten-Panels (visuelles Detail) */}
      {[0.2, 0.6, 1.0, 1.4, 1.8].map((sy) => (
        <group key={`bolts-${sy}`}>
          <mesh material={steelMat} position={[-0.642, sy, 0.36]}>
            <cylinderGeometry args={[0.022, 0.022, 0.018, 6]} />
          </mesh>
          <mesh material={steelMat} position={[-0.642, sy, -0.36]}>
            <cylinderGeometry args={[0.022, 0.022, 0.018, 6]} />
          </mesh>
          <mesh material={steelMat} position={[0.642, sy, 0.36]}>
            <cylinderGeometry args={[0.022, 0.022, 0.018, 6]} />
          </mesh>
          <mesh material={steelMat} position={[0.642, sy, -0.36]}>
            <cylinderGeometry args={[0.022, 0.022, 0.018, 6]} />
          </mesh>
        </group>
      ))}

      {/* ── 4) HORIZONTALE SCHWEISSNÄHTE auf Vorderseite ── */}
      <mesh material={frameMat} position={[0, 0.4, 0.452]}>
        <boxGeometry args={[1.1, 0.04, 0.012]} />
      </mesh>
      <mesh material={frameMat} position={[0, 1.7, 0.452]}>
        <boxGeometry args={[1.1, 0.04, 0.012]} />
      </mesh>

      {/* ── 5) HAUPT-BILDSCHIRM (alter CRT, leuchtet in tier-Farbe) ── */}
      {/* Rahmen aus dunklem Stahl */}
      <mesh material={frameMat} position={[0, 1.3, 0.45]} castShadow>
        <boxGeometry args={[0.92, 0.62, 0.04]} />
      </mesh>
      {/* Schwarzer Bezel */}
      <mesh material={frameMat} position={[0, 1.3, 0.471]}>
        <boxGeometry args={[0.86, 0.56, 0.012]} />
      </mesh>
      {/* Eigentliche Bildfläche */}
      <mesh ref={screenRef} material={screenMat} position={[0, 1.3, 0.478]}>
        <boxGeometry args={[0.78, 0.48, 0.008]} />
      </mesh>
      {/* Scanline-Effekt (zwei feine Linien drüber) */}
      <mesh material={frameMat} position={[0, 1.35, 0.483]}>
        <boxGeometry args={[0.76, 0.004, 0.005]} />
      </mesh>
      <mesh material={frameMat} position={[0, 1.25, 0.483]}>
        <boxGeometry args={[0.76, 0.004, 0.005]} />
      </mesh>

      {/* ── 6) WAFFEN-EINSCHUB-SCHLITZ unter dem Screen ── */}
      <mesh material={frameMat} position={[0, 0.78, 0.45]}>
        <boxGeometry args={[0.5, 0.06, 0.02]} />
      </mesh>
      {/* Innenseite des Schlitzes (sehr dunkel) */}
      <mesh material={slotInteriorMat} position={[0, 0.78, 0.453]}>
        <boxGeometry args={[0.46, 0.04, 0.008]} />
      </mesh>

      {/* ── 7) STELL-RÄDER / HEBEL ── */}
      {/* Linker Drehknopf (groß, geriffelt) */}
      <mesh material={steelMat} position={[-0.36, 0.78, 0.46]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.04, 12]} />
      </mesh>
      <mesh material={frameMat} position={[-0.36, 0.78, 0.483]}>
        <cylinderGeometry args={[0.052, 0.052, 0.012, 10]} />
      </mesh>
      {/* Rechter Hebel */}
      <mesh
        material={steelMat}
        position={[0.36, 0.78, 0.47]}
        rotation={[0, 0, -0.4]}
      >
        <boxGeometry args={[0.05, 0.16, 0.04]} />
      </mesh>
      <mesh material={frameMat} position={[0.36, 0.7, 0.47]}>
        <cylinderGeometry args={[0.038, 0.038, 0.022, 10]} />
      </mesh>

      {/* ── 8) MANOMETER (kleines rundes Druckanzeige-Gerät) ── */}
      <mesh material={steelMat} position={[0.46, 1.65, 0.46]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.04, 14]} />
      </mesh>
      <mesh material={frameMat} position={[0.46, 1.65, 0.482]}>
        <cylinderGeometry args={[0.058, 0.058, 0.012, 12]} />
      </mesh>
      {/* Manometer-Nadel (rot) */}
      <mesh
        material={gaugeNeedleMat}
        position={[0.46, 1.665, 0.49]}
        rotation={[0, 0, 0.4]}
      >
        <boxGeometry args={[0.04, 0.005, 0.005]} />
      </mesh>

      {/* ── 9) KABEL ── */}
      {/* Dickes Kabel von hinten oben kommend, geht in den Seitenpfosten */}
      <mesh
        material={cableMat}
        position={[-0.5, 1.9, -0.3]}
        rotation={[0.5, 0, 0.2]}
      >
        <cylinderGeometry args={[0.035, 0.035, 0.6, 8]} />
      </mesh>
      {/* Zweites Kabel rechts */}
      <mesh
        material={cableMat}
        position={[0.48, 1.95, -0.32]}
        rotation={[0.6, 0, -0.1]}
      >
        <cylinderGeometry args={[0.028, 0.028, 0.5, 8]} />
      </mesh>
      {/* Loses Kabel das vorne hängt */}
      <mesh
        material={cableMat}
        position={[-0.3, 0.5, 0.46]}
        rotation={[0, 0, 0.15]}
      >
        <cylinderGeometry args={[0.018, 0.018, 0.7, 6]} />
      </mesh>
      {/* Kabelanschluss (dicker Stecker) */}
      <mesh material={frameMat} position={[-0.32, 0.18, 0.46]} castShadow>
        <boxGeometry args={[0.06, 0.06, 0.06]} />
      </mesh>

      {/* ── 10) WARNHINWEISE / SCHILDER ── */}
      {/* Gelbes Warndreieck (verblasst) */}
      <mesh
        material={warningMat}
        position={[0.4, 0.5, 0.46]}
        rotation={[0, 0, Math.PI]}
      >
        <coneGeometry args={[0.06, 0.012, 3]} />
      </mesh>

      {/* ── 11) BANDAGE/SCHWEISSPATCH (provisorisch repariert) ── */}
      <mesh material={rustMat} position={[-0.4, 1.6, 0.453]}>
        <boxGeometry args={[0.14, 0.16, 0.015]} />
      </mesh>
      {/* Schweißnaht um die Bandage */}
      <mesh material={steelMat} position={[-0.4, 1.68, 0.46]}>
        <boxGeometry args={[0.16, 0.012, 0.008]} />
      </mesh>
      <mesh material={steelMat} position={[-0.4, 1.52, 0.46]}>
        <boxGeometry args={[0.16, 0.012, 0.008]} />
      </mesh>

      {/* ── 12) TOP-DECKEL (dicke Stahlplatte) ── */}
      <mesh material={frameMat} position={[0, 1.98, 0]} castShadow>
        <boxGeometry args={[1.32, 0.08, 1.0]} />
      </mesh>
      {/* Lüftungsgitter oben drauf */}
      {[-0.28, -0.14, 0, 0.14, 0.28].map((sx) => (
        <mesh
          key={`vent-${sx}`}
          material={ventGrillMat}
          position={[sx, 2.022, 0.0]}
        >
          <boxGeometry args={[0.04, 0.012, 0.5]} />
        </mesh>
      ))}

      {/* ── 13) ENERGIE-KERN (oben drauf, pulsiert in tier-Farbe) ── */}
      {/* Halterung (Bracket) */}
      <mesh material={steelMat} position={[0, 2.1, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.06, 14]} />
      </mesh>
      <mesh material={frameMat} position={[0, 2.16, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.04, 14]} />
      </mesh>
      {/* Innerer leuchtender Kern */}
      <mesh ref={glowRef} material={coreMat} position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.2, 18, 14]} />
      </mesh>
      {/* Äußerer Halo */}
      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.32, 16, 12]} />
        <meshStandardMaterial
          color={tierColor}
          emissive={tierColor}
          emissiveIntensity={0.5}
          transparent
          opacity={0.18}
          side={THREE.BackSide}
        />
      </mesh>

      {/* ── 14) FUNKEN UM DEN KERN ── */}
      <group ref={sparkRef} position={[0, 2.3, 0]}>
        {sparkOffsets.map((o, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static sparks
          <mesh key={i} material={sparkMat} position={o}>
            <octahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
      </group>

      {/* ── 15) RUSTY PATCHES vorn (Verschleiß-Details) ── */}
      <mesh material={rustMat} position={[0.42, 0.3, 0.456]}>
        <boxGeometry args={[0.18, 0.1, 0.005]} />
      </mesh>
      <mesh material={rustMat} position={[-0.5, 0.22, 0.456]}>
        <boxGeometry args={[0.1, 0.14, 0.005]} />
      </mesh>

      {/* ── 16) ÖL-PFÜTZE am Boden vorne (sehr dunkel, glänzend) ── */}
      <mesh
        position={[0.55, 0.005, 0.62]}
        rotation={[-Math.PI / 2, 0, 0.4]}
      >
        <circleGeometry args={[0.18, 16]} />
        <meshStandardMaterial
          color="#08080a"
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>
    </group>
  );
}

// PERF: memo — die Machine rendert nur bei upgradeTier-Change
export const PackAPunchMachine = memo(PackAPunchMachineInner);
