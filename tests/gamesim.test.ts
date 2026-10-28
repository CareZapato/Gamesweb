import { describe, expect, it } from 'vitest';
import { Btn, FlagState, type InputCmd, MODE_RULES, NET, PLAYER, STREAK_RULES, TICK_RATE, WeaponId, WEAPONS } from '@arena/shared';
import { GameSim, type SimPlayer } from '../server/src/game/GameSim';

const dm = (overrides: Partial<{ scoreLimit: number; timeLimit: number }> = {}) =>
  new GameSim({ mode: 'dm', mapId: 'foundry', timeLimit: 10, scoreLimit: 25, ...overrides }, 1234);
const ctf = (scoreLimit = 3) => new GameSim({ mode: 'ctf', mapId: 'twin', timeLimit: 15, scoreLimit }, 99);

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

const frag = (sim: GameSim, killer: SimPlayer, victim: SimPlayer, from = { x: 0, y: 0, z: 0 }) => {
  victim.alive = true;
  victim.hp = 100;
  victim.protectTimer = 0;
  sim.damage(victim, killer.id, 500, WeaponId.Rifle, 'body', { x: victim.sim.x, y: victim.sim.y + 1, z: victim.sim.z }, from);
};

const streakEvents = (sim: GameSim) => sim.drainEvents().filter((e) => e.k === 'streak');

describe('validaciÃ³n de disparos en el servidor', () => {
  it('limita la cadencia del rifle automÃ¡tico', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    place(a, 0, 0, -16);
    run(sim, a, TICK_RATE, Btn.Fire); // 1 second holding fire
    const max = Math.ceil(1 / WEAPONS[WeaponId.Rifle].fireInterval) + 1;
    expect(a.shotsFired).toBeGreaterThan(5);
    expect(a.shotsFired).toBeLessThanOrEqual(max);
  });

  it('el rifle de precisiÃ³n no dispara en automÃ¡tico manteniendo el botÃ³n', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    place(a, 0, 0, -16);
    equip(sim, a, WeaponId.Sniper);
    run(sim, a, TICK_RATE * 3, Btn.Fire);
    expect(a.shotsFired).toBe(1);
  });

  it('rechaza disparos sin municiÃ³n', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    place(a, 0, 0, -16);
    a.sim.ammo[WeaponId.Rifle] = 0;
    run(sim, a, TICK_RATE, Btn.Fire);
    expect(a.shotsFired).toBe(0);
    expect(a.sim.ammo[WeaponId.Rifle]).toBe(0);
  });

  it('no permite consumir mÃ¡s inputs que ticks (anti speedhack) y descarta inundaciones', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    place(a, 0, 0, -16);
    let accepted = 0;
    for (let i = 0; i < 40; i++) if (sim.queueInput(a.id, input(sim, a, Btn.Fire | Btn.Forward))) accepted++;
    expect(accepted).toBe(NET.maxQueuedInputs);
    sim.step();
    // credits start at 0 and grow by one per tick: one input per tick in steady state
    expect(a.lastSeq).toBe((seqs.get(a.id) ?? 0) - 40 + 1);
    expect(a.shotsFired).toBe(1);
    // duplicated / old sequence numbers are rejected
    expect(sim.queueInput(a.id, { seq: 1, buttons: 0, yaw: 0, pitch: 0, weapon: 0, viewTick: 0 })).toBe(false);
  });

  it('el cambio de arma requiere su tiempo antes de poder disparar', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    place(a, 0, 0, -16);
    run(sim, a, 3, Btn.Fire, { weapon: WeaponId.Rocket });
    expect(a.shotsFired).toBe(0);
    expect(sim.projectiles.length).toBe(0);
  });
});

