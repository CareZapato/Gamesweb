import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { matchMaker, type Server } from '@colyseus/core';
import {
  C2S,
  DEADHOLD,
  DH_C2S,
  DH_S2C,
  type EnemyArchetypeId,
  type GameOverMsg,
  type LevelMsg,
  type LobbyState,
  type MatchSettings,
  type MatchStartMsg,
  PF,
  type ScrapMsg,
  scrapForKill,
  type ShopMsg,
  S2C,
  type SnapshotMsg,
  TICK_RATE,
  WeaponId,
  type WaveMsg,
  waveClearBonus,
  ROOM_NAMES,
} from '@arena/shared';
import { DeadholdRoom } from '../server/src/DeadholdRoom';
import { createGameServer } from '../server/src/createGameServer';
import { GameSim, type SimPlayer } from '../server/src/game/GameSim';
import { type DirectorMsg, WaveDirector } from '../server/src/game/WaveDirector';

const settings: MatchSettings = {
  mode: 'survival',
  mapId: 'holdout',
  timeLimit: 60,
  scoreLimit: 0,
  botCount: 0,
  botDifficulty: 'normal',
};

/** Three walkers: the "mock" wave used by every test below. */
const THREE_WALKERS = (): EnemyArchetypeId[] => ['walker', 'walker', 'walker'];

const setup = (opts: { humans?: number; shopSeconds?: number } = {}) => {
  const sim = new GameSim(settings, 7);
  const humans: SimPlayer[] = [];
  const director = new WaveDirector(sim, {
    seed: 7,
    planWave: THREE_WALKERS,
    graceSeconds: 0.2,
    shopSeconds: opts.shopSeconds ?? 30,
  });
  for (let i = 0; i < (opts.humans ?? 1); i++) {
    humans.push(sim.addPlayer(i + 1, `P${i + 1}`, 0));
    director.registerHuman(i + 1);
  }
  director.start();
  const msgs: DirectorMsg[] = [];
  const step = () => {
    director.step();
    msgs.push(...director.drainMessages());
  };
  return { sim, director, humans, msgs, step };
};

/** Stands in for the player's gun: every living zombie dies by the human's hand. */
const shootAllZombies = (sim: GameSim, shooter: SimPlayer) => {
  for (const z of [...sim.players.values()]) {
    if (z.kind !== 'zombie' || !z.alive) continue;
    sim.damage(z, shooter.id, z.hp + z.shield + 1, WeaponId.Rifle, 'body', { x: z.sim.x, y: z.sim.y + 1, z: z.sim.z }, { x: 0, y: 1.5, z: 0 });
  }
};

const ofType = <T>(msgs: DirectorMsg[], type: string): T[] => msgs.filter((m) => m.type === type).map((m) => m.msg as T);

