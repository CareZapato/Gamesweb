import '../style.css';
import './deadhold.css';
import * as THREE from 'three';
import {
  deadholdCanSelectWeapon,
  deadholdResolveInputWeapon,
  getMap,
  type GameOverMsg,
  type LobbyState,
  ROOM,
  SKIN,
  WEAPON_COUNT,
  type ShopMsg,
} from '@arena/shared';
import { Sfx } from '../audio/Sfx';
import { Game } from '../game/Game';
import { GamePointer } from '../game/GamePointer';
import { InputController } from '../game/InputController';
import { applyPresetToSettings, resolveGfxProfile } from '../gfxProfile';
import { applyRendererQuality } from '../render/rendererQuality';
import { decodeSkinPng, SkinStore } from '../render/skinTexture';
import { loadSettings, type ParticleLevel, type QualityPreset, saveSettings } from '../settings';
import { Hud } from '../ui/Hud';
import { preloadWeaponIcons } from '../ui/weaponIcons';
import { loadPresetSkinPng } from '../skins/loadPresetSkin';
import { PLAYER_SKIN_PRESETS, presetById, type PlayerSkinPreset } from '../skins/playerPresets';
import { DeadholdHud } from './DeadholdHud';
import type { Net } from '../net/Net';
import { DeadholdNet, defaultServerUrl, describeJoinError } from './Net';
import { $, renderGameOver, renderLobby, showScreen, toast } from './screens';

