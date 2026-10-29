import { describe, expect, it } from 'vitest';
import {
  activeArchetypes,
  damageMult,
  drainSpawnQueue,
  ENEMY_ARCHETYPES,
  ENEMY_ARCHETYPE_IDS,
  enemiesInWave,
  generateShopOffers,
  hpMult,
  isMaxed,
  offerCount,
  planWave,
  resetPerWaveStacks,
  scaledEnemyStats,
  scrapForKill,
  speedMult,
  spawnBudget,
  tryPurchase,
  UPGRADES,
  UPGRADE_IDS,
  upgradeCost,
  waveClearBonus,
  WAVES,
  type OwnedUpgrades,
  WeaponId,
  deadholdCanSelectWeapon,
  deadholdResolveInputWeapon,
} from '@arena/shared';

describe('deadhold: oleadas', () => {
  it('enemigos por oleada 1, 5, 10 y 25 (valores fijos)', () => {
    expect(enemiesInWave(1)).toBe(4);
    expect(enemiesInWave(5)).toBe(12); // 11 base + 1 especial
    expect(enemiesInWave(10)).toBe(21); // 20 base + 1 especial
    expect(enemiesInWave(25)).toBe(50); // 49 base + 1 jefe
    expect(enemiesInWave(0)).toBe(0);
  });

  it('el conteo crece de forma monótona (salvo el especial de cada 5)', () => {
    for (let n = 1; n < 60; n++) expect(enemiesInWave(n + 1)).toBeGreaterThanOrEqual(enemiesInWave(n) - 1);
  });

  it('multiplicadores de vida, daño y velocidad (velocidad con tope)', () => {
    expect(hpMult(1)).toBeCloseTo(1.12);
    expect(hpMult(10)).toBeCloseTo(2.2);
    expect(damageMult(10)).toBeCloseTo(1.4);
    expect(speedMult(10)).toBeCloseTo(1.2);
    expect(speedMult(25)).toBeCloseTo(1.5);
    expect(speedMult(500)).toBe(WAVES.maxSpeedMult);
  });

  it('arquetipos desbloqueados por oleada', () => {
    const ids = (n: number) => activeArchetypes(n).map((a) => a.id);
    expect(ids(1)).toEqual(['walker']);
    expect(ids(3)).toEqual(['walker', 'runner']);
    expect(ids(8)).toEqual(['walker', 'runner', 'brute']);
    expect(ids(15)).toEqual(['walker', 'runner', 'brute', 'armored']);
    expect(ids(25)).toEqual([...ENEMY_ARCHETYPE_IDS]);
  });

  it('estadísticas escaladas por arquetipo', () => {
    const w1 = scaledEnemyStats('walker', 1);
    expect(w1.hp).toBe(Math.round(ENEMY_ARCHETYPES.walker.hp * 1.12));
    expect(scaledEnemyStats('armored', 15).shield).toBeGreaterThan(ENEMY_ARCHETYPES.armored.shield);
    expect(scaledEnemyStats('walker', 1).shield).toBe(0);
  });

  it('planWave: tamaño correcto, determinista y solo arquetipos desbloqueados', () => {
    for (const n of [1, 5, 10, 25]) {
      const plan = planWave(n, 7);
      expect(plan).toHaveLength(enemiesInWave(n));
      expect(planWave(n, 7)).toEqual(plan);
      const allowed = new Set(activeArchetypes(n).map((a) => a.id));
      for (const id of plan) expect(allowed.has(id)).toBe(true);
    }
    expect(new Set(planWave(1, 1))).toEqual(new Set(['walker']));
  });

  it('especial garantizado cada 5 oleadas; coloso desde la 25', () => {
    expect(planWave(4).at(-1)).not.toBe('colossus');
    expect(planWave(10).at(-1)).toBe('brute');
    expect(planWave(5)).toHaveLength(12);
    expect(planWave(25).at(-1)).toBe('colossus');
    expect(planWave(30).filter((id) => id === 'colossus')).toHaveLength(1);
    expect(planWave(24).includes('colossus')).toBe(false);
  });

  it('cola de spawn respeta maxAlive', () => {
    expect(spawnBudget(0, 50, 40)).toBe(40);
    expect(spawnBudget(38, 50, 40)).toBe(2);
    expect(spawnBudget(40, 10, 40)).toBe(0);
    expect(spawnBudget(45, 10, 40)).toBe(0);
    expect(spawnBudget(0, 3, 40)).toBe(3);

    const queue = planWave(25, 3);
    const { spawn, rest } = drainSpawnQueue(queue, 10, WAVES.maxAlive);
    expect(spawn).toHaveLength(30);
    expect(rest).toHaveLength(queue.length - 30);
    expect([...spawn, ...rest]).toEqual(queue);
  });
});

