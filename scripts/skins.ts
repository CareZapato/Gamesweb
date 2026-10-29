/**
 * Generates the skin template and the two default skins as PNG files (no image libraries: a tiny
 * RGBA canvas plus an in-file PNG encoder), straight from the layout in
 * `client/src/render/skinLayout.ts`.
 *
 *   npm run skins:template
 *
 * Writes client/public/assets/skins/{template,default_red,default_blue}.png. Also imported by the
 * tests and the e2e script to build ad-hoc skins.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { type FaceName, faceRects, FACE_NAMES, getPart, type PartId, type Rect, SKIN_BASE_SIZE, SKIN_PARTS, TEAM_ALPHA } from '../client/src/render/skinLayout';

export type RGB = [number, number, number];

// ------------------------------------------------------------------ PNG encoder

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (b: Uint8Array): number => {
  let c = 0xffffffff;
  for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Uint8Array): Buffer => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

/**
 * Wraps already filtered scanlines (`raw`, each row starting with its filter byte) in a PNG.
 * Exposed so tests can build deliberately odd files (other colour types, interlacing, wrong lengths).
 */
export const pngFromRaw = (width: number, height: number, raw: Uint8Array, opts: { colorType?: number; bitDepth?: number; interlace?: number } = {}): Buffer => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = opts.bitDepth ?? 8;
  ihdr[9] = opts.colorType ?? 6;
  ihdr[12] = opts.interlace ?? 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))]);
};

/** Encodes 8-bit RGBA pixels (row 0 = top) as a non-interlaced PNG. */
export const encodePng = (width: number, height: number, rgba: Uint8Array): Buffer => {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  return pngFromRaw(width, height, raw);
};

// ------------------------------------------------------------------ tiny canvas

export class Canvas {
  readonly data: Uint8Array;
  constructor(
    readonly size: number,
    private scale = size / SKIN_BASE_SIZE,
  ) {
    this.data = new Uint8Array(size * size * 4);
  }

  /** Sets one pixel in image coordinates. */
  set(x: number, y: number, c: RGB, a = 255) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const i = (y * this.size + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }

  /** Fills a rectangle given in 128 px coordinates (scaled for bigger images). */
  fill(r: Rect, c: RGB, a = 255) {
    const k = this.scale;
    for (let y = Math.round(r.y * k); y < Math.round((r.y + r.h) * k); y++) for (let x = Math.round(r.x * k); x < Math.round((r.x + r.w) * k); x++) this.set(x, y, c, a);
  }

  /** Fills a sub-rectangle of a face; coordinates relative to the face's top-left corner (128 px units). */
  face(part: PartId, face: FaceName, c: RGB, a = 255, sub?: { x: number; y: number; w: number; h: number }) {
    const r = faceRects(getPart(part))[face];
    this.fill(sub ? { x: r.x + sub.x, y: r.y + sub.y, w: sub.w, h: sub.h } : r, c, a);
  }

  text(x: number, y: number, s: string, c: RGB) {
    let cx = x;
    for (const ch of s) {
      const g = FONT[ch] ?? FONT[' '];
      g.forEach((row, ry) => [...row].forEach((v, rx) => v === '#' && this.fill({ x: cx + rx, y: y + ry, w: 1, h: 1 }, c)));
      cx += 4;
    }
  }

  png(): Buffer {
    return encodePng(this.size, this.size, this.data);
  }
}

const FONT: Record<string, string[]> = {
  ' ': ['...', '...', '...', '...', '...'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.##', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '=': ['...', '###', '...', '###', '...'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  '.': ['...', '...', '...', '...', '.#.'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '-': ['...', '...', '###', '...', '...'],
  '↑': ['.#.', '###', '.#.', '.#.', '.#.'],
  '↓': ['.#.', '.#.', '.#.', '###', '.#.'],
};

// ------------------------------------------------------------------ template

const hsl = (h: number, s: number, l: number): RGB => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
};

/** One letter (or arrow) per face, printed inside it. */
const FACE_LABEL: Record<FaceName, string> = { front: 'F', back: 'T', left: 'I', right: 'D', top: '↑', bottom: '↓' };
const FACE_LIGHT: Record<FaceName, number> = { top: 0.72, front: 0.62, right: 0.52, left: 0.52, back: 0.42, bottom: 0.32 };