const settings = loadSettings();
const canvas = $<HTMLCanvasElement>('view');
const bootProfile = resolveGfxProfile(settings);
const rendererAntialiasAtBoot = bootProfile.antialias;

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: bootProfile.antialias, powerPreference: 'high-performance' });
} catch (err) {
  document.body.innerHTML = `<p style="color:#fff;padding:2em;font-family:sans-serif">Tu navegador no pudo crear un contexto WebGL: ${String(err)}</p>`;
  throw err;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
applyRendererQuality(renderer, bootProfile);
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const sfx = new Sfx();
sfx.setVolume(settings.volume);
const hud = new Hud();
const dhHud = new DeadholdHud();
void preloadWeaponIcons();
Hud.applyHudScale(settings.hudScale);
Hud.applyCrosshair(settings.crosshairStyle, settings.crosshairColor, settings.crosshairSize);
const appRoot = $<HTMLElement>('app');
const input = new InputController(canvas, (locked) => onLockChange(locked), () => undefined);
input.sensitivity = settings.sensitivity;
input.invertY = settings.invertY;

let shopOverlayOpen = false;
let hasShotgun = false;
let lastShopMsg: ShopMsg | null = null;

const syncDeadholdWeaponRules = () => {
  input.canSelectWeapon = (w) => deadholdCanSelectWeapon(w, hasShotgun);
  if (game && input.desiredWeapon !== undefined) {
    const snap = game.latestSnapshot?.();
    const me = snap?.me;
    const cur = me?.weapon ?? input.desiredWeapon;
    input.desiredWeapon = deadholdResolveInputWeapon(input.desiredWeapon, cur, hasShotgun);
  }
};

const shopPurchaseApplied = (prev: ShopMsg | null, next: ShopMsg): boolean => {
  if (!prev || prev.wave !== next.wave) return false;
  if (next.scrap < prev.scrap) return true;
  for (const k of Object.keys(next.owned) as (keyof typeof next.owned)[]) {
    if ((next.owned[k] ?? 0) > (prev.owned[k] ?? 0)) return true;
  }
  return false;
};
const syncFullscreenButtons = () => {
  const fs = document.fullscreenElement === appRoot;
  $('btn-fs-enter').classList.toggle('hidden', fs);
  $('btn-fs-exit').classList.toggle('hidden', !fs);
  $<HTMLButtonElement>('btn-fullscreen').textContent = fs ? '⛶' : '⛶';
  $<HTMLButtonElement>('btn-fullscreen').title = fs ? 'Salir de pantalla completa' : 'Pantalla completa';
};

const gamePointer = new GamePointer(canvas, appRoot, (mode) => {
  if (mode === 'game') hud.clickToPlay(false);
  else if (game && !shopOverlayOpen) hud.clickToPlay(true);
  syncFullscreenButtons();
});
syncFullscreenButtons();

const skins = new SkinStore();
const assetBase = import.meta.env.BASE_URL;
void skins.preloadDefaults(assetBase);
void skins.preloadZombieSkins(assetBase);
let mySkin: Uint8Array | null = null;
let mySkinRoom = '';

let myId = -1;
let lobby: LobbyState | null = null;
let game: Game | null = null;
let gameOver: GameOverMsg | null = null;
let busy = false;

const net = new DeadholdNet(defaultServerUrl(), {
  welcome(m) {
    myId = m.playerId;
    if (mySkin && mySkinRoom !== m.code) {
      mySkinRoom = m.code;
      net.sendSkin(mySkin);
    } else if (!mySkin && settings.skinPresetId) void tryApplySavedPreset();
    history.replaceState(null, '', `${location.pathname}${location.search.replace(/([?&])room=[^&]*&?/, '$1').replace(/[?&]$/, '')}#${m.code}`);
  },
  lobby(m) {
    lobby = m;
    if (m.phase === 'lobby' && !game) {
      gameOver = null;
      showScreen('lobby');
      renderSkinPresets();
    }
    if (m.phase === 'results' && gameOver) renderGameOver(gameOver, myId, m.hostId === myId);
    renderLobby(m, myId);
  },
  matchStart(m) {
    stopGame();
    gameOver = null;
    myId = m.playerId;
    showScreen('none');
    $('pause').classList.add('hidden');
    setShopOverlay(false);
    gamePointer.release();
    dhHud.reset();
    dhHud.showInMatch();
    hasShotgun = false;
    lastShopMsg = null;
    syncDeadholdWeaponRules();
    game = new Game({
      renderer,
      net: net as unknown as Net,
      hud,
      sfx,
      settings,
      input,
      start: m,
      skins,
      resolveInputWeapon: (requested, current) => deadholdResolveInputWeapon(requested, current, hasShotgun),
      weaponSlotsOwned: () =>
        Array.from({ length: WEAPON_COUNT }, (_, i) => deadholdCanSelectWeapon(i, hasShotgun)),
    });
    input.attach();
    game.start();
    const mapName = getMap(m.settings.mapId)?.name ?? 'Holdout';
    hud.center(`${mapName} · Supervivencia por oleadas`, 3500);
    hud.hideFlags();
  },
  snapshot: (m) => game?.onSnapshot(m),
  events: (m) => game?.onEvents(m),
  scoreboard: (m) => game?.onScoreboard(m),
  matchEnd() {
    /* Deadhold usa dhOver */
  },
  notice: (m) => toast(m.text, m.level),
  skin(m) {
    skins.set(m.id, m.png ? new Uint8Array(m.png) : null);
    if (m.id === myId) showSkinPreview(m.png ? new Uint8Array(m.png) : null);
  },
  wave(m) {
    dhHud.updateWave(m);
    if (m.phase === 'shop') {
      if (!dhHud.isOverlayDismissed()) setShopOverlay(true);
    } else if (game && m.phase === 'combat') {
      setShopOverlay(false);
    }
  },
  shop(m) {
    hasShotgun = (m.owned.unlockShotgun ?? 0) > 0;
    syncDeadholdWeaponRules();
    const bought = shopPurchaseApplied(lastShopMsg, m);
    lastShopMsg = m;
    dhHud.renderShop(m);
    if (bought) dhHud.dismissOverlay();
    setShopOverlay(!dhHud.isOverlayDismissed());
  },
  level(m) {
    dhHud.setLevel(m.level);
    hud.center(`¡Oleada superada! +${m.clearBonus} scrap`, 2800);
  },
  scrap(m) {
    dhHud.setScrap(m.scrap);
    if (m.delta > 0 && m.reason === 'kill') hud.sub(`+${m.delta} scrap`, 900);
  },
  over(m) {
    gameOver = m;
    stopGame();
    renderGameOver(m, myId, lobby?.hostId === myId);
    showScreen('results');
  },
  dropped() {
    $('reconnecting').classList.remove('hidden');
  },
  reconnected() {
    $('reconnecting').classList.add('hidden');
    toast('Reconectado');
  },
  left(reason) {
    $('reconnecting').classList.add('hidden');
    backToMenu(reason);
  },
});

/** Tienda: suelta pointer lock y bloquea FPS; combate: desbloquea (listeners nunca se quitan en partida). */
const blurFocus = () => (document.activeElement as HTMLElement | null)?.blur?.();

const syncAimFromServer = () => {
  if (!game) return;
  const snap = game.latestSnapshot?.();
  const me = snap?.p.find((p) => p[0] === myId);
  if (me) {
    input.yaw = me[4] / 1000;
    input.pitch = me[5] / 1000;
  }
};

const setShopOverlay = (open: boolean) => {
  shopOverlayOpen = open;
  input.uiBlocked = open;
  if (open) {
    gamePointer.release();
    blurFocus();
    document.body.classList.add('dh-shop-open');
  } else {
    document.body.classList.remove('dh-shop-open');
    blurFocus();
    syncAimFromServer();
    syncDeadholdWeaponRules();
  }
};

/** Tras elegir mejora / listo: mismo gesto del clic → pointer lock (mira interna). */
const resumeGamePointer = () => {
  if (!game || shopOverlayOpen) return;
  syncAimFromServer();
  gamePointer.capture();
};

dhHud.bindShop({
  buy: (id) => net.buyUpgrade(id),
  ready: () => net.shopReady(),
  onDismissOverlay: () => {
    setShopOverlay(false);
    resumeGamePointer();
  },
});

function stopGame() {
  if (!game) return;
  game.dispose();
  game = null;
  input.uiBlocked = false;
  shopOverlayOpen = false;
  hasShotgun = false;
  lastShopMsg = null;
  input.canSelectWeapon = () => true;
  gamePointer.release();
  input.detach();
  document.body.classList.remove('dh-shop-open');
  $('pause').classList.add('hidden');
  dhHud.hideShop();
}

function backToMenu(reason = '') {
  void gamePointer.exitFullscreen();
  stopGame();
  lobby = null;
  gameOver = null;
  myId = -1;
  mySkinRoom = '';
  skins.clear();
  dhHud.reset();
  showSkinPreview(null);
  history.replaceState(null, '', location.pathname + location.search);
  showScreen('menu');
  $('menu-status').textContent = reason;
}

function onLockChange(locked: boolean) {
  if (!game) return;
  if (!shopOverlayOpen) {
    $('pause').classList.toggle('hidden', locked);
  } else {
    $('pause').classList.add('hidden');
  }
  if (locked) hud.pinScores(false);
}

const nameInput = $<HTMLInputElement>('in-name');
const codeInput = $<HTMLInputElement>('in-code');
const serverInput = $<HTMLInputElement>('in-server');
nameInput.value = settings.name;
nameInput.maxLength = ROOM.nameMaxLength;
serverInput.value = net.serverUrl;
const initialCode = new URLSearchParams(location.search).get('room') ?? location.hash.slice(1);
if (initialCode) codeInput.value = initialCode.toUpperCase().slice(0, ROOM.codeLength);

const currentName = () => {
  const n = nameInput.value.trim().slice(0, ROOM.nameMaxLength);
  settings.name = n;
  saveSettings(settings);
  return n || `Superviviente${Math.floor(Math.random() * 900 + 100)}`;
};

const withBusy = async (label: string, fn: () => Promise<void>) => {
  if (busy) return;
  busy = true;
  sfx.unlock();
  const status = $('menu-status');
  status.textContent = label;
  for (const id of ['btn-create', 'btn-join']) ($(id) as HTMLButtonElement).disabled = true;
  try {
    if (serverInput.value.trim() && serverInput.value.trim() !== net.serverUrl) net.setServer(serverInput.value.trim());
    await fn();
    status.textContent = '';
  } catch (err) {
    status.textContent = describeJoinError(err);
  } finally {
    busy = false;
    for (const id of ['btn-create', 'btn-join']) ($(id) as HTMLButtonElement).disabled = false;
  }
};

$('btn-create').addEventListener('click', () => withBusy('Creando sala…', () => net.create(currentName())));
const join = () => {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== ROOM.codeLength) {
    $('menu-status').textContent = `El código tiene ${ROOM.codeLength} caracteres.`;
    return;
  }
  void withBusy('Entrando…', () => net.join(code, currentName()));
};
$('btn-join').addEventListener('click', join);
codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
});
codeInput.addEventListener('keydown', (e) => e.key === 'Enter' && join());
nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && (codeInput.value ? join() : $('btn-create').click()));

