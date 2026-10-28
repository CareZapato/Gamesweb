import { describe, expect, it } from 'vitest';
import { SKIN } from '@arena/shared';
import { validateSkinPng } from '../server/src/skins';
import { buildDefaultSkin, buildTemplate, encodePng, PALETTE_GOLD, PALETTE_RED, pngFromRaw } from '../scripts/skins';

const noise = (size: number): Buffer => {
  // incompressible pixels: the PNG is much heavier than 48 KB
  const px = new Uint8Array(size * size * 4);
  let s = 12345;
  for (let i = 0; i < px.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    px[i] = s >>> 24;
  }
  return encodePng(size, size, px);
};

const flat = (w: number, h: number) => encodePng(w, h, new Uint8Array(w * h * 4).fill(200));

describe('validación de skins en el servidor', () => {
  it('acepta las skins incluidas y la plantilla, a 128 y a 256 px', () => {
    for (const [name, png] of [
      ['plantilla 128', buildTemplate(128).png()],
      ['roja 128', buildDefaultSkin(PALETTE_RED, 128).png()],
      ['dorada 256', buildDefaultSkin(PALETTE_GOLD, 256).png()],
      ['plana 128', flat(128, 128)],
    ] as const) {
      const r = validateSkinPng(new Uint8Array(png));
      expect(r.ok, `${name}: ${r.ok ? '' : r.reason}`).toBe(true);
      if (r.ok) expect(r.png).toEqual(new Uint8Array(png));
    }
  });

  it('acepta Buffer y ArrayBuffer, y devuelve una copia propia', () => {
    const png = flat(128, 128);
    const a = validateSkinPng(png);
    expect(a.ok).toBe(true);
    const ab = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
    expect(validateSkinPng(ab).ok).toBe(true);
    if (a.ok) expect(a.png.buffer).not.toBe(png.buffer);
  });

  it('rechaza tamaños incorrectos', () => {
    for (const [w, h] of [[64, 64], [127, 128], [128, 127], [128, 256], [256, 128], [512, 512], [1, 1], [129, 129]]) {
      const r = validateSkinPng(flat(w, h));
      expect(r.ok, `${w}x${h}`).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/tamaño/);
    }
  });

  it('rechaza lo que no es un PNG', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const gif = new Uint8Array(Buffer.from('GIF89a\x80\x00\x80\x00\x00\x00\x00;', 'latin1'));
    for (const bad of [jpeg, gif, new Uint8Array(500).fill(7), new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])]) {
      const r = validateSkinPng(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/PNG|cabecera/);
    }
    for (const bad of ['texto', 42, null, undefined, { length: 10 }, [137, 80, 78, 71]]) expect(validateSkinPng(bad).ok).toBe(false);
  });

  it('rechaza archivos vacíos y de más de 48 KB', () => {
    expect(validateSkinPng(new Uint8Array(0)).ok).toBe(false);
    const heavy = noise(128);
    expect(heavy.length).toBeGreaterThan(SKIN.maxBytes);
    const r = validateSkinPng(heavy);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/pesa|KB/);
    // exactly at the limit is fine, one byte over is not (the check happens before any decoding)
    expect(validateSkinPng(new Uint8Array(SKIN.maxBytes + 1)).ok).toBe(false);
  });

  it('rechaza PNG truncados, con CRC roto o con datos de imagen que no cuadran', () => {
    const good = flat(128, 128);
    expect(validateSkinPng(good.subarray(0, good.length - 20)).ok).toBe(false); // no IEND
    const flipped = Buffer.from(good);
    flipped[flipped.length - 20] ^= 0xff; // inside IDAT / its CRC
    expect(validateSkinPng(flipped).ok).toBe(false);
    // right header, but fewer scanlines than height * (1 + 4*width)
    const short = pngFromRaw(128, 128, new Uint8Array((128 * 4 + 1) * 100));
    const r1 = validateSkinPng(short);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toMatch(/tamaño|datos/);
    // more data than the header allows
    expect(validateSkinPng(pngFromRaw(128, 128, new Uint8Array((128 * 4 + 1) * 130))).ok).toBe(false);
    // not a zlib stream at all inside a well-formed chunk
    const garbage = Buffer.from(good);
    const idatPos = garbage.indexOf('IDAT');
    garbage.fill(0x55, idatPos + 4, idatPos + 12);
    expect(validateSkinPng(garbage).ok).toBe(false);
  });

  it('rechaza filtros de línea inválidos y bombas de descompresión', () => {
    const raw = new Uint8Array((128 * 4 + 1) * 128);
    raw[0] = 9; // filter type must be 0-4
    expect(validateSkinPng(pngFromRaw(128, 128, raw)).ok).toBe(false);
    // 32 MB of zeros deflate to ~32 KB: under the file limit but expands far past what the header allows
    const bomb = pngFromRaw(128, 128, new Uint8Array(32 * 1024 * 1024));
    expect(bomb.length).toBeLessThanOrEqual(SKIN.maxBytes);
    expect(validateSkinPng(bomb).ok).toBe(false);
  });

  it('acepta otros tipos de color válidos (RGB, gris) pero no combinaciones imposibles', () => {
    const rgb = pngFromRaw(128, 128, new Uint8Array((128 * 3 + 1) * 128), { colorType: 2 });
    expect(validateSkinPng(rgb).ok).toBe(true);
    const gray = pngFromRaw(128, 128, new Uint8Array((128 + 1) * 128), { colorType: 0 });
    expect(validateSkinPng(gray).ok).toBe(true);
    // colour type 2 with 4 bits per sample does not exist
    expect(validateSkinPng(pngFromRaw(128, 128, new Uint8Array((128 * 3 + 1) * 128), { colorType: 2, bitDepth: 4 })).ok).toBe(false);
    // palette image without PLTE chunk
    expect(validateSkinPng(pngFromRaw(128, 128, new Uint8Array((128 + 1) * 128), { colorType: 3 })).ok).toBe(false);
  });

  it('calcula bien el tamaño de las imágenes entrelazadas (Adam7)', () => {
    const passes = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
    let n = 0;
    for (const [xs, ys, dx, dy] of passes) {
      const w = Math.ceil((128 - xs) / dx), h = Math.ceil((128 - ys) / dy);
      n += h * (1 + w * 4);
    }
    expect(validateSkinPng(pngFromRaw(128, 128, new Uint8Array(n), { interlace: 1 })).ok).toBe(true);
    expect(validateSkinPng(pngFromRaw(128, 128, new Uint8Array(n + 1), { interlace: 1 })).ok).toBe(false);
    // the same bytes read as non-interlaced do not fit
    expect(validateSkinPng(pngFromRaw(128, 128, new Uint8Array(n))).ok).toBe(false);
  });
});
