import { type BoxDef, box, type LightDef, type MapDef, type PickupDef, ramp, type RampDef, type SpawnDef } from '../map';
import { WeaponId } from '../weapons';
import { mirrorBoxZ, mirrorLightZ, mirrorPickupZ, mirrorRampZ, mirrorSpawnZ, spawn, YAW } from './helpers';

/**
 * "Puesto Avanzado": open-air arena for DM and CTF. The red half (z < 0) is authored once and
 * mirrored, so both bases and their routes are identical. Three routes connect the bases:
 *   - west: elevated industrial catwalk (y = 4), good for precision weapons;
 *   - centre: open field with containers and a raised concrete core (long sight lines);
 *   - east: covered container corridor (close combat), backed by a solid berm.
 * The terrain is closed by 12 m retaining walls under an open sky.
 */

const halfBoxes: BoxDef[] = [
  // ---- base: walls 6 m, roof deck at 6.5 used as a lookout
  box(-13, 0, -65, -12, 6, -46, 'concrete'),
  box(12, 0, -65, 13, 6, -56, 'concrete'),
  box(12, 0, -52, 13, 6, -46, 'concrete'),
  box(12, 4, -56, 13, 6, -52, 'concrete'),
  box(-13, 0, -47, -3, 6, -46, 'red'),
  box(3, 0, -47, 13, 6, -46, 'red'),
  box(-3, 4, -47, 3, 6, -46, 'red'),
  box(-13, 6, -65, 13, 6.5, -46, 'concrete'),
  box(-13, 6.5, -46.4, -4, 7.6, -46, 'trim'),
  box(4, 6.5, -46.4, 13, 7.6, -46, 'trim'),
  // roof access: landing west of the base
  box(-16, 0, -65, -13, 6.5, -62, 'metal'),
  // flag platform and interior cover
  box(-3, 0, -60, 3, 0.4, -54, 'red'),
  box(-9, 0, -52, -7, 1.5, -50, 'metal'),
  box(7, 0, -62, 9, 1.5, -60, 'metal'),
  box(-1, 5.6, -64.9, 1, 5.95, -63, 'light'),

  // ---- west route: catwalk on steel pillars
  box(-30, 3.5, -40, -24, 4, -8, 'grate'),
  box(-29.5, 0, -36.4, -28.7, 3.5, -35.6, 'metal'),
  box(-25.3, 0, -36.4, -24.5, 3.5, -35.6, 'metal'),
  box(-29.5, 0, -20.4, -28.7, 3.5, -19.6, 'metal'),
  box(-25.3, 0, -20.4, -24.5, 3.5, -19.6, 'metal'),
  box(-24.3, 4, -36, -24, 5, -26, 'trim'),
  box(-24.3, 4, -20, -24, 5, -11, 'trim'),
  box(-28, 4, -30, -26, 5.1, -29.4, 'metal'),

  // ---- centre field: containers and low cover
  box(-10, 0, -30, -4, 2.6, -27.5, 'metal'),
  box(-10, 2.6, -30, -7, 5.2, -27.5, 'metal'),
  box(4, 0, -22, 10, 2.6, -19.5, 'metal'),
  box(-2, 0, -38, 2, 1.2, -36.8, 'trim'),
  box(10, 0, -40, 12, 1.4, -37, 'concrete'),
  box(-16, 0, -18, -13, 1.8, -15, 'concrete'),

  // ---- east route: covered corridor, entrances at both ends and two side openings
  box(16, 0, -40, 17, 3.5, -31, 'metal'),
  box(16, 0, -28, 17, 3.5, -19, 'metal'),
  box(16, 0, -16, 17, 3.5, -10, 'metal'),
  box(24, 0, -40, 25, 3.5, -10, 'metal'),
  box(16, 3.5, -40, 25, 4, -10, 'dark'),
  box(20, 3.45, -38, 21, 3.5, -12, 'light'),
  box(25, 0, -40, 33, 4, -10, 'concrete'),
];

const halfRamps: RampDef[] = [
  ramp(-16, 0, -62, -13, 6.5, -48, '-z', 'metal'),
  ramp(-30, 0, -46, -24, 4, -40, '+z', 'metal'),
  ramp(-2, 0, -11, 2, 3, -5, '+z', 'grate'),
];

