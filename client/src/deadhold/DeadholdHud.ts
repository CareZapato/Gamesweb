import { UPGRADES, type ShopMsg, type ShopOffer, type UpgradeId, type WaveMsg } from '@arena/shared';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Oleada, nivel, scrap y panel de tienda entre rondas. */
export class DeadholdHud {
  private scrap = 0;
  private shopReady = false;
  private shopWave = 0;
  private overlayDismissed = false;
  private onBuy: ((id: UpgradeId) => void) | null = null;
  private onReady: (() => void) | null = null;
  private onDismissOverlay: (() => void) | null = null;

  reset() {
    this.scrap = 0;
    this.shopReady = false;
    this.shopWave = 0;
    this.overlayDismissed = false;
    this.setScrap(0);
    this.setLevel(0);
    this.hideShop();
    $('hud-deadhold').classList.add('hidden');
  }

  isOverlayDismissed(): boolean {
    return this.overlayDismissed;
  }

  showInMatch() {
    $('hud-deadhold').classList.remove('hidden');
  }

  bindShop(handlers: {
    buy: (id: UpgradeId) => void;
    ready: () => void;
    onDismissOverlay?: () => void;
  }) {
    this.onBuy = handlers.buy;
    this.onReady = handlers.ready;
    this.onDismissOverlay = handlers.onDismissOverlay ?? null;
    const markReady = (btn: HTMLButtonElement) => {
      if (this.shopReady) return;
      this.shopReady = true;
      btn.textContent = 'Esperando al equipo…';
      btn.disabled = true;
      this.onReady?.();
      this.dismissOverlay(true);
    };
    $('dh-shop-ready').onclick = () => markReady($<HTMLButtonElement>('dh-shop-ready'));
    $('dh-shop-compact-ready').onclick = () => markReady($<HTMLButtonElement>('dh-shop-compact-ready'));
  }

  /** Cierra el panel de mejoras; con `fromReady` engancha la mira aunque el panel ya estuviera cerrado. */
  dismissOverlay(fromReady = false) {
    const firstClose = !this.overlayDismissed;
    if (firstClose) {
      this.overlayDismissed = true;
      $('dh-shop').classList.add('hidden');
      $('dh-shop-compact').classList.remove('hidden');
    }
    if (firstClose || fromReady) this.onDismissOverlay?.();
  }

  updateWave(m: WaveMsg) {
    const prep = m.phase === 'combat' && m.alive === 0 && m.queued > 0;
    const line =
      m.phase === 'shop'
        ? `Oleada ${m.wave} superada · Tienda`
        : m.phase === 'gameover'
          ? `Caíste en oleada ${m.wave}`
          : prep
            ? `Oleada ${m.wave} · Preparación ${Math.ceil(m.timer)} s`
            : `Oleada ${m.wave} · ${m.alive}/${m.total} vivos · Cola ${m.queued}`;
    $('hud-wave').textContent = line;
    if (m.phase === 'shop') {
      const t = `Cierra en ${Math.ceil(m.timer)} s`;
      $('dh-shop-timer').textContent = t;
      $('dh-shop-compact-timer').textContent = t;
    } else {
      this.hideShop();
    }
  }

  setLevel(level: number) {
    $('hud-level').textContent = `Nivel ${level}`;
  }

  setScrap(scrap: number) {
    this.scrap = scrap;
    $('hud-scrap').textContent = `Scrap ${scrap}`;
  }

  renderShop(msg: ShopMsg) {
    if (msg.wave !== this.shopWave) {
      this.shopWave = msg.wave;
      this.overlayDismissed = false;
    }
    this.scrap = msg.scrap;
    $('hud-scrap').textContent = `Scrap ${msg.scrap}`;
    $('dh-shop-wave').textContent = `Oleada ${msg.wave} superada · elige 1 mejora`;
    const timer = `Cierra en ${Math.ceil(msg.endsIn)} s`;
    $('dh-shop-timer').textContent = timer;
    $('dh-shop-compact-timer').textContent = timer;
    this.shopReady = false;
    for (const id of ['dh-shop-ready', 'dh-shop-compact-ready'] as const) {
      const readyBtn = $<HTMLButtonElement>(id);
      readyBtn.textContent = 'Listo para la siguiente oleada';
      readyBtn.disabled = false;
    }
    $('dh-shop-offers').innerHTML = msg.offers.map((o) => offerButton(o, msg.scrap)).join('');
    for (const btn of $('dh-shop-offers').querySelectorAll<HTMLButtonElement>('button[data-id]')) {
      btn.onclick = () => {
        const id = btn.dataset.id as UpgradeId;
        if (!id) return;
        this.onBuy?.(id);
        this.dismissOverlay();
      };
    }
    if (this.overlayDismissed) {
      $('dh-shop').classList.add('hidden');
      $('dh-shop-compact').classList.remove('hidden');
      return;
    }
    $('dh-shop-compact').classList.add('hidden');
    $('dh-shop').classList.remove('hidden');
    const first = $('dh-shop-offers').querySelector<HTMLButtonElement>('button[data-id]');
    (first ?? $('dh-shop-ready')).focus({ preventScroll: true });
  }

  hideShop() {
    $('dh-shop').classList.add('hidden');
    $('dh-shop-compact').classList.add('hidden');
    this.shopReady = false;
    this.overlayDismissed = false;
    this.shopWave = 0;
  }
}

const offerButton = (o: ShopOffer, scrap: number) => {
  const u = UPGRADES[o.id];
  const afford = o.cost <= scrap;
  const missing = Math.max(0, o.cost - scrap);
  const build =
    o.stacks > 0 ? `<span class="dh-offer-build">En tu build · Nv.${o.stacks}</span>` : '';
  const costLine = afford
    ? `${o.cost} scrap`
    : `${o.cost} scrap · faltan ${missing}`;
  return `<button type="button" class="dh-offer ${o.rarity}${afford ? '' : ' no-funds'}" data-id="${esc(o.id)}">
    <span class="dh-offer-name">${esc(u.label)}</span>
    ${build}
    <span class="dh-offer-desc">${esc(u.description)}</span>
    <span class="dh-offer-cost">${costLine}</span>
  </button>`;
};
