/**
 * Reducto: Horda — economía (scrap) y tienda entre oleadas. Determinista y sin Colyseus:
 * el servidor llama a estas funciones y envía el resultado; el cliente solo lo muestra.
 */
import { hash2, mulberry32 } from '../math';
import { ENEMY_ARCHETYPES, type EnemyArchetypeId } from './archetypes';

export const UPGRADE_IDS = [
  'maxHealth',
  'heal',
  'hitscanDamage',
  'explosionRadius',
  'fireRate',
  'reloadSpeed',
  'moveSpeed',
  'dashCooldown',
  'reserveAmmo',
  'ammoRefill',
  'waveShield',
  'unlockShotgun',
  'unlockSniper',
  'unlockRocket',
  'unlockGrenade',
  'unlockPlasma',
  'unlockCharge',
] as const;

export type UpgradeId = (typeof UPGRADE_IDS)[number];
export type UpgradeRarity = 'common' | 'rare';

export interface UpgradeDef {
  readonly id: UpgradeId;
  readonly label: string;
  readonly description: string;
  readonly rarity: UpgradeRarity;
  /** Coste de la primera compra. */
  readonly baseCost: number;
  /** Multiplicador de coste por cada stack ya comprado. */
  readonly costGrowth: number;
  /** Tope de stacks (para consumibles: tope de compras por oleada, ver `perWave`). */
  readonly maxStack: number;
  /** Efecto por stack (fracción o puntos según la mejora; ver `description`). */
  readonly perStack: number;
  /** Efecto inmediato sin acumulación permanente (curar, munición). No ocupa slot de build. */
  readonly consumable: boolean;
  /** Los stacks se reinician al empezar cada oleada (ver `resetPerWaveStacks`). */
  readonly perWave: boolean;
}

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDef>> = {
  maxHealth: {
    id: 'maxHealth',
    label: '+Vida máxima',
    description: '+20 vida máxima por nivel',
    rarity: 'common',
    baseCost: 40,
    costGrowth: 1.35,
    maxStack: 8,
    perStack: 20,
    consumable: false,
    perWave: false,
  },
  heal: {
    id: 'heal',
    label: 'Curación',
    description: 'Restaura toda la vida al instante',
    rarity: 'common',
    baseCost: 35,
    costGrowth: 1,
    maxStack: 1,
    perStack: 1,
    consumable: true,
    perWave: true,
  },
  hitscanDamage: {
    id: 'hitscanDamage',
    label: '+Daño de bala',
    description: '+10% daño hitscan por nivel',
    rarity: 'common',
    baseCost: 60,
    costGrowth: 1.4,
    maxStack: 10,
    perStack: 0.1,
    consumable: false,
    perWave: false,
  },
  explosionRadius: {
    id: 'explosionRadius',
    label: '+Radio de explosión',
    description: '+10% radio de explosión por nivel',
    rarity: 'common',
    baseCost: 60,
    costGrowth: 1.4,
    maxStack: 6,
    perStack: 0.1,
    consumable: false,
    perWave: false,
  },
  fireRate: {
    id: 'fireRate',
    label: '+Cadencia',
    description: '-6% intervalo de disparo por nivel',
    rarity: 'common',
    baseCost: 70,
    costGrowth: 1.4,
    maxStack: 8,
    perStack: 0.06,
    consumable: false,
    perWave: false,
  },
  reloadSpeed: {
    id: 'reloadSpeed',
    label: '-Tiempo de recarga',
    description: '-8% tiempo de recarga por nivel',
    rarity: 'common',
    baseCost: 50,
    costGrowth: 1.35,
    maxStack: 6,
    perStack: 0.08,
    consumable: false,
    perWave: false,
  },
  moveSpeed: {
    id: 'moveSpeed',
    label: '+Velocidad',
    description: '+4% velocidad de movimiento por nivel',
    rarity: 'common',
    baseCost: 55,
    costGrowth: 1.35,
    maxStack: 6,
    perStack: 0.04,
    consumable: false,
    perWave: false,
  },
  dashCooldown: {
    id: 'dashCooldown',
    label: '-Cooldown de dash',
    description: '-8% cooldown de dash por nivel',
    rarity: 'common',
    baseCost: 55,
    costGrowth: 1.35,
    maxStack: 5,
    perStack: 0.08,
    consumable: false,
    perWave: false,
  },
  reserveAmmo: {
    id: 'reserveAmmo',
    label: '+Munición de reserva',
    description: '+20% munición de reserva por nivel',
    rarity: 'common',
    baseCost: 40,
    costGrowth: 1.3,
    maxStack: 6,
    perStack: 0.2,
    consumable: false,
    perWave: false,
  },
  ammoRefill: {
    id: 'ammoRefill',
    label: 'Recarga de munición',
    description: 'Rellena 50% de la munición de reserva',
    rarity: 'common',
    baseCost: 25,
    costGrowth: 1,
    maxStack: 1,
    perStack: 0.5,
    consumable: true,
    perWave: true,
  },
  waveShield: {
    id: 'waveShield',
    label: 'Escudo de oleada',
    description: '+40 escudo solo durante la siguiente oleada',
    rarity: 'common',
    baseCost: 45,
    costGrowth: 1.5,
    maxStack: 2,
    perStack: 40,
    consumable: true,
    perWave: true,
  },
  unlockShotgun: {
    id: 'unlockShotgun',
    label: 'Escopeta permanente',
    description: 'Desbloquea la escopeta para el resto de la partida',
    rarity: 'rare',
    baseCost: 220,
    costGrowth: 1,
    maxStack: 1,
    perStack: 1,
    consumable: false,
    perWave: false,
  },
  unlockSniper: {
    id: 'unlockSniper',
    label: 'Fusil de precisión',
    description: 'Desbloquea el fusil de precisión para el resto de la partida',
    rarity: 'rare',
    baseCost: 280,
    costGrowth: 1,
    maxStack: 1,
    perStack: 1,
    consumable: false,
    perWave: false,
  },
  unlockRocket: {
    id: 'unlockRocket',
    label: 'Lanzacohetes',
    description: 'Desbloquea el lanzacohetes para el resto de la partida',
    rarity: 'rare',
    baseCost: 320,
    costGrowth: 1,
    maxStack: 1,
    perStack: 1,
    consumable: false,
    perWave: false,
  },
  unlockGrenade: {
    id: 'unlockGrenade',
    label: 'Lanzagranadas',
    description: 'Desbloquea el lanzagranadas para el resto de la partida',
    rarity: 'rare',
    baseCost: 300,
    costGrowth: 1,
    maxStack: 1,
    perStack: 1,
    consumable: false,
    perWave: false,
  },
  unlockPlasma: {
    id: 'unlockPlasma',
    label: 'Plasma',
    description: 'Desbloquea el arma de plasma para el resto de la partida',
    rarity: 'rare',
    baseCost: 340,
    costGrowth: 1,
    maxStack: 1,
    perStack: 1,
    consumable: false,
    perWave: false,
  },
  unlockCharge: {
    id: 'unlockCharge',
    label: 'Cañón de carga',
    description: 'Desbloquea el cañón de carga para el resto de la partida',
    rarity: 'rare',
    baseCost: 360,
    costGrowth: 1,
    maxStack: 1,
    perStack: 1,
    consumable: false,
    perWave: false,
  },
};

