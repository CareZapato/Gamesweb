import { clamp, isFiniteNum, wrapAngle } from './math';
import { Btn, type InputCmd, type PlayerSimState } from './movement';
import type { GameMode, MatchSettings, PickupKind } from './rules';
import { WEAPON_COUNT } from './weapons';

/** Message type names. Kept short because they travel with every message. */
export const C2S = {
  Input: 'in',
  Ping: 'ping',
  Ready: 'ready',
  Settings: 'settings',
  Team: 'team',
  Start: 'start',
  Rematch: 'rematch',
  ToLobby: 'toLobby',
  /** `{ png: Uint8Array | null }`: set (or clear with null) the sender's skin. See docs/SKINS.md. */
  Skin: 'skin',
} as const;

export const S2C = {
  Welcome: 'welcome',
  Lobby: 'lobby',
  MatchStart: 'start',
  Snapshot: 'snap',
  Events: 'ev',
  Scoreboard: 'sb',
  MatchEnd: 'end',
  Pong: 'pong',
  Notice: 'notice',
  /** `SkinMsg`: skin of one player of the room (null = back to the default skin). */
  Skin: 'skin',
} as const;

export interface SkinMsg {
  id: number;
  png: Uint8Array | null;
}

export type Phase = 'lobby' | 'playing' | 'results';

export interface WelcomeMsg {
  playerId: number;
  code: string;
}

export interface LobbyPlayer {
  id: number;
  name: string;
  ready: boolean;
  team: 0 | 1;
  connected: boolean;
  ping: number;
  /** Lobby-only preview row; real id is assigned at match start. */
  isBot?: boolean;
}

export interface LobbyState {
  code: string;
  phase: Phase;
  hostId: number;
  settings: MatchSettings;
  maxPlayers: number;
  players: LobbyPlayer[];
}

export interface RosterEntry {
  id: number;
  name: string;
  team: number;
}

export interface MatchStartMsg {
  settings: MatchSettings;
  playerId: number;
  roster: RosterEntry[];
  tick: number;
}

/** Player flags in snapshots. */
export const PF = {
  Alive: 1,
  Dashing: 2,
  OnGround: 4,
  Carrier: 8,
  Protected: 16,
  Disconnected: 32,
  Switching: 64,
  Crouching: 128,
  Sliding: 256,
  /** Reducto: Horda enemy. The `weapon` slot of the snapshot carries its archetype index. */
  Zombie: 512,
} as const;

/**
 * [id, x*100, y*100, z*100, yaw*1000, pitch*1000, flags, weapon, team, warps & 255]. When `warps`
 * changes between two snapshots the player went through a portal: clients must not interpolate.
 */
export type PlayerSnap = [number, number, number, number, number, number, number, number, number, number];

/** [id, weapon, x*100, y*100, z*100] */
export type ProjectileSnap = [number, number, number, number, number];

export const FlagState = { Home: 0, Carried: 1, Dropped: 2 } as const;
export type FlagState = (typeof FlagState)[keyof typeof FlagState];

/** [team, state, x*100, y*100, z*100, carrierId, returnInSeconds] */
export type FlagSnap = [number, number, number, number, number, number, number];

export interface OwnState extends PlayerSimState {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  alive: boolean;
  respawnIn: number;
  protectedFor: number;
}

export interface SnapshotMsg {
  t: number;
  /** Last input sequence processed for the receiving player. */
  a: number;
  /** Seconds remaining. */
  tl: number;
  me: OwnState | null;
  p: PlayerSnap[];
  pr: ProjectileSnap[];
  /** Indices of pickups currently unavailable. */
  pk: number[];
  fl: FlagSnap[];
  ts: number[];
}

/** Live scoreboard row. The server sends the rows already ordered (see `rankPlayers`). */
export interface ScoreEntry {
  id: number;
  name: string;
  team: number;
  kills: number;
  deaths: number;
  score: number;
  captures: number;
  /** Effective damage dealt to enemies (health + shield actually removed). */
  damage: number;
  /** Position: global in DM, inside the team in CTF. */
  rank: number;
  ping: number;
  connected: boolean;
}

export type V3T = [number, number, number];

export type DeathCause = 'lava' | 'fall';

