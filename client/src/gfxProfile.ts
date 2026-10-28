import type { ParticleLevel } from './settings';

export type QualityPreset = 'low' | 'medium' | 'high' | 'custom';

/** Derived rendering options applied from a quality preset or custom toggles. */
export interface GfxProfile {
  pixelRatioCap: number;
  antialias: boolean;
  shadows: boolean;
  particles: ParticleLevel;
  mapLambert: boolean;
  textureSize: 128 | 256;
  maxAnisotropy: number;
  pointLights: boolean;
  /** Multipliers applied to the map theme fog distances. */
  fogNearMul: number;
  fogFarMul: number;
  toneMappingAces: boolean;
  /** Scales tracer / blast / flash pool usage (1 = full). */
  effectPoolScale: number;
  particlePointSize: number;
  viewModelExtraLights: boolean;
  characterLambert: boolean;
  capFps60: boolean;
}

export const PRESET_LOW: GfxProfile = {
  pixelRatioCap: 1,
  antialias: false,
  shadows: false,
  particles: 'low',
  mapLambert: true,
  textureSize: 128,
  maxAnisotropy: 1,
  pointLights: false,
  fogNearMul: 0.55,
  fogFarMul: 0.65,
  toneMappingAces: false,
  effectPoolScale: 0.45,
  particlePointSize: 0.11,
  viewModelExtraLights: false,
  characterLambert: true,
  capFps60: true,
};

export const PRESET_MEDIUM: GfxProfile = {
  pixelRatioCap: 1.25,
  antialias: true,
  shadows: false,
  particles: 'medium',
  mapLambert: false,
  textureSize: 256,
  maxAnisotropy: 4,
  pointLights: true,
  fogNearMul: 1,
  fogFarMul: 1,
  toneMappingAces: true,
  effectPoolScale: 1,
  particlePointSize: 0.09,
  viewModelExtraLights: true,
  characterLambert: false,
  capFps60: false,
};

export const PRESET_HIGH: GfxProfile = {
  pixelRatioCap: 1.5,
  antialias: true,
  shadows: true,
  particles: 'high',
  mapLambert: false,
  textureSize: 256,
  maxAnisotropy: 8,
  pointLights: true,
  fogNearMul: 1,
  fogFarMul: 1.15,
  toneMappingAces: true,
  effectPoolScale: 1,
  particlePointSize: 0.09,
  viewModelExtraLights: true,
  characterLambert: false,
  capFps60: false,
};

export const presetProfile = (p: Exclude<QualityPreset, 'custom'>): GfxProfile =>
  p === 'low' ? { ...PRESET_LOW } : p === 'medium' ? { ...PRESET_MEDIUM } : { ...PRESET_HIGH };

/** Builds the active profile from preset + stored overrides (custom uses stored fields). */
export const resolveGfxProfile = (s: {
  qualityPreset: QualityPreset;
  pixelRatioCap: number;
  shadows: boolean;
  particles: ParticleLevel;
  antialias: boolean;
  capFps60: boolean;
}): GfxProfile => {
  if (s.qualityPreset !== 'custom') return presetProfile(s.qualityPreset);
  const base = { ...PRESET_MEDIUM };
  base.pixelRatioCap = s.pixelRatioCap;
  base.shadows = s.shadows;
  base.particles = s.particles;
  base.antialias = s.antialias;
  base.capFps60 = s.capFps60;
  base.mapLambert = !s.shadows && s.particles === 'low';
  base.textureSize = s.pixelRatioCap <= 1 ? 128 : 256;
  base.maxAnisotropy = s.shadows ? 8 : 4;
  base.pointLights = s.particles !== 'low';
  base.toneMappingAces = s.shadows || s.pixelRatioCap > 1;
  base.characterLambert = base.mapLambert;
  base.viewModelExtraLights = !base.mapLambert;
  return base;
};

export const applyPresetToSettings = (
  preset: Exclude<QualityPreset, 'custom'>,
): {
  qualityPreset: QualityPreset;
  pixelRatioCap: number;
  shadows: boolean;
  particles: import('./settings').ParticleLevel;
  antialias: boolean;
  capFps60: boolean;
} => {
  const g = presetProfile(preset);
  return {
    qualityPreset: preset,
    pixelRatioCap: g.pixelRatioCap,
    shadows: g.shadows,
    particles: g.particles,
    antialias: g.antialias,
    capFps60: g.capFps60,
  };
};
