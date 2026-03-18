import { useCallback } from "react";
import type { WeaponName } from "../types/weapon";
import {
  assaultRifleShot,
  pickupChime,
  pistolShot,
  playerHit,
  shotgunShot,
  unlockAudio,
  waveClear,
  waveStart,
  zombieGrowl,
  zombieRoar,
} from "../utils/audioSynthesis";

export function useGameAudio() {
  const playGunshot = useCallback((weapon: WeaponName) => {
    switch (weapon) {
      case "pistol":
        pistolShot();
        break;
      case "shotgun":
        shotgunShot();
        break;
      case "assault_rifle":
        assaultRifleShot();
        break;
    }
  }, []);

  const playZombieGrowl = useCallback(() => {
    if (Math.random() < 0.4) zombieGrowl();
  }, []);

  const playZombieRoar = useCallback(() => {
    zombieRoar();
  }, []);

  const playPlayerHit = useCallback(() => {
    playerHit();
  }, []);

  const playPickup = useCallback(() => {
    pickupChime();
  }, []);

  const playWaveStart = useCallback(() => {
    waveStart();
  }, []);

  const playWaveClear = useCallback(() => {
    waveClear();
  }, []);

  const resumeAudio = useCallback(async () => {
    await unlockAudio();
  }, []);

  return {
    playGunshot,
    playZombieGrowl,
    playZombieRoar,
    playPlayerHit,
    playPickup,
    playWaveStart,
    playWaveClear,
    resumeAudio,
  };
}
