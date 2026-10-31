import { type FlagSnap, FlagState, type GameMode, type HitZone, ordinal, PLAYER, type ScoreEntry, TEAM_NAMES, WEAPONS } from '@arena/shared';
import type { CrosshairStyle } from '../settings';
import { flagIconHtml, weaponIconHtml } from './weaponIcons';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const lowAmmo = (weaponId: number, ammo: number) => {
  if (ammo <= 0) return false;
  const max = WEAPONS[weaponId]?.maxAmmo ?? 1;
  return ammo <= Math.max(1, Math.ceil(max * 0.2));
};

const pct = (v: number, max: number) => `${Math.min(100, Math.max(0, Math.round((v / Math.max(1, max)) * 100)))}%`;

/** Restarts a one-shot CSS animation class. */
const pulse = (el: HTMLElement, cls: string) => {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
};

export type FlagPointer = { team: number; rel: number; dist: number };

/**
 * Scoreboard table. `entries` arrive already ranked by the server (`rankPlayers`); the client never
 * re-sorts them, so the live board and the results screen always agree.
 */
export const scoreTableHtml = (entries: readonly ScoreEntry[], mode: GameMode, meId: number, teamScores: number[], weaponIcon?: (id: number) => string): string => {
  const ctf = mode === 'ctf';
  const head = `<tr><th class="rank">Puesto</th><th>Nombre</th>${ctf ? '<th>Equipo</th>' : ''}<th>Bajas</th><th>Muertes</th><th>Daño</th>${ctf ? '<th>Capturas</th>' : ''}<th>Puntaje</th><th>Ping</th></tr>`;
  const row = (e: ScoreEntry) =>
    `<tr class="${e.id === meId ? 'me' : ''}${e.connected ? '' : ' off'}"><td class="rank">${ordinal(e.rank)}</td><td class="name team-${e.team}">${weaponIcon?.(e.id) ?? ''} ${esc(e.name)}${e.id === meId ? ' <span class="you">(tú)</span>' : ''}${e.connected ? '' : ' <span class="muted">(desconectado)</span>'}</td>${ctf ? `<td class="team-${e.team}">${TEAM_NAMES[e.team] ?? '—'}</td>` : ''}<td>${e.kills}</td><td>${e.deaths}</td><td>${e.damage}</td>${ctf ? `<td>${e.captures}</td>` : ''}<td><b>${e.score}</b></td><td>${e.ping} ms</td></tr>`;
  if (!ctf) return `<h3>Deathmatch</h3><table>${head}${entries.map(row).join('')}</table>`;
  // team order (and the rows inside each team) come from the server ranking
  const teams: number[] = [];
  for (const e of entries) if ((e.team === 0 || e.team === 1) && !teams.includes(e.team)) teams.push(e.team);
  for (const t of [0, 1]) if (!teams.includes(t)) teams.push(t);
  const loose = entries.filter((e) => e.team !== 0 && e.team !== 1);
  return (
    teams
      .map(
        (t, i) =>
          `<h3 class="team-${t}">${ordinal(i + 1)} · Equipo ${TEAM_NAMES[t]} · ${teamScores[t] ?? 0} capturas</h3><table>${head}${entries
            .filter((e) => e.team === t)
            .map(row)
            .join('')}</table>`,
      )
      .join('') + (loose.length ? `<h3>Sin equipo</h3><table>${head}${loose.map(row).join('')}</table>` : '')
  );
};

/** DOM-based heads-up display. Only touches the DOM when a value actually changes. */
export class Hud {
  private root = $('hud');
  private cache = new Map<string, string>();
  private centerTimer = 0;
  private subTimer = 0;
  private lastHp = -1;
  private lastShield = -1;
  /** Scoreboard pinned inside the pause menu (opened with the "Puntajes" button). */
  private scoresPinned = false;
  private wasDead = false;
  private damageFloaters: { el: HTMLElement; sx: number; sy: number; vy: number; life: number }[] = [];

