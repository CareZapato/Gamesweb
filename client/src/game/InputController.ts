import { Btn, WEAPON_COUNT } from '@arena/shared';

/** Base radians per mouse count at sensitivity 1. */
const MOUSE_SCALE = 0.0022;

/**
 * Keyboard + mouse with Pointer Lock. Edge-triggered actions (jump, dash, fire clicks) are latched
 * so a tap shorter than one simulation tick is never lost.
 */
export class InputController {
  yaw = 0;
  pitch = 0;
  desiredWeapon = 0;
  locked = false;
  /** Right mouse button held (aiming down sights). */
  aim = false;
  scoreboard = false;
  sensitivity = 1;
  invertY = false;
  /** Multiplier for zoomed aiming (fov ratio) so sensitivity feels consistent. */
  aimScale = 1;
  /** Tienda / overlays HTML: sin pointer lock ni disparo (listeners siguen activos). */
  uiBlocked = false;

  private keys = new Set<string>();
  private fireHeld = false;
  private latched = 0;
  private attached = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private onLockChange: (locked: boolean) => void,
    private onWeaponKey: (weapon: number) => void,
  ) {}

  attach() {
    if (this.attached) return;
    this.attached = true;
    document.addEventListener('pointerlockchange', this.lockChange);
    document.addEventListener('mousemove', this.mouseMove);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('mousedown', this.mouseDown);
    window.addEventListener('mouseup', this.mouseUp);
    window.addEventListener('wheel', this.wheel, { passive: true });
    window.addEventListener('blur', this.blur);
    this.canvas.addEventListener('contextmenu', this.prevent);
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    document.removeEventListener('pointerlockchange', this.lockChange);
    document.removeEventListener('mousemove', this.mouseMove);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('mousedown', this.mouseDown);
    window.removeEventListener('mouseup', this.mouseUp);
    window.removeEventListener('wheel', this.wheel);
    window.removeEventListener('blur', this.blur);
    this.canvas.removeEventListener('contextmenu', this.prevent);
    this.blur();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  /** Must be called from a user gesture (click / key press). */
  requestLock() {
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => undefined);
    } catch {
      // some browsers throw if called too soon after leaving pointer lock; the next click retries
    }
  }

  /** Current buttons for this tick, including latched taps. */
  buttons(): number {
    if (this.uiBlocked || !this.isLocked()) return 0;
    let b = this.latched;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) b |= Btn.Forward;
    if (k.has('KeyS') || k.has('ArrowDown')) b |= Btn.Back;
    if (k.has('KeyA') || k.has('ArrowLeft')) b |= Btn.Left;
    if (k.has('KeyD') || k.has('ArrowRight')) b |= Btn.Right;
    if (k.has('Space')) b |= Btn.Jump;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) b |= Btn.Dash;
    if (k.has('ControlLeft') || k.has('ControlRight')) b |= Btn.Crouch;
    if (this.fireHeld) b |= Btn.Fire;
    if (this.aim) b |= Btn.Aim;
    return b;
  }

  clearLatches() {
    this.latched = 0;
  }

  private prevent = (e: Event) => e.preventDefault();

  private lockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    if (!this.locked) {
      this.fireHeld = false;
      this.aim = false;
      this.keys.clear();
    }
    this.onLockChange(this.locked);
  };

  private mouseMove = (e: MouseEvent) => {
    if (this.uiBlocked || !this.isLocked()) return;
    const s = MOUSE_SCALE * this.sensitivity * this.aimScale;
    this.yaw -= e.movementX * s;
    this.pitch -= e.movementY * s * (this.invertY ? -1 : 1);
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  };

  private keyDown = (e: KeyboardEvent) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      this.scoreboard = true;
      return;
    }
    // held keys are tracked even before the lock event arrives, so a key held while clicking counts
    this.keys.add(e.code);
    if (this.uiBlocked || !this.isLocked()) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'Space') this.latched |= Btn.Jump;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.latched |= Btn.Dash;
      if (e.code === 'KeyC') this.latched |= Btn.Slide;
      const digit = /^Digit([1-7])$/.exec(e.code);
      if (digit) this.selectWeapon(Number(digit[1]) - 1);
    }
  };

  /** The lock flag from the change event can lag behind the actual lock state by a frame. */
  private isLocked() {
    return this.locked || document.pointerLockElement === this.canvas;
  }

  private keyUp = (e: KeyboardEvent) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      this.scoreboard = false;
    }
    this.keys.delete(e.code);
  };

  private mouseDown = (e: MouseEvent) => {
    if (this.uiBlocked || !this.isLocked()) return;
    if (e.button === 0) {
      this.fireHeld = true;
      this.latched |= Btn.Fire;
    } else if (e.button === 2) this.aim = true;
  };

  private mouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.fireHeld = false;
    else if (e.button === 2) this.aim = false;
  };

  private wheel = (e: WheelEvent) => {
    if (this.uiBlocked || !this.isLocked() || e.deltaY === 0) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    this.selectWeapon((this.desiredWeapon + dir + WEAPON_COUNT) % WEAPON_COUNT);
  };

  private blur = () => {
    this.keys.clear();
    this.fireHeld = false;
    this.aim = false;
    this.scoreboard = false;
  };

  selectWeapon(w: number) {
    if (w < 0 || w >= WEAPON_COUNT || w === this.desiredWeapon) return;
    this.desiredWeapon = w;
    this.onWeaponKey(w);
  }
}
