import { useState, useCallback, useRef, useEffect } from 'react';

export type WavePhase = 'menu' | 'countdown' | 'active' | 'cleared' | 'gameover';

export interface WaveState {
  wave: number;
  phase: WavePhase;
  countdown: number;
  enemyCount: number;
  speedMultiplier: number;
  hasBoss: boolean;
}

function calcWaveParams(wave: number) {
  const count = 5 + 3 * (wave - 1);          // Wave 1 = 5, Wave 2 = 8, Wave 3 = 11 …
  const speed = 1 + 0.08 * (wave - 1);        // Gradually faster
  const boss = wave % 5 === 0;                 // Boss every 5th wave
  return { count, speed, boss };
}

export function useWaveSystem(
  activeEnemyCount: number,
  onSpawnWave: (count: number, speed: number, boss: boolean) => void,
  onWaveStart: () => void,
  onWaveClear: () => void
) {
  const [waveState, setWaveState] = useState<WaveState>({
    wave: 0,
    phase: 'menu',
    countdown: 3,
    enemyCount: 0,
    speedMultiplier: 1,
    hasBoss: false,
  });

  // Keep latest callbacks in refs so effects never need them as deps
  const onSpawnWaveRef = useRef(onSpawnWave);
  const onWaveStartRef = useRef(onWaveStart);
  const onWaveClearRef = useRef(onWaveClear);
  onSpawnWaveRef.current = onSpawnWave;
  onWaveStartRef.current = onWaveStart;
  onWaveClearRef.current = onWaveClear;

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveStateRef = useRef(waveState);
  waveStateRef.current = waveState;

  const startGame = useCallback(() => {
    // Start at wave 1 with correct enemy count
    const { count, speed, boss } = calcWaveParams(1);
    setWaveState({
      wave: 1,
      phase: 'countdown',
      countdown: 3,
      enemyCount: count,
      speedMultiplier: speed,
      hasBoss: boss,
    });
  }, []);

  const startNextWave = useCallback(() => {
    const nextWave = waveStateRef.current.wave + 1;
    const { count, speed, boss } = calcWaveParams(nextWave);
    setWaveState(prev => ({
      ...prev,
      wave: nextWave,
      phase: 'countdown',
      countdown: 3,
      enemyCount: count,
      speedMultiplier: speed,
      hasBoss: boss,
    }));
  }, []);

  // Countdown timer — only depends on phase, uses refs for callbacks
  useEffect(() => {
    if (waveState.phase !== 'countdown') return;

    // Clear any existing interval first
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    countdownRef.current = setInterval(() => {
      setWaveState(prev => {
        if (prev.phase !== 'countdown') {
          // Phase changed externally, stop
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return prev;
        }

        if (prev.countdown <= 1) {
          // Clear interval before spawning
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          // Spawn wave using refs so we don't need them as deps
          onSpawnWaveRef.current(prev.enemyCount, prev.speedMultiplier, prev.hasBoss);
          onWaveStartRef.current();
          return { ...prev, phase: 'active', countdown: 0 };
        }

        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  // Only re-run when phase changes to 'countdown'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waveState.phase]);

  // Check wave cleared
  useEffect(() => {
    if (waveState.phase !== 'active') return;
    if (activeEnemyCount === 0 && waveState.enemyCount > 0) {
      onWaveClearRef.current();
      setWaveState(prev => ({ ...prev, phase: 'cleared' }));

      if (clearedTimerRef.current) clearTimeout(clearedTimerRef.current);
      clearedTimerRef.current = setTimeout(() => {
        startNextWave();
      }, 2500);
    }
  }, [activeEnemyCount, waveState.phase, waveState.enemyCount, startNextWave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (clearedTimerRef.current) clearTimeout(clearedTimerRef.current);
    };
  }, []);

  const triggerGameOver = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (clearedTimerRef.current) {
      clearTimeout(clearedTimerRef.current);
      clearedTimerRef.current = null;
    }
    setWaveState(prev => ({ ...prev, phase: 'gameover' }));
  }, []);

  return {
    waveState,
    startGame,
    startNextWave,
    triggerGameOver,
  };
}
