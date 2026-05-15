import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

interface JuggernogMachineProps {
  position: [number, number, number];
  purchaseCount: number;
}

// ─── Procedural Weathering Texture ────────────────────────────────────────────
// 256×256 Canvas: rote Coca-Cola-Style-Basis mit verblasstem, abblätterndem
// Lack, Roststellen, Kratzern. Wird einmal als Module-Cache gehalten — Juggernog
// gibt es nur 1× in der Welt, aber bei Portal-Loop nach Desert-Rückkehr greift
// der Cache.
let __juggernogBodyMatCache: THREE.MeshStandardMaterial | null = null;

function buildWeatheredRedMaterial(): THREE.MeshStandardMaterial {
  if (__juggernogBodyMatCache) return __juggernogBodyMatCache;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new THREE.MeshStandardMaterial({
      color: "#a8211d",
      roughness: 0.85,
      metalness: 0.15,
    });
    __juggernogBodyMatCache = fallback;
    return fallback;
  }

  // Basis-Lack: tiefes Rot mit minimaler Variation
  ctx.fillStyle = "#a8211d";
  ctx.fillRect(0, 0, size, size);

  // Hellere Highlights / Abnutzung
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 6 + Math.random() * 18;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, "rgba(220, 70, 60, 0.4)");
    grd.addColorStop(1, "rgba(220, 70, 60, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kratzer (vertikale dünne Striche)
  for (let i = 0; i < 35; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 10 + Math.random() * 30;
    ctx.strokeStyle = `rgba(${60 + Math.random() * 30}, ${20 + Math.random() * 15}, ${15 + Math.random() * 15}, 0.55)`;
    ctx.lineWidth = 0.8 + Math.random() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, y + len);
    ctx.stroke();
  }

  // Roststellen (orange-braun, organisch geformt)
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 4 + Math.random() * 14;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, "rgba(90, 50, 20, 0.85)");
    grd.addColorStop(0.6, "rgba(120, 70, 30, 0.5)");
    grd.addColorStop(1, "rgba(120, 70, 30, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Abblätternder Lack (dunklere Flecken — wo Lack runter ist und das Metall durchschaut)
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 6 + Math.random() * 16;
    const h = 4 + Math.random() * 12;
    ctx.fillStyle = `rgba(${40 + Math.random() * 20}, ${30 + Math.random() * 15}, ${25 + Math.random() * 10}, 0.7)`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Schmutz/Staub (sehr feines Noise oben drauf)
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
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
    roughness: 0.78,
    metalness: 0.2,
  });
  __juggernogBodyMatCache = mat;
  return mat;
}

