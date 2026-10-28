import { PLAYER } from '@arena/shared';
import { getPart, type PartId, SKIN_PARTS } from './skinLayout';

/**
 * Dimensions and rest-pose placement of the voxel character, in metres. Pure data (no Three.js) so
 * a test can check the visual model against the server hitboxes of `shared/src/combat.ts`:
 * the head and helmet must sit inside the head box, everything else inside the body box.
 *
 * One skin pixel is 3 cm. Heroic proportions: wide shoulders, big helmet, long legs. Total ~1.8 m.
 */
export const MPP = 0.03;

export type V3 = [number, number, number];

export const partSize = (id: PartId): V3 => {
  const p = getPart(id);
  return [p.w * MPP, p.h * MPP, p.d * MPP];
};

/** Hip height: the legs hang from here, the upper body pivots here. */
export const HIP_Y = 0.82;
export const LEG_X = 0.095;
/** Shoulder pivots relative to the hips. */
export const SHOULDER: V3 = [0.27, 0.56, 0];
/** Neck pivot relative to the hips (top of the torso). */
export const NECK_Y = 0.6;
/** Head centre above the neck pivot: lands on `PLAYER.headCenter` in world space. */
export const HEAD_UP = PLAYER.headCenter - HIP_Y - NECK_Y;

/** Placement of each part relative to its pivot (the joint that rotates it). */
export const PART_OFFSET: Record<PartId, V3> = {
  head: [0, HEAD_UP, 0],
  helmet: [0, HEAD_UP, 0],
  torso: [0, 0.3, 0],
  chest: [0, 0.4, 0],
  armL: [0, -0.3, 0],
  armR: [0, -0.3, 0],
  pauldronL: [0, 0.02, 0],
  pauldronR: [0, 0.02, 0],
  legL: [0, -(27 * MPP) / 2, 0],
  legR: [0, -(27 * MPP) / 2, 0],
};

/** Pivot position of each part relative to the character root (feet), at rest. */
export const PART_PIVOT: Record<PartId, V3> = {
  head: [0, HIP_Y + NECK_Y, 0],
  helmet: [0, HIP_Y + NECK_Y, 0],
  torso: [0, HIP_Y, 0],
  chest: [0, HIP_Y, 0],
  armL: [-SHOULDER[0], HIP_Y + SHOULDER[1], 0],
  armR: [SHOULDER[0], HIP_Y + SHOULDER[1], 0],
  pauldronL: [-SHOULDER[0], HIP_Y + SHOULDER[1], 0],
  pauldronR: [SHOULDER[0], HIP_Y + SHOULDER[1], 0],
  legL: [-LEG_X, HIP_Y, 0],
  legR: [LEG_X, HIP_Y, 0],
};

export interface RestBox {
  part: PartId;
  min: V3;
  max: V3;
}

/** Axis-aligned boxes of every part in the rest pose, in root space. */
export const restPoseBoxes = (): RestBox[] =>
  SKIN_PARTS.map(({ id }) => {
    const s = partSize(id);
    const c: V3 = [
      PART_PIVOT[id][0] + PART_OFFSET[id][0],
      PART_PIVOT[id][1] + PART_OFFSET[id][1],
      PART_PIVOT[id][2] + PART_OFFSET[id][2],
    ];
    return {
      part: id,
      min: [c[0] - s[0] / 2, c[1] - s[1] / 2, c[2] - s[2] / 2],
      max: [c[0] + s[0] / 2, c[1] + s[1] / 2, c[2] + s[2] / 2],
    };
  });
