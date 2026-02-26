import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { DesertEnvironment } from './DesertEnvironment';
import { FirstPersonCamera } from './FirstPersonCamera';
import WeaponViewModel from './WeaponViewModel';
import { EnemyMesh } from './EnemyMesh';
import { PickupMesh } from './PickupMesh';
import { HUD } from './HUD';
import { WaveOverlay } from './WaveOverlay';
import { PauseOverlay } from './PauseOverlay';
import { useWeaponSystem } from '../../hooks/useWeaponSystem';
import { useEnemySystem } from '../../hooks/useEnemySystem';
import { useWaveSystem } from '../../hooks/useWaveSystem';
import { useGameAudio } from '../../hooks/useGameAudio';
import { PACK_A_PUNCH_POSITION, PACK_A_PUNCH_INTERACT_RANGE } from './PackAPunchMachine';
import { UPGRADE_COSTS } from '../../types/weapon';

interface GameSceneProps {
  onGameOver: (score: number, wave: number, kills: number, headshots: number, shotsFired: number) => void;
}

const MAX_HEALTH = 100;

// Headshot multiplier: head hits deal 1.5x base damage
const HEADSHOT_DAMAGE_MULTIPLIER = 1.5;

/**
 * Checks whether a hit object (or any of its ancestors up to but not including
 * the enemy root group) is tagged as a head hitbox via userData.isHead.
 * The enemy root group is identified by having userData.enemyId set.
 */
function isHeadHit(hitObject: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = hitObject;
  while (current) {
    // Stop at the enemy root group — don't go above it
    if (current.userData.enemyId) break;
    if (current.userData.isHead) return true;
    current = current.parent;
  }
  return false;
}

function RaycastShooter({
  onHit,
  isActive,
}: {
  onHit: (id: string, damage: number, isHeadshot: boolean) => void;
  isActive: boolean;
}) {
  const { camera, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());

  useEffect(() => {
    if (!isActive) return;

    const handleFire = (e: Event) => {
      const ce = e as CustomEvent;
      const { damage, pellets, spread } = ce.detail;
      for (let p = 0; p < pellets; p++) {
        const spreadX = (Math.random() - 0.5) * spread * 2;
        const spreadY = (Math.random() - 0.5) * spread * 2;
        const dir = new THREE.Vector3(spreadX, spreadY, -1)
          .applyQuaternion(camera.quaternion)
          .normalize();

        raycasterRef.current.set(camera.position, dir);
        raycasterRef.current.far = 80;

        const intersects = raycasterRef.current.intersectObjects(scene.children, true);
        for (const hit of intersects) {
          const obj = hit.object;

          // Walk up the hierarchy to find the enemy root group (has userData.enemyId)
          let current: THREE.Object3D | null = obj;
          let enemyId: string | null = null;
          while (current) {
            if (current.userData.enemyId) {
              enemyId = current.userData.enemyId as string;
              break;
            }
            current = current.parent;
          }

          if (enemyId) {
            // Determine headshot by checking if the directly hit mesh (or any
            // ancestor below the enemy root) is tagged with userData.isHead
            const headshot = isHeadHit(obj);

            // Head hits deal 1.5x damage, body hits deal 1.0x damage
            const finalDamage = headshot
              ? Math.round(damage * HEADSHOT_DAMAGE_MULTIPLIER)
              : damage;

            onHit(enemyId, finalDamage, headshot);
            break;
          }
        }
      }
    };

    window.addEventListener('game:fire', handleFire);
    return () => window.removeEventListener('game:fire', handleFire);
  }, [camera, scene, onHit, isActive]);

  return null;
}

function EnemyUpdater({
  playerPos,
  onPlayerHit,
  updatePositions,
}: {
  playerPos: React.MutableRefObject<[number, number, number]>;
  onPlayerHit: (dmg: number) => void;
  updatePositions: (pos: [number, number, number], delta: number, onHit: (dmg: number) => void) => void;
}) {
  useFrame((_, delta) => {
    updatePositions(playerPos.current, delta, onPlayerHit);
  });
  return null;
}