/** Stacks comprados por mejora. Los ids ausentes valen 0. */
export type OwnedUpgrades = Partial<Record<UpgradeId, number>>;

export const stacksOf = (owned: OwnedUpgrades, id: UpgradeId): number => owned[id] ?? 0;

/** Efecto acumulado de una mejora (stacks * perStack). */
export const upgradeBonus = (owned: OwnedUpgrades, id: UpgradeId): number =>
  stacksOf(owned, id) * UPGRADES[id].perStack;

export const isMaxed = (owned: OwnedUpgrades, id: UpgradeId): boolean =>
  stacksOf(owned, id) >= UPGRADES[id].maxStack;

/** Coste de la siguiente compra de `id` dado lo que ya se tiene. */
export const upgradeCost = (id: UpgradeId, stacks: number): number => {
  const u = UPGRADES[id];
  return Math.round(u.baseCost * u.costGrowth ** Math.max(0, stacks));
};

// ---------- Moneda (scrap) ----------

export const SCRAP = {
  /** +5% de scrap por baja por cada oleada. */
  killWaveBonus: 0.05,
  clearBase: 20,
  clearPerWave: 5,
} as const;

/** Scrap por baja: valor del arquetipo escalado por la oleada. */
export const scrapForKill = (id: EnemyArchetypeId, wave: number): number =>
  Math.round(ENEMY_ARCHETYPES[id].scrap * (1 + Math.max(0, wave) * SCRAP.killWaveBonus));