const halfSpawns: SpawnDef[] = [
  spawn(-8, 0, -62, YAW.pz, 0),
  spawn(5, 0, -63.5, YAW.pz, 0),
  spawn(-6, 0, -56, YAW.pz, 0),
  spawn(0, 0, -50, YAW.pz, 0),
  spawn(20, 0, -58, YAW.pz, 0),
  spawn(-20, 0, -58, YAW.pz, 0),
  spawn(0, 6.5, -60, YAW.pz, 0),
  spawn(-27, 4, -36, YAW.pz, 0),
];

const halfPickups: PickupDef[] = [
  { kind: 'health', pos: [-9, 0, -58] },
  { kind: 'health', pos: [9, 0, -50] },
  { kind: 'shield', pos: [0, 6.5, -56] },
  { kind: 'ammo', weapon: WeaponId.Charge, pos: [-8, 6.5, -62] },
  { kind: 'ammo', weapon: WeaponId.Sniper, pos: [-27, 4, -24] },
  { kind: 'ammo', weapon: WeaponId.Shotgun, pos: [20, 0, -25] },
  { kind: 'health', pos: [20, 0, -14] },
  { kind: 'ammo', weapon: WeaponId.Rocket, pos: [-6, 0, -24] },
  { kind: 'ammo', weapon: WeaponId.Rifle, pos: [6, 0, -44] },
  { kind: 'ammo', weapon: WeaponId.Grenade, pos: [-20, 0, -30] },
  { kind: 'ammo', weapon: WeaponId.Plasma, pos: [10, 0, -32] },
];

const RED_LIGHT = 0xff4a3a;
const BLUE_LIGHT = 0x3a8cff;
const halfLights: LightDef[] = [{ pos: [0, 5, -56], color: RED_LIGHT, intensity: 40, distance: 22 }];

export const OUTPOST: MapDef = {
  id: 'outpost',
  name: 'Puesto Avanzado',
  description: 'Arena exterior a cielo abierto: pasarela industrial, campo central y corredor de contenedores entre dos bases.',
  modes: ['dm', 'ctf'],
  killY: -10,
  boxes: [
    box(-34, -1, -66, 34, 0, 66, 'ground'),
    box(-34, 0, -66, 34, 12, -65, 'concrete'),
    box(-34, 0, 65, 34, 12, 66, 'concrete'),
    box(-34, 0, -65, -33, 12, 65, 'concrete'),
    box(33, 0, -65, 34, 12, 65, 'concrete'),
    ...halfBoxes,
    ...halfBoxes.map(mirrorBoxZ),
    // midfield: raised core with cover, catwalk centre span, courtyard container
    box(-6, 0, -5, 6, 3, 5, 'concrete'),
    box(-4, 3, -0.25, -1, 4.1, 0.25, 'metal'),
    box(1, 3, -0.25, 4, 4.1, 0.25, 'metal'),
    box(-30, 3.5, -8, -24, 4, 8, 'grate'),
    box(-29.5, 0, -0.4, -28.7, 3.5, 0.4, 'metal'),
    box(-25.3, 0, -0.4, -24.5, 3.5, 0.4, 'metal'),
    box(20, 0, -1.5, 27, 2.6, 1.5, 'metal'),
  ],
  ramps: [...halfRamps, ...halfRamps.map(mirrorRampZ)],
  spawns: [...halfSpawns, ...halfSpawns.map(mirrorSpawnZ)],
  pickups: [
    { kind: 'shieldBig', pos: [0, 3, 2.5] },
    { kind: 'healthBig', pos: [-27, 4, 3] },
    { kind: 'healthBig', pos: [17.5, 0, 0] },
    ...halfPickups,
    ...halfPickups.map(mirrorPickupZ),
  ],
  flags: [
    { team: 0, pos: [0, 0.4, -57] },
    { team: 1, pos: [0, 0.4, 57] },
  ],
  lights: [
    { pos: [0, 9, 0], color: 0xfff2dc, intensity: 40, distance: 30 },
    ...halfLights,
    ...halfLights.map((l) => mirrorLightZ(l, [RED_LIGHT, BLUE_LIGHT])),
  ],
  theme: {
    sky: 0xa9c3dc,
    skyTop: 0x2f64b0,
    fog: 0xa9bdd0,
    fogNear: 60,
    fogFar: 230,
    hemiSky: 0xd4e4ff,
    hemiGround: 0x5c4c3a,
    hemiIntensity: 1.1,
    sunDir: [0.45, 1, 0.25],
    sunColor: 0xfff0d6,
    sunIntensity: 2.2,
  },
};