  private set(id: string, text: string) {
    if (this.cache.get(id) === text) return;
    this.cache.set(id, text);
    $(id).textContent = text;
  }

  private html(id: string, html: string) {
    if (this.cache.get(id) === html) return;
    this.cache.set(id, html);
    $(id).innerHTML = html;
  }

  private width(key: string, id: string, w: string) {
    if (this.cache.get(key) === w) return;
    this.cache.set(key, w);
    $(id).style.width = w;
  }

  show(v: boolean) {
    this.root.classList.toggle('hidden', !v);
    if (!v) {
      this.cache.clear();
      this.lastHp = -1;
      this.lastShield = -1;
      this.pinScores(false);
    }
  }

  static applyHudScale(scale: number) {
    const s = Math.min(1.3, Math.max(0.8, scale));
    $('hud').style.setProperty('--hud-scale', String(s));
  }

  static applyCrosshair(style: CrosshairStyle, color: string, size: number) {
    const el = $('crosshair');
    el.classList.remove('ch-cross', 'ch-dot', 'ch-circle');
    el.classList.add(style === 'dot' ? 'ch-dot' : style === 'circle' ? 'ch-circle' : 'ch-cross');
    el.style.setProperty('--ch-color', color);
    el.style.setProperty('--ch-scale', String(Math.min(2, Math.max(0.5, size))));
  }

  /** Health and shield are shown separately, each with its number, its maximum and a bar. */
  setVitals(hp: number, maxHp: number, shield: number, maxShield: number, dashFraction: number) {
    const hpClamped = Math.max(0, Math.round(hp));
    const sh = Math.max(0, Math.round(shield));
    this.set('hud-hp', String(hpClamped));
    this.set('hud-hp-max', `/${maxHp}`);
    this.set('hud-shield', String(sh));
    this.set('hud-shield-max', `/${maxShield}`);
    const healthEl = $('hud-health');
    const shieldEl = $('hud-shield-box');
    healthEl.classList.toggle('low', hpClamped <= 30);
    shieldEl.classList.toggle('empty', sh <= 0);
    shieldEl.classList.toggle('full', sh >= maxShield);
    $('hud-low-hp').classList.toggle('hidden', hpClamped > 30 || hpClamped <= 0);
    this.width('hp-bar', 'hud-hp-bar', pct(hpClamped, maxHp));
    this.width('sh-bar', 'hud-shield-bar', pct(sh, maxShield));
    if (this.lastHp >= 0 && hpClamped < this.lastHp) pulse(healthEl, 'vit-hit');
    if (this.lastShield >= 0 && sh < this.lastShield) pulse(shieldEl, 'vit-hit');
    if (this.lastShield >= 0 && sh > this.lastShield) pulse(shieldEl, 'vit-gain');
    this.lastHp = hpClamped;
    this.lastShield = sh;
    this.width('dash', 'hud-dash-bar', `${Math.round(dashFraction * 100)}%`);
  }

  /** The shield absorbed damage: bluish flash around the screen. */
  shieldHit(amount: number) {
    const el = $('damage-flash');
    el.classList.add('shield');
    el.style.transition = 'none';
    el.style.opacity = String(Math.min(0.7, 0.2 + amount / 90));
    void el.offsetWidth;
    el.style.transition = 'opacity 0.45s';
    el.style.opacity = '0';
    window.setTimeout(() => el.classList.remove('shield'), 450);
  }

  /** The shield was depleted by a hit. */
  shieldBreak() {
    pulse($('hud-shield-box'), 'vit-break');
    this.sub('¡Escudo agotado!', 1200);
  }