function JuggernogMachineInner({
  position,
  purchaseCount,
}: JuggernogMachineProps) {
  const glowRef = useRef<THREE.PointLight>(null);
  const screenRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  // ── MATERIALIEN ──
  // Hauptkorpus: verwitterter roter Coca-Cola-Stil
  const bodyMaterial = useMemo(() => buildWeatheredRedMaterial(), []);

  // Dunkelrotes Trim (oben/unten + seitliche Pfosten)
  const darkRedMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#6a0d0a",
        roughness: 0.85,
        metalness: 0.25,
      }),
    [],
  );

  // Chrom (oxidiert, matt — wie alte 60er Vending Machines)
  const chromeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#a8a8a0",
        roughness: 0.55,
        metalness: 0.7,
      }),
    [],
  );

  // Geschwärztes/abgenutztes Schwarz für Vending-Schlitz
  const blackMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a1612",
        roughness: 0.9,
        metalness: 0.1,
      }),
    [],
  );

  // Cremeweißes vergilbtes Label-Hintergrund (wie alte Emaille-Schilder)
  const labelBgMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: purchaseCount >= 2 ? "#5a5045" : "#e8d8b0",
        emissive: purchaseCount >= 2 ? "#000000" : "#3a2a10",
        emissiveIntensity: purchaseCount >= 2 ? 0 : 0.15,
        roughness: 0.85,
        metalness: 0.05,
      }),
    [purchaseCount],
  );

  // "JUGGER-NOG" Schrift (dunkelrot-braun, wie ausgebleichtes Emaille-Logo)
  const labelTextMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: purchaseCount >= 2 ? "#444444" : "#7a0e0a",
        emissive: purchaseCount >= 2 ? "#000000" : "#4a0606",
        emissiveIntensity: purchaseCount >= 2 ? 0 : 0.3,
        roughness: 0.7,
        metalness: 0.1,
      }),
    [purchaseCount],
  );

  // Display-Glas (verfärbt, schmutzig)
  const glassMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#6a8a90",
        transparent: true,
        opacity: 0.45,
        roughness: 0.4,
        metalness: 0.1,
      }),
    [],
  );

  // Roter Druckknopf — leuchtet wenn aktiv
  const buttonMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: purchaseCount >= 2 ? "#3a1010" : "#c8221d",
        emissive: purchaseCount >= 2 ? "#000000" : "#7a0a0a",
        emissiveIntensity: purchaseCount >= 2 ? 0 : 0.4,
        roughness: 0.6,
        metalness: 0.2,
      }),
    [purchaseCount],
  );

  // Flaschen im Display (drinks visible behind glass)
  const bottleMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#3a1a0a",
        roughness: 0.4,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85,
      }),
    [],
  );
  const bottleCapMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c8221d",
        roughness: 0.7,
        metalness: 0.3,
      }),
    [],
  );

  // Screen / Preis-Anzeige (alte VFD-Anzeige Look)
  const screenMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: purchaseCount >= 2 ? "#2a2a2a" : "#1a0a0a",
        emissive: purchaseCount >= 2 ? "#000000" : "#c8181a",
        emissiveIntensity: purchaseCount >= 2 ? 0 : 0.9,
        roughness: 0.6,
        metalness: 0.1,
      }),
    [purchaseCount],
  );

  // Rost-Patches (zwei Varianten — größer/dunkler oben, kleiner/heller unten)
  const rustDarkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#5a3010",
        roughness: 0.95,
        metalness: 0.3,
      }),
    [],
  );
  const rustLightMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#704020",
        roughness: 0.95,
        metalness: 0.25,
      }),
    [],
  );

  // ── Animations-Loop: nur Pulsing / Subtle Flicker ──
  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (glowRef.current && purchaseCount < 2) {
      // Leichtes Flackern wie alte Neon-Beleuchtung
      const flicker =
        1.0 + Math.sin(t * 2.5) * 0.3 + Math.sin(t * 9.7) * 0.1;
      glowRef.current.intensity = flicker;
    }

    if (screenRef.current && purchaseCount < 2) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.7 + Math.sin(t * 3.5) * 0.25;
    }
  });

  return (
    <group position={position}>
      {/* ── Subtiler roter Schein (alte Neon-Beleuchtung im Inneren) ── */}
      {purchaseCount < 2 && (
        <pointLight
          ref={glowRef}
          color="#ff3a20"
          intensity={1.0}
          distance={5.5}
          decay={2}
          position={[0, 1.5, 0.5]}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          VENDING MACHINE — vintage 60s Coca-Cola style
          Vertical layout:
            y=0.0       : ground
            y=0.0-0.12  : recessed base / Stahl-Sockel
            y=0.12-2.55 : main red body (with textured weathering)
            y=2.55-2.75 : top "marquee" panel (cream label with JUGGER-NOG text)
            y=2.75-2.85 : top trim / Lampenleiste
          Outer footprint ~1.0 × 0.65m
          ══════════════════════════════════════════════════════════════════ */}

      {/* ── 1) Stahl-Sockel (recessed plinth) ── */}
      <mesh material={chromeMaterial} position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.04, 0.12, 0.68]} />
      </mesh>
      {/* Mit Rost an den Ecken */}
      <mesh material={darkRedMaterial} position={[-0.5, 0.06, 0.33]}>
        <boxGeometry args={[0.06, 0.13, 0.04]} />
      </mesh>
      <mesh material={darkRedMaterial} position={[0.5, 0.06, 0.33]}>
        <boxGeometry args={[0.06, 0.13, 0.04]} />
      </mesh>

      {/* ── 2) HAUPTKORPUS — verwitterter roter Lack ── */}
      <mesh material={bodyMaterial} position={[0, 1.33, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 2.42, 0.65]} />
      </mesh>

      {/* Vertikale Trim-Streifen seitlich (das hervorgehobene Kantenprofil
          der echten Vintage-Machines) */}
      <mesh material={darkRedMaterial} position={[-0.51, 1.33, 0]} castShadow>
        <boxGeometry args={[0.03, 2.42, 0.7]} />
      </mesh>
      <mesh material={darkRedMaterial} position={[0.51, 1.33, 0]} castShadow>
        <boxGeometry args={[0.03, 2.42, 0.7]} />
      </mesh>

      {/* Vorderseiten-Rahmen (rund um Glas + Bedienelemente) */}
      <mesh material={darkRedMaterial} position={[0, 2.5, 0.32]}>
        <boxGeometry args={[1.0, 0.06, 0.02]} />
      </mesh>
      <mesh material={darkRedMaterial} position={[0, 0.18, 0.32]}>
        <boxGeometry args={[1.0, 0.06, 0.02]} />
      </mesh>

      {/* ── 3) DISPLAY-GLAS (drinks behind) — leicht verschmutzt ── */}
      <mesh material={glassMaterial} position={[0, 1.65, 0.331]}>
        <boxGeometry args={[0.82, 1.4, 0.005]} />
      </mesh>
      {/* Chrome-Rahmen um das Glas */}
      <mesh material={chromeMaterial} position={[0, 2.36, 0.333]}>
        <boxGeometry args={[0.86, 0.04, 0.012]} />
      </mesh>
      <mesh material={chromeMaterial} position={[0, 0.94, 0.333]}>
        <boxGeometry args={[0.86, 0.04, 0.012]} />
      </mesh>
      <mesh material={chromeMaterial} position={[-0.42, 1.65, 0.333]}>
        <boxGeometry args={[0.04, 1.44, 0.012]} />
      </mesh>
      <mesh material={chromeMaterial} position={[0.42, 1.65, 0.333]}>
        <boxGeometry args={[0.04, 1.44, 0.012]} />
      </mesh>

      {/* ── 4) FLASCHEN-REIHE im Display (4 sichtbare Flaschen) ── */}
      {[-0.27, -0.09, 0.09, 0.27].map((bx) => (
        <group key={`bottle-${bx}`} position={[bx, 1.55, 0.21]}>
          {/* Flaschenkörper (dunkelbraunes Glas, klassische Cola-Form) */}
          <mesh material={bottleMaterial} position={[0, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.4, 12]} />
          </mesh>
          {/* Flaschenhals */}
          <mesh material={bottleMaterial} position={[0, 0.27, 0]}>
            <cylinderGeometry args={[0.025, 0.04, 0.12, 10]} />
          </mesh>
          {/* Kronkorken */}
          <mesh material={bottleCapMaterial} position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.025, 10]} />
          </mesh>
        </group>
      ))}
      {/* Zweite Reihe Flaschen darunter */}
      {[-0.27, -0.09, 0.09, 0.27].map((bx) => (
        <group key={`bottle2-${bx}`} position={[bx, 1.12, 0.21]}>
          <mesh material={bottleMaterial} position={[0, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.4, 12]} />
          </mesh>
          <mesh material={bottleMaterial} position={[0, 0.27, 0]}>
            <cylinderGeometry args={[0.025, 0.04, 0.12, 10]} />
          </mesh>
          <mesh material={bottleCapMaterial} position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.025, 10]} />
          </mesh>
        </group>
      ))}

      {/* ── 5) "JUGGER-NOG" MARQUEE (oberes Label-Panel) ── */}
      {/* Cremeweißer Hintergrund (vergilbtes Emaille-Schild) */}
      <mesh material={labelBgMaterial} position={[0, 2.65, 0.33]} castShadow>
        <boxGeometry args={[0.94, 0.22, 0.022]} />
      </mesh>
      {/* "JUGGER" — links — als rote Block-Buchstaben angedeutet (kleine Boxen) */}
      {[-0.28, -0.21, -0.14, -0.07].map((lx, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static label
        <mesh key={`l1-${i}`} material={labelTextMaterial} position={[lx, 2.65, 0.342]}>
          <boxGeometry args={[0.048, 0.13, 0.008]} />
        </mesh>
      ))}
      {/* Trenn-Bindestrich */}
      <mesh material={labelTextMaterial} position={[0, 2.65, 0.342]}>
        <boxGeometry args={[0.018, 0.022, 0.008]} />
      </mesh>
      {/* "NOG" — rechts */}
      {[0.08, 0.16, 0.24].map((lx, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static label
        <mesh key={`l2-${i}`} material={labelTextMaterial} position={[lx, 2.65, 0.342]}>
          <boxGeometry args={[0.06, 0.13, 0.008]} />
        </mesh>
      ))}

      {/* ── 6) TOP-LAMPEN-LEISTE (Chrom-Hut der Maschine) ── */}
      <mesh material={chromeMaterial} position={[0, 2.82, 0]}>
        <boxGeometry args={[1.06, 0.08, 0.7]} />
      </mesh>
      <mesh material={darkRedMaterial} position={[0, 2.88, 0]}>
        <boxGeometry args={[1.0, 0.06, 0.66]} />
      </mesh>

      {/* ── 7) BEDIEN-PANEL UNTEN ── */}
      {/* Chrom-Knopfreihe-Hintergrund */}
      <mesh material={chromeMaterial} position={[0, 0.62, 0.332]}>
        <boxGeometry args={[0.62, 0.16, 0.018]} />
      </mesh>

      {/* Großer roter Druckknopf (in der Mitte, leuchtet) */}
      <mesh material={buttonMaterial} position={[-0.16, 0.62, 0.342]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.025, 16]} />
      </mesh>
      {/* Knopf-Highlight (Chrom-Ring drumherum) */}
      <mesh material={chromeMaterial} position={[-0.16, 0.62, 0.34]}>
        <cylinderGeometry args={[0.058, 0.058, 0.018, 16]} />
      </mesh>

      {/* PREIS-Display (rote VFD-Ziffern) */}
      <mesh
        ref={screenRef}
        material={screenMaterial}
        position={[0.13, 0.62, 0.343]}
      >
        <boxGeometry args={[0.24, 0.09, 0.01]} />
      </mesh>
      {/* Schwarzer Rahmen um Screen */}
      <mesh material={blackMaterial} position={[0.13, 0.62, 0.341]}>
        <boxGeometry args={[0.27, 0.12, 0.012]} />
      </mesh>

      {/* ── 8) MÜNZEINWURF ── */}
      <mesh material={chromeMaterial} position={[0.36, 0.62, 0.342]}>
        <boxGeometry args={[0.06, 0.1, 0.022]} />
      </mesh>
      {/* Münzschlitz selbst (schwarz) */}
      <mesh material={blackMaterial} position={[0.36, 0.62, 0.354]}>
        <boxGeometry args={[0.028, 0.005, 0.005]} />
      </mesh>

      {/* ── 9) AUSGABE-SCHLITZ UNTEN (für die ausgegebene Flasche) ── */}
      <mesh material={blackMaterial} position={[0, 0.42, 0.34]}>
        <boxGeometry args={[0.42, 0.13, 0.015]} />
      </mesh>
      {/* Klappe (rotes Stück oben drüber) */}
      <mesh material={darkRedMaterial} position={[0, 0.51, 0.348]}>
        <boxGeometry args={[0.44, 0.04, 0.012]} />
      </mesh>

      {/* ── 10) RUSTY DAMAGE PATCHES — Roststellen oben links + unten rechts ── */}
      {/* Großer Rostfleck oben links (durch Lack durchgekommen) */}
      <mesh material={rustDarkMat} position={[-0.42, 2.25, 0.327]}>
        <boxGeometry args={[0.18, 0.22, 0.005]} />
      </mesh>
      {/* Kleinerer Rostfleck unten rechts */}
      <mesh material={rustLightMat} position={[0.4, 0.32, 0.327]}>
        <boxGeometry args={[0.12, 0.14, 0.005]} />
      </mesh>

      {/* ── 11) KRATZER / DENT (eingedellt am rechten Rand) ── */}
      <mesh material={darkRedMaterial} position={[0.46, 1.4, 0.31]}>
        <boxGeometry args={[0.08, 0.18, 0.008]} />
      </mesh>

      {/* ── 12) HEAVY DUTY FÜSSE (vorne) ── */}
      <mesh material={blackMaterial} position={[-0.45, 0.03, 0.28]}>
        <cylinderGeometry args={[0.04, 0.05, 0.06, 8]} />
      </mesh>
      <mesh material={blackMaterial} position={[0.45, 0.03, 0.28]}>
        <cylinderGeometry args={[0.04, 0.05, 0.06, 8]} />
      </mesh>
      <mesh material={blackMaterial} position={[-0.45, 0.03, -0.28]}>
        <cylinderGeometry args={[0.04, 0.05, 0.06, 8]} />
      </mesh>
      <mesh material={blackMaterial} position={[0.45, 0.03, -0.28]}>
        <cylinderGeometry args={[0.04, 0.05, 0.06, 8]} />
      </mesh>

      {/* ── 13) "MAXED" OVERLAY wenn ausverkauft ── */}
      {purchaseCount >= 2 && (
        <mesh position={[0, 1.5, 0.355]}>
          <boxGeometry args={[1.02, 2.5, 0.005]} />
          <meshStandardMaterial color="#1a1a1a" transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}

// PERF: memo — die Machine rendert nur bei purchaseCount-Change
export default memo(JuggernogMachineInner);
