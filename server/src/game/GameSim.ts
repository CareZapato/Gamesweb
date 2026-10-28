import {
  Btn,
  CollisionWorld,
  computeExplosion,
  createPlayerSimState,
  DT,
  eyePosition,
  type FireResult,
  type FlagSnap,
  FlagState,
  type GameEvent,
  type GameEventBody,
  getMap,
  getWeapon,
  hitscanDamage,
  hitZonePoint,
  mergeHitZone,
  type HitZone,
  type HitTarget,
  type InputCmd,
  isHealthPickup,
  isShieldPickup,
  type MapDef,
  mapSupportsMode,
  type MatchResults,
  type MatchSettings,
  MODE_RULES,
  type MovementEnv,
  multiKillLabel,
  mulberry32,
  playerAABB,
  rankPlayers,
  type DeathCause,
  STREAK_RULES,
  spreeLabel,
  NET,
  type OwnState,
  PF,
  PICKUPS,
  PLAYER,
  type PlayerSimState,
  type PlayerSnap,
  type ProjectileSnap,
  type ProjectileState,
  projectileConfig,
  projectileId,
  q100,
  q1000,
  type ResultEntry,
  type ScoreEntry,
  shotDirections,
  stepMovement,
  stepProjectile,
  stepWeapon,
  TICK_RATE,
  traceHitscan,
  type Vec3,
  type V3T,
  WEAPON_COUNT,
  WEAPONS,
} from '@arena/shared';

export interface SimPlayer {
  id: number;
  name: string;
  team: number;
  sim: PlayerSimState;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  alive: boolean;
  respawnTimer: number;
  protectTimer: number;
  kills: number;
  deaths: number;
  score: number;
  captures: number;
  /** Effective damage dealt to enemies (health + shield actually removed, never overkill). */
  damageDealt: number;
  lastSeq: number;
  queue: InputCmd[];
  credits: number;
  starve: number;
  lastCmd: InputCmd | null;
  connected: boolean;
  /** Team index of the flag being carried, or -1. */
  carrying: number;
  lastAttacker: number;
  lastAttackTick: number;
  /** Kills in the current multi-kill chain (resets on timeout or death). */
  multiChain: number;
  lastMultiKillTick: number;
  /** Consecutive kills without dying. */
  spree: number;
  bestSpree: number;
  bestMulti: number;
  /** Incremented on every spawn; used to avoid rewinding across a respawn teleport. */
  life: number;
  /** Counters exposed for tests and diagnostics. */
  shotsFired: number;
  rejectedInputs: number;
}

interface FlagRuntime {
  team: number;
  home: Vec3;
  state: FlagState;
  pos: Vec3;
  carrier: number;
  returnTimer: number;
}

interface PickupRuntime {
  available: boolean;
  timer: number;
}

interface HistoryEntry {
  tick: number;
  players: Map<number, { x: number; y: number; z: number; alive: boolean; life: number }>;
}

const toV3T = (v: Vec3): V3T => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];

/**
 * Authoritative match simulation. Pure TypeScript: no networking, no DOM, no timers.
 * The room feeds it inputs and calls step() at a fixed rate.
 */
export class GameSim {
  readonly map: MapDef;
  readonly world: CollisionWorld;
  readonly settings: MatchSettings;
  readonly players = new Map<number, SimPlayer>();
  readonly projectiles: ProjectileState[] = [];
  readonly flags: FlagRuntime[] = [];
  readonly pickups: PickupRuntime[];
  readonly teamScores = [0, 0];
  tick = 0;
  elapsed = 0;
  ended = false;
  results: MatchResults | null = null;
  private events: GameEvent[] = [];
  private nextEventId = 1;
  private history: HistoryEntry[] = [];
  private rng: () => number;

  constructor(settings: MatchSettings, seed = Date.now() >>> 0) {
    const map = getMap(settings.mapId);
    if (!map) throw new Error(`unknown map ${settings.mapId}`);
    if (!mapSupportsMode(map, settings.mode)) throw new Error(`map ${map.id} does not support ${settings.mode}`);
    this.map = map;
    this.world = new CollisionWorld(map);
    this.settings = {
      ...settings,
      botCount: settings.botCount ?? 0,
      botDifficulty: settings.botDifficulty ?? 'normal',
    };
    this.rng = mulberry32(seed);
    this.pickups = map.pickups.map(() => ({ available: true, timer: 0 }));
    if (settings.mode === 'ctf') {
      for (const f of map.flags) {
        const home = { x: f.pos[0], y: f.pos[1], z: f.pos[2] };
        this.flags[f.team] = { team: f.team, home, state: FlagState.Home, pos: { ...home }, carrier: -1, returnTimer: 0 };
      }
    }
  }

