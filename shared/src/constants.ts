/** Server simulation rate. One client input == one fixed step. */
export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
/** Snapshots are sent every N ticks (30 / 2 = 15 Hz). */
export const SNAPSHOT_EVERY_TICKS = 2;

export const PLAYER = {
  radius: 0.4,
  height: 1.8,
  eyeHeight: 1.6,
  headCenter: 1.62,
  headHalf: 0.2,
  bodyTop: 1.42,
  stepHeight: 0.45,
  groundSnap: 0.45,

  runSpeed: 8.5,
  /** Acceleration multipliers (accel * dt * wishSpeed per step). */
  groundAccel: 12,
  airAccel: 3,
  friction: 8,
  stopSpeed: 2,
  gravity: 24,
  jumpSpeed: 8.2,
  maxFallSpeed: 45,
  /** Hard cap on horizontal speed, regardless of knockback or dash. */
  maxHorizontalSpeed: 26,

  dashSpeed: 21,
  dashDuration: 0.17,
  dashCooldown: 1.1,
  /** Horizontal speed kept when a dash ends. */
  dashExitSpeed: 10,

  /** Standing vs crouch (feet stay on the floor; collision height shrinks). */
  crouchHeight: 1.15,
  crouchEyeHeight: 0.95,
  crouchSpeedMult: 0.55,
  /** Damage multiplier for leg hits (body = 1, head = weapon headshot multiplier). */
  legsDamageMult: 0.75,
  legsTop: 0.52,

  slideSpeed: 23,
  slideDuration: 0.42,
  slideCooldown: 2.2,
  slideExitSpeed: 8,

  /** Health and shield on spawn / respawn, and their caps (pickups never exceed the caps). */
  startHealth: 100,
  maxHealth: 100,
  startShield: 0,
  maxShield: 100,
  respawnDelay: 2.5,
  spawnProtection: 1.5,
} as const;

/** Portals (see `PortalDef`): only players travel through them, projectiles and shots do not. */
export const PORTAL = {
  /** Seconds after a trip during which no portal can be entered again (prevents ping-pong loops). */
  reentryCooldown: 0.75,
  /** Depth of the trigger volume in front of a wall portal. */
  triggerDepth: 0.5,
  /** Fraction of the floor portal radius that the player's feet must reach. */
  floorTriggerFraction: 0.6,
} as const;

/** Jump pads (see `JumpPadDef`). */
export const JUMP_PAD = {
  /** Default minimum time between two launches of the same player. */
  cooldown: 0.8,
  /** Feet may be this far above the pad surface and still trigger it. */
  triggerHeight: 0.3,
} as const;

/** Max horizontal distance moved per collision sub-step. Must be < thinnest wall (0.3 m). */
export const MAX_SUBSTEP_DIST = 0.2;

export const NET = {
  /** Lag compensation history length and max rewind. */
  historyTicks: TICK_RATE, // 1 s
  maxRewindMs: 250,
  /** Inputs buffered per player before newer ones are dropped. */
  maxQueuedInputs: 12,
  /** Max inputs consumed for one player in a single tick (catch-up after jitter). */
  maxInputCredits: 4,
  /** Ticks without input before the server applies an idle step (so players do not hang mid-air). */
  starveTicks: 8,
  /** Client interpolation delay for remote entities. */
  interpDelayMs: 110,
  maxMessagesPerSecond: 120,
  /**
   * Largest WebSocket message the server accepts from a client. It was 16 KB (inputs and lobby
   * messages are < 200 B); raised to 64 KB only because a player skin (PNG, max 48 KB, see
   * `SKIN.maxBytes`) travels as one message. The 120 messages/s limit and the 1 skin/s throttle in
   * `ArenaRoom` bound the abuse surface.
   */
  maxPayloadBytes: 64 * 1024,
  reconnectSeconds: 20,
} as const;

export const ROOM = {
  maxPlayers: 8,
  codeLength: 6,
  /** No 0/O, 1/I/L to avoid confusion. */
  codeAlphabet: '23456789ABCDEFGHJKMNPQRSTUVWXYZ',
  nameMaxLength: 16,
} as const;
