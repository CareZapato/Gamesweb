import { JUMP_PAD, MAX_SUBSTEP_DIST, PLAYER, PORTAL } from './constants';
import { headingVec, headingYaw } from './map';
import { clamp, dirFromYawPitch, hash2, mulberry32, type Vec3, wrapAngle } from './math';
import { getWeapon, isValidWeapon, WEAPON_COUNT, WEAPONS } from './weapons';
import { type AABB, aabbOverlap, type CollisionWorld, playerAABB, type Ramp, rampMaxUnder } from './world';

export const Btn = {
  Forward: 1,
  Back: 2,
  Left: 4,
  Right: 8,
  Jump: 16,
  Dash: 32,
  Fire: 64,
  /** Aiming down sights (right mouse): reduces spread and run speed, see weapons.ts. */
  Aim: 128,
  /** Hold Ctrl to crouch (lower profile, slower move). */
  Crouch: 256,
  /** Edge on C: ground slide while moving. */
  Slide: 512,
} as const;

export interface InputCmd {
  /** Monotonic sequence number, acknowledged by the server in snapshots. */
  seq: number;
  buttons: number;
  yaw: number;
  pitch: number;
  /** Weapon the player wants equipped. */
  weapon: number;
  /** Server tick (fractional) the client was rendering remote players at; used for lag compensation. */
  viewTick: number;
}

/** Everything needed to deterministically simulate one player step, shared by client prediction and server. */
export interface PlayerSimState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  dashTime: number;
  dashCd: number;
  dashDx: number;
  dashDz: number;
  dashHeld: boolean;
  weapon: number;
  pendingWeapon: number;
  switchTime: number;
  fireCd: number;
  ammo: number[];
  spread: number;
  shotCounter: number;
  fireHeld: boolean;
  /** Seconds of charge accumulated by a charge weapon (0 for the rest). */
  charge: number;
  /** Seconds until a portal can be entered again. */
  portalCd: number;
  /** Seconds until a jump pad can launch this player again. */
  padCd: number;
  /** Portal trips so far (wraps at 2^31); a change tells the client a trip happened. */
  warps: number;
  /** View rotation applied by the last portal trip (radians). */
  warpYaw: number;
  /** Index of the destination portal of the last trip, or -1. */
  warpTo: number;
  /** Jump pad launches so far. */
  pads: number;
  crouched: boolean;
  slideTime: number;
  slideCd: number;
  slideDx: number;
  slideDz: number;
  slideHeld: boolean;
}

/** Facts about other players that movement needs; the server knows them exactly, the client approximately. */
export interface MovementEnv {
  /** True when a portal exit at these feet coordinates is occupied by another player. */
  exitBlocked?: (x: number, y: number, z: number) => boolean;
}

export interface FireResult {
  weapon: number;
  /** Cone half-angle of this shot, already reduced by aiming. */
  spread: number;
  seed: number;
  /** Charge fraction 0..1 for charge weapons (0 for the rest). */
  charge: number;
}

const initialSpread = (weaponId: number): number => {
  const w = getWeapon(weaponId);
  return w.kind === 'hitscan' ? w.spreadBase : 0;
};

export const createPlayerSimState = (x = 0, y = 0, z = 0): PlayerSimState => ({
  x,
  y,
  z,
  vx: 0,
  vy: 0,
  vz: 0,
  onGround: false,
  dashTime: 0,
  dashCd: 0,
  dashDx: 0,
  dashDz: 0,
  dashHeld: false,
  weapon: 0,
  pendingWeapon: -1,
  switchTime: 0,
  fireCd: 0,
  ammo: WEAPONS.map((w) => w.startAmmo),
  spread: initialSpread(0),
  shotCounter: 0,
  fireHeld: false,
  charge: 0,
  portalCd: 0,
  padCd: 0,
  warps: 0,
  warpYaw: 0,
  warpTo: -1,
  pads: 0,
  crouched: false,
  slideTime: 0,
  slideCd: 0,
  slideDx: 0,
  slideDz: 0,
  slideHeld: false,
});

