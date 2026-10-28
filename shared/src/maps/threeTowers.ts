import { type BoxDef, box, type MapDef, type PickupDef, ramp, type RampDef, type Tuple3 } from '../map';
import { WeaponId } from '../weapons';
import { spawn, YAW } from './helpers';

/**
 * "Tres Torres": three walkable towers with three levels each (5, 10 and the roof at 15), linked
 * by bridges at y = 10 (through a central junction) and a lower bridge at y = 5 between the two
 * northern towers. Every tower carries the same kind of set (health on F1, shield on F2, a power
 * weapon on the roof, ammo on the ground floor) but each roof holds a different power weapon,
 * so no single tower has every advantage. The big shield sits on the exposed junction.
 */

export interface TowerDef {
  name: string;
  cx: number;
  cz: number;
  /** Swaps the local axes (u along z instead of x). */
  rot: boolean;
  roofWeapon: WeaponId;
  groundWeapon: WeaponId;
  light: number;
}

export const TOWERS: TowerDef[] = [
  { name: 'Torre Ámbar', cx: -20, cz: -18, rot: false, roofWeapon: WeaponId.Sniper, groundWeapon: WeaponId.Shotgun, light: 0xffa040 },
  { name: 'Torre Cian', cx: 20, cz: -18, rot: false, roofWeapon: WeaponId.Rocket, groundWeapon: WeaponId.Grenade, light: 0x40d0ff },
  { name: 'Torre Violeta', cx: 0, cz: 20, rot: true, roofWeapon: WeaponId.Charge, groundWeapon: WeaponId.Plasma, light: 0xc070ff },
];

/** Half-size of a tower footprint (pillars included). */
export const TOWER_HALF = 6;

const towerGeometry = (t: TowerDef): { boxes: BoxDef[]; ramps: RampDef[]; pickups: PickupDef[] } => {
  const P = (u: number, v: number): [number, number] => (t.rot ? [t.cx + v, t.cz + u] : [t.cx + u, t.cz + v]);
  const b = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, mat: BoxDef['mat']): BoxDef => {
    const [x0, z0] = P(u0, v0);
    const [x1, z1] = P(u1, v1);
    return box(x0, y0, z0, x1, y1, z1, mat);
  };
  const r = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, up: '+u' | '-u'): RampDef => {
    const [x0, z0] = P(u0, v0);
    const [x1, z1] = P(u1, v1);
    const dir = t.rot ? (up === '+u' ? '+z' : '-z') : up === '+u' ? '+x' : '-x';
    return ramp(x0, y0, z0, x1, y1, z1, dir, 'grate');
  };
  const at = (u: number, y: number, v: number): Tuple3 => {
    const [x, z] = P(u, v);
    return [x, y, z];
  };
  return {
    boxes: [
      b(-6, 0, -6, -5, 16, -5, 'concrete'),
      b(5, 0, -6, 6, 16, -5, 'concrete'),
      b(-6, 0, 5, -5, 16, 6, 'concrete'),
      b(5, 0, 5, 6, 16, 6, 'concrete'),
      // F1, F2 and roof; each leaves a 2.5 m strip open for the ramp to the next level
      b(-6, 4.5, -6, 6, 5, 3.5, 'metal'),
      b(-6, 9.5, -3.5, 6, 10, 6, 'metal'),
      b(-6, 14.5, -6, 6, 15, 3.5, 'metal'),
      // cover crates
      b(1.6, 5, -2, 3, 6.2, -0.6, 'trim'),
      b(1.6, 10, 1, 3, 11.2, 2.4, 'trim'),
      b(-3.5, 15, -3, -2, 16.1, -1.6, 'trim'),
      b(2, 15, -3, 3.5, 16.1, -1.6, 'trim'),
      // glowing band marking the tower colour
      b(-5.9, 13.2, -5.9, 5.9, 13.4, -5.6, 'light'),
    ],
    ramps: [r(-5, 0, 3.5, 5, 5, 6, '+u'), r(-5, 5, -6, 5, 10, -3.5, '-u'), r(-5, 10, 3.5, 5, 15, 6, '+u')],
    pickups: [
      { kind: 'health', pos: at(-3, 5, 0) },
      { kind: 'shield', pos: at(-3, 10, 2) },
      { kind: 'ammo', weapon: t.roofWeapon, pos: at(0, 15, 0) },
      { kind: 'ammo', weapon: t.groundWeapon, pos: at(0, 0, 0) },
    ],
  };
};

