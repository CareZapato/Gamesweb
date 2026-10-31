import { UPGRADES, type ShopMsg, type ShopOffer, type UpgradeId, type WaveMsg } from '@arena/shared';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const SKIP_LABEL = 'Siguiente (N)';

const resetSkipButton = () => {
  const btn = $<HTMLButtonElement>('dh-wave-skip');
  btn.disabled = false;
  btn.textContent = SKIP_LABEL;
  btn.title = 'Iniciar la oleada sin esperar al temporizador (tecla N)';
};

/** Oleada, nivel, scrap y panel de tienda entre rondas. */
export class DeadholdHud {
  private scrap = 0;
  private shopReady = false;
  private shopWave = 0;
  private overlayDismissed = false;
  private shopPhase = false;
  private onBuy: ((id: UpgradeId) => void) | null = null;
  private onSkipWave: (() => void) | null = null;
  private onDismissOverlay: (() => void) | null = null;

  reset() {
    this.scrap = 0;
    this.shopReady = false;
    this.shopWave = 0;
    this.overlayDismissed = false;
    this.shopPhase = false;
    this.setScrap(0);
    this.setLevel(0);
    this.hideShop();
    $('hud-deadhold').classList.add('hidden');
    $('hud-wave-left').textContent = '';
  }

  isOverlayDismissed(): boolean {
    return this.overlayDismissed;
  }

  showInMatch() {
    $('hud-deadhold').classList.remove('hidden');
  }

  /** Tienda entre oleadas (fase servidor o paneles visibles). */
  inShop(): boolean {
    if (this.shopPhase) return true;
    return !$('dh-shop-compact').classList.contains('hidden') || !$('dh-shop').classList.contains('hidden');
  }

  /** Marca listo y salta el temporizador (clic en «Siguiente (N)» o tecla N). */
  requestSkipWave(): void {
    if (this.shopReady || !this.inShop()) return;
    this.shopReady = true;
    const btn = $<HTMLButtonElement>('dh-wave-skip');
    btn.disabled = true;
    btn.textContent = 'Esperando…';
    this.onSkipWave?.();
    this.dismissOverlay(true);
  }

  bindShop(handlers: {
    buy: (id: UpgradeId) => void;
    skipWave: () => void;
    onDismissOverlay?: () => void;
  }) {
    this.onBuy = handlers.buy;
    this.onSkipWave = handlers.skipWave;
    this.onDismissOverlay = handlers.onDismissOverlay ?? null;

    $('dh-wave-skip').onclick = () => this.requestSkipWave();
    $('dh-shop-close').onclick = () => this.dismissOverlay(false);
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
    this.shopPhase = m.phase === 'shop';
    const prep = m.phase === 'combat' && m.alive === 0 && m.queued > 0;
    const specialTag = m.special ? ' · JEFE' : '';
    const line =
      m.phase === 'shop'
        ? `Oleada ${m.wave} superada · Tienda`
        : m.phase === 'gameover'
          ? `Caíste en oleada ${m.wave}`
          : prep
            ? `Oleada ${m.wave}${specialTag} · Preparación ${Math.ceil(m.timer)} s`
            : `Oleada ${m.wave}${specialTag} · ${m.alive}/${m.total} vivos · Cola ${m.queued}`;
    $('hud-wave').textContent = line;

    const leftEl = $('hud-wave-left');
    if (m.phase === 'combat') {
      const left = m.alive + m.queued;
      leftEl.textContent = `Por derrotar: ${left}`;
    } else {
      leftEl.textContent = '';
    }

    if (m.phase === 'shop') {
      const sec = Math.ceil(m.timer);
      const t = sec > 0 ? `${sec} s · N = siguiente oleada` : 'Iniciando…';
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
    this.shopPhase = true;
    if (msg.wave !== this.shopWave) {
      this.shopWave = msg.wave;
      this.overlayDismissed = false;
    }
    this.scrap = msg.scrap;
    $('hud-scrap').textContent = `Scrap ${msg.scrap}`;
    const elite = msg.wave % 5 === 0;
    $('dh-shop-wave').textContent = elite
      ? `Oleada jefe ${msg.wave} superada · tienda reforzada (−28 % costes)`
      : `Oleada ${msg.wave} superada · elige 1 mejora`;
    const sec = Math.ceil(msg.endsIn);
    const timer = sec > 0 ? `${sec} s · N = siguiente oleada` : 'Iniciando…';
    $('dh-shop-timer').textContent = timer;
    $('dh-shop-compact-timer').textContent = timer;
    this.shopReady = false;
    resetSkipButton();
    $('dh-shop-offers').innerHTML = msg.offers.map((o) => offerButton(o, msg.scrap)).join('');
    for (const btn of $('dh-shop-offers').querySelectorAll<HTMLButtonElement>('button[data-id]')) {
      btn.onclick = () => {
        if (btn.classList.contains('no-funds') || btn.disabled) return;
        const id = btn.dataset.id as UpgradeId;
        if (!id) return;
        this.onBuy?.(id);
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
    (first ?? $('dh-shop-close')).focus({ preventScroll: true });
  }

  hideShop() {
    this.shopPhase = false;
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
