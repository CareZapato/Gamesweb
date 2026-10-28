/**
 * Registry of the games hosted by this server: game id -> Colyseus room name.
 *
 * Every game registers its own room type under its own name, and clients must say which game they
 * are joining (`options.game`). A room code of one game therefore never lets you into another.
 * This file has no dependencies on purpose: the lightweight portal imports it too.
 */
export const ROOM_NAMES = {
  realtournament: 'realtournament',
} as const;

export type GameId = keyof typeof ROOM_NAMES;
