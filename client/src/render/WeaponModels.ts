import * as THREE from 'three';
import { WEAPON_COUNT } from '@arena/shared';
import { buildBoxData } from './skinBox';
import { type FaceName, faceRects } from './skinLayout';
import { ATLAS_SIZE, type Paint, WEAPON_DEFS, WEAPON_KEYS, type WeaponDef, weaponAtlas } from './weaponLayout';

export { WEAPON_COLORS, viewPose } from './weaponLayout';

export interface WeaponModel {
  group: THREE.Group;
  /** Point where muzzle flashes and tracers start (local space). */
  muzzle: THREE.Object3D;
}

// ------------------------------------------------------------------ placeholder atlas

const FACE_SHADE: Record<FaceName, number> = { top: 1.2, front: 1.0, right: 0.88, left: 0.88, back: 0.76, bottom: 0.6 };

const mulHex = (hex: number, k: number): string => {
  const c = (shift: number) => Math.max(0, Math.min(255, Math.round(((hex >> shift) & 255) * k)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const paintColor = (def: WeaponDef, paint: Paint): number => (paint === 'glow' ? def.accent : def.palette[paint]);

/**
 * Draws the placeholder atlas of a weapon: each face of each box gets its base colour, a shade by
 * orientation, a dark outline and a little noise. Glow parts are bright with a light centre line.
 * It is replaced by a hand-made PNG through `assets/weapons/manifest.json` (same layout).
 */
const paintAtlas = (id: number): HTMLCanvasElement => {
  const def = WEAPON_DEFS[id];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_SIZE;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  const rnd = lcg(id * 977 + 13);
  weaponAtlas(id).forEach((box, i) => {
    const part = def.parts[i];
    const base = paintColor(def, part.paint);
    const rects = faceRects(box);
    for (const face of Object.keys(rects) as FaceName[]) {
      const r = rects[face];
      const glow = part.paint === 'glow';
      g.fillStyle = mulHex(base, glow ? 1 : FACE_SHADE[face]);
      g.fillRect(r.x, r.y, r.w, r.h);
      if (glow) {
        g.fillStyle = 'rgba(255,255,255,0.55)';
        if (r.w >= r.h) g.fillRect(r.x, r.y + Math.floor((r.h - 1) / 2), r.w, 1);
        else g.fillRect(r.x + Math.floor((r.w - 1) / 2), r.y, 1, r.h);
        continue;
      }
      // outline (only where there is room for it) and speckles
      if (r.w >= 3 && r.h >= 3) {
        g.fillStyle = 'rgba(0,0,0,0.38)';
        g.fillRect(r.x, r.y, r.w, 1);
        g.fillRect(r.x, r.y + r.h - 1, r.w, 1);
        g.fillRect(r.x, r.y, 1, r.h);
        g.fillRect(r.x + r.w - 1, r.y, 1, r.h);
      }
      const n = Math.round((r.w * r.h) / 14);
      for (let k = 0; k < n; k++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.16)';
        g.fillRect(r.x + Math.floor(rnd() * r.w), r.y + Math.floor(rnd() * r.h), 1, 1);
      }
    }
  });
  return canvas;
};

const configureAtlas = (tex: THREE.Texture) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  // UVs follow the skin convention: v = pixelY / size with row 0 at the top
  tex.flipY = false;
  tex.needsUpdate = true;
};

/** One shared material (and atlas) per weapon, used by the first and third person models. */
const materials: (THREE.MeshLambertMaterial | undefined)[] = [];
const weaponMaterial = (id: number): THREE.MeshLambertMaterial => {
  let m = materials[id];
  if (!m) {
    const tex = new THREE.CanvasTexture(paintAtlas(id));
    configureAtlas(tex);
    // the atlas also lights itself a little so the bright (glow) parts read as emitting
    m = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x555555, emissiveMap: tex });
    materials[id] = m;
  }
  return m;
};

// ------------------------------------------------------------------ models

const geometries = new Map<string, THREE.BufferGeometry>();
const partGeometry = (id: number, index: number): THREE.BufferGeometry => {
  const key = `${id}:${index}`;
  let g = geometries.get(key);
  if (!g) {
    const part = WEAPON_DEFS[id].parts[index];
    const d = buildBoxData(part.size[0], part.size[1], part.size[2], weaponAtlas(id)[index]);
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(d.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(d.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(d.indices, 1));
    geometries.set(key, g);
  }
  return g;
};

/**
 * Builds a weapon from its definition in `weaponLayout.ts`: a handful of boxes with shared
 * geometries and ONE material/atlas per weapon. The weapon points toward -Z (camera forward).
 * Silhouettes are deliberately distinct so each weapon is recognisable at a glance.
 */
export const buildWeapon = (id: number): WeaponModel => {
  const wid = id >= 0 && id < WEAPON_COUNT ? id : 0;
  const def = WEAPON_DEFS[wid];
  const g = new THREE.Group();
  const mat = weaponMaterial(wid);
  def.parts.forEach((part, i) => {
    const m = new THREE.Mesh(partGeometry(wid, i), mat);
    m.position.set(...part.pos);
    if (part.rotX) m.rotation.x = part.rotX;
    g.add(m);
  });
  const muzzle = new THREE.Object3D();
  muzzle.position.set(...def.muzzle);
  g.add(muzzle);
  return { group: g, muzzle };
};

// ------------------------------------------------------------------ optional replacement atlases

export interface WeaponManifest {
  /** weapon key (`rifle`, `shotgun`, ...) -> file in /assets/weapons/ (null = procedural placeholder) */
  weapons: Partial<Record<string, string | null>>;
}

let overridesStarted = false;

/**
 * Optional replacement of the placeholder atlases by hand-made PNGs listed in
 * /assets/weapons/manifest.json. Missing or failing files silently keep the placeholder. Runs once.
 */
export const applyWeaponTextureOverrides = async (): Promise<void> => {
  if (overridesStarted) return;
  overridesStarted = true;
  let manifest: WeaponManifest;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}assets/weapons/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return;
    manifest = (await res.json()) as WeaponManifest;
  } catch {
    return;
  }
  const loader = new THREE.TextureLoader();
  for (const [key, file] of Object.entries(manifest.weapons ?? {})) {
    const id = WEAPON_KEYS.indexOf(key);
    if (id < 0 || !file || typeof file !== 'string' || /[\\/]|\.\./.test(file)) continue;
    loader.load(
      `${import.meta.env.BASE_URL}assets/weapons/${file}`,
      (tex) => {
        configureAtlas(tex);
        const m = weaponMaterial(id);
        m.map = tex;
        m.emissiveMap = tex;
        m.needsUpdate = true;
      },
      undefined,
      () => console.warn(`[armas] no se pudo cargar ${file}; se mantiene la textura provisional`),
    );
  }
};

// ------------------------------------------------------------------ muzzle flash

/** Bright additive sprite used for muzzle flashes. */
export const createFlashMaterial = (): THREE.SpriteMaterial => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,230,1)');
  grad.addColorStop(0.3, 'rgba(255,190,90,0.9)');
  grad.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
};