  get isTeamMode(): boolean {
    return this.settings.mode === 'ctf';
  }

  get timeLeft(): number {
    return Math.max(0, this.settings.timeLimit * 60 - this.elapsed);
  }

  // ---------------------------------------------------------------- players

  addPlayer(id: number, name: string, team: number): SimPlayer {
    const p: SimPlayer = {
      id,
      name,
      team: this.isTeamMode ? team : -1,
      sim: createPlayerSimState(),
      yaw: 0,
      pitch: 0,
      hp: 0,
      maxHp: PLAYER.maxHealth,
      shield: 0,
      maxShield: PLAYER.maxShield,
      alive: false,
      respawnTimer: 0,
      protectTimer: 0,
      kills: 0,
      deaths: 0,
      score: 0,
      captures: 0,
      damageDealt: 0,
      lastSeq: -1,
      queue: [],
      credits: 0,
      starve: 0,
      lastCmd: null,
      connected: true,
      carrying: -1,
      lastAttacker: -1,
      lastAttackTick: -1e9,
      multiChain: 0,
      lastMultiKillTick: -1e9,
      spree: 0,
      bestSpree: 0,
      bestMulti: 0,
      life: 0,
      shotsFired: 0,
      rejectedInputs: 0,
    };
    this.players.set(id, p);
    this.respawn(p);
    return p;
  }

  removePlayer(id: number): void {
    const p = this.players.get(id);
    if (!p) return;
    this.dropFlag(p, true);
    this.players.delete(id);
    for (const other of this.players.values()) if (other.lastAttacker === id) other.lastAttacker = -1;
  }

  /** Connection lost (may come back). The player leaves play immediately and drops any flag. */
  setConnected(id: number, connected: boolean): void {
    const p = this.players.get(id);
    if (!p || p.connected === connected) return;
    p.connected = connected;
    if (!connected) {
      this.dropFlag(p, true);
      p.alive = false;
      p.respawnTimer = 0;
      p.queue.length = 0;
    }
  }

  /** Queues an input. Returns false when it was rejected (stale, duplicate or flooding). */
  queueInput(id: number, cmd: InputCmd): boolean {
    const p = this.players.get(id);
    if (!p || !p.connected) return false;
    const lastQueued = p.queue.length > 0 ? p.queue[p.queue.length - 1].seq : p.lastSeq;
    if (cmd.seq <= lastQueued || p.queue.length >= NET.maxQueuedInputs) {
      p.rejectedInputs++;
      return false;
    }
    p.queue.push(cmd);
    return true;
  }

  // ---------------------------------------------------------------- events

