import { type Client, Room, ServerError } from '@colyseus/core';
import { allocateRoomCode, releaseRoomCode } from './roomCodes';

export const JoinError = {
  InProgress: 4301,
  Full: 4302,
  WrongGame: 4303,
} as const;

/**
 * Base class for every game hosted by this server. It owns what must be common to all games:
 *
 * - **Room codes**: short, unguessable and unique across *all* games of the process (one shared
 *   registry in `roomCodes.ts`), and the room is private: the only way in is the code.
 * - **Game validation**: the client states the game it wants to join (`options.game`). It must match
 *   the room name this room was registered under, otherwise the join is refused with `WRONG_GAME`.
 *   Entering with the code of another game is therefore a clear error, not a confusing half-join.
 */
export abstract class GameRoom extends Room {
  protected code = '';

  onCreate(_options: unknown) {
    this.code = allocateRoomCode();
    this.roomId = this.code;
    // not listed publicly: the only way in is the code
    void this.setPrivate(true);
  }

  onAuth(_client: Client, options: { game?: unknown }) {
    if (options?.game !== this.roomName) throw new ServerError(JoinError.WrongGame, 'WRONG_GAME');
    return true;
  }

  onDispose() {
    releaseRoomCode(this.code);
  }
}