describe('daÃ±o, bajas y respawn', () => {
  it('un disparo a la cabeza con el rifle de precisiÃ³n mata, cuenta la baja y reaparece', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    const b = sim.addPlayer(2, 'B', 0);
    place(a, 0, 0, -16);
    place(b, 0, 0, -12);
    a.yaw = Math.PI; // facing +Z
    equip(sim, a, WeaponId.Sniper);
    place(b, 0, 0, -12);
    sim.drainEvents();
    run(sim, a, 1, Btn.Fire, { yaw: Math.PI, pitch: 0 });
    const events = sim.drainEvents();
    expect(events.some((e) => e.k === 'kill' && e.killer === 1 && e.victim === 2 && e.head)).toBe(true);
    expect(b.alive).toBe(false);
    expect(a.kills).toBe(1);
    expect(a.score).toBe(1);
    expect(b.deaths).toBe(1);
    for (let i = 0; i < Math.ceil(PLAYER.respawnDelay * TICK_RATE) + 1; i++) sim.step();
    expect(b.alive).toBe(true);
    expect(b.hp).toBe(PLAYER.maxHealth);
    expect(b.life).toBe(2);
  });

  it('el escudo absorbe el daño primero y el resto pasa a la salud', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    const b = sim.addPlayer(2, 'B', 0);
    place(b, 0, 0, -12);
    b.shield = 20;
    sim.drainEvents();
    sim.damage(b, a.id, 30, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(b.shield).toBe(0);
    expect(b.hp).toBe(90);
    const hit = sim.drainEvents().find((e) => e.k === 'hit');
    expect(hit && hit.k === 'hit' ? [hit.sd, hit.sb] : null).toEqual([20, true]);
  });

  it('el suicidio penaliza el puntaje y el lÃ­mite de bajas termina la partida', () => {
    const sim = dm({ scoreLimit: 2 });
    const a = sim.addPlayer(1, 'A', 0);
    const b = sim.addPlayer(2, 'B', 0);
    place(a, 0, 0, -16);
    sim.damage(a, a.id, 500, WeaponId.Rocket, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -16 });
    expect(a.score).toBe(-MODE_RULES.dm.suicidePenalty);
    expect(a.deaths).toBe(1);
    for (let i = 0; i < 2; i++) {
      place(a, 0, 0, -16);
      a.alive = true;
      a.hp = 100;
      b.alive = true;
      b.protectTimer = 0;
      sim.damage(a, b.id, 500, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    }
    expect(b.score).toBe(2);
    expect(sim.ended).toBe(true);
    expect(sim.results?.reason).toBe('score');
    expect(sim.results?.winnerId).toBe(2);
  });

  it('el lÃ­mite de tiempo termina la partida', () => {
    const sim = dm({ timeLimit: 0.05 });
    sim.addPlayer(1, 'A', 0);
    for (let i = 0; i < TICK_RATE * 3 + 2; i++) sim.step();
    expect(sim.ended).toBe(true);
    expect(sim.results?.reason).toBe('time');
  });

  it('el daÃ±o explosivo propio aplica y empuja (rocket jump)', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    place(a, 0, 0, -16);
    equip(sim, a, WeaponId.Rocket);
    run(sim, a, 1, Btn.Fire, { yaw: Math.PI, pitch: -1.5 }); // shoot at own feet
    run(sim, a, 3, 0, { yaw: Math.PI });
    expect(a.hp).toBeLessThan(100);
    expect(a.sim.y).toBeGreaterThan(0.05);
  });
});

describe('compensaciÃ³n de latencia', () => {
  const setup = (bPositions: (tick: number) => number) => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    const b = sim.addPlayer(2, 'B', 0);
    place(a, 0, 0, -20);
    equip(sim, a, WeaponId.Sniper);
    const start = sim.tick;
    for (let t = 1; t <= 16; t++) {
      place(b, bPositions(t), 0, -12);
      place(a, 0, 0, -20);
      sim.step();
    }
    return { sim, a, b, start };
  };

  it('acierta contra la posiciÃ³n que el tirador veÃ­a (dentro del lÃ­mite)', () => {
    const { sim, a, b, start } = setup((t) => (t >= 11 && t <= 14 ? 0 : 3));
    run(sim, a, 1, Btn.Fire, { yaw: Math.PI, viewTick: start + 12 });
    expect(b.alive).toBe(false);
  });

  it('limita el rewind al mÃ¡ximo configurado', () => {
    const { sim, a, b, start } = setup((t) => (t <= 6 ? 0 : 3));
    run(sim, a, 1, Btn.Fire, { yaw: Math.PI, viewTick: start + 4 });
    expect(b.alive).toBe(true);
  });

  it('no permite pedir tiempos futuros', () => {
    const { sim, a, b } = setup(() => 3);
    run(sim, a, 1, Btn.Fire, { yaw: Math.PI, viewTick: sim.tick + 50 });
    expect(b.alive).toBe(true);
  });
});

describe('pickups', () => {
  it('cura, desaparece y reaparece tras su tiempo', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    const idx = sim.map.pickups.findIndex((p) => p.kind === 'health');
    const pos = sim.map.pickups[idx].pos;
    a.hp = 50;
    place(a, pos[0], pos[1], pos[2]);
    sim.step();
    expect(a.hp).toBe(75);
    expect(sim.pickups[idx].available).toBe(false);
    place(a, 0, 0, -16);
    for (let i = 0; i < 21 * TICK_RATE; i++) sim.step();
    expect(sim.pickups[idx].available).toBe(true);
  });

  it('no se recoge si no aporta nada', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    const idx = sim.map.pickups.findIndex((p) => p.kind === 'health');
    const pos = sim.map.pickups[idx].pos;
    place(a, pos[0], pos[1], pos[2]);
    sim.step();
    expect(sim.pickups[idx].available).toBe(true);
  });
});

