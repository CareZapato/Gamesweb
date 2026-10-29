/**
 * Reducto: Horda — mensajes propios de la sala `deadhold`. El resto (input, snapshots, eventos,
 * lobby, ping) reutiliza `C2S` / `S2C` de `protocol.ts`. Los nombres llevan prefijo `dh` para no
 * chocar con los de RealTournament.
 */
import type { OwnedUpgrades, ShopOffer, UpgradeId } from './shop';

export const DH_C2S = {
  /** `BuyMsg`: comprar una mejora de la tienda abierta. */
  Buy: 'dhBuy',
  /** Sin payload: este jugador está listo para la siguiente oleada (si todos lo están, la tienda se cierra). */
  Ready: 'dhReady',
} as const;

export const DH_S2C = {
  /** `WaveMsg`: estado de la oleada (cambios de fase y avance del contador de enemigos). */
  Wave: 'dhWave',
  /** `ShopMsg`: ofertas personales, enviadas al abrirse la tienda y tras cada compra. */
  Shop: 'dhShop',
  /** `LevelMsg`: oleada superada (sube el nivel). */
  Level: 'dhLevel',
  /** `ScrapMsg`: cambio en la moneda personal. */
  Scrap: 'dhScrap',
  /** `GameOverMsg`: todos los jugadores cayeron. */
  Over: 'dhOver',
} as const;

/** Fases de la partida PvE. */
export type DeadholdPhase = 'combat' | 'shop' | 'gameover';

export interface WaveMsg {
  phase: DeadholdPhase;
  /** Oleada actual (en `shop`: la que acaba de superarse). */
  wave: number;
  /** Enemigos totales de la oleada. */
  total: number;
  /** Enemigos vivos ahora. */
  alive: number;
  /** Enemigos en cola, esperando hueco bajo el tope de vivos. */
  queued: number;
  /** Segundos hasta que empieza a salir la horda (combate) o hasta que se cierra la tienda (shop). */
  timer: number;
}

export interface ShopMsg {
  wave: number;
  offers: ShopOffer[];
  scrap: number;
  owned: OwnedUpgrades;
  /** Segundos restantes de tienda. */
  endsIn: number;
}

export interface LevelMsg {
  /** Nivel alcanzado = oleadas superadas. */
  level: number;
  /** Bajas totales del equipo. */
  kills: number;
  /** Bonus de scrap por limpiar la oleada (personal). */
  clearBonus: number;
}

export interface ScrapMsg {
  scrap: number;
  delta: number;
  reason: 'kill' | 'clear' | 'buy';
}

export interface BuyMsg {
  id: UpgradeId;
}

export interface GameOverEntry {
  id: number;
  name: string;
  kills: number;
  deaths: number;
  damage: number;
  scrap: number;
}

export interface GameOverMsg {
  /** Oleadas superadas. */
  level: number;
  /** Oleada en la que cayó el equipo. */
  wave: number;
  kills: number;
  durationSec: number;
  players: GameOverEntry[];
}

/** Constantes de ritmo de la sala (segundos). */
export const DEADHOLD = {
  /** Tiempo de preparación antes de que salga la primera horda de cada oleada. */
  graceSeconds: 4,
  /** Duración de la tienda entre oleadas. */
  shopSeconds: 30,
  /** Cada cuánto sale un lote de la cola de spawn. */
  spawnIntervalSeconds: 0.5,
  /** Enemigos por lote. */
  spawnBatch: 2,
  /** Jugadores máximos de la sala coop. */
  maxPlayers: 4,
} as const;
