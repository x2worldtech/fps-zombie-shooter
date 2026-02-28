import { useState, useCallback } from 'react';

export const JUGGERNOG_COSTS = [2500, 5000] as const;
export const JUGGERNOG_MAX_HEALTH = [100, 150, 200] as const;

export interface JuggernogSystem {
  juggernogPurchaseCount: number;
  maxHealth: number;
  purchaseJuggernog: (
    currentPoints: number,
    currentHealth: number,
    onSuccess: (newPoints: number, newHealth: number, newMaxHealth: number) => void,
    onError: (message: string) => void
  ) => void;
  resetJuggernog: () => void;
}

export function useJuggernogSystem(): JuggernogSystem {
  const [juggernogPurchaseCount, setJuggernogPurchaseCount] = useState(0);
  const [maxHealth, setMaxHealth] = useState(100);

  const purchaseJuggernog = useCallback(
    (
      currentPoints: number,
      currentHealth: number,
      onSuccess: (newPoints: number, newHealth: number, newMaxHealth: number) => void,
      onError: (message: string) => void
    ) => {
      if (juggernogPurchaseCount >= 2) {
        onError('Juggernog bereits maximal aufgewertet!');
        return;
      }

      const cost = JUGGERNOG_COSTS[juggernogPurchaseCount];
      if (currentPoints < cost) {
        onError(`Nicht genug Punkte! Benötigt: ${cost}`);
        return;
      }

      const newCount = juggernogPurchaseCount + 1;
      const newMaxHealth = JUGGERNOG_MAX_HEALTH[newCount];
      const newPoints = currentPoints - cost;
      // Heal current HP up to new max if below it
      const newHealth = Math.min(currentHealth + (newMaxHealth - JUGGERNOG_MAX_HEALTH[juggernogPurchaseCount]), newMaxHealth);

      setJuggernogPurchaseCount(newCount);
      setMaxHealth(newMaxHealth);
      onSuccess(newPoints, newHealth, newMaxHealth);
    },
    [juggernogPurchaseCount]
  );

  const resetJuggernog = useCallback(() => {
    setJuggernogPurchaseCount(0);
    setMaxHealth(100);
  }, []);

  return {
    juggernogPurchaseCount,
    maxHealth,
    purchaseJuggernog,
    resetJuggernog,
  };
}
