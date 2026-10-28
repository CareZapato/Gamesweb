import { type QualityPreset, applyPresetToSettings, presetProfile } from './gfxProfile';

export type ParticleLevel = 'low' | 'medium' | 'high';
export type CrosshairStyle = 'cross' | 'dot' | 'circle';
export type { QualityPreset };

export interface Settings {
  name: string;
  sensitivity: number;
  fov: number;
  volume: number;
  pixelRatioCap: number;
  shadows: boolean;
  particles: ParticleLevel;
  invertY: boolean;
  showNetStats: boolean;
  qualityPreset: QualityPreset;
  /** WebGL antialias flag (only applied when the page reloads). */
  antialias: boolean;
  capFps60: boolean;
  crosshairStyle: CrosshairStyle;
  crosshairColor: string;
  /** Visual scale of the reticle (0.5–2). */
  crosshairSize: number;
  /** HUD scale factor (0.8–1.3). */
  hudScale: number;
}

const KEY = 'realtournament-settings';
/** Key used before the game was renamed from Arena Vértice; its value is migrated once. */
const LEGACY_KEY = 'arena-vertice-settings';

const low = presetProfile('low');

const DEFAULTS: Settings = {
  name: '',
  sensitivity: 1,
  fov: 90,
  volume: 0.6,
  pixelRatioCap: low.pixelRatioCap,
  shadows: low.shadows,
  particles: low.particles,
  invertY: false,
  showNetStats: false,
  qualityPreset: 'low',
  antialias: low.antialias,
  capFps60: low.capFps60,
  crosshairStyle: 'cross',
  crosshairColor: '#dcffe6',
  crosshairSize: 1,
  hudScale: 1,
};

export const loadSettings = (): Settings => {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        localStorage.setItem(KEY, legacy);
        raw = legacy;
      }
    }
    localStorage.removeItem(LEGACY_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULTS, ...parsed };
    // first launch after this feature: no preset field → force Low defaults for graphics
    if (parsed.qualityPreset === undefined) {
      Object.assign(merged, applyPresetToSettings('low'));
    }
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
};

export const saveSettings = (s: Settings): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage may be unavailable (private mode); settings then last for the session only
  }
};

export const particleBudget = (level: ParticleLevel): number => (level === 'low' ? 0.35 : level === 'high' ? 1.5 : 1);
