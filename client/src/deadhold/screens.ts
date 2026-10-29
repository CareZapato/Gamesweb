import { type GameOverMsg, type LobbyState } from '@arena/shared';

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

export const renderLobby = (l: LobbyState, myId: number) => {
  const isHost = l.hostId === myId;
  $('lobby-code').textContent = l.code;
  $('lobby-phase').textContent =
    l.phase === 'lobby' ? 'SALA' : l.phase === 'playing' ? 'EN PARTIDA' : 'RESULTADOS';
  $('lobby-count').textContent = `${l.players.length}/${l.maxPlayers}`;
  $('lobby-list').innerHTML = l.players
    .map((p) => {
      const tags = [
        p.id === l.hostId ? '<span class="tag host">ANFITRIÓN</span>' : '',
        !p.connected ? '<span class="tag off">DESCONECTADO</span>' : `<span class="tag">${p.ping} ms</span>`,
      ].join('');
      return `<li class="${p.id === myId ? 'me' : ''}"><span class="name">${esc(p.name)}${p.id === myId ? ' (tú)' : ''}</span>${tags}</li>`;
    })
    .join('');

  const startBtn = $<HTMLButtonElement>('btn-start');
  startBtn.classList.toggle('hidden', !isHost);
  startBtn.disabled = l.phase !== 'lobby';
  $('btn-ready').classList.add('hidden');

  const status =
    l.phase === 'playing'
      ? 'Partida en curso…'
      : l.phase === 'results'
        ? 'Resumen al final de la horda…'
        : isHost
          ? 'Mapa holdout · Coop 1–4. Pulsa Iniciar cuando quieras.'
          : 'Esperando a que el anfitrión inicie la horda.';
  $('lobby-status').textContent = status;
};

export const renderGameOver = (m: GameOverMsg, myId: number, isHost: boolean) => {
  $('results-title').textContent = 'Fin de la horda';
  const mins = Math.floor(m.durationSec / 60);
  const secs = m.durationSec % 60;
  $('results-sub').textContent = `Nivel ${m.level} · Caída en oleada ${m.wave} · ${m.kills} bajas · ${mins}:${String(secs).padStart(2, '0')}`;
  const head = '<tr><th>Nombre</th><th>Bajas</th><th>Muertes</th><th>Daño</th><th>Scrap</th></tr>';
  const row = (p: GameOverMsg['players'][number]) =>
    `<tr class="${p.id === myId ? 'me' : ''}"><td>${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.damage}</td><td>${p.scrap}</td></tr>`;
  $('results-table').innerHTML = `<table>${head}${m.players.map(row).join('')}</table>`;
  $('btn-rematch').classList.toggle('hidden', !isHost);
  $('btn-to-lobby').classList.toggle('hidden', !isHost);
  $('results-wait').textContent = isHost ? '' : 'El anfitrión decide revancha o lobby.';
};