const towers = TOWERS.map(towerGeometry);

export const THREE_TOWERS: MapDef = {
  id: 'towers',
  name: 'Tres Torres',
  description: 'Tres torres de tres niveles unidas por puentes: cada una guarda salud, escudo y un arma potente distinta.',
  modes: ['dm'],
  killY: -10,
  boxes: [
    box(-42, -1, -42, 42, 0, 42, 'ground'),
    box(-42, 0, -42, 42, 14, -41, 'concrete'),
    box(-42, 0, 41, 42, 14, 42, 'concrete'),
    box(-42, 0, -41, -41, 14, 41, 'concrete'),
    box(41, 0, -41, 42, 14, 41, 'concrete'),
    ...towers.flatMap((t) => t.boxes),
    // upper bridges (y = 10) through the central junction
    box(-14, 9.5, -19.5, -4, 10, -16.5, 'grate'),
    box(4, 9.5, -19.5, 14, 10, -16.5, 'grate'),
    box(-4, 9.5, -22, 4, 10, -14, 'metal'),
    box(-1.5, 9.5, -14, 1.5, 10, 14, 'grate'),
    // lower bridge (y = 5): passes under the junction without touching it
    box(-14, 4.5, -21.5, 14, 5, -19.5, 'grate'),
    // ground cover
    box(-6, 0, -4, -3, 2, -1, 'concrete'),
    box(3, 0, 1, 6, 2, 4, 'concrete'),
    box(-26, 0, 4, -23, 1.4, 7, 'metal'),
    box(23, 0, 4, 26, 1.4, 7, 'metal'),
    box(-2, 0, -33, 2, 1.8, -31, 'concrete'),
    box(-8, 0, 8, 8, 1.2, 8.6, 'trim'),
  ],
  ramps: towers.flatMap((t) => t.ramps),
  spawns: [
    spawn(-34, 0, 0, YAW.px),
    spawn(34, 0, 0, YAW.nx),
    spawn(0, 0, 34, YAW.nz),
    spawn(-34, 0, -34, YAW.pz),
    spawn(34, 0, -34, YAW.pz),
    spawn(-34, 0, 30, YAW.nz),
    spawn(34, 0, 30, YAW.nz),
    spawn(-5, 0, -36, YAW.pz),
    spawn(-12, 0, 4, YAW.pz),
  ],
  pickups: [
    ...towers.flatMap((t) => t.pickups),
    { kind: 'shieldBig', pos: [0, 10, -18] },
    { kind: 'healthBig', pos: [0, 0, 4] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [-30, 0, 12] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [30, 0, 12] },
  ],
  flags: [],
  lights: [
    ...TOWERS.map((t) => ({ pos: [t.cx, 12.5, t.cz] as Tuple3, color: t.light, intensity: 30, distance: 18 })),
    { pos: [0, 13, -18], color: 0xfff0e0, intensity: 30, distance: 22 },
  ],
  theme: {
    sky: 0xe09a68,
    skyTop: 0x2c2f60,
    fog: 0xb88468,
    fogNear: 55,
    fogFar: 200,
    hemiSky: 0xffd8b8,
    hemiGround: 0x4a3a30,
    hemiIntensity: 1.0,
    sunDir: [-0.6, 0.7, 0.3],
    sunColor: 0xffc890,
    sunIntensity: 2.0,
  },
};
