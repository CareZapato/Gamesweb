import { type GameId, ROOM_NAMES } from '@arena/shared/games';

/**
 * Catalog of minigames shown by the portal (`/`). To add a game: add an entry here (the portal
 * renders it by itself), create its page under `client/<route>/index.html` + its Vite input in
 * `client/vite.config.ts`, and register its Colyseus room in `shared/src/games.ts` + the server.
 *
 * Keep this file free of heavy imports: the portal must not load any game code.
 */
export type GameStatus = 'available' | 'soon';

export interface CatalogGame {
  /** Stable id; for playable games it is also the key in `ROOM_NAMES`. */
  id: string;
  name: string;
  description: string;
  /** Page of the game (same origin as the server). */
  route: string;
  /** Colyseus room name the game registers on the server. `null` while it is not playable. */
  roomName: string | null;
  status: GameStatus;
  minPlayers: number;
  maxPlayers: number;
  /** Image under `client/public/`. */
  thumbnail: string;
}

const room = (id: GameId): string => ROOM_NAMES[id];

export const CATALOG: readonly CatalogGame[] = [
  {
    id: 'realtournament',
    name: 'RealTournament',
    description: 'Arena shooter en primera persona. Deathmatch y Captura la bandera con servidor autoritativo.',
    route: '/realtournament/',
    roomName: room('realtournament'),
    status: 'available',
    minPlayers: 1,
    maxPlayers: 8,
    thumbnail: '/portal/realtournament_card.png',
  },
  {
    id: 'kart-cubico',
    name: 'Kart Cúbico',
    description: 'Carreras de karts de bloques en circuitos cortos y enrevesados.',
    route: '/kart-cubico/',
    roomName: null,
    status: 'soon',
    minPlayers: 1,
    maxPlayers: 8,
    thumbnail: '/portal/soon-race.svg',
  },
  {
    id: 'torre-de-defensa',
    name: 'Torre de Defensa',
    description: 'Defiende la base con tus amigos contra oleadas de enemigos.',
    route: '/torre-de-defensa/',
    roomName: null,
    status: 'soon',
    minPlayers: 1,
    maxPlayers: 4,
    thumbnail: '/portal/soon-tower.svg',
  },
];