  setWeapons(current: number, ammo: number[], switching: boolean, owned?: readonly boolean[]) {
    const w = WEAPONS[current];
    this.set('hud-weapon-name', switching ? 'CAMBIANDO…' : w.name.toUpperCase());
    this.set('hud-ammo', String(ammo[current] ?? 0));
    const ammoEl = $('hud-ammo');
    ammoEl.classList.toggle('empty', (ammo[current] ?? 0) <= 0);
    ammoEl.classList.toggle('low-ammo', lowAmmo(current, ammo[current] ?? 0));
    const iconKey = `wicon-${current}-${switching}`;
    const iconHtml = switching ? '' : weaponIconHtml(current, 'wpn-icon-lg');
    if (this.cache.get(iconKey) !== iconHtml) {
      this.cache.set(iconKey, iconHtml);
      $('hud-weapon-icon').innerHTML = iconHtml;
    }
    const slots = WEAPONS.map((x, i) => {
      const has = owned ? owned[i] !== false : true;
      const am = ammo[i] ?? 0;
      const cls = [i === current ? 'sel' : '', !has ? 'locked' : '', am <= 0 ? 'empty' : '', lowAmmo(i, am) ? 'low-ammo' : '']
        .filter(Boolean)
        .join(' ');
      return `<div class="${cls}" title="${esc(x.name)}"><span class="wpn-slot-icon">${weaponIconHtml(i)}</span><span class="key">${i + 1}</span><span class="am">${am}</span></div>`;
    }).join('');
    this.html('hud-weapons', slots);
  }

  setTimer(sec: number) {
    this.set('hud-timer', fmtTime(sec));
  }

  /** `entries` are already ranked by the server. */
  setScoreDM(entries: ScoreEntry[], meId: number, limit: number) {
    const me = entries.find((e) => e.id === meId);
    const leader = entries[0];
    this.html(
      'hud-score',
      me
        ? `Puntos <b>${me.score}</b> / ${limit} · Puesto ${ordinal(me.rank)} de ${entries.length}${leader && leader.id !== meId ? ` · Líder: ${esc(leader.name)} (${leader.score})` : ''}`
        : '',
    );
  }

  setScoreCTF(teamScores: number[], limit: number) {
    this.html('hud-score', `<span class="team-0">ROJO ${teamScores[0] ?? 0}</span> · <span class="team-1">${teamScores[1] ?? 0} AZUL</span> <span class="muted">(a ${limit})</span>`);
  }

  setFlags(flags: FlagSnap[], names: Map<number, string>, myTeam: number, meId: number) {
    $('hud-flags').classList.remove('hidden');
    const parts = flags.map(([team, state, , , , carrier, ret]) => {
      let s: string;
      if (state === FlagState.Home) s = 'en base';
      else if (state === FlagState.Carried) s = carrier === meId ? '¡la llevas tú!' : `llevada por ${esc(names.get(carrier) ?? '?')}`;
      else s = `caída · vuelve en ${ret}s`;
      const own = team === myTeam ? ' (tuya)' : '';
      return `<div class="team-${team}">${flagIconHtml(team)} Bandera ${TEAM_NAMES[team]}${own}: ${s}</div>`;
    });
    this.html('hud-flags', parts.join(''));
  }

  /** Edge arrows when a flag bearing is outside the horizontal view cone. */
  setFlagPointers(pointers: FlagPointer[]) {
    const key = pointers.map((p) => `${p.team}:${p.rel.toFixed(2)}`).join('|');
    if (this.cache.get('flag-ptr') === key) return;
    this.cache.set('flag-ptr', key);
    const box = $('hud-flag-pointers');
    box.innerHTML = pointers
      .map((p) => {
        const deg = (p.rel * 180) / Math.PI;
        const x = 50 + Math.sin(p.rel) * 42;
        const y = 50 - Math.cos(p.rel) * 38;
        return `<div class="flag-ptr team-${p.team}" style="left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${deg}deg)">${flagIconHtml(p.team, 'flag-ptr-icon')}<span class="flag-ptr-arrow">▲</span></div>`;
      })
      .join('');
  }

  clearFlagPointers() {
    if (this.cache.get('flag-ptr') === '') return;
    this.cache.set('flag-ptr', '');
    $('hud-flag-pointers').innerHTML = '';
  }

  hideFlags() {
    $('hud-flags').classList.add('hidden');
    this.clearFlagPointers();
  }

