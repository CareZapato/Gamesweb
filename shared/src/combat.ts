import { PLAYER } from './constants';
import { hash2, type Vec3 } from './math';
import { getWeapon, type HitscanWeapon, type ProjectileConfig } from './weapons';
import { type AABB, type CollisionWorld, rayAABB } from './world';

/** Minimal view of a player for hit tests (feet position). */
export interface HitTarget {
  id: number;
  x: number;
  y: number;
  z: number;
  crouched?: boolean;
}

export type HitZone = 'head' | 'body' | 'legs';

const crouchDrop = (p: { crouched?: boolean }): number => (p.crouched ? PLAYER.height - PLAYER.crouchHeight : 0);

export const torsoBox = (p: { x: number; y: number; z: number; crouched?: boolean }, inflate = 0): AABB => {
  const drop = crouchDrop(p);
  return {
    minX: p.x - PLAYER.radius - inflate,
    maxX: p.x + PLAYER.radius + inflate,
    minY: p.y + PLAYER.legsTop - drop - inflate,
    maxY: p.y + PLAYER.bodyTop - drop + inflate,
    minZ: p.z - PLAYER.radius - inflate,
    maxZ: p.z + PLAYER.radius + inflate,
  };
};

export const legsBox = (p: { x: number; y: number; z: number; crouched?: boolean }, inflate = 0): AABB => {
  const drop = crouchDrop(p);
  return {
    minX: p.x - PLAYER.radius - inflate,
    maxX: p.x + PLAYER.radius + inflate,
    minY: p.y - inflate,
    maxY: p.y + PLAYER.legsTop - drop + inflate,
    minZ: p.z - PLAYER.radius - inflate,
    maxZ: p.z + PLAYER.radius + inflate,
  };
};

/** @deprecated Use torsoBox + legsBox; kept for tests that still reference a full body AABB. */
export const bodyBox = (p: { x: number; y: number; z: number; crouched?: boolean }, inflate = 0): AABB => {
  const drop = crouchDrop(p);
  return {
    minX: p.x - PLAYER.radius - inflate,
    maxX: p.x + PLAYER.radius + inflate,
    minY: p.y - inflate,
    maxY: p.y + PLAYER.bodyTop - drop + inflate,
    minZ: p.z - PLAYER.radius - inflate,
    maxZ: p.z + PLAYER.radius + inflate,
  };
};

export const headBox = (p: { x: number; y: number; z: number; crouched?: boolean }, inflate = 0): AABB => {
  const h = PLAYER.headHalf + inflate;
  const c = p.y + PLAYER.headCenter - crouchDrop(p);
  return { minX: p.x - h, maxX: p.x + h, minY: c - h, maxY: c + h, minZ: p.z - h, maxZ: p.z + h };
};

/** World position for floating damage numbers. */
export const hitZonePoint = (p: HitTarget, zone: HitZone): Vec3 => {
  const drop = crouchDrop(p);
  switch (zone) {
    case 'head':
      return { x: p.x, y: p.y + PLAYER.headCenter - drop, z: p.z };
    case 'legs':
      return { x: p.x, y: p.y + (PLAYER.legsTop - drop) * 0.5, z: p.z };
    default:
      return { x: p.x, y: p.y + (PLAYER.legsTop + PLAYER.bodyTop) * 0.5 - drop, z: p.z };
  }
};

export interface PlayerRayHit {
  t: number;
  zone: HitZone;
}

export const rayVsPlayer = (o: Vec3, d: Vec3, maxT: number, p: HitTarget, inflate = 0): PlayerRayHit | null => {
  const hits: PlayerRayHit[] = [];
  const hb = rayAABB(o, d, headBox(p, inflate), maxT);
  if (hb) hits.push({ t: hb.t, zone: 'head' });
  const lb = rayAABB(o, d, legsBox(p, inflate), maxT);
  if (lb) hits.push({ t: lb.t, zone: 'legs' });
  const tb = rayAABB(o, d, torsoBox(p, inflate), maxT);
  if (tb) hits.push({ t: tb.t, zone: 'body' });
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.t - b.t);
  return hits[0]!;
};

