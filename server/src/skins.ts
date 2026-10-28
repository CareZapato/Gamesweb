import { inflateSync } from 'node:zlib';
import { checkSkinHeader, readPngHeader } from '@arena/shared';

export type SkinValidation = { ok: true; png: Uint8Array; size: number } | { ok: false; reason: string };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (b: Uint8Array, start: number, end: number): number => {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Adam7 passes: [xStart, yStart, xStep, yStep]. */
const ADAM7: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

/** Sizes (rows x bytes per row, filter byte included) of each image pass of the decoded stream. */
const passes = (width: number, height: number, bitsPerPixel: number, interlaced: boolean): { rows: number; rowBytes: number }[] => {
  const dims = interlaced
    ? ADAM7.map(([xs, ys, dx, dy]) => ({ w: width > xs ? Math.ceil((width - xs) / dx) : 0, h: height > ys ? Math.ceil((height - ys) / dy) : 0 }))
    : [{ w: width, h: height }];
  return dims.filter((p) => p.w > 0 && p.h > 0).map((p) => ({ rows: p.h, rowBytes: 1 + Math.ceil((p.w * bitsPerPixel) / 8) }));
};

const toBytes = (raw: unknown): Uint8Array | null => {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  return null;
};

/**
 * Authoritative validation of a skin sent by a client. The client is not trusted: the file must be
 * a structurally valid PNG (signature, chunk CRCs, IHDR, IDAT zlib stream of exactly the expected
 * length with valid scanline filters, IEND) of exactly 128x128 or 256x256 px and at most 48 KB.
 * Nothing is decoded to pixels and the inflate output is capped, so it cannot be used for
 * decompression bombs. Returns a private copy of the bytes.
 */
export const validateSkinPng = (raw: unknown): SkinValidation => {
  const b = toBytes(raw);
  if (!b) return { ok: false, reason: 'formato de datos incorrecto' };
  const head = checkSkinHeader(b);
  if (!head.ok) return head;
  const h = readPngHeader(b)!;
  const bits = CHANNELS[h.colorType] * h.bitDepth;
  const layout = passes(h.width, h.height, bits, h.interlace === 1);
  const expected = layout.reduce((n, p) => n + p.rows * p.rowBytes, 0);

  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const idat: Uint8Array[] = [];
  let pos = 8;
  let sawIend = false;
  let sawPlte = false;
  let first = true;
  while (pos + 12 <= b.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]);
    const end = pos + 12 + len;
    if (end > b.length) return { ok: false, reason: 'PNG truncado' };
    if (crc32(b, pos + 4, pos + 8 + len) !== dv.getUint32(pos + 8 + len)) return { ok: false, reason: 'PNG dañado (CRC)' };
    if (first && type !== 'IHDR') return { ok: false, reason: 'PNG sin cabecera' };
    first = false;
    if (type === 'IDAT') idat.push(b.subarray(pos + 8, pos + 8 + len));
    else if (type === 'PLTE') sawPlte = true;
    else if (type === 'IEND') {
      sawIend = true;
      break;
    }
    pos = end;
  }
  if (!sawIend) return { ok: false, reason: 'PNG sin final (IEND)' };
  if (h.colorType === 3 && !sawPlte) return { ok: false, reason: 'PNG indexado sin paleta' };
  if (idat.length === 0) return { ok: false, reason: 'PNG sin datos de imagen' };

  let data: Buffer;
  try {
    data = inflateSync(Buffer.concat(idat), { maxOutputLength: expected + 1 });
  } catch {
    return { ok: false, reason: 'los datos de imagen no se pueden decodificar' };
  }
  if (data.length !== expected) return { ok: false, reason: 'los datos de imagen no coinciden con el tamaño' };
  let off = 0;
  for (const p of layout) {
    for (let r = 0; r < p.rows; r++, off += p.rowBytes) if (data[off] > 4) return { ok: false, reason: 'filtro de línea inválido' };
  }
  return { ok: true, png: new Uint8Array(b), size: head.size };
};
