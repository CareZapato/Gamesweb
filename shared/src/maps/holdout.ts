import { box, type MapDef, ramp, type Tuple3 } from '../map';
import { WeaponId } from '../weapons';
import { spawn, YAW } from './helpers';

/**
 * "Reducto": open arena for PvE horde mode. Raised central platform (safe spawn), walkable ring
 * ~80 m across, perimeter horde entry points and low cover — no dense maze.
 */

const HORDE_RADIUS = 38;
const HORDE_COUNT = 10;

/** Perimeter spawn feet positions (exported for server/tests). */
export const HOLDOUT_HORDE_SPAWNS: Tuple3[] = Array.from({ length: HORDE_COUNT }, (_, i) => {
  const a = (i / HORDE_COUNT) * Math.PI * 2 + Math.PI / HORDE_COUNT;
  return [Math.round(Math.cos(a) * HORDE_RADIUS * 10) / 10, 0, Math.round(Math.sin(a) * HORDE_RADIUS * 10) / 10];
});

const cover = (x: number, z: number, w = 2.4, d = 1.2, h = 1.4) => box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 'metal');

export const HOLDOUT: MapDef = {
  id: 'holdout',
  name: 'Reducto',
  description: 'Arena abierta: plataforma central elevada y anillo exterior para resistir oleadas.',
  modes: ['survival'],
  killY: -10,
  hordeSpawns: HOLDOUT_HORDE_SPAWNS,
  boxes: [
    box(-42, -1, -42, 42, 0, 42, 'ground'),
    box(-42, 0, -42, 42, 6, -41, 'concrete'),
    box(-42, 0, 41, 42, 6, 42, 'concrete'),
    box(-42, 0, -41, -41, 6, 41, 'concrete'),
    box(41, 0, -41, 42, 6, 41, 'concrete'),

    // central platform (walkable deck y = 1.5); the ramps below climb onto it from the outside
    box(-10, 0, -10, 10, 1.5, 10, 'concrete'),

    // ring cover
    cover(-28, 0),
    cover(28, 0),
    cover(0, -30, 3, 2.4, 1.6),
    cover(0, 30, 3, 2.4, 1.6),
    cover(-22, 22),
    cover(22, -22),
    cover(-32, -12, 2, 2, 1.2),
    cover(32, 12, 2, 2, 1.2),
    box(-18, 0, -18, -14, 0.8, -14, 'panel'),
    box(14, 0, 14, 18, 0.8, 18, 'panel'),
    cover(-15, 8),
    cover(15, -8),
  ],
  ramps: [
    // outside the deck (x/z beyond +-10): inside it they would be buried and the deck unreachable
    ramp(-14, 0, -3, -10, 1.5, 3, '+x', 'concrete'),
    ramp(10, 0, -3, 14, 1.5, 3, '-x', 'concrete'),
    ramp(-3, 0, -14, 3, 1.5, -10, '+z', 'concrete'),
    ramp(-3, 0, 10, 3, 1.5, 14, '-z', 'concrete'),
  ],
  spawns: [
    spawn(0, 1.5, 0, YAW.pz),
    spawn(-4, 1.5, 3, YAW.pz),
    spawn(4, 1.5, -3, YAW.pz),
    spawn(2, 1.5, 4, YAW.pz),
  ],
  pickups: [
    { kind: 'healthBig', pos: [-7, 1.5, -7] },
    { kind: 'shield', pos: [7, 1.5, 7] },
    { kind: 'ammo', weapon: WeaponId.Shotgun, pos: [7, 1.5, -7] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [-7, 1.5, 7] },
  ],
  flags: [],
  lights: [
    { pos: [0, 8, 0], color: 0xfff2dc, intensity: 45, distance: 55 },
    { pos: [0, 4, 0], color: 0xffe8c8, intensity: 28, distance: 22 },
  ],
  theme: {
    sky: 0xa9c3dc,
    skyTop: 0x2f64b0,
    fog: 0xa9bdd0,
    fogNear: 70,
    fogFar: 240,
    hemiSky: 0xd4e4ff,
    hemiGround: 0x5c4c3a,
    hemiIntensity: 1.05,
    sunDir: [0.4, 1, 0.3],
    sunColor: 0xfff0d6,
    sunIntensity: 2.1,
  },
};
