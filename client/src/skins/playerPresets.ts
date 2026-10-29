/** Skins jugador incluidas en el repo (128×128, layout SKINS.md). */
export interface PlayerSkinPreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Ruta bajo `client/public/` */
  readonly path: string;
}

export const PLAYER_SKIN_PRESETS: readonly PlayerSkinPreset[] = [
  {
    id: 'survivor-orange',
    label: 'Soldado naranja',
    description: 'Armadura oscura, visor cian y acentos naranja (estilo Reducto).',
    path: 'assets/skins/preset_survivor_orange.png',
  },
  {
    id: 'survivor-cyan',
    label: 'Operador cian',
    description: 'Placas grises con visor y luces cian.',
    path: 'assets/skins/preset_survivor_cyan.png',
  },
  {
    id: 'survivor-steel',
    label: 'Blindaje acero',
    description: 'Gris industrial, hombreras marcadas, visor oscuro.',
    path: 'assets/skins/preset_survivor_steel.png',
  },
  {
    id: 'arena-red',
    label: 'Arena (rojo)',
    description: 'Skin clásica RealTournament equipo rojo.',
    path: 'assets/skins/default_red.png',
  },
  {
    id: 'arena-blue',
    label: 'Arena (azul)',
    description: 'Skin clásica RealTournament equipo azul.',
    path: 'assets/skins/default_blue.png',
  },
] as const;

export const presetById = (id: string): PlayerSkinPreset | undefined =>
  PLAYER_SKIN_PRESETS.find((p) => p.id === id);
