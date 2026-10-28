import { type BoxDef, box, type JumpPadDef, type MapDef, type PickupDef, type SpawnDef } from '../map';
import { JUMP_PAD } from '../constants';
import { WeaponId } from '../weapons';
import { r2, spawn, YAW } from './helpers';

/**
 * "Pozo de Lava": large indoor cylinder (radius 24) with lava at the bottom. Five ring walkways
 * (y = 3, 8, 13, 18, 23) circle the wall; narrow bridges cross the void at different heights.
 * Some bridges cross each other on a shared platform (L1 centre, L2 west, L4 east), others pass
 * 4.5 m above or below without touching. There is no safety floor: falling means lava.
 *
 * Vertical routes:
 *   - up: a jump circle on each ring (L1–L4) throws the player through a hole in the ring above
 *     (alternating ±x sides); a second circle on the L1 centre platform reaches the L2 bridge;
 *   - down: a drop hole in each ring (L2–L5) at z ∈ [−6, −3], on the side opposite to the ascent hole.
 *
 * The rings are built from 3 m strips along z, so the curved wall is approximated by steps.
 */

const R = 24;
const S = 26;
const STRIP = 3;
const TOP = 30;

export const LAVA_LEVELS: { y: number; rin: number }[] = [
  { y: 3, rin: 16 },
  { y: 8, rin: 17 },
  { y: 13, rin: 18 },
  { y: 18, rin: 19 },
  { y: 23, rin: 20 },
];

const strips: [number, number][] = [];
for (let z = -R; z < R; z += STRIP) strips.push([z, z + STRIP]);

const zMin = ([z0, z1]: [number, number]): number => (z0 < 0 && z1 > 0 ? 0 : Math.min(Math.abs(z0), Math.abs(z1)));
const outerW = (s: [number, number]): number => r2(Math.sqrt(R * R - zMin(s) ** 2));
const innerW = (rin: number, s: [number, number]): number => {
  const zm = zMin(s);
  return zm >= rin ? 0 : r2(Math.sqrt(rin * rin - zm * zm));
};

/** Ring strips left open: `level:side:z0` (level index, side ±1, strip start). */
const HOLES = new Set<string>([
  // ascent holes above each jump circle
  '1:1:0',
  '2:-1:0',
  '3:1:0',
  '4:-1:0',
  // drop holes
  '1:-1:-6',
  '2:1:-6',
  '3:-1:-6',
  '4:1:-6',
]);

const ringBoxes: BoxDef[] = LAVA_LEVELS.flatMap(({ y, rin }, li) =>
  strips.flatMap((s): BoxDef[] => {
    const wo = outerW(s);
    const wi = innerW(rin, s);
    if (wi === 0) return [box(-wo, y - 0.5, s[0], wo, y, s[1], 'metal')];
    return ([-1, 1] as const)
      .filter((side) => !HOLES.has(`${li}:${side}:${s[0]}`))
      .map((side) => box(side * wi, y - 0.5, s[0], side * wo, y, s[1], 'metal'));
  }),
);

const shellBoxes: BoxDef[] = [
  ...strips.flatMap((s) => [box(-S, -3, s[0], -outerW(s), TOP, s[1], 'panel'), box(outerW(s), -3, s[0], S, TOP, s[1], 'panel')]),
  box(-S, -3, -S, S, TOP, -R, 'panel'),
  box(-S, -3, R, S, TOP, S, 'panel'),
  box(-S, TOP, -S, S, TOP + 1, S, 'dark'),
  box(-S, -4, -S, S, -3, S, 'dark'),
];

const bridgeBoxes: BoxDef[] = [
  // L1 (y 3): cross with a centre platform
  box(-16, 2.5, -1.5, 16, 3, 1.5, 'grate'),
  box(-1.5, 2.5, -18, 1.5, 3, 18, 'grate'),
  box(-3.5, 2.5, -3.5, 3.5, 3.25, 3.5, 'metal'),
  // L2 (y 8): crossing platform on the west side
  box(-14.42, 7.5, 9.25, 14.42, 8, 11.75, 'grate'),
  box(-11, 7.5, -15, -8.5, 8, 15, 'grate'),
  box(-12.5, 7.5, 8, -7, 8.25, 13, 'metal'),
  // L3 (y 13): single span over the L1 cross
  box(-1.25, 12.5, -18, 1.25, 13, 18, 'grate'),
  // L4 (y 18): crossing platform on the east side
  box(-16.73, 17.5, -11.75, 16.73, 18, -9.25, 'grate'),
  box(8.5, 17.5, -18, 11, 18, 18, 'grate'),
  box(7, 17.5, -13, 12.5, 18.25, -8, 'metal'),
  // L5 (y 23): high span over the L2 and L4 north-south bridges
  box(-16, 22.5, 12.5, 16, 23, 14.5, 'grate'),
];

