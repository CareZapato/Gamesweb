import { DT } from './constants';

export const WeaponId = {
  Rifle: 0,
  Shotgun: 1,
  Sniper: 2,
  Rocket: 3,
  Grenade: 4,
  /** Continuous plasma beam (hitscan every tick while the button is held). */
  Plasma: 5,
  /** Charge sniper: hold to charge, release to shoot. */
  Charge: 6,
} as const;
export type WeaponId = (typeof WeaponId)[keyof typeof WeaponId];

interface WeaponBase {
  id: WeaponId;
  name: string;
  short: string;
  /** Seconds between shots. */
  fireInterval: number;
  /** Fires continuously while the button is held. */
  automatic: boolean;
  ammoPerShot: number;
  startAmmo: number;
  maxAmmo: number;
  pickupAmmo: number;
  /** Seconds to lower the current weapon and raise this one. */
  switchTime: number;
  /**
   * Aiming (right mouse, `Btn.Aim`). Everything here is applied by the shared simulation except the
   * field of view, which is purely visual.
   */
  /** Field of view in degrees while aiming (never wider than the player's own FOV setting). */
  adsFov: number;
  /** Multiplier of the cone half-angle while aiming (0 = perfectly accurate). */
  adsSpreadMult: number;
  /** Multiplier of the run speed while aiming. */
  adsMoveMult: number;
  /** Shows the scope overlay (and hides the view model) while aiming. */
  scoped: boolean;
}

/** Charge-up weapon: `damage` of the weapon is the damage of a full charge. */
export interface ChargeConfig {
  /** Seconds of holding the button for a full charge. */
  time: number;
  /** Releasing before this many seconds cancels the shot (no ammo spent). */
  minTime: number;
  /** Damage of a shot with the minimum charge (grows linearly up to `damage`). */
  minDamage: number;
  /** Run speed multiplier while a charge is in progress. */
  moveMult: number;
}

export interface HitscanWeapon extends WeaponBase {
  kind: 'hitscan';
  damage: number;
  pellets: number;
  range: number;
  headshotMultiplier: number;
  /** Cone half-angle in radians. */
  spreadBase: number;
  spreadMax: number;
  spreadPerShot: number;
  /** Radians per second recovered toward spreadBase. */
  spreadRecovery: number;
  /** Damage falloff: full until falloffStart, linearly down to falloffMinFraction at falloffEnd. */
  falloffStart: number;
  falloffEnd: number;
  falloffMinFraction: number;
  /** Present on charge weapons: the shot is fired on release, with damage growing with the charge. */
  charge?: ChargeConfig;
}

export interface ProjectileWeapon extends WeaponBase {
  kind: 'projectile';
  projectile: ProjectileConfig;
}

export interface ProjectileConfig {
  speed: number;
  /** Extra upward speed added at launch (only meaningful with gravity). */
  launchLift: number;
  radius: number;
  /** 0 means straight line (no drop). */
  gravity: number;
  maxBounces: number;
  restitution: number;
  /** Seconds until it explodes on its own. For rockets this is just a max lifetime. */
  fuse: number;
  explodeOnImpact: boolean;
  explodeOnPlayerHit: boolean;
  explosionRadius: number;
  explosionDamage: number;
  /** Damage fraction at the edge of the radius. */
  minDamageFraction: number;
  selfDamageScale: number;
  knockback: number;
}

export type WeaponConfig = HitscanWeapon | ProjectileWeapon;

