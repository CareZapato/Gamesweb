import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import type { Server } from '@colyseus/core';
import {
  Btn,
  C2S,
  encodeInput,
  getMap,
  type LobbyState,
  type MatchResults,
  type MatchStartMsg,
  ROOM,
  ROOM_NAMES,
  S2C,
  type SnapshotMsg,
  type WelcomeMsg,
} from '@arena/shared';
import { GameRoom } from '../server/src/GameRoom';
import { createGameServer } from '../server/src/createGameServer';

const ROOM_NAME = ROOM_NAMES.realtournament;
/** A second game, registered only in tests, to prove that games are isolated from each other. */
const OTHER_ROOM_NAME = 'othergame';
class OtherGameRoom extends GameRoom {}

const PORT = 24567 + Math.floor(Math.random() * 1000);
let server: Server;

beforeAll(async () => {
  server = await createGameServer({ port: PORT, host: '127.0.0.1' });
  server.define(OTHER_ROOM_NAME, OtherGameRoom);
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Thin test client that records the latest messages of each type. */
class TestPlayer {
  client = new Client(`http://127.0.0.1:${PORT}`);
  room!: Room;
  welcome?: WelcomeMsg;
  lobby?: LobbyState;
  start?: MatchStartMsg;
  snap?: SnapshotMsg;
  results?: MatchResults;
  snaps = 0;
  seq = 0;

  private bind(room: Room) {
    this.room = room;
    room.onMessage(S2C.Welcome, (m: WelcomeMsg) => (this.welcome = m));
    room.onMessage(S2C.Lobby, (m: LobbyState) => (this.lobby = m));
    room.onMessage(S2C.MatchStart, (m: MatchStartMsg) => (this.start = m));
    room.onMessage(S2C.Snapshot, (m: SnapshotMsg) => {
      this.snap = m;
      this.snaps++;
    });
    room.onMessage(S2C.MatchEnd, (m: MatchResults) => (this.results = m));
    room.onMessage('*', () => {});
  }

  async create(name: string, options: Record<string, unknown> = {}, roomName: string = ROOM_NAME) {
    this.bind(await this.client.create(roomName, { name, game: roomName, ...options }));
    return this;
  }

  /** `game` is what the client believes it is joining; the server checks it against the room's own game. */
  async join(code: string, name: string, game: string = ROOM_NAME) {
    this.bind(await this.client.joinById(code, { name, game }));
    return this;
  }

  input(buttons: number, yaw = 0) {
    this.room.send(C2S.Input, encodeInput({ seq: ++this.seq, buttons, yaw, pitch: 0, weapon: 0, viewTick: this.snap?.t ?? 0 }));
  }
}

const waitFor = async (cond: () => boolean, timeout = 5000, label = 'condición') => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > timeout) throw new Error(`timeout esperando ${label}`);
    await sleep(20);
  }
};

