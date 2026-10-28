import { ROOM } from './constants';
import { WeaponId } from './weapons';

export type GameMode = 'dm' | 'ctf';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'normal', 'hard'];

export const BOT_DIFFICULTY_LABEL: Record<BotDifficulty, string> = {
  easy: 'Fácil',
  normal: 'Normal',
  hard: 'Difícil',
};

export interface MatchSettings {
  mode: GameMode;
  mapId: string;
  /** Minutes. */
  timeLimit: number;
  /** Frags in DM, captures in CTF. */
  scoreLimit: number;
  /** AI players added at match start (not counted against room join slots). */
  botCount: number;
  botDifficulty: BotDifficulty;
}

export const clampBotCount = (count: number, humanCount: number, maxPlayers: number = ROOM.maxPlayers): number =>
  Math.max(0, Math.min(maxPlayers - Math.max(0, humanCount), Math.floor(count)));

export const MODE_RULES = {
  dm: {
    label: 'Deathmatch',
    defaultTimeLimit: 10,
    defaultScoreLimit: 25,
    scoreLimitOptions: [10, 15, 25, 40, 60],
    suicidePenalty: 1,
  },
  ctf: {
    label: 'Captura la bandera',
    defaultTimeLimit: 15,
    defaultScoreLimit: 3,
    scoreLimitOptions: [1, 3, 5, 7, 10],
    /** Seconds a dropped flag stays on the ground before returning home. */
    flagReturnTime: 20,
    flagTouchRadius: 1.4,
    capturePoints: 5,
    returnPoints: 1,
    killPoints: 1,
  },
} as const;

/** Fills bot fields and clamps count so humans + bots ≤ maxPlayers. */
export const normalizeMatchSettings = (raw: Partial<MatchSettings>, humanCount: number, maxPlayers = ROOM.maxPlayers): MatchSettings => {
  const mode = raw.mode === 'ctf' ? 'ctf' : 'dm';
  const botDifficulty = BOT_DIFFICULTIES.includes(raw.botDifficulty as BotDifficulty) ? (raw.botDifficulty as BotDifficulty) : 'normal';
  const botCount = clampBotCount(typeof raw.botCount === 'number' ? raw.botCount : 0, humanCount, maxPlayers);
  return {
    mode,
    mapId: raw.mapId ?? '',
    timeLimit: raw.timeLimit ?? MODE_RULES[mode].defaultTimeLimit,
    scoreLimit: raw.scoreLimit ?? MODE_RULES[mode].defaultScoreLimit,
    botCount,
    botDifficulty,
  };
};

export const TIME_LIMIT_OPTIONS = [3, 5, 10, 15, 20] as const;

export const PickupKind = {
  Health: 'health',
  HealthBig: 'healthBig',
  Shield: 'shield',
  ShieldBig: 'shieldBig',
  Ammo: 'ammo',
} as const;
export type PickupKind = (typeof PickupKind)[keyof typeof PickupKind];

/**
 * `amount` restored and `respawn` seconds. Health pickups never exceed `PLAYER.maxHealth` and shield
 * pickups never exceed `PLAYER.maxShield`; a pickup that would add nothing is not consumed.
 */
export const PICKUPS: Record<PickupKind, { respawn: number; amount: number; radius: number }> = {
  health: { respawn: 20, amount: 25, radius: 1.0 },
  healthBig: { respawn: 30, amount: 50, radius: 1.0 },
  shield: { respawn: 25, amount: 50, radius: 1.0 },
  shieldBig: { respawn: 40, amount: 100, radius: 1.0 },
  ammo: { respawn: 15, amount: 0, radius: 1.0 },
};

export const isHealthPickup = (k: PickupKind): boolean => k === 'health' || k === 'healthBig';
export const isShieldPickup = (k: PickupKind): boolean => k === 'shield' || k === 'shieldBig';

export const RESULTS_SECONDS = 20;

