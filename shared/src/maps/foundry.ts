import { box, type MapDef, ramp, type SpawnDef } from '../map';
import { WeaponId } from '../weapons';

/** Yaw that faces the map center from (x, z). */
const faceCenter = (x: number, z: number): number => Math.atan2(x, z);

const spawn = (x: number, y: number, z: number, yaw = faceCenter(x, z)): SpawnDef => ({ pos: [x, y, z], yaw });

/**
 * "Fundición Delta": compact three-level industrial hall for Deathmatch.
 * Ground floor with a raised core, balconies at 5 m joined by a bridge, sniper perches at 8.5 m.
 * Layout is point-symmetric so no side has an advantage.
 */
export const FOUNDRY: MapDef = {
  id: 'foundry',
  name: 'Fundición Delta',
  description: 'Nave industrial compacta de tres niveles con núcleo elevado, balcones y puente central.',
  modes: ['dm'],
  killY: -10,
  boxes: [
    // shell
    box(-31, -1, -31, 31, 0, 31, 'floor'),
    box(-31, 0, -31, 31, 14, -30, 'panel'),
    box(-31, 0, 30, 31, 14, 31, 'panel'),
    box(-31, 0, -30, -30, 14, 30, 'panel'),
    box(30, 0, -30, 31, 14, 30, 'panel'),
    box(-31, 14, -31, 31, 15, 31, 'dark'),

    // core
    box(-6, 0, -6, 6, 2, 6, 'concrete'),
    box(-6, 2, -6, -4, 3.2, -4, 'metal'),
    box(4, 2, -6, 6, 3.2, -4, 'metal'),
    box(-6, 2, 4, -4, 3.2, 6, 'metal'),
    box(4, 2, 4, 6, 3.2, 6, 'metal'),

    // balconies (5 m) and their support pillars
    box(-30, 4.5, -30, 30, 5, -20, 'grate'),
    box(-30, 4.5, 20, 30, 5, 30, 'grate'),
    ...[-20, -10, 10, 20].flatMap((x) => [
      box(x - 0.5, 0, -21, x + 0.5, 4.5, -20, 'metal'),
      box(x - 0.5, 0, 20, x + 0.5, 4.5, 21, 'metal'),
    ]),
    // balcony railings (gaps for bridge)
    box(-26, 5, -20.3, -2, 6, -20, 'trim'),
    box(2, 5, -20.3, 26, 6, -20, 'trim'),
    box(-26, 5, 20, -2, 6, 20.3, 'trim'),
    box(2, 5, 20, 26, 6, 20.3, 'trim'),

    // bridge over the core
    box(-2, 4.5, -20, 2, 5, 20, 'grate'),
    box(-2.3, 5, -20, -2, 5.8, -7, 'trim'),
    box(2, 5, -20, 2.3, 5.8, -7, 'trim'),
    box(-2.3, 5, 7, -2, 5.8, 20, 'trim'),
    box(2, 5, 7, 2.3, 5.8, 20, 'trim'),

    // sniper perches (8.5 m)
    box(-8, 8, -30, 8, 8.5, -26, 'metal'),
    box(-8, 8.5, -26.3, 8, 9.3, -26, 'trim'),
    box(-8, 8, 26, 8, 8.5, 30, 'metal'),
    box(-8, 8.5, 26, 8, 9.3, 26.3, 'trim'),

    // ground floor cover
    box(-16, 0, -1, -14, 14, 1, 'concrete'),
    box(14, 0, -1, 16, 14, 1, 'concrete'),
    box(-18, 0, -8, -15, 2, -5, 'metal'),
    box(15, 0, 5, 18, 2, 8, 'metal'),
    box(-14, 0, 10, -12, 1.2, 12, 'metal'),
    box(12, 0, -12, 14, 1.2, -10, 'metal'),
    box(-24, 0, -4, -23.4, 1.3, 4, 'trim'),
    box(23.4, 0, -4, 24, 1.3, 4, 'trim'),

    // light strips (visual, embedded against walls/ceiling)
    box(-25, 9, -30, -15, 9.4, -29.8, 'light'),
    box(15, 9, -30, 25, 9.4, -29.8, 'light'),
    box(-25, 9, 29.8, -15, 9.4, 30, 'light'),
    box(15, 9, 29.8, 25, 9.4, 30, 'light'),
    box(-29.8, 7, -6, -30, 7.4, 6, 'light'),
    box(29.8, 7, -6, 30, 7.4, 6, 'light'),
    box(-1, 13.8, -18, 1, 14, 18, 'light'),
    box(-0.6, 0, -0.6, 0.6, 0.02, 0.6, 'light'),
  ],
  ramps: [
    // core ramps
    ramp(-2, 0, -10, 2, 2, -6, '+z', 'grate'),
    ramp(-2, 0, 6, 2, 2, 10, '-z', 'grate'),
    ramp(-10, 0, -2, -6, 2, 2, '+x', 'grate'),
    ramp(6, 0, -2, 10, 2, 2, '-x', 'grate'),
    // ground -> balconies
    ramp(26, 0, -20, 30, 5, -8, '-z', 'metal'),
    ramp(-30, 0, -20, -26, 5, -8, '-z', 'metal'),
    ramp(26, 0, 8, 30, 5, 20, '+z', 'metal'),
    ramp(-30, 0, 8, -26, 5, 20, '+z', 'metal'),
    // balconies -> perches
    ramp(8, 5, -30, 18, 8.5, -26, '-x', 'metal'),
    ramp(-18, 5, 26, -8, 8.5, 30, '+x', 'metal'),
  ],
  spawns: [
    spawn(-24, 0, -14),
    spawn(24, 0, 14),
    spawn(24, 0, -14),
    spawn(-24, 0, 14),
    spawn(0, 0, -16),
    spawn(0, 0, 16),
    spawn(-20, 5, -25),
    spawn(20, 5, 25),
    // perches: face along the walkway toward the ramp down (the railing blocks the way to the center)
    spawn(0, 8.5, -28, -Math.PI / 2),
    spawn(0, 8.5, 28, Math.PI / 2),
    spawn(-12, 0, 0),
    spawn(12, 0, 0),
  ],
  pickups: [
    { kind: 'shieldBig', pos: [0, 2, 0] },
    { kind: 'shield', pos: [0, 5, -24] },
    { kind: 'shield', pos: [0, 5, 24] },
    { kind: 'healthBig', pos: [27, 0, -25] },
    { kind: 'healthBig', pos: [-27, 0, 25] },
    { kind: 'health', pos: [-12, 0, -25] },
    { kind: 'health', pos: [12, 0, 25] },
    { kind: 'health', pos: [-27, 0, 0] },
    { kind: 'health', pos: [27, 0, 0] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [-8, 0, -14] },
    { kind: 'ammo', weapon: WeaponId.Rifle, pos: [8, 0, 14] },
    { kind: 'ammo', weapon: WeaponId.Shotgun, pos: [-20, 0, 0] },
    { kind: 'ammo', weapon: WeaponId.Shotgun, pos: [20, 0, 0] },
    { kind: 'ammo', weapon: WeaponId.Sniper, pos: [-5, 8.5, -28] },
    { kind: 'ammo', weapon: WeaponId.Sniper, pos: [5, 8.5, 28] },
    { kind: 'ammo', weapon: WeaponId.Rocket, pos: [0, 0, -12] },
    { kind: 'ammo', weapon: WeaponId.Rocket, pos: [0, 0, 12] },
    { kind: 'ammo', weapon: WeaponId.Grenade, pos: [-20, 5, -24] },
    { kind: 'ammo', weapon: WeaponId.Grenade, pos: [20, 5, 24] },
    { kind: 'ammo', weapon: WeaponId.Plasma, pos: [8, 0, -14] },
    { kind: 'ammo', weapon: WeaponId.Plasma, pos: [-8, 0, 14] },
    { kind: 'ammo', weapon: WeaponId.Charge, pos: [5, 8.5, -28] },
    { kind: 'ammo', weapon: WeaponId.Charge, pos: [-5, 8.5, 28] },
  ],
  flags: [],
  lights: [
    { pos: [0, 10, 0], color: 0xffb070, intensity: 60, distance: 30 },
    { pos: [-20, 3.8, -25], color: 0x40d0ff, intensity: 25, distance: 16 },
    { pos: [20, 3.8, 25], color: 0x40d0ff, intensity: 25, distance: 16 },
    { pos: [0, 11.5, -27], color: 0xff7a30, intensity: 30, distance: 18 },
    { pos: [0, 11.5, 27], color: 0xff7a30, intensity: 30, distance: 18 },
  ],
  theme: {
    sky: 0x07090d,
    fog: 0x0b0f16,
    fogNear: 35,
    fogFar: 120,
    hemiSky: 0x9aa8c8,
    hemiGround: 0x3a3026,
    hemiIntensity: 1.1,
    sunDir: [0.35, 1, 0.25],
    sunColor: 0xffe0c0,
    sunIntensity: 1.2,
  },
};
