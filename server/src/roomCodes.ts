import { randomInt } from 'node:crypto';
import { ROOM } from '@arena/shared';

/** Codes of rooms that currently exist in this process. */
const active = new Set<string>();

/**
 * Generates a short, unguessable room code (31^6 ≈ 887 million combinations) using a CSPRNG,
 * guaranteed not to collide with any active room.
 */
export const allocateRoomCode = (): string => {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM.codeLength; i++) code += ROOM.codeAlphabet[randomInt(ROOM.codeAlphabet.length)];
    if (!active.has(code)) {
      active.add(code);
      return code;
    }
  }
  throw new Error('could not allocate a room code');
};

export const releaseRoomCode = (code: string): void => {
  active.delete(code);
};

export const isRoomCodeActive = (code: string): boolean => active.has(code);

export const normalizeRoomCode = (raw: string): string => raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