export const clonePlayerSimState = (s: PlayerSimState): PlayerSimState => ({ ...s, ammo: s.ammo.slice() });

export const copyPlayerSimState = (dst: PlayerSimState, s: PlayerSimState): void => {
  const ammo = dst.ammo;
  Object.assign(dst, s);
  dst.ammo = ammo;
  for (let i = 0; i < WEAPON_COUNT; i++) ammo[i] = s.ammo[i] ?? 0;
};

const scratch = { boxes: [] as AABB[], ramps: [] as Ramp[] };
const box: AABB = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };

export const playerCollisionHeight = (s: PlayerSimState): number =>
  s.crouched || s.slideTime > 0 ? PLAYER.crouchHeight : PLAYER.height;

const pbox = (s: PlayerSimState, out = box) => playerAABB(s.x, s.y, s.z, PLAYER.radius, playerCollisionHeight(s), out);

/**
 * Moves the player along one axis, resolving collisions. Horizontal moves may step up small ledges
 * and ramps. Returns true when movement was blocked.
 */
const moveAxis = (s: PlayerSimState, world: CollisionWorld, axis: 'x' | 'y' | 'z', delta: number, canStep: boolean): boolean => {
  if (delta === 0) return false;
  const prev = s[axis];
  s[axis] = prev + delta;
  if (!world.overlapping(pbox(s), scratch)) return false;

  if (axis !== 'y' && canStep) {
    const y0 = s.y;
    s.y = y0 + PLAYER.stepHeight;
    const raised = pbox(s);
    if (!world.overlapsAny(raised)) {
      const floor = world.floorBelow(raised, PLAYER.stepHeight + 0.01);
      s.y = floor !== null && floor >= y0 ? floor : y0 + PLAYER.stepHeight;
      if (!world.overlapsAny(pbox(s))) return false;
    }
    s.y = y0;
    world.overlapping(pbox(s), scratch);
  }

  const r = axis === 'y' ? 0 : PLAYER.radius;
  if (axis === 'y') {
    if (delta < 0) {
      // landing: highest top among hits that we were above before the move
      let top = -Infinity;
      const prevBox = playerAABB(s.x, prev, s.z, PLAYER.radius, PLAYER.height, { ...box });
      for (const b of scratch.boxes) {
        if (prevBox.minY < b.maxY - 1e-3) return revert(s, axis, prev);
        top = Math.max(top, b.maxY);
      }
      for (const rp of scratch.ramps) top = Math.max(top, rampMaxUnder(rp, prevBox));
      s.y = top;
    } else {
      let bottom = Infinity;
      for (const b of scratch.boxes) bottom = Math.min(bottom, b.minY);
      if (scratch.ramps.length > 0 || bottom === Infinity) return revert(s, axis, prev);
      s.y = Math.max(prev, bottom - PLAYER.height);
    }
    if (world.overlapsAny(pbox(s))) return revert(s, axis, prev);
    return true;
  }

  if (scratch.ramps.length > 0) return revert(s, axis, prev);
  const minKey = axis === 'x' ? 'minX' : 'minZ';
  const maxKey = axis === 'x' ? 'maxX' : 'maxZ';
  let limit = delta > 0 ? Infinity : -Infinity;
  for (const b of scratch.boxes) {
    // must have been outside along this axis before the move, otherwise we cannot pick a face
    if (prev + r > b[minKey] + 1e-3 && prev - r < b[maxKey] - 1e-3) return revert(s, axis, prev);
    limit = delta > 0 ? Math.min(limit, b[minKey] - r) : Math.max(limit, b[maxKey] + r);
  }
  s[axis] = delta > 0 ? clamp(limit, prev, prev + delta) : clamp(limit, prev + delta, prev);
  if (world.overlapsAny(pbox(s))) return revert(s, axis, prev);
  return true;
};