  spawnDamageFloater(screenX: number, screenY: number, dmg: number, zone: HitZone) {
    const el = document.createElement('div');
    el.className = `dmg-float zone-${zone}`;
    el.textContent = String(Math.round(dmg));
    $('damage-floaters').appendChild(el);
    this.damageFloaters.push({ el, sx: screenX, sy: screenY, vy: -55, life: 0.85 });
    el.style.transform = `translate(${screenX}px, ${screenY}px)`;
  }

  tickDamageFloaters(dt: number) {
    for (let i = this.damageFloaters.length - 1; i >= 0; i--) {
      const f = this.damageFloaters[i]!;
      f.life -= dt;
      f.sy += f.vy * dt;
      f.el.style.transform = `translate(${f.sx}px, ${f.sy}px)`;
      f.el.style.opacity = String(Math.max(0, f.life / 0.85));
      if (f.life <= 0) {
        f.el.remove();
        this.damageFloaters.splice(i, 1);
      }
    }
  }

  streakFeed(who: string, text: string, involvesMe: boolean) {
    const div = document.createElement('div');
    div.classList.add('streak-feed');
    if (involvesMe) div.classList.add('me');
    const line = who ? `${esc(who)} · ${esc(text)}` : esc(text);
    div.innerHTML = `<span class="streak-tag">★</span> ${line}`;
    const feed = $('killfeed');
    feed.prepend(div);
    while (feed.children.length > 6) feed.lastElementChild?.remove();
    window.setTimeout(() => div.remove(), 6500);
  }

  streakCenter(text: string, tier: number, ms = 3000) {
    const el = $('center-msg');
    el.textContent = text;
    el.className = '';
    void el.offsetWidth;
    el.className = `streak tier-${Math.min(5, tier >= 10 ? 5 : tier >= 5 ? 4 : tier)}`;
    window.clearTimeout(this.centerTimer);
    this.centerTimer = window.setTimeout(() => {
      el.textContent = '';
      el.className = '';
    }, ms);
  }

  /** `cause` labels environment deaths (lava, falls) that have no weapon. */
  killfeed(killer: string, victim: string, weapon: number, suicide: boolean, involvesMe: boolean, cause?: string) {
    const div = document.createElement('div');
    if (involvesMe) div.classList.add('me');
    const icon = weapon >= 0 ? weaponIconHtml(weapon, 'wpn-icon-feed') : '';
    const wFallback = weapon >= 0 ? '' : `<span class="w">${cause === 'lava' ? 'LAVA' : 'ENTORNO'}</span>`;
    div.innerHTML = suicide ? `${esc(victim)} ${icon || wFallback} se eliminó` : `${esc(killer)} ${icon || wFallback} ${esc(victim)}`;
    const feed = $('killfeed');
    feed.prepend(div);
    while (feed.children.length > 6) feed.lastElementChild?.remove();
    window.setTimeout(() => div.remove(), 6500);
  }

  center(text: string, ms = 2200) {
    $('center-msg').textContent = text;
    window.clearTimeout(this.centerTimer);
    this.centerTimer = window.setTimeout(() => ($('center-msg').textContent = ''), ms);
  }

  sub(text: string, ms = 0) {
    this.set('sub-msg', text);
    window.clearTimeout(this.subTimer);
    if (ms > 0) this.subTimer = window.setTimeout(() => this.set('sub-msg', ''), ms);
  }

  hitmarker(kind: 'hit' | 'head' | 'kill' | 'shield') {
    const el = $('hitmarker');
    el.className = '';
    void el.offsetWidth; // restart the CSS animation
    el.className = `show ${kind === 'hit' ? '' : kind}`;
  }

  damage(relAngle: number, amount: number) {
    const el = document.createElement('div');
    el.className = 'dmg-ind';
    el.style.transform = `rotate(${-relAngle}rad)`;
    el.style.opacity = String(Math.min(1, 0.4 + amount / 60));
    $('damage-indicators').append(el);
    window.setTimeout(() => el.remove(), 1300);
    const flash = $('damage-flash');
    flash.style.transition = 'none';
    flash.style.opacity = String(Math.min(0.9, 0.25 + amount / 80));
    void flash.offsetWidth;
    flash.style.transition = 'opacity 0.5s';
    flash.style.opacity = '0';
  }

