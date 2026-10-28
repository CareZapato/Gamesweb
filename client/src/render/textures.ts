import * as THREE from 'three';
import type { Material } from '@arena/shared';

/**
 * Placeholder textures drawn procedurally on a canvas. They are original, need no downloads and keep
 * the game playable before any generated art exists. Each is seamless by construction: everything
 * drawn near an edge is drawn again wrapped on the opposite edge.
 */

const SIZE = 256;

type Painter = (g: CanvasRenderingContext2D, rnd: () => number) => void;

const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

/** Draws with 3x3 wrap so shapes crossing an edge continue on the other side. */
const wrapped = (g: CanvasRenderingContext2D, draw: (ox: number, oy: number) => void) => {
  for (const ox of [-SIZE, 0, SIZE]) for (const oy of [-SIZE, 0, SIZE]) draw(ox, oy);
};

const speckle = (g: CanvasRenderingContext2D, rnd: () => number, count: number, alpha: number, light = false) => {
  for (let i = 0; i < count; i++) {
    const v = light ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
    g.fillRect(Math.floor(rnd() * SIZE), Math.floor(rnd() * SIZE), 1 + Math.floor(rnd() * 2), 1 + Math.floor(rnd() * 2));
  }
};

const rivet = (g: CanvasRenderingContext2D, x: number, y: number) => {
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath();
  g.arc(x + 1, y + 1, 3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.arc(x, y, 2.4, 0, Math.PI * 2);
  g.fill();
};

const PAINTERS: Record<Exclude<Material, 'light'>, Painter> = {
  floor: (g, rnd) => {
    g.fillStyle = '#3b3f46';
    g.fillRect(0, 0, SIZE, SIZE);
    speckle(g, rnd, 3000, 0.25);
    // diamond tread plate
    for (let y = 0; y < SIZE; y += 16)
      for (let x = 0; x < SIZE; x += 16) {
        const flip = ((x + y) / 16) % 2 === 0;
        g.save();
        g.translate(x + 8, y + 8);
        g.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
        g.fillStyle = 'rgba(255,255,255,0.13)';
        g.fillRect(-6, -1.5, 12, 3);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(-6, 1.5, 12, 1.5);
        g.restore();
      }
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, SIZE - 3, SIZE - 3);
  },
  metal: (g, rnd) => {
    const grad = g.createLinearGradient(0, 0, 0, SIZE);
    grad.addColorStop(0, '#5d636c');
    grad.addColorStop(0.5, '#6a7079');
    grad.addColorStop(1, '#5d636c');
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(255,255,255,${0.05 * rnd()})`;
      g.fillRect(0, Math.floor(rnd() * SIZE), SIZE, 1);
    }
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, SIZE - 2, SIZE - 2);
    g.beginPath();
    g.moveTo(0, SIZE / 2);
    g.lineTo(SIZE, SIZE / 2);
    g.stroke();
    for (const x of [10, SIZE - 10]) for (const y of [10, SIZE / 2 - 10, SIZE / 2 + 10, SIZE - 10]) rivet(g, x, y);
    speckle(g, rnd, 1500, 0.2);
  },
  panel: (g, rnd) => {
    g.fillStyle = '#454b55';
    g.fillRect(0, 0, SIZE, SIZE);
    speckle(g, rnd, 2500, 0.18);
    const p = 8;
    g.fillStyle = '#525a66';
    g.fillRect(p, p, SIZE / 2 - p * 1.5, SIZE - p * 2);
    g.fillRect(SIZE / 2 + p / 2, p, SIZE / 2 - p * 1.5, SIZE / 2 - p * 1.5);
    g.fillStyle = '#3a4049';
    g.fillRect(SIZE / 2 + p / 2, SIZE / 2 + p / 2, SIZE / 2 - p * 1.5, SIZE / 2 - p * 1.5);
    // vents
    g.fillStyle = 'rgba(0,0,0,0.6)';
    for (let i = 0; i < 6; i++) g.fillRect(SIZE / 2 + 22, SIZE / 2 + 24 + i * 14, SIZE / 2 - 48, 6);
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 2;
    g.strokeRect(p, p, SIZE / 2 - p * 1.5, SIZE - p * 2);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.strokeRect(0, 0, SIZE, SIZE);
    rivet(g, 20, 20);
    rivet(g, 20, SIZE - 20);
    // accent stripe
    g.fillStyle = 'rgba(255,140,40,0.55)';
    g.fillRect(p + 10, SIZE * 0.72, SIZE / 2 - p * 1.5 - 20, 5);
  },
  grate: (g) => {
    g.fillStyle = '#121418';
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < SIZE; i += 16) {
      g.fillStyle = '#5a5f66';
      g.fillRect(i, 0, 5, SIZE);
      g.fillStyle = '#4a4e55';
      g.fillRect(0, i + 6, SIZE, 3);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      g.fillRect(i, 0, 1, SIZE);
    }
    g.strokeStyle = '#6a7078';
    g.lineWidth = 6;
    g.strokeRect(3, 3, SIZE - 6, SIZE - 6);
  },
  concrete: (g, rnd) => {
    g.fillStyle = '#6d6b66';
    g.fillRect(0, 0, SIZE, SIZE);
    speckle(g, rnd, 9000, 0.22);
    speckle(g, rnd, 3000, 0.12, true);
    // form panel seams and tie holes
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, SIZE - 2, SIZE - 2);
    for (const x of [SIZE / 4, (SIZE * 3) / 4])
      for (const y of [SIZE / 4, (SIZE * 3) / 4]) {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.beginPath();
        g.arc(x, y, 4, 0, Math.PI * 2);
        g.fill();
      }
    // crack
    g.strokeStyle = 'rgba(30,28,25,0.5)';
    g.lineWidth = 1;
    wrapped(g, (ox, oy) => {
      g.beginPath();
      g.moveTo(180 + ox, 30 + oy);
      g.lineTo(200 + ox, 80 + oy);
      g.lineTo(190 + ox, 120 + oy);
      g.lineTo(220 + ox, 170 + oy);
      g.stroke();
    });
  },
  red: (g, rnd) => teamPanel(g, rnd, '#7a1c1c', '#c33a2a', '#ff5a40'),
  blue: (g, rnd) => teamPanel(g, rnd, '#1b2f6e', '#2f5cc0', '#4fa0ff'),
  trim: (g) => {
    g.fillStyle = '#1a1a1a';
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = '#e0b020';
    // diagonal hazard stripes, 4 per tile so they wrap seamlessly
    wrapped(g, (ox, oy) => {
      for (let i = -4; i < 8; i++) {
        g.beginPath();
        g.moveTo(i * 64 + ox, 0 + oy);
        g.lineTo(i * 64 + 32 + ox, 0 + oy);
        g.lineTo(i * 64 + 32 + SIZE + ox, SIZE + oy);
        g.lineTo(i * 64 + SIZE + ox, SIZE + oy);
        g.closePath();
        g.fill();
      }
    });
  },
  dark: (g, rnd) => {
    g.fillStyle = '#1d2027';
    g.fillRect(0, 0, SIZE, SIZE);
    speckle(g, rnd, 2000, 0.3);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 2;
    for (let i = 0; i <= SIZE; i += SIZE / 4) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, SIZE);
      g.moveTo(0, i);
      g.lineTo(SIZE, i);
      g.stroke();
    }
  },
  ground: (g, rnd) => {
    // packed earth with gravel; every blot is drawn wrapped so the tile stays seamless
    g.fillStyle = '#6b5a45';
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * SIZE,
        y = rnd() * SIZE,
        r = 6 + rnd() * 22,
        ry = r * (0.5 + rnd() * 0.4),
        rot = rnd() * Math.PI,
        dark = rnd() < 0.5;
      g.fillStyle = dark ? `rgba(60,46,32,${0.12 + rnd() * 0.15})` : `rgba(150,128,96,${0.08 + rnd() * 0.12})`;
      wrapped(g, (ox, oy) => {
        g.beginPath();
        g.ellipse(x + ox, y + oy, r, ry, rot, 0, Math.PI * 2);
        g.fill();
      });
    }
    speckle(g, rnd, 7000, 0.3);
    speckle(g, rnd, 2500, 0.18, true);
  },
};

function teamPanel(g: CanvasRenderingContext2D, rnd: () => number, base: string, mid: string, glow: string) {
  g.fillStyle = base;
  g.fillRect(0, 0, SIZE, SIZE);
  speckle(g, rnd, 2500, 0.2);
  g.fillStyle = mid;
  g.fillRect(12, 12, SIZE - 24, SIZE - 24);
  g.fillStyle = base;
  g.fillRect(28, 28, SIZE - 56, SIZE - 56);
  // chevron emblem (original, textless)
  g.fillStyle = glow;
  g.beginPath();
  g.moveTo(SIZE / 2, 70);
  g.lineTo(SIZE / 2 + 60, 140);
  g.lineTo(SIZE / 2 + 36, 140);
  g.lineTo(SIZE / 2, 100);
  g.lineTo(SIZE / 2 - 36, 140);
  g.lineTo(SIZE / 2 - 60, 140);
  g.closePath();
  g.fill();
  g.fillRect(SIZE / 2 - 50, 160, 100, 10);
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, SIZE - 3, SIZE - 3);
}

/** World metres covered by one texture tile, per material. */
export const TEXTURE_SCALE: Record<Material, number> = {
  floor: 2,
  metal: 2,
  panel: 4,
  grate: 2,
  concrete: 4,
  red: 4,
  blue: 4,
  trim: 1,
  dark: 4,
  ground: 6,
  light: 1,
};

const cache = new Map<string, THREE.Texture>();

export const proceduralTexture = (
  mat: Exclude<Material, 'light'>,
  maxAnisotropy: number,
  textureSize: 128 | 256 = 256,
): THREE.Texture => {
  const key = `${mat}:${textureSize}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = textureSize;
  const g = canvas.getContext('2d')!;
  const scale = textureSize / SIZE;
  g.scale(scale, scale);
  PAINTERS[mat](g, rng(mat.length * 7919 + mat.charCodeAt(0)));
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  if (textureSize <= 128) {
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
  } else {
    tex.generateMipmaps = true;
  }
  cache.set(key, tex);
  return tex;
};

export interface TextureManifest {
  /** material name -> file in /assets/textures/ (null = use procedural placeholder) */
  textures: Partial<Record<Material, string | null>>;
}

/**
 * Optional replacement of placeholders by final art listed in /assets/textures/manifest.json.
 * Missing or failing files silently keep the procedural texture.
 */
type MapMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;

export const applyTextureOverrides = async (materials: Map<Material, MapMaterial>, maxAnisotropy: number) => {
  let manifest: TextureManifest;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}assets/textures/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return;
    manifest = (await res.json()) as TextureManifest;
  } catch {
    return;
  }
  const loader = new THREE.TextureLoader();
  for (const [mat, file] of Object.entries(manifest.textures ?? {})) {
    const m = materials.get(mat as Material);
    if (!m || !file) continue;
    loader.load(
      `${import.meta.env.BASE_URL}assets/textures/${file}`,
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, maxAnisotropy);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        m.map = tex;
        m.needsUpdate = true;
      },
      undefined,
      () => console.warn(`[texturas] no se pudo cargar ${file}; se mantiene la textura provisional`),
    );
  }
};
