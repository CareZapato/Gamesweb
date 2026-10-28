import { describe, expect, it } from 'vitest';
import {
  box,
  Btn,
  clonePlayerSimState,
  CollisionWorld,
  createPlayerSimState,
  decodeInput,
  DT,
  encodeInput,
  getWeapon,
  hitscanDamage,
  type HitscanWeapon,
  type InputCmd,
  isAiming,
  MAX_BUTTONS,
  PLAYER,
  stepMovement,
  stepWeapon,
  TICK_RATE,
  traceHitscan,
  WEAPON_COUNT,
  WeaponId,
  WEAPONS,
} from '@arena/shared';
import { GameSim, type SimPlayer } from '../server/src/game/GameSim';

const dm = () => new GameSim({ mode: 'dm', mapId: 'foundry', timeLimit: 10, scoreLimit: 25 }, 1234);
const ctf = () => new GameSim({ mode: 'ctf', mapId: 'twin', timeLimit: 15, scoreLimit: 3 }, 99);

const place = (p: SimPlayer, x: number, y: number, z: number) => {
  p.sim.x = x;
  p.sim.y = y;
  p.sim.z = z;
  p.sim.vx = p.sim.vy = p.sim.vz = 0;
  p.sim.onGround = true;
  p.protectTimer = 0;
};

const seqs = new Map<number, number>();
const input = (sim: GameSim, p: SimPlayer, buttons: number, opts: Partial<InputCmd> = {}): InputCmd => {
  const seq = (seqs.get(p.id) ?? 0) + 1;
  seqs.set(p.id, seq);
  return { seq, buttons, yaw: p.yaw, pitch: 0, weapon: p.sim.weapon, viewTick: sim.tick, ...opts };
};

/** Feeds one input per tick for `ticks` ticks. */
const run = (sim: GameSim, p: SimPlayer, ticks: number, buttons: number, opts: Partial<InputCmd> = {}) => {
  for (let i = 0; i < ticks; i++) {
    sim.queueInput(p.id, input(sim, p, buttons, opts));
    sim.step();
  }
};

const equip = (sim: GameSim, p: SimPlayer, weapon: number) => {
  run(sim, p, Math.ceil(WEAPONS[weapon].switchTime * TICK_RATE) + 1, 0, { weapon });
  expect(p.sim.weapon).toBe(weapon);
};

/** Two players 4 m apart on the Fundición map, `a` looking at `b` (+Z). */
const duel = () => {
  const sim = dm();
  const a = sim.addPlayer(1, 'A', 0);
  const b = sim.addPlayer(2, 'B', 0);
  place(a, 0, 0, -16);
  place(b, 0, 0, -12);
  a.yaw = Math.PI;
  return { sim, a, b };
};

/** Pitch that points the eye of `a` at the chest of `b` (avoids the head box). */
const CHEST_PITCH = -Math.atan2(PLAYER.eyeHeight - 1, 4);

const flatWorld = () => new CollisionWorld({ killY: -50, boxes: [box(-200, -1, -200, 200, 0, 200, 'floor')], ramps: [] });

describe('arsenal de siete armas', () => {
  it('hay siete armas con ids consecutivos y datos de apuntado completos', () => {
    expect(WEAPON_COUNT).toBe(7);
    WEAPONS.forEach((w, i) => {
      expect(w.id).toBe(i);
      expect(w.adsFov).toBeGreaterThan(5);
      expect(w.adsFov).toBeLessThanOrEqual(90);
      expect(w.adsSpreadMult).toBeGreaterThanOrEqual(0);
      expect(w.adsMoveMult).toBeGreaterThan(0);
      expect(w.adsMoveMult).toBeLessThanOrEqual(1);
    });
    // exactly the two snipers show a scope
    expect(WEAPONS.filter((w) => w.scoped).map((w) => w.id)).toEqual([WeaponId.Sniper, WeaponId.Charge]);
  });

  it('el servidor acepta las siete armas y rechaza la octava', () => {
    const base: InputCmd = { seq: 1, buttons: 0, yaw: 0, pitch: 0, weapon: 6, viewTick: 0 };
    expect(decodeInput(encodeInput(base))?.weapon).toBe(6);
    expect(decodeInput(encodeInput({ ...base, weapon: 7 }))).toBeNull();
  });
});

