import { type MapDef, mapSupportsMode } from '../map';
import type { GameMode } from '../rules';
import { FOUNDRY } from './foundry';
import { GATEWAYS } from './gateways';
import { LAVA_SHAFT } from './lavaShaft';
import { OUTPOST } from './outpost';
import { THREE_TOWERS } from './threeTowers';
import { TWIN_DAM } from './twinDam';

/** Lobby order: the four main arenas first, then the original two. */
export const MAPS: readonly MapDef[] = [OUTPOST, THREE_TOWERS, GATEWAYS, LAVA_SHAFT, FOUNDRY, TWIN_DAM];

export const getMap = (id: string): MapDef | undefined => MAPS.find((m) => m.id === id);

/** Maps that can host the mode right now (CTF also needs bases, flags and team spawns). */
export const mapsForMode = (mode: GameMode): MapDef[] => MAPS.filter((m) => mapSupportsMode(m, mode));

export const defaultMapFor = (mode: GameMode): MapDef => mapsForMode(mode)[0];
