import * as THREE from 'three';
import { checkSkinHeader } from '@arena/shared';
import { TEAM_ALPHA } from './skinLayout';

/** A decoded skin: RGBA bytes, row 0 = top of the picture. */
export interface SkinImage {
  /** Unique id, used as cache key. */
  uid: number;
  size: number;
  data: Uint8ClampedArray;
}

let nextUid = 1;

export const makeSkinImage = (size: number, data: Uint8ClampedArray): SkinImage => ({ uid: nextUid++, size, data });

/**
 * Decodes a PNG with the browser. Rejects when it is not a 128x128 / 256x256 PNG of at most 48 KB or
 * the browser cannot decode it. Used both to validate a file before sending it and to display the
 * skins received from the server.
 */
export const decodeSkinPng = async (bytes: Uint8Array): Promise<SkinImage> => {
  const check = checkSkinHeader(bytes);
  if (!check.ok) throw new Error(check.reason);
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  } catch {
    throw new Error('el navegador no pudo decodificar el PNG');
  }
  try {
    if (bmp.width !== check.size || bmp.height !== check.size) throw new Error('el tamaño real no coincide con la cabecera');
    const c = document.createElement('canvas');
    c.width = c.height = check.size;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingEnabled = false;
    g.drawImage(bmp, 0, 0);
    return makeSkinImage(check.size, g.getImageData(0, 0, check.size, check.size).data);
  } finally {
    bmp.close();
  }
};

/** Fetches and decodes a bundled PNG (default skins). Returns null on any failure. */
export const loadSkinUrl = async (url: string): Promise<SkinImage | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await decodeSkinPng(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
};

/** Single-colour skin used when even the bundled defaults cannot be loaded. */
export const flatSkin = (rgb: number): SkinImage => {
  const size = 128;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = (rgb >> 16) & 255;
    data[i * 4 + 1] = (rgb >> 8) & 255;
    data[i * 4 + 2] = rgb & 255;
    data[i * 4 + 3] = 255;
  }
  return makeSkinImage(size, data);
};

/**
 * Team-colour zone: pixels with alpha exactly 254 become opaque and take `tint` scaled by the pixel
 * brightness (paint them white/grey to get the full colour / darker shades of it). Everything else
 * is copied as is. Returns a new buffer.
 */
export const applyTint = (src: Uint8ClampedArray, tint: number): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(src);
  const tr = (tint >> 16) & 255;
  const tg = (tint >> 8) & 255;
  const tb = tint & 255;
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] !== TEAM_ALPHA) continue;
    const luma = (0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2]) / 255;
    out[i] = tr * luma;
    out[i + 1] = tg * luma;
    out[i + 2] = tb * luma;
    out[i + 3] = 255;
  }
  return out;
};

/** Skins received from the server (by player id) plus the bundled defaults. */
export class SkinStore {
  private bytes = new Map<number, Uint8Array>();
  private images = new Map<number, SkinImage>();
  private listeners = new Set<(id: number) => void>();
  defaultRed: SkinImage | null = null;
  defaultBlue: SkinImage | null = null;
  private defaultsPromise: Promise<void> | null = null;

  /** Loads default_red / default_blue once. Safe to call repeatedly. */
  preloadDefaults(baseUrl: string): Promise<void> {
    this.defaultsPromise ??= Promise.all([loadSkinUrl(`${baseUrl}assets/skins/default_red.png`), loadSkinUrl(`${baseUrl}assets/skins/default_blue.png`)]).then(
      ([r, b]) => {
        this.defaultRed = r;
        this.defaultBlue = b;
        this.listeners.forEach((fn) => fn(-1));
      },
    );
    return this.defaultsPromise;
  }

  /** Stores (or clears) the skin of a player and decodes it. Invalid data silently keeps the default. */
  set(id: number, png: Uint8Array | null): void {
    if (!png || png.length === 0) {
      this.bytes.delete(id);
      this.images.delete(id);
      this.listeners.forEach((fn) => fn(id));
      return;
    }
    this.bytes.set(id, png);
    void decodeSkinPng(png)
      .then((img) => {
        if (this.bytes.get(id) !== png) return; // replaced meanwhile
        this.images.set(id, img);
        this.listeners.forEach((fn) => fn(id));
      })
      .catch(() => {
        if (this.bytes.get(id) !== png) return;
        this.images.delete(id);
      });
  }

  image(id: number): SkinImage | null {
    return this.images.get(id) ?? null;
  }

  clear(): void {
    const ids = [...this.bytes.keys()];
    this.bytes.clear();
    this.images.clear();
    ids.forEach((id) => this.listeners.forEach((fn) => fn(id)));
  }

  /** Subscribes to changes; the id is -1 when the defaults finished loading. */
  onChange(fn: (id: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Fallback skin of a player: red/blue by team, alternating in Deathmatch. */
  fallback(playerId: number, team: number): SkinImage {
    const red = team === 0 || (team < 0 && playerId % 2 === 1);
    return (red ? this.defaultRed ?? this.defaultBlue : this.defaultBlue ?? this.defaultRed) ?? flatSkin(red ? 0x5a2a2a : 0x2a3a5a);
  }
}

/** Builds and caches the GPU textures of one match. Owner must call `dispose()`. */
export class SkinTextures {
  private cache = new Map<string, THREE.DataTexture>();

  constructor(private store: SkinStore) {}

  /** Texture of a player: their own skin if received and valid, otherwise the default one. */
  get(playerId: number, team: number, tint: number): THREE.DataTexture {
    const img = this.store.image(playerId) ?? this.store.fallback(playerId, team);
    return this.fromImage(img, tint);
  }

  fromImage(img: SkinImage, tint: number): THREE.DataTexture {
    const key = `${img.uid}:${tint}`;
    let tex = this.cache.get(key);
    if (!tex) {
      tex = new THREE.DataTexture(applyTint(img.data, tint), img.size, img.size, THREE.RGBAFormat, THREE.UnsignedByteType);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.flipY = false;
      tex.needsUpdate = true;
      this.cache.set(key, tex);
    }
    return tex;
  }

  dispose(): void {
    for (const t of this.cache.values()) t.dispose();
    this.cache.clear();
  }
}
