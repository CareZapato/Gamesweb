import {
  DEADHOLD,
  DH_S2C,
  DT,
  drainSpawnQueue,
  type DeadholdPhase,
  type EnemyArchetypeId,
  enemiesInWave,
  generateShopOffers,
  getArchetype,
  type GameOverMsg,
  hash2,
  isMaxed,
  isOfferable,
  type LevelMsg,
  mulberry32,
  type OwnedUpgrades,
  PLAYER,
  planWave,
  resetPerWaveStacks,
  scaledEnemyStats,
  type ScrapMsg,
  scrapForKill,
  type ShopMsg,
  type ShopOffer,
  stacksOf,
  TICK_RATE,
  tryPurchase,
  UPGRADE_IDS,
  UPGRADES,
  type UpgradeId,
  upgradeBonus,
  upgradeCost,
  type Vec3,
  type WaveMsg,
  WAVES,
  waveClearBonus,
  WeaponId,
  WEAPONS,
  deadholdCanSelectWeapon,
  deadholdTeamUnlockedWeapons,
  deadholdUnlockedWeapons,
  isSpecialWave,
  isWeaponUnlockUpgrade,
  WEAPON_UNLOCK_UPGRADES,
} from '@arena/shared';
import type { GameSim, SimPlayer } from './GameSim';
import { newZombieMemory, type ZombieMelee, type ZombieMemory, zombieInput, zombieMelee } from './ZombieBrain';

/** Mejoras con efecto real en esta versión. El resto del catálogo no se ofrece ni se puede comprar. */
export const IMPLEMENTED_UPGRADES: ReadonlySet<UpgradeId> = new Set<UpgradeId>([
  'maxHealth',
  'heal',
  'hitscanDamage',
  'ammoRefill',
  'waveShield',
  'unlockShotgun',
  'unlockSniper',
  'unlockRocket',
  'unlockGrenade',
  'unlockPlasma',
  'unlockCharge',
]);

/** Los zombies usan ids altos para no chocar con los de los jugadores (que crecen desde 1). */
export const ZOMBIE_ID_BASE = 1000;

/** Mensaje saliente del director; la sala lo reparte (`to`: id de jugador o todos). */
export interface DirectorMsg {
  to: number | 'all';
  type: string;
  msg: unknown;
}

export interface WaveDirectorOptions {
  /** Semilla de la partida: varía la composición y las ofertas sin romper el determinismo. */
  seed?: number;
  /** Sustituye la composición de la oleada (tests: p. ej. 3 caminantes). */
  planWave?: (wave: number, seed: number) => EnemyArchetypeId[];
  graceSeconds?: number;
  shopSeconds?: number;
  maxAlive?: number;
  spawnIntervalSeconds?: number;
  spawnBatch?: number;
}

interface ZombieRuntime {
  archetype: EnemyArchetypeId;
  melee: ZombieMelee;
  mem: ZombieMemory;
  /** Mejor distancia al objetivo y cuándo se logró (para reubicar zombis atascados). */
  bestDist: number;
  bestAtTick: number;
}

interface HumanState {
  scrap: number;
  owned: OwnedUpgrades;
  offers: ShopOffer[];
  ready: boolean;
  /** Escudo temporal concedido para la oleada en curso (se retira al limpiarla). */
  waveShield: number;
}

/** Si un zombi no se acerca al objetivo en este tiempo, se reubica en un spawn de horda. */
const STUCK_RELOCATE_SECONDS = 12;
/** Mínimo acercamiento (m) que cuenta como progreso. */
const STUCK_PROGRESS = 1.5;
/** Frecuencia máxima del mensaje de oleada mientras cambian los contadores. */
const WAVE_MSG_EVERY_TICKS = Math.round(TICK_RATE / 3);

/**
 * Reducto: Horda — director de oleadas. Envuelve un `GameSim` en modo `survival`: crea y mueve los
 * zombis (`ZombieBrain`), reparte scrap, abre la tienda entre oleadas y detecta el fin de la partida.
 * Sin Colyseus ni relojes: la sala llama a `step()` una vez por tick (reemplaza a `sim.step()`) y
 * reparte lo que sale de `drainMessages()`.
 */
