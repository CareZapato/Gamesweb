import { type Client, ServerError } from '@colyseus/core';
import {
  C2S,
  DEADHOLD,
  decodeInput,
  defaultMapFor,
  DH_C2S,
  isFiniteNum,
  type LobbyState,
  type MatchSettings,
  type MatchStartMsg,
  MODE_RULES,
  NET,
  type NoticeMsg,
  type Phase,
  RESULTS_SECONDS,
  S2C,
  sanitizeName,
  SNAPSHOT_EVERY_TICKS,
  type SnapshotMsg,
  TICK_RATE,
  UPGRADE_IDS,
  type UpgradeId,
  type WelcomeMsg,
} from '@arena/shared';
import { GameRoom, JoinError } from './GameRoom';
import { GameSim } from './game/GameSim';
import { WaveDirector, type WaveDirectorOptions } from './game/WaveDirector';

interface Member {
  id: number;
  sessionId: string;
  client: Client;
  name: string;
  connected: boolean;
  ping: number;
  joinedAt: number;
}

const BUY_REFUSED: Record<string, string> = {
  closed: 'La tienda está cerrada.',
  dead: 'No puedes comprar estando caído.',
  unavailable: 'Esa mejora no está disponible.',
  maxed: 'Esa mejora ya está al máximo.',
  funds: 'No tienes suficiente scrap.',
};

/**
 * Reducto: Horda — one room = one co-op run (1–4 players) against waves of zombies. Same skeleton as
 * `ArenaRoom` (code, lobby, authoritative sim, snapshots) but the rules live in `WaveDirector`:
 * combat → shop → combat … until every player has fallen. Players move and shoot with the very same
 * `GameSim` code as in RealTournament; zombies are sim entities driven by `ZombieBrain`.
 */
export class DeadholdRoom extends GameRoom {
  maxClients: number = DEADHOLD.maxPlayers;
  maxMessagesPerSecond = NET.maxMessagesPerSecond;

  /** Tuning hook for tests (never read from client options). */
  directorOptions: WaveDirectorOptions = {};

  private members = new Map<string, Member>();
  private hostSession = '';
  private phase: Phase = 'lobby';
  private settings: MatchSettings = {
    mode: 'survival',
    mapId: defaultMapFor('survival').id,
    timeLimit: MODE_RULES.survival.defaultTimeLimit,
    scoreLimit: MODE_RULES.survival.defaultScoreLimit,
    botCount: 0,
    botDifficulty: 'normal',
  };
  private sim: GameSim | null = null;
  private director: WaveDirector | null = null;
  private nextPlayerId = 1;
  private lastStartAt = 0;
  private resultsTimer: { clear(): void } | null = null;

  onCreate(options: unknown) {
    super.onCreate(options);

    this.onMessage(C2S.Input, (client, raw) => {
      if (this.phase !== 'playing' || !this.sim || !this.director) return;
      const m = this.members.get(client.sessionId);
      const cmd = decodeInput(raw);
      if (!m || !cmd) return;
      // only the weapons the player has earned: anything else keeps the current one
      if (!this.director.canUseWeapon(m.id, cmd.weapon)) cmd.weapon = this.sim.players.get(m.id)?.sim.weapon ?? 0;
      this.sim.queueInput(m.id, cmd);
    });

    this.onMessage(C2S.Ping, (client, raw: { t?: unknown; rtt?: unknown }) => {
      const m = this.members.get(client.sessionId);
      if (!m) return;
      if (isFiniteNum(raw?.rtt)) m.ping = Math.max(0, Math.min(2000, Math.round(raw.rtt)));
      if (isFiniteNum(raw?.t)) client.send(S2C.Pong, { t: raw.t });
    });

    this.onMessage(C2S.Start, (client) => {
      if (!this.members.has(client.sessionId) || this.phase !== 'lobby') return;
      if (client.sessionId !== this.hostSession) return this.notice(client, 'warn', 'Solo el anfitrión puede iniciar la partida.');
      this.startMatch();
    });

    this.onMessage(C2S.Rematch, (client) => {
      if (this.phase !== 'results' || client.sessionId !== this.hostSession) return;
      this.startMatch();
    });

    this.onMessage(C2S.ToLobby, (client) => {
      if (this.phase !== 'results' || client.sessionId !== this.hostSession) return;
      this.returnToLobby();
    });

    this.onMessage(DH_C2S.Buy, (client, raw: { id?: unknown }) => {
      const m = this.members.get(client.sessionId);
      if (!m || this.phase !== 'playing' || !this.director) return;
      const id = raw?.id;
      if (typeof id !== 'string' || !(UPGRADE_IDS as readonly string[]).includes(id)) return;
      const refused = this.director.buy(m.id, id as UpgradeId);
      if (refused) this.notice(client, 'warn', BUY_REFUSED[refused] ?? 'Compra rechazada.');
    });

    this.onMessage(DH_C2S.Ready, (client) => {
      const m = this.members.get(client.sessionId);
      if (m && this.phase === 'playing') this.director?.setReady(m.id);
    });

    this.setFixedTimestep(() => this.tickMatch(), TICK_RATE);
  }

