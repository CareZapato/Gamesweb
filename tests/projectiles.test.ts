import { describe, expect, it } from 'vitest';
import {
  box,
  CollisionWorld,
  computeExplosion,
  DT,
  projectileConfig,
  type ProjectileState,
  stepProjectile,
  WeaponId,
} from '@arena/shared';

const world = (extra: Parameters<typeof box>[] = []) =>
  new CollisionWorld({ killY: -50, boxes: [box(-100, -1, -100, 100, 0, 100, 'floor'), ...extra.map((a) => box(...a))], ramps: [] });

const proj = (weapon: number, vx: number, vy: number, vz: number, y = 2): ProjectileState => ({
  id: 1,
  owner: 99,
  weapon,
  x: 0,
  y,
  z: 0,
  vx,
  vy,
  vz,
  age: 0,
  bounces: 0,
  resting: false,
});

describe('proyectiles', () => {
  it('el cohete viaja en línea recta sin caída y a velocidad finita', () => {
    const cfg = projectileConfig(WeaponId.Rocket);
    expect(cfg.gravity).toBe(0);
    const w = world();
    const p = proj(WeaponId.Rocket, cfg.speed, 0, 0);
    for (let i = 0; i < 30; i++) {
      const r = stepProjectile(p, w, DT, []);
      expect(r.exploded).toBe(false);
    }
    expect(p.y).toBeCloseTo(2, 9);
    expect(p.vy).toBe(0);
    // one second of flight = speed metres, not instantaneous
    expect(p.x).toBeCloseTo(cfg.speed, 6);
  });

  it('el cohete explota al impactar una pared', () => {
    const cfg = projectileConfig(WeaponId.Rocket);
    const w = world([[10, 0, -5, 11, 5, 5, 'metal']]);
    const p = proj(WeaponId.Rocket, cfg.speed, 0, 0);
    let exploded = null as null | { x: number };
    for (let i = 0; i < 30 && !exploded; i++) {
      const r = stepProjectile(p, w, DT, []);
      if (r.exploded) exploded = r;
    }
    expect(exploded).not.toBeNull();
    expect(exploded!.x).toBeLessThanOrEqual(10);
    expect(exploded!.x).toBeGreaterThan(9.5);
  });

  it('la granada sigue una trayectoria balística con gravedad', () => {
    const cfg = projectileConfig(WeaponId.Grenade);
    expect(cfg.gravity).toBeGreaterThan(0);
    const w = world();
    const p = proj(WeaponId.Grenade, 10, 8, 0, 20);
    const steps = 10;
    for (let i = 0; i < steps; i++) stepProjectile(p, w, DT, []);
    const t = steps * DT;
    // semi-implicit Euler: y = y0 + vy*t - g*dt^2*n(n+1)/2
    const expected = 20 + 8 * t - cfg.gravity * DT * DT * ((steps * (steps + 1)) / 2);
    expect(p.y).toBeCloseTo(expected, 6);
    expect(p.vy).toBeCloseTo(8 - cfg.gravity * t, 6);
    expect(p.x).toBeCloseTo(10 * t, 6);
  });

  it('la granada rebota un número limitado de veces y explota al terminar la mecha', () => {
    const cfg = projectileConfig(WeaponId.Grenade);
    const w = world();
    const p = proj(WeaponId.Grenade, 4, -12, 0, 1);
    let explodedAt = -1;
    for (let i = 0; i < 200; i++) {
      const r = stepProjectile(p, w, DT, []);
      if (r.exploded) {
        explodedAt = p.age;
        break;
      }
    }
    expect(p.bounces).toBeGreaterThan(0);
    expect(p.bounces).toBeLessThanOrEqual(cfg.maxBounces + 1);
    expect(explodedAt).toBeGreaterThanOrEqual(cfg.fuse - 1e-6);
    expect(explodedAt).toBeLessThan(cfg.fuse + DT + 1e-6);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });

  it('las paredes bloquean el daño explosivo', () => {
    const cfg = projectileConfig(WeaponId.Rocket);
    const w = world([[1.5, 0, -10, 2, 6, 10, 'metal']]);
    const center = { x: 0, y: 0.5, z: 0 };
    const hits = computeExplosion(w, center, cfg, [
      { id: 1, x: 3, y: 0, z: 0 }, // behind the wall
      { id: 2, x: -2.5, y: 0, z: 0 }, // open line of sight, same distance range
    ]);
    expect(hits.find((h) => h.id === 1)).toBeUndefined();
    const open = hits.find((h) => h.id === 2);
    expect(open).toBeDefined();
    expect(open!.damage).toBeGreaterThan(0);
  });

  it('el daño radial se reduce con la distancia', () => {
    const cfg = projectileConfig(WeaponId.Rocket);
    const w = world();
    const center = { x: 0, y: 0.5, z: 0 };
    const hits = computeExplosion(w, center, cfg, [
      { id: 1, x: 0.8, y: 0, z: 0 },
      { id: 2, x: 3, y: 0, z: 0 },
      { id: 3, x: 10, y: 0, z: 0 },
    ]);
    const near = hits.find((h) => h.id === 1)!;
    const far = hits.find((h) => h.id === 2)!;
    expect(near.damage).toBeGreaterThan(far.damage);
    expect(hits.find((h) => h.id === 3)).toBeUndefined();
  });
});
