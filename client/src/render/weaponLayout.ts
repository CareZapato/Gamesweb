import { type NetBox, SKIN_BASE_SIZE } from './skinLayout';

/**
 * Definition of the seven weapon models (all boxes, at most 12 per weapon) and of the texture atlas
 * each weapon uses. Pure data and maths, no DOM and no Three.js, so it is unit tested.
 *
 * Every weapon has ONE atlas of 128x128 px (a 256x256 file with the same layout x2 also works).
 * Each box owns a "net" of six faces in it, exactly like the body parts of a player skin
 * (see `skinLayout.ts`): the net of a box of w x h x d texels is 2(w+d) x (d+h) texels. A texel is
 * `TEXEL_CM` cm of the real box (with a minimum of 2). The nets of a weapon are packed in rows
 * (`packNets`); `npm run weapons:template` writes the resulting layout of every weapon to
 * `client/public/assets/weapons/template_<key>.png` so an artist can paint over it.
 *
 * The weapon points toward -Z (forward), +Y is up and +X is the player's right.
 */

export type V3 = [number, number, number];

/** How a box is painted by the procedural placeholder atlas. */
export type Paint = 'body' | 'dark' | 'grip' | 'glow';

export interface WeaponPart {
  name: string;
  /** Box size in metres: X (width), Y (height), Z (depth/length). */
  size: V3;
  /** Box centre in the weapon's local space. */
  pos: V3;
  /** Rotation around X (radians), used for grips and magazines. */
  rotX?: number;
  paint: Paint;
}

export interface WeaponDef {
  /** Key in `assets/weapons/manifest.json`. */
  key: string;
  palette: { body: number; dark: number; grip: number };
  /** Accent colour: glow parts, HUD, tracers and ammo pickups of the weapon. */
  accent: number;
  /** Where muzzle flashes and tracers start. */
  muzzle: V3;
  /** Highest point of the iron sights (m): the view model is aligned with it when aiming. */
  sightTop: number;
  /** Forward offset of the first-person model (long weapons extend behind their grip). */
  viewZ: number;
  parts: WeaponPart[];
}

export const MAX_WEAPON_PARTS = 12;
export const ATLAS_SIZE = SKIN_BASE_SIZE;
/** Real centimetres covered by one atlas texel. */
export const TEXEL_CM = 4;

const p = (name: string, size: V3, pos: V3, paint: Paint, rotX = 0): WeaponPart => ({ name, size, pos, paint, ...(rotX ? { rotX } : {}) });

