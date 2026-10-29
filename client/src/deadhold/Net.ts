import { Client, type Room } from '@colyseus/sdk';
import {
  C2S,
  DH_C2S,
  DH_S2C,
  encodeInput,
  type GameEvent,
  type GameOverMsg,
  type InputCmd,
  type LevelMsg,
  type LobbyState,
  type MatchResults,
  type MatchSettings,
  type MatchStartMsg,
  type NoticeMsg,
  ROOM_NAMES,
  S2C,
  type ScoreEntry,
  type ScrapMsg,
  type ShopMsg,
  type SkinMsg,
  type SnapshotMsg,
  type UpgradeId,
  type WaveMsg,
  type WelcomeMsg,
} from '@arena/shared';
import type { NetHandlers } from '../net/Net';

export interface DeadholdNetHandlers extends NetHandlers {
  wave(m: WaveMsg): void;
  shop(m: ShopMsg): void;
  level(m: LevelMsg): void;
  scrap(m: ScrapMsg): void;
  over(m: GameOverMsg): void;
}

const ROOM_NAME = ROOM_NAMES.deadhold;
const TOKEN_KEY = 'deadhold-reconnect';

export const defaultServerUrl = (): string => {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  return import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;
};

export const describeJoinError = (err: unknown): string => {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (/WRONG_GAME/i.test(msg)) return 'Ese código pertenece a otro juego, no a Reducto: Horda.';
  if (/MATCH_IN_PROGRESS/i.test(msg)) return 'La partida ya está en curso. Espera a que termine o crea otra sala.';
  if (/ROOM_FULL|is locked|already full/i.test(msg)) return 'La sala está llena (máx. 4).';
  if (/not found|disposed|invalid/i.test(msg)) return 'No existe ninguna sala con ese código.';
  if (/expired/i.test(msg)) return 'La sesión anterior expiró.';
  if (/fetch|network|ECONNREFUSED|Failed|connect/i.test(msg)) return 'No se pudo conectar con el servidor. ¿Está en marcha?';
  return msg || 'Error desconocido.';
};

/** Colyseus client for the `deadhold` room + wave/shop messages. */
export class DeadholdNet {
  private client: Client;
  room: Room | null = null;
  rtt = 0;
  private pingTimer = 0;
  private leaving = false;
  private fakeLag = Number(new URLSearchParams(location.search).get('lag') ?? 0);

  constructor(
    public serverUrl: string,
    private h: DeadholdNetHandlers,
  ) {
    this.client = new Client(serverUrl);
  }

  setServer(url: string) {
    this.serverUrl = url;
    this.client = new Client(url);
  }

  async create(name: string): Promise<void> {
    this.bind(await this.client.create(ROOM_NAME, { name, game: ROOM_NAME }));
  }

  async join(code: string, name: string): Promise<void> {
    this.bind(await this.client.joinById(code.trim().toUpperCase(), { name, game: ROOM_NAME }));
  }

  async tryResume(): Promise<boolean> {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return false;
    try {
      const { token, at } = JSON.parse(raw) as { token: string; at: number };
      if (Date.now() - at > 20000) throw new Error('expired');
      this.bind(await this.client.reconnect(token));
      return true;
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      return false;
    }
  }

  private storeToken() {
    if (!this.room) return;
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: this.room.reconnectionToken, at: Date.now() }));
  }

  private bind(room: Room) {
    this.room = room;
    this.leaving = false;
    room.reconnection.minUptime = 1000;
    room.reconnection.maxRetries = 12;
    const on = <T>(type: string, fn: (m: T) => void) =>
      room.onMessage(type, (m: T) => (this.fakeLag > 0 ? setTimeout(() => fn(m), this.fakeLag) : fn(m)));
    on<WelcomeMsg>(S2C.Welcome, (m) => this.h.welcome(m));
    on<LobbyState>(S2C.Lobby, (m) => this.h.lobby(m));
    on<MatchStartMsg>(S2C.MatchStart, (m) => this.h.matchStart(m));
    on<SnapshotMsg>(S2C.Snapshot, (m) => this.h.snapshot(m));
    on<GameEvent[]>(S2C.Events, (m) => this.h.events(m));
    on<ScoreEntry[]>(S2C.Scoreboard, (m) => this.h.scoreboard(m));
    on<MatchResults>(S2C.MatchEnd, (m) => this.h.matchEnd(m));
    on<NoticeMsg>(S2C.Notice, (m) => this.h.notice(m));
    on<SkinMsg>(S2C.Skin, (m) => this.h.skin(m));
    on<WaveMsg>(DH_S2C.Wave, (m) => this.h.wave(m));
    on<ShopMsg>(DH_S2C.Shop, (m) => this.h.shop(m));
    on<LevelMsg>(DH_S2C.Level, (m) => this.h.level(m));
    on<ScrapMsg>(DH_S2C.Scrap, (m) => this.h.scrap(m));
    on<GameOverMsg>(DH_S2C.Over, (m) => this.h.over(m));
    on<{ t: number }>(S2C.Pong, (m) => {
      const sample = performance.now() - m.t;
      this.rtt = this.rtt === 0 ? sample : this.rtt * 0.8 + sample * 0.2;
    });
    room.onDrop(() => this.h.dropped());
    room.onReconnect(() => {
      this.storeToken();
      this.h.reconnected();
    });
    room.onLeave((code: number) => {
      window.clearInterval(this.pingTimer);
      this.room = null;
      sessionStorage.removeItem(TOKEN_KEY);
      if (!this.leaving) this.h.left(code === 4000 || code === 1000 ? 'Saliste de la sala.' : `Conexión cerrada (código ${code}).`);
    });
    this.storeToken();
    window.clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => {
      this.send(C2S.Ping, { t: performance.now(), rtt: Math.round(this.rtt) });
      this.storeToken();
    }, 1000);
  }

  private send(type: string, payload?: unknown) {
    const room = this.room;
    if (!room) return;
    if (this.fakeLag > 0) setTimeout(() => room.send(type, payload), this.fakeLag);
    else room.send(type, payload);
  }

  sendInput(cmd: InputCmd) {
    this.send(C2S.Input, encodeInput(cmd));
  }
  setReady(ready: boolean) {
    this.send(C2S.Ready, { ready });
  }
  setTeam(_team: 0 | 1) {
    /* coop: un solo equipo */
  }
  start() {
    this.send(C2S.Start);
  }
  sendSkin(png: Uint8Array | null) {
    this.send(C2S.Skin, { png });
  }
  rematch() {
    this.send(C2S.Rematch);
  }
  toLobby() {
    this.send(C2S.ToLobby);
  }
  buyUpgrade(id: UpgradeId) {
    this.send(DH_C2S.Buy, { id });
  }
  shopReady() {
    this.send(DH_C2S.Ready);
  }
  updateSettings(_s: Partial<MatchSettings>) {
    /* holdout fijo en servidor */
  }

  async leave() {
    this.leaving = true;
    window.clearInterval(this.pingTimer);
    sessionStorage.removeItem(TOKEN_KEY);
    const room = this.room;
    this.room = null;
    if (room) await room.leave(true).catch(() => undefined);
  }
}