export const DEFAULT_LOADOUT: readonly WeaponId[] = [
  WeaponId.Rifle,
  WeaponId.Shotgun,
  WeaponId.Sniper,
  WeaponId.Rocket,
  WeaponId.Grenade,
  WeaponId.Plasma,
  WeaponId.Charge,
];

export const Team = { None: -1, Red: 0, Blue: 1 } as const;
export type Team = (typeof Team)[keyof typeof Team];
export const TEAM_NAMES = ['Rojo', 'Azul'] as const;

/** Multi-kill chains and kill sprees (server-authoritative announcements). */
export const STREAK_RULES = {
  /** Max seconds between consecutive kills to extend a multi-kill chain. */
  multiKillWindowSec: 4,
  multiKillLabels: {
    2: 'Double Kill',
    3: 'Triple Kill',
    4: 'Quadra Kill',
    5: 'Penta Kill',
  },
  /** Kill milestones without dying; labels shown in Spanish. */
  spreeMilestones: [
    { n: 5, label: 'Racha asesina' },
    { n: 10, label: 'Imparable' },
    { n: 15, label: 'Dominando' },
    { n: 20, label: 'Leyenda' },
  ],
  /** Announce "racha cortada" when the victim had at least this many kills in the spree. */
  spreeEndMin: 5,
} as const;

export const multiKillLabel = (n: number): string | null => {
  if (n < 2) return null;
  const labels = STREAK_RULES.multiKillLabels;
  return n >= 5 ? labels[5] : labels[n as 2 | 3 | 4] ?? null;
};

export const spreeLabel = (n: number): string | null =>
  STREAK_RULES.spreeMilestones.find((m) => m.n === n)?.label ?? null;

/** What the scoreboard ranking looks at. `damage` is effective damage dealt to enemies. */
export interface RankStats {
  id: number;
  team: number;
  score: number;
  kills: number;
  deaths: number;
  damage: number;
  captures: number;
}

/** Deathmatch: score, kills, fewer deaths, damage dealt; the player id breaks any remaining tie. */
export const compareDM = (a: RankStats, b: RankStats): number =>
  b.score - a.score || b.kills - a.kills || a.deaths - b.deaths || b.damage - a.damage || a.id - b.id;

/** CTF (inside a team): captures, kills, fewer deaths, damage dealt, then player id. */
export const compareCTF = (a: RankStats, b: RankStats): number =>
  b.captures - a.captures || b.kills - a.kills || a.deaths - b.deaths || b.damage - a.damage || a.id - b.id;

/** Teams ordered by team score (higher first); equal scores keep red before blue. */
export const teamOrder = (teamScores: readonly number[]): number[] =>
  [0, 1].sort((a, b) => (teamScores[b] ?? 0) - (teamScores[a] ?? 0) || a - b);

/**
 * Server-side ranking used by the live scoreboard and the results screen. Deathmatch: one list,
 * `rank` 1..n. CTF: the winning team first, then the other; `rank` restarts at 1 inside each team.
 */
export const rankPlayers = <T extends RankStats>(players: readonly T[], mode: GameMode, teamScores: readonly number[]): (T & { rank: number })[] => {
  if (mode !== 'ctf') return [...players].sort(compareDM).map((p, i) => ({ ...p, rank: i + 1 }));
  const out: (T & { rank: number })[] = [];
  const order = teamOrder(teamScores);
  for (const t of order) {
    players
      .filter((p) => p.team === t)
      .sort(compareCTF)
      .forEach((p, i) => out.push({ ...p, rank: i + 1 }));
  }
  // players without a valid team (should not happen in CTF) go last, so nobody disappears
  players
    .filter((p) => !order.includes(p.team))
    .sort(compareCTF)
    .forEach((p, i) => out.push({ ...p, rank: i + 1 }));
  return out;
};

/** "1.º", "2.º"… */
export const ordinal = (n: number): string => `${n}.º`;
