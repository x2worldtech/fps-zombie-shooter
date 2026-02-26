export type WeaponName = 'pistol' | 'shotgun' | 'assault_rifle';

export interface WeaponConfig {
  name: WeaponName;
  displayName: string;
  fireRate: number; // shots per second
  damage: number;
  spread: number; // radians
  magazineSize: number;
  reserveAmmoMax: number;
  reloadTime: number; // seconds
  pellets: number; // for shotgun
  color: string; // hex for Three.js
  barrelLength: number;
}

export interface WeaponState {
  currentWeapon: WeaponName;
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  lastFireTime: number;
  recoilOffset: number;
  upgradeTier: number; // 0 = base, 1/2/3 = upgraded
}

export const UPGRADE_COSTS = [2500, 5000, 10000] as const;
export const UPGRADE_DAMAGE_MULTIPLIERS = [1, 1.5, 2.0, 3.0] as const; // index = tier

export const WEAPON_CONFIGS: Record<WeaponName, WeaponConfig> = {
  pistol: {
    name: 'pistol',
    displayName: 'PISTOL',
    fireRate: 3,
    damage: 25,
    spread: 0.02,
    magazineSize: 15,
    reserveAmmoMax: 90,
    reloadTime: 1.2,
    pellets: 1,
    color: '#888888',
    barrelLength: 0.4,
  },
  shotgun: {
    name: 'shotgun',
    displayName: 'SHOTGUN',
    fireRate: 0.8,
    damage: 18,
    spread: 0.12,
    magazineSize: 8,
    reserveAmmoMax: 40,
    reloadTime: 2.5,
    pellets: 8,
    color: '#8B4513',
    barrelLength: 0.7,
  },
  assault_rifle: {
    name: 'assault_rifle',
    displayName: 'ASSAULT RIFLE',
    fireRate: 8,
    damage: 20,
    spread: 0.04,
    magazineSize: 30,
    reserveAmmoMax: 150,
    reloadTime: 1.8,
    pellets: 1,
    color: '#4a4a4a',
    barrelLength: 0.6,
  },
};
