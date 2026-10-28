import { PORTAL } from './constants';
import { headingVec, type JumpPadDef, type MapDef, type PortalDef, type RampDef } from './map';
import type { Vec3 } from './math';

export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface Ramp extends AABB {
  dir: RampDef['dir'];
}

export interface RayHit {
  t: number;
  nx: number;
  ny: number;
  nz: number;
}

const EPS = 1e-4;

export const aabbOverlap = (a: AABB, b: AABB): boolean =>
  a.minX < b.maxX - EPS &&
  a.maxX > b.minX + EPS &&
  a.minY < b.maxY - EPS &&
  a.maxY > b.minY + EPS &&
  a.minZ < b.maxZ - EPS &&
  a.maxZ > b.minZ + EPS;

const xzOverlap = (a: AABB, b: AABB): boolean =>
  a.minX < b.maxX - EPS && a.maxX > b.minX + EPS && a.minZ < b.maxZ - EPS && a.maxZ > b.minZ + EPS;

/** Ramp surface height at a point, clamped to the ramp bounds. */
export const rampHeightAt = (r: Ramp, x: number, z: number): number => {
  let t: number;
  switch (r.dir) {
    case '+x':
      t = (x - r.minX) / (r.maxX - r.minX);
      break;
    case '-x':
      t = (r.maxX - x) / (r.maxX - r.minX);
      break;
    case '+z':
      t = (z - r.minZ) / (r.maxZ - r.minZ);
      break;
    default:
      t = (r.maxZ - z) / (r.maxZ - r.minZ);
  }
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return r.minY + t * (r.maxY - r.minY);
};

/** Highest ramp surface point under the footprint of `a`. */
export const rampMaxUnder = (r: Ramp, a: AABB): number => {
  switch (r.dir) {
    case '+x':
      return rampHeightAt(r, Math.min(a.maxX, r.maxX), 0);
    case '-x':
      return rampHeightAt(r, Math.max(a.minX, r.minX), 0);
    case '+z':
      return rampHeightAt(r, 0, Math.min(a.maxZ, r.maxZ));
    default:
      return rampHeightAt(r, 0, Math.max(a.minZ, r.minZ));
  }
};

const rampOverlap = (r: Ramp, a: AABB): boolean =>
  xzOverlap(a, r) && a.maxY > r.minY + EPS && a.minY < rampMaxUnder(r, a) - EPS;