/** Coloured, labelled template: every region of the layout, one hue per part, face name inside. */
export const buildTemplate = (size = SKIN_BASE_SIZE): Canvas => {
  const cv = new Canvas(size);
  const k = size / SKIN_BASE_SIZE;
  SKIN_PARTS.forEach((p, i) => {
    const hue = (i * 36 + 8) % 360;
    const fr = faceRects(p);
    for (const face of FACE_NAMES) {
      const r = fr[face];
      const base = hsl(hue, p.layer === 'outer' ? 0.55 : 0.75, FACE_LIGHT[face]);
      cv.fill(r, base);
      // 1 px darker frame so neighbouring faces are easy to tell apart
      const dark = hsl(hue, 0.8, 0.2);
      cv.fill({ x: r.x, y: r.y, w: r.w, h: 1 / k }, dark);
      cv.fill({ x: r.x, y: r.y + r.h - 1 / k, w: r.w, h: 1 / k }, dark);
      cv.fill({ x: r.x, y: r.y, w: 1 / k, h: r.h }, dark);
      cv.fill({ x: r.x + r.w - 1 / k, y: r.y, w: 1 / k, h: r.h }, dark);
      if (r.w >= 3 && r.h >= 5) cv.text(Math.floor(r.x + (r.w - 3) / 2), Math.floor(r.y + (r.h - 5) / 2), FACE_LABEL[face], [255, 255, 255]);
    }
  });
  const ink: RGB = [235, 235, 235];
  const lines = [
    'F FRENTE  T TRASERA',
    'I IZQUIERDA  D DERECHA',
    '↑ ARRIBA  ↓ ABAJO',
    'ALFA 254 = COLOR EQUIPO',
    'EXTERIOR ALFA 0 = NADA',
    '128 PX / 256 PX = X2',
  ];
  lines.forEach((l, i) => cv.text(2, 92 + i * 6, l, ink));
  return cv;
};

// ------------------------------------------------------------------ default skins

export interface Palette {
  suit: RGB;
  suitDark: RGB;
  armor: RGB;
  armorDark: RGB;
  visor: RGB;
  skin: RGB;
  hair: RGB;
  boot: RGB;
  glove: RGB;
}

export const PALETTE_RED: Palette = {
  suit: [74, 40, 44],
  suitDark: [52, 28, 32],
  armor: [132, 136, 148],
  armorDark: [84, 88, 98],
  visor: [96, 226, 255],
  skin: [226, 178, 142],
  hair: [48, 34, 28],
  boot: [40, 36, 38],
  glove: [60, 56, 58],
};
export const PALETTE_BLUE: Palette = {
  suit: [38, 52, 84],
  suitDark: [26, 36, 62],
  armor: [132, 140, 152],
  armorDark: [84, 92, 104],
  visor: [255, 196, 96],
  skin: [214, 168, 134],
  hair: [44, 38, 32],
  boot: [34, 38, 44],
  glove: [52, 58, 66],
};
/** Not bundled: a loud third look used by the tests and the e2e screenshots. */
export const PALETTE_GOLD: Palette = {
  suit: [96, 76, 28],
  suitDark: [64, 50, 18],
  armor: [214, 196, 120],
  armorDark: [150, 132, 70],
  visor: [255, 80, 80],
  skin: [190, 140, 110],
  hair: [20, 20, 24],
  boot: [30, 24, 12],
  glove: [48, 38, 16],
};

/** Reducto: Horda — superviviente (referencia naranja / cian). */
export const PALETTE_SURVIVOR_ORANGE: Palette = {
  suit: [42, 46, 54],
  suitDark: [28, 30, 36],
  armor: [72, 78, 88],
  armorDark: [48, 52, 60],
  visor: [47, 208, 255],
  skin: [200, 160, 130],
  hair: [36, 32, 28],
  boot: [34, 32, 36],
  glove: [52, 50, 54],
};
export const PALETTE_SURVIVOR_CYAN: Palette = {
  suit: [48, 58, 72],
  suitDark: [32, 40, 52],
  armor: [88, 96, 108],
  armorDark: [58, 64, 74],
  visor: [47, 208, 255],
  skin: [190, 150, 124],
  hair: [40, 36, 34],
  boot: [36, 40, 48],
  glove: [56, 60, 68],
};
export const PALETTE_SURVIVOR_STEEL: Palette = {
  suit: [56, 62, 70],
  suitDark: [38, 42, 48],
  armor: [110, 118, 128],
  armorDark: [72, 78, 86],
  visor: [26, 136, 153],
  skin: [188, 148, 122],
  hair: [44, 40, 38],
  boot: [40, 40, 44],
  glove: [58, 58, 62],
};

