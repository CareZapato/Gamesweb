import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WEAPON_COUNT } from '@arena/shared';
import { buildBoxData } from '../client/src/render/skinBox';
import { faceRects, partFootprint, rectsOverlap } from '../client/src/render/skinLayout';
import {
  ATLAS_SIZE,
  MAX_WEAPON_PARTS,
  packNets,
  viewPose,
  WEAPON_COLORS,
  WEAPON_DEFS,
  WEAPON_KEYS,
  weaponAtlas,
  type WeaponPart,
} from '../client/src/render/weaponLayout';

const top = (p: WeaponPart) => p.pos[1] + p.size[1] / 2;
const front = (p: WeaponPart) => p.pos[2] - p.size[2] / 2;

describe('modelos de armas (cúbicos, un atlas por arma)', () => {
  it('hay una definición por arma, con claves y colores únicos', () => {
    expect(WEAPON_DEFS.length).toBe(WEAPON_COUNT);
    expect(new Set(WEAPON_KEYS).size).toBe(WEAPON_COUNT);
    expect(new Set(WEAPON_COLORS).size).toBe(WEAPON_COUNT);
  });

  it.each(WEAPON_DEFS.map((d, i) => [d.key, i] as const))('%s: como mucho 12 cajas, con nombres únicos y tamaños válidos', (_key, id) => {
    const def = WEAPON_DEFS[id];
    expect(def.parts.length).toBeGreaterThanOrEqual(6);
    expect(def.parts.length).toBeLessThanOrEqual(MAX_WEAPON_PARTS);
    expect(new Set(def.parts.map((p) => p.name)).size).toBe(def.parts.length);
    for (const p of def.parts) for (const s of p.size) expect(s).toBeGreaterThan(0.01);
  });

  it.each(WEAPON_DEFS.map((d, i) => [d.key, i] as const))('%s: las redes de las cajas caben en el atlas de 128 px sin solaparse', (_key, id) => {
    const boxes = weaponAtlas(id);
    expect(boxes.length).toBe(WEAPON_DEFS[id].parts.length);
    const rects = boxes.map(partFootprint);
    rects.forEach((r, i) => {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(ATLAS_SIZE);
      expect(r.y + r.h).toBeLessThanOrEqual(ATLAS_SIZE);
      for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(r, rects[j])).toBe(false);
    });
  });

  it.each(WEAPON_DEFS.map((d, i) => [d.key, i] as const))('%s: las UVs de cada caja (24 vértices, 6 caras) caen dentro de su red', (_key, id) => {
    const def = WEAPON_DEFS[id];
    weaponAtlas(id).forEach((box, i) => {
      const part = def.parts[i];
      const data = buildBoxData(part.size[0], part.size[1], part.size[2], box);
      expect(data.positions.length).toBe(24 * 3);
      expect(data.uvs.length).toBe(24 * 2);
      const foot = partFootprint(box);
      for (let v = 0; v < 24; v++) {
        const u = data.uvs[v * 2] * ATLAS_SIZE;
        const w = data.uvs[v * 2 + 1] * ATLAS_SIZE;
        expect(u).toBeGreaterThanOrEqual(foot.x);
        expect(u).toBeLessThanOrEqual(foot.x + foot.w);
        expect(w).toBeGreaterThanOrEqual(foot.y);
        expect(w).toBeLessThanOrEqual(foot.y + foot.h);
      }
      // every face of the net has area
      for (const r of Object.values(faceRects(box))) {
        expect(r.w).toBeGreaterThan(0);
        expect(r.h).toBeGreaterThan(0);
      }
    });
  });

  it.each(WEAPON_DEFS.map((d, i) => [d.key, i] as const))('%s: boca de fuego al frente y mira a la altura declarada', (_key, id) => {
    const def = WEAPON_DEFS[id];
    // muzzle at (or just beyond) the frontmost box, on the weapon's axis
    const frontmost = Math.min(...def.parts.map(front));
    expect(def.muzzle[2]).toBeLessThanOrEqual(frontmost + 0.12);
    expect(def.muzzle[2]).toBeGreaterThanOrEqual(frontmost - 0.12);
    expect(def.muzzle[0]).toBe(0);
    // the highest un-rotated box is the sight used to centre the view model when aiming
    const highest = Math.max(...def.parts.map(top));
    expect(def.sightTop).toBeCloseTo(highest, 2);
    const pose = viewPose(id);
    expect(pose.ads[0]).toBe(0);
    expect(pose.ads[1] + def.sightTop).toBeCloseTo(-0.004, 6);
    expect(pose.ads[2]).toBeGreaterThan(pose.hip[2]);
    expect(pose.ads[1]).toBeGreaterThan(pose.hip[1] - 0.2);
  });

  it('las siluetas son distintas: largo y alto totales no se repiten', () => {
    const dims = WEAPON_DEFS.map((d) => {
      const z = Math.max(...d.parts.map((p) => p.pos[2] + p.size[2] / 2)) - Math.min(...d.parts.map(front));
      const y = Math.max(...d.parts.map(top)) - Math.min(...d.parts.map((p) => p.pos[1] - p.size[1] / 2));
      return `${z.toFixed(2)}x${y.toFixed(2)}`;
    });
    expect(new Set(dims).size).toBe(WEAPON_COUNT);
  });

  it('packNets es determinista y falla (null) si no caben', () => {
    const def = WEAPON_DEFS[0];
    expect(packNets(def.parts)).toEqual(packNets(def.parts));
    expect(packNets(def.parts, 8)).toBeNull();
  });
});

describe('manifest de texturas de armas', () => {
  const manifest = JSON.parse(readFileSync(new URL('../client/public/assets/weapons/manifest.json', import.meta.url), 'utf8')) as {
    weapons: Record<string, string | null>;
  };

  it('lista todas las armas y usa null mientras no haya textura final', () => {
    expect(Object.keys(manifest.weapons).sort()).toEqual([...WEAPON_KEYS].sort());
    for (const v of Object.values(manifest.weapons)) expect(v === null || typeof v === 'string').toBe(true);
  });
});