describe('Reducto: Horda — director de oleadas (sim real, sin red)', () => {
  it('una oleada completa con 3 zombis: spawn, bajas, scrap, nivel y tienda', () => {
    const { sim, director, humans, msgs, step } = setup();
    const me = humans[0];
    expect(director.phase).toBe('combat');
    expect(director.wave).toBe(1);

    let maxAlive = 0;
    for (let t = 0; t < TICK_RATE * 30 && director.phase === 'combat'; t++) {
      step();
      maxAlive = Math.max(maxAlive, director.zombieCount);
      shootAllZombies(sim, me);
    }

    expect(maxAlive).toBeGreaterThan(0);
    expect(director.phase).toBe('shop');
    expect(director.level).toBe(1);
    expect(director.zombieCount).toBe(0);
    // no zombie is left behind in the sim
    expect([...sim.players.values()].filter((p) => p.kind === 'zombie')).toHaveLength(0);
    expect(me.kills).toBe(3);

    const hs = director.humans.get(me.id)!;
    expect(hs.scrap).toBe(3 * scrapForKill('walker', 1) + waveClearBonus(1));

    const scraps = ofType<ScrapMsg>(msgs, DH_S2C.Scrap);
    expect(scraps.filter((s) => s.reason === 'kill')).toHaveLength(3);
    expect(scraps.filter((s) => s.reason === 'clear')).toHaveLength(1);
    expect(ofType<LevelMsg>(msgs, DH_S2C.Level)).toEqual([{ level: 1, kills: 3, clearBonus: waveClearBonus(1) }]);
    const shop = ofType<ShopMsg>(msgs, DH_S2C.Shop);
    expect(shop).toHaveLength(1);
    expect(shop[0].offers).toHaveLength(3);
    expect(shop[0].scrap).toBe(hs.scrap);
    const waves = ofType<WaveMsg>(msgs, DH_S2C.Wave);
    expect(waves[0]).toMatchObject({ phase: 'combat', wave: 1, total: 3 });
    expect(waves.at(-1)).toMatchObject({ phase: 'shop', wave: 1, alive: 0, queued: 0 });
  });

  it('los zombis llegan solos hasta el jugador y le hacen daño (melee), sin armas', () => {
    const { sim, director, humans, step } = setup();
    const me = humans[0];
    me.protectTimer = 0;
    const zombies = () => [...sim.players.values()].filter((p) => p.kind === 'zombie');
    let hit = false;
    for (let t = 0; t < TICK_RATE * 60 && !hit; t++) {
      step();
      hit = me.hp < me.maxHp;
      if (director.phase !== 'combat') break;
    }
    expect(zombies().every((z) => z.team === 1 && z.shotsFired === 0)).toBe(true);
    expect(me.team).toBe(0);
    expect(hit, 'un zombi debió alcanzar al jugador').toBe(true);
    expect(me.hp).toBeLessThan(me.maxHp);
  });

  it('usa los stats del arquetipo escalados por la oleada', () => {
    const { sim, step } = setup();
    for (let t = 0; t < TICK_RATE * 2; t++) step();
    const z = [...sim.players.values()].find((p) => p.kind === 'zombie')!;
    expect(z).toBeDefined();
    expect(z.archetype).toBe('walker');
    expect(z.maxHp).toBe(Math.round(60 * (1 + 1 * 0.12)));
    expect(z.speedMult).toBeCloseTo((3.2 * 1.02) / 8.5, 2);
  });

  it('comprar en la tienda gasta scrap y aplica el efecto; "listo" abre la oleada 2', () => {
    const { sim, director, humans, msgs, step } = setup();
    const me = humans[0];
    for (let t = 0; t < TICK_RATE * 30 && director.phase === 'combat'; t++) {
      step();
      shootAllZombies(sim, me);
    }
    expect(director.phase).toBe('shop');
    const hs = director.humans.get(me.id)!;
    hs.scrap = 500; // enough for anything on offer
    expect(director.buy(me.id, 'unlockShotgun')).toBe('unavailable'); // not offered in wave 1

    const offered = ofType<ShopMsg>(msgs, DH_S2C.Shop).at(-1)!.offers.map((o) => o.id);
    const id = offered.find((o) => o === 'maxHealth' || o === 'hitscanDamage' || o === 'heal') ?? offered[0];
    const cost = hs.offers.find((o) => o.id === id)!.cost;
    expect(director.buy(me.id, id)).toBeNull();
    expect(hs.scrap).toBe(500 - cost);
    expect(hs.owned[id]).toBe(1);
    if (id === 'maxHealth') expect(me.maxHp).toBe(120);
    if (id === 'hitscanDamage') expect(me.damageMult).toBeCloseTo(1.1);

    // not enough scrap
    hs.scrap = 0;
    const other = hs.offers.find((o) => o.id !== id);
    if (other) expect(director.buy(me.id, other.id)).toBe('funds');

    director.setReady(me.id);
    step();
    expect(director.phase).toBe('combat');
    expect(director.wave).toBe(2);
    expect(director.humans.get(me.id)!.offers).toEqual([]);
    expect(director.buy(me.id, 'maxHealth')).toBe('closed');
  });

  it('la escopeta solo se puede usar tras comprarla (el rifle siempre)', () => {
    const { director, humans } = setup();
    const me = humans[0];
    expect(director.canUseWeapon(me.id, WeaponId.Rifle)).toBe(true);
    expect(director.canUseWeapon(me.id, WeaponId.Shotgun)).toBe(false);
    expect(director.canUseWeapon(me.id, WeaponId.Rocket)).toBe(false);
    director.humans.get(me.id)!.owned = { unlockShotgun: 1 };
    expect(director.canUseWeapon(me.id, WeaponId.Shotgun)).toBe(true);
  });

  it('fin de partida cuando caen todos los jugadores, con resumen', () => {
    const { sim, director, humans, msgs, step } = setup({ humans: 2 });
    for (let t = 0; t < TICK_RATE; t++) step();
    sim.kill(humans[0], -1, -1, false, 'fall');
    step();
    expect(director.phase).toBe('combat'); // the other one still stands
    sim.kill(humans[1], -1, -1, false, 'fall');
    step();
    expect(director.phase).toBe('gameover');
    const over = ofType<GameOverMsg>(msgs, DH_S2C.Over);
    expect(over).toHaveLength(1);
    expect(over[0].players.map((p) => p.name)).toEqual(['P1', 'P2']);
    expect(over[0].level).toBe(0);
    // nobody respawns in survival
    for (let t = 0; t < TICK_RATE * 5; t++) sim.step();
    expect(humans.every((h) => !h.alive)).toBe(true);
  });

  it('respeta el tope de vivos: el resto espera en cola', () => {
    const sim = new GameSim(settings, 7);
    const me = sim.addPlayer(1, 'P1', 0);
    const director = new WaveDirector(sim, {
      seed: 7,
      planWave: () => Array.from({ length: 10 }, () => 'walker' as const),
      graceSeconds: 0,
      maxAlive: 4,
    });
    director.registerHuman(1);
    director.start();
    for (let t = 0; t < TICK_RATE * 6; t++) {
      director.step();
      expect(director.zombieCount).toBeLessThanOrEqual(4);
    }
    expect(director.zombieCount).toBe(4);
    expect(director.queuedCount).toBe(6);
    // one dies -> one more comes in
    shootAllZombies(sim, me);
    for (let t = 0; t < TICK_RATE; t++) director.step();
    expect(director.queuedCount).toBeLessThan(6);
  });
});