export type GameEvent =
  | { e: number; k: 'shot'; p: number; w: number; o: V3T; ends: V3T[]; hitWorld: boolean[]; c?: number }
  /** `sd`: part of `dmg` absorbed by the shield; `sb`: the shield reached 0 with this hit. */
  | {
      e: number;
      k: 'hit';
      a: number;
      v: number;
      dmg: number;
      head: boolean;
      from: V3T;
      /** head | body | legs */
      zone?: 'head' | 'body' | 'legs';
      /** World point for floating damage numbers. */
      at?: V3T;
      sd?: number;
      sb?: boolean;
    }
  | { e: number; k: 'kill'; killer: number; victim: number; w: number; suicide: boolean; head: boolean; cause?: DeathCause }
  | { e: number; k: 'warp'; p: number; from: number; to: number }
  | { e: number; k: 'pad'; p: number; i: number }
  | { e: number; k: 'boom'; w: number; pos: V3T; pid: number }
  | { e: number; k: 'pickup'; i: number; p: number; kind: PickupKind; w: number }
  | { e: number; k: 'spawn'; p: number; pos: V3T }
  | { e: number; k: 'dash'; p: number }
  | { e: number; k: 'jump'; p: number }
  | { e: number; k: 'fire'; p: number; w: number }
  | { e: number; k: 'flag'; team: number; action: 'take' | 'drop' | 'return' | 'capture' | 'autoreturn'; p: number }
  | { e: number; k: 'bounce'; pos: V3T }
  | { e: number; k: 'streak'; p: number; kind: 'multi' | 'spree' | 'ended'; n: number; by?: number };

/** Distributes Omit across the union so each event variant keeps its own fields. */
export type GameEventBody = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'e'> : never) : never;

export interface ResultEntry {
  id: number;
  name: string;
  team: number;
  kills: number;
  deaths: number;
  score: number;
  captures: number;
  damage: number;
  /** Same ranking as the live scoreboard (inside the team in CTF). */
  rank: number;
  /** Longest kill spree this match. */
  bestSpree: number;
  /** Best multi-kill chain (≥ 2 kills within the window). */
  bestMulti: number;
}

export interface MatchResults {
  mode: GameMode;
  mapId: string;
  reason: 'time' | 'score' | 'aborted';
  winnerTeam: number;
  winnerId: number;
  teamScores: number[];
  players: ResultEntry[];
  durationSec: number;
}

export interface NoticeMsg {
  level: 'info' | 'warn' | 'error';
  text: string;
}

/** Input as it travels on the wire: [seq, buttons, yaw, pitch, weapon, viewTick] */
export type InputWire = [number, number, number, number, number, number];

export const encodeInput = (c: InputCmd): InputWire => [
  c.seq,
  c.buttons,
  Math.round(c.yaw * 10000) / 10000,
  Math.round(c.pitch * 10000) / 10000,
  c.weapon,
  Math.round(c.viewTick * 100) / 100,
];

/** Largest valid `buttons` value: every defined `Btn` bit set (Forward..Aim = 255). */
export const MAX_BUTTONS = Object.values(Btn).reduce((a, b) => a | b, 0);

/** Strict validation of untrusted input. Returns null for anything malformed. */
export const decodeInput = (raw: unknown): InputCmd | null => {
  if (!Array.isArray(raw) || raw.length !== 6) return null;
  const [seq, buttons, yaw, pitch, weapon, viewTick] = raw;
  if (!isFiniteNum(seq) || !Number.isInteger(seq) || seq < 0 || seq > 2 ** 31) return null;
  if (!isFiniteNum(buttons) || !Number.isInteger(buttons) || buttons < 0 || buttons > MAX_BUTTONS) return null;
  if (!isFiniteNum(yaw) || !isFiniteNum(pitch) || !isFiniteNum(viewTick)) return null;
  if (!isFiniteNum(weapon) || !Number.isInteger(weapon) || weapon < 0 || weapon >= WEAPON_COUNT) return null;
  return {
    seq,
    buttons,
    yaw: wrapAngle(yaw),
    pitch: clamp(pitch, -1.55, 1.55),
    weapon,
    viewTick,
  };
};

export const sanitizeName = (raw: unknown, maxLen: number): string => {
  const s = typeof raw === 'string' ? raw : '';
  const cleaned = s
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>&"'`]/g, '')
    .trim()
    .slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : 'Jugador';
};

export const q100 = (v: number): number => Math.round(v * 100);
export const q1000 = (v: number): number => Math.round(v * 1000);
