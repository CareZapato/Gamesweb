/**
 * Skin file limits and a minimal PNG header reader, shared by client (pre-check before sending) and
 * server (authoritative check). The full structural validation (CRC, zlib stream) lives in the
 * server because it needs node:zlib; see `server/src/skins.ts`. Format documented in docs/SKINS.md.
 */
export const SKIN = {
  /** Largest accepted file. A 128x128 or 256x256 PNG of a flat-coloured skin is well under 10 KB. */
  maxBytes: 48 * 1024,
  /** Accepted square sizes. 256 uses the 128 layout scaled x2. */
  sizes: [128, 256] as readonly number[],
  /** Size the layout in `client/src/render/skinLayout.ts` is defined in. */
  baseSize: 128,
  /** Minimum time between two skin changes of the same player. */
  minIntervalMs: 1000,
} as const;

export const PNG_SIGNATURE: readonly number[] = [137, 80, 78, 71, 13, 10, 26, 10];

export interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  compression: number;
  filter: number;
  interlace: number;
}

/** Colour type -> allowed bit depths (PNG spec, table 11.1). */
export const PNG_VALID_DEPTHS: Readonly<Record<number, readonly number[]>> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

export const hasPngSignature = (b: Uint8Array): boolean => b.length >= 8 && PNG_SIGNATURE.every((v, i) => b[i] === v);

/** Reads the IHDR chunk. Returns null if the data does not start with a well-formed PNG header. */
export const readPngHeader = (b: Uint8Array): PngHeader | null => {
  if (!hasPngSignature(b) || b.length < 33) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint32(8) !== 13) return null;
  if (dv.getUint32(12) !== 0x49484452) return null; // 'IHDR'
  return {
    width: dv.getUint32(16),
    height: dv.getUint32(20),
    bitDepth: b[24],
    colorType: b[25],
    compression: b[26],
    filter: b[27],
    interlace: b[28],
  };
};

export type SkinSizeCheck = { ok: true; size: number } | { ok: false; reason: string };

/** Cheap checks usable anywhere (no decoding): weight, signature, header, exact size. */
export const checkSkinHeader = (b: Uint8Array): SkinSizeCheck => {
  if (b.length === 0) return { ok: false, reason: 'el archivo está vacío' };
  if (b.length > SKIN.maxBytes) return { ok: false, reason: `pesa ${(b.length / 1024).toFixed(1)} KB y el máximo es ${SKIN.maxBytes / 1024} KB` };
  if (!hasPngSignature(b)) return { ok: false, reason: 'no es un PNG' };
  const h = readPngHeader(b);
  if (!h) return { ok: false, reason: 'cabecera PNG dañada' };
  if (h.width !== h.height || !SKIN.sizes.includes(h.width)) {
    return { ok: false, reason: `tamaño ${h.width}×${h.height}: debe ser exactamente ${SKIN.sizes.map((s) => `${s}×${s}`).join(' o ')}` };
  }
  const depths = PNG_VALID_DEPTHS[h.colorType];
  if (!depths || !depths.includes(h.bitDepth) || h.compression !== 0 || h.filter !== 0 || h.interlace > 1) {
    return { ok: false, reason: 'cabecera PNG no válida' };
  }
  return { ok: true, size: h.width };
};
