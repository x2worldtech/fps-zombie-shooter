import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

// ─── PERF-NOTE ────────────────────────────────────────────────────────────────
// Vorher: jedes Decal erzeugte 12–19 einzelne <mesh> mit eigener Geometry und
// eigenem Material. Bei MAX_DECALS = 220 = bis zu ~4180 Draw-Calls/Materials
// nur durch Decals → massiver Lag-Spike beim Schießen.
//
// Jetzt: 6 InstancedMeshes (eine pro Layer/Decal-Type-Kombination). Pro Layer
// alle Lobes/Satelliten desselben Typs in EINEM Draw-Call. Geometrie und
// Material werden je Layer EINMAL allokiert. Die Visualisierung (Form, Farbe,
// Layer-Reihenfolge, Opacity, Y-Stacking, Lobe-/Satellite-Anzahl, Rotation,
// Größe) ist bit-für-bit identisch zur vorherigen Implementierung.
//
// Layer-Mapping:
//   1) poolRim       — Pool-only Trocknungs-Rand,  rimColor 0.32, 16 segs
//   2) poolMid       — Pool Hauptschicht,          midColor 0.85, 14 segs
//   3) splatterMid   — Splatter Hauptschicht,      midColor 0.78, 10 segs
//   4) poolCore      — Pool dunkler Kern,          coreColor 0.92, 12 segs
//   5) poolSat       — Pool Satelliten,            midColor 0.78,  6 segs
//   6) splatterSat   — Splatter Satelliten,        midColor 0.78,  6 segs
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DECALS = 220;
// Theoretische Worst-Case-Werte basierend auf der Original-Logik. Spawn-Logik:
// pool: 3-5 lobes, 4-7 satellites. splatter: 1-2 lobes, 2-4 satellites.
// Wir reservieren großzügig damit "count" nie über Kapazität geht.
const MAX_LOBES_PER_DECAL = 5;
const MAX_SAT_PER_DECAL = 7;

// Original-Konstanten aus dem alten Code unverändert übernommen
const COLOR_POOL_CORE = "#3a0202";
const COLOR_POOL_MID = "#5e0606";
const COLOR_POOL_RIM = "#8a1010";
const COLOR_SPLAT_MID = "#990000";

// Y-Offsets pro Layer (identisch zur alten Implementierung)
const Y_BASE = 0.012; // rim
const Y_MID = 0.014; // mid lobes
const Y_TOP = 0.016; // core
const Y_SAT = 0.013; // satellites

interface SatelliteDrop {
  dx: number;
  dz: number;
  size: number;
}

interface BloodDecal {
  id: number;
  x: number;
  z: number;
  size: number;
  type: "pool" | "splatter";
  rotation: number;
  lobes: { dx: number; dz: number; r: number; rot: number }[];
  satellites: SatelliteDrop[];
}

export interface BloodDecalsHandle {
  addBloodPool: (position: [number, number, number]) => void;
  addBloodSplatter: (position: [number, number, number]) => void;
}

let decalIdCounter = 0;

/**
 * Helper: schreibt die welt-relative Matrix eines lokal positionierten Mesh
 * unter einem rotierten Decal-Group-Parent in die übergebene Matrix4. Bildet
 * exakt die alte JSX-Hierarchie nach:
 *   <group position={[decal.x, 0, decal.z]} rotation={[0, decal.rotation, 0]}>
 *     <mesh position={[lx, ly, lz]} rotation={[-PI/2, 0, localRot]} scale={s} />
 *   </group>
 */
function composeDecalMatrix(
  target: THREE.Matrix4,
  decalX: number,
  decalZ: number,
  decalRotY: number,
  localX: number,
  localY: number,
  localZ: number,
  localRotZ: number,
  scale: number,
  parent: THREE.Object3D,
  child: THREE.Object3D,
) {
  parent.position.set(decalX, 0, decalZ);
  parent.rotation.set(0, decalRotY, 0);
  child.position.set(localX, localY, localZ);
  child.rotation.set(-Math.PI / 2, 0, localRotZ);
  child.scale.setScalar(scale);
  parent.updateMatrixWorld(true);
  target.copy(child.matrixWorld);
}

