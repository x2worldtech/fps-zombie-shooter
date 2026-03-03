import React, { useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';

const MAX_DECALS = 200;

interface BloodDecal {
  id: number;
  x: number;
  z: number;
  size: number;
  type: 'pool' | 'splatter';
  rotation: number;
}

export interface BloodDecalsHandle {
  addBloodPool: (position: [number, number, number]) => void;
  addBloodSplatter: (position: [number, number, number]) => void;
}

let decalIdCounter = 0;

const BloodDecals = forwardRef<BloodDecalsHandle>((_, ref) => {
  const [decals, setDecals] = useState<BloodDecal[]>([]);

  const addDecal = useCallback((x: number, z: number, size: number, type: 'pool' | 'splatter') => {
    setDecals(prev => {
      const newDecal: BloodDecal = {
        id: decalIdCounter++,
        x,
        z,
        size,
        type,
        rotation: Math.random() * Math.PI * 2,
      };
      const updated = [...prev, newDecal];
      if (updated.length > MAX_DECALS) {
        return updated.slice(updated.length - MAX_DECALS);
      }
      return updated;
    });
  }, []);

  useImperativeHandle(ref, () => ({
    addBloodPool: (position) => {
      addDecal(position[0], position[2], 1.0 + Math.random() * 0.8, 'pool');
    },
    addBloodSplatter: (position) => {
      addDecal(position[0], position[2], 0.2 + Math.random() * 0.3, 'splatter');
    },
  }), [addDecal]);

  return (
    <group>
      {decals.map(decal => (
        <mesh
          key={decal.id}
          position={[decal.x, 0.015, decal.z]}
          rotation={[-Math.PI / 2, 0, decal.rotation]}
        >
          <circleGeometry args={[decal.size, decal.type === 'pool' ? 12 : 8]} />
          <meshBasicMaterial
            color={decal.type === 'pool' ? '#7a0000' : '#990000'}
            transparent
            opacity={decal.type === 'pool' ? 0.82 : 0.7}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
});

BloodDecals.displayName = 'BloodDecals';

export default BloodDecals;