describe('deadhold: moneda y tienda', () => {
  it('scrap por baja y bonus de oleada', () => {
    expect(scrapForKill('walker', 0)).toBe(5);
    expect(scrapForKill('walker', 10)).toBe(8); // 5 * 1.5 = 7.5 -> 8
    expect(scrapForKill('colossus', 25)).toBeGreaterThan(scrapForKill('brute', 25));
    expect(waveClearBonus(1)).toBe(25);
    expect(waveClearBonus(10)).toBe(70);
  });

  it('coste sube con los stacks', () => {
    expect(upgradeCost('maxHealth', 0)).toBe(40);
    expect(upgradeCost('maxHealth', 1)).toBeGreaterThan(upgradeCost('maxHealth', 0));
    expect(upgradeCost('heal', 0)).toBe(upgradeCost('heal', 5));
  });

  it('3–5 ofertas según oleada, sin repetir', () => {
    expect(offerCount(1)).toBe(3);
    expect(offerCount(10)).toBe(4);
    expect(offerCount(20)).toBe(5);
    for (const w of [1, 5, 10, 25]) {
      const offers = generateShopOffers(w, {}, 42);
      expect(offers).toHaveLength(offerCount(w));
      expect(new Set(offers.map((o) => o.id)).size).toBe(offers.length);
    }
  });

  it('ofertas deterministas para (oleada, semilla, build)', () => {
    expect(generateShopOffers(7, { maxHealth: 2 }, 9)).toEqual(generateShopOffers(7, { maxHealth: 2 }, 9));
    expect(generateShopOffers(7, {}, 1)).not.toEqual(generateShopOffers(7, {}, 2));
  });

  it('nunca ofrece mejoras en su tope', () => {
    const owned: OwnedUpgrades = {};
    for (const id of UPGRADE_IDS) if (UPGRADES[id].rarity === 'common') owned[id] = UPGRADES[id].maxStack;
    owned.maxHealth = 3; // única común disponible
    for (let w = 1; w <= 30; w++) {
      for (let seed = 0; seed < 5; seed++) {
        for (const o of generateShopOffers(w, owned, seed)) {
          expect(isMaxed(owned, o.id)).toBe(false);
        }
      }
    }
    const offers = generateShopOffers(1, owned, 0);
    expect(offers.map((o) => o.id)).toEqual(['maxHealth']);
    expect(offers[0]!.cost).toBe(upgradeCost('maxHealth', 3));
  });

  it('la mejora rara aparece cada 5 oleadas y no tras comprarla', () => {
    expect(generateShopOffers(5, {}, 1).some((o) => o.id === 'unlockShotgun')).toBe(true);
    expect(generateShopOffers(10, {}, 1).some((o) => o.id === 'unlockShotgun')).toBe(true);
    expect(generateShopOffers(4, {}, 1).some((o) => o.id === 'unlockShotgun')).toBe(false);
    expect(generateShopOffers(5, { unlockShotgun: 1 }, 1).some((o) => o.id === 'unlockShotgun')).toBe(false);
  });

  it('tryPurchase: gasta scrap, suma stack y respeta tope y fondos', () => {
    const r = tryPurchase({ scrap: 100, owned: {} }, 'maxHealth');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.scrap).toBe(60);
    expect(r.state.owned.maxHealth).toBe(1);

    expect(tryPurchase({ scrap: 10, owned: {} }, 'maxHealth')).toEqual({ ok: false, reason: 'funds' });
    expect(tryPurchase({ scrap: 9999, owned: { unlockShotgun: 1 } }, 'unlockShotgun')).toEqual({
      ok: false,
      reason: 'maxed',
    });
  });

  it('resetPerWaveStacks conserva solo mejoras permanentes', () => {
    expect(resetPerWaveStacks({ maxHealth: 2, waveShield: 2, heal: 1 })).toEqual({ maxHealth: 2 });
  });
});

describe('deadhold: armas en input', () => {
  it('solo rifle hasta desbloquear escopeta', () => {
    expect(deadholdCanSelectWeapon(WeaponId.Rifle, false)).toBe(true);
    expect(deadholdCanSelectWeapon(WeaponId.Shotgun, false)).toBe(false);
    expect(deadholdCanSelectWeapon(WeaponId.Rocket, false)).toBe(false);
    expect(deadholdCanSelectWeapon(WeaponId.Shotgun, true)).toBe(true);
  });

  it('resolve mantiene el arma actual si el pedido no está permitido', () => {
    expect(deadholdResolveInputWeapon(WeaponId.Sniper, WeaponId.Rifle, false)).toBe(WeaponId.Rifle);
    expect(deadholdResolveInputWeapon(WeaponId.Shotgun, WeaponId.Rifle, true)).toBe(WeaponId.Shotgun);
  });
});