$('btn-copy').addEventListener('click', async () => {
  const code = lobby?.code ?? '';
  const link = `${location.origin}${location.pathname}?room=${code}`;
  try {
    await navigator.clipboard.writeText(code);
    toast(`Código ${code} copiado. Enlace: ${link}`);
  } catch {
    window.prompt('Copia el código de sala:', code);
  }
});
$('btn-leave').addEventListener('click', async () => {
  await net.leave();
  backToMenu('');
});
$('btn-start').addEventListener('click', () => {
  sfx.unlock();
  net.start();
});

const skinInput = $<HTMLInputElement>('in-skin');
const skinPreview = $<HTMLImageElement>('skin-preview');
let skinPreviewUrl = '';
function showSkinPreview(png: Uint8Array | null) {
  if (skinPreviewUrl) URL.revokeObjectURL(skinPreviewUrl);
  skinPreviewUrl = png ? URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' })) : '';
  skinPreview.src = skinPreviewUrl;
  skinPreview.classList.toggle('hidden', !png);
}

const setSkinStatus = (text: string) => {
  $('skin-status').textContent = text;
};

const applyPlayerSkinBytes = (png: Uint8Array | null, status: string) => {
  mySkin = png;
  mySkinRoom = lobby?.code ?? '';
  net.sendSkin(png);
  showSkinPreview(png);
  setSkinStatus(status);
};