export interface TraceResult {
  /** Distance travelled. */
  t: number;
  end: Vec3;
  targetId: number;
  zone: HitZone;
  /** Surface normal when the world was hit. */
  normal: Vec3 | null;
}

export const traceHitscan = (
  world: CollisionWorld,
  origin: Vec3,
  dir: Vec3,
  range: number,
  targets: readonly HitTarget[],
  ignoreId: number,
): TraceResult => {
  const wh = world.raycast(origin, dir, range);
  let bestT = wh ? wh.t : range;
  let targetId = -1;
  let zone: HitZone = 'body';
  for (const p of targets) {
    if (p.id === ignoreId) continue;
    const h = rayVsPlayer(origin, dir, bestT, p);
    if (h && h.t < bestT) {
      bestT = h.t;
      targetId = p.id;
      zone = h.zone;
    }
  }
  return {
    t: bestT,
    end: { x: origin.x + dir.x * bestT, y: origin.y + dir.y * bestT, z: origin.z + dir.z * bestT },
    targetId,
    zone,
    normal: targetId < 0 && wh ? { x: wh.nx, y: wh.ny, z: wh.nz } : null,
  };
};

const zoneMult = (zone: HitZone, w: HitscanWeapon): number => {
  if (zone === 'head') return w.headshotMultiplier;
  if (zone === 'legs') return PLAYER.legsDamageMult;
  return 1;
};

/**
 * Damage of one hitscan ray. For charge weapons `charge` (0..1) interpolates between the minimum
 * and the full-charge damage; the rest ignore it.
 */
export const hitscanDamage = (w: HitscanWeapon, dist: number, zone: HitZone, charge = 1): number => {
  let f = 1;
  if (dist > w.falloffStart) {
    const k = Math.min(1, (dist - w.falloffStart) / Math.max(1e-6, w.falloffEnd - w.falloffStart));
    f = 1 - k * (1 - w.falloffMinFraction);
  }
  const base = w.charge ? w.charge.minDamage + (w.damage - w.charge.minDamage) * Math.max(0, Math.min(1, charge)) : w.damage;
  return Math.max(1, Math.round(base * f * zoneMult(zone, w)));
};

/** Prefer head for kill feed / markers when multiple pellets hit different zones. */
export const mergeHitZone = (a: HitZone, b: HitZone): HitZone => {
  const rank = (z: HitZone) => (z === 'head' ? 2 : z === 'body' ? 1 : 0);
  return rank(a) >= rank(b) ? a : b;
};

export interface ProjectileState {
  id: number;
  owner: number;
  weapon: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  bounces: number;
  resting: boolean;
}

export interface ProjectileStepResult {
  exploded: boolean;
  /** Where it exploded (pulled slightly out of the surface). */
  x: number;
  y: number;
  z: number;
  /** Player directly hit, or -1. */
  directHit: number;
  bounced: boolean;
}

export const projectileConfig = (weaponId: number): ProjectileConfig => {
  const w = getWeapon(weaponId);
  if (w.kind !== 'projectile') throw new Error(`weapon ${weaponId} is not projectile`);
  return w.projectile;
};

export const projectileId = (owner: number, shotCounter: number): number => hash2(owner, shotCounter);

export interface ExplosionHit {
  id: number;
  damage: number;
  impulse: Vec3;
}

const reflectVel = (pr: ProjectileState, n: Vec3, e: number): void => {
  const dot = pr.vx * n.x + pr.vy * n.y + pr.vz * n.z;
  pr.vx -= (1 + e) * dot * n.x;
  pr.vy -= (1 + e) * dot * n.y;
  pr.vz -= (1 + e) * dot * n.z;
};

