import {
  Btn,
  type BotDifficulty,
  dist3,
  eyePosition,
  type InputCmd,
  wrapAngle,
  WeaponId,
} from '@arena/shared';
import type { GameSim, SimPlayer } from './GameSim';

export interface BotMemory {
  seq: number;
  targetId: number;
  aimYaw: number;
  aimPitch: number;
  strafe: -1 | 0 | 1;
  strafeUntil: number;
}

const DIFF: Record<
  BotDifficulty,
  { aimErr: number; reactSec: number; maxRange: number; adsRange: number; fireAngle: number; strafePeriod: number }
> = {
  easy: { aimErr: 0.14, reactSec: 0.35, maxRange: 22, adsRange: 14, fireAngle: 0.2, strafePeriod: 2.4 },
  normal: { aimErr: 0.07, reactSec: 0.18, maxRange: 32, adsRange: 22, fireAngle: 0.12, strafePeriod: 1.6 },
  hard: { aimErr: 0.03, reactSec: 0.08, maxRange: 42, adsRange: 30, fireAngle: 0.06, strafePeriod: 1.1 },
};

const isEnemy = (sim: GameSim, a: SimPlayer, b: SimPlayer): boolean => {
  if (a.id === b.id || !b.alive) return false;
  if (sim.isTeamMode) return a.team !== b.team;
  return true;
};

const pickTarget = (sim: GameSim, bot: SimPlayer): SimPlayer | null => {
  let best: SimPlayer | null = null;
  let bestD = Infinity;
  for (const o of sim.players.values()) {
    if (!isEnemy(sim, bot, o)) continue;
    const d = dist3(bot.sim, o.sim);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
};

const aimAt = (from: SimPlayer, target: SimPlayer, err: number, mem: BotMemory, tick: number, reactSec: number): void => {
  const eye = eyePosition(from.sim);
  const te = eyePosition(target.sim);
  const dx = te.x - eye.x;
  const dy = te.y - eye.y;
  const dz = te.z - eye.z;
  const horiz = Math.hypot(dx, dz);
  const wantYaw = Math.atan2(-dx, -dz);
  const wantPitch = Math.atan2(dy, horiz);
  const jitter = err * (0.6 + 0.4 * Math.sin(tick * 0.07 + from.id));
  if (mem.targetId !== target.id) {
    mem.targetId = target.id;
    mem.aimYaw = from.yaw;
    mem.aimPitch = from.pitch;
  }
  const k = Math.min(1, 1 / (reactSec * 30));
  mem.aimYaw = wrapAngle(mem.aimYaw + (wantYaw - mem.aimYaw) * k + jitter * 0.02);
  mem.aimPitch = mem.aimPitch + (wantPitch - mem.aimPitch) * k + jitter * 0.015;
};

/** Builds one authoritative input for a bot (called once per sim tick). */
export const botInput = (sim: GameSim, bot: SimPlayer, difficulty: BotDifficulty, mem: BotMemory, tick: number): InputCmd => {
  mem.seq++;
  const cfg = DIFF[difficulty];
  let buttons = 0;
  let weapon = bot.sim.weapon;
  let yaw = bot.yaw;
  let pitch = bot.pitch;

  if (bot.alive) {
    const target = pickTarget(sim, bot);
    if (target) {
      aimAt(bot, target, cfg.aimErr, mem, tick, cfg.reactSec);
      yaw = mem.aimYaw;
      pitch = mem.aimPitch;
      const d = dist3(bot.sim, target.sim);
      const toTarget = Math.atan2(target.sim.x - bot.sim.x, target.sim.z - bot.sim.z);
      const rel = wrapAngle(toTarget - yaw);
      const forward = Math.abs(rel) < Math.PI / 2;

      if (tick >= mem.strafeUntil) {
        mem.strafe = (tick + bot.id) % 3 === 0 ? -1 : 1;
        mem.strafeUntil = tick + Math.floor(cfg.strafePeriod * 30);
      }

      if (d > 6 && forward) buttons |= Btn.Forward;
      else if (d < 3) buttons |= Btn.Back;
      else buttons |= mem.strafe === 1 ? Btn.Right : Btn.Left;

      if (d > 14 && bot.sim.onGround && (tick + bot.id) % 47 === 0) buttons |= Btn.Jump;

      if (d < 8) weapon = WeaponId.Shotgun;
      else if (d > 28 && weapon === WeaponId.Shotgun) weapon = WeaponId.Rifle;
      else if (weapon !== WeaponId.Shotgun && weapon !== WeaponId.Rifle) weapon = WeaponId.Rifle;

      const yawErr = Math.abs(wrapAngle(wantYawRel(bot, target) - yaw));
      const pitchErr = Math.abs(wantPitchRel(bot, target) - pitch);
      const ads = d <= cfg.adsRange && weapon !== WeaponId.Shotgun;
      if (ads) buttons |= Btn.Aim;
      if (d <= cfg.maxRange && yawErr < cfg.fireAngle && pitchErr < cfg.fireAngle * 1.2) buttons |= Btn.Fire;
    } else {
      mem.targetId = -1;
      buttons |= Btn.Forward;
    }
  }

  return { seq: mem.seq, buttons, yaw, pitch, weapon, viewTick: tick };
};

const wantYawRel = (bot: SimPlayer, target: SimPlayer): number => {
  const dx = target.sim.x - bot.sim.x;
  const dz = target.sim.z - bot.sim.z;
  return Math.atan2(-dx, -dz);
};

const wantPitchRel = (bot: SimPlayer, target: SimPlayer): number => {
  const eye = eyePosition(bot.sim);
  const te = eyePosition(target.sim);
  const dx = te.x - eye.x;
  const dy = te.y - eye.y;
  const dz = te.z - eye.z;
  return Math.atan2(dy, Math.hypot(dx, dz));
};
