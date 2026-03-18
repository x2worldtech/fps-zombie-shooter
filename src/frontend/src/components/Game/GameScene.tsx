import { PointerLockControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useEnemySystem } from "../../hooks/useEnemySystem";
import { useGameAudio } from "../../hooks/useGameAudio";
import { useJuggernogSystem } from "../../hooks/useJuggernogSystem";
import { useWaveSystem } from "../../hooks/useWaveSystem";
import { useWeaponSystem } from "../../hooks/useWeaponSystem";
import { UPGRADE_COSTS } from "../../types/weapon";
import { JUGGERNOG_POSITION } from "../../utils/proceduralGeometry";
import BloodDecals, { type BloodDecalsHandle } from "./BloodDecals";
import BloodParticles from "./BloodParticles";
import { DesertEnvironment } from "./DesertEnvironment";
import { EnemyMesh } from "./EnemyMesh";
import { FirstPersonCamera } from "./FirstPersonCamera";
import { HUD } from "./HUD";
import {
  PACK_A_PUNCH_INTERACT_RANGE,
  PACK_A_PUNCH_POSITION,
} from "./PackAPunchMachine";
import { PauseOverlay } from "./PauseOverlay";
import { PickupMesh } from "./PickupMesh";
import { WaveOverlay } from "./WaveOverlay";
import { WeaponViewModel } from "./WeaponViewModel";

interface GameSceneProps {
  onGameOver: (
    score: number,
    wave: number,
    kills: number,
    headshots: number,
    shotsFired: number,
  ) => void;
}

const HEADSHOT_DAMAGE_MULTIPLIER = 1.5;
const JUGGERNOG_INTERACT_RANGE = 3.5;
const ZOMBIE_GROWL_INTERVAL = 3000;

interface BloodEffect {
  id: number;
  position: [number, number, number];
  direction: [number, number, number];
  intensity: number;
}

let bloodEffectIdCounter = 0;

function isHeadHit(hitObject: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = hitObject;
  while (current) {
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
  onHit: (
    id: string,
    damage: number,
    isHeadshot: boolean,
    hitPoint: { x: number; y: number; z: number },
  ) => void;
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

        const intersects = raycasterRef.current.intersectObjects(
          scene.children,
          true,
        );
        for (const hit of intersects) {
          const obj = hit.object;

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
            const headshot = isHeadHit(obj);
            const finalDamage = headshot
              ? Math.round(damage * HEADSHOT_DAMAGE_MULTIPLIER)
              : damage;
            onHit(enemyId, finalDamage, headshot, {
              x: hit.point.x,
              y: hit.point.y,
              z: hit.point.z,
            });
            break;
          }
        }
      }
    };

    window.addEventListener("game:fire", handleFire);
    return () => window.removeEventListener("game:fire", handleFire);
  }, [camera, scene, onHit, isActive]);

  return null;
}

function EnemyUpdater({
  playerPos,
  onPlayerHit,
  updatePositions,
  isPaused,
}: {
  playerPos: React.MutableRefObject<[number, number, number]>;
  onPlayerHit: (dmg: number) => void;
  updatePositions: (
    pos: [number, number, number],
    delta: number,
    onHit: (dmg: number) => void,
  ) => void;
  isPaused: boolean;
}) {
  useFrame((_, delta) => {
    if (isPaused) return;
    updatePositions(playerPos.current, delta, onPlayerHit);
  });
  return null;
}

