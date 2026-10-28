import { WEAPON_COUNT } from '@arena/shared';

type IconManifest = {
  weapons?: Record<string, string | null>;
  flags?: Record<string, string | null>;
};

const base = () => `${import.meta.env.BASE_URL}assets/icons/`;

let manifest: IconManifest | null = null;
const defaultWeaponPath = (id: number) => `weapons/${id}.svg`;
const defaultFlagPath = (team: number) => `flags/${team}.svg`;

export const preloadWeaponIcons = async (): Promise<void> => {
  try {
    const res = await fetch(`${base()}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return;
    manifest = (await res.json()) as IconManifest;
  } catch {
    manifest = null;
  }
};

const resolvePath = (map: Record<string, string | null> | undefined, key: string, fallback: string): string => {
  const entry = map?.[key];
  if (entry === null) return '';
  return entry ?? fallback;
};

export const weaponIconUrl = (weaponId: number): string => {
  if (weaponId < 0 || weaponId >= WEAPON_COUNT) return '';
  const key = String(weaponId);
  const rel = resolvePath(manifest?.weapons, key, defaultWeaponPath(weaponId));
  if (!rel) return '';
  return `${base()}${rel}`;
};

export const flagIconUrl = (team: number): string => {
  const key = String(team);
  const rel = resolvePath(manifest?.flags, key, defaultFlagPath(team));
  if (!rel) return '';
  return `${base()}${rel}`;
};

/** Inline `<img>` for weapon silhouettes (monochrome via `currentColor` on parent + filter, or SVG as img). */
export const weaponIconHtml = (weaponId: number, className = 'wpn-icon'): string => {
  const src = weaponIconUrl(weaponId);
  if (!src) return '';
  return `<img class="${escAttr(className)}" src="${escAttr(src)}" alt="" width="28" height="14" decoding="async" />`;
};

export const flagIconHtml = (team: number, className = 'flag-icon'): string => {
  const src = flagIconUrl(team);
  if (!src) return '';
  return `<img class="${escAttr(className)}" src="${escAttr(src)}" alt="" width="16" height="16" decoding="async" />`;
};

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
