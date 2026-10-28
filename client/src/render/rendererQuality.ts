import * as THREE from 'three';
import type { GfxProfile } from '../gfxProfile';

export const applyRendererQuality = (renderer: THREE.WebGLRenderer, profile: GfxProfile): void => {
  if (profile.toneMappingAces) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
  } else {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
  }
};