/** Index = weapon id (see `WeaponId` in shared/weapons.ts). */
export const WEAPON_DEFS: readonly WeaponDef[] = [
  {
    // Carabina Tormenta: long and slim, curved magazine, open sights, cyan strip.
    key: 'rifle',
    palette: { body: 0x46505e, dark: 0x23272e, grip: 0x2b2622 },
    accent: 0x2fd0ff,
    muzzle: [0, 0.025, -0.67],
    sightTop: 0.11,
    viewZ: 0,
    parts: [
      p('receiver', [0.09, 0.12, 0.42], [0, 0, -0.05], 'body'),
      p('barrel', [0.04, 0.04, 0.34], [0, 0.025, -0.43], 'dark'),
      p('handguard', [0.07, 0.07, 0.2], [0, -0.005, -0.3], 'dark'),
      p('muzzle', [0.055, 0.055, 0.06], [0, 0.025, -0.62], 'dark'),
      p('magazine', [0.05, 0.16, 0.07], [0, -0.14, -0.08], 'dark', 0.2),
      p('grip', [0.05, 0.11, 0.06], [0, -0.11, 0.08], 'grip', -0.3),
      p('stock', [0.06, 0.1, 0.2], [0, -0.01, 0.3], 'grip'),
      p('rearSight', [0.03, 0.04, 0.03], [0, 0.08, 0.0], 'dark'),
      p('frontSight', [0.015, 0.07, 0.015], [0, 0.075, -0.52], 'dark'),
      p('strip', [0.092, 0.02, 0.26], [0, 0.03, -0.04], 'glow'),
    ],
  },
  {
    // Dispersor Ariete: short and wide, twin barrels stacked, pump, side shell box.
    key: 'shotgun',
    palette: { body: 0x5a4a3c, dark: 0x2b2420, grip: 0x3a2a1c },
    accent: 0xff8a2a,
    muzzle: [0, 0.02, -0.74],
    sightTop: 0.105,
    viewZ: -0.05,
    parts: [
      p('body', [0.14, 0.14, 0.36], [0, 0, -0.05], 'body'),
      p('barrelTop', [0.055, 0.055, 0.46], [0, 0.045, -0.46], 'dark'),
      p('barrelBottom', [0.055, 0.055, 0.46], [0, -0.015, -0.46], 'dark'),
      p('muzzleBlock', [0.12, 0.12, 0.06], [0, 0.02, -0.7], 'dark'),
      p('pump', [0.13, 0.08, 0.18], [0, -0.07, -0.4], 'grip'),
      p('shellBox', [0.06, 0.1, 0.14], [0.1, 0, -0.08], 'dark'),
      p('grip', [0.06, 0.12, 0.07], [0, -0.13, 0.1], 'grip', -0.25),
      p('stock', [0.09, 0.12, 0.18], [0, -0.03, 0.27], 'grip'),
      p('strip', [0.145, 0.03, 0.12], [0, 0.08, -0.05], 'glow'),
      p('bead', [0.025, 0.03, 0.025], [0, 0.09, -0.68], 'dark'),
    ],
  },
  {
    // Aguja Lumen: the longest one; thin barrel with glowing coils, long scope, cheek rest.
    key: 'sniper',
    palette: { body: 0x384640, dark: 0x1a1f1c, grip: 0x25211c },
    accent: 0x7dff6a,
    muzzle: [0, 0.01, -1.01],
    sightTop: 0.1375,
    viewZ: 0,
    parts: [
      p('body', [0.07, 0.1, 0.5], [0, 0, 0.0], 'body'),
      p('barrel', [0.03, 0.03, 0.7], [0, 0.01, -0.6], 'dark'),
      p('tip', [0.045, 0.045, 0.08], [0, 0.01, -0.97], 'dark'),
      p('scope', [0.05, 0.05, 0.3], [0, 0.105, -0.08], 'dark'),
      p('lens', [0.065, 0.065, 0.03], [0, 0.105, -0.245], 'glow'),
      p('eyepiece', [0.06, 0.06, 0.04], [0, 0.105, 0.09], 'dark'),
      p('mount', [0.03, 0.04, 0.04], [0, 0.065, 0.0], 'dark'),
      p('stock', [0.06, 0.14, 0.26], [0, -0.02, 0.34], 'grip'),
      p('cheekRest', [0.05, 0.04, 0.14], [0, 0.06, 0.34], 'grip'),
      p('grip', [0.05, 0.12, 0.05], [0, -0.1, 0.12], 'grip', -0.3),
      p('coilA', [0.05, 0.05, 0.04], [0, 0.01, -0.5], 'glow'),
      p('coilB', [0.05, 0.05, 0.04], [0, 0.01, -0.7], 'glow'),
    ],
  },
  {
    // Lanzador Cometa: thick tube on the shoulder, flared mouth, warning band, glowing rear ring.
    key: 'rocket',
    palette: { body: 0x505648, dark: 0x24281f, grip: 0x2a2520 },
    accent: 0xff3b3b,
    muzzle: [0, 0.02, -0.7],
    sightTop: 0.155,
    viewZ: -0.5,
    parts: [
      p('tube', [0.17, 0.17, 0.9], [0, 0.02, -0.15], 'body'),
      p('mouth', [0.21, 0.21, 0.1], [0, 0.02, -0.62], 'dark'),
      p('rearRing', [0.19, 0.19, 0.05], [0, 0.02, 0.28], 'dark'),
      p('rearGlow', [0.11, 0.11, 0.03], [0, 0.02, 0.31], 'glow'),
      p('ringA', [0.19, 0.19, 0.04], [0, 0.02, -0.35], 'dark'),
      p('ringB', [0.19, 0.19, 0.04], [0, 0.02, 0.0], 'dark'),
      p('band', [0.175, 0.175, 0.12], [0, 0.02, -0.45], 'glow'),
      p('grip', [0.05, 0.15, 0.07], [0, -0.14, -0.05], 'grip', 0.2),
      p('foreGrip', [0.04, 0.1, 0.05], [0, -0.14, -0.35], 'grip'),
      p('sight', [0.02, 0.05, 0.03], [0, 0.13, -0.45], 'dark'),
      p('sideBox', [0.06, 0.08, 0.18], [0.11, 0.03, 0.05], 'dark'),
    ],
  },
  {
    // Mortero Grillo: compact, short fat barrel, big drum under it, carry handle.
    key: 'grenade',
    palette: { body: 0x5a553c, dark: 0x2a2818, grip: 0x2a2520 },
    accent: 0xffd23a,
    muzzle: [0, 0.02, -0.5],
    sightTop: 0.135,
    viewZ: -0.12,
    parts: [
      p('body', [0.13, 0.13, 0.34], [0, 0, -0.02], 'body'),
      p('barrel', [0.1, 0.1, 0.26], [0, 0.02, -0.3], 'dark'),
      p('muzzle', [0.13, 0.13, 0.05], [0, 0.02, -0.45], 'dark'),
      p('drum', [0.2, 0.16, 0.14], [0, -0.12, -0.1], 'dark'),
      p('drumRing', [0.205, 0.05, 0.145], [0, -0.12, -0.1], 'glow'),
      p('handle', [0.03, 0.03, 0.22], [0, 0.12, -0.04], 'dark'),
      p('post', [0.03, 0.07, 0.03], [0, 0.08, -0.15], 'dark'),
      p('grip', [0.06, 0.12, 0.07], [0, -0.12, 0.13], 'grip', -0.2),
      p('stock', [0.08, 0.1, 0.14], [0, -0.01, 0.2], 'grip'),
      p('strip', [0.135, 0.025, 0.2], [0, 0.075, -0.02], 'glow'),
    ],
  },
  {
    // Hilo Aurora: sleek emitter with three glowing coil rings and two energy cells on the sides.
    key: 'plasma',
    palette: { body: 0x7d8794, dark: 0x2a2f38, grip: 0x22262c },
    accent: 0xb36bff,
    muzzle: [0, 0.01, -0.68],
    sightTop: 0.115,
    viewZ: 0,
    parts: [
      p('core', [0.1, 0.12, 0.38], [0, 0, 0.0], 'body'),
      p('emitter', [0.05, 0.05, 0.42], [0, 0.01, -0.4], 'dark'),
      p('coilA', [0.09, 0.09, 0.03], [0, 0.01, -0.28], 'glow'),
      p('coilB', [0.09, 0.09, 0.03], [0, 0.01, -0.4], 'glow'),
      p('coilC', [0.09, 0.09, 0.03], [0, 0.01, -0.52], 'glow'),
      p('tip', [0.07, 0.07, 0.05], [0, 0.01, -0.64], 'glow'),
      p('cellL', [0.05, 0.11, 0.22], [-0.08, 0, 0.0], 'dark'),
      p('cellR', [0.05, 0.11, 0.22], [0.08, 0, 0.0], 'dark'),
      p('grip', [0.05, 0.12, 0.06], [0, -0.11, 0.1], 'grip', -0.25),
      p('rear', [0.07, 0.09, 0.12], [0, 0, 0.26], 'dark'),
      p('fin', [0.025, 0.05, 0.2], [0, 0.09, -0.05], 'dark'),
    ],
  },
  {
    // Lanza Cuásar: twin rails with a glowing slit between them, capacitor on top, thick stock.
    key: 'charge',
    palette: { body: 0x2e3340, dark: 0x14171d, grip: 0x1f1d22 },
    accent: 0xff5fa8,
    muzzle: [0, 0, -0.88],
    sightTop: 0.195,
    viewZ: -0.05,
    parts: [
      p('body', [0.1, 0.13, 0.45], [0, 0, 0.02], 'body'),
      p('railL', [0.025, 0.04, 0.62], [-0.045, 0, -0.55], 'dark'),
      p('railR', [0.025, 0.04, 0.62], [0.045, 0, -0.55], 'dark'),
      p('bridge', [0.12, 0.05, 0.04], [0, 0, -0.85], 'glow'),
      p('slit', [0.045, 0.03, 0.6], [0, 0, -0.52], 'glow'),
      p('capacitor', [0.09, 0.09, 0.2], [0, 0.1, 0.0], 'dark'),
      p('capGlow', [0.092, 0.03, 0.12], [0, 0.1, -0.02], 'glow'),
      p('optic', [0.04, 0.04, 0.16], [0, 0.175, 0.0], 'dark'),
      p('grip', [0.05, 0.12, 0.06], [0, -0.12, 0.14], 'grip', -0.3),
      p('stock', [0.08, 0.16, 0.2], [0, -0.02, 0.33], 'grip'),
      p('cooler', [0.12, 0.08, 0.12], [0, -0.07, -0.25], 'dark'),
    ],
  },
];

