import { useState, useCallback, useRef, useEffect } from 'react';
import { WeaponName, WeaponState, WEAPON_CONFIGS, UPGRADE_COSTS, UPGRADE_DAMAGE_MULTIPLIERS } from '../types/weapon';

const WEAPON_ORDER: WeaponName[] = ['pistol', 'shotgun', 'assault_rifle'];

export function useWeaponSystem() {
  const [weaponState, setWeaponState] = useState<WeaponState>({
    currentWeapon: 'pistol',
    currentAmmo: WEAPON_CONFIGS.pistol.magazineSize,
    reserveAmmo: WEAPON_CONFIGS.pistol.reserveAmmoMax,
    isReloading: false,
    reloadProgress: 0,
    lastFireTime: 0,
    recoilOffset: 0,
    upgradeTier: 0,
  });

  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoilTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(weaponState);
  stateRef.current = weaponState;

  const switchWeapon = useCallback((weapon: WeaponName) => {
    if (stateRef.current.isReloading) {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    }
    const config = WEAPON_CONFIGS[weapon];
    setWeaponState(prev => ({
      ...prev,
      currentWeapon: weapon,
      currentAmmo: config.magazineSize,
      reserveAmmo: config.reserveAmmoMax,
      isReloading: false,
      reloadProgress: 0,
      recoilOffset: 0,
    }));
  }, []);

  const reload = useCallback(() => {
    const state = stateRef.current;
    if (state.isReloading) return;
    if (state.currentAmmo === WEAPON_CONFIGS[state.currentWeapon].magazineSize) return;
    if (state.reserveAmmo <= 0) return;

    const config = WEAPON_CONFIGS[state.currentWeapon];
    setWeaponState(prev => ({ ...prev, isReloading: true, reloadProgress: 0 }));

    reloadTimerRef.current = setTimeout(() => {
      setWeaponState(prev => {
        const needed = config.magazineSize - prev.currentAmmo;
        const toAdd = Math.min(needed, prev.reserveAmmo);
        return {
          ...prev,
          currentAmmo: prev.currentAmmo + toAdd,
          reserveAmmo: prev.reserveAmmo - toAdd,
          isReloading: false,
          reloadProgress: 0,
        };
      });
    }, config.reloadTime * 1000);
  }, []);

  const tryFire = useCallback((): boolean => {
    const state = stateRef.current;
    if (state.isReloading) return false;
    if (state.currentAmmo <= 0) {
      reload();
      return false;
    }

    const config = WEAPON_CONFIGS[state.currentWeapon];
    const now = Date.now();
    const minInterval = 1000 / config.fireRate;
    if (now - state.lastFireTime < minInterval) return false;

    setWeaponState(prev => ({
      ...prev,
      currentAmmo: prev.currentAmmo - 1,
      lastFireTime: now,
      recoilOffset: 0.15,
    }));

    // Recoil recovery
    if (recoilTimerRef.current) clearTimeout(recoilTimerRef.current);
    recoilTimerRef.current = setTimeout(() => {
      setWeaponState(prev => ({ ...prev, recoilOffset: 0 }));
    }, 120);

    return true;
  }, [reload]);

  /**
   * Attempt to upgrade the weapon. Returns the cost deducted (or 0 if upgrade failed).
   * The caller is responsible for checking/deducting points.
   */
  const upgradeWeapon = useCallback((currentPoints: number): { success: boolean; cost: number } => {
    const state = stateRef.current;
    if (state.upgradeTier >= 3) return { success: false, cost: 0 };
    const cost = UPGRADE_COSTS[state.upgradeTier];
    if (currentPoints < cost) return { success: false, cost };
    setWeaponState(prev => ({ ...prev, upgradeTier: prev.upgradeTier + 1 }));
    return { success: true, cost };
  }, []);

  /** Get the effective damage for the current weapon including upgrade multiplier */
  const getEffectiveDamage = useCallback((baseDamage: number): number => {
    const multiplier = UPGRADE_DAMAGE_MULTIPLIERS[stateRef.current.upgradeTier];
    return Math.round(baseDamage * multiplier);
  }, []);

  // Keyboard weapon switching
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '1') switchWeapon('pistol');
      if (e.key === '2') switchWeapon('shotgun');
      if (e.key === '3') switchWeapon('assault_rifle');
      if (e.key === 'r' || e.key === 'R') reload();
    };

    const handleWheel = (e: WheelEvent) => {
      const currentIdx = WEAPON_ORDER.indexOf(stateRef.current.currentWeapon);
      const dir = e.deltaY > 0 ? 1 : -1;
      const nextIdx = (currentIdx + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length;
      switchWeapon(WEAPON_ORDER[nextIdx]);
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [switchWeapon, reload]);

  return {
    weaponState,
    currentConfig: WEAPON_CONFIGS[weaponState.currentWeapon],
    tryFire,
    reload,
    switchWeapon,
    upgradeWeapon,
    getEffectiveDamage,
  };
}