  /** Brief tinted flash when the local player goes through a portal or a jump circle. */
  travelFlash(color: number) {
    const el = $('damage-flash');
    el.style.setProperty('--travel', `#${color.toString(16).padStart(6, '0')}`);
    el.classList.add('travel');
    el.style.transition = 'none';
    el.style.opacity = '0.6';
    void el.offsetWidth;
    el.style.transition = 'opacity 0.4s';
    el.style.opacity = '0';
    window.setTimeout(() => el.classList.remove('travel'), 400);
  }

  scope(v: boolean) {
    $('scope').classList.toggle('hidden', !v);
    $('crosshair').classList.toggle('hidden', v);
  }

  /** Aiming down sights without a scope: the crosshair tightens (the weapon is centred on screen). */
  aiming(v: boolean) {
    const key = v ? 'ads' : '';
    if (this.cache.get('aiming') === key) return;
    this.cache.set('aiming', key);
    $('crosshair').classList.toggle('ads', v);
  }

  /** Charge bar of the Lanza Cuásar: `null` hides it, 0..1 fills it (full = bright). */
  setCharge(fraction: number | null) {
    const key = fraction === null ? '' : String(Math.round(fraction * 50));
    if (this.cache.get('charge') === key) return;
    this.cache.set('charge', key);
    const el = $('hud-charge');
    el.classList.toggle('hidden', fraction === null);
    el.classList.toggle('full', fraction !== null && fraction >= 0.999);
    if (fraction !== null) $('hud-charge-bar').style.width = `${Math.round(fraction * 100)}%`;
  }

  clickToPlay(v: boolean) {
    $('click-to-play').classList.toggle('hidden', !v);
  }

  /** Shows the scoreboard inside the pause menu (cursor released) instead of the settings. */
  pinScores(v: boolean) {
    this.scoresPinned = v;
    $('pause-scores').classList.toggle('hidden', !v);
    $('pause-settings').classList.toggle('hidden', v);
    $('btn-scores').textContent = v ? 'Ajustes' : 'Puntajes';
    if (!v) this.cache.delete('pause-scores');
  }

  get scoresArePinned(): boolean {
    return this.scoresPinned;
  }

  /** Live scoreboard: Tab overlay while held, and the pinned copy in the pause menu. Never pauses the match. */
  scoreboard(
    visible: boolean,
    entries: ScoreEntry[],
    mode: GameMode,
    meId: number,
    teamScores: number[],
    weapons: Map<number, number>,
    tabExtra?: string,
  ) {
    $('scoreboard').classList.toggle('hidden', !visible);
    if (!visible && !this.scoresPinned) return;
    const wIcon = (id: number) => {
      const w = weapons.get(id);
      return w !== undefined ? weaponIconHtml(w, 'wpn-icon-sb') : '';
    };
    const extra = mode === 'survival' && tabExtra ? tabExtra : '';
    const html = `${extra}${scoreTableHtml(entries, mode, meId, teamScores, wIcon)}`;
    if (visible) this.html('scoreboard', html);
    if (this.scoresPinned) this.html('pause-scores', html);
  }

  netstats(visible: boolean, text: string) {
    $('netstats').classList.toggle('hidden', !visible);
    if (visible) this.set('netstats', text);
  }

  respawnInfo(alive: boolean, respawnIn: number) {
    // only touch the line while dead (and once on respawn) so short messages are not wiped every frame
    if (!alive) {
      this.wasDead = true;
      this.sub(`Reapareces en ${Math.max(0, respawnIn).toFixed(1)} s`);
    } else if (this.wasDead) {
      this.wasDead = false;
      this.sub('');
    }
  }

  static readonly maxDashCooldown = PLAYER.dashCooldown;
}