/** Wall-mounted light strips just above each ring. */
const lampBoxes: BoxDef[] = LAVA_LEVELS.map(({ y }) => box(-2, y + 3.2, R - 0.05, 2, y + 3.4, R, 'light'));

const PAD_LAUNCH: [number, number, number] = [0, 18, 2.5];

const jumpPads: JumpPadDef[] = [
  ...LAVA_LEVELS.slice(0, 4).map(({ y }, i): JumpPadDef => {
    const side = i % 2 === 0 ? 1 : -1;
    const x = r2((side * (LAVA_LEVELS[i + 1].rin + R)) / 2);
    return { pos: [x, y, 0.83], radius: 0.75, launch: PAD_LAUNCH, cooldown: JUMP_PAD.cooldown, target: [x, LAVA_LEVELS[i + 1].y, 3.7] };
  }),
  { pos: [0, 3.25, 2.3], radius: 0.8, launch: [0, 17, 7.7], cooldown: JUMP_PAD.cooldown, target: [0, 8, 10.5] },
];

const sideAmmo: [WeaponId, WeaponId][] = [
  [WeaponId.Rifle, WeaponId.Shotgun],
  [WeaponId.Grenade, WeaponId.Plasma],
  [WeaponId.Rocket, WeaponId.Rifle],
  [WeaponId.Sniper, WeaponId.Shotgun],
  [WeaponId.Charge, WeaponId.Rocket],
];

const midStrip = (rin: number, s: [number, number]): number => r2((innerW(rin, s) + outerW(s)) / 2);

const pickups: PickupDef[] = LAVA_LEVELS.flatMap(({ y, rin }, i): PickupDef[] => {
  const north = i % 2 === 0 ? 22.5 : -22.5;
  const ax = midStrip(rin, [6, 9]);
  return [
    { kind: 'health', pos: [0, y, north] },
    { kind: 'shield', pos: [0, y, -north] },
    { kind: 'ammo', weapon: sideAmmo[i][0], pos: [-ax, y, 7.5] },
    { kind: 'ammo', weapon: sideAmmo[i][1], pos: [ax, y, 7.5] },
  ];
});

const spawns: SpawnDef[] = LAVA_LEVELS.flatMap(({ y, rin }) => {
  const x = midStrip(rin, [-12, -9]);
  return [spawn(-x, y, -10.5, YAW.nz), spawn(x, y, -10.5, YAW.nz)];
});

export const LAVA_SHAFT: MapDef = {
  id: 'lava',
  name: 'Pozo de Lava',
  description: 'Cilindro interior con lava en el fondo: cinco anillos, puentes cruzados y círculos de salto.',
  modes: ['dm'],
  killY: -10,
  boxes: [...shellBoxes, ...ringBoxes, ...bridgeBoxes, ...lampBoxes],
  ramps: [],
  spawns,
  pickups: [...pickups, { kind: 'shieldBig', pos: [0, 3.25, -2] }, { kind: 'healthBig', pos: [-9.75, 8.25, 10.5] }],
  flags: [],
  jumpPads,
  hazards: [{ kind: 'lava', min: [-S, -3, -S], max: [S, 0, S] }],
  lights: [
    { pos: [0, 2, 0], color: 0xff6a20, intensity: 90, distance: 40 },
    { pos: [0, 14, 0], color: 0xff8a40, intensity: 40, distance: 30 },
    { pos: [0, 27, 0], color: 0xffd0a0, intensity: 30, distance: 26 },
    { pos: [0, 20, 20], color: 0xff7030, intensity: 20, distance: 18 },
  ],
  theme: {
    sky: 0x1a0a06,
    fog: 0x2a1008,
    fogNear: 25,
    fogFar: 90,
    hemiSky: 0xffb080,
    hemiGround: 0x601808,
    hemiIntensity: 1.0,
    sunDir: [0.2, 1, 0.1],
    sunColor: 0xffc8a0,
    sunIntensity: 0.6,
  },
};
