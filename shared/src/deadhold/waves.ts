/**
 * Reducto: Horda — escalado numérico por oleada. Todo es determinista (sin Math.random, sin tiempo):
 * mismos parámetros => mismo resultado, para que servidor y tests coincidan. Sin dependencias de Colyseus.
 */
import { hash2, mulberry32 } from '../math';
import {
  activeArchetypes,
  ENEMY_ARCHETYPES,
  type EnemyArchetype,
  type EnemyArchetypeId,
} from './archetypes';

export const WAVES = {
  baseCount: 3,
  countPerWave: 1.2,
  burst: 0.4,
  /** Exponente de la componente "burst": floor(n^burstExp). */
  burstExp: 1.15,
  hpPerWave: 0.12,
  dmgPerWave: 0.04,
  speedPerWave: 0.02,
  maxSpeedMult: 1.6,
  /** Cada cuántas oleadas hay un enemigo especial garantizado. */
  specialEvery: 5,
  /** Tope de enemigos vivos a la vez (plan free de Render); el resto espera en cola. */
  maxAlive: 40,
} as const;

/** Enemigos "base" de la oleada (sin el especial garantizado). */
const baseEnemies = (n: number): number =>
  Math.floor(WAVES.baseCount + n * WAVES.countPerWave + Math.floor(n ** WAVES.burstExp) * WAVES.burst);

/** Oleadas 5, 10, 15... incluyen mini-jefes y recompensas de tienda reforzadas. */
export const isSpecialWave = (n: number): boolean => n >= WAVES.specialEvery && n % WAVES.specialEvery === 0;

/** Mini-jefes extra en oleadas especiales (coloso cuenta como el último en oleada 25+). */
export const specialBossCount = (n: number): number => {
  if (!isSpecialWave(n)) return 0;
  const w = Math.floor(n);
  if (w >= 25) return 3;
  if (w >= 15) return 3;
  return 2;
};

/** Total de enemigos de la oleada `n` (>=1), incluidos mini-jefes. */
export const enemiesInWave = (n: number): number => {
  if (!Number.isFinite(n) || n < 1) return 0;
  const w = Math.floor(n);
  return baseEnemies(w) + specialBossCount(w);
};

export const hpMult = (n: number): number => 1 + Math.max(0, n) * WAVES.hpPerWave;
export const damageMult = (n: number): number => 1 + Math.max(0, n) * WAVES.dmgPerWave;
export const speedMult = (n: number): number =>
  Math.min(WAVES.maxSpeedMult, 1 + Math.max(0, n) * WAVES.speedPerWave);

export interface ScaledEnemyStats {
  hp: number;
  shield: number;
  damage: number;
  speed: number;
}

/** Estadísticas finales de un enemigo del arquetipo `id` en la oleada `n`. */
export const scaledEnemyStats = (id: EnemyArchetypeId, n: number): ScaledEnemyStats => {
  const a = ENEMY_ARCHETYPES[id];
  return {
    hp: Math.round(a.hp * hpMult(n)),
    shield: Math.round(a.shield * hpMult(n)),
    damage: Math.round(a.damage * damageMult(n)),
    speed: Math.round(a.speed * speedMult(n) * 100) / 100,
  };
};

/** Pool de mini-jefes para la oleada `n` (no entran en el spawn aleatorio normal). */
const specialBossPool = (n: number): EnemyArchetype[] => {
  const w = Math.floor(n);
  const ids: EnemyArchetypeId[] = [];
  if (w >= 5) ids.push('overlord');
  if (w >= 8) ids.push('brute');
  if (w >= 15) ids.push('armored');
  if (w >= 25) ids.push('colossus');
  return ids.map((id) => ENEMY_ARCHETYPES[id]);
};

const pickSpecialBoss = (n: number, index: number, total: number): EnemyArchetypeId => {
  const w = Math.floor(n);
  const pool = specialBossPool(w);
  if (w >= 25 && index === total - 1) return 'colossus';
  return pool[Math.min(index, pool.length - 1)]!.id;
};

/**
 * Composición determinista de la oleada `n`: lista ordenada de arquetipos a spawnear.
 * `seed` (semilla de la partida) varía la mezcla entre partidas sin romper la reproducibilidad.
 * El especial garantizado va siempre al final.
 */
export const planWave = (n: number, seed = 0): EnemyArchetypeId[] => {
  const total = enemiesInWave(n);
  if (total === 0) return [];
  const w = Math.floor(n);
  const bosses = specialBossCount(w);
  const regular = total - bosses;
  const pool = activeArchetypes(w).filter((a) => a.weight > 0);
  const totalWeight = pool.reduce((s, a) => s + a.weight, 0);
  const rng = mulberry32(hash2(w, seed));
  const out: EnemyArchetypeId[] = [];
  for (let i = 0; i < regular; i++) {
    let r = rng() * totalWeight;
    let pick = pool[0]!;
    for (const a of pool) {
      r -= a.weight;
      if (r < 0) {
        pick = a;
        break;
      }
    }
    out.push(pick.id);
  }
  for (let i = 0; i < bosses; i++) out.push(pickSpecialBoss(w, i, bosses));
  return out;
};

/** Cuántos enemigos de la cola pueden entrar ahora sin superar `maxAlive`. */
export const spawnBudget = (alive: number, queued: number, maxAlive: number = WAVES.maxAlive): number =>
  Math.max(0, Math.min(queued, maxAlive - alive));

/**
 * Saca de la cola (en orden) los enemigos que caben bajo el tope de vivos.
 * No muta `queue`: devuelve lo que spawnea ahora y lo que sigue esperando.
 */
export const drainSpawnQueue = (
  queue: readonly EnemyArchetypeId[],
  alive: number,
  maxAlive: number = WAVES.maxAlive,
): { spawn: EnemyArchetypeId[]; rest: EnemyArchetypeId[] } => {
  const k = spawnBudget(alive, queue.length, maxAlive);
  return { spawn: queue.slice(0, k), rest: queue.slice(k) };
};