describe('Hilo Aurora (rayo de plasma)', () => {
  const plasma = getWeapon(WeaponId.Plasma) as HitscanWeapon;

  it('dispara una vez por tick y su cadencia es un tick', () => {
    expect(plasma.automatic).toBe(true);
    expect(plasma.fireInterval).toBeCloseTo(DT, 12);
    expect(plasma.pellets).toBe(1);
    expect(plasma.spreadBase).toBe(0);
    expect(plasma.range).toBeGreaterThanOrEqual(25);
    expect(plasma.range).toBeLessThanOrEqual(35);
  });

  it('daño por tick bajo y munición consumida por tick', () => {
    const { sim, a, b } = duel();
    equip(sim, a, WeaponId.Plasma);
    place(b, 0, 0, -12);
    const ammo0 = a.sim.ammo[WeaponId.Plasma];
    sim.drainEvents();
    const ticks = 12;
    run(sim, a, ticks, Btn.Fire, { yaw: Math.PI, pitch: CHEST_PITCH });
    const hits = sim.drainEvents().filter((e) => e.k === 'hit');
    expect(a.shotsFired).toBe(ticks);
    expect(a.sim.ammo[WeaponId.Plasma]).toBe(ammo0 - ticks * plasma.ammoPerShot);
    expect(hits.length).toBe(ticks);
    expect(b.hp).toBe(PLAYER.maxHealth - ticks * plasma.damage);
    expect(plasma.damage).toBeLessThanOrEqual(6);
  });

  it('se queda sin munición y deja de disparar', () => {
    const { sim, a } = duel();
    equip(sim, a, WeaponId.Plasma);
    a.sim.ammo[WeaponId.Plasma] = 5;
    run(sim, a, 20, Btn.Fire, { yaw: Math.PI });
    expect(a.shotsFired).toBe(5);
    expect(a.sim.ammo[WeaponId.Plasma]).toBe(0);
  });

  it('el servidor no deja disparar más rápido que un tick por tick (inundación de inputs)', () => {
    const { sim, a } = duel();
    equip(sim, a, WeaponId.Plasma);
    const before = a.shotsFired;
    for (let i = 0; i < 40; i++) sim.queueInput(a.id, input(sim, a, Btn.Fire, { yaw: Math.PI }));
    sim.step();
    expect(a.shotsFired - before).toBe(1);
  });

  it('alcance medio: acierta a 29 m y no llega a 31 m', () => {
    const world = flatWorld();
    const origin = { x: 0, y: PLAYER.eyeHeight, z: 0 };
    const dir = { x: 0, y: 0, z: 1 };
    // the beam aims at the head height so the target is hit at any distance
    const near = traceHitscan(world, origin, dir, plasma.range, [{ id: 2, x: 0, y: 0, z: 29 }], 1);
    expect(near.targetId).toBe(2);
    const far = traceHitscan(world, origin, dir, plasma.range, [{ id: 2, x: 0, y: 0, z: 31 }], 1);
    expect(far.targetId).toBe(-1);
    expect(far.t).toBeCloseTo(plasma.range, 6);
    // no damage falloff along its range
    expect(hitscanDamage(plasma, 29, 'body')).toBe(plasma.damage);
    expect(hitscanDamage(plasma, 1, 'body')).toBe(plasma.damage);
  });

  it('usa la compensación de latencia: acierta donde el tirador veía al objetivo', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    const b = sim.addPlayer(2, 'B', 0);
    place(a, 0, 0, -20);
    equip(sim, a, WeaponId.Plasma);
    const start = sim.tick;
    for (let t = 1; t <= 16; t++) {
      place(b, t >= 11 && t <= 14 ? 0 : 3, 0, -12);
      place(a, 0, 0, -20);
      sim.step();
    }
    run(sim, a, 1, Btn.Fire, { yaw: Math.PI, viewTick: start + 12, pitch: -Math.atan2(PLAYER.eyeHeight - 1, 8) });
    expect(b.hp).toBe(PLAYER.maxHealth - plasma.damage);
  });

  it('en CTF no daña a compañeros (sí a rivales en el mismo sitio)', () => {
    const sim = ctf();
    const r1 = sim.addPlayer(1, 'R1', 0);
    const r2 = sim.addPlayer(2, 'R2', 0);
    const b1 = sim.addPlayer(3, 'B1', 1);
    place(r1, 0, 0, -16);
    place(r2, 0, 0, -12);
    place(b1, 8, 0, 26);
    r1.yaw = Math.PI;
    equip(sim, r1, WeaponId.Plasma);
    place(r2, 0, 0, -12);
    run(sim, r1, 6, Btn.Fire, { yaw: Math.PI, pitch: CHEST_PITCH });
    expect(r2.hp).toBe(PLAYER.maxHealth);
    // control: an enemy standing exactly there is hurt, so the line of fire was clear
    sim.removePlayer(r2.id);
    const enemy = sim.addPlayer(4, 'B2', 1);
    place(enemy, 0, 0, -12);
    sim.step(); // the new player enters the lag-compensation history
    sim.step();
    place(enemy, 0, 0, -12);
    r1.sim.ammo[WeaponId.Plasma] = 50;
    run(sim, r1, 6, Btn.Fire, { yaw: Math.PI, pitch: CHEST_PITCH });
    expect(enemy.hp).toBe(PLAYER.maxHealth - 6 * plasma.damage);
  });
});

