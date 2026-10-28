import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_LABEL,
  getMap,
  type LobbyState,
  mapsForMode,
  type MatchResults,
  MODE_RULES,
  ordinal,
  TEAM_NAMES,
  TIME_LIMIT_OPTIONS,
} from '@arena/shared';
import { weaponIconHtml } from './weaponIcons';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export type ScreenName = 'menu' | 'lobby' | 'results' | 'none';

export const showScreen = (name: ScreenName) => {
  for (const s of ['menu', 'lobby', 'results'] as const) $(`screen-${s}`).classList.toggle('hidden', s !== name);
};

export const toast = (text: string, level: 'info' | 'warn' | 'error' = 'info') => {
  const el = document.createElement('div');
  el.className = `toast ${level}`;
  el.textContent = text;
  $('toasts').append(el);
  window.setTimeout(() => el.remove(), 4600);
};

const fillSelect = (sel: HTMLSelectElement, options: { value: string; label: string }[], value: string) => {
  const sig = options.map((o) => o.value + o.label).join('|');
  if (sel.dataset.sig !== sig) {
    sel.innerHTML = options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
    sel.dataset.sig = sig;
  }
  sel.value = value;
};

export const renderLobby = (l: LobbyState, myId: number) => {
  const isHost = l.hostId === myId;
  const me = l.players.find((p) => p.id === myId);
  const ctf = l.settings.mode === 'ctf';
  $('lobby-code').textContent = l.code;
  $('lobby-phase').textContent = l.phase === 'lobby' ? 'LOBBY' : l.phase === 'playing' ? 'EN PARTIDA' : 'RESULTADOS';
  const humans = l.players.filter((p) => !p.isBot);
  const maxBots = Math.max(0, l.maxPlayers - humans.length);
  $('lobby-count').textContent = `${humans.length + l.settings.botCount}/${l.maxPlayers}`;
  $('lobby-list').innerHTML = l.players
    .map((p) => {
      const tags = [
        p.isBot ? '<span class="tag ready">BOT</span>' : p.id === l.hostId ? '<span class="tag host">ANFITRIÓN</span>' : '',
        ctf ? `<span class="tag">${TEAM_NAMES[p.team].toUpperCase()}</span>` : '',
        p.isBot
          ? ''
          : !p.connected
            ? '<span class="tag off">DESCONECTADO</span>'
            : p.id === l.hostId
              ? ''
              : p.ready
                ? '<span class="tag ready">LISTO</span>'
                : '<span class="tag">ESPERANDO</span>',
        p.isBot ? '' : `<span class="tag">${p.ping} ms</span>`,
      ].join('');
      return `<li class="${ctf ? `team-${p.team}` : ''} ${p.id === myId ? 'me' : ''}"><span class="name">${esc(p.name)}${p.id === myId ? ' (tú)' : ''}</span>${tags}</li>`;
    })
    .join('');

  $('team-buttons').classList.toggle('hidden', !ctf);
  $('btn-team-red').classList.toggle('active', me?.team === 0);
  $('btn-team-blue').classList.toggle('active', me?.team === 1);

  const rules = MODE_RULES[l.settings.mode];
  fillSelect($('sel-mode'), (['dm', 'ctf'] as const).map((m) => ({ value: m, label: MODE_RULES[m].label })), l.settings.mode);
  fillSelect($('sel-map'), mapsForMode(l.settings.mode).map((m) => ({ value: m.id, label: m.name })), l.settings.mapId);
  fillSelect($('sel-time'), TIME_LIMIT_OPTIONS.map((t) => ({ value: String(t), label: `${t} min` })), String(l.settings.timeLimit));
  fillSelect($('sel-score'), rules.scoreLimitOptions.map((s) => ({ value: String(s), label: String(s) })), String(l.settings.scoreLimit));
  fillSelect(
    $('sel-bots'),
    Array.from({ length: maxBots + 1 }, (_, n) => ({ value: String(n), label: n === 0 ? 'Sin bots' : String(n) })),
    String(l.settings.botCount),
  );
  fillSelect(
    $('sel-bot-diff'),
    BOT_DIFFICULTIES.map((d) => ({ value: d, label: BOT_DIFFICULTY_LABEL[d] })),
    l.settings.botDifficulty,
  );
  $('score-limit-label').textContent = ctf ? 'Capturas para ganar' : 'Bajas para ganar';
  const map = getMap(l.settings.mapId);
  $('map-desc').textContent = map ? `${map.description} (Modos: ${map.modes.map((m) => MODE_RULES[m].label).join(', ')})` : '';
  for (const id of ['sel-mode', 'sel-map', 'sel-time', 'sel-score', 'sel-bots', 'sel-bot-diff'])
    ($(id) as HTMLSelectElement).disabled = !isHost || l.phase !== 'lobby';
  $('host-only-hint').textContent = isHost ? '(eres el anfitrión)' : '(la elige el anfitrión)';

  const others = l.players.filter((p) => !p.isBot && p.id !== l.hostId && p.connected);
  const allReady = others.every((p) => p.ready);
  const startBtn = $<HTMLButtonElement>('btn-start');
  startBtn.classList.toggle('hidden', !isHost);
  startBtn.disabled = l.phase !== 'lobby' || !allReady;
  const readyBtn = $<HTMLButtonElement>('btn-ready');
  readyBtn.classList.toggle('hidden', isHost);
  readyBtn.textContent = me?.ready ? 'Cancelar listo' : 'Estoy listo';
  readyBtn.classList.toggle('active', !!me?.ready);
  readyBtn.disabled = l.phase !== 'lobby';
  const status =
    l.phase === 'playing'
      ? 'Partida en curso…'
      : l.phase === 'results'
        ? 'Mostrando resultados…'
        : isHost
          ? allReady
            ? others.length === 0
              ? 'Puedes iniciar solo para probar, o esperar a más jugadores.'
              : 'Todos listos: puedes iniciar.'
            : 'Esperando a que todos se marquen listos.'
          : me?.ready
            ? 'Esperando a que el anfitrión inicie.'
            : 'Márcate como listo cuando quieras jugar.';
  $('lobby-status').textContent = status;
};

