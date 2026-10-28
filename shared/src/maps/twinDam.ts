import { type BoxDef, box, type LightDef, type MapDef, type Material, type PickupDef, ramp, type RampDef, type SpawnDef } from '../map';
import { WeaponId } from '../weapons';

/**
 * "Represa Gemela": mirrored CTF map. The red half (z < 0) is authored once and mirrored to build
 * the blue half, which guarantees symmetry. Routes between bases:
 *   1. left elevated catwalk (y = 4), 2. central lane over the midfield platform, 3. right covered tunnel.
 */

const swapMat = (m: Material): Material => (m === 'red' ? 'blue' : m === 'blue' ? 'red' : m);

const mirrorBox = (b: BoxDef): BoxDef => box(b.min[0], b.min[1], -b.min[2], b.max[0], b.max[1], -b.max[2], swapMat(b.mat));

const mirrorRamp = (r: RampDef): RampDef =>
  ramp(
    r.min[0],
    r.min[1],
    -r.min[2],
    r.max[0],
    r.max[1],
    -r.max[2],
    r.dir === '+z' ? '-z' : r.dir === '-z' ? '+z' : r.dir,
    swapMat(r.mat),
  );

const mirrorSpawn = (s: SpawnDef): SpawnDef => ({
  pos: [s.pos[0], s.pos[1], -s.pos[2]],
  yaw: Math.PI - s.yaw,
  team: s.team === 0 ? 1 : 0,
});

const mirrorPickup = (p: PickupDef): PickupDef => ({ ...p, pos: [p.pos[0], p.pos[1], -p.pos[2]] });

const mirrorLight = (l: LightDef): LightDef => ({
  ...l,
  pos: [l.pos[0], l.pos[1], -l.pos[2]],
  color: l.color === 0xff3030 ? 0x3080ff : l.color,
});

// ---------- red half (z < 0) ----------
const halfBoxes: BoxDef[] = [
  // end wall and base roof
  box(-23, 0, -63, 23, 12, -62, 'red'),
  box(-22, 10, -62, 22, 11, -40, 'dark'),
  // base front wall with three openings
  box(-22, 0, -40, -15, 4, -39, 'red'),
  box(-22, 8, -40, -15, 10, -39, 'red'),
  box(-15, 0, -40, -4, 10, -39, 'red'),
  box(-4, 5, -40, 4, 10, -39, 'red'),
  box(4, 0, -40, 15, 10, -39, 'red'),
  box(15, 4, -40, 22, 10, -39, 'red'),
  // flag platform
  box(-3, 0, -56, 3, 0.4, -50, 'red'),
  // inner balcony leading to the catwalk
  box(-22, 3.5, -52, -15, 4, -40, 'grate'),
  box(-15.3, 4, -52, -15, 4.8, -41, 'trim'),
  // base cover
  box(8, 0, -50, 10, 1.5, -46, 'metal'),
  box(-12, 0, -48, -10, 1.5, -46, 'metal'),
  box(-1, 0, -61.9, 1, 6, -61.6, 'light'),

  // route 1: left catwalk (y = 4)
  box(-22, 3.5, -39, -15, 4, -12, 'grate'),
  box(-15.3, 4, -39, -15, 4.8, -14, 'trim'),
  box(-19, 0, -30, -18, 3.5, -29, 'metal'),
  box(-19, 0, -20, -18, 3.5, -19, 'metal'),

  // route 3: right tunnel
  box(15, 4, -39, 22, 4.5, -12, 'concrete'),
  box(14.5, 0, -39, 15, 4, -12, 'concrete'),
  box(18, 3.9, -38, 19, 4, -13, 'light'),

  // route 2: central lane cover
  box(-10, 0, -20, -6, 2.2, -19, 'metal'),
  box(6, 0, -20, 10, 2.2, -19, 'metal'),
  box(-3, 0, -30, 3, 1.2, -29, 'trim'),
  box(-12, 0, -34, -10, 3, -32, 'concrete'),
  box(10, 0, -34, 12, 3, -32, 'concrete'),
];

const halfRamps: RampDef[] = [
  ramp(-22, 0, -62, -15, 4, -52, '+z', 'metal'),
  ramp(-22, 0, -12, -15, 4, -2, '-z', 'metal'),
  ramp(-3, 0, -10, 3, 3, -4, '+z', 'grate'),
];