  onJoin(client: Client, options: { name?: unknown }) {
    if (this.phase === 'playing') throw new ServerError(JoinError.InProgress, 'MATCH_IN_PROGRESS');
    if (this.members.size >= this.maxClients) throw new ServerError(JoinError.Full, 'ROOM_FULL');
    const m: Member = {
      id: this.nextPlayerId++,
      sessionId: client.sessionId,
      client,
      name: this.uniqueName(sanitizeName(options?.name, 16)),
      connected: true,
      ping: 0,
      joinedAt: Date.now(),
    };
    this.members.set(client.sessionId, m);
    if (!this.hostSession) this.hostSession = client.sessionId;
    client.send(S2C.Welcome, { playerId: m.id, code: this.code } satisfies WelcomeMsg);
    this.broadcastLobby();
  }

  onDrop(client: Client) {
    const m = this.members.get(client.sessionId);
    if (!m) return;
    m.connected = false;
    this.sim?.setConnected(m.id, false);
    if (this.hostSession === client.sessionId) this.transferHost();
    this.broadcastLobby();
    this.allowReconnection(client, NET.reconnectSeconds);
  }

  onReconnect(client: Client) {
    const m = this.members.get(client.sessionId);
    if (!m) return;
    m.connected = true;
    m.client = client;
    if (!this.hostSession) this.hostSession = client.sessionId;
    client.send(S2C.Welcome, { playerId: m.id, code: this.code } satisfies WelcomeMsg);
    if (this.phase === 'playing' && this.sim) {
      this.sim.setConnected(m.id, true);
      client.send(S2C.MatchStart, this.matchStartFor(m));
      this.director?.resync(m.id);
    }
    this.broadcastLobby();
  }

  onLeave(client: Client) {
    const m = this.members.get(client.sessionId);
    if (!m) return;
    this.members.delete(client.sessionId);
    this.sim?.removePlayer(m.id);
    this.director?.removeHuman(m.id);
    if (this.hostSession === client.sessionId) this.transferHost();
    if (this.phase === 'playing' && this.members.size === 0) this.returnToLobby();
    this.broadcastLobby();
  }

  onDispose() {
    this.resultsTimer?.clear();
    super.onDispose();
  }

  // ---------------------------------------------------------------- helpers

  private notice(client: Client, level: NoticeMsg['level'], text: string) {
    client.send(S2C.Notice, { level, text } satisfies NoticeMsg);
  }