const revert = (s: PlayerSimState, axis: 'x' | 'y' | 'z', prev: number): boolean => {
  s[axis] = prev;
  return true;
};

export const wishDirection = (buttons: number, yaw: number): { x: number; z: number } => {
  const f = (buttons & Btn.Forward ? 1 : 0) - (buttons & Btn.Back ? 1 : 0);
  const r = (buttons & Btn.Right ? 1 : 0) - (buttons & Btn.Left ? 1 : 0);
  const fx = -Math.sin(yaw),
    fz = -Math.cos(yaw);
  const rx = Math.cos(yaw),
    rz = -Math.sin(yaw);
  let x = fx * f + rx * r;
  let z = fz * f + rz * r;
  const l = Math.hypot(x, z);
  if (l > 1e-6) {
    x /= l;
    z /= l;
  } else {
    x = 0;
    z = 0;
  }
  return { x, z };
};

/** Whether the input is aiming down sights with the weapon currently equipped (not while switching). */
export const isAiming = (s: PlayerSimState, buttons: number): boolean => (buttons & Btn.Aim) !== 0 && s.pendingWeapon < 0;

/** Run speed multiplier from aiming and from a charge in progress (the smaller one wins). */
export const moveSpeedMult = (s: PlayerSimState, buttons: number): number => {
  const w = getWeapon(s.weapon);
  let m = isAiming(s, buttons) ? w.adsMoveMult : 1;
  if (w.kind === 'hitscan' && w.charge && s.charge > 0) m = Math.min(m, w.charge.moveMult);
  return m;
};

