import * as THREE from 'three';
import {
  Btn,
  clonePlayerSimState,
  CollisionWorld,
  DT,
  eyePosition,
  type FireResult,
  type FlagSnap,
  FlagState,
  type GameEvent,
  getMap,
  getWeapon,
  type HitTarget,
  type InputCmd,
  isAiming,
  isHealthPickup,
  isShieldPickup,
  lerpAngle,
  PICKUPS,
  type MapDef,
  type MatchStartMsg,
  type MovementEnv,
  NET,
  type OwnState,
  PF,
  PLAYER,
  type PlayerSimState,
  type ProjectileState,
  projectileId,
  type ScoreEntry,
  shotDirections,
  type SnapshotMsg,
  stepMovement,
  stepProjectile,
  stepWeapon,
  TEAM_NAMES,
  TICK_RATE,
  multiKillLabel,
  spreeLabel,
  traceHitscan,
  type Vec3,
  WEAPON_COUNT,
  WeaponId,
  WEAPONS,
  wrapAngle,
} from '@arena/shared';
import type { Sfx } from '../audio/Sfx';
import { WEAPON_SOUNDS } from '../audio/Sfx';
import type { Net } from '../net/Net';
import { Character, DM_COLORS, TEAM_COLORS } from '../render/Character';
import { zombieLook } from '../render/zombieVisual';
import { Effects } from '../render/Effects';
import { MapFeatures } from '../render/MapFeatures';
import { MapView } from '../render/MapView';
import { applyWeaponTextureOverrides, buildWeapon, createFlashMaterial, viewPose, WEAPON_COLORS, type WeaponModel } from '../render/WeaponModels';
import { SkinStore, SkinTextures } from '../render/skinTexture';
import { ViewArms } from '../render/ViewArms';
import { WorldProps } from '../render/WorldProps';
import { resolveGfxProfile } from '../gfxProfile';
import { particleBudget, type Settings } from '../settings';
import { applyRendererQuality } from '../render/rendererQuality';
import type { FlagPointer, Hud } from '../ui/Hud';
import type { InputController } from './InputController';

const SIM_FIELDS: (keyof PlayerSimState)[] = [
  'x', 'y', 'z', 'vx', 'vy', 'vz', 'onGround', 'dashTime', 'dashCd', 'dashDx', 'dashDz', 'dashHeld',
  'weapon', 'pendingWeapon', 'switchTime', 'fireCd', 'spread', 'shotCounter', 'fireHeld', 'charge',
  'portalCd', 'padCd', 'warps', 'warpYaw', 'warpTo', 'pads',
  'crouched', 'slideTime', 'slideCd', 'slideDx', 'slideDz', 'slideHeld',
];

/** Minimum time between two plasma beam sounds (the beam fires every tick, the sound does not). */
const PLASMA_SOUND_MS = 110;
/** Minimum time between two hit / hurt feedbacks (plasma damages every tick). */
const HIT_FEEDBACK_MS = 90;

const simFromOwn = (me: OwnState): PlayerSimState => {
  const s = {} as Record<string, unknown>;
  for (const k of SIM_FIELDS) s[k] = me[k];
  s.ammo = me.ammo.slice();
  const out = s as unknown as PlayerSimState;
  out.crouched ??= false;
  out.slideTime ??= 0;
  out.slideCd ??= 0;
  out.slideDx ??= 0;
  out.slideDz ??= 0;
  out.slideHeld ??= false;
  return out;
};

interface RemoteView {
  x: number;
  y: number;
  z: number;
  alive: boolean;
}

interface LocalProjectile {
  state: ProjectileState;
  hidden: boolean;
  born: number;
}

export interface GameDeps {
  renderer: THREE.WebGLRenderer;
  net: Net;
  hud: Hud;
  sfx: Sfx;
  settings: Settings;
  input: InputController;
  start: MatchStartMsg;
  /** Skins received from the server for the players of the room. */
  skins: SkinStore;
}

/**
 * One match on the client. Owns the scene and runs:
 *  - a fixed 30 Hz loop that samples input, predicts the local player with the shared movement and
 *    weapon code, and sends numbered inputs;
 *  - reconciliation when snapshots acknowledge inputs;
 *  - interpolation of remote players ~110 ms in the past;
 *  - rendering at display rate.
 * The client never decides damage or kills: hit markers and kills come from server events.
 */
