import { describe, expect, it } from 'vitest';
import { PLAYER, headBox, bodyBox } from '@arena/shared';
import { buildBoxData } from '../client/src/render/skinBox';
import { MPP, partSize, restPoseBoxes } from '../client/src/render/characterModel';
import {
  FACE_NAMES,
  faceRects,
  getPart,
  partFootprint,
  type Rect,
  rectsOverlap,
  SKIN_BASE_SIZE,
  SKIN_PARTS,
  skinRegions,
  TEAM_ALPHA,
} from '../client/src/render/skinLayout';
import { applyTint } from '../client/src/render/skinTexture';

const inside = (r: Rect, size: number) => r.x >= 0 && r.y >= 0 && r.x + r.w <= size && r.y + r.h <= size;

describe('layout de skin', () => {
  for (const size of [128, 256]) {
    it(`${size} px: 60 regiones, todas dentro de la imagen, con tamaño entero y sin solapes`, () => {
      const regions = skinRegions(size);
      expect(regions).toHaveLength(SKIN_PARTS.length * 6);
      for (const r of regions) {
        expect(inside(r.rect, size), `${r.part}.${r.face} fuera de la imagen`).toBe(true);
        for (const v of [r.rect.x, r.rect.y, r.rect.w, r.rect.h]) expect(Number.isInteger(v)).toBe(true);
        expect(r.rect.w).toBeGreaterThan(0);
        expect(r.rect.h).toBeGreaterThan(0);
      }
      for (let i = 0; i < regions.length; i++) {
        for (let j = i + 1; j < regions.length; j++) {
          expect(rectsOverlap(regions[i].rect, regions[j].rect), `${regions[i].part}.${regions[i].face} solapa con ${regions[j].part}.${regions[j].face}`).toBe(false);
        }
      }
    });
  }

  it('las huellas completas de cada parte tampoco se solapan y las caras caben en su huella', () => {
    for (let i = 0; i < SKIN_PARTS.length; i++) {
      const fi = partFootprint(SKIN_PARTS[i]);
      expect(inside(fi, SKIN_BASE_SIZE)).toBe(true);
      for (const f of FACE_NAMES) {
        const r = faceRects(SKIN_PARTS[i])[f];
        expect(r.x >= fi.x && r.y >= fi.y && r.x + r.w <= fi.x + fi.w && r.y + r.h <= fi.y + fi.h).toBe(true);
      }
      for (let j = i + 1; j < SKIN_PARTS.length; j++) expect(rectsOverlap(fi, partFootprint(SKIN_PARTS[j])), `${SKIN_PARTS[i].id} / ${SKIN_PARTS[j].id}`).toBe(false);
    }
  });

  it('las caras opuestas de cada caja tienen el mismo tamaño y siguen el esquema de red', () => {
    for (const p of SKIN_PARTS) {
      const r = faceRects(p);
      expect([r.front.w, r.front.h]).toEqual([p.w, p.h]);
      expect([r.back.w, r.back.h]).toEqual([p.w, p.h]);
      expect([r.left.w, r.left.h]).toEqual([p.d, p.h]);
      expect([r.right.w, r.right.h]).toEqual([p.d, p.h]);
      expect([r.top.w, r.top.h]).toEqual([p.w, p.d]);
      expect([r.bottom.w, r.bottom.h]).toEqual([p.w, p.d]);
      // right | front | left | back are adjacent, left to right
      expect(r.right.x + r.right.w).toBe(r.front.x);
      expect(r.front.x + r.front.w).toBe(r.left.x);
      expect(r.left.x + r.left.w).toBe(r.back.x);
    }
  });
});

describe('geometría de las cajas con skin', () => {
  it('cada cara: normal hacia fuera, orientación antihoraria vista desde fuera y UV dentro de su región', () => {
    for (const p of SKIN_PARTS) {
      const [sx, sy, sz] = partSize(p.id);
      const d = buildBoxData(sx, sy, sz, p);
      const rects = faceRects(p);
      const order = ['right', 'left', 'top', 'bottom', 'back', 'front'] as const;
      for (let t = 0; t < 12; t++) {
        const ia = d.indices[t * 3], ib = d.indices[t * 3 + 1], ic = d.indices[t * 3 + 2];
        const P = (i: number) => [d.positions[i * 3], d.positions[i * 3 + 1], d.positions[i * 3 + 2]];
        const [a, b, c] = [P(ia), P(ib), P(ic)];
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const dec = [d.normals[ia * 3], d.normals[ia * 3 + 1], d.normals[ia * 3 + 2]];
        expect(n[0] * dec[0] + n[1] * dec[1] + n[2] * dec[2], `${p.id} triángulo ${t}`).toBeGreaterThan(0);
        // the vertex must lie on the face plane in the direction of its normal
        const half = [sx / 2, sy / 2, sz / 2];
        for (let k = 0; k < 3; k++) if (dec[k] !== 0) expect(a[k] * dec[k]).toBeCloseTo(half[k], 6);
        // UVs stay inside the face rectangle
        const face = order[Math.floor(ia / 4)];
        const r = rects[face];
        for (const i of [ia, ib, ic]) {
          const u = d.uvs[i * 2] * SKIN_BASE_SIZE, v = d.uvs[i * 2 + 1] * SKIN_BASE_SIZE;
          expect(u).toBeGreaterThanOrEqual(r.x);
          expect(u).toBeLessThanOrEqual(r.x + r.w);
          expect(v).toBeGreaterThanOrEqual(r.y);
          expect(v).toBeLessThanOrEqual(r.y + r.h);
        }
      }
    }
  });

  it('el frente de la caja (-Z) muestra la región "front" sin espejar: izquierda de la imagen = +X', () => {
    const p = getPart('torso');
    const [sx, sy, sz] = partSize('torso');
    const d = buildBoxData(sx, sy, sz, p);
    const f = 5 * 4; // front face vertices start at 20 (order: right, left, top, bottom, back, front)
    const tl = [d.positions[f * 3], d.positions[f * 3 + 1], d.positions[f * 3 + 2]];
    const tr = [d.positions[(f + 1) * 3], d.positions[(f + 1) * 3 + 1], d.positions[(f + 1) * 3 + 2]];
    expect(tl[2]).toBeLessThan(0);
    expect(tl[0]).toBeGreaterThan(tr[0]); // viewed from the front, the character's right (+X) is on the viewer's left
    expect(tl[1]).toBeGreaterThan(0);
    const r = faceRects(p).front;
    expect(d.uvs[f * 2] * SKIN_BASE_SIZE).toBeCloseTo(r.x, 1);
    expect(d.uvs[(f + 1) * 2] * SKIN_BASE_SIZE).toBeCloseTo(r.x + r.w, 1);
  });
});