/** Zombies: piel verduzca, ropa gris; ojos en visor del casco. */
export const PALETTE_ZOMBIE_WALKER: Palette = {
  suit: [52, 52, 56],
  suitDark: [38, 38, 42],
  armor: [122, 138, 114],
  armorDark: [90, 102, 88],
  visor: [255, 96, 32],
  skin: [138, 154, 122],
  hair: [68, 72, 64],
  boot: [44, 44, 48],
  glove: [118, 130, 110],
};
export const PALETTE_ZOMBIE_RUNNER: Palette = {
  ...PALETTE_ZOMBIE_WALKER,
  skin: [152, 168, 128],
  armor: [136, 152, 118],
};
export const PALETTE_ZOMBIE_BRUTE: Palette = {
  ...PALETTE_ZOMBIE_WALKER,
  suit: [44, 48, 42],
  armor: [90, 102, 82],
  skin: [110, 124, 98],
};
export const PALETTE_ZOMBIE_ARMORED: Palette = {
  ...PALETTE_ZOMBIE_WALKER,
  armor: [106, 112, 120],
  armorDark: [78, 84, 92],
};
export const PALETTE_ZOMBIE_COLOSSUS: Palette = {
  ...PALETTE_ZOMBIE_WALKER,
  armor: [74, 92, 68],
  skin: [98, 112, 86],
  visor: [255, 128, 40],
};

const TEAM: RGB = [240, 240, 240];
const ACCENT_ORANGE: RGB = [255, 122, 26];
const ACCENT_CYAN: RGB = [47, 208, 255];

/**
 * A simple but complete skin: dark suit, grey armour, visor, and "team colour" zones painted white
 * with alpha 254 (the game tints them with the team colour, see docs/SKINS.md).
 */
export const buildDefaultSkin = (pal: Palette, size = SKIN_BASE_SIZE, teamColor: RGB = TEAM): Canvas => {
  const cv = new Canvas(size);
  const all = (part: PartId, c: RGB, a = 255) => FACE_NAMES.forEach((f) => cv.face(part, f, c, a));
  const sides = (part: PartId, fn: (f: FaceName) => void) => (['front', 'back', 'left', 'right'] as const).forEach(fn);

  // head (under the helmet): face with eyes, hair on top and back
  all('head', pal.skin);
  cv.face('head', 'top', pal.hair);
  cv.face('head', 'back', pal.hair);
  cv.face('head', 'front', pal.hair, 255, { x: 0, y: 0, w: 12, h: 3 });
  cv.face('head', 'front', [30, 30, 40], 255, { x: 2, y: 6, w: 2, h: 2 });
  cv.face('head', 'front', [30, 30, 40], 255, { x: 8, y: 6, w: 2, h: 2 });
  cv.face('head', 'front', [150, 90, 80], 255, { x: 4, y: 9, w: 4, h: 1 });

  // helmet (outer, 13x13x13): armour shell, visor band, open chin, team crest on top
  all('helmet', pal.armor);
  cv.face('helmet', 'top', teamColor, TEAM_ALPHA, { x: 5, y: 0, w: 3, h: 13 });
  cv.face('helmet', 'bottom', pal.armor, 0);
  cv.face('helmet', 'front', pal.armorDark, 255, { x: 0, y: 3, w: 13, h: 1 });
  cv.face('helmet', 'front', pal.visor, 255, { x: 1, y: 4, w: 11, h: 4 });
  cv.face('helmet', 'front', pal.armor, 0, { x: 2, y: 8, w: 9, h: 5 });
  for (const f of ['left', 'right'] as const) {
    cv.face('helmet', f, teamColor, TEAM_ALPHA, { x: 4, y: 1, w: 5, h: 2 });
    cv.face('helmet', f, pal.armor, 0, { x: 0, y: 9, w: 13, h: 4 });
  }
  cv.face('helmet', 'back', pal.armorDark, 255, { x: 0, y: 10, w: 13, h: 3 });

  // torso (base): suit with belt
  all('torso', pal.suit);
  sides('torso', (f) => cv.face('torso', f, pal.suitDark, 255, { x: 0, y: 16, w: f === 'left' || f === 'right' ? 8 : 12, h: 3 }));
  cv.face('torso', 'front', teamColor, TEAM_ALPHA, { x: 5, y: 16, w: 2, h: 3 });
  cv.face('torso', 'top', pal.suitDark);
  cv.face('torso', 'bottom', pal.suitDark);

  // chest plate (outer, 13x12x9): front panel in team colour, plain back and sides
  all('chest', pal.armor);
  cv.face('chest', 'front', pal.armorDark, 255, { x: 0, y: 0, w: 13, h: 1 });
  cv.face('chest', 'front', teamColor, TEAM_ALPHA, { x: 3, y: 2, w: 7, h: 6 });
  cv.face('chest', 'front', pal.armorDark, 255, { x: 3, y: 8, w: 7, h: 1 });
  cv.face('chest', 'back', pal.armorDark, 255, { x: 4, y: 3, w: 5, h: 5 });
  cv.face('chest', 'bottom', pal.armor, 0);

  // arms (base 6x20x6): sleeve, team band, elbow pad, gloves
  for (const arm of ['armL', 'armR'] as const) {
    all(arm, pal.suit);
    for (const f of FACE_NAMES) {
      if (f === 'top' || f === 'bottom') continue;
      cv.face(arm, f, teamColor, TEAM_ALPHA, { x: 0, y: 4, w: f === 'left' || f === 'right' ? 6 : 6, h: 2 });
      cv.face(arm, f, pal.armorDark, 255, { x: 0, y: 9, w: 6, h: 3 });
      cv.face(arm, f, pal.glove, 255, { x: 0, y: 15, w: 6, h: 5 });
    }
    cv.face(arm, 'bottom', pal.glove);
    cv.face(arm, 'top', pal.suitDark);
  }

  // shoulder pads (outer, 8x6x8): team colour with dark rim
  for (const pad of ['pauldronL', 'pauldronR'] as const) {
    all(pad, teamColor, TEAM_ALPHA);
    for (const f of ['front', 'back', 'left', 'right'] as const) cv.face(pad, f, pal.armorDark, 255, { x: 0, y: 5, w: 8, h: 1 });
    cv.face(pad, 'bottom', pal.armor, 0);
  }

  // legs (base 6x27x7): trousers, knee pad, boots
  for (const leg of ['legL', 'legR'] as const) {
    all(leg, pal.suit);
    for (const f of FACE_NAMES) {
      if (f === 'top' || f === 'bottom') continue;
      const w = f === 'left' || f === 'right' ? 7 : 6;
      cv.face(leg, f, pal.armor, 255, { x: 0, y: 10, w, h: 4 });
      cv.face(leg, f, pal.boot, 255, { x: 0, y: 20, w, h: 7 });
      cv.face(leg, f, pal.armorDark, 255, { x: 0, y: 20, w, h: 1 });
    }
    cv.face(leg, 'front', teamColor, TEAM_ALPHA, { x: 2, y: 11, w: 2, h: 2 });
    cv.face(leg, 'bottom', [20, 20, 22]);
    cv.face(leg, 'top', pal.suitDark);
  }
  return cv;
};