describe('Lanza Cuásar (francotirador de carga)', () => {
  const cw = getWeapon(WeaponId.Charge) as HitscanWeapon;
  const charge = cw.charge!;
  const full = Math.ceil(charge.time * TICK_RATE) + 2;

  it('el daño crece con la carga: mínimo, mitad y máximo', () => {
    expect(hitscanDamage(cw, 10, 'body', 0)).toBe(charge.minDamage);
    expect(hitscanDamage(cw, 10, 'body', 1)).toBe(cw.damage);
    const half = hitscanDamage(cw, 10, 'body', 0.5);
    expect(half).toBeGreaterThan(charge.minDamage);
    expect(half).toBeLessThan(cw.damage);
    expect(half).toBe(Math.round((charge.minDamage + cw.damage) / 2));
    expect(hitscanDamage(cw, 10, 'head', 1)).toBe(Math.round(cw.damage * cw.headshotMultiplier));
    // weapons without charge ignore the argument
    const rifle = getWeapon(WeaponId.Rifle) as HitscanWeapon;
    expect(hitscanDamage(rifle, 10, 'body', 0)).toBe(rifle.damage);
  });

  it('mantener carga sin gastar munición y disparar al soltar con daño proporcional', () => {
    const { sim, a, b } = duel();
    equip(sim, a, WeaponId.Charge);
    const ammo0 = a.sim.ammo[WeaponId.Charge];
    const opts = { yaw: Math.PI, pitch: CHEST_PITCH };
    run(sim, a, 15, Btn.Fire | Btn.Aim, opts); // 0,5 s = un tercio de la carga
    expect(a.shotsFired).toBe(0);
    expect(a.sim.ammo[WeaponId.Charge]).toBe(ammo0);
    expect(a.sim.charge).toBeCloseTo(15 * DT, 9);
    sim.drainEvents();
    run(sim, a, 1, Btn.Aim, opts); // release
    expect(a.shotsFired).toBe(1);
    expect(a.sim.ammo[WeaponId.Charge]).toBe(ammo0 - 1);
    expect(a.sim.charge).toBe(0);
    const frac = (15 * DT) / charge.time;
    const expected = Math.round(charge.minDamage + (cw.damage - charge.minDamage) * frac);
    expect(b.hp).toBe(PLAYER.maxHealth - expected);
    const shot = sim.drainEvents().find((e) => e.k === 'shot');
    expect(shot && shot.k === 'shot' ? shot.c : -1).toBeCloseTo(frac, 2);
  });

  it('con la carga completa un disparo al cuerpo mata sin escudo y más carga siempre es más daño', () => {
    const hpAfter = (ticks: number) => {
      const { sim, a, b } = duel();
      equip(sim, a, WeaponId.Charge);
      const opts = { yaw: Math.PI, pitch: CHEST_PITCH };
      run(sim, a, ticks, Btn.Fire | Btn.Aim, opts);
      run(sim, a, 1, Btn.Aim, opts);
      return b.hp;
    };
    const hps = [8, 20, 35].map(hpAfter);
    expect(hps[0]).toBeGreaterThan(hps[1]);
    expect(hps[1]).toBeGreaterThan(hps[2]);
    const { sim, a, b } = duel();
    equip(sim, a, WeaponId.Charge);
    const opts = { yaw: Math.PI, pitch: CHEST_PITCH };
    run(sim, a, full, Btn.Fire | Btn.Aim, opts);
    expect(a.sim.charge).toBeCloseTo(charge.time, 9); // never above a full charge
    run(sim, a, 1, Btn.Aim, opts);
    expect(b.alive).toBe(false);
    expect(a.kills).toBe(1);
  });

  it('soltar antes del mínimo cancela el disparo sin gastar munición', () => {
    const { sim, a } = duel();
    equip(sim, a, WeaponId.Charge);
    const ammo0 = a.sim.ammo[WeaponId.Charge];
    run(sim, a, 3, Btn.Fire, { yaw: Math.PI });
    run(sim, a, 1, 0, { yaw: Math.PI });
    expect(a.shotsFired).toBe(0);
    expect(a.sim.ammo[WeaponId.Charge]).toBe(ammo0);
    expect(a.sim.charge).toBe(0);
  });

  it('tras disparar hay enfriamiento: no se carga hasta que termina', () => {
    const { sim, a } = duel();
    equip(sim, a, WeaponId.Charge);
    const opts = { yaw: Math.PI, pitch: CHEST_PITCH };
    run(sim, a, 10, Btn.Fire | Btn.Aim, opts);
    run(sim, a, 1, Btn.Aim, opts);
    expect(a.shotsFired).toBe(1);
    run(sim, a, 3, Btn.Fire | Btn.Aim, opts); // still cooling down
    expect(a.sim.charge).toBe(0);
    run(sim, a, Math.ceil(cw.fireInterval * TICK_RATE), Btn.Aim, opts);
    run(sim, a, 3, Btn.Fire | Btn.Aim, opts);
    expect(a.sim.charge).toBeGreaterThan(0);
  });

  it('no se puede disparar en ráfaga: un disparo por carga aunque se inunde el servidor', () => {
    const { sim, a } = duel();
    equip(sim, a, WeaponId.Charge);
    for (let i = 0; i < 10; i++) {
      sim.queueInput(a.id, input(sim, a, Btn.Fire, { yaw: Math.PI }));
      sim.queueInput(a.id, input(sim, a, 0, { yaw: Math.PI }));
      sim.step();
    }
    expect(a.shotsFired).toBeLessThanOrEqual(1);
  });

  it('cambiar de arma cancela la carga', () => {
    const { sim, a } = duel();
    equip(sim, a, WeaponId.Charge);
    run(sim, a, 15, Btn.Fire, { yaw: Math.PI });
    expect(a.sim.charge).toBeGreaterThan(0.4);
    run(sim, a, 2, Btn.Fire, { yaw: Math.PI, weapon: WeaponId.Rifle });
    expect(a.sim.charge).toBe(0);
    expect(a.shotsFired).toBe(0);
  });

  it('cargar reduce la velocidad de movimiento', () => {
    const speedAfter = (buttons: number) => {
      const s = createPlayerSimState(0, 0, 0);
      s.onGround = true;
      s.weapon = WeaponId.Charge;
      const w = flatWorld();
      for (let i = 0; i < 60; i++) {
        stepMovement(s, { seq: i, buttons, yaw: 0, pitch: 0, weapon: WeaponId.Charge, viewTick: 0 }, w, DT);
        stepWeapon(s, { seq: i, buttons, yaw: 0, pitch: 0, weapon: WeaponId.Charge, viewTick: 0 }, DT, 1);
      }
      return Math.hypot(s.vx, s.vz);
    };
    const free = speedAfter(Btn.Forward);
    const charging = speedAfter(Btn.Forward | Btn.Fire);
    expect(free).toBeCloseTo(PLAYER.runSpeed, 1);
    expect(charging).toBeCloseTo(PLAYER.runSpeed * charge.moveMult, 1);
  });
});