  private emit(ev: GameEventBody): void {
    this.events.push({ ...ev, e: this.nextEventId++ } as GameEvent);
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ---------------------------------------------------------------- main step

  step(): void {
    if (this.ended) return;
    this.tick++;
    this.elapsed += DT;

    for (const p of this.players.values()) this.stepPlayer(p);
    this.stepProjectiles();
    this.stepPickups();
    if (this.isTeamMode) this.stepFlags();
    this.recordHistory();

    if (!this.ended && this.timeLeft <= 0) this.end('time');
  }

  private stepPlayer(p: SimPlayer): void {
    if (!p.alive) {
      // inputs sent while dead are acknowledged but not simulated
      while (p.queue.length > 0) p.lastSeq = p.queue.shift()!.seq;
      p.credits = 0;
      if (!p.connected) return;
      p.respawnTimer -= DT;
      if (p.respawnTimer <= 0) this.respawn(p);
      return;
    }
    if (p.protectTimer > 0) p.protectTimer = Math.max(0, p.protectTimer - DT);

    p.credits = Math.min(p.credits + 1, NET.maxInputCredits);
    let processed = 0;
    while (p.queue.length > 0 && p.credits >= 1 && p.alive) {
      const cmd = p.queue.shift()!;
      p.credits -= 1;
      this.applyInput(p, cmd, true);
      processed++;
    }
    if (processed > 0) {
      p.starve = 0;
    } else if (++p.starve >= NET.starveTicks && p.alive) {
      // no input for a while (lag spike / tab hidden): keep physics running without acting
      const idle: InputCmd = { seq: p.lastSeq, buttons: 0, yaw: p.yaw, pitch: p.pitch, weapon: p.sim.weapon, viewTick: this.tick };
      this.applyInput(p, idle, false);
    }

    this.checkLava(p);
    if (p.alive && p.sim.y < this.world.killY) this.kill(p, -1, -1, false, 'fall');
  }

  /** Lava ignores the shield: touching it is always lethal. */
  private checkLava(p: SimPlayer): void {
    if (!p.alive || this.world.lava.length === 0) return;
    if (this.world.touchesLava(playerAABB(p.sim.x, p.sim.y, p.sim.z, PLAYER.radius, PLAYER.height))) this.kill(p, -1, -1, false, 'lava');
  }

  /** Portal exits count as occupied while another living player stands on them. */
  private movementEnv(p: SimPlayer): MovementEnv {
    return {
      exitBlocked: (x, y, z) => {
        for (const o of this.players.values()) {
          if (o === p || !o.alive) continue;
          if (Math.abs(o.sim.x - x) < PLAYER.radius * 2 && Math.abs(o.sim.z - z) < PLAYER.radius * 2 && Math.abs(o.sim.y - y) < PLAYER.height) return true;
        }
        return false;
      },
    };
  }

  private applyInput(p: SimPlayer, cmd: InputCmd, real: boolean): void {
    if (real) {
      p.lastSeq = cmd.seq;
      p.lastCmd = cmd;
    }
    p.yaw = cmd.yaw;
    p.pitch = cmd.pitch;
    const s = p.sim;
    const prevDashCd = s.dashCd;
    const wasGround = s.onGround;
    const warps = s.warps;
    const pads = s.pads;
    stepMovement(s, cmd, this.world, DT, this.world.portals.length > 0 ? this.movementEnv(p) : undefined);
    if (s.warps !== warps) {
      // links are pairs, so exactly one portal leads to the destination
      const entry = this.world.portals.findIndex((pt) => pt.to === s.warpTo);
      this.emit({ k: 'warp', p: p.id, from: entry, to: s.warpTo });
    }
    if (s.pads !== pads) {
      const i = this.world.jumpPads.findIndex((pad) => Math.hypot(pad.pos[0] - s.x, pad.pos[2] - s.z) <= pad.radius + 0.5);
      this.emit({ k: 'pad', p: p.id, i });
    }
    this.checkLava(p);
    if (!p.alive) return;
    if (s.dashCd > prevDashCd) this.emit({ k: 'dash', p: p.id });
    if (wasGround && !s.onGround && s.vy > PLAYER.jumpSpeed * 0.5 && cmd.buttons & Btn.Jump) this.emit({ k: 'jump', p: p.id });

    const fire = stepWeapon(s, cmd, DT, p.id);
    if (fire) {
      p.shotsFired++;
      if (p.protectTimer > 0) p.protectTimer = 0;
      this.handleFire(p, fire, cmd);
    }
  }

  // ---------------------------------------------------------------- combat

  /**
   * Positions of other players as the shooter saw them (lag compensation). The requested view time is
   * clamped to [now - maxRewind, now] and never crosses a respawn.
   */
  rewoundTargets(viewTick: number, shooterId: number): HitTarget[] {
    const maxRewindTicks = (NET.maxRewindMs / 1000) * TICK_RATE;
    const now = this.tick;
    const vt = Math.min(now, Math.max(now - maxRewindTicks, viewTick));
    const out: HitTarget[] = [];
    const current = () => {
      for (const p of this.players.values())
        if (p.alive && p.id !== shooterId)
          out.push({ id: p.id, x: p.sim.x, y: p.sim.y, z: p.sim.z, crouched: p.sim.crouched || p.sim.slideTime > 0 });
      return out;
    };
    if (now - vt < 0.01 || this.history.length === 0) return current();
    const t0 = Math.floor(vt);
    const t1 = Math.ceil(vt);
    const a = this.history.find((h) => h.tick === t0);
    const b = this.history.find((h) => h.tick === t1) ?? a;
    if (!a || !b) return current();
    const f = t1 === t0 ? 0 : vt - t0;
    for (const p of this.players.values()) {
      if (!p.alive || p.id === shooterId) continue;
      const pa = a.players.get(p.id);
      const pb = b.players.get(p.id);
      if (!pa || !pb || !pa.alive || !pb.alive || pa.life !== p.life || pb.life !== p.life) continue;
      out.push({
        id: p.id,
        x: pa.x + (pb.x - pa.x) * f,
        y: pa.y + (pb.y - pa.y) * f,
        z: pa.z + (pb.z - pa.z) * f,
        crouched: p.sim.crouched || p.sim.slideTime > 0,
      });
    }
    return out;
  }

  private handleFire(p: SimPlayer, fire: FireResult, cmd: InputCmd): void {
    const w = getWeapon(fire.weapon);
    const origin = eyePosition(p.sim);
    if (w.kind === 'hitscan') {
      const dirs = shotDirections(fire.weapon, cmd.yaw, cmd.pitch, fire.spread, fire.seed);
      const targets = this.rewoundTargets(cmd.viewTick, p.id);
      const dmg = new Map<number, { amount: number; zone: HitZone; at: Vec3 }>();
      const ends: V3T[] = [];
      const hitWorld: boolean[] = [];
      for (const d of dirs) {
        const tr = traceHitscan(this.world, origin, d, w.range, targets, p.id);
        ends.push(toV3T(tr.end));
        hitWorld.push(tr.normal !== null);
        if (tr.targetId >= 0) {
          const tgt = targets.find((t) => t.id === tr.targetId);
          const cur = dmg.get(tr.targetId) ?? { amount: 0, zone: tr.zone, at: tgt ? hitZonePoint(tgt, tr.zone) : tr.end };
          cur.amount += hitscanDamage(w, tr.t, tr.zone, fire.charge);
          cur.zone = mergeHitZone(cur.zone, tr.zone);
          cur.at = tgt ? hitZonePoint(tgt, cur.zone) : cur.at;
          dmg.set(tr.targetId, cur);
        }
      }
      this.emit({ k: 'shot', p: p.id, w: fire.weapon, o: toV3T(origin), ends, hitWorld, ...(w.charge ? { c: Math.round(fire.charge * 100) / 100 } : {}) });
      for (const [id, d] of dmg) {
        const victim = this.players.get(id);
        if (victim) this.damage(victim, p.id, d.amount, fire.weapon, d.zone, d.at, origin);
      }
      return;
    }

    const cfg = w.projectile;
    const dir = shotDirections(fire.weapon, cmd.yaw, cmd.pitch, 0, fire.seed)[0];
    const spawn = { x: origin.x + dir.x * 0.6, y: origin.y + dir.y * 0.6 - 0.15, z: origin.z + dir.z * 0.6 };
    const proj: ProjectileState = {
      id: projectileId(p.id, p.sim.shotCounter),
      owner: p.id,
      weapon: fire.weapon,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      vx: dir.x * cfg.speed,
      vy: dir.y * cfg.speed + cfg.launchLift,
      vz: dir.z * cfg.speed,
      age: 0,
      bounces: 0,
      resting: false,
    };
    this.emit({ k: 'fire', p: p.id, w: fire.weapon });
    const hit = this.world.raycast(origin, dir, 0.6 + cfg.radius);
    if (hit) {
      // muzzle is inside a wall: explode right there instead of spawning through it
      const at = { x: origin.x + dir.x * Math.max(0, hit.t - 0.1), y: origin.y + dir.y * Math.max(0, hit.t - 0.1), z: origin.z + dir.z * Math.max(0, hit.t - 0.1) };
      this.explode(proj, at);
      return;
    }
    this.projectiles.push(proj);
  }

  private stepProjectiles(): void {
    const targets: HitTarget[] = [];
    for (const p of this.players.values())
      if (p.alive)
        targets.push({
          id: p.id,
          x: p.sim.x,
          y: p.sim.y,
          z: p.sim.z,
          crouched: p.sim.crouched || p.sim.slideTime > 0,
        });
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      const res = stepProjectile(pr, this.world, DT, targets);
      if (res.bounced) this.emit({ k: 'bounce', pos: toV3T(pr) });
      if (res.exploded || pr.y < this.world.killY) {
        this.projectiles.splice(i, 1);
        this.explode(pr, { x: res.x, y: res.y, z: res.z });
      }
    }
  }