export const WEAPONS: readonly WeaponConfig[] = [
  {
    id: WeaponId.Rifle,
    kind: 'hitscan',
    name: 'Carabina Tormenta',
    short: 'CARABINA',
    fireInterval: 0.09,
    automatic: true,
    ammoPerShot: 1,
    startAmmo: 90,
    maxAmmo: 220,
    pickupAmmo: 60,
    switchTime: 0.3,
    adsFov: 62,
    adsSpreadMult: 0.45,
    adsMoveMult: 0.8,
    scoped: false,
    damage: 9,
    pellets: 1,
    range: 250,
    headshotMultiplier: 1.25,
    spreadBase: 0.004,
    spreadMax: 0.04,
    spreadPerShot: 0.005,
    spreadRecovery: 0.12,
    falloffStart: 40,
    falloffEnd: 90,
    falloffMinFraction: 0.6,
  },
  {
    id: WeaponId.Shotgun,
    kind: 'hitscan',
    name: 'Dispersor Ariete',
    short: 'DISPERSOR',
    fireInterval: 0.95,
    automatic: true,
    ammoPerShot: 1,
    startAmmo: 10,
    maxAmmo: 40,
    pickupAmmo: 10,
    switchTime: 0.35,
    adsFov: 76,
    adsSpreadMult: 0.65,
    adsMoveMult: 0.85,
    scoped: false,
    damage: 8,
    pellets: 10,
    range: 70,
    headshotMultiplier: 1,
    spreadBase: 0.075,
    spreadMax: 0.075,
    spreadPerShot: 0,
    spreadRecovery: 0,
    falloffStart: 10,
    falloffEnd: 35,
    falloffMinFraction: 0.35,
  },
  {
    id: WeaponId.Sniper,
    kind: 'hitscan',
    name: 'Aguja Lumen',
    short: 'AGUJA',
    fireInterval: 1.3,
    automatic: false,
    ammoPerShot: 1,
    startAmmo: 6,
    maxAmmo: 25,
    pickupAmmo: 6,
    switchTime: 0.45,
    adsFov: 25,
    adsSpreadMult: 1,
    adsMoveMult: 0.55,
    scoped: true,
    damage: 70,
    pellets: 1,
    range: 400,
    headshotMultiplier: 2,
    spreadBase: 0,
    spreadMax: 0,
    spreadPerShot: 0,
    spreadRecovery: 0,
    falloffStart: 400,
    falloffEnd: 400,
    falloffMinFraction: 1,
  },
  {
    id: WeaponId.Rocket,
    kind: 'projectile',
    name: 'Lanzador Cometa',
    short: 'COMETA',
    fireInterval: 0.85,
    automatic: true,
    ammoPerShot: 1,
    startAmmo: 6,
    maxAmmo: 30,
    pickupAmmo: 6,
    switchTime: 0.4,
    adsFov: 72,
    adsSpreadMult: 1,
    adsMoveMult: 0.8,
    scoped: false,
    projectile: {
      speed: 28,
      launchLift: 0,
      radius: 0.15,
      gravity: 0,
      maxBounces: 0,
      restitution: 0,
      fuse: 6,
      explodeOnImpact: true,
      explodeOnPlayerHit: true,
      explosionRadius: 4,
      explosionDamage: 100,
      minDamageFraction: 0.2,
      selfDamageScale: 0.5,
      knockback: 10,
    },
  },
  {
    id: WeaponId.Grenade,
    kind: 'projectile',
    name: 'Mortero Grillo',
    short: 'GRILLO',
    fireInterval: 0.7,
    automatic: true,
    ammoPerShot: 1,
    startAmmo: 6,
    maxAmmo: 30,
    pickupAmmo: 6,
    switchTime: 0.4,
    adsFov: 72,
    adsSpreadMult: 1,
    adsMoveMult: 0.8,
    scoped: false,
    projectile: {
      speed: 19,
      launchLift: 2.5,
      radius: 0.12,
      gravity: 22,
      maxBounces: 3,
      restitution: 0.55,
      fuse: 2.0,
      explodeOnImpact: false,
      explodeOnPlayerHit: true,
      explosionRadius: 3.6,
      explosionDamage: 85,
      minDamageFraction: 0.2,
      selfDamageScale: 0.6,
      knockback: 8,
    },
  },
  {
    // One hitscan per server tick while the button is held (fireInterval == one tick), one ammo per
    // tick (30/s), thin beam, no spread. Medium range: the beam stops at `range`.
    id: WeaponId.Plasma,
    kind: 'hitscan',
    name: 'Hilo Aurora',
    short: 'AURORA',
    fireInterval: DT,
    automatic: true,
    ammoPerShot: 1,
    startAmmo: 120,
    maxAmmo: 300,
    pickupAmmo: 90,
    switchTime: 0.35,
    adsFov: 68,
    adsSpreadMult: 1,
    adsMoveMult: 0.75,
    scoped: false,
    damage: 4,
    pellets: 1,
    range: 30,
    headshotMultiplier: 1,
    spreadBase: 0,
    spreadMax: 0,
    spreadPerShot: 0,
    spreadRecovery: 0,
    falloffStart: 30,
    falloffEnd: 30,
    falloffMinFraction: 1,
  },
  {
    // Charge sniper: hold to charge (0..1.5 s), release to shoot. Damage 20..100 (x1.5 to the head),
    // 1.5 s of exposure for a lethal body shot. Without aiming it is inaccurate; aiming makes it exact.
    id: WeaponId.Charge,
    kind: 'hitscan',
    name: 'Lanza Cuásar',
    short: 'CUÁSAR',
    fireInterval: 0.8,
    automatic: false,
    ammoPerShot: 1,
    startAmmo: 5,
    maxAmmo: 20,
    pickupAmmo: 5,
    switchTime: 0.5,
    adsFov: 14,
    adsSpreadMult: 0,
    adsMoveMult: 0.5,
    scoped: true,
    damage: 100,
    pellets: 1,
    range: 400,
    headshotMultiplier: 1.5,
    spreadBase: 0.03,
    spreadMax: 0.03,
    spreadPerShot: 0,
    spreadRecovery: 0,
    falloffStart: 400,
    falloffEnd: 400,
    falloffMinFraction: 1,
    charge: { time: 1.5, minTime: 0.2, minDamage: 20, moveMult: 0.55 },
  },
];

export const WEAPON_COUNT = WEAPONS.length;

export const getWeapon = (id: number): WeaponConfig => WEAPONS[id] ?? WEAPONS[0];
export const isValidWeapon = (id: unknown): id is WeaponId =>
  typeof id === 'number' && Number.isInteger(id) && id >= 0 && id < WEAPON_COUNT;