export function GameScene({ onGameOver }: GameSceneProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [health, setHealth] = useState(MAX_HEALTH);
  const [isDamaged, setIsDamaged] = useState(false);
  const [killStreak, setKillStreak] = useState(0);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [nearPackAPunch, setNearPackAPunch] = useState(false);
  const killStreakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upgradeMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerPosRef = useRef<[number, number, number]>([0, 1.7, 0]);
  const controlsRef = useRef<{ lock: () => void } | null>(null);
  const gameOverCalledRef = useRef(false);

  // Session stat trackers
  const killsRef = useRef(0);
  const headshotsRef = useRef(0);
  const shotsFiredRef = useRef(0);

  const audio = useGameAudio();
  const { weaponState, currentConfig, tryFire, switchWeapon, upgradeWeapon, getEffectiveDamage } = useWeaponSystem();
  const {
    enemies,
    pickups,
    score,
    points,
    pointsNotifications,
    activeEnemyCount,
    spawnEnemies,
    damageEnemy,
    spendPoints,
    clearHitFlash,
    updateEnemyPositions,
    collectPickup,
    clearDeadEnemies,
  } = useEnemySystem();

  // triggerGameOver declared early so handlePlayerHit can reference it
  const triggerGameOverRef = useRef<(() => void) | null>(null);

  const showUpgradeMessage = useCallback((msg: string) => {
    setUpgradeMessage(msg);
    if (upgradeMessageTimerRef.current) clearTimeout(upgradeMessageTimerRef.current);
    upgradeMessageTimerRef.current = setTimeout(() => setUpgradeMessage(null), 2500);
  }, []);

  const handlePlayerHit = useCallback((damage: number) => {
    audio.playPlayerHit();
    setIsDamaged(true);
    setTimeout(() => setIsDamaged(false), 500);
    setHealth(prev => {
      const newHealth = Math.max(0, prev - damage);
      if (newHealth <= 0 && triggerGameOverRef.current) {
        triggerGameOverRef.current();
      }
      return newHealth;
    });
  }, [audio]);

  // Use stable useCallback wrappers so wave system callbacks don't change identity
  const handleSpawnWave = useCallback((count: number, speed: number, boss: boolean) => {
    spawnEnemies(count, speed, boss);
    audio.playZombieGrowl();
  }, [spawnEnemies, audio]);

  const handleWaveStart = useCallback(() => {
    audio.playWaveStart();
  }, [audio]);

  const handleWaveClear = useCallback(() => {
    audio.playWaveClear();
    clearDeadEnemies();
  }, [audio, clearDeadEnemies]);

  const { waveState, startGame, triggerGameOver } = useWaveSystem(
    activeEnemyCount,
    handleSpawnWave,
    handleWaveStart,
    handleWaveClear
  );

  // Keep ref in sync
  triggerGameOverRef.current = triggerGameOver;

  // Start game on mount
  useEffect(() => {
    startGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Game over check
  useEffect(() => {
    if (waveState.phase === 'gameover' && !gameOverCalledRef.current) {
      gameOverCalledRef.current = true;
      onGameOver(score, waveState.wave, killsRef.current, headshotsRef.current, shotsFiredRef.current);
    }
  }, [waveState.phase, score, waveState.wave, onGameOver]);

  // Check proximity to Pack-a-Punch machine
  useEffect(() => {
    const interval = setInterval(() => {
      const [px, , pz] = playerPosRef.current;
      const [mx, , mz] = PACK_A_PUNCH_POSITION;
      const dist = Math.sqrt((px - mx) ** 2 + (pz - mz) ** 2);
      setNearPackAPunch(dist <= PACK_A_PUNCH_INTERACT_RANGE);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // E key handler for Pack-a-Punch interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && nearPackAPunch && isLocked) {
        if (weaponState.upgradeTier >= 3) {
          showUpgradeMessage('⚡ Weapon is fully upgraded!');
          return;
        }
        const nextCost = UPGRADE_COSTS[weaponState.upgradeTier];
        if (points < nextCost) {
          showUpgradeMessage(`✗ Not enough points! Need ${nextCost.toLocaleString()} pts`);
          return;
        }
        const spent = spendPoints(nextCost);
        if (spent) {
          const result = upgradeWeapon(points);
          const tierNames = ['BLUE STEEL', 'VOID PURPLE', 'GOLDEN FURY'];
          const tierName = tierNames[weaponState.upgradeTier];
          showUpgradeMessage(`⚡ UPGRADED TO ${tierName}! ⚡`);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearPackAPunch, isLocked, weaponState.upgradeTier, points, spendPoints, upgradeWeapon, showUpgradeMessage]);

  const handleFire = useCallback(() => {
    if (!isLocked) return;
    const fired = tryFire();
    if (fired) {
      shotsFiredRef.current += 1;
      audio.playGunshot(weaponState.currentWeapon);
      const effectiveDamage = getEffectiveDamage(currentConfig.damage);
      window.dispatchEvent(new CustomEvent('game:fire', {
        detail: {
          damage: effectiveDamage,
          pellets: currentConfig.pellets,
          spread: currentConfig.spread,
        }
      }));
    }
  }, [isLocked, tryFire, audio, weaponState.currentWeapon, currentConfig, getEffectiveDamage]);

  const handleEnemyHit = useCallback((id: string, damage: number, isHeadshot: boolean) => {
    const killed = damageEnemy(id, damage, isHeadshot);
    if (killed) {
      killsRef.current += 1;
      if (isHeadshot) headshotsRef.current += 1;
      audio.playZombieRoar();
      setKillStreak(prev => {
        const next = prev + 1;
        if (killStreakTimerRef.current) clearTimeout(killStreakTimerRef.current);
        killStreakTimerRef.current = setTimeout(() => setKillStreak(0), 4000);
        return next;
      });
    }
  }, [damageEnemy, audio]);

  const handleHealthPickup = useCallback((amount: number) => {
    setHealth(prev => Math.min(MAX_HEALTH, prev + amount));
  }, []);

  const handleAmmoPickup = useCallback(() => {
    switchWeapon(weaponState.currentWeapon);
  }, [switchWeapon, weaponState.currentWeapon]);

  const handleLock = useCallback(() => setIsLocked(true), []);
  const handleUnlock = useCallback(() => setIsLocked(false), []);

  const handleResume = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.lock();
    }
  }, []);

  const isGameActive = isLocked && waveState.phase !== 'gameover';

  return (
    <div className="relative w-full h-full">
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ fov: 75, near: 0.1, far: 300 }}
        gl={{ antialias: true }}
        shadows
      >
        <PointerLockControls
          ref={controlsRef as React.Ref<any>}
          onLock={handleLock}
          onUnlock={handleUnlock}
        />

        <DesertEnvironment upgradeTier={weaponState.upgradeTier} />

        <FirstPersonCamera
          isLocked={isLocked}
          onPlayerPositionUpdate={(pos) => { playerPosRef.current = pos; }}
          onFire={handleFire}
          isGameActive={isGameActive}
        />

        <WeaponViewModel
          weapon={weaponState.currentWeapon}
          recoilOffset={weaponState.recoilOffset}
          isReloading={weaponState.isReloading}
          upgradeTier={weaponState.upgradeTier}
        />

        <RaycastShooter onHit={handleEnemyHit} isActive={isGameActive} />

        <EnemyUpdater
          playerPos={playerPosRef}
          onPlayerHit={handlePlayerHit}
          updatePositions={updateEnemyPositions}
        />

        {enemies.map(enemy => (
          <group key={enemy.id} userData={{ enemyId: enemy.id }}>
            <EnemyMesh
              enemy={enemy}
              onHitFlashDone={clearHitFlash}
            />
          </group>
        ))}

        {pickups.map(pickup => (
          <PickupMesh
            key={pickup.id}
            pickup={pickup}
            playerPos={playerPosRef.current}
            onCollect={collectPickup}
            onPickupSound={audio.playPickup}
            onHealthPickup={handleHealthPickup}
            onAmmoPickup={handleAmmoPickup}
          />
        ))}
      </Canvas>

      <HUD
        health={health}
        maxHealth={MAX_HEALTH}
        weaponState={weaponState}
        waveState={waveState}
        score={score}
        points={points}
        killStreak={killStreak}
        isDamaged={isDamaged}
        pointsNotifications={pointsNotifications}
        nearPackAPunch={nearPackAPunch}
        upgradeMessage={upgradeMessage}
      />

      <WaveOverlay waveState={waveState} />

      {!isLocked && waveState.phase !== 'gameover' && (
        <PauseOverlay onResume={handleResume} />
      )}
    </div>
  );
}
