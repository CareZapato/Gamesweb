import { PLAYER } from '../constants';
import { UPGRADES, stacksOf, upgradeBonus, type OwnedUpgrades } from './shop';
import { WEAPON_UNLOCK_UPGRADES, type WeaponUnlockUpgradeId } from './weapons';

export interface BuildStatLine {
  label: string;
  value: string;
}

/** Resumen legible de mejoras permanentes (Tab en supervivencia). */
export const deadholdBuildStats = (owned: OwnedUpgrades): BuildStatLine[] => {
  const lines: BuildStatLine[] = [];
  const maxHp = PLAYER.maxHealth + upgradeBonus(owned, 'maxHealth');
  if (maxHp > PLAYER.maxHealth) {
    lines.push({ label: 'Vida máxima', value: `${maxHp} (+${maxHp - PLAYER.maxHealth})` });
  }
  const dmgPct = Math.round(upgradeBonus(owned, 'hitscanDamage') * 100);
  if (dmgPct > 0) lines.push({ label: 'Daño hitscan', value: `+${dmgPct}%` });
  const movePct = Math.round(upgradeBonus(owned, 'moveSpeed') * 100);
  if (movePct > 0) lines.push({ label: 'Velocidad', value: `+${movePct}%` });
  const firePct = Math.round(upgradeBonus(owned, 'fireRate') * 100);
  if (firePct > 0) lines.push({ label: 'Cadencia', value: `+${firePct}%` });
  const ammoPct = Math.round(upgradeBonus(owned, 'reserveAmmo') * 100);
  if (ammoPct > 0) lines.push({ label: 'Munición reserva', value: `+${ammoPct}%` });
  const dashPct = Math.round(upgradeBonus(owned, 'dashCooldown') * 100);
  if (dashPct > 0) lines.push({ label: 'Dash', value: `-${dashPct}% CD` });
  const explPct = Math.round(upgradeBonus(owned, 'explosionRadius') * 100);
  if (explPct > 0) lines.push({ label: 'Radio explosión', value: `+${explPct}%` });

  const weapons: string[] = [];
  for (const [id, wid] of Object.entries(WEAPON_UNLOCK_UPGRADES) as [WeaponUnlockUpgradeId, number][]) {
    if ((owned[id] ?? 0) > 0) weapons.push(UPGRADES[id].label.replace(/ permanente$/i, ''));
  }
  if (weapons.length > 0) lines.push({ label: 'Armas', value: weapons.join(', ') });

  const waveSh = stacksOf(owned, 'waveShield');
  if (waveSh > 0) {
    lines.push({
      label: 'Escudo de oleada (próx.)',
      value: `+${Math.round(upgradeBonus(owned, 'waveShield'))} escudo`,
    });
  }

  if (lines.length === 0) lines.push({ label: 'Build', value: 'Sin mejoras permanentes aún' });
  return lines;
};
