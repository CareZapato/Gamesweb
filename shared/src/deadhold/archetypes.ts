/**
 * Reducto: Horda — arquetipos de enemigos. Datos puros: sin Colyseus, sin render.
 * Los valores `hp`, `damage` y `speed` son BASE (oleada 0); `waves.ts` aplica el multiplicador por oleada.
 */

export const ENEMY_ARCHETYPE_IDS = ['walker', 'runner', 'brute', 'armored', 'colossus'] as const;

export type EnemyArchetypeId = (typeof ENEMY_ARCHETYPE_IDS)[number];

export interface EnemyArchetype {
  readonly id: EnemyArchetypeId;
  /** Nombre para HUD (español). */
  readonly label: string;
  /** Primera oleada (>=) en la que puede aparecer. */
  readonly minWave: number;
  /** Escala visual del rig `Character`. */
  readonly scale: number;
  readonly hp: number;
  /** Daño melee por golpe. */
  readonly damage: number;
  /** Velocidad base en m/s (el jugador corre a 8.5). */
  readonly speed: number;
  /** Segundos entre golpes melee. */
  readonly attackInterval: number;
  /** Alcance melee en metros. */
  readonly attackRange: number;
  /** Escudo frontal inicial (absorbe como el escudo del jugador). */
  readonly shield: number;
  /** Empuje aplicado al jugador por golpe (m/s). */
  readonly knockback: number;
  /** Scrap base por baja. */
  readonly scrap: number;
  /** Peso relativo en la selección aleatoria de la composición (0 = nunca por azar). */
  readonly weight: number;
  /** Elegible como "especial garantizado" en oleadas múltiplo de 5. */
  readonly special: boolean;
}

export const ENEMY_ARCHETYPES: Readonly<Record<EnemyArchetypeId, EnemyArchetype>> = {
  walker: {
    id: 'walker',
    label: 'Caminante',
    minWave: 1,
    scale: 1.0,
    hp: 60,
    damage: 8,
    speed: 3.2,
    attackInterval: 1.1,
    attackRange: 1.4,
    shield: 0,
    knockback: 0,
    scrap: 5,
    weight: 10,
    special: false,
  },
  runner: {
    id: 'runner',
    label: 'Corredor',
    minWave: 3,
    scale: 1.0,
    hp: 40,
    damage: 7,
    speed: 5.6,
    attackInterval: 0.8,
    attackRange: 1.4,
    shield: 0,
    knockback: 0,
    scrap: 7,
    weight: 6,
    special: false,
  },
  brute: {
    id: 'brute',
    label: 'Bruto',
    minWave: 8,
    scale: 1.25,
    hp: 260,
    damage: 22,
    speed: 2.6,
    attackInterval: 1.5,
    attackRange: 1.8,
    shield: 0,
    knockback: 9,
    scrap: 18,
    weight: 3,
    special: true,
  },
  armored: {
    id: 'armored',
    label: 'Acorazado',
    minWave: 15,
    scale: 1.35,
    hp: 200,
    damage: 18,
    speed: 2.9,
    attackInterval: 1.3,
    attackRange: 1.8,
    shield: 120,
    knockback: 4,
    scrap: 26,
    weight: 2,
    special: false,
  },
  colossus: {
    id: 'colossus',
    label: 'Coloso',
    minWave: 25,
    scale: 1.5,
    hp: 1200,
    damage: 40,
    speed: 2.2,
    attackInterval: 1.8,
    attackRange: 2.2,
    shield: 0,
    knockback: 14,
    scrap: 120,
    // Solo aparece como jefe (cada 5 oleadas desde la 25), no por azar.
    weight: 0,
    special: true,
  },
};

export const getArchetype = (id: EnemyArchetypeId): EnemyArchetype => ENEMY_ARCHETYPES[id];

/** Arquetipos desbloqueados en la oleada `wave`, en orden de aparición. */
export const activeArchetypes = (wave: number): EnemyArchetype[] =>
  ENEMY_ARCHETYPE_IDS.map((id) => ENEMY_ARCHETYPES[id]).filter((a) => wave >= a.minWave);

/** Índice numérico estable (para snapshots compactos). */
export const archetypeIndex = (id: EnemyArchetypeId): number => ENEMY_ARCHETYPE_IDS.indexOf(id);

export const archetypeFromIndex = (index: number): EnemyArchetypeId | null =>
  ENEMY_ARCHETYPE_IDS[index] ?? null;