export class WaveDirector {
  phase: DeadholdPhase = 'combat';
  /** Oleada en curso (en `shop`: la que acaba de superarse). 0 antes de `start()`. */
  wave = 0;
  /** Oleadas superadas. */
  level = 0;
  readonly humans = new Map<number, HumanState>();
  private readonly zombies = new Map<number, ZombieRuntime>();
  private queue: EnemyArchetypeId[] = [];
  private waveTotal = 0;
  private graceLeft = 0;
  private spawnTimer = 0;
  private shopLeft = 0;
  /** Segundos hasta el próximo resurtido de munición en combate. */
  private ammoResupplyLeft = 0;
  private nextZombieId = ZOMBIE_ID_BASE;
  private started = false;
  private outbox: DirectorMsg[] = [];
  private waveDirty = false;
  private lastWaveMsgTick = -1e9;
  private readonly rng: () => number;
  private readonly seed: number;
  private readonly opts: Required<Omit<WaveDirectorOptions, 'planWave' | 'seed'>> & Pick<WaveDirectorOptions, 'planWave'>;

  constructor(
    readonly sim: GameSim,
    options: WaveDirectorOptions = {},
  ) {
    if (!sim.isSurvival) throw new Error('WaveDirector needs a survival GameSim');
    if ((sim.map.hordeSpawns?.length ?? 0) === 0) throw new Error(`map ${sim.map.id} has no horde spawns`);
    this.seed = (options.seed ?? 0) >>> 0;
    this.rng = mulberry32(hash2(this.seed, 0xdead));
    this.opts = {
      planWave: options.planWave,
      graceSeconds: options.graceSeconds ?? DEADHOLD.graceSeconds,
      shopSeconds: options.shopSeconds ?? DEADHOLD.shopSeconds,
      maxAlive: options.maxAlive ?? WAVES.maxAlive,
      spawnIntervalSeconds: options.spawnIntervalSeconds ?? DEADHOLD.spawnIntervalSeconds,
      spawnBatch: options.spawnBatch ?? DEADHOLD.spawnBatch,
    };
  }

  // ---------------------------------------------------------------- roster

  /** Registra la economía de un jugador ya añadido al sim. */
  registerHuman(id: number): void {
    if (this.humans.has(id)) return;
    this.humans.set(id, { scrap: 0, owned: {}, offers: [], ready: false, waveShield: 0 });
  }

  removeHuman(id: number): void {
    this.humans.delete(id);
  }

  /** Armas permitidas según desbloqueos de tienda (el servidor corrige cualquier otra petición). */
  canUseWeapon(id: number, weapon: number): boolean {
    const hs = this.humans.get(id);
    if (!hs) return weapon === WeaponId.Rifle;
    return deadholdCanSelectWeapon(weapon, deadholdUnlockedWeapons(hs.owned));
  }

  get zombieCount(): number {
    return this.zombies.size;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  get totalKills(): number {
    let n = 0;
    for (const p of this.sim.players.values()) if (p.kind === 'human') n += p.kills;
    return n;
  }

  drainMessages(): DirectorMsg[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }

  // ---------------------------------------------------------------- lifecycle

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startWave(1);
  }

  /** Avanza la partida un tick (incluye `sim.step()`). */
  step(): void {
    if (!this.started || this.phase === 'gameover') return;
    if (this.phase === 'combat') this.stepCombat();
    else this.stepShop();
    this.flushWaveMsg();
  }

