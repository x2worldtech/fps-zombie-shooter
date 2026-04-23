import { PointerLockControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useEnemySystem } from "../../hooks/useEnemySystem";
import { useGameAudio } from "../../hooks/useGameAudio";
import { useJuggernogSystem } from "../../hooks/useJuggernogSystem";
import { useSpeedColaSystem } from "../../hooks/useSpeedColaSystem";
import { useWaveSystem } from "../../hooks/useWaveSystem";
import { useWeaponSystem } from "../../hooks/useWeaponSystem";
import { UPGRADE_COSTS } from "../../types/weapon";
import { JUGGERNOG_POSITION } from "../../utils/proceduralGeometry";
import type { CollisionAABB } from "../../utils/proceduralGeometry";
import BloodDecals, { type BloodDecalsHandle } from "./BloodDecals";
import BloodParticles from "./BloodParticles";
import { DesertEnvironment } from "./DesertEnvironment";
import { EnemyMesh } from "./EnemyMesh";
import { FirstPersonCamera } from "./FirstPersonCamera";
import { HUD } from "./HUD";
import { NuclearCountdownHUD, NuclearEvent } from "./NuclearEvent";
import { NUCLEAR_MACHINE_POSITION } from "./NuclearMachine";
import {
  PACK_A_PUNCH_INTERACT_RANGE,
  PACK_A_PUNCH_POSITION,
} from "./PackAPunchMachine";
import { PauseOverlay } from "./PauseOverlay";
import { PickupMesh } from "./PickupMesh";
import {
  DESERT_PORTAL_POSITION,
  PORTAL_INTERACT_RANGE,
  Portal,
  WARZONE_PORTAL_POSITION,
} from "./Portal";
import {
  SPEED_COLA_AABB,
  SPEED_COLA_INTERACT_RANGE,
  SPEED_COLA_POSITION,
  SpeedColaMachine,
} from "./SpeedColaMachine";
import { WarzoneEnvironment } from "./WarzoneEnvironment";
import { WaveOverlay } from "./WaveOverlay";
import { WeaponViewModel } from "./WeaponViewModel";

export type WorldType = "desert" | "warzone";

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
const NUCLEAR_MACHINE_INTERACT_RANGE = 3;