describe('el modelo visual cuadra con las hitboxes del servidor', () => {
  const boxes = restPoseBoxes();
  const foot = { x: 0, y: 0, z: 0 };
  const head = headBox(foot);
  const body = bodyBox(foot);
  const within = (b: { min: number[]; max: number[] }, a: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }) =>
    b.min[0] >= a.minX - 1e-9 && b.max[0] <= a.maxX + 1e-9 && b.min[1] >= a.minY - 1e-9 && b.max[1] <= a.maxY + 1e-9 && b.min[2] >= a.minZ - 1e-9 && b.max[2] <= a.maxZ + 1e-9;

  it('la cabeza y el casco están dentro de la caja de cabeza', () => {
    for (const id of ['head', 'helmet']) {
      const b = boxes.find((x) => x.part === id)!;
      expect(within(b, head), `${id}: ${JSON.stringify(b)} vs ${JSON.stringify(head)}`).toBe(true);
    }
  });

  it('la cabeza está centrada en la caja de cabeza del servidor', () => {
    const b = boxes.find((x) => x.part === 'head')!;
    expect((b.min[1] + b.max[1]) / 2).toBeCloseTo(PLAYER.headCenter, 6);
    expect((b.min[0] + b.max[0]) / 2).toBeCloseTo(0, 6);
  });

  it('el resto del cuerpo cabe en el ancho de la caja del cuerpo y no supera la altura del jugador', () => {
    for (const b of boxes) {
      expect(b.min[0], b.part).toBeGreaterThanOrEqual(body.minX - 1e-9);
      expect(b.max[0], b.part).toBeLessThanOrEqual(body.maxX + 1e-9);
      expect(b.min[2], b.part).toBeGreaterThanOrEqual(body.minZ - 1e-9);
      expect(b.max[2], b.part).toBeLessThanOrEqual(body.maxZ + 1e-9);
      expect(b.min[1], b.part).toBeGreaterThanOrEqual(-1e-9);
      expect(b.max[1], b.part).toBeLessThanOrEqual(PLAYER.height + 0.03);
    }
  });

  it('las piernas llegan casi al suelo y la figura mide ~1,8 m', () => {
    const legs = boxes.find((x) => x.part === 'legL')!;
    expect(legs.min[1]).toBeLessThan(0.03);
    const top = Math.max(...boxes.map((b) => b.max[1]));
    expect(top).toBeGreaterThan(1.7);
    expect(top).toBeLessThanOrEqual(PLAYER.height + 0.03);
    expect(MPP).toBeGreaterThan(0);
  });
});

describe('zona de color de equipo (alfa 254)', () => {
  it('tiñe solo los píxeles con alfa 254, los vuelve opacos y respeta el brillo', () => {
    const px = new Uint8ClampedArray([
      255, 255, 255, TEAM_ALPHA, // white team pixel -> full tint
      128, 128, 128, TEAM_ALPHA, // mid grey -> half tint
      10, 200, 30, 255, // opaque: unchanged
      50, 60, 70, 0, // transparent: unchanged
      50, 60, 70, 253, // almost the marker: unchanged
    ]);
    const out = applyTint(px, 0xe03030);
    expect([out[0], out[1], out[2], out[3]]).toEqual([0xe0, 0x30, 0x30, 255]);
    expect(out[4]).toBeGreaterThan(100);
    expect(out[4]).toBeLessThan(120);
    expect(out[7]).toBe(255);
    expect([...out.slice(8, 12)]).toEqual([10, 200, 30, 255]);
    expect([...out.slice(12, 16)]).toEqual([50, 60, 70, 0]);
    expect([...out.slice(16, 20)]).toEqual([50, 60, 70, 253]);
    expect(px[3]).toBe(TEAM_ALPHA); // input untouched
  });
});
