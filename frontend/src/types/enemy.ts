export type EnemyType = 'standard' | 'boss';

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
}

export interface Pickup {
  id: string;
  type: 'health' | 'ammo';
  position: [number, number, number];
  collected: boolean;
}
