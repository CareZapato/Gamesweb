import './style.css';
import * as THREE from 'three';
import { defaultMapFor, type GameMode, getMap, type LobbyState, type MatchResults, ROOM, SKIN } from '@arena/shared';
import { Sfx } from './audio/Sfx';
import { Game } from './game/Game';
import { InputController } from './game/InputController';
import { defaultServerUrl, describeJoinError, Net } from './net/Net';
import { applyPresetToSettings, resolveGfxProfile } from './gfxProfile';
import { applyRendererQuality } from './render/rendererQuality';
import { decodeSkinPng, SkinStore } from './render/skinTexture';
import { loadSettings, type ParticleLevel, type QualityPreset, saveSettings } from './settings';
import { Hud } from './ui/Hud';
import { $, renderLobby, renderResults, showScreen, toast } from './ui/screens';
import { preloadWeaponIcons } from './ui/weaponIcons';

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
void preloadWeaponIcons();
Hud.applyHudScale(settings.hudScale);
Hud.applyCrosshair(settings.crosshairStyle, settings.crosshairColor, settings.crosshairSize);
const input = new InputController(canvas, (locked) => onLockChange(locked), () => undefined);
input.sensitivity = settings.sensitivity;
input.invertY = settings.invertY;

/** Skins of the players of the current room, plus the bundled default skins. */
const skins = new SkinStore();
void skins.preloadDefaults(import.meta.env.BASE_URL);
/** The skin chosen by this player in this page session (memory only) and the room it was sent to. */
let mySkin: Uint8Array | null = null;
let mySkinRoom = '';

let myId = -1;
let lobby: LobbyState | null = null;
let game: Game | null = null;
let results: MatchResults | null = null;
let resultsTopWeapons = new Map<number, number>();
let busy = false;

// ------------------------------------------------------------------ network handlers