/** Movement only. Identical on client (prediction) and server (authority). */
export const stepMovement = (s: PlayerSimState, cmd: InputCmd, world: CollisionWorld, dt: number, env?: MovementEnv): void => {
  const wish = wishDirection(cmd.buttons, cmd.yaw);
  s.dashCd = Math.max(0, s.dashCd - dt);
  s.slideCd = Math.max(0, s.slideCd - dt);
  s.portalCd = Math.max(0, s.portalCd - dt);
  s.padCd = Math.max(0, s.padCd - dt);

  const slidePressed = (cmd.buttons & Btn.Slide) !== 0;
  if (slidePressed && !s.slideHeld && s.slideCd <= 0 && s.slideTime <= 0 && s.dashTime <= 0 && s.onGround) {
    let dx = wish.x,
      dz = wish.z;
    if (dx === 0 && dz === 0) {
      dx = -Math.sin(cmd.yaw);
      dz = -Math.cos(cmd.yaw);
    }
    const sl = Math.hypot(dx, dz) || 1;
    s.slideDx = dx / sl;
    s.slideDz = dz / sl;
    s.slideTime = PLAYER.slideDuration;
    s.slideCd = PLAYER.slideCooldown;
    s.crouched = true;
    if (s.vy < 0) s.vy = 0;
  }
  s.slideHeld = slidePressed;

  const dashPressed = (cmd.buttons & Btn.Dash) !== 0;
  if (dashPressed && !s.dashHeld && s.dashCd <= 0 && s.dashTime <= 0 && s.slideTime <= 0) {
    let dx = wish.x,
      dz = wish.z;
    if (dx === 0 && dz === 0) {
      dx = -Math.sin(cmd.yaw);
      dz = -Math.cos(cmd.yaw);
    }
    s.dashDx = dx;
    s.dashDz = dz;
    s.dashTime = PLAYER.dashDuration;
    s.dashCd = PLAYER.dashCooldown;
    if (s.vy < 0) s.vy = 0;
  }
  s.dashHeld = dashPressed;

  if (s.slideTime > 0) {
    s.vx = s.slideDx * PLAYER.slideSpeed;
    s.vz = s.slideDz * PLAYER.slideSpeed;
    s.slideTime -= dt;
    s.crouched = true;
    if (s.slideTime <= 1e-9) {
      s.slideTime = 0;
      const sp = Math.hypot(s.vx, s.vz);
      if (sp > PLAYER.slideExitSpeed) {
        s.vx *= PLAYER.slideExitSpeed / sp;
        s.vz *= PLAYER.slideExitSpeed / sp;
      }
    }
  } else if (s.dashTime > 0) {
    s.vx = s.dashDx * PLAYER.dashSpeed;
    s.vz = s.dashDz * PLAYER.dashSpeed;
    s.dashTime -= dt;
    if (s.dashTime <= 1e-9) {
      s.dashTime = 0;
      const sp = Math.hypot(s.vx, s.vz);
      if (sp > PLAYER.dashExitSpeed) {
        s.vx *= PLAYER.dashExitSpeed / sp;
        s.vz *= PLAYER.dashExitSpeed / sp;
      }
    }
  } else {
    if (s.onGround) {
      const sp = Math.hypot(s.vx, s.vz);
      if (sp > 0) {
        const drop = Math.max(sp, PLAYER.stopSpeed) * PLAYER.friction * dt;
        const ns = Math.max(0, sp - drop) / sp;
        s.vx *= ns;
        s.vz *= ns;
      }
    }
    const crouchHeld = (cmd.buttons & Btn.Crouch) !== 0;
    s.crouched = s.onGround && crouchHeld && s.slideTime <= 0;
    const wishSpeed =
      wish.x !== 0 || wish.z !== 0
        ? PLAYER.runSpeed * moveSpeedMult(s, cmd.buttons) * (s.crouched ? PLAYER.crouchSpeedMult : 1)
        : 0;
    if (wishSpeed > 0) {
      const accel = s.onGround ? PLAYER.groundAccel : PLAYER.airAccel;
      const current = s.vx * wish.x + s.vz * wish.z;
      const add = wishSpeed - current;
      if (add > 0) {
        const a = Math.min(accel * dt * wishSpeed, add);
        s.vx += a * wish.x;
        s.vz += a * wish.z;
      }
    }
    if (s.onGround && cmd.buttons & Btn.Jump && s.slideTime <= 0 && !s.crouched) {
      s.vy = PLAYER.jumpSpeed;
      s.onGround = false;
    }
  }

  if (!s.onGround && s.slideTime <= 0) s.crouched = false;

  if (!s.onGround || s.vy > 0) s.vy -= PLAYER.gravity * dt;
  s.vy = Math.max(s.vy, -PLAYER.maxFallSpeed);
  const hs = Math.hypot(s.vx, s.vz);
  if (hs > PLAYER.maxHorizontalSpeed) {
    s.vx *= PLAYER.maxHorizontalSpeed / hs;
    s.vz *= PLAYER.maxHorizontalSpeed / hs;
  }

  const dx = s.vx * dt,
    dy = s.vy * dt,
    dz = s.vz * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz), Math.abs(dy)) / MAX_SUBSTEP_DIST));
  const wasGrounded = s.onGround;
  let landed = false;
  let yBlocked = false;
  for (let i = 0; i < steps; i++) {
    const canStep = wasGrounded || s.vy <= 0;
    if (moveAxis(s, world, 'x', dx / steps, canStep)) s.vx = 0;
    if (moveAxis(s, world, 'z', dz / steps, canStep)) s.vz = 0;
    if (!yBlocked && moveAxis(s, world, 'y', dy / steps, false)) {
      if (dy < 0) landed = true;
      s.vy = 0;
      yBlocked = true;
    }
  }

  // ground detection / snapping (walk down ramps and stairs without bouncing)
  if (landed) {
    s.onGround = true;
  } else if (s.vy <= 0) {
    const reach = wasGrounded ? PLAYER.groundSnap : 0.02;
    const floor = world.floorBelow(pbox(s), reach);
    if (floor !== null) {
      s.y = floor;
      s.onGround = true;
      if (s.vy < 0) s.vy = 0;
    } else s.onGround = false;
  } else s.onGround = false;

  if (world.jumpPads.length > 0) stepJumpPads(s, world);
  if (world.portals.length > 0) stepPortals(s, cmd, world, env);
};

