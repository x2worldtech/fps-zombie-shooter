import type React from "react";
import { useCallback, useRef, useState } from "react";
import type { Enemy, Pickup } from "../types/enemy";

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

export type DismembermentZone =
  | "head"
  | "leftArm"
  | "rightArm"
  | "leftLeg"
  | "rightLeg"
  | "torso";

// ─── PERF-NOTE ────────────────────────────────────────────────────────────────
// Positions, lastAttackTimes und Velocities laufen NICHT mehr durch React-State.
// Stattdessen werden sie in Refs (Maps) gehalten. Dadurch löst die per-Frame-
// Bewegung der Enemies kein setEnemies(...) mehr aus → GameScene re-rendert nur
// noch bei echten State-Events (Spawn, Damage, Tod, Dismemberment, HitFlash).
// Vorher: ~60 React-Renders/s pro Enemy. Nachher: punktuell, event-getrieben.
//
// EnemyMesh liest die aktuelle Position in useFrame direkt aus dem Ref.
// damageEnemy synchronisiert beim State-Update die Position aus dem Ref in den
// State zurück, damit z.B. Dismemberment-Spawns die korrekte Position kennen.
// ─────────────────────────────────────────────────────────────────────────────

export type EnemyPositionsRef = React.MutableRefObject<
  Map<string, [number, number, number]>
>;