  private stepCombat(): void {
    const sim = this.sim;
    if (this.graceLeft > 0) this.graceLeft = Math.max(0, this.graceLeft - DT);
    else {
      this.spawnStep();
      this.ammoResupplyLeft -= DT;
      if (this.ammoResupplyLeft <= 0) {
        this.ammoResupplyLeft = DEADHOLD.ammoResupplySeconds;
        this.syncSurvivalAmmo('resupply');
      }
    }

    for (const [id, zr] of this.zombies) {
      const z = sim.players.get(id);
      if (!z?.alive) continue;
      sim.queueInput(id, zombieInput(sim, z, zr.melee, zr.mem, sim.tick));
    }
    sim.step();
    for (const [id, zr] of this.zombies) {
      const z = sim.players.get(id);
      if (z) zombieMelee(sim, z, zr.melee, zr.mem);
    }
    this.reapZombies();
    this.relocateStuck();

    if (this.aliveHumans().length === 0) return this.gameOver();
    if (this.graceLeft <= 0 && this.queue.length === 0 && this.zombies.size === 0) this.clearWave();
  }

  private shopAllReady(): boolean {
    const alive = this.aliveHumans();
    if (alive.length === 0) return false;
    return alive.every((p) => {
      if (!p.connected) return true;
      return this.humans.get(p.id)?.ready === true;
    });
  }

  private stepShop(): void {
    this.sim.step();
    if (this.aliveHumans().length === 0) return this.gameOver();
    this.shopLeft = Math.max(0, this.shopLeft - DT);
    this.waveDirty = true;
    if (this.shopLeft <= 0 || this.shopAllReady()) this.startWave(this.wave + 1);
  }

  private aliveHumans(): SimPlayer[] {
    const out: SimPlayer[] = [];
    for (const p of this.sim.players.values()) if (p.kind === 'human' && p.alive) out.push(p);
    return out;
  }

  // ---------------------------------------------------------------- waves

  private syncSurvivalAmmo(mode: 'waveStart' | 'resupply'): void {
    const owned = [...this.humans.values()].map((hs) => hs.owned);
    const weapons = deadholdTeamUnlockedWeapons(owned);
    this.sim.layoutSurvivalAmmo(
      weapons,
      DEADHOLD.ammoSlotsPerWeapon,
      mode,
      DEADHOLD.ammoResupplyCount,
    );
  }

  private startWave(n: number): void {
    this.wave = n;
    this.phase = 'combat';
    this.sim.resetWavePickups();
    this.syncSurvivalAmmo('waveStart');
    this.ammoResupplyLeft = DEADHOLD.ammoResupplySeconds;
    const plan = this.opts.planWave ? this.opts.planWave(n, this.seed) : planWave(n, this.seed);
    this.queue = [...plan];
    this.waveTotal = plan.length;
    this.graceLeft = this.opts.graceSeconds;
    this.spawnTimer = 0;
    for (const [id, hs] of this.humans) {
      hs.ready = false;
      hs.offers = [];
      // Escudo de oleada: se aplica ahora y se retira al limpiarla; el stack se consume.
      const p = this.sim.players.get(id);
      const bonus = upgradeBonus(hs.owned, 'waveShield');
      hs.waveShield = 0;
      if (p?.alive && bonus > 0) {
        const before = p.shield;
        p.maxShield = Math.max(p.maxShield, PLAYER.maxShield + bonus);
        p.shield = Math.min(p.maxShield, p.shield + bonus);
        hs.waveShield = p.shield - before;
      }
      hs.owned = resetPerWaveStacks(hs.owned);
    }
    this.waveDirty = true;
    this.sendWaveMsg();
  }

  private clearWave(): void {
    this.level = this.wave;
    this.phase = 'shop';
    this.shopLeft = this.opts.shopSeconds;
    const eliteShop = isSpecialWave(this.wave);
    const clearBonus = waveClearBonus(this.wave) * (eliteShop ? 2 : 1);
    const kills = this.totalKills;
    for (const [id, hs] of this.humans) {
      const p = this.sim.players.get(id);
      if (!p?.alive) continue;
      // el escudo de oleada era temporal
      if (hs.waveShield > 0) p.shield = Math.max(0, p.shield - hs.waveShield);
      p.maxShield = PLAYER.maxShield;
      p.shield = Math.min(p.shield, p.maxShield);
      hs.waveShield = 0;
      hs.scrap += clearBonus;
      hs.ready = false;
      hs.offers = this.makeOffers(id, hs, eliteShop);
      this.outbox.push({ to: id, type: DH_S2C.Level, msg: { level: this.level, kills, clearBonus } satisfies LevelMsg });
      this.sendScrap(id, hs, clearBonus, 'clear');
      this.sendShop(id, hs);
    }
    this.waveDirty = true;
    this.sendWaveMsg();
  }

