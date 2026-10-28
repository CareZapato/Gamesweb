import { describe, expect, it } from 'vitest';
import { Btn, clampBotCount, ROOM, TICK_RATE, WeaponId } from '@arena/shared';
import { botInput } from '../server/src/game/BotBrain';
import { GameSim, type SimPlayer } from '../server/src/game/GameSim';

const dm = () =>
  new GameSim({ mode: 'dm', mapId: 'foundry', timeLimit: 10, scoreLimit: 25, botCount: 0, botDifficulty: 'normal' }, 42);

const place = (p: SimPlayer, x: number, z: number) => {
  p.sim.x = x;
  p.sim.y = 0;
  p.sim.z = z;
  p.sim.onGround = true;
  p.alive = true;
  p.hp = 100;
};

describe('bots en partida', () => {
  it('clampBotCount respeta humanos + bots ≤ maxPlayers', () => {
    expect(clampBotCount(7, 2, 8)).toBe(6);
    expect(clampBotCount(99, 1, 8)).toBe(7);
    expect(clampBotCount(-1, 0, ROOM.maxPlayers)).toBe(0);
  });

  it('un bot apunta y dispara con un enemigo cercano', () => {
    const sim = dm();
    const bot = sim.addPlayer(1, 'Bot 1', 0);
    const foe = sim.addPlayer(2, 'Humano', 0);
    place(bot, 0, 0);
    place(foe, 0, -10);
    foe.protectTimer = 0;
    bot.yaw = 0;
    bot.pitch = 0;
    const mem = { seq: 0, targetId: -1, aimYaw: 0, aimPitch: 0, strafe: 1 as const, strafeUntil: 0 };
    let sawFire = false;
    for (let t = 0; t < TICK_RATE * 2; t++) {
      const cmd = botInput(sim, bot, 'hard', mem, t);
      if (cmd.buttons & Btn.Fire) sawFire = true;
      sim.queueInput(bot.id, cmd);
      sim.step();
    }
    expect(sawFire).toBe(true);
    expect(bot.shotsFired).toBeGreaterThan(0);
  });

  it('respeta la cadencia del arma (no dispara sin Btn.Fire)', () => {
    const sim = dm();
    const bot = sim.addPlayer(1, 'Bot 1', 0);
    place(bot, 0, 0);
    bot.sim.weapon = WeaponId.Sniper;
    bot.sim.ammo[WeaponId.Sniper] = 5;
    const mem = { seq: 0, targetId: -1, aimYaw: 0, aimPitch: 0, strafe: 1 as const, strafeUntil: 0 };
    const cmd = botInput(sim, bot, 'easy', mem, 0);
    expect(cmd.buttons & Btn.Fire).toBe(0);
  });
});