  private explode(pr: ProjectileState, at: Vec3): void {
    const cfg = projectileConfig(pr.weapon);
    this.emit({ k: 'boom', w: pr.weapon, pos: toV3T(at), pid: pr.id });
    const targets: HitTarget[] = [];
    for (const p of this.players.values())
      if (p.alive)
        targets.push({
          id: p.id,
          x: p.sim.x,
          y: p.sim.y,
          z: p.sim.z,
          crouched: p.sim.crouched || p.sim.slideTime > 0,
        });
    for (const h of computeExplosion(this.world, at, cfg, targets)) {
      const victim = this.players.get(h.id);
      if (!victim) continue;
      const self = h.id === pr.owner;
      const owner = this.players.get(pr.owner);
      const friendly = !self && this.isTeamMode && owner !== undefined && owner.team === victim.team;
      if (!friendly) {
        victim.sim.vx += h.impulse.x;
        victim.sim.vy += h.impulse.y;
        victim.sim.vz += h.impulse.z;
        if (h.impulse.y > 0) victim.sim.onGround = false;
      }
      const amount = Math.round(h.damage * (self ? cfg.selfDamageScale : 1));
      if (amount > 0) {
        const ht: HitTarget = {
          id: victim.id,
          x: victim.sim.x,
          y: victim.sim.y,
          z: victim.sim.z,
          crouched: victim.sim.crouched || victim.sim.slideTime > 0,
        };
        this.damage(victim, pr.owner, amount, pr.weapon, 'body', hitZonePoint(ht, 'body'), at);
      }
    }
  }