  private gameOver(): void {
    this.phase = 'gameover';
    const players = [...this.sim.players.values()]
      .filter((p) => p.kind === 'human')
      .map((p) => ({
        id: p.id,
        name: p.name,
        kills: p.kills,
        deaths: p.deaths,
        damage: Math.round(p.damageDealt),
        scrap: this.humans.get(p.id)?.scrap ?? 0,
      }));
    this.sendWaveMsg();
    this.outbox.push({
      to: 'all',
      type: DH_S2C.Over,
      msg: {
        level: this.level,
        wave: this.wave,
        kills: this.totalKills,
        durationSec: Math.round(this.sim.elapsed),
        players,
      } satisfies GameOverMsg,
    });
  }

  // ---------------------------------------------------------------- zombies

  private spawnStep(): void {
    if (this.queue.length === 0) return;
    this.spawnTimer -= DT;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.opts.spawnIntervalSeconds;
    const { spawn, rest } = drainSpawnQueue(this.queue, this.zombies.size, this.opts.maxAlive);
    const now = spawn.slice(0, this.opts.spawnBatch);
    if (now.length === 0) return;
    this.queue = [...spawn.slice(now.length), ...rest];
    for (const arch of now) this.spawnZombie(arch);
    this.waveDirty = true;
  }

  private hordePoint(): Vec3 {
    const spawns = this.sim.map.hordeSpawns!;
    const s = spawns[Math.floor(this.rng() * spawns.length)]!;
    // jitter so a batch does not pile up on one spot
    return { x: s[0] + (this.rng() - 0.5) * 3, y: s[1], z: s[2] + (this.rng() - 0.5) * 3 };
  }

  private spawnZombie(archetype: EnemyArchetypeId): void {
    const a = getArchetype(archetype);
    const stats = scaledEnemyStats(archetype, this.wave);
    const pos = this.hordePoint();
    const id = this.nextZombieId++;
    const yaw = Math.atan2(pos.x, pos.z);
    // zombis en el equipo 1; los humanos en el 0
    const z = this.sim.addZombie(id, a.label, 1, archetype, pos, yaw, {
      hp: stats.hp,
      shield: stats.shield,
      speedMult: stats.speed / PLAYER.runSpeed,
    });
    const melee: ZombieMelee = {
      damage: stats.damage,
      attackInterval: a.attackInterval,
      attackRange: a.attackRange,
      knockback: a.knockback,
    };
    this.zombies.set(id, {
      archetype,
      melee,
      mem: newZombieMemory(melee, z.sim.x, z.sim.z),
      bestDist: Infinity,
      bestAtTick: this.sim.tick,
    });
  }

  /** Quita del sim los zombis caídos y reparte el scrap a quien los mató. */
  private reapZombies(): void {
    let reaped = false;
    for (const [id, zr] of this.zombies) {
      const z = this.sim.players.get(id);
      if (z?.alive) continue;
      if (z) {
        const killer = this.humans.get(z.lastAttacker);
        if (killer && this.sim.players.get(z.lastAttacker)?.kind === 'human') {
          const scrap = scrapForKill(zr.archetype, this.wave);
          killer.scrap += scrap;
          this.sendScrap(z.lastAttacker, killer, scrap, 'kill');
        }
      }
      this.sim.removePlayer(id);
      this.zombies.delete(id);
      reaped = true;
    }
    if (reaped) this.waveDirty = true;
  }