export const WEAPON_KEYS: readonly string[] = WEAPON_DEFS.map((w) => w.key);

/** Accent colour per weapon, used for glow strips, HUD and tracers. */
export const WEAPON_COLORS: readonly number[] = WEAPON_DEFS.map((w) => w.accent);

/** First-person placement per weapon: resting (hip) and aiming (centred on the sights). */
export interface ViewPose {
  hip: V3;
  ads: V3;
}
export const HIP_POS: V3 = [0.22, -0.22, -0.45];
export const viewPose = (id: number): ViewPose => {
  const d = WEAPON_DEFS[id] ?? WEAPON_DEFS[0];
  return {
    hip: [HIP_POS[0], HIP_POS[1], HIP_POS[2] + d.viewZ],
    // the top of the sights goes to the centre of the screen, a little closer to the eye
    ads: [0, -d.sightTop - 0.004, HIP_POS[2] + d.viewZ + 0.06],
  };
};

// ------------------------------------------------------------------ atlas packing

/** Size of a part in atlas texels (X, Y, Z). */
export const partTexels = (part: WeaponPart): [number, number, number] =>
  part.size.map((m) => Math.max(2, Math.round((m * 100) / TEXEL_CM))) as [number, number, number];

export interface PlacedBox extends NetBox {
  /** Index in `WeaponDef.parts`. */
  index: number;
}

