import type { MapDef } from '../map';
import type { OwnedUpgrades } from './shop';
import { deadholdUnlockedWeapons } from './weapons';
import { WeaponId } from '../weapons';

/** Índices de `map.pickups` que son cajas de munición (supervivencia). */
export const survivalAmmoPickupIndices = (map: MapDef): number[] => {
  const out: number[] = [];
  map.pickups.forEach((p, i) => {
    if (p.kind === 'ammo') out.push(i);
  });
  return out;
};

/** Unión de armas desbloqueadas del equipo (siempre incluye rifle). */
export const deadholdTeamUnlockedWeapons = (ownedByPlayer: readonly OwnedUpgrades[]): number[] => {
  const set = new Set<number>([WeaponId.Rifle]);
  for (const owned of ownedByPlayer) {
    for (const w of deadholdUnlockedWeapons(owned)) set.add(w);
  }
  return [...set].sort((a, b) => a - b);
};