/** Ray vs AABB (slab test). Returns entry hit with face normal, or t=0 when starting inside. */
export const rayAABB = (o: Vec3, d: Vec3, b: AABB, maxT: number): RayHit | null => {
  let tmin = 0;
  let tmax = maxT;
  let nx = 0,
    ny = 0,
    nz = 0;
  // X
  if (Math.abs(d.x) < 1e-12) {
    if (o.x < b.minX || o.x > b.maxX) return null;
  } else {
    const inv = 1 / d.x;
    let t1 = (b.minX - o.x) * inv;
    let t2 = (b.maxX - o.x) * inv;
    let n = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      n = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = n;
      ny = 0;
      nz = 0;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  // Y
  if (Math.abs(d.y) < 1e-12) {
    if (o.y < b.minY || o.y > b.maxY) return null;
  } else {
    const inv = 1 / d.y;
    let t1 = (b.minY - o.y) * inv;
    let t2 = (b.maxY - o.y) * inv;
    let n = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      n = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = 0;
      ny = n;
      nz = 0;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  // Z
  if (Math.abs(d.z) < 1e-12) {
    if (o.z < b.minZ || o.z > b.maxZ) return null;
  } else {
    const inv = 1 / d.z;
    let t1 = (b.minZ - o.z) * inv;
    let t2 = (b.maxZ - o.z) * inv;
    let n = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      n = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = 0;
      ny = 0;
      nz = n;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return { t: tmin, nx, ny, nz };
};

const rampNormal = (r: Ramp): [number, number, number] => {
  const rise = r.maxY - r.minY;
  let nx = 0,
    nz = 0;
  switch (r.dir) {
    case '+x':
      nx = -rise / (r.maxX - r.minX);
      break;
    case '-x':
      nx = rise / (r.maxX - r.minX);
      break;
    case '+z':
      nz = -rise / (r.maxZ - r.minZ);
      break;
    default:
      nz = rise / (r.maxZ - r.minZ);
  }
  const l = Math.hypot(nx, 1, nz);
  return [nx / l, 1 / l, nz / l];
};

/** Exact ray vs wedge: clip against the bounds, then against the sloped plane. */
export const rayRamp = (o: Vec3, d: Vec3, r: Ramp, maxT: number): RayHit | null => {
  const enter = rayAABB(o, d, r, maxT);
  if (!enter) return null;
  // compute exit t
  let tExit = maxT;
  for (const [oc, dc, lo, hi] of [
    [o.x, d.x, r.minX, r.maxX],
    [o.y, d.y, r.minY, r.maxY],
    [o.z, d.z, r.minZ, r.maxZ],
  ] as const) {
    if (Math.abs(dc) < 1e-12) continue;
    const t1 = (lo - oc) / dc;
    const t2 = (hi - oc) / dc;
    tExit = Math.min(tExit, Math.max(t1, t2));
  }
  const f = (t: number) => {
    const x = o.x + d.x * t,
      y = o.y + d.y * t,
      z = o.z + d.z * t;
    return y - rampHeightAt(r, x, z);
  };
  const f0 = f(enter.t);
  if (f0 <= 1e-6) return enter;
  const f1 = f(tExit);
  if (f1 >= 0) return null;
  // f is linear inside the bounds: solve for the root
  const t = enter.t + (f0 / (f0 - f1)) * (tExit - enter.t);
  const n = rampNormal(r);
  return { t, nx: n[0], ny: n[1], nz: n[2] };
};

/**
 * Volume that starts a portal trip when the player's box overlaps it: a slab in front of a wall
 * portal, or a thin disc-sized box on top of a floor portal (the feet must be well inside the hole).
 */
export const portalTrigger = (p: PortalDef): AABB => {
  const [x, y, z] = p.pos;
  if (p.kind === 'floor') {
    const h = p.radius * PORTAL.floorTriggerFraction;
    return { minX: x - h, maxX: x + h, minY: y - 0.5, maxY: y + 0.25, minZ: z - h, maxZ: z + h };
  }
  const n = headingVec(p.face);
  const r = p.radius;
  const d = PORTAL.triggerDepth;
  const x0 = n.x === 0 ? x - r : n.x > 0 ? x : x - d;
  const x1 = n.x === 0 ? x + r : n.x > 0 ? x + d : x;
  const z0 = n.z === 0 ? z - r : n.z > 0 ? z : z - d;
  const z1 = n.z === 0 ? z + r : n.z > 0 ? z + d : z;
  return { minX: x0, maxX: x1, minY: y - r, maxY: y + r, minZ: z0, maxZ: z1 };
};

export interface PortalRuntime {
  def: PortalDef;
  trigger: AABB;
  /** Index of the destination portal in `CollisionWorld.portals`. */
  to: number;
}

export class CollisionWorld {
  readonly boxes: AABB[];
  readonly ramps: Ramp[];
  readonly killY: number;
  readonly portals: PortalRuntime[];
  readonly jumpPads: readonly JumpPadDef[];
  readonly lava: AABB[];

  constructor(map: Pick<MapDef, 'boxes' | 'ramps' | 'killY'> & Partial<Pick<MapDef, 'portals' | 'jumpPads' | 'hazards'>>) {
    this.boxes = map.boxes.map((b) => ({
      minX: b.min[0],
      minY: b.min[1],
      minZ: b.min[2],
      maxX: b.max[0],
      maxY: b.max[1],
      maxZ: b.max[2],
    }));
    this.ramps = map.ramps.map((r) => ({
      minX: r.min[0],
      minY: r.min[1],
      minZ: r.min[2],
      maxX: r.max[0],
      maxY: r.max[1],
      maxZ: r.max[2],
      dir: r.dir,
    }));
    this.killY = map.killY;
    const defs = map.portals ?? [];
    this.portals = defs.map((def) => {
      const to = defs.findIndex((d) => d.id === def.to);
      if (to < 0 || defs[to] === def) throw new Error(`portal ${def.id}: destino ${def.to} inválido`);
      if (def.exits.length === 0) throw new Error(`portal ${def.id} sin salidas`);
      return { def, trigger: portalTrigger(def), to };
    });
    this.jumpPads = map.jumpPads ?? [];
    this.lava = (map.hazards ?? [])
      .filter((h) => h.kind === 'lava')
      .map((h) => ({ minX: h.min[0], minY: h.min[1], minZ: h.min[2], maxX: h.max[0], maxY: h.max[1], maxZ: h.max[2] }));
    this.buildGrid();
  }

  // Broadphase: uniform XZ grid listing the solids that touch each cell. Queries only run the
  // exact tests on those candidates, so results are identical to testing every solid.
  private static readonly CELL = 4;
  private gx0 = 0;
  private gz0 = 0;
  private gnx = 1;
  private gnz = 1;
  private gridBoxes: number[][] = [];
  private gridRamps: number[][] = [];
  private boxStamp: Uint32Array = new Uint32Array(0);
  private rampStamp: Uint32Array = new Uint32Array(0);
  private stamp = 0;
  private qBoxes: AABB[] = [];
  private qRamps: Ramp[] = [];

  private buildGrid() {
    const all = [...this.boxes, ...this.ramps];
    if (all.length === 0) return;
    const c = CollisionWorld.CELL;
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
    for (const b of all) {
      minX = Math.min(minX, b.minX);
      minZ = Math.min(minZ, b.minZ);
      maxX = Math.max(maxX, b.maxX);
      maxZ = Math.max(maxZ, b.maxZ);
    }
    this.gx0 = minX;
    this.gz0 = minZ;
    this.gnx = Math.max(1, Math.ceil((maxX - minX) / c));
    this.gnz = Math.max(1, Math.ceil((maxZ - minZ) / c));
    const n = this.gnx * this.gnz;
    this.gridBoxes = Array.from({ length: n }, () => []);
    this.gridRamps = Array.from({ length: n }, () => []);
    const insert = (grid: number[][], b: AABB, idx: number) => {
      const [i0, i1, j0, j1] = this.cellRange(b);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) grid[i * this.gnz + j].push(idx);
    };
    this.boxes.forEach((b, i) => insert(this.gridBoxes, b, i));
    this.ramps.forEach((r, i) => insert(this.gridRamps, r, i));
    this.boxStamp = new Uint32Array(this.boxes.length);
    this.rampStamp = new Uint32Array(this.ramps.length);
  }

  private cellRange(a: AABB): [number, number, number, number] {
    const c = CollisionWorld.CELL;
    const cl = (v: number, n: number) => (v < 0 ? 0 : v >= n ? n - 1 : v);
    return [
      cl(Math.floor((a.minX - EPS - this.gx0) / c), this.gnx),
      cl(Math.floor((a.maxX + EPS - this.gx0) / c), this.gnx),
      cl(Math.floor((a.minZ - EPS - this.gz0) / c), this.gnz),
      cl(Math.floor((a.maxZ + EPS - this.gz0) / c), this.gnz),
    ];
  }

  /** Fills qBoxes / qRamps with the solids whose cells touch the XZ footprint of `a`. */
  private query(a: AABB) {
    const qb = this.qBoxes,
      qr = this.qRamps;
    qb.length = 0;
    qr.length = 0;
    if (this.gridBoxes.length === 0) return;
    this.stamp = (this.stamp + 1) >>> 0;
    if (this.stamp === 0) {
      this.boxStamp.fill(0);
      this.rampStamp.fill(0);
      this.stamp = 1;
    }
    const s = this.stamp;
    const [i0, i1, j0, j1] = this.cellRange(a);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const cell = i * this.gnz + j;
        for (const idx of this.gridBoxes[cell])
          if (this.boxStamp[idx] !== s) {
            this.boxStamp[idx] = s;
            qb.push(this.boxes[idx]);
          }
        for (const idx of this.gridRamps[cell])
          if (this.rampStamp[idx] !== s) {
            this.rampStamp[idx] = s;
            qr.push(this.ramps[idx]);
          }
      }
  }

  /** Whether a box (usually the player's) touches lava. */
  touchesLava(a: AABB): boolean {
    for (const l of this.lava) if (aabbOverlap(a, l)) return true;
    return false;
  }

  overlapsAny(a: AABB): boolean {
    this.query(a);
    for (const b of this.qBoxes) if (aabbOverlap(a, b)) return true;
    for (const r of this.qRamps) if (rampOverlap(r, a)) return true;
    return false;
  }

  /** Solids overlapping `a`: boxes as-is, ramps flagged. */
  overlapping(a: AABB, out: { boxes: AABB[]; ramps: Ramp[] }): boolean {
    out.boxes.length = 0;
    out.ramps.length = 0;
    this.query(a);
    for (const b of this.qBoxes) if (aabbOverlap(a, b)) out.boxes.push(b);
    for (const r of this.qRamps) if (rampOverlap(r, a)) out.ramps.push(r);
    return out.boxes.length > 0 || out.ramps.length > 0;
  }

  /**
   * Highest walkable surface under the footprint of `a`, between a.minY - maxDrop and a.minY + EPS.
   * Returns null when there is no floor in that range.
   */
  floorBelow(a: AABB, maxDrop: number): number | null {
    let best: number | null = null;
    const top = a.minY + 1e-3;
    const bottom = a.minY - maxDrop;
    this.query(a);
    for (const b of this.qBoxes) {
      if (!xzOverlap(a, b)) continue;
      if (b.maxY <= top && b.maxY >= bottom && (best === null || b.maxY > best)) best = b.maxY;
    }
    for (const r of this.qRamps) {
      if (!xzOverlap(a, r)) continue;
      const h = rampMaxUnder(r, a);
      if (h <= top && h >= bottom && (best === null || h > best)) best = h;
    }
    return best;
  }

  /** Closest hit along a ray (d must be normalized). */
  raycast(o: Vec3, d: Vec3, maxDist: number): RayHit | null {
    let best: RayHit | null = null;
    let bestT = maxDist;
    for (const b of this.boxes) {
      const h = rayAABB(o, d, b, bestT);
      if (h && h.t <= bestT) {
        best = h;
        bestT = h.t;
      }
    }
    for (const r of this.ramps) {
      const h = rayRamp(o, d, r, bestT);
      if (h && h.t <= bestT) {
        best = h;
        bestT = h.t;
      }
    }
    return best;
  }

  /** True when the straight segment a→b is blocked by world geometry. */
  segmentBlocked(a: Vec3, b: Vec3): boolean {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return false;
    const d = { x: dx / len, y: dy / len, z: dz / len };
    return this.raycast(a, d, len - 1e-3) !== null;
  }

  pointInSolid(p: Vec3): boolean {
    const a: AABB = { minX: p.x, maxX: p.x, minY: p.y, maxY: p.y, minZ: p.z, maxZ: p.z };
    for (const b of this.boxes)
      if (p.x > b.minX && p.x < b.maxX && p.y > b.minY && p.y < b.maxY && p.z > b.minZ && p.z < b.maxZ) return true;
    for (const r of this.ramps)
      if (p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ && p.y > r.minY && p.y < rampMaxUnder(r, a))
        return true;
    return false;
  }
}

export const playerAABB = (x: number, y: number, z: number, radius: number, height: number, out?: AABB): AABB => {
  const a = out ?? { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
  a.minX = x - radius;
  a.maxX = x + radius;
  a.minY = y;
  a.maxY = y + height;
  a.minZ = z - radius;
  a.maxZ = z + radius;
  return a;
};