describe('integración cliente-servidor (Colyseus real)', () => {
  it('dos clientes: crear por código, unirse, iniciar y compartir el mismo estado', async () => {
    const a = await new TestPlayer().create('Alfa');
    const code = a.room.roomId;
    expect(code).toMatch(new RegExp(`^[${ROOM.codeAlphabet}]{${ROOM.codeLength}}$`));
    const b = await new TestPlayer().join(code.toLowerCase().toUpperCase(), 'Bravo');
    await waitFor(() => a.lobby?.players.length === 2 && b.lobby?.players.length === 2, 5000, 'lobby con 2');
    expect(a.lobby!.hostId).toBe(a.welcome!.playerId);

    // only the host can start, and only when others are ready
    b.room.send(C2S.Start);
    a.room.send(C2S.Start);
    await sleep(200);
    expect(a.start).toBeUndefined();
    b.room.send(C2S.Ready, { ready: true });
    await waitFor(() => a.lobby?.players.find((p) => p.name === 'Bravo')?.ready === true, 5000, 'listo');
    await sleep(120); // lobby action throttle
    a.room.send(C2S.Start);
    await waitFor(() => !!a.start && !!b.start, 5000, 'inicio');
    await waitFor(() => (a.snap?.p.length ?? 0) === 2 && (b.snap?.p.length ?? 0) === 2, 5000, 'snapshots');

    // B walks forward for ~1 s; A must see B move (server-authoritative positions)
    const bid = b.welcome!.playerId;
    const before = a.snap!.p.find((p) => p[0] === bid)!;
    await sleep(1600); // spawn protection / settle
    const start = a.snap!.p.find((p) => p[0] === bid)!;
    // walk the way the spawn faces (spawns face open space; a fixed direction may hit cover)
    const spawns = getMap(a.start!.settings.mapId)!.spawns;
    const spawn = spawns.reduce((best, s) =>
      Math.hypot(s.pos[0] * 100 - start[1], s.pos[2] * 100 - start[3]) < Math.hypot(best.pos[0] * 100 - start[1], best.pos[2] * 100 - start[3]) ? s : best,
    );
    for (let i = 0; i < 30; i++) {
      b.input(Btn.Forward, spawn.yaw);
      await sleep(33);
    }
    await sleep(300);
    const after = a.snap!.p.find((p) => p[0] === bid)!;
    const moved = Math.hypot(after[1] - start[1], after[3] - start[3]) / 100;
    expect(before).toBeDefined();
    expect(moved).toBeGreaterThan(2);
    // both clients agree on B's position
    const seenByB = b.snap!.p.find((p) => p[0] === bid)!;
    expect(Math.abs(seenByB[1] - after[1])).toBeLessThan(150);
    // B's acknowledged input sequence advanced
    expect(b.snap!.a).toBeGreaterThan(20);

    await a.room.leave();
    await b.room.leave();
  });

  it('rechaza códigos inexistentes', async () => {
    const p = new TestPlayer();
    await expect(p.join('ZZZZZZ', 'X')).rejects.toThrow();
  });

  it('rechaza unirse con partida en curso y con la sala llena', async () => {
    const a = await new TestPlayer().create('Host', { maxPlayers: 2 });
    const code = a.room.roomId;
    const b = await new TestPlayer().join(code, 'Dos');
    await waitFor(() => a.lobby?.players.length === 2, 5000, 'lobby');
    await expect(new TestPlayer().join(code, 'Tres')).rejects.toThrow();

    await b.room.leave();
    await waitFor(() => a.lobby?.players.length === 1, 5000, 'salida');
    a.room.send(C2S.Start);
    await waitFor(() => !!a.start, 5000, 'inicio');
    await expect(new TestPlayer().join(code, 'Tarde')).rejects.toThrow(/MATCH_IN_PROGRESS/);
    await a.room.leave();
  });

  it('si el anfitrión sale, el rol pasa a otro jugador', async () => {
    const a = await new TestPlayer().create('Host');
    const b = await new TestPlayer().join(a.room.roomId, 'Sucesor');
    await waitFor(() => b.lobby?.players.length === 2, 5000, 'lobby');
    await a.room.leave();
    await waitFor(() => b.lobby?.players.length === 1, 5000, 'salida host');
    expect(b.lobby!.hostId).toBe(b.welcome!.playerId);
    await b.room.leave();
  });

  it('reconexión con token tras una caída de conexión', async () => {
    const a = await new TestPlayer().create('Host');
    const b = await new TestPlayer().join(a.room.roomId, 'Inestable');
    b.room.reconnection.enabled = false;
    await waitFor(() => a.lobby?.players.length === 2, 5000, 'lobby');
    const token = b.room.reconnectionToken;
    const bid = b.welcome!.playerId;
    await b.room.leave(false);
    await waitFor(() => a.lobby?.players.find((p) => p.id === bid)?.connected === false, 5000, 'desconexión');
    const b2 = new TestPlayer();
    (b2 as unknown as { bind(r: Room): void }).bind(await b2.client.reconnect(token));
    await waitFor(() => a.lobby?.players.find((p) => p.id === bid)?.connected === true, 5000, 'reconexión');
    expect(a.lobby!.players.length).toBe(2);
    await b2.room.leave();
    await a.room.leave();
  });

  it('final de partida (límite de tiempo) y regreso al lobby', async () => {
    const a = await new TestPlayer().create('Host');
    // shortest allowed limit is too long for a test: drive the sim directly through the room
    a.room.send(C2S.Start);
    await waitFor(() => !!a.start, 5000, 'inicio');
    const { matchMaker } = await import('@colyseus/core');
    const room = matchMaker.getLocalRoomById(a.room.roomId) as unknown as { debugSim: { end(r: string): void } | null };
    room.debugSim!.end('time');
    await waitFor(() => !!a.results, 5000, 'resultados');
    expect(a.results!.reason).toBe('time');
    await waitFor(() => a.lobby?.phase === 'results', 5000, 'fase resultados');
    a.room.send(C2S.ToLobby);
    await waitFor(() => a.lobby?.phase === 'lobby', 5000, 'regreso al lobby');
    await a.room.leave();
  });
});

describe('salas aisladas por juego', () => {
  it('un código de RealTournament no permite entrar desde otro roomName', async () => {
    const rt = await new TestPlayer().create('Host');
    const code = rt.room.roomId;
    await waitFor(() => rt.lobby?.players.length === 1, 5000, 'lobby');

    // a client of another game with the RealTournament code: refused with a clear error
    await expect(new TestPlayer().join(code, 'Intruso', OTHER_ROOM_NAME)).rejects.toThrow(/WRONG_GAME/);
    // a client that does not state any game is refused too
    await expect(new TestPlayer().join(code, 'Anonimo', '')).rejects.toThrow(/WRONG_GAME/);
    await sleep(150);
    expect(rt.lobby!.players.length).toBe(1);

    // the right game still works with the same code
    const ok = await new TestPlayer().join(code, 'Legitimo');
    await waitFor(() => rt.lobby?.players.length === 2, 5000, 'segundo jugador');
    await ok.room.leave();
    await rt.room.leave();
  });

  it('y al revés: un código de otro juego no permite entrar a RealTournament', async () => {
    const other = await new TestPlayer().create('Otro', {}, OTHER_ROOM_NAME);
    const code = other.room.roomId;
    expect(other.room.name).toBe(OTHER_ROOM_NAME);
    await expect(new TestPlayer().join(code, 'RT', ROOM_NAME)).rejects.toThrow(/WRONG_GAME/);
    await other.room.leave();
  });

  it('los códigos son únicos globalmente entre juegos', async () => {
    const players: TestPlayer[] = [];
    for (let i = 0; i < 12; i++) players.push(await new TestPlayer().create(`P${i}`, {}, i % 2 === 0 ? ROOM_NAME : OTHER_ROOM_NAME));
    const codes = players.map((p) => p.room.roomId);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(new RegExp(`^[${ROOM.codeAlphabet}]{${ROOM.codeLength}}$`));
    await Promise.all(players.map((p) => p.room.leave()));
  });

  it('una sala vacía desaparece y su código ya no sirve', async () => {
    const a = await new TestPlayer().create('Efimero');
    const code = a.room.roomId;
    await a.room.leave();
    await sleep(300);
    await expect(new TestPlayer().join(code, 'Tarde')).rejects.toThrow();
  });
});
