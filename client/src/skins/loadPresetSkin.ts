import { decodeSkinPng } from '../render/skinTexture';
import type { PlayerSkinPreset } from './playerPresets';

/** Descarga una skin empaquetada y valida el PNG (layout 128/256). */
export const loadPresetSkinPng = async (preset: PlayerSkinPreset, baseUrl = import.meta.env.BASE_URL): Promise<Uint8Array> => {
  const url = `${baseUrl}${preset.path}`.replace(/([^:]\/)\/+/g, '$1');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se encontró ${preset.path} (${res.status}). Genera la textura con el prompt en docs/prompts/skins/deadhold/.`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  await decodeSkinPng(bytes);
  return bytes;
};
