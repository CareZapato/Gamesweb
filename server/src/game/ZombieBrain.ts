import { Btn, DT, type InputCmd, PLAYER, TICK_RATE, wrapAngle } from '@arena/shared';
import type { GameSim, SimPlayer } from './GameSim';

/**
 * Melee AI for Reducto: Horda enemies. Same shape as `BotBrain` (one authoritative `InputCmd` per sim
 * tick) but there is no aiming or shooting: the zombie turns to the nearest living human, walks
 * forward and hits when in range. Movement goes through the normal `stepMovement`, so walls, ramps
 * and cover behave exactly as for players (run speed is scaled by `SimPlayer.speedMult`).
 */

export interface ZombieMemory {
  seq: number;
  /** Ticks until the next melee hit may land (counts down only while in range). */
  attackCd: number;
  /** Position last tick, to detect being stuck behind cover. */
  lastX: number;
  lastZ: number;
  stuckTicks: number;
  /** Strafe side while going around an obstacle, until `strafeUntil` (tick). */
  strafe: -1 | 0 | 1;
  strafeUntil: number;
}

export interface ZombieMelee {
  damage: number;
  /** Seconds between hits. */
  attackInterval: number;
  /** Meters, centre to centre on the ground plane. */
  attackRange: number;
  /** Horizontal push applied to the victim per hit (m/s). */
  knockback: number;
}

/** Vertical tolerance for a melee hit (a zombie at the foot of the ramp cannot hit the deck). */
const MELEE_REACH_Y = 1.6;
/** Fraction of the interval spent winding up after reaching a target, before the first hit. */
const WINDUP = 0.5;

export const newZombieMemory = (melee: ZombieMelee, x: number, z: number): ZombieMemory => ({
  seq: 0,
  attackCd: windupTicks(melee),
  lastX: x,
  lastZ: z,
  stuckTicks: 0,
  strafe: 0,
  strafeUntil: 0,
});

const windupTicks = (m: ZombieMelee): number => Math.max(1, Math.round(m.attackInterval * WINDUP * TICK_RATE));

const flatDist = (a: SimPlayer, b: SimPlayer): number => Math.hypot(a.sim.x - b.sim.x, a.sim.z - b.sim.z);

/** Nearest living, connected human (zombies never target each other nor absent players). */
export const pickZombieTarget = (sim: GameSim, z: SimPlayer): SimPlayer | null => {
  let best: SimPlayer | null = null;
  let bestD = Infinity;
  for (const o of sim.players.values()) {
    if (o.kind !== 'human' || !o.alive || !o.connected) continue;
    const d = flatDist(z, o);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
};

/** True when the zombie is close enough (and not too far above/below) to hit `target`. */
export const inMeleeRange = (z: SimPlayer, target: SimPlayer, melee: ZombieMelee): boolean =>
  flatDist(z, target) <= melee.attackRange && Math.abs(target.sim.y - z.sim.y) <= MELEE_REACH_Y;

/** Builds one authoritative input for a zombie (called once per sim tick). Also tracks being stuck. */
export const zombieInput = (sim: GameSim, z: SimPlayer, melee: ZombieMelee, mem: ZombieMemory, tick: number): InputCmd => {
  mem.seq++;
  let buttons = 0;
  let yaw = z.yaw;

  const target = z.alive ? pickZombieTarget(sim, z) : null;
  if (target) {
    const dx = target.sim.x - z.sim.x;
    const dz = target.sim.z - z.sim.z;
    yaw = wrapAngle(Math.atan2(-dx, -dz));

    // stand still once in reach: the attack, not the walk, decides what happens next
    const stopAt = melee.attackRange * 0.75;
    if (Math.hypot(dx, dz) > stopAt) {
      buttons |= Btn.Forward;

      const moved = Math.hypot(z.sim.x - mem.lastX, z.sim.z - mem.lastZ);
      const expected = PLAYER.runSpeed * z.speedMult * DT;
      mem.stuckTicks = moved < expected * 0.15 ? mem.stuckTicks + 1 : 0;
      if (mem.stuckTicks >= 8 && tick >= mem.strafeUntil) {
        // blocked by cover: sidestep a little (alternating by id) and hop over low edges
        mem.strafe = (tick + z.id) % 2 === 0 ? -1 : 1;
        mem.strafeUntil = tick + TICK_RATE * 0.6;
        mem.stuckTicks = 0;
      }
      if (tick < mem.strafeUntil) {
        buttons |= mem.strafe === 1 ? Btn.Right : Btn.Left;
        if (z.sim.onGround && (tick + z.id) % 9 === 0) buttons |= Btn.Jump;
      }
    } else {
      mem.stuckTicks = 0;
    }
  }
  mem.lastX = z.sim.x;
  mem.lastZ = z.sim.z;

  return { seq: mem.seq, buttons, yaw, pitch: 0, weapon: z.sim.weapon, viewTick: tick };
};

/**
 * Melee attack step (called once per tick after movement). Returns the hit target when a blow landed.
 * Damage goes through `GameSim.damage`, so shields, spawn protection and friendly rules all apply.
 */
export const zombieMelee = (sim: GameSim, z: SimPlayer, melee: ZombieMelee, mem: ZombieMemory): SimPlayer | null => {
  if (!z.alive) return null;
  const target = pickZombieTarget(sim, z);
  if (!target || !inMeleeRange(z, target, melee)) {
    mem.attackCd = windupTicks(melee);
    return null;
  }
  if (mem.attackCd > 0) {
    mem.attackCd--;
    return null;
  }
  mem.attackCd = Math.max(1, Math.round(melee.attackInterval * TICK_RATE));

  const dx = target.sim.x - z.sim.x;
  const dz = target.sim.z - z.sim.z;
  const len = Math.hypot(dx, dz) || 1;
  const at = { x: target.sim.x, y: target.sim.y + PLAYER.bodyTop * 0.6, z: target.sim.z };
  const from = { x: z.sim.x, y: z.sim.y + PLAYER.bodyTop * 0.6, z: z.sim.z };
  sim.damage(target, z.id, melee.damage, -1, 'body', at, from);
  if (melee.knockback > 0 && target.alive) {
    target.sim.vx += (dx / len) * melee.knockback;
    target.sim.vz += (dz / len) * melee.knockback;
  }
  return target;
};
