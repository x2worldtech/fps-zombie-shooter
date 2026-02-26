import { useState, useCallback, useRef } from 'react';
import { Enemy, EnemyType, Pickup } from '../types/enemy';

let enemyIdCounter = 0;
let pickupIdCounter = 0;

function generateId(): string {
  return `e_${++enemyIdCounter}_${Date.now()}`;
}

function generatePickupId(): string {
  return `p_${++pickupIdCounter}_${Date.now()}`;
}

export interface PointsNotification {
  id: string;
  amount: number;
  isHeadshot: boolean;
  timestamp: number;
}

export function useEnemySystem() {
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [pointsNotifications, setPointsNotifications] = useState<PointsNotification[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  enemiesRef.current = enemies;

  const addPointsNotification = useCallback((amount: number, isHeadshot: boolean) => {
    const notif: PointsNotification = {
      id: `notif_${Date.now()}_${Math.random()}`,
      amount,
      isHeadshot,
      timestamp: Date.now(),
    };
    setPointsNotifications(prev => [...prev, notif]);
    // Auto-remove after 2 seconds
    setTimeout(() => {
      setPointsNotifications(prev => prev.filter(n => n.id !== notif.id));
    }, 2000);
  }, []);

  const spawnEnemies = useCallback((count: number, speedMultiplier: number, includeBoss: boolean) => {
    const newEnemies: Enemy[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 35 + Math.random() * 20;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      newEnemies.push({
        id: generateId(),
        type: 'standard',
        position: [x, 0.9, z],
        health: 60,
        maxHealth: 60,
        speed: 3.5 * speedMultiplier,
        attackDamage: 10,
        attackCooldown: 1000,
        lastAttackTime: 0,
        isDead: false,
        deathTime: 0,
        isHit: false,
        hitTime: 0,
        velocity: [0, 0],
      });
    }

    if (includeBoss) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 40;
      newEnemies.push({
        id: generateId(),
        type: 'boss',
        position: [Math.cos(angle) * radius, 1.5, Math.sin(angle) * radius],
        health: 400,
        maxHealth: 400,
        speed: 1.8 * speedMultiplier,
        attackDamage: 25,
        attackCooldown: 1500,
        lastAttackTime: 0,
        isDead: false,
        deathTime: 0,
        isHit: false,
        hitTime: 0,
        velocity: [0, 0],
      });
    }

    setEnemies(prev => [...prev.filter(e => !e.isDead || Date.now() - e.deathTime < 800), ...newEnemies]);
  }, []);

  /**
   * Damage an enemy. isHeadshot determines bonus damage and point reward.
   * Returns true if the enemy was killed.
   */
  const damageEnemy = useCallback((id: string, damage: number, isHeadshot = false): boolean => {
    // Look up the enemy synchronously from the ref before any state update
    const enemy = enemiesRef.current.find(e => e.id === id);

    // If enemy doesn't exist or is already dead, do nothing
    if (!enemy || enemy.isDead) return false;

    const newHealth = Math.max(0, enemy.health - damage);
    const killed = newHealth <= 0;

    // Update enemy state
    setEnemies(prev => prev.map(e => {
      if (e.id !== id || e.isDead) return e;
      return {
        ...e,
        health: Math.max(0, e.health - damage),
        isDead: e.health - damage <= 0,
        deathTime: e.health - damage <= 0 ? Date.now() : e.deathTime,
        isHit: true,
        hitTime: Date.now(),
      };
    }));

    if (killed) {
      // Legacy score (for leaderboard)
      const scoreGain = enemy.type === 'boss' ? 500 : 100;
      setScore(prev => prev + scoreGain);

      // Points system: 75 for headshot kill, 50 for normal kill
      const pointsGained = isHeadshot ? 75 : 50;
      setPoints(prev => prev + pointsGained);
      addPointsNotification(pointsGained, isHeadshot);

      // Spawn pickup
      if (Math.random() < 0.6) {
        const pickup: Pickup = {
          id: generatePickupId(),
          type: Math.random() < 0.5 ? 'health' : 'ammo',
          position: [enemy.position[0], 0.5, enemy.position[2]],
          collected: false,
        };
        setPickups(prev => [...prev, pickup]);
      }
    }

    return killed;
  }, [addPointsNotification]);

  const spendPoints = useCallback((amount: number): boolean => {
    let success = false;
    setPoints(prev => {
      if (prev >= amount) {
        success = true;
        return prev - amount;
      }
      return prev;
    });
    return success;
  }, []);

  const clearHitFlash = useCallback((id: string) => {
    setEnemies(prev => prev.map(e =>
      e.id === id ? { ...e, isHit: false } : e
    ));
  }, []);

  const updateEnemyPositions = useCallback((
    playerPos: [number, number, number],
    delta: number,
    onPlayerHit: (damage: number) => void
  ) => {
    const now = Date.now();
    setEnemies(prev => prev.map(e => {
      if (e.isDead) return e;

      const dx = playerPos[0] - e.position[0];
      const dz = playerPos[2] - e.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.1) return e;

      // Steering toward player
      const nx = dx / dist;
      const nz = dz / dist;

      // Simple separation from other enemies
      let sepX = 0, sepZ = 0;
      prev.forEach(other => {
        if (other.id === e.id || other.isDead) return;
        const ox = e.position[0] - other.position[0];
        const oz = e.position[2] - other.position[2];
        const od = Math.sqrt(ox * ox + oz * oz);
        if (od < 2.5 && od > 0.01) {
          sepX += ox / od;
          sepZ += oz / od;
        }
      });

      const moveX = nx * 0.8 + sepX * 0.2;
      const moveZ = nz * 0.8 + sepZ * 0.2;
      const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ) || 1;

      const attackRange = e.type === 'boss' ? 2.5 : 1.8;

      if (dist > attackRange) {
        const newX = e.position[0] + (moveX / moveLen) * e.speed * delta;
        const newZ = e.position[2] + (moveZ / moveLen) * e.speed * delta;
        return { ...e, position: [newX, e.position[1], newZ] as [number, number, number] };
      } else {
        // Attack
        if (now - e.lastAttackTime > e.attackCooldown) {
          onPlayerHit(e.attackDamage);
          return { ...e, lastAttackTime: now };
        }
      }
      return e;
    }));
  }, []);

  const collectPickup = useCallback((id: string) => {
    setPickups(prev => prev.map(p =>
      p.id === id ? { ...p, collected: true } : p
    ));
  }, []);

  const clearDeadEnemies = useCallback(() => {
    const now = Date.now();
    setEnemies(prev => prev.filter(e => !e.isDead || now - e.deathTime < 1200));
    setPickups(prev => prev.filter(p => !p.collected));
  }, []);

  const activeEnemyCount = enemies.filter(e => !e.isDead).length;

  return {
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
  };
}