/** Rotates a horizontal vector by `a` radians in the yaw sense (forward(yaw) → forward(yaw + a)). */
const rotYaw = (x: number, z: number, a: number): [number, number] => {
  const c = Math.cos(a),
    sn = Math.sin(a);
  return [x * c + z * sn, z * c - x * sn];
};

const stepJumpPads = (s: PlayerSimState, world: CollisionWorld): void => {
  if (s.padCd > 0 || s.vy > 0) return;
  for (const pad of world.jumpPads) {
    const dy = s.y - pad.pos[1];
    if (dy < -0.05 || dy > JUMP_PAD.triggerHeight) continue;
    if (Math.hypot(s.x - pad.pos[0], s.z - pad.pos[2]) > pad.radius) continue;
    s.vx = pad.launch[0];
    s.vy = pad.launch[1];
    s.vz = pad.launch[2];
    s.onGround = false;
    s.dashTime = 0;
    s.padCd = pad.cooldown;
    s.pads = (s.pads + 1) | 0;
    return;
  }
};

const stepPortals = (s: PlayerSimState, cmd: InputCmd, world: CollisionWorld, env?: MovementEnv): void => {
  if (s.portalCd > 0) return;
  const me = pbox(s);
  for (const entry of world.portals) {
    if (!aabbOverlap(me, entry.trigger)) continue;
    const dest = world.portals[entry.to].def;
    const exit = dest.exits.find((e) => !env?.exitBlocked?.(e[0], e[1], e[2]));
    if (!exit) return; // every exit occupied: wait inside the trigger until one frees up
    const outYaw = headingYaw(dest.face);
    let turn: number;
    if (entry.def.kind === 'wall') {
      const inYaw = headingYaw(entry.def.face) + Math.PI;
      turn = wrapAngle(outYaw - inYaw);
      [s.vx, s.vz] = rotYaw(s.vx, s.vz, turn);
      [s.dashDx, s.dashDz] = rotYaw(s.dashDx, s.dashDz, turn);
    } else {
      const out = headingVec(dest.face);
      const speed = Math.hypot(s.vx, s.vz);
      s.vx = out.x * speed;
      s.vz = out.z * speed;
      s.vy = 0;
      if (s.dashTime > 0) {
        s.dashDx = out.x;
        s.dashDz = out.z;
      }
      turn = wrapAngle(outYaw - cmd.yaw);
    }
    s.x = exit[0];
    s.y = exit[1];
    s.z = exit[2];
    s.onGround = world.floorBelow(pbox(s), 0.05) !== null;
    s.portalCd = PORTAL.reentryCooldown;
    s.warps = (s.warps + 1) | 0;
    s.warpYaw = turn;
    s.warpTo = entry.to;
    return;
  }
};

