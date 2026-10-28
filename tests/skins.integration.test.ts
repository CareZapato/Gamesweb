import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import type { Server } from '@colyseus/core';
import { C2S, type NoticeMsg, ROOM_NAMES, S2C, SKIN, type SkinMsg } from '@arena/shared';
import { createGameServer } from '../server/src/createGameServer';
import { buildDefaultSkin, encodePng, PALETTE_BLUE, PALETTE_GOLD, PALETTE_RED } from '../scripts/skins';

const ROOM_NAME = ROOM_NAMES.realtournament;
const PORT = 25567 + Math.floor(Math.random() * 1000);
let server: Server;

beforeAll(async () => {
  server = await createGameServer({ port: PORT, host: '127.0.0.1' });
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (cond: () => boolean, timeout = 5000, label = 'condición') => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > timeout) throw new Error(`timeout esperando ${label}`);
    await sleep(20);
  }
};

class P {
  room!: Room;
  skins = new Map<number, Uint8Array | null>();
  notices: NoticeMsg[] = [];
  id = -1;
  private bind(room: Room) {
    this.room = room;
    room.onMessage(S2C.Welcome, (m: { playerId: number }) => (this.id = m.playerId));
    room.onMessage(S2C.Skin, (m: SkinMsg) => this.skins.set(m.id, m.png ? new Uint8Array(m.png) : null));
    room.onMessage(S2C.Notice, (m: NoticeMsg) => this.notices.push(m));
    room.onMessage('*', () => {});
  }
  async create(name: string) {
    this.bind(await new Client(`http://127.0.0.1:${PORT}`).create(ROOM_NAME, { name, game: ROOM_NAME }));
    return this;
  }
  async join(code: string, name: string) {
    this.bind(await new Client(`http://127.0.0.1:${PORT}`).joinById(code, { name, game: ROOM_NAME }));
    return this;
  }
  sendSkin(png: Uint8Array | null) {
    this.room.send(C2S.Skin, { png });
  }
}

const red = new Uint8Array(buildDefaultSkin(PALETTE_RED).png());
const gold256 = new Uint8Array(buildDefaultSkin(PALETTE_GOLD, 256).png());
const blue = new Uint8Array(buildDefaultSkin(PALETTE_BLUE).png());

describe('skins por jugador en la sala (Colyseus real)', () => {
  it('una skin válida se retransmite a toda la sala, incluido quien entra después, y se descarta al salir', async () => {
    const a = await new P().create('Alfa');
    const code = a.room.roomId;
    const b = await new P().join(code, 'Bravo');
    await waitFor(() => a.id > 0 && b.id > 0);

    a.sendSkin(red);
    await waitFor(() => a.skins.has(a.id) && b.skins.has(a.id), 5000, 'skin de A en A y B');
    expect(b.skins.get(a.id)).toEqual(red);
    expect(a.skins.get(a.id)).toEqual(red); // the sender gets the confirmation too

    // a 256 px skin and a late joiner
    await sleep(SKIN.minIntervalMs + 100);
    b.sendSkin(gold256);
    await waitFor(() => a.skins.has(b.id), 5000, 'skin de B');
    expect(a.skins.get(b.id)).toEqual(gold256);

    const c = await new P().join(code, 'Charlie');
    await waitFor(() => c.skins.has(a.id) && c.skins.has(b.id), 5000, 'skins para quien entra después');
    expect(c.skins.get(a.id)).toEqual(red);
    expect(c.skins.get(b.id)).toEqual(gold256);

    // leaving drops the skin from everybody's view
    const aid = a.id;
    await a.room.leave();
    await waitFor(() => b.skins.get(aid) === null && c.skins.get(aid) === null, 5000, 'skin descartada');
    await b.room.leave();
    await c.room.leave();
  });

  it('rechaza skins inválidas con un aviso y sin retransmitirlas; mantiene la anterior', async () => {
    const a = await new P().create('Alfa');
    const b = await new P().join(a.room.roomId, 'Bravo');
    await waitFor(() => a.id > 0 && b.id > 0);
    a.sendSkin(blue);
    await waitFor(() => b.skins.has(a.id));
    const before = b.skins.get(a.id);

    const bad: [string, Uint8Array][] = [
      ['tamaño', new Uint8Array(encodePng(100, 100, new Uint8Array(100 * 100 * 4)))],
      ['no PNG', new Uint8Array(2000).fill(9)],
      ['peso', new Uint8Array(SKIN.maxBytes + 500).fill(1)],
    ];
    for (const [name, png] of bad) {
      const n = a.notices.length;
      await sleep(SKIN.minIntervalMs + 50);
      a.sendSkin(png);
      await waitFor(() => a.notices.length > n, 5000, `aviso por ${name}`);
      expect(a.notices.at(-1)!.text).toMatch(/Skin rechazada/);
    }
    expect(b.skins.get(a.id)).toEqual(before);
    await a.room.leave();
    await b.room.leave();
  });

  it('limita la frecuencia de cambios y permite volver a la skin por defecto', async () => {
    const a = await new P().create('Alfa');
    const b = await new P().join(a.room.roomId, 'Bravo');
    await waitFor(() => a.id > 0 && b.id > 0);
    a.sendSkin(red);
    a.sendSkin(blue); // immediately after: refused
    await waitFor(() => a.notices.some((n) => /Espera/.test(n.text)), 5000, 'aviso de frecuencia');
    expect(b.skins.get(a.id)).toEqual(red);
    await sleep(SKIN.minIntervalMs + 100);
    a.sendSkin(null);
    await waitFor(() => b.skins.get(a.id) === null, 5000, 'skin quitada');
    await a.room.leave();
    await b.room.leave();
  });
});