  /** Reubica en un spawn de horda a los zombis que llevan demasiado sin acercarse a nadie. */
  private relocateStuck(): void {
    const sim = this.sim;
    if (sim.tick % TICK_RATE !== 0) return;
    const limit = STUCK_RELOCATE_SECONDS * TICK_RATE;
    for (const [id, zr] of this.zombies) {
      const z = sim.players.get(id);
      if (!z?.alive) continue;
      let d = Infinity;
      for (const h of sim.players.values()) {
        if (h.kind !== 'human' || !h.alive) continue;
        d = Math.min(d, Math.hypot(h.sim.x - z.sim.x, h.sim.z - z.sim.z));
      }
      if (d < zr.bestDist - STUCK_PROGRESS) {
        zr.bestDist = d;
        zr.bestAtTick = sim.tick;
      } else if (sim.tick - zr.bestAtTick > limit && d > zr.melee.attackRange * 2) {
        const p = this.hordePoint();
        z.sim.x = p.x;
        z.sim.y = p.y;
        z.sim.z = p.z;
        z.sim.vx = 0;
        z.sim.vy = 0;
        z.sim.vz = 0;
        zr.bestDist = Infinity;
        zr.bestAtTick = sim.tick;
      }
    }
  }

  // ---------------------------------------------------------------- shop

  private makeOffers(id: number, hs: HumanState, elite = false): ShopOffer[] {
    // las mejoras sin efecto implementado se tratan como "agotadas" para no venderlas
    const owned: OwnedUpgrades = { ...hs.owned };
    for (const u of UPGRADE_IDS) if (!IMPLEMENTED_UPGRADES.has(u)) owned[u] = UPGRADES[u].maxStack;
    const seed = hash2(this.seed, id);
    const offers = generateShopOffers(this.wave, owned, seed, { elite });
    return this.ensureAffordableOffers(offers, owned, hs.scrap);
  }

  /** Sustituye ofertas caras por mejoras implementadas asequibles (evita tiendas “todo bloqueado”). */
  private ensureAffordableOffers(offers: ShopOffer[], owned: OwnedUpgrades, scrap: number): ShopOffer[] {
    let afford = offers.filter((o) => o.cost <= scrap).length;
    if (afford >= 2 || scrap <= 0) return offers;
    const inShop = new Set(offers.map((o) => o.id));
    const pool = [...IMPLEMENTED_UPGRADES]
      .filter((id) => isOfferable(owned, id) && !inShop.has(id))
      .map((id) => ({ id, cost: upgradeCost(id, stacksOf(owned, id)) }))
      .filter((x) => x.cost <= scrap)
      .sort((a, b) => a.cost - b.cost);
    const out = offers.map((o) => ({ ...o }));
    for (let i = out.length - 1; i >= 0 && afford < 2 && pool.length > 0; i--) {
      if (out[i]!.cost <= scrap) continue;
      const pick = pool.shift()!;
      inShop.delete(out[i]!.id);
      inShop.add(pick.id);
      const stacks = stacksOf(owned, pick.id);
      out[i] = { id: pick.id, cost: pick.cost, stacks, rarity: UPGRADES[pick.id].rarity };
      afford++;
    }
    return out;
  }

  /** Compra `id` en la tienda abierta. Devuelve el motivo del rechazo, o null si salió bien. */
  buy(playerId: number, id: UpgradeId): 'closed' | 'dead' | 'unavailable' | 'maxed' | 'funds' | null {
    const hs = this.humans.get(playerId);
    const p = this.sim.players.get(playerId);
    if (!hs || !p) return 'unavailable';
    if (this.phase !== 'shop') return 'closed';
    if (!p.alive) return 'dead';
    if (!IMPLEMENTED_UPGRADES.has(id) || !hs.offers.some((o) => o.id === id)) return 'unavailable';
    const res = tryPurchase({ scrap: hs.scrap, owned: hs.owned }, id);
    if (!res.ok) return res.reason;
    hs.scrap = res.state.scrap;
    hs.owned = res.state.owned;
    this.applyUpgrade(p, hs, id);
    // refresca la oferta comprada (nuevo coste / agotada)
    hs.offers = hs.offers
      .map((o) => {
        if (o.id !== id) return o;
        const stacks = stacksOf(hs.owned, id);
        return { ...o, stacks, cost: upgradeCost(id, stacks) };
      })
      .filter((o) => !isMaxed(hs.owned, o.id));
    this.sendScrap(playerId, hs, -res.cost, 'buy');
    this.sendShop(playerId, hs);
    return null;
  }