/** Enemigo PvE: mismas UV, sin zonas de equipo (alfa 254). */
export const buildZombieSkin = (pal: Palette, size = SKIN_BASE_SIZE): Canvas =>
  buildDefaultSkin(pal, size, pal.armorDark);

// ------------------------------------------------------------------ CLI

export const writeBundledSkins = (outDir: string) => {
  mkdirSync(outDir, { recursive: true });
  const files: [string, Buffer][] = [
    ['template.png', buildTemplate().png()],
    ['default_red.png', buildDefaultSkin(PALETTE_RED).png()],
    ['default_blue.png', buildDefaultSkin(PALETTE_BLUE).png()],
    ['preset_survivor_orange.png', buildDefaultSkin(PALETTE_SURVIVOR_ORANGE, SKIN_BASE_SIZE, ACCENT_ORANGE).png()],
    ['preset_survivor_cyan.png', buildDefaultSkin(PALETTE_SURVIVOR_CYAN, SKIN_BASE_SIZE, ACCENT_CYAN).png()],
    ['preset_survivor_steel.png', buildDefaultSkin(PALETTE_SURVIVOR_STEEL).png()],
    ['zombie_walker.png', buildZombieSkin(PALETTE_ZOMBIE_WALKER).png()],
    ['zombie_runner.png', buildZombieSkin(PALETTE_ZOMBIE_RUNNER).png()],
    ['zombie_brute.png', buildZombieSkin(PALETTE_ZOMBIE_BRUTE).png()],
    ['zombie_armored.png', buildZombieSkin(PALETTE_ZOMBIE_ARMORED).png()],
    ['zombie_colossus.png', buildZombieSkin(PALETTE_ZOMBIE_COLOSSUS).png()],
  ];
  for (const [name, buf] of files) {
    writeFileSync(resolve(outDir, name), buf);
    console.log(`${name}  ${(buf.length / 1024).toFixed(1)} KB`);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeBundledSkins(resolve(dirname(fileURLToPath(import.meta.url)), '../client/public/assets/skins'));
}