const BloodDecals = forwardRef<BloodDecalsHandle>((_, ref) => {
  const [decals, setDecals] = useState<BloodDecal[]>([]);

  // ── InstancedMesh-Refs ─────────────────────────────────────────────────────
  const poolRimRef = useRef<THREE.InstancedMesh>(null);
  const poolMidRef = useRef<THREE.InstancedMesh>(null);
  const splatMidRef = useRef<THREE.InstancedMesh>(null);
  const poolCoreRef = useRef<THREE.InstancedMesh>(null);
  const poolSatRef = useRef<THREE.InstancedMesh>(null);
  const splatSatRef = useRef<THREE.InstancedMesh>(null);

  // ── Shared mutable Parent/Child für Matrix-Composition (kein Alloc/Frame) ──
  // Die Composition läuft nur wenn `decals` sich ändert (also beim Schießen),
  // nicht in useFrame.
  const composeParentRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const composeChildRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const tmpMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());
  // Parent-Child einmal verbinden, damit updateMatrixWorld die Kette berechnet
  useEffect(() => {
    const parent = composeParentRef.current;
    const child = composeChildRef.current;
    parent.add(child);
    return () => {
      parent.remove(child);
    };
  }, []);

  // ── Geometrien einmal erzeugen (Radius 1, Segmente wie im Original) ────────
  const geoRim16 = useMemo(() => new THREE.CircleGeometry(1, 16), []);
  const geoPoolMid14 = useMemo(() => new THREE.CircleGeometry(1, 14), []);
  const geoSplatMid10 = useMemo(() => new THREE.CircleGeometry(1, 10), []);
  const geoPoolCore12 = useMemo(() => new THREE.CircleGeometry(1, 12), []);
  const geoSat6 = useMemo(() => new THREE.CircleGeometry(1, 6), []);

  // ── Materialien einmal erzeugen (Farbe + Opacity exakt wie alt) ────────────
  const matPoolRim = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(COLOR_POOL_RIM),
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    [],
  );
  const matPoolMid = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(COLOR_POOL_MID),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    [],
  );
  const matSplatMid = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(COLOR_SPLAT_MID),
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    [],
  );
  const matPoolCore = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(COLOR_POOL_CORE),
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    [],
  );
  const matPoolSat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(COLOR_POOL_MID), // satellites nutzen midColor
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    [],
  );
  const matSplatSat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(COLOR_SPLAT_MID),
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    [],
  );

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      geoRim16.dispose();
      geoPoolMid14.dispose();
      geoSplatMid10.dispose();
      geoPoolCore12.dispose();
      geoSat6.dispose();
      matPoolRim.dispose();
      matPoolMid.dispose();
      matSplatMid.dispose();
      matPoolCore.dispose();
      matPoolSat.dispose();
      matSplatSat.dispose();
    };
  }, [
    geoRim16,
    geoPoolMid14,
    geoSplatMid10,
    geoPoolCore12,
    geoSat6,
    matPoolRim,
    matPoolMid,
    matSplatMid,
    matPoolCore,
    matPoolSat,
    matSplatSat,
  ]);

  const addDecal = useCallback(
    (x: number, z: number, size: number, type: "pool" | "splatter") => {
      // Pools: 3-5 Lobes für unregelmäßige Form
      // Splatters: 1-2 Lobes
      const lobeCount =
        type === "pool"
          ? 3 + Math.floor(Math.random() * 3)
          : 1 + Math.floor(Math.random() * 2);
      const lobes: { dx: number; dz: number; r: number; rot: number }[] = [];
      for (let i = 0; i < lobeCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = (Math.random() * 0.5 + 0.15) * size;
        lobes.push({
          dx: Math.cos(angle) * dist,
          dz: Math.sin(angle) * dist,
          r: size * (0.55 + Math.random() * 0.55),
          rot: Math.random() * Math.PI * 2,
        });
      }
      // Satelliten: wenige kleine Tropfen drumherum
      const satCount =
        type === "pool"
          ? 4 + Math.floor(Math.random() * 4)
          : 2 + Math.floor(Math.random() * 3);
      const satellites: SatelliteDrop[] = [];
      for (let i = 0; i < satCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = size * (0.9 + Math.random() * 1.4);
        satellites.push({
          dx: Math.cos(angle) * dist,
          dz: Math.sin(angle) * dist,
          size: size * (0.05 + Math.random() * 0.13),
        });
      }

      setDecals((prev) => {
        const newDecal: BloodDecal = {
          id: decalIdCounter++,
          x,
          z,
          size,
          type,
          rotation: Math.random() * Math.PI * 2,
          lobes,
          satellites,
        };
        const updated = [...prev, newDecal];
        if (updated.length > MAX_DECALS) {
          return updated.slice(updated.length - MAX_DECALS);
        }
        return updated;
      });
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      addBloodPool: (position) => {
        addDecal(position[0], position[2], 1.1 + Math.random() * 0.9, "pool");
      },
      addBloodSplatter: (position) => {
        addDecal(
          position[0],
          position[2],
          0.22 + Math.random() * 0.32,
          "splatter",
        );
      },
    }),
    [addDecal],
  );

  // ── Instance-Matrizen neu berechnen, wenn sich die Decals-Liste ändert ─────
  // Läuft nur beim Schießen (Add) bzw. beim Überschreiten von MAX_DECALS — NICHT
  // in useFrame. Der Cost pro Update ist O(decals.length × layers), für 220
  // Decals trivial im Vergleich zum vorherigen Mounting tausender <mesh>.
  useEffect(() => {
    const parent = composeParentRef.current;
    const child = composeChildRef.current;
    const m = tmpMatrixRef.current;

    let poolRimIdx = 0;
    let poolMidIdx = 0;
    let splatMidIdx = 0;
    let poolCoreIdx = 0;
    let poolSatIdx = 0;
    let splatSatIdx = 0;

    for (const decal of decals) {
      const isPool = decal.type === "pool";

      // ── Trocknungs-Rand: nur pool, alle Lobes, scale = lobe.r * 1.18 ──
      if (isPool && poolRimRef.current) {
        for (const lobe of decal.lobes) {
          composeDecalMatrix(
            m,
            decal.x,
            decal.z,
            decal.rotation,
            lobe.dx,
            Y_BASE,
            lobe.dz,
            lobe.rot,
            lobe.r * 1.18,
            parent,
            child,
          );
          poolRimRef.current.setMatrixAt(poolRimIdx++, m);
        }
      }

      // ── Mittlere Schicht: alle Lobes, scale = lobe.r * 0.95 ──
      const midRef = isPool ? poolMidRef.current : splatMidRef.current;
      if (midRef) {
        for (const lobe of decal.lobes) {
          composeDecalMatrix(
            m,
            decal.x,
            decal.z,
            decal.rotation,
            lobe.dx,
            Y_MID,
            lobe.dz,
            lobe.rot,
            lobe.r * 0.95,
            parent,
            child,
          );
          if (isPool) {
            midRef.setMatrixAt(poolMidIdx++, m);
          } else {
            midRef.setMatrixAt(splatMidIdx++, m);
          }
        }
      }

      // ── Dunkler Kern: nur pool, erste 2 Lobes, position * 0.6 ──
      if (isPool && poolCoreRef.current) {
        const coreCount = Math.min(2, decal.lobes.length);
        for (let i = 0; i < coreCount; i++) {
          const lobe = decal.lobes[i];
          composeDecalMatrix(
            m,
            decal.x,
            decal.z,
            decal.rotation,
            lobe.dx * 0.6,
            Y_TOP,
            lobe.dz * 0.6,
            lobe.rot,
            lobe.r * 0.55,
            parent,
            child,
          );
          poolCoreRef.current.setMatrixAt(poolCoreIdx++, m);
        }
      }

      // ── Satelliten-Tropfen: rotation = 0 (im Original), scale = sat.size ──
      const satRef = isPool ? poolSatRef.current : splatSatRef.current;
      if (satRef) {
        for (const sat of decal.satellites) {
          composeDecalMatrix(
            m,
            decal.x,
            decal.z,
            decal.rotation,
            sat.dx,
            Y_SAT,
            sat.dz,
            0, // satellites haben keinen lokalen Z-Rotation-Twist im Original
            sat.size,
            parent,
            child,
          );
          if (isPool) {
            satRef.setMatrixAt(poolSatIdx++, m);
          } else {
            satRef.setMatrixAt(splatSatIdx++, m);
          }
        }
      }
    }

    // Counts setzen + needsUpdate flag
    if (poolRimRef.current) {
      poolRimRef.current.count = poolRimIdx;
      poolRimRef.current.instanceMatrix.needsUpdate = true;
    }
    if (poolMidRef.current) {
      poolMidRef.current.count = poolMidIdx;
      poolMidRef.current.instanceMatrix.needsUpdate = true;
    }
    if (splatMidRef.current) {
      splatMidRef.current.count = splatMidIdx;
      splatMidRef.current.instanceMatrix.needsUpdate = true;
    }
    if (poolCoreRef.current) {
      poolCoreRef.current.count = poolCoreIdx;
      poolCoreRef.current.instanceMatrix.needsUpdate = true;
    }
    if (poolSatRef.current) {
      poolSatRef.current.count = poolSatIdx;
      poolSatRef.current.instanceMatrix.needsUpdate = true;
    }
    if (splatSatRef.current) {
      splatSatRef.current.count = splatSatIdx;
      splatSatRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [decals]);

  // ── Render: 6 InstancedMeshes mit Maximal-Kapazität ────────────────────────
  const MAX_LOBE_INSTANCES = MAX_DECALS * MAX_LOBES_PER_DECAL;
  const MAX_CORE_INSTANCES = MAX_DECALS * 2;
  const MAX_SAT_INSTANCES = MAX_DECALS * MAX_SAT_PER_DECAL;

  return (
    <group>
      {/* Pool-only Trocknungs-Rand */}
      <instancedMesh
        ref={poolRimRef}
        args={[geoRim16, matPoolRim, MAX_LOBE_INSTANCES]}
        frustumCulled={false}
      />
      {/* Pool Hauptschicht */}
      <instancedMesh
        ref={poolMidRef}
        args={[geoPoolMid14, matPoolMid, MAX_LOBE_INSTANCES]}
        frustumCulled={false}
      />
      {/* Splatter Hauptschicht */}
      <instancedMesh
        ref={splatMidRef}
        args={[geoSplatMid10, matSplatMid, MAX_LOBE_INSTANCES]}
        frustumCulled={false}
      />
      {/* Pool dunkler Kern */}
      <instancedMesh
        ref={poolCoreRef}
        args={[geoPoolCore12, matPoolCore, MAX_CORE_INSTANCES]}
        frustumCulled={false}
      />
      {/* Pool-Satelliten */}
      <instancedMesh
        ref={poolSatRef}
        args={[geoSat6, matPoolSat, MAX_SAT_INSTANCES]}
        frustumCulled={false}
      />
      {/* Splatter-Satelliten */}
      <instancedMesh
        ref={splatSatRef}
        args={[geoSat6, matSplatSat, MAX_SAT_INSTANCES]}
        frustumCulled={false}
      />
    </group>
  );
});

BloodDecals.displayName = "BloodDecals";

export default BloodDecals;
