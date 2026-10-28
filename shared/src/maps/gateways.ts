import { type BoxDef, box, type MapDef, type PickupDef, type PortalDef, ramp } from '../map';
import { WeaponId } from '../weapons';
import { rotBox, spawn, YAW } from './helpers';

/**
 * "Pasarelas": indoor complex on a 3 × 3 grid of 20 m cells. Corner cells are rooms, edge cells
 * are T-shaped corridors and the centre is a hall. Cells connect through **doors** (rectangular
 * 3 × 3.2 m openings framed by a hazard-striped lintel) and three **portal links**, each with
 * its own colour on both ends:
 *   - orange: NW room west wall ↔ SE room east wall;
 *   - cyan:   hole in the centre hall floor ↔ NE room north wall;
 *   - magenta: hole in the SW room floor ↔ centre hall west wall.
 * Only players travel through portals; projectiles and shots hit the wall or floor behind them.
 */

const H = 7;
const DOOR_W = 1.5;
const DOOR_H = 3.2;

/** Interior wall on the line `axis = c`, spanning the complex, with doors centred on `doors`. */
const wallLine = (axis: 'x' | 'z', c: number, doors: number[]): BoxDef[] => {
  const out: BoxDef[] = [];
  const mk = (a0: number, y0: number, a1: number, y1: number, mat: BoxDef['mat']) =>
    axis === 'x' ? box(c - 0.3, y0, a0, c + 0.3, y1, a1, mat) : box(a0, y0, c - 0.3, a1, y1, c + 0.3, mat);
  let from = -30;
  for (const d of [...doors].sort((a, b) => a - b)) {
    out.push(mk(from, 0, d - DOOR_W, H, 'panel'));
    out.push(mk(d - DOOR_W, DOOR_H, d + DOOR_W, DOOR_H + 0.4, 'trim'));
    out.push(mk(d - DOOR_W, DOOR_H + 0.4, d + DOOR_W, H, 'panel'));
    from = d + DOOR_W;
  }
  out.push(mk(from, 0, 30, H, 'panel'));
  return out;
};

/** North corridor cell; the other three are quarter-turns of it. */
const corridorFill: BoxDef[] = [
  box(-9.7, 0, -30, 9.7, H, -23, 'concrete'),
  box(-9.7, 0, -17, -3, H, -10.3, 'concrete'),
  box(3, 0, -17, 9.7, H, -10.3, 'concrete'),
];

/** North-west room cover; the other rooms are quarter-turns of it. */
const roomCover: BoxDef[] = [box(-26, 0, -15, -23.5, 1.3, -12.5, 'metal'), box(-15, 0, -27, -12.5, 2.4, -24.5, 'metal')];

const quarterTurns = (src: BoxDef[]): BoxDef[] => [0, 1, 2, 3].flatMap((k) => src.map((b) => rotBox(b, k)));

const ORANGE = 0xff8a2a;
const CYAN = 0x2fd0ff;
const MAGENTA = 0xff4fd8;

export const GATEWAY_PORTALS: PortalDef[] = [
  { id: 'O1', kind: 'wall', pos: [-30, 1.5, -20], face: '+x', radius: 1.2, to: 'O2', exits: [[-27.4, 0, -20], [-27.4, 0, -22.2]], color: ORANGE },
  { id: 'O2', kind: 'wall', pos: [30, 1.5, 20], face: '-x', radius: 1.2, to: 'O1', exits: [[27.4, 0, 20], [27.4, 0, 22.2]], color: ORANGE },
  { id: 'C1', kind: 'floor', pos: [0, 0, 6.5], face: '+z', radius: 1.2, to: 'C2', exits: [[0, 0, 8.6], [2.2, 0, 8.6]], color: CYAN },
  { id: 'C2', kind: 'wall', pos: [20, 1.5, -30], face: '+z', radius: 1.2, to: 'C1', exits: [[20, 0, -27.4], [22.2, 0, -27.4]], color: CYAN },
  { id: 'M1', kind: 'floor', pos: [-20, 0, 20], face: '-z', radius: 1.2, to: 'M2', exits: [[-20, 0, 17.6], [-17.6, 0, 20]], color: MAGENTA },
  { id: 'M2', kind: 'wall', pos: [-9.7, 1.5, -4.5], face: '+x', radius: 1.2, to: 'M1', exits: [[-7.3, 0, -4.5], [-5.2, 0, -4.5]], color: MAGENTA },
];