const renderSkinPresets = () => {
  const box = $('skin-presets');
  box.innerHTML = '';
  for (const p of PLAYER_SKIN_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `skin-preset${settings.skinPresetId === p.id ? ' sel' : ''}`;
    b.textContent = p.label;
    b.title = p.description;
    b.onclick = () => void applySkinPreset(p);
    box.appendChild(b);
  }
};

const applySkinPreset = async (p: PlayerSkinPreset) => {
  try {
    const bytes = await loadPresetSkinPng(p, assetBase);
    settings.skinPresetId = p.id;
    saveSettings(settings);
    applyPlayerSkinBytes(bytes, `${p.label} · modelo predefinido`);
    renderSkinPresets();
  } catch (err) {
    toast(String((err as Error).message), 'warn');
  }
};

const tryApplySavedPreset = async () => {
  const p = settings.skinPresetId ? presetById(settings.skinPresetId) : undefined;
  if (!p) return;
  try {
    const bytes = await loadPresetSkinPng(p, assetBase);
    applyPlayerSkinBytes(bytes, `${p.label} · modelo predefinido`);
  } catch {
    settings.skinPresetId = '';
    saveSettings(settings);
  }
};
$('btn-skin').addEventListener('click', () => skinInput.click());
skinInput.addEventListener('change', async () => {
  const file = skinInput.files?.[0];
  skinInput.value = '';
  if (!file) return;
  if (file.size > SKIN.maxBytes) return toast(`Skin rechazada: máx. ${SKIN.maxBytes / 1024} KB.`, 'warn');
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    await decodeSkinPng(bytes);
  } catch (err) {
    return toast(`Skin rechazada: ${(err as Error).message}.`, 'warn');
  }
  settings.skinPresetId = '';
  saveSettings(settings);
  applyPlayerSkinBytes(bytes, 'PNG personalizado activo.');
  renderSkinPresets();
});
$('btn-skin-clear').addEventListener('click', () => {
  settings.skinPresetId = '';
  saveSettings(settings);
  applyPlayerSkinBytes(null, 'Skin por defecto del juego.');
  renderSkinPresets();
});

$('btn-results-leave').addEventListener('click', async () => {
  await net.leave();
  backToMenu('');
});
$('btn-rematch').addEventListener('click', () => net.rematch());
$('btn-to-lobby').addEventListener('click', () => net.toLobby());

canvas.addEventListener('click', () => {
  if (!game || shopOverlayOpen) return;
  sfx.unlock();
  resumeGamePointer();
});
$('btn-resume').addEventListener('click', () => {
  if (shopOverlayOpen) return;
  sfx.unlock();
  resumeGamePointer();
});
$('btn-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement === appRoot) void gamePointer.exitFullscreen();
  else void gamePointer.enterFullscreen().then(() => {
    if (game && !shopOverlayOpen) resumeGamePointer();
  });
});
$('btn-fs-enter').addEventListener('click', () => {
  void gamePointer.enterFullscreen().then(() => {
    if (game && !shopOverlayOpen) resumeGamePointer();
  });
});
$('btn-fs-exit').addEventListener('click', () => void gamePointer.exitFullscreen());
$('btn-scores').addEventListener('click', () => hud.pinScores(!hud.scoresArePinned));
$('btn-quit-match').addEventListener('click', async () => {
  await net.leave();
  backToMenu('');
});

const bindRange = (id: string, out: string, get: () => number, set: (v: number) => void, fmt: (v: number) => string) => {
  const el = $<HTMLInputElement>(id);
  el.value = String(get());
  $(out).textContent = fmt(get());
  el.addEventListener('input', () => {
    set(Number(el.value));
    $(out).textContent = fmt(Number(el.value));
    applySettings();
  });
};
const bindCheck = (id: string, get: () => boolean, set: (v: boolean) => void) => {
  const el = $<HTMLInputElement>(id);
  el.checked = get();
  el.addEventListener('change', () => {
    set(el.checked);
    applySettings();
  });
};
const bindSelect = (id: string, get: () => string, set: (v: string) => void) => {
  const el = $<HTMLSelectElement>(id);
  el.value = get();
  el.addEventListener('change', () => {
    set(el.value);
    applySettings();
  });
};