export function useEnemySystem() {
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [pointsNotifications, setPointsNotifications] = useState<
    PointsNotification[]
  >([]);
  const enemiesRef = useRef<Enemy[]>([]);
  enemiesRef.current = enemies;

  // ── PERF: Per-Frame mutable Refs (keine React-Updates) ──
  // Aktuelle Position pro Enemy. Wird in updateEnemyPositions geschrieben und
  // von EnemyMesh in useFrame gelesen.
  const positionsRef = useRef<Map<string, [number, number, number]>>(new Map());
  // lastAttackTime pro Enemy. Wird beim Player-Hit aktualisiert (kein State).
  const lastAttackTimesRef = useRef<Map<string, number>>(new Map());

  const addPointsNotification = useCallback(
    (amount: number, isHeadshot: boolean) => {
      const notif: PointsNotification = {
        id: `notif_${Date.now()}_${Math.random()}`,
        amount,
        isHeadshot,
        timestamp: Date.now(),
      };
      setPointsNotifications((prev) => [...prev, notif]);
      setTimeout(() => {
        setPointsNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      }, 2000);
    },
    [],
  );

  const spawnEnemies = useCallback(
    (count: number, speedMultiplier: number, includeBoss: boolean) => {
      const newEnemies: Enemy[] = [];

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const radius = 35 + Math.random() * 20;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const id = generateId();
        const initialPos: [number, number, number] = [x, 1.2, z];
        positionsRef.current.set(id, [...initialPos]);
        lastAttackTimesRef.current.set(id, 0);

        newEnemies.push({
          id,
          type: "standard",
          position: initialPos,
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
        const id = generateId();
        const initialPos: [number, number, number] = [
          Math.cos(angle) * radius,
          1.5,
          Math.sin(angle) * radius,
        ];
        positionsRef.current.set(id, [...initialPos]);
        lastAttackTimesRef.current.set(id, 0);

        newEnemies.push({
          id,
          type: "boss",
          position: initialPos,
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

      // PERF/Ragdoll: alte Leichen werden NICHT mehr beim Spawn entsorgt —
      // dafür ist jetzt cullCorpses zuständig (Frustum-aware, gestaffelter
      // Despawn außerhalb des Sichtfelds). Wir hängen die neuen Enemies einfach
      // an die Liste an.
      setEnemies((prev) => [...prev, ...newEnemies]);
    },
    [],
  );

  /**
   * Determine which body zone was hit based on the hit point relative to the enemy.
   */
  const _getHitZone = useCallback(
    (enemy: Enemy, hitY: number): DismembermentZone => {
      const baseY = enemy.position[1];
      const scale = enemy.type === "boss" ? 1.5 : 1.0;
      const relY = hitY - baseY;

      if (relY > 1.55 * scale) return "head";
      if (relY > 0.85 * scale) return "torso"; // arms handled by X offset separately
      if (relY > 0.3 * scale) return "torso";
      return relY < 0.15 * scale ? "leftLeg" : "rightLeg";
    },
    [],
  );

  /**
   * Damage an enemy. isHeadshot determines bonus damage and point reward.
   * hitPoint is optional — if provided, dismemberment zone detection is used.
   * Returns { killed, isDismemberment, zone }.
   */
  const damageEnemy = useCallback(
    (
      id: string,
      damage: number,
      isHeadshot = false,
      hitPoint?: { x: number; y: number; z: number },
    ): {
      killed: boolean;
      isDismemberment: boolean;
      zone: DismembermentZone;
    } => {
      const enemy = enemiesRef.current.find((e) => e.id === id);
      if (!enemy || enemy.isDead)
        return { killed: false, isDismemberment: false, zone: "torso" };

      // PERF: aktuelle Position aus Ref ziehen (state.position ist stale, da wir
      // sie nicht mehr per-Frame syncen). Fallback auf state.position für den
      // Edge-Case "Enemy gerade gespawnt, Ref-Map noch nicht beschrieben".
      const refPos = positionsRef.current.get(id);
      const currentPos: [number, number, number] = refPos
        ? [refPos[0], refPos[1], refPos[2]]
        : ([...enemy.position] as [number, number, number]);

      const newHealth = Math.max(0, enemy.health - damage);
      const killed = newHealth <= 0;

      // Determine dismemberment zone — basiert auf der aktuellen Position
      let zone: DismembermentZone = isHeadshot ? "head" : "torso";
      if (hitPoint) {
        // Refine zone using hit position
        const relY = hitPoint.y - currentPos[1];
        const relX = hitPoint.x - currentPos[0];
        const scale = enemy.type === "boss" ? 1.5 : 1.0;

        if (relY > 1.55 * scale) {
          zone = "head";
        } else if (relY > 0.85 * scale) {
          if (relX < -0.25 * scale) zone = "leftArm";
          else if (relX > 0.25 * scale) zone = "rightArm";
          else zone = "torso";
        } else if (relY > 0.3 * scale) {
          zone = "torso";
        } else {
          zone = relX < 0 ? "leftLeg" : "rightLeg";
        }
      }

      // Dismemberment: probabilistic per zone, only if not already detached
      let isDismemberment = false;
      const dismemberUpdate: Partial<Enemy> = {};

      if (zone === "head" && !enemy.headDetached && Math.random() < 0.55) {
        dismemberUpdate.headDetached = true;
        isDismemberment = true;
      } else if (
        zone === "leftArm" &&
        !enemy.leftArmDetached &&
        Math.random() < 0.6
      ) {
        dismemberUpdate.leftArmDetached = true;
        isDismemberment = true;
      } else if (
        zone === "rightArm" &&
        !enemy.rightArmDetached &&
        Math.random() < 0.6
      ) {
        dismemberUpdate.rightArmDetached = true;
        isDismemberment = true;
      } else if (
        zone === "leftLeg" &&
        !enemy.leftLegDetached &&
        Math.random() < 0.5
      ) {
        dismemberUpdate.leftLegDetached = true;
        isDismemberment = true;
      } else if (
        zone === "rightLeg" &&
        !enemy.rightLegDetached &&
        Math.random() < 0.5
      ) {
        dismemberUpdate.rightLegDetached = true;
        isDismemberment = true;
      }

      // Speed reduction on leg loss
      const legJustLost =
        dismemberUpdate.leftLegDetached || dismemberUpdate.rightLegDetached;
      const legAlreadyLost = enemy.leftLegDetached || enemy.rightLegDetached;
      const newSpeed =
        legJustLost && !legAlreadyLost ? enemy.speed * 0.5 : enemy.speed;

      // ── RAGDOLL-DATEN für den Tod-Frame berechnen ──
      // Fall-Richtung = vom Treffer aus weg vom Spieler (= Schuss-Richtung in XZ),
      // wenn ein hitPoint vorliegt. Sonst Fallback: in Player-Richtung kippen
      // (defensive — sollte praktisch nie greifen, alle Tref-Calls liefern hitPoint).
      let hitDirX = 0;
      let hitDirZ = 1;
      if (killed && hitPoint) {
        const dxh = currentPos[0] - hitPoint.x;
        const dzh = currentPos[2] - hitPoint.z;
        const lenh = Math.sqrt(dxh * dxh + dzh * dzh);
        if (lenh > 0.001) {
          // normalisierte XZ-Richtung in welche der Körper kippt (vom Schuss
          // weggeschoben)
          hitDirX = dxh / lenh;
          hitDirZ = dzh / lenh;
        }
      }

      setEnemies((prev) =>
        prev.map((e) => {
          if (e.id !== id || e.isDead) return e;
          const willDie = e.health - damage <= 0;
          return {
            ...e,
            ...dismemberUpdate,
            // PERF: Position aus dem Ref in den State syncen, damit
            // useEffect-Dependencies (z.B. Dismemberment-Limb-Spawn) die
            // korrekte Position sehen.
            position: currentPos,
            health: Math.max(0, e.health - damage),
            speed: newSpeed,
            isDead: willDie,
            deathTime: willDie ? Date.now() : e.deathTime,
            isHit: true,
            hitTime: Date.now(),
            // ── Ragdoll-Felder nur beim Übergang lebendig→tot setzen ──
            corpseState: willDie ? ("ragdoll" as const) : e.corpseState,
            deathHitDirX: willDie ? hitDirX : e.deathHitDirX,
            deathHitDirZ: willDie ? hitDirZ : e.deathHitDirZ,
            // Yaw bewahren: der EnemyMesh hat im Lebend-Modus
            // rotation.y = atan2(dx, dz) zum Spieler gesetzt. Wir wissen den
            // Yaw nicht exakt hier, aber EnemyMesh rekonstruiert ihn beim
            // Ragdoll-Start aus deathHitDirX/Z (= weg-vom-Spieler-Richtung):
            // facingYaw ≈ atan2(-hitDirX, -hitDirZ).
            ragdollSeed: willDie ? Math.random() * 1000 : e.ragdollSeed,
          };
        }),
      );

      if (killed) {
        const scoreGain = enemy.type === "boss" ? 500 : 100;
        setScore((prev) => prev + scoreGain);

        const pointsGained = isHeadshot ? 75 : 50;
        setPoints((prev) => prev + pointsGained);
        addPointsNotification(pointsGained, isHeadshot);

        if (Math.random() < 0.6) {
          const pickup: Pickup = {
            id: generatePickupId(),
            type: Math.random() < 0.5 ? "health" : "ammo",
            position: [currentPos[0], 0.5, currentPos[2]],
            collected: false,
          };
          setPickups((prev) => [...prev, pickup]);
        }
      }

      return { killed, isDismemberment, zone };
    },
    [addPointsNotification],
  );

  const spendPoints = useCallback((amount: number): boolean => {
    let success = false;
    setPoints((prev) => {
      if (prev >= amount) {
        success = true;
        return prev - amount;
      }
      return prev;
    });
    return success;
  }, []);

  const clearHitFlash = useCallback((id: string) => {
    setEnemies((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isHit: false } : e)),
    );
  }, []);

  /**
   * PERF: Schreibt nur in positionsRef / lastAttackTimesRef — KEIN setEnemies.
   * EnemyMesh liest die Position in useFrame direkt aus positionsRef.
   * Wird in jedem Frame aus EnemyUpdater aufgerufen.
   */
  const updateEnemyPositions = useCallback(
    (
      playerPos: [number, number, number],
      delta: number,
      onPlayerHit: (damage: number) => void,
    ) => {
      const now = Date.now();
      const list = enemiesRef.current;
      const positions = positionsRef.current;
      const attackTimes = lastAttackTimesRef.current;

      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.isDead) continue;

        // Aktuelle Position aus Ref (Fallback auf state.position für frisch
        // gespawnte Enemies, deren Ref-Eintrag in einem unwahrscheinlichen
        // Race-Case noch fehlt — defensive Programmierung)
        let pos = positions.get(e.id);
        if (!pos) {
          pos = [e.position[0], e.position[1], e.position[2]];
          positions.set(e.id, pos);
        }

        const dx = playerPos[0] - pos[0];
        const dz = playerPos[2] - pos[2];
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.1) continue;

        const nx = dx / dist;
        const nz = dz / dist;

        // Separation gegen andere Enemies (verhindert dass sie übereinander
        // klumpen). Identische Logik wie zuvor — nur über `pos` statt
        // `e.position`.
        let sepX = 0;
        let sepZ = 0;
        for (let j = 0; j < list.length; j++) {
          const other = list[j];
          if (other.id === e.id || other.isDead) continue;
          const otherPos = positions.get(other.id) ?? other.position;
          const ox = pos[0] - otherPos[0];
          const oz = pos[2] - otherPos[2];
          const od = Math.sqrt(ox * ox + oz * oz);
          if (od < 2.5 && od > 0.01) {
            sepX += ox / od;
            sepZ += oz / od;
          }
        }

        const moveX = nx * 0.8 + sepX * 0.2;
        const moveZ = nz * 0.8 + sepZ * 0.2;
        const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ) || 1;

        const attackRange = e.type === "boss" ? 2.5 : 1.8;

        if (dist > attackRange) {
          // Mutiere die [x,y,z]-Tupel an Ort und Stelle — kein neues Array
          // pro Frame nötig (auch hier GC-Druck reduziert).
          pos[0] += (moveX / moveLen) * e.speed * delta;
          pos[2] += (moveZ / moveLen) * e.speed * delta;
        } else {
          const lastAttack = attackTimes.get(e.id) ?? 0;
          if (now - lastAttack > e.attackCooldown) {
            onPlayerHit(e.attackDamage);
            attackTimes.set(e.id, now);
          }
        }
      }
    },
    [],
  );

  const collectPickup = useCallback((id: string) => {
    setPickups((prev) =>
      prev.map((p) => (p.id === id ? { ...p, collected: true } : p)),
    );
  }, []);

  // ─── RAGDOLL / DESPAWN ─────────────────────────────────────────────────────
  // Tuning-Konstanten — bewusst HIER zentralisiert, damit du sie an einer
  // Stelle anfassen kannst.
  const CORPSE_CAP = 15; // gleichzeitig erlaubte Leichen am Boden
  const RAGDOLL_DURATION_MS = 900; // Dauer der Umfall-Animation
  const FADE_DURATION_MS = 600; // Dauer des unsichtbaren Despawn-Fades
  const MIN_REST_BEFORE_DESPAWN_MS = 4000; // Leiche liegt mind. so lange bevor sie despawnen darf
  const VISIBLE_DESPAWN_STAGGER_MS = 800; // Mindestabstand zwischen sichtbaren Despawns

  // Letzter Zeitpunkt, an dem im Sichtfeld despawnt wurde (für Staffelung)
  const lastVisibleDespawnRef = useRef(0);

  /**
   * Aktualisiert den `corpseState` von Leichen:
   *  - ragdoll → resting nach RAGDOLL_DURATION_MS
   * Anschließend wird, wenn der Leichen-Cap erreicht ist, Despawn ausgelöst:
   *  - bevorzugt für Leichen außerhalb von `visibleIds` (frustum-out)
   *  - sonst (alle sichtbar) für die ÄLTESTE Leiche, gestaffelt im Abstand
   *    von VISIBLE_DESPAWN_STAGGER_MS — damit es nicht alle gleichzeitig
   *    "ploppen", sondern unauffällig nacheinander verschwinden.
   *  - Leichen, deren Fade abgeschlossen ist, werden entfernt.
   *
   * `visibleIds` ist die Menge der Leichen-IDs, die im aktuellen Kamera-
   * Frustum liegen. Wird von GameScene gefüllt.
   */
  const cullCorpses = useCallback((visibleIds: Set<string>) => {
    const now = Date.now();
    let mutated = false;

    setEnemies((prev) => {
      // Phase 1: Zustands-Übergänge ragdoll→resting + Fade-Ende → remove
      const transitioned = prev
        .map((e) => {
          if (!e.isDead) return e;
          if (
            e.corpseState === "ragdoll" &&
            now - e.deathTime >= RAGDOLL_DURATION_MS
          ) {
            mutated = true;
            return { ...e, corpseState: "resting" as const };
          }
          return e;
        })
        .filter((e) => {
          if (
            e.corpseState === "fadingOut" &&
            e.fadeStartTime !== undefined &&
            now - e.fadeStartTime >= FADE_DURATION_MS
          ) {
            mutated = true;
            return false;
          }
          return true;
        });

      // Phase 2: Despawn-Auswahl wenn Cap überschritten
      // Kandidaten: corpseState === "resting" UND mindestens MIN_REST_BEFORE_DESPAWN_MS alt
      const restingCorpses = transitioned.filter(
        (e) =>
          e.corpseState === "resting" &&
          now - e.deathTime >= MIN_REST_BEFORE_DESPAWN_MS,
      );

      // Wenn Cap nicht überschritten, nichts zu tun
      if (restingCorpses.length <= CORPSE_CAP) {
        if (!mutated) return prev; // identity stabil halten falls nichts passierte
        // Refs aufräumen (toten-IDs nicht mehr in transitioned)
        const keepIds = new Set(transitioned.map((e) => e.id));
        for (const id of Array.from(positionsRef.current.keys())) {
          if (!keepIds.has(id)) positionsRef.current.delete(id);
        }
        for (const id of Array.from(lastAttackTimesRef.current.keys())) {
          if (!keepIds.has(id)) lastAttackTimesRef.current.delete(id);
        }
        return transitioned;
      }

      // Cap überschritten — wir müssen `overage` Leichen despawnen.
      const overage = restingCorpses.length - CORPSE_CAP;
      // Sortiere: nicht-sichtbar zuerst, dann älteste zuerst innerhalb jeder Gruppe.
      const sorted = [...restingCorpses].sort((a, b) => {
        const aVis = visibleIds.has(a.id) ? 1 : 0;
        const bVis = visibleIds.has(b.id) ? 1 : 0;
        if (aVis !== bVis) return aVis - bVis; // nicht-sichtbar (0) zuerst
        return a.deathTime - b.deathTime; // ältere zuerst
      });

      // Wie viele dürfen wir gleichzeitig fade'n?
      // Alle nicht-sichtbaren dürfen sofort — der Spieler sieht es nicht.
      // Für sichtbare gilt das Stagger: nur EINE pro VISIBLE_DESPAWN_STAGGER_MS.
      const idsToFade = new Set<string>();
      let invisibleSlots = overage;
      for (const c of sorted) {
        if (invisibleSlots <= 0) break;
        if (!visibleIds.has(c.id)) {
          idsToFade.add(c.id);
          invisibleSlots--;
        }
      }

      // Falls noch nicht genug despawnt, eine SICHTBARE auf einmal — nur wenn
      // der letzte sichtbare Despawn lange genug her ist.
      const stillOver = overage - idsToFade.size;
      if (
        stillOver > 0 &&
        now - lastVisibleDespawnRef.current >= VISIBLE_DESPAWN_STAGGER_MS
      ) {
        // Älteste sichtbare resting-Leiche, die noch nicht zum Fade ausgewählt ist
        const visibleCandidate = sorted.find(
          (c) => visibleIds.has(c.id) && !idsToFade.has(c.id),
        );
        if (visibleCandidate) {
          idsToFade.add(visibleCandidate.id);
          lastVisibleDespawnRef.current = now;
        }
      }

      if (idsToFade.size === 0) {
        if (!mutated) return prev;
        return transitioned;
      }

      const next = transitioned.map((e) => {
        if (!idsToFade.has(e.id)) return e;
        return {
          ...e,
          corpseState: "fadingOut" as const,
          fadeStartTime: now,
        };
      });

      // Refs cleanup
      const keepIds = new Set(next.map((e) => e.id));
      for (const id of Array.from(positionsRef.current.keys())) {
        if (!keepIds.has(id)) positionsRef.current.delete(id);
      }
      for (const id of Array.from(lastAttackTimesRef.current.keys())) {
        if (!keepIds.has(id)) lastAttackTimesRef.current.delete(id);
      }
      return next;
    });
    setPickups((prev) => prev.filter((p) => !p.collected));
  }, []);

  /**
   * BEIBEHALTEN als Kompatibilitäts-API für useWaveSystem. Triggert dieselbe
   * Cleanup-Logik wie cullCorpses, aber ohne Frustum-Info: behandelt ALLE
   * Leichen als "nicht sichtbar" → es darf maximal aufgeräumt werden, jedoch
   * werden nur Leichen über dem Cap zum Fade markiert. Wave-Übergänge
   * verzögern dadurch nichts und sorgen für eine saubere Map.
   */
  const clearDeadEnemies = useCallback(() => {
    cullCorpses(new Set());
  }, [cullCorpses]);
  // ───────────────────────────────────────────────────────────────────────────

  const activeEnemyCount = enemies.filter((e) => !e.isDead).length;

  return {
    enemies,
    enemiesRef,
    /** PERF: Map<enemyId, [x,y,z]> — von EnemyMesh in useFrame gelesen */
    enemyPositionsRef: positionsRef,
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
    /** Despawn-Logik mit Frustum-Info — von GameScene pro ~250ms gerufen. */
    cullCorpses,
  };
}
