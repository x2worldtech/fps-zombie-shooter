import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import BloodParticles from "./BloodParticles";

// ─── PERF-NOTE ────────────────────────────────────────────────────────────────
// Vorher: GameScene hielt `bloodEffects: BloodEffect[]` im State und rief
// setBloodEffects bei JEDEM Schuss + bei jedem onComplete auf. Das löste
// vollständige GameScene-Re-Renders aus — und damit (auch trotz React.memo auf
// Children) den Reconciler-Walk über den gesamten Scene-Tree.
//
// Jetzt: die State-Halterung wandert in diesen Manager. GameScene kennt nur
// noch eine Ref und ruft `bloodEffectsRef.current?.add(...)` imperativ auf.
// State-Updates beim Schießen/onComplete betreffen nur noch DIESEN Component;
// GameScene re-rendert nicht mehr pro Schuss.
//
// Visualisierung ist exakt identisch — BloodParticles wird unverändert mit
// gleichen Props gerendert.
// ─────────────────────────────────────────────────────────────────────────────

interface BloodEffect {
  id: number;
  position: [number, number, number];
  direction: [number, number, number];
  intensity: number;
}

export interface BloodEffectsHandle {
  add: (
    position: [number, number, number],
    direction: [number, number, number],
    intensity: number,
  ) => void;
}

let bloodEffectIdCounter = 0;

const BloodEffectsManager = forwardRef<BloodEffectsHandle>((_, ref) => {
  const [effects, setEffects] = useState<BloodEffect[]>([]);

  const add = useCallback(
    (
      position: [number, number, number],
      direction: [number, number, number],
      intensity: number,
    ) => {
      setEffects((prev) => [
        ...prev,
        {
          id: bloodEffectIdCounter++,
          position,
          direction,
          intensity,
        },
      ]);
    },
    [],
  );

  const remove = useCallback((id: number) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  useImperativeHandle(ref, () => ({ add }), [add]);

  return (
    <>
      {effects.map((effect) => (
        <BloodParticles
          key={effect.id}
          position={effect.position}
          direction={effect.direction}
          intensity={effect.intensity}
          onComplete={() => remove(effect.id)}
        />
      ))}
    </>
  );
});

BloodEffectsManager.displayName = "BloodEffectsManager";

export default BloodEffectsManager;