const syncQualityHint = () => {
  const el = $<HTMLParagraphElement>('quality-hint');
  if (!el) return;
  const needsReload = settings.antialias !== rendererAntialiasAtBoot;
  el.textContent = needsReload
    ? 'Recarga la página (F5) para aplicar antialias.'
    : settings.qualityPreset === 'custom'
      ? 'Modo personalizado.'
      : '';
};

const syncQualityControls = () => {
  const q = $<HTMLSelectElement>('set-quality');
  if (q) q.value = settings.qualityPreset;
  $<HTMLSelectElement>('set-pr').value = String(settings.pixelRatioCap);
  ($('set-particles') as HTMLSelectElement).value = settings.particles;
  ($('set-shadows') as HTMLInputElement).checked = settings.shadows;
  const cap = $<HTMLInputElement>('set-capfps');
  if (cap) cap.checked = settings.capFps60;
  syncQualityHint();
};

function applySettings() {
  input.sensitivity = settings.sensitivity;
  input.invertY = settings.invertY;
  sfx.setVolume(settings.volume);
  applyRendererQuality(renderer, resolveGfxProfile(settings));
  Hud.applyHudScale(settings.hudScale);
  Hud.applyCrosshair(settings.crosshairStyle, settings.crosshairColor, settings.crosshairSize);
  game?.applySettings(settings);
  if (!game) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap));
  }
  syncQualityHint();
  saveSettings(settings);
}

function markCustomQuality() {
  settings.qualityPreset = 'custom';
  syncQualityControls();
}

bindRange('set-sens', 'out-sens', () => settings.sensitivity, (v) => (settings.sensitivity = v), (v) => v.toFixed(2));
bindRange('set-fov', 'out-fov', () => settings.fov, (v) => (settings.fov = v), (v) => `${v}°`);
bindRange('set-vol', 'out-vol', () => settings.volume, (v) => (settings.volume = v), (v) => `${Math.round(v * 100)}%`);
bindSelect('set-pr', () => String(settings.pixelRatioCap), (v) => {
  settings.pixelRatioCap = Number(v);
  markCustomQuality();
});
bindSelect('set-particles', () => settings.particles, (v) => {
  settings.particles = v as ParticleLevel;
  markCustomQuality();
});
bindCheck('set-shadows', () => settings.shadows, (v) => {
  settings.shadows = v;
  markCustomQuality();
});
const qSel = $<HTMLSelectElement>('set-quality');
if (qSel) {
  qSel.value = settings.qualityPreset;
  qSel.addEventListener('change', () => {
    const p = qSel.value as QualityPreset;
    if (p === 'custom') settings.qualityPreset = 'custom';
    else Object.assign(settings, applyPresetToSettings(p));
    syncQualityControls();
    applySettings();
  });
}
const capSel = $<HTMLInputElement>('set-capfps');
if (capSel) {
  capSel.checked = settings.capFps60;
  capSel.addEventListener('change', () => {
    settings.capFps60 = capSel.checked;
    markCustomQuality();
    applySettings();
  });
}
syncQualityControls();
bindCheck('set-invert', () => settings.invertY, (v) => (settings.invertY = v));
bindCheck('set-net', () => settings.showNetStats, (v) => (settings.showNetStats = v));
bindSelect('set-crosshair', () => settings.crosshairStyle, (v) => {
  settings.crosshairStyle = v as typeof settings.crosshairStyle;
});
const chColor = $<HTMLInputElement>('set-crosshair-color');
chColor.value = settings.crosshairColor;
chColor.addEventListener('input', () => {
  settings.crosshairColor = chColor.value;
  applySettings();
});
bindRange('set-crosshair-size', 'out-crosshair-size', () => settings.crosshairSize, (v) => (settings.crosshairSize = v), (v) => `${Math.round(v * 100)}%`);
bindRange('set-hud-scale', 'out-hud-scale', () => settings.hudScale, (v) => (settings.hudScale = v), (v) => `${Math.round(v * 100)}%`);

window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight, false));

if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { __deadhold: { net, skins, get game() { return game; }, get lobby() { return lobby; }, get myId() { return myId; } } });
}

showScreen('menu');
renderSkinPresets();
void net.tryResume().then((ok) => {
  if (ok) toast('Sesión recuperada');
});
window.addEventListener('beforeunload', () => {
  game?.dispose();
  gamePointer.dispose();
});