const pickups: PickupDef[] = [
  // rooms
  { kind: 'health', pos: [-24, 0, -26] },
  { kind: 'ammo', weapon: WeaponId.Rocket, pos: [-14, 0, -14] },
  { kind: 'shield', pos: [26, 0, -26] },
  { kind: 'ammo', weapon: WeaponId.Sniper, pos: [14, 0, -14] },
  { kind: 'health', pos: [24, 0, 26] },
  { kind: 'ammo', weapon: WeaponId.Grenade, pos: [14, 0, 14] },
  { kind: 'shield', pos: [-26, 0, 26] },
  { kind: 'ammo', weapon: WeaponId.Plasma, pos: [-14, 0, 14] },
  // corridors
  { kind: 'ammo', weapon: WeaponId.Shotgun, pos: [0, 0, -20] },
  { kind: 'ammo', weapon: WeaponId.Rifle, pos: [0, 0, 20] },
  { kind: 'health', pos: [-20, 0, 0] },
  { kind: 'health', pos: [20, 0, 0] },
  // centre hall
  { kind: 'shieldBig', pos: [0, 1, 1.5] },
  { kind: 'ammo', weapon: WeaponId.Charge, pos: [-3, 0, 7] },
];

export const GATEWAYS: MapDef = {
  id: 'gateways',
  name: 'Pasarelas',
  description: 'Salas y pasillos unidos por puertas y por tres pares de portales de colores (naranja, cian y magenta).',
  modes: ['dm'],
  killY: -10,
  boxes: [
    box(-31, -1, -31, 31, 0, 31, 'floor'),
    box(-31, H, -31, 31, H + 0.5, 31, 'dark'),
    box(-31, 0, -31, -30, H, 31, 'panel'),
    box(30, 0, -31, 31, H, 31, 'panel'),
    box(-30, 0, -31, 30, H, -30, 'panel'),
    box(-30, 0, 30, 30, H, 31, 'panel'),
    ...wallLine('x', -10, [-20, 0, 20]),
    ...wallLine('x', 10, [-20, 0, 20]),
    ...wallLine('z', -10, [-20, 0, 20]),
    ...wallLine('z', 10, [-20, 0, 20]),
    ...quarterTurns(corridorFill),
    ...quarterTurns(roomCover),
    // centre hall: raised dais and four pillars
    box(-4, 0, -4, 4, 1, 4, 'metal'),
    box(-7.1, 0, -7.1, -5.9, H, -5.9, 'concrete'),
    box(5.9, 0, -7.1, 7.1, H, -5.9, 'concrete'),
    box(-7.1, 0, 5.9, -5.9, H, 7.1, 'concrete'),
    box(5.9, 0, 5.9, 7.1, H, 7.1, 'concrete'),
    box(-1, H - 0.05, -1, 1, H, 1, 'light'),
  ],
  ramps: [ramp(-8, 0, -1.5, -4, 1, 1.5, '+x', 'grate'), ramp(4, 0, -1.5, 8, 1, 1.5, '-x', 'grate')],
  spawns: [
    spawn(-16, 0, -20, YAW.nx),
    spawn(20, 0, -16, YAW.nz),
    spawn(16, 0, 20, YAW.px),
    spawn(-24, 0, 26, YAW.px),
    spawn(-6, 0, -20, YAW.px),
    spawn(6, 0, 20, YAW.nx),
    spawn(-20, 0, 6, YAW.nz),
    spawn(20, 0, -6, YAW.pz),
    spawn(0, 1, -2.5, YAW.nz),
  ],
  pickups,
  flags: [],
  portals: GATEWAY_PORTALS,
  lights: [
    { pos: [0, 6, 0], color: 0xe8f0ff, intensity: 30, distance: 20 },
    { pos: [-26, 4, -20], color: ORANGE, intensity: 18, distance: 16 },
    { pos: [20, 4, -26], color: CYAN, intensity: 18, distance: 16 },
    { pos: [-20, 5, 20], color: MAGENTA, intensity: 18, distance: 16 },
  ],
  theme: {
    sky: 0x0c1018,
    fog: 0x0e121c,
    fogNear: 30,
    fogFar: 110,
    hemiSky: 0xa0b0d8,
    hemiGround: 0x2a2630,
    hemiIntensity: 1.1,
    sunDir: [0.3, 1, 0.2],
    sunColor: 0xd0d8ff,
    sunIntensity: 0.8,
  },
};