export const renderResults = (r: MatchResults, myId: number, isHost: boolean, topWeapon = new Map<number, number>()) => {
  const ctf = r.mode === 'ctf';
  let title: string;
  if (ctf) title = r.winnerTeam >= 0 ? `Gana el equipo ${TEAM_NAMES[r.winnerTeam]}` : 'Empate';
  else {
    const w = r.players.find((p) => p.id === r.winnerId);
    title = w ? (w.id === myId ? '¡Has ganado!' : `Gana ${w.name}`) : 'Empate';
  }
  $('results-title').textContent = title;
  const reason = r.reason === 'time' ? 'Se agotó el tiempo' : r.reason === 'score' ? 'Se alcanzó el límite de puntaje' : 'Partida interrumpida';
  $('results-sub').textContent = `${reason} · ${getMap(r.mapId)?.name ?? r.mapId} · ${Math.floor(r.durationSec / 60)}:${String(r.durationSec % 60).padStart(2, '0')}${ctf ? ` · Rojo ${r.teamScores[0]} – ${r.teamScores[1]} Azul` : ''}`;
  // same ranking and columns as the live scoreboard (the server sends the players already ranked)
  const cols = 10 + (ctf ? 2 : 0);
  let lastTeam = -2;
  let teamPos = 0;
  $('results-table').innerHTML =
    `<tr><th>Puesto</th><th>Nombre</th>${ctf ? '<th>Equipo</th>' : ''}<th>Arma</th><th>Bajas</th><th>Muertes</th><th>Daño</th>${ctf ? '<th>Capturas</th>' : ''}<th>Puntaje</th><th>Mejor racha</th><th>Mejor multi</th></tr>` +
    r.players
      .map((p) => {
        let sep = '';
        if (ctf && p.team !== lastTeam) {
          lastTeam = p.team;
          teamPos++;
          const name = TEAM_NAMES[p.team];
          sep = `<tr class="team-sep team-${p.team}"><td colspan="${cols}">${name ? `${ordinal(teamPos)} · Equipo ${name} · ${r.teamScores[p.team] ?? 0} capturas` : 'Sin equipo'}</td></tr>`;
        }
        const w = topWeapon.get(p.id);
        const wIcon = w !== undefined ? weaponIconHtml(w, 'wpn-icon-res') : '';
        return `${sep}<tr class="${p.id === myId ? 'me' : ''}"><td>${ordinal(p.rank)}</td><td>${esc(p.name)}${p.id === myId ? ' (tú)' : ''}</td>${ctf ? `<td class="team-${p.team}">${TEAM_NAMES[p.team] ?? '—'}</td>` : ''}<td class="wpn-res">${wIcon}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.damage}</td>${ctf ? `<td>${p.captures}</td>` : ''}<td><b>${p.score}</b></td><td>${p.bestSpree}</td><td>${p.bestMulti}</td></tr>`;
      })
      .join('');
  $('btn-rematch').classList.toggle('hidden', !isHost);
  $('btn-to-lobby').classList.toggle('hidden', !isHost);
  $('results-wait').textContent = isHost ? '' : 'Esperando al anfitrión (vuelta automática al lobby en unos segundos)…';
};