export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private viewScene = new THREE.Scene();
  private viewCamera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
  private map: MapDef;
  private world: CollisionWorld;
  private mapView: MapView;
  private props: WorldProps;
  private features: MapFeatures;
  private effects: Effects;
  private sun: THREE.DirectionalLight;
  private chars = new Map<number, Character>();
  private names = new Map<number, string>();
  private teams = new Map<number, number>();
  private myId: number;
  private myTeam: number;

  private pred: PlayerSimState | null = null;
  private prevPos = { x: 0, y: 0, z: 0 };
  private smooth = new THREE.Vector3();
  private pending: InputCmd[] = [];
  private seq = 0;
  private alive = false;
  private me: OwnState | null = null;
  private deathPos = new THREE.Vector3();
  private snaps: SnapshotMsg[] = [];
  private clockOffset: number | null = null;
  private lastEventId = 0;
  private remote = new Map<number, RemoteView>();
  private localProj = new Map<number, LocalProjectile>();
  private scores: ScoreEntry[] = [];
  private teamScores = [0, 0];
  private flags: FlagSnap[] = [];
  private timeLeft = 0;
  /** Latest weapon id per player from snapshots (for the scoreboard). */
  private snapWeapons = new Map<number, number>();
  /** Kills scored with each weapon, per player (for the results table). */
  private killWeaponCounts = new Map<number, Map<number, number>>();

  private viewWeapons: WeaponModel[] = [];
  private viewArms: ViewArms;
  private skinTextures: SkinTextures;
  private stopSkinWatch: () => void;
  /** Team and tint of every character on screen, to rebuild their texture when a skin arrives. */
  private charLook = new Map<number, { team: number; color: number; zombie?: boolean }>();
  private viewFlash: THREE.Sprite;
  private viewFlashLife = 0;
  private recoil = 0;
  private bob = 0;
  private lastDry = 0;
  /** 0..1 smoothed "aiming" amount: drives the view model pose and the crosshair. */
  private adsT = 0;
  /** Beam of the local plasma weapon, redrawn every frame from the current muzzle until `until`. */
  private localBeam: { end: Vec3; weapon: number; until: number } | null = null;
  private lastPlasmaSound = 0;
  private remotePlasmaSound = new Map<number, number>();
  private lastHitSound = 0;
  private lastHurt = 0;
  private chargeWasFull = false;

  private raf = 0;
  private running = false;
  private lastFrame = 0;
  private acc = 0;
  private frames = 0;
  private fps = 0;
  private fpsT = 0;
  private snapCount = 0;
  private snapRate = 0;
  private predError = 0;
  private disposables: { dispose(): void }[] = [];
  private viewDirLight: THREE.DirectionalLight;
  private camPos = new THREE.Vector3();
  private deathCamOffset = new THREE.Vector3(0, 2.6, 0);
  private muzzleTmp = new THREE.Vector3();
  private projTmp = new THREE.Vector3();
  private interpPrevById = new Map<number, SnapshotMsg['p'][number]>();
  private lastRenderMs = 0;
  private mapVisualKey = '';
  private characterShading: 'lambert' | 'standard' = 'lambert';

  constructor(private d: GameDeps) {
    const s = d.start.settings;
    const map = getMap(s.mapId);
    if (!map) throw new Error(`mapa desconocido ${s.mapId}`);
    this.map = map;
    this.world = new CollisionWorld(map);
    this.myId = d.start.playerId;
    for (const r of d.start.roster) {
      this.names.set(r.id, r.name);
      this.teams.set(r.id, r.team);
    }
    this.myTeam = this.teams.get(this.myId) ?? -1;

    const profile = resolveGfxProfile(d.settings);
    this.characterShading = profile.characterLambert ? 'lambert' : 'standard';
    const t = map.theme;
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.Fog(t.fog, t.fogNear * profile.fogNearMul, t.fogFar * profile.fogFarMul);
    this.camera = new THREE.PerspectiveCamera(d.settings.fov, 1, 0.05, 400);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(new THREE.HemisphereLight(t.hemiSky, t.hemiGround, t.hemiIntensity));
    this.sun = new THREE.DirectionalLight(t.sunColor, t.sunIntensity);
    this.sun.position.set(t.sunDir[0] * 60, t.sunDir[1] * 60, t.sunDir[2] * 60);
    this.configureShadows(profile.shadows);
    this.scene.add(this.sun, this.sun.target);

    const aniso = Math.min(profile.maxAnisotropy, d.renderer.capabilities.getMaxAnisotropy());
    this.mapVisualKey = `${profile.mapLambert}:${profile.textureSize}`;
    this.mapView = new MapView(map, {
      maxAnisotropy: aniso,
      textureSize: profile.textureSize,
      mapLambert: profile.mapLambert,
      pointLights: profile.pointLights,
    });
    this.scene.add(this.mapView.group);
    this.props = new WorldProps(map, s.mode === 'ctf');
    this.scene.add(this.props.group);
    this.features = new MapFeatures(map);
    this.scene.add(this.features.group);
    this.effects = new Effects(particleBudget(profile.particles));
    this.effects.setQualityProfile(profile.effectPoolScale, profile.particlePointSize);
    this.scene.add(this.effects.group);

    // first-person view models live in their own scene so they never clip into walls
    this.viewScene.add(new THREE.HemisphereLight(0xc8d4ff, 0x30281f, 2.2));
    this.viewDirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.viewDirLight.position.set(1, 2, 1);
    this.viewDirLight.visible = profile.viewModelExtraLights;
    this.viewScene.add(this.viewDirLight);
    void applyWeaponTextureOverrides();
    for (let i = 0; i < WEAPON_COUNT; i++) {
      const w = buildWeapon(i);
      w.group.position.set(...viewPose(i).hip);
      w.group.visible = false;
      this.viewScene.add(w.group);
      this.viewWeapons.push(w);
    }
    this.skinTextures = new SkinTextures(d.skins);
    this.viewArms = new ViewArms(this.characterShading, this.skinTex(this.myId, this.myTeam, this.myColor()));
    this.viewScene.add(this.viewArms.group);
    this.stopSkinWatch = d.skins.onChange((id) => this.refreshSkins(id));
    const flashMat = createFlashMaterial();
    this.disposables.push(flashMat, flashMat.map!);
    this.viewFlash = new THREE.Sprite(flashMat);
    this.viewFlash.visible = false;
    this.viewScene.add(this.viewFlash);

    d.hud.show(true);
    if (s.mode !== 'ctf') d.hud.hideFlags();
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  // ------------------------------------------------------------------ lifecycle

  start() {
    this.running = true;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.stopSkinWatch();
    for (const c of this.chars.values()) c.dispose();
    this.chars.clear();
    this.viewArms.dispose();
    this.skinTextures.dispose();
    this.mapView.dispose();
    this.props.dispose();
    this.features.dispose();
    this.effects.dispose();
    for (const d of this.disposables) d.dispose();
    this.scene.clear();
    this.viewScene.clear();
    this.d.renderer.renderLists.dispose();
    this.d.hud.show(false);
    this.d.hud.scope(false);
    this.d.hud.aiming(false);
    this.d.hud.setCharge(null);
  }

  applySettings(s: Settings) {
    this.d.settings = s;
    const profile = resolveGfxProfile(s);
    applyRendererQuality(this.d.renderer, profile);
    this.effects.setBudget(particleBudget(profile.particles));
    this.effects.setQualityProfile(profile.effectPoolScale, profile.particlePointSize);
    const fog = this.scene.fog as THREE.Fog;
    const theme = this.map.theme;
    fog.near = theme.fogNear * profile.fogNearMul;
    fog.far = theme.fogFar * profile.fogFarMul;
    this.mapView.setPointLights(profile.pointLights);
    this.viewDirLight.visible = profile.viewModelExtraLights;
    const vKey = `${profile.mapLambert}:${profile.textureSize}`;
    if (vKey !== this.mapVisualKey) {
      this.scene.remove(this.mapView.group);
      this.mapView.dispose();
      const aniso = Math.min(profile.maxAnisotropy, this.d.renderer.capabilities.getMaxAnisotropy());
      this.mapView = new MapView(this.map, {
        maxAnisotropy: aniso,
        textureSize: profile.textureSize,
        mapLambert: profile.mapLambert,
        pointLights: profile.pointLights,
      });
      this.scene.add(this.mapView.group);
      this.mapVisualKey = vKey;
    }
    if (this.d.renderer.shadowMap.enabled !== profile.shadows) {
      this.configureShadows(profile.shadows);
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) for (const mat of Array.isArray(m) ? m : [m]) mat.needsUpdate = true;
      });
    }
    this.characterShading = profile.characterLambert ? 'lambert' : 'standard';
    this.resize();
  }

  /** Tint of the team-colour zone of a player's skin: team colour in CTF, an accent per player in DM. */
  private tintFor(id: number, team: number): number {
    return this.d.start.settings.mode === 'ctf' ? TEAM_COLORS[team] ?? 0xffffff : DM_COLORS[(id - 1) % DM_COLORS.length];
  }

  /** Default skins are chosen by team in CTF and alternate per player in Deathmatch (team -1). */
  private skinTex(id: number, team: number, tint: number): THREE.Texture {
    return this.skinTextures.get(id, this.d.start.settings.mode === 'ctf' ? team : -1, tint);
  }

  private skinTexZombie(archetypeSlot: number, tint: number): THREE.Texture {
    const img = this.d.skins.zombieImage(archetypeSlot);
    if (img) return this.skinTextures.fromImage(img, tint);
    return this.skinTex(-1, 0, tint);
  }

  private myColor(): number {
    return this.tintFor(this.myId, this.myTeam);
  }

  /** A skin arrived, changed or was removed (id -1: the bundled default skins finished loading). */
  private refreshSkins(id: number) {
    for (const [cid, c] of this.chars) {
      const look = this.charLook.get(cid);
      if (look?.zombie) continue;
      if (look && (id === -1 || id === cid)) c.setSkin(this.skinTex(cid, look.team, look.color));
    }
    if (id === -1 || id === this.myId) this.viewArms.setSkin(this.skinTex(this.myId, this.myTeam, this.myColor()));
  }

  private configureShadows(on: boolean) {
    this.d.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    if (on) {
      const c = this.sun.shadow.camera;
      const half = 70;
      c.left = -half;
      c.right = half;
      c.top = half;
      c.bottom = -half;
      c.near = 1;
      c.far = 200;
      this.sun.shadow.mapSize.set(2048, 2048);
      this.sun.shadow.bias = -0.0005;
    }
  }

  private resize = () => {
    const r = this.d.renderer;
    const w = window.innerWidth,
      h = window.innerHeight;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.d.settings.pixelRatioCap));
    r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = w / h;
    this.viewCamera.updateProjectionMatrix();
  };

  // ------------------------------------------------------------------ time

  private serverTickNow(): number {
    if (this.clockOffset === null) return 0;
    return (performance.now() / 1000) * TICK_RATE + this.clockOffset;
  }

  /** Server tick that remote entities are rendered at (also sent for lag compensation). */
  private renderTick(): number {
    return this.serverTickNow() - (NET.interpDelayMs / 1000) * TICK_RATE;
  }

  // ------------------------------------------------------------------ network in

  onSnapshot(s: SnapshotMsg) {
    this.snapCount++;
    const local = (performance.now() / 1000) * TICK_RATE;
    const sample = s.t - local;
    if (this.clockOffset === null || sample > this.clockOffset) this.clockOffset = sample;
    else this.clockOffset += (sample - this.clockOffset) * 0.05;

    this.snaps.push(s);
    if (this.snaps.length > 40) this.snaps.shift();
    this.props.setPickupAvailability(s.pk);
    this.flags = s.fl;
    for (const pl of s.p) this.snapWeapons.set(pl[0], pl[7]);
    this.props.setFlags(s.fl);
    this.teamScores = s.ts;
    this.timeLeft = s.tl;

    const me = s.me;
    this.me = me;
    if (!me) return;
    if (!me.alive) {
      if (this.alive && this.pred) this.deathPos.set(this.pred.x, this.pred.y, this.pred.z);
      this.alive = false;
      this.pending.length = 0;
      return;
    }
    this.pending = this.pending.filter((c) => c.seq > s.a);
    if (!this.alive || !this.pred) {
      // (re)spawn: take the server state as-is and face the spawn direction
      this.pred = simFromOwn(me);
      for (const c of this.pending) this.replay(c);
      this.prevPos = { x: this.pred.x, y: this.pred.y, z: this.pred.z };
      this.smooth.set(0, 0, 0);
      this.alive = true;
      const spawn = this.map.spawns.reduce((best, sp) =>
        Math.hypot(sp.pos[0] - me.x, sp.pos[2] - me.z) < Math.hypot(best.pos[0] - me.x, best.pos[2] - me.z) ? sp : best,
      );
      if (Math.hypot(spawn.pos[0] - me.x, spawn.pos[2] - me.z) < 1) {
        this.d.input.yaw = spawn.yaw;
        this.d.input.pitch = 0;
      }
      this.d.input.desiredWeapon = me.pendingWeapon >= 0 ? me.pendingWeapon : me.weapon;
      return;
    }
    // reconcile: rewind to the acknowledged server state and replay unacknowledged inputs
    const before = { x: this.pred.x, y: this.pred.y, z: this.pred.z };
    const beforeWarps = this.pred.warps;
    const beforeWarpYaw = this.pred.warpYaw;
    this.pred = simFromOwn(me);
    for (const c of this.pending) this.replay(c);
    if (this.pred.warps !== beforeWarps) {
      // the server's portal trip differs from the predicted one (e.g. an exit was occupied):
      // follow the server, turning the view forward for an extra trip or back for a cancelled one
      if (this.pred.warps - beforeWarps > 0) this.onLocalWarp(this.pred, this.d.input);
      else {
        this.d.input.yaw = wrapAngle(this.d.input.yaw - beforeWarpYaw);
        this.prevPos = { x: this.pred.x, y: this.pred.y, z: this.pred.z };
        this.smooth.set(0, 0, 0);
      }
      return;
    }
    const ex = before.x - this.pred.x,
      ey = before.y - this.pred.y,
      ez = before.z - this.pred.z;
    const err = Math.hypot(ex, ey, ez);
    this.predError = this.predError * 0.9 + err * 0.1;
    if (err > 3) {
      this.smooth.set(0, 0, 0);
      this.prevPos = { x: this.pred.x, y: this.pred.y, z: this.pred.z };
    } else if (err > 1e-4) {
      this.smooth.x += ex;
      this.smooth.y += ey;
      this.smooth.z += ez;
      this.prevPos.x -= ex;
      this.prevPos.y -= ey;
      this.prevPos.z -= ez;
    }
  }

  private replay(c: InputCmd) {
    if (!this.pred) return;
    stepMovement(this.pred, c, this.world, DT, this.moveEnv);
    stepWeapon(this.pred, c, DT, this.myId);
  }

  /** Same occupancy test as the server, using the interpolated remote players (approximate). */
  private moveEnv: MovementEnv = {
    exitBlocked: (x, y, z) => {
      for (const r of this.remote.values()) {
        if (r.alive && Math.abs(r.x - x) < 0.8 && Math.abs(r.z - z) < 0.8 && Math.abs(r.y - y) < PLAYER.height) return true;
      }
      return false;
    },
  };

  onScoreboard(entries: ScoreEntry[]) {
    this.scores = entries;
    for (const e of entries) {
      this.names.set(e.id, e.name);
      this.teams.set(e.id, e.team);
    }
  }

  onEvents(list: GameEvent[]) {
    for (const ev of list) {
      if (ev.e <= this.lastEventId) continue; // duplicate (e.g. resent after reconnection)
      this.lastEventId = ev.e;
      this.handleEvent(ev);
    }
  }

  private posOf(id: number): Vec3 | undefined {
    if (id === this.myId && this.pred) return { x: this.pred.x, y: this.pred.y + 1, z: this.pred.z };
    const r = this.remote.get(id);
    return r ? { x: r.x, y: r.y + 1, z: r.z } : undefined;
  }

  private name(id: number) {
    return this.names.get(id) ?? `Jugador ${id}`;
  }

  private handleEvent(ev: GameEvent) {
    const { sfx, hud } = this.d;
    switch (ev.k) {
      case 'shot': {
        if (ev.p === this.myId) break; // already drawn by prediction
        const char = this.chars.get(ev.p);
        const from = char ? char.muzzleWorld(new THREE.Vector3()) : new THREE.Vector3(...ev.o);
        if (ev.w === WeaponId.Plasma) {
          // continuous beam: one event per server tick, so only refresh the beam and spark a little
          ev.ends.forEach((e, i) => {
            const to = { x: e[0], y: e[1], z: e[2] };
            this.effects.beam(ev.p, from, to, ev.w);
            if (ev.hitWorld[i]) this.effects.sparks(to, null, 2, WEAPON_COLORS[ev.w]);
          });
          const now = performance.now();
          if (now - (this.remotePlasmaSound.get(ev.p) ?? 0) > PLASMA_SOUND_MS) {
            this.remotePlasmaSound.set(ev.p, now);
            sfx.play('plasma', from, 0.7);
          }
          break;
        }
        ev.ends.forEach((e, i) => {
          const to = { x: e[0], y: e[1], z: e[2] };
          this.effects.tracer(from, to, ev.w, ev.c ?? 1);
          if (ev.hitWorld[i]) this.effects.sparks(to, null, 4);
        });
        this.effects.muzzleFlash(from, 0.6);
        sfx.play(WEAPON_SOUNDS[ev.w], from);
        break;
      }
      case 'fire': {
        if (ev.p === this.myId) break;
        const char = this.chars.get(ev.p);
        if (char) {
          const m = char.muzzleWorld(new THREE.Vector3());
          this.effects.muzzleFlash(m, 0.8);
          sfx.play(WEAPON_SOUNDS[ev.w], m);
        }
        break;
      }
      case 'hit': {
        const at = this.posOf(ev.v);
        if (at && ev.v !== this.myId) this.effects.blood(at);
        // the plasma beam hurts every tick: show and play the feedback at a bearable rate
        const now = performance.now();
        const shieldOnly = (ev.sd ?? 0) >= ev.dmg && !ev.sb;
        const zone = ev.zone ?? (ev.head ? 'head' : 'body');
        if (at && ev.v !== this.myId && ev.sd) this.effects.sparks(at, null, ev.sb ? 18 : 5, ev.sb ? 0xbfe6ff : 0x2a9cff);
        if (ev.a === this.myId && ev.v !== this.myId) {
          const floater = ev.at ?? (at ? [at.x, at.y + 1.35, at.z] : null);
          if (floater) {
            this.projTmp.set(floater[0], floater[1], floater[2]).project(this.camera);
            if (this.projTmp.z <= 1) {
              const w = window.innerWidth;
              const h = window.innerHeight;
              hud.spawnDamageFloater((this.projTmp.x * 0.5 + 0.5) * w, (-this.projTmp.y * 0.5 + 0.5) * h, ev.dmg, zone);
            }
          }
          hud.hitmarker(zone === 'head' ? 'head' : shieldOnly ? 'shield' : 'hit');
          if (now - this.lastHitSound > HIT_FEEDBACK_MS) {
            this.lastHitSound = now;
            sfx.play(ev.sb ? 'shieldBreak' : ev.head ? 'headshot' : shieldOnly ? 'shieldHit' : 'hit');
          }
        }
        if (ev.v === this.myId && ev.sb) {
          hud.shieldBreak();
          sfx.play('shieldBreak');
        }
        if (ev.v === this.myId && this.pred && now - this.lastHurt > HIT_FEEDBACK_MS) {
          this.lastHurt = now;
          const dx = ev.from[0] - this.pred.x,
            dz = ev.from[2] - this.pred.z;
          const angle = Math.hypot(dx, dz) > 0.5 || ev.a !== this.myId ? Math.atan2(-dx, -dz) - this.d.input.yaw : Math.PI;
          if (shieldOnly) {
            // everything went into the shield: blue feedback instead of the red damage flash
            hud.shieldHit(ev.dmg);
            sfx.play('shieldHit');
          } else {
            hud.damage(angle, ev.dmg - (ev.sd ?? 0));
            if (ev.sd) hud.shieldHit(ev.sd);
            sfx.play('hurt');
          }
        }
        break;
      }
      case 'kill': {
        if (!ev.suicide && ev.killer >= 0 && ev.w >= 0) {
          let counts = this.killWeaponCounts.get(ev.killer);
          if (!counts) {
            counts = new Map();
            this.killWeaponCounts.set(ev.killer, counts);
          }
          counts.set(ev.w, (counts.get(ev.w) ?? 0) + 1);
        }
        const involves = ev.killer === this.myId || ev.victim === this.myId;
        hud.killfeed(this.name(ev.killer), this.name(ev.victim), ev.w, ev.suicide, involves, ev.cause);
        if (ev.cause === 'lava') {
          const at = ev.victim === this.myId && this.pred ? { x: this.pred.x, y: this.pred.y, z: this.pred.z } : this.posOf(ev.victim);
          if (at) this.effects.sparks(at, { x: 0, y: 1, z: 0 }, 24, 0xff7020);
          sfx.play('lava', ev.victim === this.myId ? undefined : at);
        }
        if (ev.killer === this.myId && !ev.suicide) {
          hud.hitmarker('kill');
          hud.center(`Eliminaste a ${this.name(ev.victim)}${ev.head ? ' · ¡disparo a la cabeza!' : ''}`);
          sfx.play('kill');
        } else if (ev.victim === this.myId) {
          const msg = ev.cause === 'lava' ? 'Caíste en la lava' : ev.suicide ? 'Te eliminaste' : `Te eliminó ${this.name(ev.killer)}`;
          hud.center(msg, 2500);
          sfx.play('death');
        }
        break;
      }
      case 'warp': {
        const portals = this.map.portals ?? [];
        const from = portals[ev.from];
        const to = portals[ev.to];
        if (from) this.effects.sparks({ x: from.pos[0], y: from.pos[1] + 0.8, z: from.pos[2] }, null, 14, from.color);
        if (to) {
          const exit = to.exits[0];
          this.effects.sparks({ x: exit[0], y: exit[1] + 1, z: exit[2] }, { x: 0, y: 1, z: 0 }, 14, to.color);
          if (ev.p !== this.myId) sfx.play('portal', { x: to.pos[0], y: to.pos[1], z: to.pos[2] }, 0.7);
        }
        break;
      }
      case 'pad': {
        this.features.padFired(ev.i);
        const pad = this.map.jumpPads?.[ev.i];
        if (pad) {
          const pos = { x: pad.pos[0], y: pad.pos[1] + 0.2, z: pad.pos[2] };
          this.effects.sparks(pos, { x: 0, y: 1, z: 0 }, 10, 0x40ff9a);
          if (ev.p !== this.myId) sfx.play('jumpPad', pos, 0.7);
        }
        break;
      }
      case 'boom': {
        const p = { x: ev.pos[0], y: ev.pos[1], z: ev.pos[2] };
        this.effects.explosion(p, ev.w);
        sfx.play('explosion', p);
        this.localProj.delete(ev.pid);
        break;
      }
      case 'bounce':
        sfx.play('bounce', { x: ev.pos[0], y: ev.pos[1], z: ev.pos[2] }, 0.6);
        break;
      case 'pickup': {
        const def = this.map.pickups[ev.i];
        const pos = def ? { x: def.pos[0], y: def.pos[1] + 0.5, z: def.pos[2] } : undefined;
        const health = isHealthPickup(ev.kind);
        const shield = isShieldPickup(ev.kind);
        const snd = health ? 'pickupHealth' : shield ? 'pickupShield' : 'pickupAmmo';
        if (pos && shield) this.effects.sparks(pos, { x: 0, y: 1, z: 0 }, 12, ev.kind === 'shieldBig' ? 0x8a7aff : 0x2a9cff);
        if (ev.p === this.myId) {
          sfx.play(snd);
          const amount = PICKUPS[ev.kind].amount;
          const label = ev.kind === 'ammo' ? `+ munición ${WEAPONS[ev.w]?.short ?? ''}` : health ? `+${amount} salud` : `+${amount} escudo`;
          hud.sub(label, 1200);
        } else if (pos) sfx.play(snd, pos, 0.6);
        break;
      }
      case 'spawn':
        if (ev.p === this.myId) sfx.play('spawn');
        this.effects.sparks({ x: ev.pos[0], y: ev.pos[1] + 1, z: ev.pos[2] }, { x: 0, y: 1, z: 0 }, 20, 0x80e0ff);
        break;
      case 'dash':
        if (ev.p !== this.myId) {
          const p = this.posOf(ev.p);
          if (p) sfx.play('dash', p, 0.7);
        }
        break;
      case 'jump':
        if (ev.p !== this.myId) {
          const p = this.posOf(ev.p);
          if (p) sfx.play('jump', p, 0.5);
        }
        break;
      case 'flag': {
        const team = TEAM_NAMES[ev.team]?.toUpperCase() ?? '';
        const who = ev.p >= 0 ? this.name(ev.p) : '';
        const own = ev.team === this.myTeam;
        switch (ev.action) {
          case 'take':
            hud.center(ev.p === this.myId ? '¡Tienes la bandera! Llévala a tu base' : `${who} tomó la bandera ${team}`);
            sfx.play('flagTake', undefined, own ? 1 : 0.7);
            break;
          case 'drop':
            hud.center(`La bandera ${team} cayó`);
            sfx.play('flagDrop');
            break;
          case 'return':
            hud.center(`${who} recuperó la bandera ${team}`);
            sfx.play('flagReturn');
            break;
          case 'autoreturn':
            hud.center(`La bandera ${team} volvió a su base`);
            sfx.play('flagReturn');
            break;
          case 'capture':
            hud.center(`¡${who} capturó la bandera ${team}!`, 3000);
            sfx.play('flagCapture');
            break;
        }
        break;
      }
      case 'streak': {
        const who = this.name(ev.p);
        const mine = ev.p === this.myId;
        if (ev.kind === 'ended') {
          const victimMe = ev.p === this.myId;
          const text =
            victimMe && ev.by !== undefined
              ? `Racha cortada por ${this.name(ev.by)}`
              : victimMe
                ? 'Tu racha terminó'
                : ev.by !== undefined
                  ? `${who} · racha cortada por ${this.name(ev.by)} (${ev.n})`
                  : `${who} · racha terminada (${ev.n})`;
          if (victimMe) {
            hud.streakCenter(text, 1, 2600);
            sfx.playStreak('ended', ev.n);
          } else hud.streakFeed('', text, false);
          break;
        }
        const label = ev.kind === 'multi' ? multiKillLabel(ev.n) : spreeLabel(ev.n);
        if (!label) break;
        if (mine) {
          hud.streakCenter(label, ev.n);
          sfx.playStreak(ev.kind, ev.n);
        } else hud.streakFeed(who, label, false);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ simulation

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const elapsed = Math.min(250, now - this.lastFrame);
    this.lastFrame = now;
    this.acc += elapsed;
    const stepMs = DT * 1000;
    let steps = 0;
    while (this.acc >= stepMs && steps < 8) {
      this.fixedTick();
      this.acc -= stepMs;
      steps++;
    }
    if (steps >= 8) this.acc = 0;
    const profile = resolveGfxProfile(this.d.settings);
    if (!document.hidden) {
      if (!profile.capFps60 || now - this.lastRenderMs >= 1000 / 60 - 0.25) {
        this.lastRenderMs = now;
        this.render(elapsed / 1000, this.acc / stepMs);
      }
    }

    this.frames++;
    this.fpsT += elapsed;
    if (this.fpsT >= 1000) {
      this.fps = (this.frames * 1000) / this.fpsT;
      this.snapRate = (this.snapCount * 1000) / this.fpsT;
      this.frames = 0;
      this.snapCount = 0;
      this.fpsT = 0;
    }
  };

  private fixedTick() {
    const input = this.d.input;
    const cmd: InputCmd = {
      seq: ++this.seq,
      buttons: input.buttons(),
      yaw: input.yaw,
      pitch: input.pitch,
      weapon: input.desiredWeapon,
      viewTick: Math.max(0, this.renderTick()),
    };
    input.clearLatches();

    const p = this.pred;
    if (p && this.alive) {
      this.prevPos = { x: p.x, y: p.y, z: p.z };
      const prevDashCd = p.dashCd;
      const wasGround = p.onGround;
      const vyBefore = p.vy;
      const prevPending = p.pendingWeapon;
      const prevCharge = p.charge;
      const prevWarps = p.warps;
      const prevPads = p.pads;
      stepMovement(p, cmd, this.world, DT, this.moveEnv);
      if (p.warps !== prevWarps) this.onLocalWarp(p, input);
      if (p.pads !== prevPads) {
        this.d.sfx.play('jumpPad');
        this.d.hud.travelFlash(0x40ff9a);
      }
      if (p.dashCd > prevDashCd) this.d.sfx.play('dash');
      if (wasGround && !p.onGround && p.vy > PLAYER.jumpSpeed * 0.5) this.d.sfx.play('jump');
      if (!wasGround && p.onGround && vyBefore < -10) this.d.sfx.play('land');
      const fire = stepWeapon(p, cmd, DT, this.myId);
      if (p.pendingWeapon >= 0 && p.pendingWeapon !== prevPending) this.d.sfx.play('switch');
      if (fire) this.localFire(fire, cmd);
      else if (cmd.buttons & Btn.Fire && (p.ammo[p.weapon] ?? 0) <= 0 && performance.now() - this.lastDry > 400) {
        this.lastDry = performance.now();
        this.d.sfx.play('dryFire');
        this.d.hud.sub(`Sin munición: cambia de arma (1–${WEAPON_COUNT})`, 1200);
      }
      // charge weapon: a rising sound when the charge starts and a ping when it is full
      const cw = getWeapon(p.weapon);
      if (cw.kind === 'hitscan' && cw.charge) {
        if (prevCharge <= 0 && p.charge > 0) this.d.sfx.play('charge');
        const full = p.charge >= cw.charge.time - 1e-6;
        if (full && !this.chargeWasFull) this.d.sfx.play('chargeFull');
        this.chargeWasFull = full;
      } else this.chargeWasFull = false;
      this.pending.push(cmd);
      if (this.pending.length > 90) this.pending.shift();
    }
    this.d.net.sendInput(cmd);

    // locally predicted projectiles (own rockets / grenades) for immediate feedback
    if (this.localProj.size > 0) {
      const targets = this.remoteTargets();
      const now = performance.now();
      for (const [id, lp] of this.localProj) {
        if (now - lp.born > 8000) {
          this.localProj.delete(id);
          continue;
        }
        if (lp.hidden) continue;
        const r = stepProjectile(lp.state, this.world, DT, targets);
        if (r.exploded) lp.hidden = true; // wait for the authoritative explosion event
      }
    }
  }

  /**
   * The predicted player went through a portal: turn the view like the movement code turned the
   * velocity (later inputs carry the new yaw, exactly as the server expects) and drop the render
   * interpolation so the camera does not slide through the walls between both ends.
   */
  private onLocalWarp(p: PlayerSimState, input: InputController) {
    input.yaw = wrapAngle(input.yaw + p.warpYaw);
    this.prevPos = { x: p.x, y: p.y, z: p.z };
    this.smooth.set(0, 0, 0);
    this.d.sfx.play('portal');
    this.d.hud.travelFlash(this.map.portals?.[p.warpTo]?.color ?? 0xffffff);
  }

  private remoteTargets(): HitTarget[] {
    const out: HitTarget[] = [];
    for (const [id, r] of this.remote) if (r.alive) out.push({ id, x: r.x, y: r.y, z: r.z });
    return out;
  }

  /** Where shots visually leave the weapon: bottom right at the hip, almost at the crosshair when aiming. */
  private muzzlePoint(origin: Vec3, yaw: number, pitch: number): Vec3 {
    const k = 1 - this.adsT;
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
    return {
      x: origin.x + fwd.x * 0.7 + right.x * 0.2 * k,
      y: origin.y + fwd.y * 0.7 - (0.04 + 0.13 * k),
      z: origin.z + fwd.z * 0.7 + right.z * 0.2 * k,
    };
  }

  private localFire(fire: FireResult, cmd: InputCmd) {
    const p = this.pred!;
    const w = getWeapon(fire.weapon);
    const now = performance.now();
    const origin = eyePosition(p);
    const muzzle = this.muzzlePoint(origin, cmd.yaw, cmd.pitch);

    if (fire.weapon === WeaponId.Plasma && w.kind === 'hitscan') {
      // continuous beam: one hitscan per tick, drawn every frame from the muzzle until the next tick
      if (now - this.lastPlasmaSound > PLASMA_SOUND_MS) {
        this.lastPlasmaSound = now;
        this.d.sfx.play('plasma');
      }
      const dir = shotDirections(fire.weapon, cmd.yaw, cmd.pitch, fire.spread, fire.seed)[0];
      const tr = traceHitscan(this.world, origin, dir, w.range, this.remoteTargets(), this.myId);
      this.localBeam = { end: tr.end, weapon: fire.weapon, until: now + 70 };
      if (tr.normal) this.effects.sparks(tr.end, tr.normal, 2, WEAPON_COLORS[fire.weapon]);
      return;
    }

    this.d.sfx.play(WEAPON_SOUNDS[fire.weapon]);
    this.recoil = Math.min(1, this.recoil + (fire.weapon === WeaponId.Rifle ? 0.25 : fire.weapon === WeaponId.Charge ? 0.6 + 0.4 * fire.charge : 0.9));
    this.viewFlashLife = 0.05;
    if (w.kind === 'hitscan') {
      const targets = this.remoteTargets();
      for (const dir of shotDirections(fire.weapon, cmd.yaw, cmd.pitch, fire.spread, fire.seed)) {
        const tr = traceHitscan(this.world, origin, dir, w.range, targets, this.myId);
        this.effects.tracer(muzzle, tr.end, fire.weapon, fire.charge);
        if (tr.normal) this.effects.sparks(tr.end, tr.normal, fire.weapon === WeaponId.Shotgun ? 2 : 5);
      }
      return;
    }
    const cfg = w.projectile;
    const dir = shotDirections(fire.weapon, cmd.yaw, cmd.pitch, 0, fire.seed)[0];
    if (this.world.raycast(origin, dir, 0.6 + cfg.radius)) return;
    const id = projectileId(this.myId, p.shotCounter);
    this.localProj.set(id, {
      born: performance.now(),
      hidden: false,
      state: {
        id,
        owner: this.myId,
        weapon: fire.weapon,
        x: origin.x + dir.x * 0.6,
        y: origin.y + dir.y * 0.6 - 0.15,
        z: origin.z + dir.z * 0.6,
        vx: dir.x * cfg.speed,
        vy: dir.y * cfg.speed + cfg.launchLift,
        vz: dir.z * cfg.speed,
        age: 0,
        bounces: 0,
        resting: false,
      },
    });
  }

  // ------------------------------------------------------------------ rendering

  private render(dt: number, alpha: number) {
    const { input, hud, settings } = this.d;
    const rt = this.renderTick();
    this.interpolateRemote(rt, dt);

    // camera
    const p = this.pred;
    const decay = Math.exp(-dt * 12);
    this.smooth.multiplyScalar(decay);
    if (p && this.alive) {
      this.camPos.set(
        this.prevPos.x + (p.x - this.prevPos.x) * alpha + this.smooth.x,
        this.prevPos.y + (p.y - this.prevPos.y) * alpha + this.smooth.y + (p.crouched ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight),
        this.prevPos.z + (p.z - this.prevPos.z) * alpha + this.smooth.z,
      );
    } else {
      this.camPos.copy(this.deathPos).add(this.deathCamOffset);
    }
    this.camera.position.copy(this.camPos);
    this.camera.rotation.set(this.alive ? input.pitch : -0.6, input.yaw, 0);

    // aiming (right mouse): narrower field of view per weapon and the view model centred on the
    // sights; scoped weapons (the two snipers) show their scope instead of the model
    const aw = p ? getWeapon(p.weapon) : null;
    const aiming = !!p && !!aw && this.alive && isAiming(p, input.buttons());
    const scoped = aiming && aw!.scoped;
    const targetFov = aiming ? Math.min(settings.fov, aw!.adsFov) : settings.fov;
    const fov = this.camera.fov + (targetFov - this.camera.fov) * Math.min(1, dt * 18);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.adsT += ((aiming ? 1 : 0) - this.adsT) * Math.min(1, dt * 14);
    input.aimScale = this.camera.fov / settings.fov;
    const scopeShown = scoped && this.camera.fov < aw!.adsFov + (settings.fov - aw!.adsFov) * 0.4;
    hud.scope(scopeShown);
    hud.aiming(aiming && !scoped);
    const zoomed = scoped;

    this.updateViewModel(dt, zoomed);
    if (this.localBeam) {
      if (this.alive && performance.now() < this.localBeam.until) {
        const eye = { x: this.camPos.x, y: this.camPos.y, z: this.camPos.z };
        this.effects.beam(this.myId, this.muzzlePoint(eye, input.yaw, input.pitch), this.localBeam.end, this.localBeam.weapon, 0.04);
      } else this.localBeam = null;
    }
    this.renderProjectiles(rt);
    this.effects.update(dt);
    this.props.update(dt);
    this.features.update(dt, this.camPos);
    this.d.sfx.setListener(this.camPos, input.yaw);
    hud.tickDamageFloaters(dt);
    this.updateHud();

    const r = this.d.renderer;
    r.info.reset();
    r.autoClear = true;
    r.render(this.scene, this.camera);
    if (this.alive && !zoomed) {
      r.autoClear = false;
      r.clearDepth();
      r.render(this.viewScene, this.viewCamera);
      r.autoClear = true;
    }
  }

  private interpolateRemote(rt: number, dt: number) {
    const snaps = this.snaps;
    if (snaps.length === 0) return;
    let s0 = snaps[0];
    let s1 = snaps[snaps.length - 1];
    for (let i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].t <= rt) {
        s0 = snaps[i];
        s1 = snaps[Math.min(i + 1, snaps.length - 1)];
        break;
      }
    }
    const span = s1.t - s0.t;
    const f = span > 0 ? Math.min(1, Math.max(0, (rt - s0.t) / span)) : 0;
    this.interpPrevById.clear();
    for (const e of s0.p) this.interpPrevById.set(e[0], e);
    const seen = new Set<number>();
    const ctf = this.d.start.settings.mode === 'ctf';
    for (const b of s1.p) {
      const id = b[0];
      if (id === this.myId) continue;
      seen.add(id);
      let a = this.interpPrevById.get(id) ?? b;
      // a portal trip between both samples: show the arrival instead of sliding through walls
      if (a[9] !== b[9]) a = b;
      const x = (a[1] + (b[1] - a[1]) * f) / 100;
      const y = (a[2] + (b[2] - a[2]) * f) / 100;
      const z = (a[3] + (b[3] - a[3]) * f) / 100;
      const yaw = lerpAngle(a[4] / 1000, b[4] / 1000, f);
      const pitch = (a[5] + (b[5] - a[5]) * f) / 1000;
      const flags = f < 0.5 ? a[6] : b[6];
      const isZombie = (b[6] & PF.Zombie) !== 0;
      const alive = (flags & PF.Alive) !== 0 && (flags & PF.Disconnected) === 0;
      const team = b[8];
      this.teams.set(id, team);
      let c = this.chars.get(id);
      if (!c) {
        if (isZombie) {
          const look = zombieLook(b[7]);
          c = new Character('', look.tint, this.characterShading, this.skinTexZombie(b[7], look.tint));
          this.charLook.set(id, { team, color: look.tint, zombie: true });
        } else {
          const color = this.tintFor(id, team);
          c = new Character(this.name(id), color, this.characterShading, this.skinTex(id, team, color));
          this.charLook.set(id, { team, color });
        }
        this.chars.set(id, c);
        this.scene.add(c.root);
      }
      const speed = span > 0 ? Math.hypot(b[1] - a[1], b[3] - a[3]) / 100 / (span * DT) : 0;
      c.root.position.set(x, y, z);
      if (isZombie) {
        c.setZombieLook(zombieLook(b[7]));
        c.setWeapon(-1);
        c.setCarrier(null);
        c.showLabel(false);
      } else {
        c.setZombieLook(null);
        c.setWeapon(b[7]);
        c.setCarrier(flags & PF.Carrier ? TEAM_COLORS[team === 0 ? 1 : 0] : null);
        // names only for teammates: enemy labels would reveal positions through walls
        c.showLabel(ctf && team === this.myTeam && alive);
      }
      c.update(
        dt,
        yaw,
        pitch,
        speed,
        (flags & PF.OnGround) !== 0,
        alive,
        (flags & PF.Dashing) !== 0,
        (flags & PF.Protected) !== 0,
        (flags & PF.Crouching) !== 0,
        (flags & PF.Sliding) !== 0,
      );
      this.remote.set(id, { x, y, z, alive });
    }
    for (const [id, c] of this.chars) {
      if (!seen.has(id)) {
        c.dispose();
        this.chars.delete(id);
        this.charLook.delete(id);
        this.remote.delete(id);
      }
    }
  }

  private renderProjectiles(rt: number) {
    const snaps = this.snaps;
    this.effects.beginProjectiles();
    if (snaps.length > 0) {
      let s0 = snaps[0];
      let s1 = snaps[snaps.length - 1];
      for (let i = snaps.length - 1; i >= 0; i--) {
        if (snaps[i].t <= rt) {
          s0 = snaps[i];
          s1 = snaps[Math.min(i + 1, snaps.length - 1)];
          break;
        }
      }
      const span = s1.t - s0.t;
      const f = span > 0 ? Math.min(1, Math.max(0, (rt - s0.t) / span)) : 0;
      const prev = new Map(s0.pr.map((e) => [e[0], e]));
      for (const b of s1.pr) {
        const id = b[0];
        if (Math.floor(id / 65536) === this.myId && this.localProj.has(id)) continue;
        const a = prev.get(id);
        if (!a) continue; // appears once it has two samples, avoids popping in ahead of time
        this.effects.projectile(id, b[1], (a[2] + (b[2] - a[2]) * f) / 100, (a[3] + (b[3] - a[3]) * f) / 100, (a[4] + (b[4] - a[4]) * f) / 100);
      }
    }
    for (const [id, lp] of this.localProj) {
      if (!lp.hidden) this.effects.projectile(id, lp.state.weapon, lp.state.x, lp.state.y, lp.state.z);
    }
    this.effects.endProjectiles();
  }

  private updateViewModel(dt: number, zoomed: boolean) {
    const p = this.pred;
    const show = !!p && this.alive && !zoomed;
    this.viewWeapons.forEach((w, i) => (w.group.visible = show && p!.weapon === i));
    this.viewArms.group.visible = show;
    if (!p || !show) {
      this.viewFlash.visible = false;
      return;
    }
    const w = this.viewWeapons[p.weapon];
    const speed = Math.hypot(p.vx, p.vz);
    if (p.onGround) this.bob += dt * speed * 1.4;
    this.recoil = Math.max(0, this.recoil - dt * 6);
    const sw = p.pendingWeapon >= 0 ? 1 - p.switchTime / Math.max(0.01, WEAPONS[p.pendingWeapon].switchTime) : 0;
    const lower = p.pendingWeapon >= 0 ? Math.sin(sw * Math.PI) * 0.35 : 0;
    const bobAmt = Math.min(1, speed / 8.5) * (p.onGround ? 1 : 0.3);
    // blend between the resting pose and the one with the sights on the centre of the screen
    const pose = viewPose(p.weapon);
    const a = this.adsT;
    const calm = 1 - a * 0.85; // bob and kick are much smaller while aiming
    w.group.position.set(
      pose.hip[0] + (pose.ads[0] - pose.hip[0]) * a + Math.cos(this.bob) * 0.012 * bobAmt * calm,
      pose.hip[1] + (pose.ads[1] - pose.hip[1]) * a - Math.abs(Math.sin(this.bob)) * 0.018 * bobAmt * calm - lower,
      pose.hip[2] + (pose.ads[2] - pose.hip[2]) * a + this.recoil * 0.08 * calm,
    );
    w.group.rotation.set(this.recoil * 0.12 * calm - lower, 0, 0);
    this.viewArms.setWeapon(p.weapon);
    this.viewArms.follow(w.group);
    if (this.viewFlashLife > 0) {
      this.viewFlashLife -= dt;
      w.muzzle.getWorldPosition(this.muzzleTmp);
      this.viewFlash.position.copy(this.muzzleTmp);
      this.viewFlash.scale.setScalar(0.25 + Math.random() * 0.1);
      this.viewFlash.visible = true;
    } else this.viewFlash.visible = false;
  }

  private updateHud() {
    const { hud, input, net, settings } = this.d;
    const me = this.me;
    const p = this.pred;
    const mode = this.d.start.settings.mode;
    if (me) {
      hud.setVitals(me.hp, me.maxHp, me.shield, me.maxShield, p ? 1 - p.dashCd / PLAYER.dashCooldown : 0);
      hud.respawnInfo(me.alive, me.respawnIn);
    }
    if (p && this.alive) hud.setWeapons(p.weapon, p.ammo, p.pendingWeapon >= 0);
    const cw = p && this.alive ? getWeapon(p.weapon) : null;
    hud.setCharge(cw && cw.kind === 'hitscan' && cw.charge && p!.charge > 0 ? Math.min(1, p!.charge / cw.charge.time) : null);
    hud.setTimer(this.timeLeft);
    if (mode === 'ctf') {
      hud.setScoreCTF(this.teamScores, this.d.start.settings.scoreLimit);
      hud.setFlags(this.flags, this.names, this.myTeam, this.myId);
      if (p && this.alive) {
        const half = ((this.d.settings.fov * Math.PI) / 180) * 0.42;
        const ptrs: FlagPointer[] = [];
        for (const fl of this.flags) {
          const fx = fl[2] / 100;
          const fz = fl[4] / 100;
          const dx = fx - p.x;
          const dz = fz - p.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 2.5) continue;
          const bearing = Math.atan2(-dx, -dz);
          let rel = bearing - input.yaw;
          while (rel > Math.PI) rel -= Math.PI * 2;
          while (rel < -Math.PI) rel += Math.PI * 2;
          if (Math.abs(rel) <= half) continue;
          ptrs.push({ team: fl[0], rel, dist });
        }
        hud.setFlagPointers(ptrs);
      } else hud.clearFlagPointers();
    } else {
      hud.setScoreDM(this.scores, this.myId, this.d.start.settings.scoreLimit);
      hud.clearFlagPointers();
    }
    hud.scoreboard(input.scoreboard, this.scores, mode, this.myId, this.teamScores, this.snapWeapons);
    hud.clickToPlay(!input.locked);
    if (settings.showNetStats) {
      const latest = this.snaps[this.snaps.length - 1];
      const buffer = latest ? ((latest.t - this.renderTick()) / TICK_RATE) * 1000 : 0;
      hud.netstats(
        true,
        [
          `FPS        ${this.fps.toFixed(0)}`,
          `Ping       ${net.rtt.toFixed(0)} ms`,
          `Snapshots  ${this.snapRate.toFixed(1)} /s`,
          `Inputs pend ${this.pending.length}`,
          `Error pred ${(this.predError * 100).toFixed(1)} cm`,
          `Interp     ${NET.interpDelayMs} ms (buffer ${buffer.toFixed(0)} ms)`,
          `Tick serv  ${this.serverTickNow().toFixed(0)}`,
          `Draw calls ${this.d.renderer.info.render.calls}`,
        ].join('\n'),
      );
    } else hud.netstats(false, '');
  }

  /** Whether the local player currently carries a flag (for UI tint). */
  get carrying(): boolean {
    return this.flags.some((f) => f[1] === FlagState.Carried && f[5] === this.myId);
  }

  get cloneState(): PlayerSimState | null {
    return this.pred ? clonePlayerSimState(this.pred) : null;
  }

  /** Último snapshot recibido (p. ej. alinear yaw tras la tienda). */
  latestSnapshot(): SnapshotMsg | null {
    return this.snaps.length > 0 ? this.snaps[this.snaps.length - 1]! : null;
  }

  /** Weapon with the most kills per player this match (for the results screen). */
  dominantKillWeapons(): Map<number, number> {
    const out = new Map<number, number>();
    for (const [pid, counts] of this.killWeaponCounts) {
      let best = 0;
      let bestW = 0;
      for (const [w, n] of counts) {
        if (n > best) {
          best = n;
          bestW = w;
        }
      }
      if (best > 0) out.set(pid, bestW);
    }
    return out;
  }
}