describe('capturar la bandera', () => {
  const setup = (limit = 3) => {
    const sim = ctf(limit);
    const r1 = sim.addPlayer(1, 'R1', 0);
    const r2 = sim.addPlayer(2, 'R2', 0);
    const b1 = sim.addPlayer(3, 'B1', 1);
    const redHome = sim.flags[0].home;
    const blueHome = sim.flags[1].home;
    // park everyone away from flags
    place(r1, -8, 0, -26);
    place(r2, 8, 0, -26);
    place(b1, 8, 0, 26);
    return { sim, r1, r2, b1, redHome, blueHome };
  };

  it('tomar, soltar al morir, recuperar y capturar', () => {
    const { sim, r1, b1, redHome, blueHome } = setup();
    place(b1, redHome.x, redHome.y, redHome.z);
    sim.step();
    expect(sim.flags[0].state).toBe(FlagState.Carried);
    expect(sim.flags[0].carrier).toBe(b1.id);
    expect(b1.carrying).toBe(0);

    // carrier dies -> flag dropped where he was
    place(b1, 0, 0, -27);
    sim.damage(b1, r1.id, 500, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(sim.flags[0].state).toBe(FlagState.Dropped);
    expect(sim.flags[0].pos.z).toBeCloseTo(-27);
    expect(b1.carrying).toBe(-1);

    // red player touches its dropped flag -> back home
    const scoreBefore = r1.score;
    place(r1, 0, 0, -27);
    sim.step();
    expect(sim.flags[0].state).toBe(FlagState.Home);
    expect(r1.score).toBe(scoreBefore + MODE_RULES.ctf.returnPoints);

    // blue respawns, grabs again and runs home
    for (let i = 0; i < PLAYER.respawnDelay * TICK_RATE + 2; i++) sim.step();
    expect(b1.alive).toBe(true);
    place(r1, -8, 0, -26);
    place(b1, redHome.x, redHome.y, redHome.z);
    sim.step();
    expect(sim.flags[0].carrier).toBe(b1.id);
    place(b1, blueHome.x, blueHome.y, blueHome.z);
    sim.step();
    expect(sim.teamScores[1]).toBe(1);
    expect(sim.flags[0].state).toBe(FlagState.Home);
    expect(b1.captures).toBe(1);
  });

  it('no captura si la bandera propia no estÃ¡ en su base', () => {
    const { sim, r1, b1, redHome, blueHome } = setup();
    place(r1, blueHome.x, blueHome.y, blueHome.z);
    sim.step();
    expect(sim.flags[1].carrier).toBe(r1.id);
    place(r1, -8, 0, 20);
    place(b1, redHome.x, redHome.y, redHome.z);
    sim.step();
    place(b1, blueHome.x, blueHome.y, blueHome.z);
    sim.step();
    expect(sim.teamScores[1]).toBe(0);
    expect(sim.flags[0].carrier).toBe(b1.id);
  });

  it('la bandera caÃ­da vuelve sola tras el tiempo configurado', () => {
    const { sim, r1, b1, redHome } = setup();
    place(b1, redHome.x, redHome.y, redHome.z);
    sim.step();
    place(b1, 0, 0, -27);
    sim.damage(b1, r1.id, 500, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(sim.flags[0].state).toBe(FlagState.Dropped);
    for (let i = 0; i < (MODE_RULES.ctf.flagReturnTime + 1) * TICK_RATE; i++) sim.step();
    expect(sim.flags[0].state).toBe(FlagState.Home);
  });

  it('desconexiÃ³n del portador: suelta la bandera; al salir definitivamente tambiÃ©n', () => {
    const { sim, b1, redHome } = setup();
    place(b1, redHome.x, redHome.y, redHome.z);
    sim.step();
    expect(sim.flags[0].state).toBe(FlagState.Carried);
    place(b1, 0, 0, -27);
    sim.setConnected(b1.id, false);
    expect(sim.flags[0].state).toBe(FlagState.Dropped);
    expect(b1.alive).toBe(false);
    // reconnects: respawns
    sim.setConnected(b1.id, true);
    sim.step();
    expect(b1.alive).toBe(true);
    place(b1, sim.flags[0].pos.x, sim.flags[0].pos.y, sim.flags[0].pos.z);
    sim.step();
    expect(sim.flags[0].carrier).toBe(b1.id);
    sim.removePlayer(b1.id);
    expect(sim.flags[0].state).toBe(FlagState.Dropped);
    sim.step();
    expect(sim.flags[0].state).toBe(FlagState.Dropped);
  });

  it('muerte simultÃ¡nea de ambos portadores: ambas banderas caen y no hay captura', () => {
    const { sim, r1, b1, redHome, blueHome } = setup();
    place(r1, blueHome.x, blueHome.y, blueHome.z);
    place(b1, redHome.x, redHome.y, redHome.z);
    sim.step();
    expect(r1.carrying).toBe(1);
    expect(b1.carrying).toBe(0);
    place(r1, 8, 0, 10);
    place(b1, 8, 0, -10);
    sim.damage(r1, b1.id, 500, WeaponId.Rocket, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    sim.damage(b1, r1.id, 500, WeaponId.Rocket, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    sim.step();
    expect(sim.flags[0].state).toBe(FlagState.Dropped);
    expect(sim.flags[1].state).toBe(FlagState.Dropped);
    expect(sim.teamScores).toEqual([0, 0]);
  });

  it('el lÃ­mite de capturas termina la partida con ganador por equipo', () => {
    const { sim, b1, redHome, blueHome } = setup(1);
    place(b1, redHome.x, redHome.y, redHome.z);
    sim.step();
    place(b1, blueHome.x, blueHome.y, blueHome.z);
    sim.step();
    expect(sim.ended).toBe(true);
    expect(sim.results?.winnerTeam).toBe(1);
    expect(sim.results?.reason).toBe('score');
    // no more flag interactions after the end
    sim.step();
    expect(sim.teamScores[1]).toBe(1);
  });

  it('sin fuego amigo en equipos', () => {
    const { sim, r1, r2 } = setup();
    sim.damage(r2, r1.id, 50, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(r2.hp).toBe(100);
  });
});

describe('multi-kills y rachas', () => {
  it('double y triple kill dentro de la ventana de tiempo', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    const b = sim.addPlayer(2, 'B', 0);
    place(a, 0, 0, -16);
    place(b, 0, 0, -12);
    sim.drainEvents();
    frag(sim, a, b);
    frag(sim, a, b);
    const mid = streakEvents(sim);
    expect(mid.some((e) => e.kind === 'multi' && e.p === 1 && e.n === 2)).toBe(true);
    frag(sim, a, b);
    const all = streakEvents(sim);
    expect(all.some((e) => e.kind === 'multi' && e.n === 3)).toBe(true);
    expect(a.bestMulti).toBe(3);
  });

  it('fuera de la ventana no encadena multi-kill', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    const b = sim.addPlayer(2, 'B', 0);
    place(a, 0, 0, -16);
    place(b, 0, 0, -12);
    sim.drainEvents();
    frag(sim, a, b);
    streakEvents(sim);
    for (let i = 0; i < STREAK_RULES.multiKillWindowSec * TICK_RATE + 2; i++) sim.step();
    frag(sim, a, b);
    const ev = streakEvents(sim);
    expect(ev.some((e) => e.kind === 'multi')).toBe(false);
    expect(a.bestMulti).toBe(1);
  });

  it('el suicidio no cuenta para multi-kill ni racha', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    place(a, 0, 0, -16);
    sim.drainEvents();
    frag(sim, a, a);
    const ev = streakEvents(sim);
    expect(ev.some((e) => e.kind === 'multi')).toBe(false);
    expect(a.spree).toBe(0);
    expect(a.bestMulti).toBe(0);
  });

  it('anuncia racha asesina a 5 bajas y racha cortada al morir', () => {
    const sim = dm();
    const a = sim.addPlayer(1, 'A', 0);
    const b = sim.addPlayer(2, 'B', 0);
    const c = sim.addPlayer(3, 'C', 0);
    place(a, 0, 0, -16);
    sim.drainEvents();
    for (let i = 0; i < 5; i++) frag(sim, a, b);
    const spree = streakEvents(sim);
    expect(spree.some((e) => e.kind === 'spree' && e.p === 1 && e.n === 5)).toBe(true);
    expect(a.bestSpree).toBe(5);
    place(c, 0, 0, -12);
    c.protectTimer = 0;
    frag(sim, c, a);
    const ended = streakEvents(sim);
    expect(ended.some((e) => e.kind === 'ended' && e.p === 1 && e.n === 5 && e.by === 3)).toBe(true);
  });
});
