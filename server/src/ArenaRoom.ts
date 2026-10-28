import { type Client, ServerError } from '@colyseus/core';
import {
  C2S,
  decodeInput,
  defaultMapFor,
  getMap,
  isFiniteNum,
  type LobbyState,
  mapSupportsMode,
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_LABEL,
  type BotDifficulty,
  clampBotCount,
  type MatchSettings,
  type MatchStartMsg,
  MODE_RULES,
  NET,
  type NoticeMsg,
  type Phase,
  RESULTS_SECONDS,
  ROOM,
  S2C,
  sanitizeName,
  SKIN,
  type SkinMsg,
  SNAPSHOT_EVERY_TICKS,
  type SnapshotMsg,
  TICK_RATE,
  TIME_LIMIT_OPTIONS,
  type WelcomeMsg,
} from '@arena/shared';
import { GameRoom, JoinError } from './GameRoom';
import { type BotMemory, botInput } from './game/BotBrain';
import { GameSim } from './game/GameSim';
import { validateSkinPng } from './skins';

interface Member {
  id: number;
  sessionId: string;
  client: Client;
  name: string;
  ready: boolean;
  team: 0 | 1;
  connected: boolean;
  ping: number;
  joinedAt: number;
  /** Simple per-member throttle for lobby actions. */
  lastLobbyAction: number;
  /** PNG of the player's skin (kept in memory only, dropped when they leave), or null = default. */
  skin: Uint8Array | null;
  lastSkinAt: number;
}

/**
 * RealTournament room: one room = one lobby + its matches. The server is always authoritative: the
 * room creator only gets lobby permissions (settings / start), never simulation authority.
 * Room code allocation and game validation live in `GameRoom`.
 */
export class ArenaRoom extends GameRoom {
  maxClients: number = ROOM.maxPlayers;
  maxMessagesPerSecond = NET.maxMessagesPerSecond;

  private members = new Map<string, Member>();
  private hostSession = '';
  private phase: Phase = 'lobby';
  private settings: MatchSettings = {
    mode: 'dm',
    mapId: defaultMapFor('dm').id,
    timeLimit: 10,
    scoreLimit: 25,
    botCount: 0,
    botDifficulty: 'normal',
  };
  private sim: GameSim | null = null;
  private botIds: number[] = [];
  private botMem = new Map<number, BotMemory>();
  private nextPlayerId = 1;
  private resultsTimer: { clear(): void } | null = null;
  private lastResults: unknown = null;

