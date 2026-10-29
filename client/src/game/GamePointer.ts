/**
 * Puntero “interno” del juego: oculta el cursor de Windows y usa pointer lock (mira FPS).
 * Fuera de captura (menús, salir de pantalla completa) vuelve el cursor del sistema hasta un clic en el canvas.
 */
export type GamePointerMode = 'free' | 'game';

export class GamePointer {
  mode: GamePointerMode = 'free';
  fullscreen = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly root: HTMLElement,
    private readonly onModeChange?: (mode: GamePointerMode) => void,
  ) {
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
  }

  dispose() {
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    this.release();
  }

  /** Debe llamarse desde un gesto del usuario (clic, botón de compra, etc.). */
  capture(): void {
    if (this.mode === 'game' && document.pointerLockElement === this.canvas) return;
    this.setMode('game');
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => this.onLockFailed());
    } catch {
      this.onLockFailed();
    }
  }

  /** Suelta la mira interna y muestra el cursor de Windows. */
  release(): void {
    if (document.pointerLockElement === this.canvas) void document.exitPointerLock();
    this.setMode('free');
  }

  async enterFullscreen(): Promise<void> {
    try {
      if (!document.fullscreenElement) await this.root.requestFullscreen();
    } catch {
      /* ignorar si el navegador lo bloquea */
    }
  }

  async exitFullscreen(): Promise<void> {
    this.release();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignorar */
    }
  }

  private onLockFailed = () => {
    if (this.mode === 'game') this.setMode('free');
  };

  private onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.canvas;
    if (locked) this.setMode('game');
    else if (this.mode === 'game' && !document.fullscreenElement) this.setMode('free');
    this.onModeChange?.(this.mode);
  };

  private onFullscreenChange = () => {
    this.fullscreen = document.fullscreenElement === this.root;
    if (!this.fullscreen && this.mode === 'game') this.release();
    this.onModeChange?.(this.mode);
  };

  private setMode(mode: GamePointerMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    document.body.classList.toggle('game-internal-pointer', mode === 'game');
    this.onModeChange?.(mode);
  }
}