describe('Reducto: Horda — sala Colyseus', () => {
  const PORT = 25567 + Math.floor(Math.random() * 1000);
  let server: Server;
  beforeAll(async () => {
    server = await createGameServer({ port: PORT, host: '127.0.0.1' });
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
  });

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (cond: () => boolean, timeout = 8000, label = 'condición') => {
    const t0 = Date.now();
    while (!cond()) {
      if (Date.now() - t0 > timeout) throw new Error(`timeout esperando ${label}`);
      await sleep(20);
    }
  };

  class Player {
    client = new Client(`http://127.0.0.1:${PORT}`);
    room!: Room;
    lobby?: LobbyState;
    start?: MatchStartMsg;
    snap?: SnapshotMsg;
    wave?: WaveMsg;
    waves: WaveMsg[] = [];
    level?: LevelMsg;
    shop?: ShopMsg;
    scrap?: ScrapMsg;
    over?: GameOverMsg;
    notices: string[] = [];

    private bind(room: Room) {
      this.room = room;
      room.onMessage(S2C.Lobby, (m: LobbyState) => (this.lobby = m));
      room.onMessage(S2C.MatchStart, (m: MatchStartMsg) => (this.start = m));
      room.onMessage(S2C.Snapshot, (m: SnapshotMsg) => (this.snap = m));
      room.onMessage(S2C.Notice, (m: { text: string }) => this.notices.push(m.text));
      room.onMessage(DH_S2C.Wave, (m: WaveMsg) => {
        this.wave = m;
        this.waves.push(m);
      });
      room.onMessage(DH_S2C.Level, (m: LevelMsg) => (this.level = m));
      room.onMessage(DH_S2C.Shop, (m: ShopMsg) => (this.shop = m));
      room.onMessage(DH_S2C.Scrap, (m: ScrapMsg) => (this.scrap = m));
      room.onMessage(DH_S2C.Over, (m: GameOverMsg) => (this.over = m));
      room.onMessage('*', () => {});
    }

    async create(name: string, game: string = ROOM_NAMES.deadhold) {
      this.bind(await this.client.create(ROOM_NAMES.deadhold, { name, game }));
      return this;
    }
    async join(code: string, name: string, game: string = ROOM_NAMES.deadhold) {
      this.bind(await this.client.joinById(code, { name, game }));
      return this;
    }
  }

  const localRoom = (p: Player) => matchMaker.getLocalRoomById(p.room.roomId) as unknown as DeadholdRoom;

  it('se une con options.game "deadhold"; otro juego queda fuera y viceversa', async () => {
    const a = await new Player().create('Alfa');
    await waitFor(() => a.lobby?.players.length === 1, 5000, 'lobby');
    expect(a.lobby!.settings).toMatchObject({ mode: 'survival', mapId: 'holdout' });
    expect(a.lobby!.maxPlayers).toBe(DEADHOLD.maxPlayers);

    await expect(new Player().join(a.room.roomId, 'Intruso', ROOM_NAMES.realtournament)).rejects.toThrow(/WRONG_GAME/);
    await expect(new Player().join(a.room.roomId, 'Anonimo', '')).rejects.toThrow(/WRONG_GAME/);
    // game "deadhold" cannot open a RealTournament room either
    const rt = await new Client(`http://127.0.0.1:${PORT}`).create(ROOM_NAMES.realtournament, { name: 'RT', game: ROOM_NAMES.realtournament });
    await expect(new Player().join(rt.roomId, 'Cruzado', ROOM_NAMES.deadhold)).rejects.toThrow(/WRONG_GAME/);
    await rt.leave();
    await a.room.leave();
  });

  it('coop: una oleada completa de 3 zombis, scrap, nivel, tienda y compra', async () => {
    const a = await new Player().create('Host');
    const b = await new Player().join(a.room.roomId, 'Coop');
    await waitFor(() => a.lobby?.players.length === 2, 5000, 'lobby de 2');
    const room = localRoom(a);
    room.directorOptions = { planWave: THREE_WALKERS, graceSeconds: 0.2, shopSeconds: 30 };

    // only the host starts
    b.room.send(C2S.Start);
    await sleep(250);
    expect(a.start).toBeUndefined();
    a.room.send(C2S.Start);
    await waitFor(() => !!a.start && !!b.start, 5000, 'inicio');
    expect(a.start!.roster).toHaveLength(2);
    await waitFor(() => a.wave?.phase === 'combat' && a.wave.wave === 1 && a.wave.total === 3, 5000, 'oleada 1');
    await expect(new Player().join(a.room.roomId, 'Tarde')).rejects.toThrow(/MATCH_IN_PROGRESS/);

    // zombies show up in the snapshots with the Zombie flag and an archetype in the weapon slot
    await waitFor(() => (a.snap?.p.filter((p) => p[6] & PF.Zombie).length ?? 0) === 3, 8000, '3 zombis en snapshot');
    const z = a.snap!.p.find((p) => p[6] & PF.Zombie)!;
    expect(z[7]).toBe(0); // walker
    expect(z[8]).toBe(1); // zombie team

    // the players' guns: kill them all through the authoritative sim
    const sim = room.debugSim!;
    const aid = [...sim.players.values()].find((p) => p.name === 'Host')!;
    for (const zb of [...sim.players.values()].filter((p) => p.kind === 'zombie')) {
      sim.damage(zb, aid.id, 9999, WeaponId.Rifle, 'body', { x: zb.sim.x, y: 1, z: zb.sim.z }, { x: 0, y: 1.5, z: 0 });
    }
    await waitFor(() => !!a.level && a.wave?.phase === 'shop', 5000, 'tienda');
    expect(a.level).toMatchObject({ level: 1, kills: 3 });
    // only the killer got the kill scrap; both get the clear bonus
    expect(a.scrap).toBeDefined();
    expect(a.shop!.offers.length).toBe(3);
    expect(a.shop!.scrap).toBe(3 * scrapForKill('walker', 1) + waveClearBonus(1));
    await waitFor(() => !!b.shop, 3000, 'tienda de Coop');
    expect(b.shop!.scrap).toBe(waveClearBonus(1));

    // buy something affordable and see the personal state change
    const affordable = a.shop!.offers.find((o) => o.cost <= a.shop!.scrap)!;
    expect(affordable).toBeDefined();
    const before = a.shop!.scrap;
    a.shop = undefined;
    a.room.send(DH_C2S.Buy, { id: affordable.id });
    await waitFor(() => !!a.shop, 3000, 'compra');
    expect(a.shop!.scrap).toBe(before - affordable.cost);
    expect(a.shop!.owned[affordable.id]).toBe(1);
    // garbage ids are ignored, a purchase the player cannot afford is refused with a notice
    a.room.send(DH_C2S.Buy, { id: 'noExiste' });
    const tooExpensive = b.shop!.offers.find((o) => o.cost > b.shop!.scrap)!;
    expect(tooExpensive).toBeDefined();
    b.room.send(DH_C2S.Buy, { id: tooExpensive.id });
    await waitFor(() => b.notices.length > 0, 3000, 'aviso de fondos');

    // everybody ready -> next wave
    a.room.send(DH_C2S.Ready);
    b.room.send(DH_C2S.Ready);
    await waitFor(() => a.wave?.phase === 'combat' && a.wave.wave === 2, 5000, 'oleada 2');

    await a.room.leave();
    await b.room.leave();
  });

  it('fin de partida: Over con resumen y regreso al lobby', async () => {
    const a = await new Player().create('Solo');
    await waitFor(() => a.lobby?.players.length === 1, 5000, 'lobby');
    localRoom(a).directorOptions = { planWave: THREE_WALKERS, graceSeconds: 0.2 };
    a.room.send(C2S.Start);
    await waitFor(() => !!a.start, 5000, 'inicio');
    const sim = localRoom(a).debugSim!;
    const me = [...sim.players.values()].find((p) => p.kind === 'human')!;
    sim.kill(me, -1, -1, false, 'fall');
    await waitFor(() => !!a.over, 5000, 'game over');
    expect(a.over).toMatchObject({ level: 0, wave: 1 });
    expect(a.over!.players).toHaveLength(1);
    await waitFor(() => a.lobby?.phase === 'results', 3000, 'fase resultados');
    a.room.send(C2S.ToLobby);
    await waitFor(() => a.lobby?.phase === 'lobby', 3000, 'lobby');
    await a.room.leave();
  });
});