/**
 * Packs the nets of the parts of a weapon in rows (tallest first). Deterministic. Returns the box
 * of every part in `parts` order, or null when they do not fit in `size` x `size`.
 */
export const packNets = (parts: readonly WeaponPart[], size = ATLAS_SIZE): PlacedBox[] | null => {
  const dims = parts.map((part, index) => {
    const [w, h, d] = partTexels(part);
    return { index, w, h, d, nw: 2 * (w + d), nh: d + h };
  });
  const order = [...dims].sort((a, b) => b.nh - a.nh || b.nw - a.nw || a.index - b.index);
  const out: PlacedBox[] = new Array(parts.length);
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const n of order) {
    if (x + n.nw > size) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    if (n.nw > size || y + n.nh > size) return null;
    out[n.index] = { index: n.index, w: n.w, h: n.h, d: n.d, ox: x, oy: y };
    x += n.nw;
    rowH = Math.max(rowH, n.nh);
  }
  return out;
};

const atlasCache = new Map<number, PlacedBox[]>();

/** Atlas layout of a weapon (cached). Throws if the weapon definition does not fit. */
export const weaponAtlas = (id: number): PlacedBox[] => {
  let a = atlasCache.get(id);
  if (!a) {
    const def = WEAPON_DEFS[id];
    if (!def) throw new Error(`unknown weapon ${id}`);
    const packed = packNets(def.parts);
    if (!packed) throw new Error(`weapon ${def.key}: the nets do not fit in the ${ATLAS_SIZE}px atlas`);
    atlasCache.set(id, (a = packed));
  }
  return a;
};