/** Bonus por limpiar la oleada. */
export const waveClearBonus = (wave: number): number =>
  Math.max(0, SCRAP.clearBase + Math.floor(wave) * SCRAP.clearPerWave);

// ---------- Tienda ----------

export interface ShopOffer {
  readonly id: UpgradeId;
  readonly cost: number;
  /** Stacks que ya tiene el jugador (para mostrar "nivel N → N+1"). */
  readonly stacks: number;
  readonly rarity: UpgradeRarity;
}

/** Cada cuántas oleadas la tienda ofrece la mejora rara. */
export const RARE_EVERY = 5;

/** Cantidad de ofertas: 3 al inicio, 4 desde la oleada 10, 5 desde la 20. */
export const offerCount = (wave: number): number => 3 + (wave >= 10 ? 1 : 0) + (wave >= 20 ? 1 : 0);

/** Mejora elegible: no ha llegado a su tope. */
export const isOfferable = (owned: OwnedUpgrades, id: UpgradeId): boolean => !isMaxed(owned, id);

/**
 * Genera las ofertas de la tienda tras la oleada `wave`. Determinista para (wave, seed, owned).
 * - Nunca ofrece una mejora que ya está en su tope ni la repite en la misma tienda.
 * - Cada `RARE_EVERY` oleadas incluye una mejora rara si queda alguna disponible.
 */
export const SPECIAL_SHOP_COST_MULT = 0.72;

export const generateShopOffers = (
  wave: number,
  owned: OwnedUpgrades,
  seed = 0,
  opts?: { elite?: boolean },
): ShopOffer[] => {
  const w = Math.max(1, Math.floor(wave));
  const count = offerCount(w);
  const rng = mulberry32(hash2(w, seed ^ 0x5eed));
  const eligible = UPGRADE_IDS.filter((id) => isOfferable(owned, id));
  const rares = eligible.filter((id) => UPGRADES[id].rarity === 'rare');
  const commons = eligible.filter((id) => UPGRADES[id].rarity === 'common');

  const picked: UpgradeId[] = [];
  if (w % RARE_EVERY === 0 && rares.length > 0) {
    picked.push(rares[Math.floor(rng() * rares.length)]!);
  }
  if (w >= 2) {
    const weaponUnlocks = eligible.filter((id) => id.startsWith('unlock') && !picked.includes(id));
    if (weaponUnlocks.length > 0 && rng() < 0.55) {
      picked.push(weaponUnlocks[Math.floor(rng() * weaponUnlocks.length)]!);
    }
  }
  // Fisher-Yates parcial sobre las comunes.
  const pool = [...commons];
  while (picked.length < count && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    picked.push(pool[i]!);
    pool.splice(i, 1);
  }
  const elite = opts?.elite ?? false;
  return picked.map((id) => {
    const stacks = stacksOf(owned, id);
    let cost = upgradeCost(id, stacks);
    if (elite) cost = Math.max(1, Math.round(cost * SPECIAL_SHOP_COST_MULT));
    return { id, cost, stacks, rarity: UPGRADES[id].rarity };
  });
};

export interface PurchaseState {
  scrap: number;
  owned: OwnedUpgrades;
}

export type PurchaseResult =
  | { ok: true; state: PurchaseState; cost: number }
  | { ok: false; reason: 'maxed' | 'funds' };

/** Intenta comprar `id`. No muta `state`: devuelve el nuevo estado o el motivo del rechazo. */
export const tryPurchase = (state: PurchaseState, id: UpgradeId): PurchaseResult => {
  if (isMaxed(state.owned, id)) return { ok: false, reason: 'maxed' };
  const cost = upgradeCost(id, stacksOf(state.owned, id));
  if (state.scrap < cost) return { ok: false, reason: 'funds' };
  return {
    ok: true,
    cost,
    state: { scrap: state.scrap - cost, owned: { ...state.owned, [id]: stacksOf(state.owned, id) + 1 } },
  };
};

/** Al empezar una oleada se reinician las mejoras `perWave` (escudo de oleada, curación, munición). */
export const resetPerWaveStacks = (owned: OwnedUpgrades): OwnedUpgrades => {
  const next: OwnedUpgrades = {};
  for (const id of UPGRADE_IDS) {
    const n = owned[id];
    if (n && !UPGRADES[id].perWave) next[id] = n;
  }
  return next;
};