const net = new Net(defaultServerUrl(), {
  welcome(m) {
    myId = m.playerId;
    if (mySkin && mySkinRoom !== m.code) {
      // a skin picked earlier follows the player into the next room
      mySkinRoom = m.code;
      net.sendSkin(mySkin);
    }
    history.replaceState(null, '', `${location.pathname}${location.search.replace(/([?&])room=[^&]*&?/, '$1').replace(/[?&]$/, '')}#${m.code}`);
  },
  lobby(m) {
    lobby = m;
    if (m.phase === 'lobby' && !game) {
      results = null;
      showScreen('lobby');
    }
    if (m.phase === 'results' && results) renderResults(results, myId, m.hostId === myId, resultsTopWeapons);
    renderLobby(m, myId);
  },
  matchStart(m) {
    stopGame();
    results = null;
    myId = m.playerId;
    showScreen('none');
    $('pause').classList.add('hidden');
    game = new Game({ renderer, net, hud, sfx, settings, input, start: m, skins });
    input.attach();
    game.start();
    hud.center(`${getMap(m.settings.mapId)?.name ?? ''} · ${m.settings.mode === 'ctf' ? 'Captura la bandera' : 'Deathmatch'}`, 3000);
  },
  snapshot: (m) => game?.onSnapshot(m),
  events: (m) => game?.onEvents(m),
  scoreboard: (m) => game?.onScoreboard(m),
  matchEnd(r) {
    resultsTopWeapons = game?.dominantKillWeapons() ?? new Map();
    stopGame();
    results = r;
    renderResults(r, myId, lobby?.hostId === myId, resultsTopWeapons);
    showScreen('results');
  },
  notice: (m) => toast(m.text, m.level),
  skin(m) {
    skins.set(m.id, m.png ? new Uint8Array(m.png) : null);
    if (m.id === myId) showSkinPreview(m.png ? new Uint8Array(m.png) : null);
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

function stopGame() {
  if (!game) return;
  game.dispose();
  game = null;
  input.detach();
  $('pause').classList.add('hidden');
}

function backToMenu(reason = '') {
  stopGame();
  lobby = null;
  results = null;
  myId = -1;
  mySkinRoom = '';
  skins.clear();
  showSkinPreview(null);
  history.replaceState(null, '', location.pathname + location.search);
  showScreen('menu');
  $('menu-status').textContent = reason;
}

function onLockChange(locked: boolean) {
  if (!game) return;
  $('pause').classList.toggle('hidden', locked);
  if (locked) hud.pinScores(false);
}

// ------------------------------------------------------------------ menu

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
  return n || `Jugador${Math.floor(Math.random() * 900 + 100)}`;
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

// ------------------------------------------------------------------ lobby

$('btn-copy').addEventListener('click', async () => {
  const code = lobby?.code ?? '';
  const link = `${location.origin}${location.pathname}?room=${code}`;
  try {
    await navigator.clipboard.writeText(code);
    toast(`Código ${code} copiado. También puedes compartir: ${link}`);
  } catch {
    // clipboard API needs a secure context (HTTPS or localhost)
    window.prompt('Copia el código de sala:', code);
  }
});
$('btn-leave').addEventListener('click', async () => {
  await net.leave();
  backToMenu('');
});
$('btn-ready').addEventListener('click', () => {
  const me = lobby?.players.find((p) => p.id === myId);
  net.setReady(!me?.ready);
});
$('btn-start').addEventListener('click', () => {
  sfx.unlock();
  net.start();
});
// skin: the file is checked here first (size, PNG, exact dimensions, decodable) and again by the server
const skinInput = $<HTMLInputElement>('in-skin');
const skinPreview = $<HTMLImageElement>('skin-preview');
let skinPreviewUrl = '';
function showSkinPreview(png: Uint8Array | null) {
  if (skinPreviewUrl) URL.revokeObjectURL(skinPreviewUrl);
  skinPreviewUrl = png ? URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' })) : '';
  skinPreview.src = skinPreviewUrl;
  skinPreview.classList.toggle('hidden', !png);
  $('skin-status').textContent = png ? 'Skin personalizada activa.' : 'Usas la skin por defecto.';
}
$('btn-skin').addEventListener('click', () => skinInput.click());
skinInput.addEventListener('change', async () => {
  const file = skinInput.files?.[0];
  skinInput.value = '';
  if (!file) return;
  if (file.size > SKIN.maxBytes) return toast(`Skin rechazada: pesa ${(file.size / 1024).toFixed(1)} KB y el máximo es ${SKIN.maxBytes / 1024} KB.`, 'warn');
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    await decodeSkinPng(bytes);
  } catch (err) {
    return toast(`Skin rechazada: ${(err as Error).message}.`, 'warn');
  }
  mySkin = bytes;
  mySkinRoom = lobby?.code ?? '';
  net.sendSkin(bytes);
});
$('btn-skin-clear').addEventListener('click', () => {
  mySkin = null;
  net.sendSkin(null);
});
$('btn-team-red').addEventListener('click', () => net.setTeam(0));
$('btn-team-blue').addEventListener('click', () => net.setTeam(1));
$('sel-mode').addEventListener('change', (e) => {
  const mode = (e.target as HTMLSelectElement).value as GameMode;
  const current = lobby ? getMap(lobby.settings.mapId) : undefined;
  const mapId = current?.modes.includes(mode) ? current.id : defaultMapFor(mode).id;
  net.updateSettings({ mode, mapId });
});
$('sel-map').addEventListener('change', (e) => net.updateSettings({ mapId: (e.target as HTMLSelectElement).value }));
$('sel-time').addEventListener('change', (e) => net.updateSettings({ timeLimit: Number((e.target as HTMLSelectElement).value) }));
$('sel-score').addEventListener('change', (e) => net.updateSettings({ scoreLimit: Number((e.target as HTMLSelectElement).value) }));
$('sel-bots').addEventListener('change', (e) => net.updateSettings({ botCount: Number((e.target as HTMLSelectElement).value) }));
$('sel-bot-diff').addEventListener('change', (e) => net.updateSettings({ botDifficulty: (e.target as HTMLSelectElement).value as 'easy' | 'normal' | 'hard' }));

// ------------------------------------------------------------------ results

$('btn-results-leave').addEventListener('click', async () => {
  await net.leave();
  backToMenu('');
});
$('btn-rematch').addEventListener('click', () => net.rematch());
$('btn-to-lobby').addEventListener('click', () => net.toLobby());

// ------------------------------------------------------------------ in-game / pause

canvas.addEventListener('click', () => {
  if (!game || input.locked) return;
  sfx.unlock();
  input.requestLock();
});
$('btn-resume').addEventListener('click', () => {
  sfx.unlock();
  input.requestLock();
});
// scores inside the pause menu: the match keeps running on the server and the table updates live
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
    ? 'Recarga la página (F5) para aplicar el cambio de suavizado de bordes (antialias).'
    : settings.qualityPreset === 'custom'
      ? 'Modo personalizado: los ajustes sueltos controlan la calidad.'
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
    if (p === 'custom') {
      settings.qualityPreset = 'custom';
    } else {
      Object.assign(settings, applyPresetToSettings(p));
    }
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

// ------------------------------------------------------------------ boot

if (new URLSearchParams(location.search).has('debug')) {
  // read-only hook for automated browser tests
  Object.assign(window, { __arena: { net, skins, get game() { return game; }, get lobby() { return lobby; }, get myId() { return myId; } } });
}
showScreen('menu');
void net.tryResume().then((ok) => {
  if (ok) toast('Sesión recuperada');
});
window.addEventListener('beforeunload', () => {
  // keep the reconnection token: a reload within 20 s resumes the session
  game?.dispose();
});