export function GameScene({ onGameOver }: GameSceneProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [health, setHealth] = useState(100);
  const [isDamaged, setIsDamaged] = useState(false);
  const [killStreak, setKillStreak] = useState(0);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [nearPackAPunch, setNearPackAPunch] = useState(false);
  const [nearJuggernog, setNearJuggernog] = useState(false);
  const [bloodEffects, setBloodEffects] = useState<BloodEffect[]>([]);

  const killStreakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upgradeMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const playerPosRef = useRef<[number, number, number]>([0, 1.7, 0]);
  const controlsRef = useRef<{ lock: () => void } | null>(null);
  const gameOverCalledRef = useRef(false);
  const zombieGrowlTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const bloodDecalsRef = useRef<BloodDecalsHandle>(null);
  const isPausedRef = useRef(false);

  const killsRef = useRef(0);
  const headshotsRef = useRef(0);
  const shotsFiredRef = useRef(0);

  const {
    weaponState,
    currentConfig,
    tryFire,
    switchWeapon,
    upgradeWeapon,
    getEffectiveDamage,
  } = useWeaponSystem();
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

  const juggernogSystem = useJuggernogSystem();

  const {
    playGunshot,
    playPlayerHit,
    playPickup,
    playWaveStart,
    playWaveClear,
    playZombieGrowl,
    resumeAudio,
  } = useGameAudio();

  const maxHealth = juggernogSystem.maxHealth;
  const triggerGameOverRef = useRef<(() => void) | null>(null);

  const showUpgradeMessage = useCallback((msg: string) => {
    setUpgradeMessage(msg);
    if (upgradeMessageTimerRef.current)
      clearTimeout(upgradeMessageTimerRef.current);
    upgradeMessageTimerRef.current = setTimeout(
      () => setUpgradeMessage(null),
      2500,
    );
  }, []);

  const handlePlayerHit = useCallback(
    (damage: number) => {
      setIsDamaged(true);
      setTimeout(() => setIsDamaged(false), 500);
      playPlayerHit();
      setHealth((prev) => {
        const newHealth = Math.max(0, prev - damage);
        if (newHealth <= 0 && triggerGameOverRef.current) {
          triggerGameOverRef.current();
        }
        return newHealth;
      });
    },
    [playPlayerHit],
  );

  const handleSpawnWave = useCallback(
    (count: number, speed: number, boss: boolean) => {
      spawnEnemies(count, speed, boss);
    },
    [spawnEnemies],
  );

  const handleWaveStart = useCallback(() => {
    playWaveStart();
  }, [playWaveStart]);

  const handleWaveClear = useCallback(() => {
    clearDeadEnemies();
    playWaveClear();
  }, [clearDeadEnemies, playWaveClear]);

  const { waveState, startGame, triggerGameOver } = useWaveSystem(
    activeEnemyCount,
    handleSpawnWave,
    handleWaveStart,
    handleWaveClear,
    isPaused,
  );

  triggerGameOverRef.current = triggerGameOver;

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run once on mount
  useEffect(() => {
    startGame();
    juggernogSystem.resetJuggernog();
    setHealth(100);
    setIsPaused(false);
    isPausedRef.current = false;
    gameOverCalledRef.current = false;
    killsRef.current = 0;
    headshotsRef.current = 0;
    shotsFiredRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (waveState.phase === "gameover" && !gameOverCalledRef.current) {
      gameOverCalledRef.current = true;
      onGameOver(
        score,
        waveState.wave,
        killsRef.current,
        headshotsRef.current,
        shotsFiredRef.current,
      );
    }
  }, [waveState.phase, score, waveState.wave, onGameOver]);

  useEffect(() => {
    if (waveState.phase === "active" && activeEnemyCount > 0 && !isPaused) {
      if (zombieGrowlTimerRef.current)
        clearInterval(zombieGrowlTimerRef.current);
      zombieGrowlTimerRef.current = setInterval(() => {
        playZombieGrowl();
      }, ZOMBIE_GROWL_INTERVAL);
    } else {
      if (zombieGrowlTimerRef.current) {
        clearInterval(zombieGrowlTimerRef.current);
        zombieGrowlTimerRef.current = null;
      }
    }
    return () => {
      if (zombieGrowlTimerRef.current) {
        clearInterval(zombieGrowlTimerRef.current);
        zombieGrowlTimerRef.current = null;
      }
    };
  }, [waveState.phase, activeEnemyCount, playZombieGrowl, isPaused]);

  useEffect(() => {
    const interval = setInterval(() => {
      const [px, , pz] = playerPosRef.current;
      const [mx, , mz] = PACK_A_PUNCH_POSITION;
      const dist = Math.sqrt((px - mx) ** 2 + (pz - mz) ** 2);
      setNearPackAPunch(dist <= PACK_A_PUNCH_INTERACT_RANGE);

      const [jx, , jz] = JUGGERNOG_POSITION;
      const distJ = Math.sqrt((px - jx) ** 2 + (pz - jz) ** 2);
      setNearJuggernog(distJ <= JUGGERNOG_INTERACT_RANGE);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let unlocked = false;
    const handleInteraction = async () => {
      if (unlocked) return;
      unlocked = true;
      await resumeAudio();
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("mousedown", handleInteraction);
    };
    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("mousedown", handleInteraction);
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("mousedown", handleInteraction);
    };
  }, [resumeAudio]);

  // ESC key: toggle pause during active gameplay only
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      // Only allow pause toggle when game is running (not gameover, not menu)
      if (waveState.phase === "gameover" || waveState.phase === "menu") return;

      setIsPaused((prev) => {
        const next = !prev;
        isPausedRef.current = next;
        return next;
      });
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [waveState.phase]);

  // When unpausing, re-lock the pointer so the player can look around immediately
  useEffect(() => {
    if (
      !isPaused &&
      isLocked === false &&
      waveState.phase !== "gameover" &&
      waveState.phase !== "menu"
    ) {
      // Only re-lock if we were previously paused and the game is active
      // We use a small delay to let the overlay disappear first
      const t = setTimeout(() => {
        if (controlsRef.current && !isPausedRef.current) {
          controlsRef.current.lock();
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isPaused, isLocked, waveState.phase]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLocked || isPausedRef.current) return;

      if ((e.key === "e" || e.key === "E") && nearPackAPunch) {
        if (weaponState.upgradeTier >= 3) {
          showUpgradeMessage("⚡ Weapon is fully upgraded!");
          return;
        }
        const nextCost = UPGRADE_COSTS[weaponState.upgradeTier];
        if (points < nextCost) {
          showUpgradeMessage(
            `✗ Not enough points! Need ${nextCost.toLocaleString()} pts`,
          );
          return;
        }
        const result = upgradeWeapon(points);
        if (result.success) {
          spendPoints(result.cost);
          const tierNames = ["BLUE STEEL", "VOID PURPLE", "GOLDEN FURY"];
          const tierName = tierNames[weaponState.upgradeTier];
          showUpgradeMessage(`⚡ UPGRADED TO ${tierName}! ⚡`);
        }
      }

      if ((e.key === "f" || e.key === "F") && nearJuggernog) {
        juggernogSystem.purchaseJuggernog(
          points,
          health,
          (newPoints, newHealth, newMaxHealth) => {
            spendPoints(points - newPoints);
            setHealth(newHealth);
            const tierMsg =
              newMaxHealth === 150
                ? "🍺 JUGGERNOG! Max HP: 150"
                : "🍺 JUGGERNOG MAX! Max HP: 200";
            showUpgradeMessage(tierMsg);
          },
          (errorMsg) => {
            showUpgradeMessage(`✗ ${errorMsg}`);
          },
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    nearPackAPunch,
    nearJuggernog,
    isLocked,
    weaponState.upgradeTier,
    points,
    health,
    spendPoints,
    upgradeWeapon,
    showUpgradeMessage,
    juggernogSystem,
  ]);

  const handleFire = useCallback(() => {
    if (!isLocked || isPausedRef.current) return;
    const fired = tryFire();
    if (fired) {
      shotsFiredRef.current += 1;
      playGunshot(weaponState.currentWeapon);
      const effectiveDamage = getEffectiveDamage(currentConfig.damage);
      window.dispatchEvent(
        new CustomEvent("game:fire", {
          detail: {
            damage: effectiveDamage,
            pellets: currentConfig.pellets,
            spread: currentConfig.spread,
          },
        }),
      );
    }
  }, [
    isLocked,
    tryFire,
    currentConfig,
    getEffectiveDamage,
    playGunshot,
    weaponState.currentWeapon,
  ]);

  const handleEnemyHit = useCallback(
    (
      id: string,
      damage: number,
      isHeadshot: boolean,
      hitPoint: { x: number; y: number; z: number },
    ) => {
      const result = damageEnemy(id, damage, isHeadshot, hitPoint);

      // Spawn blood particle burst
      const shotDir = new THREE.Vector3(0, 0, -1); // approximate forward
      const intensity = result.isDismemberment ? 2.5 : 1.0;
      const newEffect: BloodEffect = {
        id: bloodEffectIdCounter++,
        position: [hitPoint.x, hitPoint.y, hitPoint.z],
        direction: [shotDir.x, shotDir.y, shotDir.z],
        intensity,
      };
      setBloodEffects((prev) => [...prev, newEffect]);

      // Blood splatter decal at hit point
      bloodDecalsRef.current?.addBloodSplatter([
        hitPoint.x,
        hitPoint.y,
        hitPoint.z,
      ]);

      if (result.killed) {
        killsRef.current += 1;
        if (isHeadshot) headshotsRef.current += 1;
        // Blood pool at kill location
        bloodDecalsRef.current?.addBloodPool([
          hitPoint.x,
          hitPoint.y,
          hitPoint.z,
        ]);
        setKillStreak((prev) => {
          const next = prev + 1;
          if (killStreakTimerRef.current)
            clearTimeout(killStreakTimerRef.current);
          killStreakTimerRef.current = setTimeout(() => setKillStreak(0), 4000);
          return next;
        });
      }
    },
    [damageEnemy],
  );

  const removeBloodEffect = useCallback((id: number) => {
    setBloodEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleHealthPickup = useCallback(
    (amount: number) => {
      setHealth((prev) => Math.min(maxHealth, prev + amount));
    },
    [maxHealth],
  );

  const handleAmmoPickup = useCallback(() => {
    switchWeapon(weaponState.currentWeapon);
  }, [switchWeapon, weaponState.currentWeapon]);

  const handleLock = useCallback(() => setIsLocked(true), []);
  const handleUnlock = useCallback(() => {
    setIsLocked(false);
    // If pointer was unlocked by the browser (not by ESC pause), don't auto-pause
    // ESC pause is handled separately above
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    isPausedRef.current = false;
    // Re-lock pointer after a short delay
    setTimeout(() => {
      if (controlsRef.current) {
        controlsRef.current.lock();
      }
    }, 50);
  }, []);

  // isGameActive: game is running and not paused
  const isGameActive = isLocked && waveState.phase !== "gameover" && !isPaused;

  return (
    <div className="relative w-full h-full">
      <Canvas
        style={{ width: "100%", height: "100%" }}
        camera={{ fov: 75, near: 0.1, far: 300 }}
        gl={{ antialias: true }}
        shadows
      >
        <PointerLockControls
          ref={controlsRef as React.Ref<any>}
          onLock={handleLock}
          onUnlock={handleUnlock}
        />

        <DesertEnvironment
          upgradeTier={weaponState.upgradeTier}
          juggernogPurchaseCount={juggernogSystem.juggernogPurchaseCount}
        />

        <FirstPersonCamera
          isLocked={isLocked}
          onPlayerPositionUpdate={(pos) => {
            playerPosRef.current = pos;
          }}
          onFire={handleFire}
          isGameActive={isGameActive}
          isPaused={isPaused}
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
          isPaused={isPaused}
        />

        {/* Persistent blood decals on the ground */}
        <BloodDecals ref={bloodDecalsRef} />

        {enemies.map((enemy) => (
          <group key={enemy.id} userData={{ enemyId: enemy.id }}>
            <EnemyMesh
              enemy={enemy}
              onHitFlashDone={clearHitFlash}
              playerPositionRef={playerPosRef}
            />
          </group>
        ))}

        {/* Blood particle bursts */}
        {bloodEffects.map((effect) => (
          <BloodParticles
            key={effect.id}
            position={effect.position}
            direction={effect.direction}
            intensity={effect.intensity}
            onComplete={() => removeBloodEffect(effect.id)}
          />
        ))}

        {pickups.map((pickup) => (
          <PickupMesh
            key={pickup.id}
            pickup={pickup}
            playerPos={playerPosRef.current}
            onCollect={collectPickup}
            onPickupSound={playPickup}
            onHealthPickup={handleHealthPickup}
            onAmmoPickup={handleAmmoPickup}
          />
        ))}
      </Canvas>

      <HUD
        health={health}
        maxHealth={maxHealth}
        weaponState={weaponState}
        waveState={waveState}
        score={score}
        points={points}
        killStreak={killStreak}
        isDamaged={isDamaged}
        pointsNotifications={pointsNotifications}
        nearPackAPunch={nearPackAPunch}
        nearJuggernog={nearJuggernog}
        upgradeMessage={upgradeMessage}
        juggernogPurchaseCount={juggernogSystem.juggernogPurchaseCount}
      />

      <WaveOverlay waveState={waveState} />

      {/* Pause overlay: only shown when explicitly paused via ESC */}
      {isPaused && waveState.phase !== "gameover" && (
        <PauseOverlay onResume={handleResume} />
      )}
    </div>
  );
}
