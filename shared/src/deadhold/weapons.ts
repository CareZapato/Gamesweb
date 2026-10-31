import type { OwnedUpgrades } from './shop';
import { isValidWeapon, WeaponId, WEAPON_COUNT } from '../weapons';

/** Mejoras de tienda que desbloquean un arma (permanentes). */
export const WEAPON_UNLOCK_UPGRADES = {
  unlockShotgun: WeaponId.Shotgun,
  unlockSniper: WeaponId.Sniper,
  unlockRocket: WeaponId.Rocket,
  unlockGrenade: WeaponId.Grenade,
  unlockPlasma: WeaponId.Plasma,
  unlockCharge: WeaponId.Charge,
} as const;

export type WeaponUnlockUpgradeId = keyof typeof WEAPON_UNLOCK_UPGRADES;

export const isWeaponUnlockUpgrade = (id: string): id is WeaponUnlockUpgradeId =>
  id in WEAPON_UNLOCK_UPGRADES;

/** Armas usables según lo comprado en tienda (siempre incluye rifle). */
export const deadholdUnlockedWeapons = (owned: OwnedUpgrades): ReadonlySet<number> => {
  const out = new Set<number>([WeaponId.Rifle]);
  for (const [upgradeId, weaponId] of Object.entries(WEAPON_UNLOCK_UPGRADES) as [WeaponUnlockUpgradeId, number][]) {
    if ((owned[upgradeId] ?? 0) > 0) out.add(weaponId);
  }
  return out;
};

export const deadholdCanSelectWeapon = (weapon: number, unlocked: ReadonlySet<number>): boolean =>
  isValidWeapon(weapon) && unlocked.has(weapon);

/** Misma regla que el servidor al recibir input: arma no permitida → mantener la actual. */
export const deadholdResolveInputWeapon = (
  requested: number,
  current: number,
  unlocked: ReadonlySet<number>,
): number => (deadholdCanSelectWeapon(requested, unlocked) ? requested : current);

/** Para el HUD: una ranura por arma del juego. */
export const deadholdWeaponSlotOwned = (owned: OwnedUpgrades): boolean[] => {
  const unlocked = deadholdUnlockedWeapons(owned);
  return Array.from({ length: WEAPON_COUNT }, (_, i) => unlocked.has(i));
};