  private uniqueName(name: string): string {
    const taken = new Set([...this.members.values()].map((m) => m.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 100; i++) {
      const candidate = `${name.slice(0, 13)}#${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${name.slice(0, 10)}#${Math.floor(Math.random() * 1000)}`;
  }

  private transferHost() {
    const candidates = [...this.members.values()].filter((m) => m.connected).sort((a, b) => a.joinedAt - b.joinedAt);
    this.hostSession = candidates[0]?.sessionId ?? '';
  }

  private lobbyState(): LobbyState {
    const host = this.members.get(this.hostSession);
    const players = [...this.members.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      // co-op: everybody is on team 0 and "ready" (the host decides when to start)
      .map((m) => ({ id: m.id, name: m.name, ready: true, team: 0 as const, connected: m.connected, ping: m.ping }));
    return { code: this.code, phase: this.phase, hostId: host?.id ?? -1, settings: this.settings, maxPlayers: this.maxClients, players };
  }

  private broadcastLobby() {
    this.broadcast(S2C.Lobby, this.lobbyState());
  }

  private matchStartFor(m: Member): MatchStartMsg {
    const roster = [...(this.sim?.players.values() ?? [])]
      .filter((x) => x.kind === 'human')
      .map((x) => ({ id: x.id, name: x.name, team: x.team }));
    return { settings: this.settings, playerId: m.id, roster, tick: this.sim?.tick ?? 0 };
  }

  private startMatch() {
    // guard against a double Start (host click + auto-retry) creating two runs
    const now = Date.now();
    if (now - this.lastStartAt < 500) return;
    this.lastStartAt = now;
    this.resultsTimer?.clear();
    this.resultsTimer = null;

    const seed = now >>> 0;
    const sim = new GameSim(this.settings, seed);
    const director = new WaveDirector(sim, { seed, ...this.directorOptions });
    for (const m of this.members.values()) {
      sim.addPlayer(m.id, m.name, 0);
      director.registerHuman(m.id);
      if (!m.connected) sim.setConnected(m.id, false);
    }
    this.sim = sim;
    this.director = director;
    this.phase = 'playing';
    director.start();
    for (const m of this.members.values()) if (m.connected) m.client.send(S2C.MatchStart, this.matchStartFor(m));
    this.broadcastLobby();
  }

  private tickMatch() {
    const sim = this.sim;
    const director = this.director;
    if (this.phase !== 'playing' || !sim || !director) return;

    director.step();
    const events = sim.drainEvents();
    if (events.length > 0) this.broadcast(S2C.Events, events);
    for (const dm of director.drainMessages()) {
      if (dm.to === 'all') this.broadcast(dm.type, dm.msg);
      else for (const m of this.members.values()) if (m.id === dm.to && m.connected) m.client.send(dm.type, dm.msg);
    }

    const over = director.phase === 'gameover';
    if (sim.tick % SNAPSHOT_EVERY_TICKS === 0 || over) {
      const shared = {
        t: sim.tick,
        tl: 0,
        p: sim.buildPlayers(),
        pr: sim.buildProjectiles(),
        pk: sim.unavailablePickups(),
        fl: [],
        ts: [...sim.teamScores],
      };
      for (const m of this.members.values()) {
        if (!m.connected) continue;
        const p = sim.players.get(m.id);
        const snap: SnapshotMsg = { ...shared, a: p?.lastSeq ?? -1, me: sim.ownState(m.id) };
        m.client.send(S2C.Snapshot, snap);
      }
    }
    if (sim.tick % (TICK_RATE / 2) === 0 || over) {
      const pings = new Map([...this.members.values()].map((m) => [m.id, m.ping]));
      this.broadcast(S2C.Scoreboard, sim.scoreboard(pings));
    }
    if (over) this.finishMatch();
  }

  private finishMatch() {
    this.phase = 'results';
    this.sim = null;
    this.director = null;
    this.broadcastLobby();
    this.resultsTimer = this.clock.setTimeout(() => {
      if (this.phase === 'results') this.returnToLobby();
    }, RESULTS_SECONDS * 1000);
  }

  private returnToLobby() {
    this.resultsTimer?.clear();
    this.resultsTimer = null;
    this.phase = 'lobby';
    this.sim = null;
    this.director = null;
    this.broadcastLobby();
  }

  // exposed for tests
  get debugSim(): GameSim | null {
    return this.sim;
  }
  get debugDirector(): WaveDirector | null {
    return this.director;
  }
}
