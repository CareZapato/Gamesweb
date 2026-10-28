import { Client, type Room } from '@colyseus/sdk';
import {
  C2S,
  encodeInput,
  type GameEvent,
  type InputCmd,
  type LobbyState,
  type MatchResults,
  type MatchSettings,
  type MatchStartMsg,
  type NoticeMsg,
  ROOM_NAMES,
  S2C,
  type ScoreEntry,
  type SkinMsg,
  type SnapshotMsg,
  type WelcomeMsg,
} from '@arena/shared';

export interface NetHandlers {
  welcome(m: WelcomeMsg): void;
  lobby(m: LobbyState): void;
  matchStart(m: MatchStartMsg): void;
  snapshot(m: SnapshotMsg): void;
  events(m: GameEvent[]): void;
  scoreboard(m: ScoreEntry[]): void;
  matchEnd(m: MatchResults): void;
  notice(m: NoticeMsg): void;
  skin(m: SkinMsg): void;
  dropped(): void;
  reconnected(): void;
  left(reason: string): void;
}

const ROOM_NAME = ROOM_NAMES.realtournament;
const TOKEN_KEY = 'realtournament-reconnect';
/** Key used before the game was renamed from Arena Vértice; dropped on startup. */
const LEGACY_TOKEN_KEY = 'arena-vertice-reconnect';

export const defaultServerUrl = (): string => {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  // dev: Vite on :5173, game server on :2567 of the same host. Production: same origin as the page.
  return import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;
};

/** Converts matchmaking/server errors into messages a player understands. */
export const describeJoinError = (err: unknown): string => {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (/WRONG_GAME/i.test(msg)) return 'Ese código pertenece a otro juego, no a RealTournament.';
  if (/MATCH_IN_PROGRESS/i.test(msg)) return 'La partida de esa sala ya está en curso. Espera a que termine.';
  if (/ROOM_FULL|is locked|already full/i.test(msg)) return 'La sala está llena.';
  if (/not found|disposed|invalid/i.test(msg)) return 'No existe ninguna sala con ese código.';
  if (/expired/i.test(msg)) return 'La sesión anterior expiró.';
  if (/fetch|network|ECONNREFUSED|Failed|connect/i.test(msg)) return 'No se pudo conectar con el servidor. ¿Está en marcha?';
  return msg || 'Error desconocido.';
};

/** Wraps the Colyseus SDK: room lifecycle, typed messages, ping and reconnection token storage. */
export class Net {
  private client: Client;
  room: Room | null = null;
  rtt = 0;
  private pingTimer = 0;
  private leaving = false;
  /** Optional artificial delay (ms, each way) for testing: ?lag=100 */
  private fakeLag = Number(new URLSearchParams(location.search).get('lag') ?? 0);

  constructor(
    public serverUrl: string,
    private h: NetHandlers,
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

  /** Tries to resume a session lost by a page reload. */
  async tryResume(): Promise<boolean> {
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
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
  setTeam(team: 0 | 1) {
    this.send(C2S.Team, { team });
  }
  updateSettings(s: Partial<MatchSettings>) {
    this.send(C2S.Settings, s);
  }
  start() {
    this.send(C2S.Start);
  }
  /** Sends the player's skin PNG (already checked by the client); null goes back to the default. */
  sendSkin(png: Uint8Array | null) {
    this.send(C2S.Skin, { png });
  }
  rematch() {
    this.send(C2S.Rematch);
  }
  toLobby() {
    this.send(C2S.ToLobby);
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
