export type EnemyType = "standard" | "boss";

/**
 * Phase einer Leiche nach dem Tod:
 *  - "alive"      → noch lebendig
 *  - "ragdoll"    → fällt aktuell um (0–0.9s nach Tod)
 *  - "resting"    → ragdoll-Animation fertig, liegt still
 *  - "fadingOut"  → wird despawnt (Opacity fade ~0.6s), wird danach entfernt
 */
export type CorpseState = "alive" | "ragdoll" | "resting" | "fadingOut";

export interface Enemy {
  id: string;
  type: EnemyType;
  position: [number, number, number];
  health: number;
  maxHealth: number;
  speed: number;
  attackDamage: number;
  attackCooldown: number;
  lastAttackTime: number;
  isDead: boolean;
  deathTime: number;
  isHit: boolean;
  hitTime: number;
  velocity: [number, number];
  // Dismemberment state
  headDetached?: boolean;
  leftArmDetached?: boolean;
  rightArmDetached?: boolean;
  leftLegDetached?: boolean;
  rightLegDetached?: boolean;
  // ── Ragdoll / Despawn (procedural, ohne Physics-Engine) ──
  /** Hit-Richtung XZ-normalisiert (Spieler → Zombie). Bestimmt Fallrichtung. */
  deathHitDirX?: number;
  deathHitDirZ?: number;
  /** Zufalls-Seed pro Zombie, damit Leichen leicht unterschiedlich liegen. */
  ragdollSeed?: number;
  /** Aktuelle Phase. Übergänge im EnemyMesh useFrame + cullCorpses. */
  corpseState?: CorpseState;
  /** Wann das Fade-Out für despawn gestartet wurde (epoch ms). */
  fadeStartTime?: number;
}

export interface Pickup {
  id: string;
  type: "health" | "ammo";
  position: [number, number, number];
  collected: boolean;
}