  private applyUpgrade(p: SimPlayer, hs: HumanState, id: UpgradeId): void {
    switch (id) {
      case 'maxHealth': {
        const gain = UPGRADES.maxHealth.perStack;
        p.maxHp = PLAYER.maxHealth + upgradeBonus(hs.owned, 'maxHealth');
        p.hp = Math.min(p.maxHp, p.hp + gain);
        break;
      }
      case 'heal':
        p.hp = p.maxHp;
        break;
      case 'hitscanDamage':
        p.damageMult = 1 + upgradeBonus(hs.owned, 'hitscanDamage');
        break;
      case 'ammoRefill': {
        const frac = UPGRADES.ammoRefill.perStack;
        for (let w = 0; w < WEAPONS.length; w++) {
          p.sim.ammo[w] = Math.min(WEAPONS[w]!.maxAmmo, p.sim.ammo[w]! + Math.ceil(WEAPONS[w]!.maxAmmo * frac));
        }
        break;
      }
      default:
        if (isWeaponUnlockUpgrade(id)) this.unlockWeaponForPlayer(p, WEAPON_UNLOCK_UPGRADES[id]);
        break; // waveShield: se aplica al empezar la oleada
    }
  }

  private unlockWeaponForPlayer(p: SimPlayer, weaponId: number): void {
    const w = WEAPONS[weaponId];
    if (!w) return;
    p.sim.ammo[weaponId] = Math.max(p.sim.ammo[weaponId] ?? 0, w.startAmmo);
  }

  /** El jugador marca que está listo para la siguiente oleada. */
  setReady(playerId: number): void {
    const hs = this.humans.get(playerId);
    if (hs && this.phase === 'shop') hs.ready = true;
    if (this.phase === 'shop' && this.shopAllReady()) this.startWave(this.wave + 1);
  }

  /** Reenvía el estado actual a un jugador que acaba de reconectarse. */
  resync(playerId: number): void {
    this.outbox.push({ to: playerId, type: DH_S2C.Wave, msg: this.waveMsg() });
    const hs = this.humans.get(playerId);
    if (hs && this.phase === 'shop') this.sendShop(playerId, hs);
  }

  // ---------------------------------------------------------------- messages

  private waveMsg(): WaveMsg {
    return {
      phase: this.phase,
      wave: this.wave,
      total: this.waveTotal || enemiesInWave(this.wave),
      alive: this.zombies.size,
      queued: this.queue.length,
      timer: Math.ceil(this.phase === 'shop' ? this.shopLeft : this.graceLeft),
      special: this.phase === 'combat' && isSpecialWave(this.wave),
    };
  }

  private sendWaveMsg(): void {
    this.waveDirty = false;
    this.lastWaveMsgTick = this.sim.tick;
    this.outbox.push({ to: 'all', type: DH_S2C.Wave, msg: this.waveMsg() });
  }

  private flushWaveMsg(): void {
    if (this.waveDirty && this.sim.tick - this.lastWaveMsgTick >= WAVE_MSG_EVERY_TICKS) this.sendWaveMsg();
  }

  private sendScrap(id: number, hs: HumanState, delta: number, reason: ScrapMsg['reason']): void {
    this.outbox.push({ to: id, type: DH_S2C.Scrap, msg: { scrap: hs.scrap, delta, reason } satisfies ScrapMsg });
  }

  private sendShop(id: number, hs: HumanState): void {
    this.outbox.push({
      to: id,
      type: DH_S2C.Shop,
      msg: {
        wave: this.wave,
        offers: hs.offers,
        scrap: hs.scrap,
        owned: hs.owned,
        endsIn: Math.ceil(this.shopLeft),
      } satisfies ShopMsg,
    });
  }
}