// Nuclear machine collision AABB (machine is ~1.2w x 0.8d centred at [8,0,0])
// Expanded by PLAYER_RADIUS (0.4) on each side for accurate player collision
const WARZONE_EXTRA_AABBS: CollisionAABB[] = [
  {
    minX: NUCLEAR_MACHINE_POSITION[0] - 0.6 - 0.4,
    maxX: NUCLEAR_MACHINE_POSITION[0] + 0.6 + 0.4,
    minZ: NUCLEAR_MACHINE_POSITION[2] - 0.4 - 0.4,
    maxZ: NUCLEAR_MACHINE_POSITION[2] + 0.4 + 0.4,
  },
  SPEED_COLA_AABB,
];
const EMPTY_AABBS: CollisionAABB[] = [];

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
  const [nearNuclearMachine, setNearNuclearMachine] = useState(false);
  const [nearSpeedCola, setNearSpeedCola] = useState(false);
  const [bloodEffects, setBloodEffects] = useState<BloodEffect[]>([]);

  // ─── World / Portal state ───────────────────────────────────────────────────
  const [currentWorld, setCurrentWorld] = useState<WorldType>("desert");
  const [nearPortal, setNearPortal] = useState(false);
  const [teleportOverlay, setTeleportOverlay] = useState(0); // 0=none, 0-1 fade
  const [isTeleporting, setIsTeleporting] = useState(false);
  const currentWorldRef = useRef<WorldType>("desert");
  const isTeleportingRef = useRef(false);

  // ─── Nuclear event state ────────────────────────────────────────────────────
  const [nuclearEventActive, setNuclearEventActive] = useState(false);
  const [nuclearCountdownNum, setNuclearCountdownNum] = useState<number | null>(
    null,
  );
  const [showNuclearCountdownHUD, setShowNuclearCountdownHUD] = useState(false);
  const destroyedBuildingIds = useRef(new Set<number>());
  /**
   * Permanently-mounted white flash overlay — lives outside the Canvas and outside
   * NuclearEvent so it NEVER unmounts mid-sequence. NuclearEvent controls it imperatively.
   */
  const nuclearFlashRef = useRef<HTMLDivElement>(null);

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

  const juggernogSystem = useJuggernogSystem();
  const speedColaSystem = useSpeedColaSystem();

  const {
    weaponState,
    currentConfig,
    tryFire,
    switchWeapon,
    upgradeWeapon,
    getEffectiveDamage,
    isAiming,
  } = useWeaponSystem(speedColaSystem.reloadMultiplier);
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
    speedColaSystem.resetSpeedCola();
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

  // ─── Proximity checks: PAP, Juggernog, Portal ──────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const [px, , pz] = playerPosRef.current;

      // Pack-a-Punch
      const [mx, , mz] = PACK_A_PUNCH_POSITION;
      const dist = Math.sqrt((px - mx) ** 2 + (pz - mz) ** 2);
      setNearPackAPunch(dist <= PACK_A_PUNCH_INTERACT_RANGE);

      // Juggernog
      const [jx, , jz] = JUGGERNOG_POSITION;
      const distJ = Math.sqrt((px - jx) ** 2 + (pz - jz) ** 2);
      setNearJuggernog(distJ <= JUGGERNOG_INTERACT_RANGE);

      // Portal (both worlds share the same proximity check, each world has its portal at fixed pos)
      const world = currentWorldRef.current;
      const [porx, , porz] =
        world === "desert" ? DESERT_PORTAL_POSITION : WARZONE_PORTAL_POSITION;
      const distP = Math.sqrt((px - porx) ** 2 + (pz - porz) ** 2);
      setNearPortal(distP <= PORTAL_INTERACT_RANGE);

      // Nuclear machine (warzone only)
      const [nx, , nz] = NUCLEAR_MACHINE_POSITION;
      const distN = Math.sqrt((px - nx) ** 2 + (pz - nz) ** 2);
      setNearNuclearMachine(
        world === "warzone" && distN <= NUCLEAR_MACHINE_INTERACT_RANGE,
      );

      // Speed Cola machine (warzone only)
      const distSC = Math.sqrt(
        (px - SPEED_COLA_POSITION.x) ** 2 + (pz - SPEED_COLA_POSITION.z) ** 2,
      );
      setNearSpeedCola(
        world === "warzone" && distSC <= SPEED_COLA_INTERACT_RANGE,
      );
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

  // ESC key: toggle pause
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
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

  // Re-lock pointer on unpause
  useEffect(() => {
    if (
      !isPaused &&
      isLocked === false &&
      waveState.phase !== "gameover" &&
      waveState.phase !== "menu"
    ) {
      const t = setTimeout(() => {
        if (controlsRef.current && !isPausedRef.current) {
          controlsRef.current.lock();
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isPaused, isLocked, waveState.phase]);

  // ─── Teleport sequence ─────────────────────────────────────────────────────
  const executeTeleport = useCallback(() => {
    if (isTeleportingRef.current) return;
    isTeleportingRef.current = true;
    setIsTeleporting(true);

    // Phase 1: fade in white overlay
    setTeleportOverlay(0);
    const fadeInStart = Date.now();
    const fadeDuration = 300;

    const fadeIn = () => {
      const elapsed = Date.now() - fadeInStart;
      const t = Math.min(1, elapsed / fadeDuration);
      setTeleportOverlay(t);
      if (t < 1) {
        requestAnimationFrame(fadeIn);
      } else {
        // Phase 2: hold white + switch world
        setTimeout(() => {
          const nextWorld =
            currentWorldRef.current === "desert" ? "warzone" : "desert";

          // Transfer enemies if wave active
          const aliveCount = enemies.filter((e) => !e.isDead).length;

          // Set new world
          setCurrentWorld(nextWorld);
          currentWorldRef.current = nextWorld;

          // Reset player position
          playerPosRef.current = [0, 1.7, 0];

          // Respawn alive enemies in new world
          if (aliveCount > 0) {
            spawnEnemies(aliveCount, 1.0, false);
          }

          // Phase 3: fade out
          const fadeOutStart = Date.now();
          const fadeOutDuration = 500;
          const fadeOut = () => {
            const el = Date.now() - fadeOutStart;
            const ft = Math.max(0, 1 - el / fadeOutDuration);
            setTeleportOverlay(ft);
            if (ft > 0) {
              requestAnimationFrame(fadeOut);
            } else {
              setTeleportOverlay(0);
              setIsTeleporting(false);
              isTeleportingRef.current = false;
            }
          };
          requestAnimationFrame(fadeOut);
        }, 300);
      }
    };
    requestAnimationFrame(fadeIn);
  }, [enemies, spawnEnemies]);

  // Key handlers: E for Pack-a-Punch & Portal, F for Juggernog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLocked || isPausedRef.current) return;

      if (e.key === "e" || e.key === "E") {
        // Portal interaction takes priority if near portal — free, no points required
        if (nearPortal && !isTeleportingRef.current) {
          executeTeleport();
          return;
        }

        // Nuclear machine (warzone)
        if (nearNuclearMachine && !nuclearEventActive) {
          setNuclearEventActive(true);
          return;
        }

        // Speed Cola machine (warzone)
        if (nearSpeedCola && currentWorldRef.current === "warzone") {
          speedColaSystem.purchaseSpeedCola(
            points,
            spendPoints,
            () => {
              showUpgradeMessage(
                "🥤 Speed Cola purchased! Reload speed doubled.",
              );
            },
            (msg) => {
              showUpgradeMessage(`✗ ${msg}`);
            },
          );
          return;
        }

        // Pack-a-Punch
        if (nearPackAPunch) {
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
    nearPortal,
    nearPackAPunch,
    nearJuggernog,
    nearNuclearMachine,
    nearSpeedCola,
    nuclearEventActive,
    isLocked,
    weaponState.upgradeTier,
    points,
    health,
    spendPoints,
    upgradeWeapon,
    showUpgradeMessage,
    juggernogSystem,
    speedColaSystem.purchaseSpeedCola,
    executeTeleport,
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

      const shotDir = new THREE.Vector3(0, 0, -1);
      const intensity = result.isDismemberment ? 2.5 : 1.0;
      const newEffect: BloodEffect = {
        id: bloodEffectIdCounter++,
        position: [hitPoint.x, hitPoint.y, hitPoint.z],
        direction: [shotDir.x, shotDir.y, shotDir.z],
        intensity,
      };
      setBloodEffects((prev) => [...prev, newEffect]);

      bloodDecalsRef.current?.addBloodSplatter([
        hitPoint.x,
        hitPoint.y,
        hitPoint.z,
      ]);

      if (result.killed) {
        killsRef.current += 1;
        if (isHeadshot) headshotsRef.current += 1;
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
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    isPausedRef.current = false;
    setTimeout(() => {
      if (controlsRef.current) {
        controlsRef.current.lock();
      }
    }, 50);
  }, []);

  const handleNuclearCountdownUpdate = useCallback(
    (count: number | null, show: boolean) => {
      setNuclearCountdownNum(count);
      setShowNuclearCountdownHUD(show);
    },
    [],
  );

  const handleKillZombiesByShockwave = useCallback(
    (killedIds: string[]) => {
      for (const id of killedIds) {
        // Deal 9999 damage — guaranteed kill with burn effect
        damageEnemy(id, 9999, false, { x: 0, y: 0, z: 0 });
      }
    },
    [damageEnemy],
  );

  const isGameActive = isLocked && waveState.phase !== "gameover" && !isPaused;

  return (
    <div className="relative w-full h-full" style={{ background: "#000" }}>
      <Canvas
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
        camera={{ fov: 75, near: 0.1, far: 300 }}
        gl={{ antialias: true }}
        shadows
      >
        <PointerLockControls
          ref={
            controlsRef as React.Ref<
              React.ComponentRef<typeof PointerLockControls>
            >
          }
          onLock={handleLock}
          onUnlock={handleUnlock}
        />

        {/* ─── World rendering ─── */}
        {currentWorld === "desert" ? (
          <>
            <DesertEnvironment
              upgradeTier={weaponState.upgradeTier}
              juggernogPurchaseCount={juggernogSystem.juggernogPurchaseCount}
            />
            <Portal
              position={DESERT_PORTAL_POSITION}
              theme="warzone"
              onActivate={executeTeleport}
              showPrompt={nearPortal}
            />
          </>
        ) : (
          <>
            <WarzoneEnvironment
              onActivateNuclear={() => setNuclearEventActive(true)}
              playerPosRef={playerPosRef}
              nuclearEventActive={nuclearEventActive}
            />
            <Portal
              position={WARZONE_PORTAL_POSITION}
              theme="desert"
              onActivate={executeTeleport}
              showPrompt={nearPortal}
            />
            <SpeedColaMachine
              isPurchased={speedColaSystem.isPurchased}
              onPurchase={() => {}}
            />
          </>
        )}

        {/* ─── Nuclear event (runs inside Canvas, warzone only) ─── */}
        {currentWorld === "warzone" && (
          <NuclearEvent
            active={nuclearEventActive}
            onComplete={() => setNuclearEventActive(false)}
            playerPosRef={playerPosRef}
            destroyedBuildingIds={destroyedBuildingIds}
            flashRef={nuclearFlashRef}
            onCountdownUpdate={handleNuclearCountdownUpdate}
            onKillZombiesByShockwave={handleKillZombiesByShockwave}
            enemies={enemies}
          />
        )}

        <FirstPersonCamera
          isLocked={isLocked}
          onPlayerPositionUpdate={(pos) => {
            playerPosRef.current = pos;
          }}
          onFire={handleFire}
          isGameActive={isGameActive}
          isPaused={isPaused}
          extraAABBs={
            currentWorld === "warzone" ? WARZONE_EXTRA_AABBS : EMPTY_AABBS
          }
        />

        {!(weaponState.currentWeapon === "sniper_rifle" && isAiming) && (
          <WeaponViewModel
            weapon={weaponState.currentWeapon}
            recoilOffset={weaponState.recoilOffset}
            isReloading={weaponState.isReloading}
            upgradeTier={weaponState.upgradeTier}
          />
        )}

        <RaycastShooter onHit={handleEnemyHit} isActive={isGameActive} />

        <EnemyUpdater
          playerPos={playerPosRef}
          onPlayerHit={handlePlayerHit}
          updatePositions={updateEnemyPositions}
          isPaused={isPaused}
        />

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
        nearPackAPunch={nearPackAPunch && currentWorld === "desert"}
        nearJuggernog={nearJuggernog && currentWorld === "desert"}
        upgradeMessage={upgradeMessage}
        juggernogPurchaseCount={juggernogSystem.juggernogPurchaseCount}
        isAiming={isAiming}
        currentWorld={currentWorld}
        nearPortal={nearPortal}
        nearNuclearMachine={nearNuclearMachine && currentWorld === "warzone"}
        nearSpeedCola={nearSpeedCola && !speedColaSystem.isPurchased}
      />

      <WaveOverlay waveState={waveState} />

      {isPaused && waveState.phase !== "gameover" && (
        <PauseOverlay onResume={handleResume} />
      )}

      {/* ─── Teleport flash overlay ─── */}
      {isTeleporting && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "white",
            opacity: teleportOverlay,
            zIndex: 50,
            transition: "none",
          }}
        />
      )}

      {/* ─── Nuclear Countdown HUD — rendered OUTSIDE the Canvas ─── */}
      {showNuclearCountdownHUD && nuclearCountdownNum !== null && (
        <NuclearCountdownHUD count={nuclearCountdownNum} />
      )}

      {/*
        Nuclear white flash — permanently mounted outside Canvas so it NEVER unmounts
        mid-sequence when nuclearEventActive flips to false. NuclearEvent controls this
        div imperatively via nuclearFlashRef. Starts hidden.
      */}
      <div
        ref={nuclearFlashRef}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "#ffffff",
          display: "none",
          opacity: 0,
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
    </div>
  );
}