  damage(victim: SimPlayer, attackerId: number, amount: number, weapon: number, zone: HitZone, at: Vec3, from: Vec3): void {
    if (!victim.alive || this.ended || amount <= 0) return;
    if (victim.protectTimer > 0 && attackerId !== victim.id) return;
    const attacker = this.players.get(attackerId);
    if (this.isTeamMode && attacker && attacker.id !== victim.id && attacker.team === victim.team) return;
    // the shield takes the hit first; whatever it cannot absorb goes to health
    const toShield = Math.min(victim.shield, amount);
    const toHealth = amount - toShield;
    const effective = toShield + Math.min(Math.max(0, victim.hp), toHealth);
    victim.shield -= toShield;
    victim.hp -= toHealth;
    const head = zone === 'head';
    const ev: GameEventBody = { k: 'hit', a: attackerId, v: victim.id, dmg: amount, head, zone, at: toV3T(at), from: toV3T(from) };
    if (toShield > 0) {
      ev.sd = toShield;
      if (victim.shield <= 0) ev.sb = true;
    }
    this.emit(ev);
    if (attacker && attacker.id !== victim.id) {
      // only enemies reach this point (team damage returned above), and only once per hit
      attacker.damageDealt += effective;
      victim.lastAttacker = attacker.id;
      victim.lastAttackTick = this.tick;
    }
    if (victim.hp <= 0) this.kill(victim, attackerId, weapon, head);
  }

  kill(victim: SimPlayer, killerId: number, weapon: number, head: boolean, cause?: DeathCause): void {
    if (!victim.alive) return;
    victim.alive = false;
    victim.hp = 0;
    victim.deaths++;
    victim.respawnTimer = PLAYER.respawnDelay;
    victim.queue.length = 0;
    // environmental deaths shortly after being hit count for the last attacker
    if (killerId < 0 && victim.lastAttacker >= 0 && this.tick - victim.lastAttackTick < 5 * TICK_RATE && this.players.has(victim.lastAttacker)) {
      killerId = victim.lastAttacker;
    }
    const killer = this.players.get(killerId);
    const suicide = !killer || killer.id === victim.id;
    const teamKill =
      !suicide && this.isTeamMode && killer!.team === victim.team;
    const countsForStreak = !suicide && !teamKill;

    if (victim.spree >= STREAK_RULES.spreeEndMin) {
      const body: GameEventBody = { k: 'streak', p: victim.id, kind: 'ended', n: victim.spree };
      if (countsForStreak) body.by = killer!.id;
      this.emit(body);
    }
    victim.spree = 0;
    victim.multiChain = 0;
    victim.lastMultiKillTick = -1e9;

    if (suicide) {
      victim.score -= MODE_RULES.dm.suicidePenalty;
    } else {
      killer!.kills++;
      killer!.score += this.isTeamMode ? MODE_RULES.ctf.killPoints : 1;
      if (countsForStreak) this.registerStreakKill(killer!);
    }
    this.dropFlag(victim, false);
    const ev: GameEventBody = { k: 'kill', killer: suicide ? victim.id : killer!.id, victim: victim.id, w: weapon, suicide, head };
    if (cause) ev.cause = cause;
    this.emit(ev);
    if (!this.isTeamMode && !suicide && killer!.score >= this.settings.scoreLimit) this.end('score');
  }

