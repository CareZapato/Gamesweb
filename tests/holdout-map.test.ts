import { describe, expect, it } from 'vitest';
import {
  CollisionWorld,
  getMap,
  HOLDOUT_HORDE_SPAWNS,
  mapSupportsMode,
  type BoxDef,
  type MapDef,
  PLAYER,
  playerAABB,
} from '@arena/shared';

const map = (): MapDef => {
  const m = getMap('holdout');
  if (!m) throw new Error('holdout missing');
  return m;
};

const xzContains = (b: BoxDef, x: number, z: number): boolean =>
  x >= b.min[0] - 0.05 && x <= b.max[0] + 0.05 && z >= b.min[2] - 0.05 && z <= b.max[2] + 0.05;

/** Cover and walls should sit on y=0 ground or on another solid top. */
const boxSupported = (m: MapDef, b: BoxDef): boolean => {
  if (b.mat === 'light' || b.mat === 'ground') return true;
  const y0 = b.min[1];
  if (y0 <= 0.01) return true;
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  return m.boxes.some(
    (other) =>
      other !== b &&
      other.mat !== 'light' &&
      Math.abs(other.max[1] - y0) < 0.02 &&
      xzContains(other, cx, cz),
  );
};

describe('mapa holdout', () => {
  it('carga, modo survival y spawns de horda perimetrales', () => {
    const m = map();
    expect(m.hordeSpawns).toEqual(HOLDOUT_HORDE_SPAWNS);
    expect(m.hordeSpawns!.length).toBeGreaterThanOrEqual(8);
    expect(m.hordeSpawns!.length).toBeLessThanOrEqual(12);
    expect(mapSupportsMode(m, 'survival')).toBe(true);
    expect(mapSupportsMode(m, 'dm')).toBe(false);
  });

  it('spawns de jugador y horda apoyados en suelo, sin cajas flotantes', () => {
    const m = map();
    const world = new CollisionWorld(m);
    for (const s of m.spawns) {
      const a = playerAABB(s.pos[0], s.pos[1] + 0.01, s.pos[2], PLAYER.radius, PLAYER.height);
      expect(world.overlapsAny(a), `spawn ${s.pos}`).toBe(false);
      expect(world.floorBelow(playerAABB(s.pos[0], s.pos[1], s.pos[2], PLAYER.radius, PLAYER.height), 0.05), s.pos).not.toBeNull();
    }
    for (const p of m.hordeSpawns ?? []) {
      expect(world.floorBelow(playerAABB(p[0], p[1], p[2], PLAYER.radius, PLAYER.height), 0.05), p).not.toBeNull();
    }
    const floating = m.boxes.filter((b) => !boxSupported(m, b));
    expect(floating, floating.map((b) => JSON.stringify(b)).join('\n')).toEqual([]);
  });
});
