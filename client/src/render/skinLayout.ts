/**
 * Fixed "net" layout of a player skin: one PNG of 128x128 px (or 256x256, same layout x2) where every
 * body part owns a rectangle holding its six faces. This is the single source of truth: the box
 * UVs (`skinBox.ts`), the template generator (`scripts/skins.ts`) and the docs (docs/SKINS.md) all
 * derive from it. Pure TypeScript, no DOM and no Three.js, so it is unit tested.
 *
 * Net of a box of size w (width, X) x h (height, Y) x d (depth, Z), origin (ox, oy):
 *
 *           d      w      w
 *        +-----+-------+-------+
 *        | (.) |  top  | bottom|            footprint: 2(w+d) x (d+h)
 *        +-----+-------+-------+-----+
 *        |right| front | left  | back|
 *        +-----+-------+-------+-----+
 *           d      w       d      w
 *
 * "front" looks toward -Z (where the character faces); "right" is the character's own right side.
 */
export const SKIN_BASE_SIZE = 128;

export type FaceName = 'top' | 'bottom' | 'right' | 'front' | 'left' | 'back';
export const FACE_NAMES: readonly FaceName[] = ['top', 'bottom', 'right', 'front', 'left', 'back'];

export type PartId = 'head' | 'helmet' | 'torso' | 'chest' | 'armL' | 'armR' | 'pauldronL' | 'pauldronR' | 'legL' | 'legR';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PartDef {
  id: PartId;
  /** Spanish name used in docs and the template legend. */
  label: string;
  /** `base`: always drawn (transparent pixels are holes). `outer`: optional layer, alpha 0 = nothing. */
  layer: 'base' | 'outer';
  /** Box size in skin pixels (at 128 px). */
  w: number;
  h: number;
  d: number;
  /** Top-left corner of the part's net inside the 128 px image. */
  ox: number;
  oy: number;
}

/**
 * Packing (128 px, y grows downward). Rows:
 *   y=0   head(48x24) helmet(52x26) armL(24x26)           -> x up to 124
 *   y=26  torso(40x28) chest(44x21) armR(24x26)            -> x up to 108
 *   y=54  legL(26x34) legR(26x34) pauldronL(32x14) pauldronR(32x14)
 * Everything below y=88 is free (the template prints its legend there).
 */
export const SKIN_PARTS: readonly PartDef[] = [
  { id: 'head', label: 'Cabeza', layer: 'base', w: 12, h: 12, d: 12, ox: 0, oy: 0 },
  { id: 'helmet', label: 'Casco', layer: 'outer', w: 13, h: 13, d: 13, ox: 48, oy: 0 },
  { id: 'armL', label: 'Brazo izquierdo', layer: 'base', w: 6, h: 20, d: 6, ox: 100, oy: 0 },
  { id: 'torso', label: 'Torso', layer: 'base', w: 12, h: 20, d: 8, ox: 0, oy: 26 },
  { id: 'chest', label: 'Pechera', layer: 'outer', w: 13, h: 12, d: 9, ox: 40, oy: 26 },
  { id: 'armR', label: 'Brazo derecho', layer: 'base', w: 6, h: 20, d: 6, ox: 84, oy: 26 },
  { id: 'legL', label: 'Pierna izquierda', layer: 'base', w: 6, h: 27, d: 7, ox: 0, oy: 54 },
  { id: 'legR', label: 'Pierna derecha', layer: 'base', w: 6, h: 27, d: 7, ox: 26, oy: 54 },
  { id: 'pauldronL', label: 'Hombrera izquierda', layer: 'outer', w: 8, h: 6, d: 8, ox: 52, oy: 54 },
  { id: 'pauldronR', label: 'Hombrera derecha', layer: 'outer', w: 8, h: 6, d: 8, ox: 84, oy: 54 },
];

export const getPart = (id: PartId): PartDef => {
  const p = SKIN_PARTS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown skin part ${id}`);
  return p;
};

/** What the net layout needs of a box (also used by weapon atlases, see `weaponLayout.ts`). */
export type NetBox = Pick<PartDef, 'w' | 'h' | 'd' | 'ox' | 'oy'>;

/** Bounding rectangle of a part's whole net (all six faces), at 128 px. */
export const partFootprint = (p: NetBox): Rect => ({ x: p.ox, y: p.oy, w: 2 * (p.w + p.d), h: p.d + p.h });

/** Rectangle of every face of a part, at 128 px. */
export const faceRects = (p: NetBox): Record<FaceName, Rect> => ({
  top: { x: p.ox + p.d, y: p.oy, w: p.w, h: p.d },
  bottom: { x: p.ox + p.d + p.w, y: p.oy, w: p.w, h: p.d },
  right: { x: p.ox, y: p.oy + p.d, w: p.d, h: p.h },
  front: { x: p.ox + p.d, y: p.oy + p.d, w: p.w, h: p.h },
  left: { x: p.ox + p.d + p.w, y: p.oy + p.d, w: p.d, h: p.h },
  back: { x: p.ox + 2 * p.d + p.w, y: p.oy + p.d, w: p.w, h: p.h },
});

/** Scales a 128 px rectangle to an image of `size` px (128 or 256). */
export const scaleRect = (r: Rect, size: number): Rect => {
  const k = size / SKIN_BASE_SIZE;
  return { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k };
};

export interface SkinRegion {
  part: PartId;
  face: FaceName;
  rect: Rect;
}

/** All 60 face regions (10 parts x 6 faces) of an image of the given size. */
export const skinRegions = (size: number = SKIN_BASE_SIZE): SkinRegion[] =>
  SKIN_PARTS.flatMap((p) => {
    const fr = faceRects(p);
    return FACE_NAMES.map((face) => ({ part: p.id, face, rect: scaleRect(fr[face], size) }));
  });

export const rectsOverlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Pixel value that marks "tint with the team colour" (see docs/SKINS.md). */
export const TEAM_ALPHA = 254;
