import type { GameMode, PickupKind } from './rules';
import type { WeaponId } from './weapons';

export type Material =
  | 'floor'
  | 'metal'
  | 'panel'
  | 'grate'
  | 'concrete'
  | 'red'
  | 'blue'
  | 'light'
  | 'trim'
  | 'dark'
  /** Outdoor terrain (packed earth and gravel). */
  | 'ground';

export type Tuple3 = [number, number, number];

/** Solid axis-aligned box. Used for both rendering and collision. */
export interface BoxDef {
  min: Tuple3;
  max: Tuple3;
  mat: Material;
}

/**
 * Solid wedge. Its bounding box is [min, max]; the walkable surface rises from min.y on the
 * low side to max.y on the side named by `dir` ('+x' means it gets higher toward +X).
 */
export interface RampDef {
  min: Tuple3;
  max: Tuple3;
  dir: '+x' | '-x' | '+z' | '-z';
  mat: Material;
}

export interface SpawnDef {
  pos: Tuple3;
  yaw: number;
  team?: 0 | 1;
}

export interface PickupDef {
  kind: PickupKind;
  weapon?: WeaponId;
  pos: Tuple3;
}

export interface FlagBaseDef {
  team: 0 | 1;
  pos: Tuple3;
}

export type Heading = '+x' | '-x' | '+z' | '-z';

/**
 * One end of a portal link. Only players travel; projectiles and hitscan rays hit the wall or
 * floor behind the portal as if it were not there.
 *
 * Direction rule (applied identically by server and client prediction in `stepMovement`):
 * - entering a **wall** portal, horizontal velocity, dash direction and view are rotated by the
 *   angle between the heading into the entry (`-face`) and the exit `face`; vertical speed is kept;
 * - entering a **floor** portal (a hole), horizontal speed is kept but redirected along the exit
 *   `face`, vertical speed becomes 0 and the view turns to the exit `face`.
 */
export interface PortalDef {
  id: string;
  kind: 'wall' | 'floor';
  /** Centre of the opening: on the wall surface (wall) or on the floor surface (floor). */
  pos: Tuple3;
  /** Wall portals: outward normal of the wall. Floor portals: heading given to arriving players. */
  face: Heading;
  radius: number;
  /** `id` of the portal this one sends players to. */
  to: string;
  /** Feet positions where players arriving at this portal appear, in order of preference. */
  exits: Tuple3[];
  /** Colour shared by both ends of a link, so the destination is recognisable. */
  color: number;
}

/**
 * Launch circle on the floor. It sets the player's velocity to `launch` (a physical jump: the
 * player follows a ballistic arc with normal collisions), at most once every `cooldown` seconds.
 */
export interface JumpPadDef {
  pos: Tuple3;
  radius: number;
  launch: Tuple3;
  cooldown: number;
  /** Where the arc is designed to land (feet). Checked by tests, not used by the simulation. */
  target: Tuple3;
}

/** Lava volume: touching it kills instantly (shield ignored). */
export interface HazardDef {
  kind: 'lava';
  min: Tuple3;
  max: Tuple3;
}

export interface LightDef {
  pos: Tuple3;
  color: number;
  intensity: number;
  distance: number;
}

export interface MapTheme {
  sky: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunDir: Tuple3;
  sunColor: number;
  sunIntensity: number;
  /** Open-air maps: colour at the zenith of a gradient sky dome (horizon = `sky`). */
  skyTop?: number;
}

export interface MapDef {
  id: string;
  name: string;
  description: string;
  modes: GameMode[];
  /** Players below this height die. */
  killY: number;
  boxes: BoxDef[];
  ramps: RampDef[];
  spawns: SpawnDef[];
  pickups: PickupDef[];
  flags: FlagBaseDef[];
  lights: LightDef[];
  theme: MapTheme;
  portals?: PortalDef[];
  jumpPads?: JumpPadDef[];
  hazards?: HazardDef[];
}

/** CTF needs both flag bases and at least 4 spawns per team; DM only needs enough spawns. */
export const mapSupportsMode = (map: MapDef, mode: GameMode): boolean => {
  if (!map.modes.includes(mode)) return false;
  if (mode === 'dm') return map.spawns.length >= 4;
  const hasFlag = (t: 0 | 1) => map.flags.some((f) => f.team === t);
  const spawns = (t: 0 | 1) => map.spawns.filter((s) => s.team === t).length;
  return hasFlag(0) && hasFlag(1) && spawns(0) >= 4 && spawns(1) >= 4;
};

/** Unit vector of a heading. */
export const headingVec = (h: Heading): { x: number; z: number } =>
  h === '+x' ? { x: 1, z: 0 } : h === '-x' ? { x: -1, z: 0 } : h === '+z' ? { x: 0, z: 1 } : { x: 0, z: -1 };

/** View yaw that looks along a heading (forward = (-sin yaw, -cos yaw)). */
export const headingYaw = (h: Heading): number => (h === '+x' ? -Math.PI / 2 : h === '-x' ? Math.PI / 2 : h === '+z' ? Math.PI : 0);

/** Helper for map authoring: accepts corners in any order. */
export const box = (
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  mat: Material,
): BoxDef => ({
  min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)],
  max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
  mat,
});

export const ramp = (
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  dir: RampDef['dir'],
  mat: Material,
): RampDef => ({
  min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)],
  max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
  dir,
  mat,
});