  /** Valid enemy kill: extends spree and multi-kill chain. */
  private registerStreakKill(killer: SimPlayer): void {
    killer.spree++;
    killer.bestSpree = Math.max(killer.bestSpree, killer.spree);
    if (spreeLabel(killer.spree)) this.emit({ k: 'streak', p: killer.id, kind: 'spree', n: killer.spree });

    const windowTicks = STREAK_RULES.multiKillWindowSec * TICK_RATE;
    if (killer.lastMultiKillTick >= 0 && this.tick - killer.lastMultiKillTick > windowTicks) killer.multiChain = 0;
    killer.multiChain++;
    killer.lastMultiKillTick = this.tick;
    killer.bestMulti = Math.max(killer.bestMulti, killer.multiChain);
    if (killer.multiChain >= 2 && multiKillLabel(killer.multiChain)) {
      this.emit({ k: 'streak', p: killer.id, kind: 'multi', n: killer.multiChain });
    }
  }

  // ---------------------------------------------------------------- spawning

  private respawn(p: SimPlayer): void {
    const candidates = this.map.spawns.filter((s) => !this.isTeamMode || s.team === undefined || s.team === p.team);
    const pool = candidates.length > 0 ? candidates : this.map.spawns;
    const others = [...this.players.values()].filter((o) => o.alive && o.id !== p.id);
    const scored = pool
      .map((s) => {
        let nearestEnemy = Infinity;
        let blocked = false;
        for (const o of others) {
          const d = Math.hypot(o.sim.x - s.pos[0], o.sim.y - s.pos[1], o.sim.z - s.pos[2]);
          if (d < PLAYER.radius * 3) blocked = true;
          if (!this.isTeamMode || o.team !== p.team) nearestEnemy = Math.min(nearestEnemy, d);
        }
        return { s, score: blocked ? -1 : nearestEnemy };
      })
      .sort((a, b) => b.score - a.score);
    const safe = scored.filter((c) => c.score >= 0).slice(0, 3);
    const choices = safe.length > 0 ? safe : scored;
    const pick = choices[Math.floor(this.rng() * choices.length)].s;

    const sim = createPlayerSimState(pick.pos[0], pick.pos[1], pick.pos[2]);
    sim.onGround = true;
    p.sim = sim;
    p.yaw = pick.yaw;
    p.pitch = 0;
    p.hp = Math.min(p.maxHp, PLAYER.startHealth);
    p.shield = Math.min(p.maxShield, PLAYER.startShield);
    p.alive = true;
    p.protectTimer = PLAYER.spawnProtection;
    p.respawnTimer = 0;
    p.carrying = -1;
    p.life++;
    p.queue.length = 0;
    p.credits = 0;
    this.emit({ k: 'spawn', p: p.id, pos: [pick.pos[0], pick.pos[1], pick.pos[2]] });
  }

  // ---------------------------------------------------------------- pickups