const halfSpawns: SpawnDef[] = [
  [-8, 0, -58],
  [8, 0, -58],
  [-10, 0, -44],
  // faces the tunnel exit: straight ahead is the solid base wall
  [10, 0, -43, Math.atan2(-8, -4)],
  [0, 0, -46],
  [-18, 4, -46],
  [18, 0, -58],
  [18, 0, -46],
].map(([x, y, z, yaw = Math.PI]) => ({ pos: [x, y, z] as [number, number, number], yaw, team: 0 as const }));

const halfPickups: PickupDef[] = [
  { kind: 'health', pos: [-6, 0, -60] },
  { kind: 'ammo', weapon: WeaponId.Rocket, pos: [6, 0, -60] },
  { kind: 'shield', pos: [-18, 4, -43] },
  { kind: 'ammo', weapon: WeaponId.Grenade, pos: [-6, 0, -44] },
  { kind: 'ammo', weapon: WeaponId.Rifle, pos: [6, 0, -44] },
  { kind: 'ammo', weapon: WeaponId.Sniper, pos: [-18, 4, -25] },
  { kind: 'ammo', weapon: WeaponId.Shotgun, pos: [18, 0, -25] },
  { kind: 'health', pos: [18, 0, -33] },
  { kind: 'health', pos: [0, 0, -14] },
  { kind: 'ammo', weapon: WeaponId.Rocket, pos: [-8, 0, -26] },
  { kind: 'ammo', weapon: WeaponId.Plasma, pos: [6, 0, -52] },
  { kind: 'ammo', weapon: WeaponId.Plasma, pos: [-6, 0, -30] },
  { kind: 'ammo', weapon: WeaponId.Charge, pos: [-18, 4, -30] },
];

const halfLights: LightDef[] = [
  { pos: [0, 8, -50], color: 0xff3030, intensity: 50, distance: 26 },
  { pos: [18, 3.2, -26], color: 0xffb060, intensity: 14, distance: 12 },
];

export const TWIN_DAM: MapDef = {
  id: 'twin',
  name: 'Represa Gemela',
  description: 'Mapa simétrico de CTF: pasarela elevada, carril central y túnel cubierto entre dos bases.',
  modes: ['ctf', 'dm'],
  killY: -10,
  boxes: [
    box(-23, -1, -63, 23, 0, 63, 'floor'),
    box(-23, 0, -63, -22, 12, 63, 'panel'),
    box(22, 0, -63, 23, 12, 63, 'panel'),
    ...halfBoxes,
    ...halfBoxes.map(mirrorBox),
    // midfield, symmetric pieces
    box(-5, 0, -4, 5, 3, 4, 'concrete'),
    box(-12, 0, -1, -10, 8, 1, 'concrete'),
    box(10, 0, -1, 12, 8, 1, 'concrete'),
    box(-20, 0, -1.5, -18, 1.5, 1.5, 'metal'),
    box(18, 0, -1.5, 20, 1.5, 1.5, 'metal'),
    box(-22, 6, -0.5, -21.8, 9, 0.5, 'light'),
    box(21.8, 6, -0.5, 22, 9, 0.5, 'light'),
  ],
  ramps: [...halfRamps, ...halfRamps.map(mirrorRamp)],
  spawns: [...halfSpawns, ...halfSpawns.map(mirrorSpawn)],
  pickups: [
    { kind: 'shieldBig', pos: [0, 3, 0] },
    { kind: 'healthBig', pos: [-21, 0, 0] },
    { kind: 'healthBig', pos: [21, 0, 0] },
    ...halfPickups,
    ...halfPickups.map(mirrorPickup),
  ],
  flags: [
    { team: 0, pos: [0, 0.4, -53] },
    { team: 1, pos: [0, 0.4, 53] },
  ],
  lights: [{ pos: [0, 9, 0], color: 0xfff0d8, intensity: 60, distance: 34 }, ...halfLights, ...halfLights.map(mirrorLight)],
  theme: {
    sky: 0x141a2a,
    fog: 0x161c2a,
    fogNear: 40,
    fogFar: 150,
    hemiSky: 0xa8b4d8,
    hemiGround: 0x2e2a26,
    hemiIntensity: 1.0,
    sunDir: [-0.4, 1, 0.3],
    sunColor: 0xd8e0ff,
    sunIntensity: 1.5,
  },
};
