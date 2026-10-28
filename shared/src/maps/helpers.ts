import { type BoxDef, box, type LightDef, type Material, type PickupDef, ramp, type RampDef, type SpawnDef, type Tuple3 } from '../map';

/** Yaw that faces the map centre from (x, z). */
export const faceCenter = (x: number, z: number): number => Math.atan2(x, z);

/** Yaws that look along each axis (forward = (-sin yaw, -cos yaw)). */
export const YAW = { px: -Math.PI / 2, nx: Math.PI / 2, pz: Math.PI, nz: 0 } as const;

export const spawn = (x: number, y: number, z: number, yaw = faceCenter(x, z), team?: 0 | 1): SpawnDef =>
  team === undefined ? { pos: [x, y, z], yaw } : { pos: [x, y, z], yaw, team };

export const r2 = (v: number): number => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- mirror across z = 0 (CTF halves)

const swapMat = (m: Material): Material => (m === 'red' ? 'blue' : m === 'blue' ? 'red' : m);

export const mirrorBoxZ = (b: BoxDef): BoxDef => box(b.min[0], b.min[1], -b.min[2], b.max[0], b.max[1], -b.max[2], swapMat(b.mat));

export const mirrorRampZ = (r: RampDef): RampDef =>
  ramp(r.min[0], r.min[1], -r.min[2], r.max[0], r.max[1], -r.max[2], r.dir === '+z' ? '-z' : r.dir === '-z' ? '+z' : r.dir, swapMat(r.mat));

export const mirrorSpawnZ = (s: SpawnDef): SpawnDef => ({
  pos: [s.pos[0], s.pos[1], -s.pos[2]],
  yaw: Math.PI - s.yaw,
  ...(s.team === undefined ? {} : { team: s.team === 0 ? 1 : 0 }),
});

export const mirrorPickupZ = (p: PickupDef): PickupDef => ({ ...p, pos: [p.pos[0], p.pos[1], -p.pos[2]] });

export const mirrorLightZ = (l: LightDef, swapColor?: [number, number]): LightDef => ({
  ...l,
  pos: [l.pos[0], l.pos[1], -l.pos[2]],
  color: swapColor && l.color === swapColor[0] ? swapColor[1] : l.color,
});

// ---------------------------------------------------------------- quarter turns about the Y axis

/** Rotates a point k quarter turns: (x, z) → (−z, x) per turn. */
export const rotXZ = (x: number, z: number, k: number): [number, number] => {
  let a = x,
    b = z;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) [a, b] = [-b, a];
  return [a, b];
};

export const rotBox = (b: BoxDef, k: number): BoxDef => {
  const [x0, z0] = rotXZ(b.min[0], b.min[2], k);
  const [x1, z1] = rotXZ(b.max[0], b.max[2], k);
  return box(x0, b.min[1], z0, x1, b.max[1], z1, b.mat);
};

export const rotPoint = (p: Tuple3, k: number): Tuple3 => {
  const [x, z] = rotXZ(p[0], p[2], k);
  return [x, p[1], z];
};
