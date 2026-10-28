/**
 * Writes the texture-atlas template of every weapon to `client/public/assets/weapons/template_<key>.png`:
 * each box of the model gets its six faces in a distinct colour with the face letter inside, so an
 * artist (or an image model) can paint over it. Same layout as `packNets` in `weaponLayout.ts`.
 *
 *   npm run weapons:template
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ATLAS_SIZE, WEAPON_DEFS, weaponAtlas } from '../client/src/render/weaponLayout';
import { type FaceName, faceRects, FACE_NAMES } from '../client/src/render/skinLayout';
import { Canvas, type RGB } from './skins';

const hsl = (h: number, s: number, l: number): RGB => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
};

const FACE_LABEL: Record<FaceName, string> = { front: 'F', back: 'T', left: 'I', right: 'D', top: '↑', bottom: '↓' };
const FACE_LIGHT: Record<FaceName, number> = { top: 0.72, front: 0.62, right: 0.52, left: 0.52, back: 0.42, bottom: 0.32 };

export const buildWeaponTemplate = (id: number): Canvas => {
  const cv = new Canvas(ATLAS_SIZE);
  weaponAtlas(id).forEach((box, i) => {
    const hue = (i * 47 + 8) % 360;
    const fr = faceRects(box);
    for (const face of FACE_NAMES) {
      const r = fr[face];
      cv.fill(r, hsl(hue, 0.7, FACE_LIGHT[face]));
      const dark = hsl(hue, 0.8, 0.2);
      cv.fill({ x: r.x, y: r.y, w: r.w, h: 1 }, dark);
      cv.fill({ x: r.x, y: r.y + r.h - 1, w: r.w, h: 1 }, dark);
      cv.fill({ x: r.x, y: r.y, w: 1, h: r.h }, dark);
      cv.fill({ x: r.x + r.w - 1, y: r.y, w: 1, h: r.h }, dark);
      if (r.w >= 3 && r.h >= 5) cv.text(Math.floor(r.x + (r.w - 3) / 2), Math.floor(r.y + (r.h - 5) / 2), FACE_LABEL[face], [255, 255, 255]);
    }
  });
  return cv;
};

export const writeWeaponTemplates = (outDir: string) => {
  mkdirSync(outDir, { recursive: true });
  WEAPON_DEFS.forEach((def, id) => {
    const name = `template_${def.key}.png`;
    const buf = buildWeaponTemplate(id).png();
    writeFileSync(resolve(outDir, name), buf);
    console.log(`${name}  ${(buf.length / 1024).toFixed(1)} KB`);
  });
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeWeaponTemplates(resolve(dirname(fileURLToPath(import.meta.url)), '../client/public/assets/weapons'));
}