describe('apuntar con clic derecho (bit Aim del input)', () => {
  const cmd = (buttons: number, weapon = 0): InputCmd => ({ seq: 1, buttons, yaw: 0, pitch: 0, weapon, viewTick: 0 });

  it('el bit Aim viaja por la red y se valida', () => {
    expect(Btn.Aim).toBe(128);
    expect(MAX_BUTTONS).toBe(1023);
    expect(decodeInput(encodeInput(cmd(Btn.Fire | Btn.Aim)))?.buttons).toBe(Btn.Fire | Btn.Aim);
    expect(decodeInput(encodeInput(cmd(255)))?.buttons).toBe(255);
    expect(decodeInput([1, 256, 0, 0, 0, 0])?.buttons).toBe(Btn.Crouch);
    expect(decodeInput([1, 1024, 0, 0, 0, 0])).toBeNull();
    expect(decodeInput([1, -1, 0, 0, 0, 0])).toBeNull();
  });

  it('reduce la dispersión del disparo según el arma', () => {
    const shot = (id: number, aim: number) => {
      const s = createPlayerSimState();
      s.weapon = id;
      s.spread = (getWeapon(id) as HitscanWeapon).spreadBase;
      if (id !== WeaponId.Charge) return stepWeapon(s, cmd(aim | Btn.Fire, id), DT, 1);
      // charge weapons shoot when the button is released
      for (let i = 0; i < 12; i++) stepWeapon(s, cmd(aim | Btn.Fire, id), DT, 1);
      return stepWeapon(s, cmd(aim, id), DT, 1);
    };
    for (const id of [WeaponId.Rifle, WeaponId.Shotgun, WeaponId.Charge]) {
      const w = getWeapon(id) as HitscanWeapon;
      const hip = shot(id, 0);
      const ads = shot(id, Btn.Aim);
      expect(hip).not.toBeNull();
      expect(ads).not.toBeNull();
      expect(hip!.spread).toBeCloseTo(w.spreadBase, 12);
      expect(ads!.spread).toBeCloseTo(w.spreadBase * w.adsSpreadMult, 12);
      expect(ads!.spread).toBeLessThan(hip!.spread);
    }
    expect((getWeapon(WeaponId.Charge) as HitscanWeapon).adsSpreadMult).toBe(0);
  });

  it('reduce la velocidad de movimiento según el arma, y solo con el arma ya equipada', () => {
    const speed = (weapon: number, buttons: number, pending = -1) => {
      const s = createPlayerSimState();
      s.onGround = true;
      s.weapon = weapon;
      s.pendingWeapon = pending;
      const w = flatWorld();
      for (let i = 0; i < 60; i++) stepMovement(s, cmd(buttons), w, DT);
      return Math.hypot(s.vx, s.vz);
    };
    for (const w of WEAPONS) {
      expect(speed(w.id, Btn.Forward)).toBeCloseTo(PLAYER.runSpeed, 1);
      expect(speed(w.id, Btn.Forward | Btn.Aim)).toBeCloseTo(PLAYER.runSpeed * w.adsMoveMult, 1);
    }
    // while switching weapons the bit does nothing
    expect(isAiming({ ...createPlayerSimState(), pendingWeapon: 2 }, Btn.Aim)).toBe(false);
    expect(speed(WeaponId.Sniper, Btn.Forward | Btn.Aim, WeaponId.Rifle)).toBeCloseTo(PLAYER.runSpeed, 1);
  });

  it('la predicción del cliente coincide con el servidor con el bit Aim (movimiento, dispersión, munición)', () => {
    const run30 = (withAim: boolean) => {
      const sim = dm();
      const p = sim.addPlayer(1, 'A', 0);
      place(p, 0, 0, -16);
      const local = clonePlayerSimState(p.sim);
      let max = 0;
      for (let i = 0; i < 90; i++) {
        const aim = withAim && i % 40 < 28 ? Btn.Aim : 0;
        const fire = i % 5 < 3 ? Btn.Fire : 0;
        const dirs = i % 20 < 10 ? Btn.Forward | Btn.Right : Btn.Back;
        const c: InputCmd = { seq: i + 1, buttons: aim | fire | dirs, yaw: 0.3, pitch: 0, weapon: 0, viewTick: sim.tick };
        // client side: exactly what Game.fixedTick() / replay() do with the shared code
        stepMovement(local, c, sim.world, DT);
        stepWeapon(local, c, DT, p.id);
        // server side
        sim.queueInput(p.id, c);
        sim.step();
        const s = p.sim;
        max = Math.max(max, Math.abs(s.x - local.x), Math.abs(s.y - local.y), Math.abs(s.z - local.z), Math.abs(s.vx - local.vx), Math.abs(s.vz - local.vz), Math.abs(s.spread - local.spread));
        expect(s.ammo).toEqual(local.ammo);
        expect(s.shotCounter).toBe(local.shotCounter);
        expect(s.fireCd).toBeCloseTo(local.fireCd, 12);
      }
      return { max, x: p.sim.x, z: p.sim.z, spread: p.sim.spread };
    };
    const aim = run30(true);
    const hip = run30(false);
    expect(aim.max).toBeLessThan(1e-9);
    expect(hip.max).toBeLessThan(1e-9);
    // and aiming really changes the outcome (slower movement)
    expect(Math.hypot(aim.x - hip.x, aim.z - hip.z)).toBeGreaterThan(0.5);
  });
});
