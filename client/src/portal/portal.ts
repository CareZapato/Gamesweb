import './portal.css';
import { CATALOG, type CatalogGame } from '../catalog';

const playersLabel = (g: CatalogGame): string =>
  g.minPlayers === g.maxPlayers ? `${g.maxPlayers} jugadores` : `${g.minPlayers}–${g.maxPlayers} jugadores`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Test/diagnostic parameters that the portal forwards to the game it opens (?debug, ?lag=80, ?server=…). */
const FORWARDED_PARAMS = ['debug', 'lag', 'server'];

const gameHref = (g: CatalogGame): string => {
  const incoming = new URLSearchParams(location.search);
  const forwarded = new URLSearchParams();
  for (const key of FORWARDED_PARAMS) if (incoming.has(key)) forwarded.set(key, incoming.get(key) ?? '');
  const query = forwarded.toString();
  return query ? `${g.route}?${query}` : g.route;
};

const card = (g: CatalogGame): HTMLElement => {
  const playable = g.status === 'available';
  const root = el('article', `card${playable ? '' : ' soon'}`);
  root.dataset.game = g.id;

  const thumb = el('div', 'thumb');
  const img = el('img');
  img.src = g.thumbnail;
  img.alt = '';
  img.width = 320;
  img.height = 180;
  thumb.append(img);
  if (!playable) thumb.append(el('span', 'badge', 'Próximamente'));

  const body = el('div', 'body');
  body.append(el('h2', undefined, g.name), el('p', 'desc', g.description), el('div', 'meta', playersLabel(g)));

  if (playable) {
    const play = el('a', 'play', 'Jugar');
    play.href = gameHref(g);
    body.append(play);
  } else {
    const play = el('button', 'play', 'Próximamente');
    play.disabled = true;
    body.append(play);
  }

  root.append(thumb, body);
  return root;
};

const container = document.getElementById('catalog');
if (container) {
  container.replaceChildren(...CATALOG.map(card));
}