const finishExplosion = (pr: ProjectileState, out: ProjectileStepResult, pull?: Vec3): ProjectileStepResult => {
  out.exploded = true;
  out.x = pr.x;
  out.y = pr.y;
  out.z = pr.z;
  if (pull) {
    out.x += pull.x * 0.05;
    out.y += pull.y * 0.05;
    out.z += pull.z * 0.05;
  }
  return out;
};

/** Advances one projectile; shared by server authority and client prediction. */
export const stepProjectile = (
  pr: ProjectileState,
  world: CollisionWorld,
  dt: number,
  targets: readonly HitTarget[],
): ProjectileStepResult => {
  const cfg = projectileConfig(pr.weapon);
  const out: ProjectileStepResult = { exploded: false, x: pr.x, y: pr.y, z: pr.z, directHit: -1, bounced: false };
  pr.age += dt;
  if (pr.age >= cfg.fuse - 1e-9) return finishExplosion(pr, out);

  if (pr.resting) return out;

  const ox = pr.x,
    oy = pr.y,
    oz = pr.z;
  if (cfg.gravity > 0) pr.vy -= cfg.gravity * dt;
  const dx = pr.vx * dt,
    dy = pr.vy * dt,
    dz = pr.vz * dt;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-9) return out;

  const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
  let hitT = dist;
  let normal: Vec3 | null = null;
  let playerHit = -1;

  const wh = world.raycast({ x: ox, y: oy, z: oz }, dir, dist);
  if (wh) {
    hitT = wh.t;
    normal = { x: wh.nx, y: wh.ny, z: wh.nz };
  }
  for (const t of targets) {
    const h = rayVsPlayer({ x: ox, y: oy, z: oz }, dir, hitT, t, cfg.radius);
    if (h && h.t < hitT) {
      hitT = h.t;
      normal = null;
      playerHit = t.id;
    }
  }

  pr.x = ox + dir.x * hitT;
  pr.y = oy + dir.y * hitT;
  pr.z = oz + dir.z * hitT;

  if (playerHit >= 0 && cfg.explodeOnPlayerHit) {
    out.directHit = playerHit;
    return finishExplosion(pr, out);
  }

  if (normal) {
    if (cfg.explodeOnImpact) return finishExplosion(pr, out, normal);
    pr.bounces++;
    reflectVel(pr, normal, cfg.restitution);
    out.bounced = true;
    if (pr.bounces > cfg.maxBounces) {
      pr.resting = true;
      pr.vx = pr.vy = pr.vz = 0;
    } else {
      const hs = Math.hypot(pr.vx, pr.vz);
      if (hs < 0.35 && Math.abs(pr.vy) < 0.35) {
        pr.resting = true;
        pr.vx = pr.vy = pr.vz = 0;
      }
    }
    return out;
  }

  if (pr.y < world.killY) return finishExplosion(pr, out);
  return out;
};

export const computeExplosion = (
  world: CollisionWorld,
  center: Vec3,
  cfg: ProjectileConfig,
  targets: readonly HitTarget[],
): ExplosionHit[] => {
  const R = cfg.explosionRadius;
  const out: ExplosionHit[] = [];
  for (const p of targets) {
    const aim = { x: p.x, y: p.y + PLAYER.height * 0.55, z: p.z };
    const dx = aim.x - center.x,
      dy = aim.y - center.y,
      dz = aim.z - center.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > R + 1e-6) continue;
    if (world.segmentBlocked(center, aim)) continue;
    const k = dist / R;
    const frac = 1 - k * (1 - cfg.minDamageFraction);
    const damage = Math.max(1, Math.round(cfg.explosionDamage * frac));
    const nx = dist > 1e-6 ? dx / dist : 0;
    const ny = dist > 1e-6 ? dy / dist : 0;
    const nz = dist > 1e-6 ? dz / dist : 0;
    const push = cfg.knockback * frac;
    out.push({ id: p.id, damage, impulse: { x: nx * push, y: ny * push + push * 0.35, z: nz * push } });
  }
  return out;
};