  onCreate(options: { maxPlayers?: unknown }) {
    super.onCreate(options);
    if (isFiniteNum(options?.maxPlayers)) this.maxClients = Math.max(2, Math.min(ROOM.maxPlayers, Math.floor(options.maxPlayers)));

    this.onMessage(C2S.Input, (client, raw) => {
      if (this.phase !== 'playing' || !this.sim) return;
      const m = this.members.get(client.sessionId);
      const cmd = decodeInput(raw);
      if (!m || !cmd) return;
      this.sim.queueInput(m.id, cmd);
    });

    this.onMessage(C2S.Ping, (client, raw: { t?: unknown; rtt?: unknown }) => {
      const m = this.members.get(client.sessionId);
      if (!m) return;
      if (isFiniteNum(raw?.rtt)) m.ping = Math.max(0, Math.min(2000, Math.round(raw.rtt)));
      if (isFiniteNum(raw?.t)) client.send(S2C.Pong, { t: raw.t });
    });

    this.onMessage(C2S.Ready, (client, raw: { ready?: unknown }) => {
      const m = this.lobbyActor(client);
      if (!m || this.phase !== 'lobby') return;
      m.ready = raw?.ready === true;
      this.broadcastLobby();
    });

    this.onMessage(C2S.Team, (client, raw: { team?: unknown }) => {
      const m = this.lobbyActor(client);
      if (!m || this.phase !== 'lobby' || (raw?.team !== 0 && raw?.team !== 1) || raw.team === m.team) return;
      const counts = this.teamCounts();
      counts[m.team]--;
      counts[raw.team]++;
      if (Math.abs(counts[0] - counts[1]) > 1) {
        this.notice(client, 'warn', 'Ese equipo ya tiene más jugadores.');
        return;
      }
      m.team = raw.team;
      this.broadcastLobby();
    });

    this.onMessage(C2S.Settings, (client, raw: Partial<MatchSettings>) => {
      const m = this.lobbyActor(client);
      if (!m || this.phase !== 'lobby') return;
      if (client.sessionId !== this.hostSession) return this.notice(client, 'warn', 'Solo el anfitrión puede cambiar la configuración.');
      const next = { ...this.settings };
      if (raw?.mode === 'dm' || raw?.mode === 'ctf') {
        if (raw.mode !== next.mode) {
          next.mode = raw.mode;
          next.timeLimit = MODE_RULES[raw.mode].defaultTimeLimit;
          next.scoreLimit = MODE_RULES[raw.mode].defaultScoreLimit;
        }
      }
      // maps whose mode support is not ready (e.g. CTF without bases and flags) are refused
      if (typeof raw?.mapId === 'string') {
        const map = getMap(raw.mapId);
        if (map && mapSupportsMode(map, next.mode)) next.mapId = map.id;
      }
      const map = getMap(next.mapId);
      if (!map || !mapSupportsMode(map, next.mode)) next.mapId = defaultMapFor(next.mode).id;
      if ((TIME_LIMIT_OPTIONS as readonly unknown[]).includes(raw?.timeLimit)) next.timeLimit = raw.timeLimit as number;
      if ((MODE_RULES[next.mode].scoreLimitOptions as readonly unknown[]).includes(raw?.scoreLimit)) next.scoreLimit = raw.scoreLimit as number;
      if (isFiniteNum(raw?.botCount)) next.botCount = clampBotCount(raw.botCount, this.members.size, this.maxClients);
      if (BOT_DIFFICULTIES.includes(raw?.botDifficulty as BotDifficulty)) next.botDifficulty = raw.botDifficulty as BotDifficulty;
      this.settings = next;
      for (const mm of this.members.values()) mm.ready = false;
      this.broadcastLobby();
    });

    this.onMessage(C2S.Start, (client) => {
      const m = this.lobbyActor(client);
      if (!m || this.phase !== 'lobby') return;
      if (client.sessionId !== this.hostSession) return this.notice(client, 'warn', 'Solo el anfitrión puede iniciar la partida.');
      const notReady = [...this.members.values()].filter((x) => x.connected && x.sessionId !== this.hostSession && !x.ready);
      if (notReady.length > 0) {
        return this.notice(client, 'warn', `Faltan jugadores por marcarse listos: ${notReady.map((x) => x.name).join(', ')}`);
      }
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

    // Skin: one PNG per player, validated here (never trusted) and relayed to the whole room.
    this.onMessage(C2S.Skin, (client, raw: { png?: unknown } | null) => {
      const m = this.members.get(client.sessionId);
      if (!m) return;
      if (this.phase === 'playing') return this.notice(client, 'warn', 'La skin solo se puede cambiar fuera de la partida.');
      const now = Date.now();
      if (now - m.lastSkinAt < SKIN.minIntervalMs) return this.notice(client, 'warn', 'Espera un segundo antes de cambiar la skin otra vez.');
      m.lastSkinAt = now;
      const png = raw?.png ?? null;
      if (png === null || (png instanceof Uint8Array && png.length === 0)) {
        m.skin = null;
      } else {
        const res = validateSkinPng(png);
        if (!res.ok) return this.notice(client, 'warn', `Skin rechazada: ${res.reason}.`);
        m.skin = res.png;
      }
      this.broadcast(S2C.Skin, { id: m.id, png: m.skin } satisfies SkinMsg);
    });

    this.setFixedTimestep(() => this.tickMatch(), TICK_RATE);
  }

  /** Sends the skins already chosen in the room to a client that just joined or reconnected. */
  private sendSkinsTo(client: Client) {
    for (const x of this.members.values()) {
      if (x.skin && x.client !== client) client.send(S2C.Skin, { id: x.id, png: x.skin } satisfies SkinMsg);
    }
  }

  onJoin(client: Client, options: { name?: unknown }) {
    if (this.phase === 'playing') throw new ServerError(JoinError.InProgress, 'MATCH_IN_PROGRESS');
    if (this.members.size >= this.maxClients) throw new ServerError(JoinError.Full, 'ROOM_FULL');
    const counts = this.teamCounts();
    const m: Member = {
      id: this.nextPlayerId++,
      sessionId: client.sessionId,
      client,
      name: this.uniqueName(sanitizeName(options?.name, ROOM.nameMaxLength)),
      ready: false,
      team: counts[0] <= counts[1] ? 0 : 1,
      connected: true,
      ping: 0,
      joinedAt: Date.now(),
      lastLobbyAction: 0,
      skin: null,
      lastSkinAt: 0,
    };
    this.members.set(client.sessionId, m);
    if (!this.hostSession) this.hostSession = client.sessionId;
    client.send(S2C.Welcome, { playerId: m.id, code: this.code } satisfies WelcomeMsg);
    this.sendSkinsTo(client);
    if (this.phase === 'results' && this.lastResults) client.send(S2C.MatchEnd, this.lastResults);
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
    this.sendSkinsTo(client);
    if (m.skin) client.send(S2C.Skin, { id: m.id, png: m.skin } satisfies SkinMsg);
    if (this.phase === 'playing' && this.sim) {
      this.sim.setConnected(m.id, true);
      client.send(S2C.MatchStart, this.matchStartFor(m));
    } else if (this.phase === 'results' && this.lastResults) {
      client.send(S2C.MatchEnd, this.lastResults);
    }
    this.broadcastLobby();
  }

  onLeave(client: Client) {
    const m = this.members.get(client.sessionId);
    if (!m) return;
    this.members.delete(client.sessionId);
    if (m.skin) this.broadcast(S2C.Skin, { id: m.id, png: null } satisfies SkinMsg);
    this.sim?.removePlayer(m.id);
    if (this.hostSession === client.sessionId) this.transferHost();
    if (this.phase === 'playing' && this.members.size === 0) this.sim?.end('aborted');
    this.broadcastLobby();
  }

  onDispose() {
    this.resultsTimer?.clear();
    super.onDispose();
  }

  // ---------------------------------------------------------------- helpers

  /** Member allowed to perform a lobby action right now (throttled to 10 per second). */
  private lobbyActor(client: Client): Member | null {
    const m = this.members.get(client.sessionId);
    if (!m) return null;
    const now = Date.now();
    if (now - m.lastLobbyAction < 100) return null;
    m.lastLobbyAction = now;
    return m;
  }

  private notice(client: Client, level: NoticeMsg['level'], text: string) {
    client.send(S2C.Notice, { level, text } satisfies NoticeMsg);
  }

  private uniqueName(name: string): string {
    const taken = new Set([...this.members.values()].map((m) => m.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 100; i++) {
      const candidate = `${name.slice(0, ROOM.nameMaxLength - 3)}#${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${name.slice(0, 10)}#${Math.floor(Math.random() * 1000)}`;
  }

  private teamCounts(): [number, number] {
    const c: [number, number] = [0, 0];
    for (const m of this.members.values()) c[m.team]++;
    return c;
  }

  private transferHost() {
    const candidates = [...this.members.values()].filter((m) => m.connected).sort((a, b) => a.joinedAt - b.joinedAt);
    this.hostSession = candidates[0]?.sessionId ?? '';
  }

  private previewBotTeams(count: number): (0 | 1)[] {
    const counts = this.teamCounts();
    const teams: (0 | 1)[] = [];
    for (let i = 0; i < count; i++) {
      const t: 0 | 1 = counts[0] <= counts[1] ? 0 : 1;
      teams.push(t);
      counts[t]++;
    }
    return teams;
  }

  private lobbyState(): LobbyState {
    const host = this.members.get(this.hostSession);
    const humans = [...this.members.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((m) => ({ id: m.id, name: m.name, ready: m.ready, team: m.team, connected: m.connected, ping: m.ping }));
    const botTeams = this.previewBotTeams(this.settings.botCount);
    const bots = botTeams.map((team, i) => ({
      id: -(i + 1),
      name: `Bot ${i + 1} (${BOT_DIFFICULTY_LABEL[this.settings.botDifficulty]})`,
      ready: true,
      team,
      connected: true,
      ping: 0,
      isBot: true as const,
    }));
    return {
      code: this.code,
      phase: this.phase,
      hostId: host?.id ?? -1,
      settings: this.settings,
      maxPlayers: this.maxClients,
      players: [...humans, ...bots],
    };
  }

  private broadcastLobby() {
    this.broadcast(S2C.Lobby, this.lobbyState());
  }

  /** Equalizes team sizes keeping players on their chosen team when possible (latest joiners move first). */
  private balanceTeams() {
    const ordered = [...this.members.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    const counts = this.teamCounts();
    while (Math.abs(counts[0] - counts[1]) > 1) {
      const from: 0 | 1 = counts[0] > counts[1] ? 0 : 1;
      const mover = [...ordered].reverse().find((m) => m.team === from);
      if (!mover) break;
      mover.team = from === 0 ? 1 : 0;
      counts[from]--;
      counts[mover.team]++;
    }
  }

  private matchStartFor(m: Member): MatchStartMsg {
    const roster = [...(this.sim?.players.values() ?? [])].map((x) => ({ id: x.id, name: x.name, team: x.team }));
    return {
      settings: this.settings,
      playerId: m.id,
      roster,
      tick: this.sim?.tick ?? 0,
    };
  }

  private startMatch() {
    this.resultsTimer?.clear();
    this.resultsTimer = null;
    if (this.settings.mode === 'ctf') this.balanceTeams();
    const sim = new GameSim(this.settings);
    for (const m of this.members.values()) {
      sim.addPlayer(m.id, m.name, m.team);
      if (!m.connected) sim.setConnected(m.id, false);
    }
    this.botIds = [];
    this.botMem.clear();
    const botTeams = this.previewBotTeams(this.settings.botCount);
    for (let i = 0; i < this.settings.botCount; i++) {
      const id = this.nextPlayerId++;
      sim.addPlayer(id, `Bot ${i + 1}`, botTeams[i] ?? 0);
      this.botIds.push(id);
    }
    this.sim = sim;
    this.phase = 'playing';
    this.lastResults = null;
    for (const m of this.members.values()) if (m.connected) m.client.send(S2C.MatchStart, this.matchStartFor(m));
    this.broadcastLobby();
  }

  private tickMatch() {
    const sim = this.sim;
    if (this.phase !== 'playing' || !sim) return;
    for (const id of this.botIds) {
      const p = sim.players.get(id);
      if (!p?.connected) continue;
      let mem = this.botMem.get(id);
      if (!mem) mem = { seq: 0, targetId: -1, aimYaw: p.yaw, aimPitch: p.pitch, strafe: 1, strafeUntil: 0 };
      const cmd = botInput(sim, p, this.settings.botDifficulty, mem, sim.tick);
      this.botMem.set(id, mem);
      sim.queueInput(id, cmd);
    }
    sim.step();
    const events = sim.drainEvents();
    if (events.length > 0) this.broadcast(S2C.Events, events);

    if (sim.tick % SNAPSHOT_EVERY_TICKS === 0 || sim.ended) {
      const shared = {
        t: sim.tick,
        tl: Math.ceil(sim.timeLeft),
        p: sim.buildPlayers(),
        pr: sim.buildProjectiles(),
        pk: sim.unavailablePickups(),
        fl: sim.buildFlags(),
        ts: [...sim.teamScores],
      };
      for (const m of this.members.values()) {
        if (!m.connected) continue;
        const p = sim.players.get(m.id);
        const snap: SnapshotMsg = { ...shared, a: p?.lastSeq ?? -1, me: sim.ownState(m.id) };
        m.client.send(S2C.Snapshot, snap);
      }
    }
    if (sim.tick % (TICK_RATE / 2) === 0 || sim.ended) {
      const pings = new Map([...this.members.values()].map((m) => [m.id, m.ping]));
      this.broadcast(S2C.Scoreboard, sim.scoreboard(pings));
    }
    if (sim.ended) this.finishMatch();
  }

  private finishMatch() {
    const sim = this.sim;
    if (!sim?.results) return;
    this.phase = 'results';
    this.lastResults = sim.results;
    this.sim = null;
    for (const m of this.members.values()) m.ready = false;
    this.broadcast(S2C.MatchEnd, sim.results);
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
    this.botIds = [];
    this.botMem.clear();
    this.broadcastLobby();
  }

  // exposed for tests
  get debugSim(): GameSim | null {
    return this.sim;
  }
  get debugHostSession(): string {
    return this.hostSession;
  }
}
