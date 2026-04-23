import { useCallback, useState } from "react";

export const SPEED_COLA_COST = 3000;

export interface SpeedColaSystem {
  isPurchased: boolean;
  reloadMultiplier: number;
  purchaseSpeedCola: (
    currentPoints: number,
    spendPoints: (amount: number) => void,
    onSuccess: () => void,
    onError: (message: string) => void,
  ) => void;
  resetSpeedCola: () => void;
}

export function useSpeedColaSystem(): SpeedColaSystem {
  const [isPurchased, setIsPurchased] = useState(false);

  const purchaseSpeedCola = useCallback(
    (
      currentPoints: number,
      spendPoints: (amount: number) => void,
      onSuccess: () => void,
      onError: (message: string) => void,
    ) => {
      if (isPurchased) {
        onError("Already purchased!");
        return;
      }
      if (currentPoints < SPEED_COLA_COST) {
        onError(`Not enough points! (${SPEED_COLA_COST})`);
        return;
      }
      spendPoints(SPEED_COLA_COST);
      setIsPurchased(true);
      onSuccess();
    },
    [isPurchased],
  );

  const resetSpeedCola = useCallback(() => {
    setIsPurchased(false);
  }, []);

  return {
    isPurchased,
    reloadMultiplier: isPurchased ? 0.5 : 1.0,
    purchaseSpeedCola,
    resetSpeedCola,
  };
}
