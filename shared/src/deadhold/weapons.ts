import { isValidWeapon, WeaponId } from '../weapons';

/** Armas seleccionables en Reducto: Horda (debe coincidir con `WaveDirector.canUseWeapon`). */
export const deadholdCanSelectWeapon = (weapon: number, hasShotgun: boolean): boolean => {
  if (!isValidWeapon(weapon)) return false;
  if (weapon === WeaponId.Rifle) return true;
  if (weapon === WeaponId.Shotgun) return hasShotgun;
  return false;
};

/** Misma regla que el servidor al recibir input: arma no permitida → mantener la actual. */
export const deadholdResolveInputWeapon = (requested: number, current: number, hasShotgun: boolean): number =>
  deadholdCanSelectWeapon(requested, hasShotgun) ? requested : current;
