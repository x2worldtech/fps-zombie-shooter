import React, {
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from "react";

const MAX_DECALS = 220;

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
  // Mehrere überlappende Lobes für organische Rand-Form (statt sauberer Kreis)
  lobes: { dx: number; dz: number; r: number; rot: number }[];
  // Spritzer-Satelliten (kleine extra Tröpfchen drumherum)
  satellites: SatelliteDrop[];
}

export interface BloodDecalsHandle {
  addBloodPool: (position: [number, number, number]) => void;
  addBloodSplatter: (position: [number, number, number]) => void;
}

let decalIdCounter = 0;

const BloodDecals = forwardRef<BloodDecalsHandle>((_, ref) => {
  const [decals, setDecals] = useState<BloodDecal[]>([]);

  const addDecal = useCallback(
    (x: number, z: number, size: number, type: "pool" | "splatter") => {
      // Pools: 3-5 Lobes für unregelmäßige Form
      // Splatters: 1-2 Lobes
      const lobeCount =
        type === "pool" ? 3 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2);
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
        type === "pool" ? 4 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 3);
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

  return (
    <group>
      {decals.map((decal) => (
        <BloodDecalMesh key={decal.id} decal={decal} />
      ))}
    </group>
  );
});

BloodDecals.displayName = "BloodDecals";

/** Einzelnes Decal: dunkler Kern + mittlere Schicht + heller Trocknungs-Rand + Satelliten */
const BloodDecalMesh: React.FC<{ decal: BloodDecal }> = ({ decal }) => {
  // Leichte Y-Versätze für die Schichten, damit sie sich nicht z-fighten
  const yBase = 0.012;
  const yMid = 0.014;
  const yTop = 0.016;
  const ySat = 0.013;

  // Pool: dunkler/größer/glänzender. Splatter: heller, kleiner.
  const isPool = decal.type === "pool";

  // Farben — frische Blutpfütze hat einen hellen Rand (Plasma/Trocknung)
  const coreColor = isPool ? "#3a0202" : "#7a0000";
  const midColor = isPool ? "#5e0606" : "#990000";
  const rimColor = isPool ? "#8a1010" : "#aa1818";

  return (
    <group position={[decal.x, 0, decal.z]} rotation={[0, decal.rotation, 0]}>
      {/* Trocknungs-Rand (große, sehr transparente helle Schicht — ganz unten) */}
      {isPool &&
        decal.lobes.map((lobe, i) => (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: stable order
            key={`rim-${i}`}
            position={[lobe.dx, yBase, lobe.dz]}
            rotation={[-Math.PI / 2, 0, lobe.rot]}
          >
            <circleGeometry args={[lobe.r * 1.18, 16]} />
            <meshBasicMaterial
              color={rimColor}
              transparent
              opacity={0.32}
              depthWrite={false}
            />
          </mesh>
        ))}

      {/* Mittlere Schicht — Hauptpool */}
      {decal.lobes.map((lobe, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: stable order
          key={`mid-${i}`}
          position={[lobe.dx, yMid, lobe.dz]}
          rotation={[-Math.PI / 2, 0, lobe.rot]}
        >
          <circleGeometry args={[lobe.r * 0.95, isPool ? 14 : 10]} />
          <meshBasicMaterial
            color={midColor}
            transparent
            opacity={isPool ? 0.85 : 0.78}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Dunkler Kern (oberste Schicht) — gibt Tiefe */}
      {isPool &&
        decal.lobes.slice(0, 2).map((lobe, i) => (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: stable order
            key={`core-${i}`}
            position={[lobe.dx * 0.6, yTop, lobe.dz * 0.6]}
            rotation={[-Math.PI / 2, 0, lobe.rot]}
          >
            <circleGeometry args={[lobe.r * 0.55, 12]} />
            <meshBasicMaterial
              color={coreColor}
              transparent
              opacity={0.92}
              depthWrite={false}
            />
          </mesh>
        ))}

      {/* Satelliten-Tropfen — kleine Spritzer drumherum */}
      {decal.satellites.map((sat, i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: stable order
          key={`sat-${i}`}
          position={[sat.dx, ySat, sat.dz]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[sat.size, 6]} />
          <meshBasicMaterial
            color={midColor}
            transparent
            opacity={0.78}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

export default BloodDecals;
