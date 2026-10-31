import { box, type MapDef, ramp, type Tuple3 } from '../map';
import { WeaponId } from '../weapons';
import { spawn, YAW } from './helpers';

/**
 * "Reducto": open arena for PvE horde mode. Raised central platform (safe spawn), walkable ring
 * ~120 m across, perimeter horde entry points and low cover — no dense maze.
 */

const ARENA_HALF = 60;
const HORDE_RADIUS = 56;
const HORDE_COUNT = 12;

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
    box(-ARENA_HALF, -1, -ARENA_HALF, ARENA_HALF, 0, ARENA_HALF, 'ground'),
    box(-ARENA_HALF, 0, -ARENA_HALF, ARENA_HALF, 6, -ARENA_HALF + 1, 'concrete'),
    box(-ARENA_HALF, 0, ARENA_HALF - 1, ARENA_HALF, 6, ARENA_HALF, 'concrete'),
    box(-ARENA_HALF, 0, -ARENA_HALF + 1, -ARENA_HALF + 1, 6, ARENA_HALF - 1, 'concrete'),
    box(ARENA_HALF - 1, 0, -ARENA_HALF + 1, ARENA_HALF, 6, ARENA_HALF - 1, 'concrete'),

    // central platform (walkable deck y = 1.5); ramps climb from the outside ring
    box(-12, 0, -12, 12, 1.5, 12, 'concrete'),

    // ring cover (scaled outward)
    cover(-44, 0),
    cover(44, 0),
    cover(0, -48, 3, 2.4, 1.6),
    cover(0, 48, 3, 2.4, 1.6),
    cover(-36, 36),
    cover(36, -36),
    cover(-50, -18, 2, 2, 1.2),
    cover(50, 18, 2, 2, 1.2),
    box(-28, 0, -28, -22, 0.8, -22, 'panel'),
    box(22, 0, 22, 28, 0.8, 28, 'panel'),
    cover(-24, 14),
    cover(24, -14),
    cover(-18, -40),
    cover(18, 40),
  ],
  ramps: [
    ramp(-16, 0, -4, -12, 1.5, 4, '+x', 'concrete'),
    ramp(12, 0, -4, 16, 1.5, 4, '-x', 'concrete'),
    ramp(-4, 0, -16, 4, 1.5, -12, '+z', 'concrete'),
    ramp(-4, 0, 12, 4, 1.5, 16, '-z', 'concrete'),
  ],
  spawns: [
    spawn(0, 1.5, 0, YAW.pz),
    spawn(-5, 1.5, 4, YAW.pz),
    spawn(5, 1.5, -4, YAW.pz),
    spawn(3, 1.5, 5, YAW.pz),
  ],
  /** Suministros en el anillo exterior (no en la plataforma central); se reinician cada oleada. */
  pickups: [
    { kind: 'healthBig', pos: [-46, 0, -14] },
    { kind: 'healthBig', pos: [46, 0, 14] },
    { kind: 'health', pos: [14, 0, -46] },
    { kind: 'shield', pos: [-14, 0, 46] },
    { kind: 'shieldBig', pos: [0, 0, -50] },
    { kind: 'shield', pos: [-50, 0, 0] },
    // anillo de munición (arma asignada por oleada según desbloqueos del equipo)
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [46, 0, -14] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [-46, 0, 14] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [40, 0, -40] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [-40, 0, 40] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [52, 0, 0] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [-52, 0, 0] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [0, 0, 52] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [0, 0, -52] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [38, 0, 22] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [-38, 0, -22] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [22, 0, -38] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [-22, 0, 38] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [44, 0, 28] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [-44, 0, -28] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [28, 0, 44] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [-28, 0, -44] },
  ],
  flags: [],
  lights: [
    { pos: [0, 10, 0], color: 0xfff2dc, intensity: 55, distance: 85 },
    { pos: [0, 5, 0], color: 0xffe8c8, intensity: 32, distance: 28 },
  ],
  theme: {
    sky: 0xa9c3dc,
    skyTop: 0x2f64b0,
    fog: 0xa9bdd0,
    fogNear: 90,
    fogFar: 320,
    hemiSky: 0xd4e4ff,
    hemiGround: 0x5c4c3a,
    hemiIntensity: 1.05,
    sunDir: [0.4, 1, 0.3],
    sunColor: 0xfff0d6,
    sunIntensity: 2.1,
  },
};