  private stepPickups(): void {
    this.map.pickups.forEach((def, i) => {
      const rt = this.pickups[i];
      if (!rt.available) {
        rt.timer -= DT;
        if (rt.timer <= 0) rt.available = true;
        return;
      }
      const cfg = PICKUPS[def.kind];
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const dx = p.sim.x - def.pos[0];
        const dz = p.sim.z - def.pos[2];
        const dy = p.sim.y - def.pos[1];
        if (dx * dx + dz * dz > cfg.radius * cfg.radius || dy < -0.6 || dy > 1.6) continue;
        if (!this.applyPickup(p, def.kind, def.weapon ?? -1)) continue;
        rt.available = false;
        rt.timer = cfg.respawn;
        this.emit({ k: 'pickup', i, p: p.id, kind: def.kind, w: def.weapon ?? -1 });
        break;
      }
    });
  }

  private applyPickup(p: SimPlayer, kind: keyof typeof PICKUPS, weapon: number): boolean {
    const cfg = PICKUPS[kind];
    if (isHealthPickup(kind)) {
      if (p.hp >= p.maxHp) return false;
      p.hp = Math.min(p.maxHp, p.hp + cfg.amount);
      return true;
    }
    if (isShieldPickup(kind)) {
      if (p.shield >= p.maxShield) return false;
      p.shield = Math.min(p.maxShield, p.shield + cfg.amount);
      return true;
    }
    switch (kind) {
      case 'ammo': {
        if (weapon < 0 || weapon >= WEAPON_COUNT) return false;
        const w = WEAPONS[weapon];
        if (p.sim.ammo[weapon] >= w.maxAmmo) return false;
        p.sim.ammo[weapon] = Math.min(w.maxAmmo, p.sim.ammo[weapon] + w.pickupAmmo);
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- CTF

  private dropFlag(p: SimPlayer, disconnected: boolean): void {
    if (p.carrying < 0) return;
    const flag = this.flags[p.carrying];
    p.carrying = -1;
    if (!flag || flag.state !== FlagState.Carried || flag.carrier !== p.id) return;
    flag.carrier = -1;
    // drop where the carrier was, resting on the floor below; if out of the world, send it home
    const floor = this.world.floorBelow(
      { minX: p.sim.x - 0.2, maxX: p.sim.x + 0.2, minY: p.sim.y + 0.5, maxY: p.sim.y + 1, minZ: p.sim.z - 0.2, maxZ: p.sim.z + 0.2 },
      50,
    );
    if (floor === null || p.sim.y < this.world.killY) {
      this.returnFlag(flag, 'autoreturn', -1);
      return;
    }
    flag.state = FlagState.Dropped;
    flag.pos = { x: p.sim.x, y: floor, z: p.sim.z };
    flag.returnTimer = MODE_RULES.ctf.flagReturnTime;
    this.emit({ k: 'flag', team: flag.team, action: 'drop', p: p.id });
    void disconnected;
  }

  private returnFlag(flag: FlagRuntime, action: 'return' | 'autoreturn', by: number): void {
    if (flag.carrier >= 0) {
      const c = this.players.get(flag.carrier);
      if (c) c.carrying = -1;
    }
    flag.state = FlagState.Home;
    flag.pos = { ...flag.home };
    flag.carrier = -1;
    flag.returnTimer = 0;
    this.emit({ k: 'flag', team: flag.team, action, p: by });
  }

  private stepFlags(): void {
    const r = MODE_RULES.ctf.flagTouchRadius;
    for (const flag of this.flags) {
      if (!flag) continue;
      if (flag.state === FlagState.Carried) {
        const c = this.players.get(flag.carrier);
        if (!c || !c.alive) {
          // safety net: carrier vanished without going through dropFlag
          if (c) this.dropFlag(c, false);
          else this.returnFlag(flag, 'autoreturn', -1);
          continue;
        }
        flag.pos = { x: c.sim.x, y: c.sim.y, z: c.sim.z };
      } else if (flag.state === FlagState.Dropped) {
        flag.returnTimer -= DT;
        if (flag.returnTimer <= 0) this.returnFlag(flag, 'autoreturn', -1);
      }
    }

    for (const p of this.players.values()) {
      if (!p.alive || this.ended) continue;
      for (const flag of this.flags) {
        if (!flag) continue;
        const touching = (pos: Vec3) =>
          Math.hypot(p.sim.x - pos.x, p.sim.z - pos.z) <= r && p.sim.y - pos.y > -1 && p.sim.y - pos.y < 2;
        if (flag.team !== p.team) {
          if ((flag.state === FlagState.Home || flag.state === FlagState.Dropped) && p.carrying < 0 && touching(flag.pos)) {
            flag.state = FlagState.Carried;
            flag.carrier = p.id;
            flag.returnTimer = 0;
            p.carrying = flag.team;
            this.emit({ k: 'flag', team: flag.team, action: 'take', p: p.id });
          }
        } else if (flag.state === FlagState.Dropped && touching(flag.pos)) {
          p.score += MODE_RULES.ctf.returnPoints;
          this.returnFlag(flag, 'return', p.id);
        } else if (flag.state === FlagState.Home && p.carrying >= 0 && touching(flag.home)) {
          const enemy = this.flags[p.carrying];
          p.carrying = -1;
          enemy.state = FlagState.Home;
          enemy.pos = { ...enemy.home };
          enemy.carrier = -1;
          this.teamScores[p.team]++;
          p.captures++;
          p.score += MODE_RULES.ctf.capturePoints;
          this.emit({ k: 'flag', team: enemy.team, action: 'capture', p: p.id });
          if (this.teamScores[p.team] >= this.settings.scoreLimit) {
            this.end('score');
            return;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- history / snapshots

  private recordHistory(): void {
    const players = new Map<number, { x: number; y: number; z: number; alive: boolean; life: number }>();
    for (const p of this.players.values()) players.set(p.id, { x: p.sim.x, y: p.sim.y, z: p.sim.z, alive: p.alive, life: p.life });
    this.history.push({ tick: this.tick, players });
    while (this.history.length > NET.historyTicks) this.history.shift();
  }

  buildPlayers(): PlayerSnap[] {
    const out: PlayerSnap[] = [];
    for (const p of this.players.values()) {
      let flags = 0;
      if (p.alive) flags |= PF.Alive;
      if (p.sim.dashTime > 0) flags |= PF.Dashing;
      if (p.sim.slideTime > 0) flags |= PF.Sliding;
      if (p.sim.crouched) flags |= PF.Crouching;
      if (p.sim.onGround) flags |= PF.OnGround;
      if (p.carrying >= 0) flags |= PF.Carrier;
      if (p.protectTimer > 0) flags |= PF.Protected;
      if (!p.connected) flags |= PF.Disconnected;
      if (p.sim.pendingWeapon >= 0) flags |= PF.Switching;
      out.push([p.id, q100(p.sim.x), q100(p.sim.y), q100(p.sim.z), q1000(p.yaw), q1000(p.pitch), flags, p.sim.weapon, p.team, p.sim.warps & 255]);
    }
    return out;
  }

  buildProjectiles(): ProjectileSnap[] {
    return this.projectiles.map((pr) => [pr.id, pr.weapon, q100(pr.x), q100(pr.y), q100(pr.z)]);
  }

  buildFlags(): FlagSnap[] {
    return this.flags
      .filter(Boolean)
      .map((f) => [f.team, f.state, q100(f.pos.x), q100(f.pos.y), q100(f.pos.z), f.carrier, Math.ceil(f.returnTimer)]);
  }

  unavailablePickups(): number[] {
    const out: number[] = [];
    this.pickups.forEach((p, i) => {
      if (!p.available) out.push(i);
    });
    return out;
  }

  ownState(id: number): OwnState | null {
    const p = this.players.get(id);
    if (!p) return null;
    return {
      ...p.sim,
      ammo: p.sim.ammo.slice(),
      hp: p.hp,
      maxHp: p.maxHp,
      shield: p.shield,
      maxShield: p.maxShield,
      alive: p.alive,
      respawnIn: Math.max(0, p.respawnTimer),
      protectedFor: p.protectTimer,
    };
  }

  /** Live scoreboard, already ranked (see `rankPlayers` for the order and tie-breaks). */
  scoreboard(pings: Map<number, number>): ScoreEntry[] {
    const rows = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      kills: p.kills,
      deaths: p.deaths,
      score: p.score,
      captures: p.captures,
      damage: p.damageDealt,
      ping: pings.get(p.id) ?? 0,
      connected: p.connected,
    }));
    return rankPlayers(rows, this.settings.mode, this.teamScores);
  }

  // ---------------------------------------------------------------- end

  end(reason: MatchResults['reason']): void {
    if (this.ended) return;
    this.ended = true;
    // carried flags are irrelevant once the match is over
    for (const f of this.flags) if (f) f.carrier = -1;
    const players: ResultEntry[] = rankPlayers(
      [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
        captures: p.captures,
        damage: p.damageDealt,
        bestSpree: p.bestSpree,
        bestMulti: p.bestMulti,
      })),
      this.settings.mode,
      this.teamScores,
    );
    let winnerTeam = -1;
    let winnerId = -1;
    if (this.isTeamMode) {
      if (this.teamScores[0] !== this.teamScores[1]) winnerTeam = this.teamScores[0] > this.teamScores[1] ? 0 : 1;
    } else if (players.length > 0 && (players.length === 1 || players[0].score > players[1].score)) {
      // the tie-breaks order the table, but only a higher score wins the match
      winnerId = players[0].id;
    }
    this.results = {
      mode: this.settings.mode,
      mapId: this.settings.mapId,
      reason,
      winnerTeam,
      winnerId,
      teamScores: [...this.teamScores],
      players,
      durationSec: Math.round(this.elapsed),
    };
  }
}