import { type FaceName, faceRects, type NetBox, SKIN_BASE_SIZE } from './skinLayout';

/**
 * Geometry data (no Three.js) of a box whose six faces map to the skin layout. Every face is built
 * from four explicit corners listed as seen from OUTSIDE the box: top-left, top-right, bottom-left,
 * bottom-right of the picture that must appear there. That makes the texture orientation explicit
 * (nothing is inherited from BoxGeometry), and it is unit tested (normals, winding, UV rects).
 *
 * Axes: +X is the character's right, +Y up, -Z forward.
 */
export interface BoxData {
  positions: Float32Array;
  normals: Float32Array;
  /** UV in texture space for a `DataTexture` with flipY = false: v = pixelY / size (row 0 = top). */
  uvs: Float32Array;
  indices: Uint16Array;
}

type V3 = [number, number, number];

/** Corner order: TL, TR, BL, BR as seen from outside, plus the outward normal. */
const faceCorners = (hx: number, hy: number, hz: number): Record<FaceName, { c: [V3, V3, V3, V3]; n: V3 }> => ({
  front: { c: [[hx, hy, -hz], [-hx, hy, -hz], [hx, -hy, -hz], [-hx, -hy, -hz]], n: [0, 0, -1] },
  back: { c: [[-hx, hy, hz], [hx, hy, hz], [-hx, -hy, hz], [hx, -hy, hz]], n: [0, 0, 1] },
  right: { c: [[hx, hy, hz], [hx, hy, -hz], [hx, -hy, hz], [hx, -hy, -hz]], n: [1, 0, 0] },
  left: { c: [[-hx, hy, -hz], [-hx, hy, hz], [-hx, -hy, -hz], [-hx, -hy, hz]], n: [-1, 0, 0] },
  // the picture's bottom edge touches the front edge of the top face
  top: { c: [[hx, hy, hz], [-hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], n: [0, 1, 0] },
  // the picture's top edge touches the front edge of the bottom face
  bottom: { c: [[hx, -hy, -hz], [-hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], n: [0, -1, 0] },
});

const FACE_ORDER: readonly FaceName[] = ['right', 'left', 'top', 'bottom', 'back', 'front'];

/** Half a texel (as a fraction of a texel) pulled in from each face edge to avoid bleeding. */
const INSET = 0.02;

/**
 * @param sx,sy,sz box size in metres (X, Y, Z)
 * @param part     which net to read the UV rectangles from (always in 128 px units; UVs are
 *                 size independent because the 256 px layout is the same one scaled x2)
 */
export const buildBoxData = (sx: number, sy: number, sz: number, part: NetBox): BoxData => {
  const fc = faceCorners(sx / 2, sy / 2, sz / 2);
  const rects = faceRects(part);
  const positions = new Float32Array(24 * 3);
  const normals = new Float32Array(24 * 3);
  const uvs = new Float32Array(24 * 2);
  const indices = new Uint16Array(36);
  FACE_ORDER.forEach((face, f) => {
    const { c, n } = fc[face];
    const r = rects[face];
    const u0 = (r.x + INSET) / SKIN_BASE_SIZE;
    const u1 = (r.x + r.w - INSET) / SKIN_BASE_SIZE;
    const v0 = (r.y + INSET) / SKIN_BASE_SIZE;
    const v1 = (r.y + r.h - INSET) / SKIN_BASE_SIZE;
    const uv: [number, number][] = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
    for (let i = 0; i < 4; i++) {
      const o = f * 4 + i;
      positions.set(c[i], o * 3);
      normals.set(n, o * 3);
      uvs.set(uv[i], o * 2);
    }
    const b = f * 4;
    // TL, BL, TR / TR, BL, BR: counter-clockwise seen from outside
    indices.set([b, b + 2, b + 1, b + 1, b + 2, b + 3], f * 6);
  });
  return { positions, normals, uvs, indices };
};
