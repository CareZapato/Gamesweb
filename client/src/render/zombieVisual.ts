import {
  ENEMY_ARCHETYPES,
  type EnemyArchetypeId,
  archetypeFromIndex,
} from '@arena/shared';

/** Tinte sobre la zona de color del skin (verde/gris por arquetipo, sin PNG nuevos). */
const ZOMBIE_TINT: Record<EnemyArchetypeId, number> = {
  walker: 0x6a9e62,
  runner: 0x88c070,
  brute: 0x4d6648,
  armored: 0x728078,
  colossus: 0x3a5235,
};

/** Emisión verde apagada en reposo (Character la anula al parpadear protección). */
export const ZOMBIE_EMISSIVE = 0x0c1a0a;

export interface ZombieLook {
  scale: number;
  tint: number;
  emissive: number;
}

export const zombieLook = (archetypeIndex: number): ZombieLook => {
  const id = archetypeFromIndex(archetypeIndex) ?? 'walker';
  const a = ENEMY_ARCHETYPES[id];
  return {
    scale: a.scale,
    tint: ZOMBIE_TINT[id],
    emissive: ZOMBIE_EMISSIVE,
  };
};