/** Weapon timers, switching, ammo and fire rate. Returns a FireResult when a shot was fired. */
export const stepWeapon = (s: PlayerSimState, cmd: InputCmd, dt: number, playerId: number): FireResult | null => {
  s.fireCd = Math.max(0, s.fireCd - dt);
  const cur = getWeapon(s.weapon);
  if (cur.kind === 'hitscan') s.spread = Math.max(cur.spreadBase, s.spread - cur.spreadRecovery * dt);

  if (isValidWeapon(cmd.weapon)) {
    if (cmd.weapon === s.weapon) {
      s.pendingWeapon = -1;
      s.switchTime = 0;
    } else if (cmd.weapon !== s.pendingWeapon) {
      s.pendingWeapon = cmd.weapon;
      s.switchTime = getWeapon(cmd.weapon).switchTime;
    }
  }
  if (s.pendingWeapon >= 0) {
    s.switchTime -= dt;
    if (s.switchTime <= 1e-9) {
      s.weapon = s.pendingWeapon;
      s.pendingWeapon = -1;
      s.switchTime = 0;
      const w = getWeapon(s.weapon);
      s.spread = w.kind === 'hitscan' ? w.spreadBase : 0;
      s.fireCd = Math.max(s.fireCd, 0);
      s.charge = 0;
    }
  }

  const firing = (cmd.buttons & Btn.Fire) !== 0;
  const w = getWeapon(s.weapon);
  const ready = s.pendingWeapon < 0 && s.fireCd <= 1e-9 && (s.ammo[s.weapon] ?? 0) >= w.ammoPerShot;
  let result: FireResult | null = null;

  /** Spends ammo and starts the cooldown. `charge` is the 0..1 fraction of a charge weapon. */
  const shoot = (charge: number): FireResult => {
    s.ammo[s.weapon] -= w.ammoPerShot;
    s.fireCd = w.fireInterval;
    s.shotCounter = (s.shotCounter + 1) >>> 0;
    // aiming tightens the cone of this shot only; the growing spread of bursts is kept as it is
    const spread = s.spread * (isAiming(s, cmd.buttons) ? w.adsSpreadMult : 1);
    const r: FireResult = { weapon: s.weapon, spread, seed: hash2(playerId, s.shotCounter), charge };
    if (w.kind === 'hitscan') s.spread = Math.min(w.spreadMax, s.spread + w.spreadPerShot);
    return r;
  };

  if (w.kind === 'hitscan' && w.charge) {
    // Charge weapon: holding the button accumulates charge (only while it could fire); releasing
    // fires with a damage that grows with it. Too short a charge is cancelled for free.
    const ch = w.charge;
    if (s.pendingWeapon >= 0) s.charge = 0;
    else if (firing) {
      if (ready) s.charge = Math.min(ch.time, s.charge + dt);
    } else {
      if (ready && s.charge >= ch.minTime - 1e-9) result = shoot(Math.min(1, s.charge / ch.time));
      s.charge = 0;
    }
  } else if (firing && ready && (w.automatic || !s.fireHeld)) {
    result = shoot(0);
  }
  s.fireHeld = firing;
  return result;
};

export const eyePosition = (s: Pick<PlayerSimState, 'x' | 'y' | 'z' | 'crouched'>): Vec3 => ({
  x: s.x,
  y: s.y + (s.crouched ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight),
  z: s.z,
});

/** Deterministic pellet directions for a shot (shared so client tracers match the server). */
export const shotDirections = (weaponId: number, yaw: number, pitch: number, spread: number, seed: number): Vec3[] => {
  const w = getWeapon(weaponId);
  const pellets = w.kind === 'hitscan' ? w.pellets : 1;
  const f = dirFromYawPitch(yaw, pitch);
  const rx = Math.cos(yaw),
    rz = -Math.sin(yaw);
  // up = right x forward
  const ux = -rz * f.y,
    uy = rz * f.x - rx * f.z,
    uz = rx * f.y;
  const rng = mulberry32(seed);
  const out: Vec3[] = [];
  for (let i = 0; i < pellets; i++) {
    let a: number;
    let phi: number;
    if (pellets > 1) {
      // stratified ring pattern with jitter: consistent spread but not a fixed grid
      phi = ((i + rng() * 0.6) / pellets) * Math.PI * 2;
      a = spread * (i === 0 ? 0.15 * rng() : 0.45 + 0.55 * Math.sqrt(rng()));
    } else {
      phi = rng() * Math.PI * 2;
      a = spread * Math.sqrt(rng());
    }
    const ca = Math.cos(a),
      sa = Math.sin(a);
    const cp = Math.cos(phi),
      sp = Math.sin(phi);
    const x = f.x * ca + (rx * cp + ux * sp) * sa;
    const y = f.y * ca + uy * sp * sa;
    const z = f.z * ca + (rz * cp + uz * sp) * sa;
    const l = Math.hypot(x, y, z);
    out.push({ x: x / l, y: y / l, z: z / l });
  }
  return out;
};
