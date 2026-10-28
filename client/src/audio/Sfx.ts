import type { Vec3 } from '@arena/shared';

export type SoundName =
  | 'rifle'
  | 'shotgun'
  | 'sniper'
  | 'rocket'
  | 'grenade'
  | 'plasma'
  | 'cuasar'
  | 'charge'
  | 'chargeFull'
  | 'explosion'
  | 'hit'
  | 'headshot'
  | 'kill'
  | 'hurt'
  | 'death'
  | 'jump'
  | 'dash'
  | 'pickupHealth'
  | 'pickupShield'
  | 'pickupAmmo'
  | 'shieldHit'
  | 'shieldBreak'
  | 'portal'
  | 'jumpPad'
  | 'lava'
  | 'flagTake'
  | 'flagCapture'
  | 'flagReturn'
  | 'flagDrop'
  | 'dryFire'
  | 'switch'
  | 'bounce'
  | 'spawn'
  | 'land';

export const WEAPON_SOUNDS: SoundName[] = ['rifle', 'shotgun', 'sniper', 'rocket', 'grenade', 'plasma', 'cuasar'];

const MAX_VOICES = 28;

/**
 * Procedural sound effects synthesized with the Web Audio API. Everything is generated at runtime,
 * so there are no third-party audio files or licences involved. The AudioContext is only created
 * after a user gesture, as browsers require.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = 0;
  private volume = 0.6;

  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setListener(pos: Vec3, yaw: number) {
    const l = this.ctx?.listener;
    if (!l) return;
    const fx = -Math.sin(yaw),
      fz = -Math.cos(yaw);
    if (l.positionX) {
      l.positionX.value = pos.x;
      l.positionY.value = pos.y;
      l.positionZ.value = pos.z;
      l.forwardX.value = fx;
      l.forwardY.value = 0;
      l.forwardZ.value = fz;
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  /** Plays a sound. With `pos` it is spatialized; without it is played at the listener. */
  play(name: SoundName, pos?: Vec3, gain = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running' || this.voices >= MAX_VOICES) return;
    const out = ctx.createGain();
    out.gain.value = gain;
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 4;
      p.maxDistance = 120;
      p.rolloffFactor = 1.1;
      p.positionX.value = pos.x;
      p.positionY.value = pos.y;
      p.positionZ.value = pos.z;
      out.connect(p).connect(this.master);
    } else out.connect(this.master);
    this.voices++;
    const dur = this.synth(name, out, ctx.currentTime);
    window.setTimeout(() => {
      this.voices--;
      out.disconnect();
    }, (dur + 0.1) * 1000);
  }

  /** Streak / multi-kill fanfare; pitch rises with `level`. */
  playStreak(kind: 'multi' | 'spree' | 'ended', level: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running' || this.voices >= MAX_VOICES) return;
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.master);
    this.voices++;
    const t = ctx.currentTime;
    const base = kind === 'ended' ? 420 : kind === 'spree' ? 520 + level * 18 : 640 + level * 55;
    this.tone(t, 'triangle', base, base * 1.02, 0.06, 0.35, out);
    this.tone(t + 0.1, 'square', base * 1.35, base * 1.38, 0.08, 0.4, out);
    if (level >= 4 || kind === 'spree') {
      this.tone(t + 0.2, 'sine', base * 1.8, base * 1.85, 0.1, 0.45, out);
    }
    const dur = kind === 'ended' ? 0.55 : 0.45 + level * 0.04;
    window.setTimeout(() => {
      this.voices--;
      out.disconnect();
    }, (dur + 0.1) * 1000);
  }

  // ------------------------------------------------------------ synthesis helpers

  private noiseSrc(t: number, dur: number): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur);
    return s;
  }

  private env(t: number, attack: number, peak: number, decay: number, out: AudioNode): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  }

  private filter(type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, out: AudioNode) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    o.connect(this.env(t, 0.005, peak, dur, out));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(t: number, type: BiquadFilterType, freq: number, q: number, dur: number, peak: number, out: AudioNode, sweepTo?: number) {
    const f = this.filter(type, freq, q);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    this.noiseSrc(t, dur + 0.05).connect(f).connect(this.env(t, 0.003, peak, dur, out));
  }

  private synth(name: SoundName, out: AudioNode, t: number): number {
    switch (name) {
      case 'rifle':
        this.burst(t, 'bandpass', 1800, 0.8, 0.09, 0.6, out, 600);
        this.tone(t, 'square', 180, 60, 0.06, 0.25, out);
        return 0.12;
      case 'shotgun':
        this.burst(t, 'lowpass', 2500, 0.7, 0.35, 0.9, out, 300);
        this.tone(t, 'sine', 110, 40, 0.25, 0.6, out);
        this.burst(t + 0.38, 'highpass', 2500, 1, 0.05, 0.25, out);
        this.burst(t + 0.5, 'highpass', 1800, 1, 0.05, 0.25, out);
        return 0.6;
      case 'sniper':
        this.burst(t, 'highpass', 3000, 0.5, 0.05, 0.9, out);
        this.tone(t, 'sawtooth', 1400, 90, 0.4, 0.3, out);
        this.burst(t, 'lowpass', 900, 0.5, 0.6, 0.5, out, 120);
        return 0.7;
      case 'rocket':
        this.burst(t, 'lowpass', 400, 1, 0.5, 0.8, out, 2200);
        this.tone(t, 'sawtooth', 90, 40, 0.3, 0.3, out);
        return 0.55;
      case 'grenade':
        this.tone(t, 'sine', 160, 50, 0.18, 0.8, out);
        this.burst(t, 'bandpass', 700, 2, 0.12, 0.5, out);
        return 0.25;
      case 'plasma':
        // short crackling hum; the beam repeats it every ~0.1 s while the button is held
        this.tone(t, 'sawtooth', 420, 330, 0.12, 0.16, out);
        this.burst(t, 'highpass', 4000, 0.8, 0.08, 0.14, out);
        return 0.16;
      case 'cuasar':
        this.burst(t, 'highpass', 2500, 0.5, 0.06, 1.0, out);
        this.tone(t, 'sawtooth', 900, 70, 0.55, 0.35, out);
        this.tone(t, 'sine', 80, 30, 0.8, 0.8, out);
        this.burst(t, 'lowpass', 700, 0.6, 0.7, 0.5, out, 90);
        return 0.9;
      case 'charge':
        this.tone(t, 'sine', 260, 1000, 0.6, 0.16, out);
        this.tone(t, 'triangle', 130, 500, 0.6, 0.1, out);
        return 0.7;
      case 'chargeFull':
        this.tone(t, 'square', 1500, 1500, 0.07, 0.14, out);
        this.tone(t + 0.08, 'square', 2000, 2000, 0.1, 0.14, out);
        return 0.25;
      case 'explosion':
        this.burst(t, 'lowpass', 1200, 0.7, 1.3, 1.0, out, 80);
        this.tone(t, 'sine', 90, 25, 0.9, 1.0, out);
        this.burst(t, 'highpass', 2000, 0.7, 0.12, 0.5, out);
        return 1.4;
      case 'hit':
        this.tone(t, 'square', 1900, 1700, 0.05, 0.25, out);
        return 0.08;
      case 'headshot':
        this.tone(t, 'square', 2400, 2200, 0.05, 0.3, out);
        this.tone(t + 0.06, 'square', 3000, 2800, 0.06, 0.3, out);
        return 0.15;
      case 'kill':
        this.tone(t, 'triangle', 880, 880, 0.08, 0.4, out);
        this.tone(t + 0.08, 'triangle', 1320, 1320, 0.18, 0.4, out);
        return 0.3;
      case 'hurt':
        this.tone(t, 'sine', 140, 60, 0.18, 0.8, out);
        this.burst(t, 'lowpass', 500, 1, 0.12, 0.4, out);
        return 0.22;
      case 'death':
        this.tone(t, 'sawtooth', 300, 40, 0.8, 0.4, out);
        return 0.9;
      case 'jump':
        this.tone(t, 'sine', 260, 420, 0.1, 0.2, out);
        return 0.12;
      case 'dash':
        this.burst(t, 'bandpass', 500, 2, 0.22, 0.6, out, 2600);
        return 0.25;
      case 'land':
        this.burst(t, 'lowpass', 300, 1, 0.08, 0.35, out);
        return 0.1;
      case 'pickupHealth':
        [660, 880, 1320].forEach((f, i) => this.tone(t + i * 0.06, 'triangle', f, f, 0.1, 0.35, out));
        return 0.3;
      case 'pickupShield':
        // rising electric charge-up, distinct from the health arpeggio
        this.tone(t, 'sawtooth', 220, 880, 0.22, 0.16, out);
        this.tone(t + 0.12, 'sine', 1320, 1760, 0.35, 0.3, out);
        this.burst(t + 0.05, 'bandpass', 3200, 4, 0.2, 0.15, out);
        return 0.5;
      case 'shieldHit':
        // glassy ping: the shield took the hit
        this.tone(t, 'triangle', 2600, 2100, 0.07, 0.22, out);
        this.burst(t, 'bandpass', 4200, 6, 0.06, 0.2, out);
        return 0.1;
      case 'shieldBreak':
        this.burst(t, 'highpass', 2200, 0.8, 0.35, 0.6, out, 600);
        this.tone(t, 'sawtooth', 1400, 180, 0.4, 0.3, out);
        return 0.45;
      case 'portal':
        this.tone(t, 'sine', 180, 900, 0.3, 0.3, out);
        this.burst(t, 'bandpass', 900, 3, 0.35, 0.3, out, 3500);
        return 0.4;
      case 'jumpPad':
        this.tone(t, 'square', 140, 520, 0.25, 0.25, out);
        this.burst(t, 'lowpass', 600, 1, 0.2, 0.5, out, 2000);
        return 0.3;
      case 'lava':
        this.burst(t, 'lowpass', 500, 0.7, 0.9, 0.9, out, 120);
        this.tone(t, 'sine', 70, 35, 0.8, 0.6, out);
        return 1;
      case 'pickupAmmo':
        this.burst(t, 'highpass', 2500, 1, 0.04, 0.5, out);
        this.burst(t + 0.09, 'highpass', 1800, 1, 0.05, 0.5, out);
        return 0.18;
      case 'flagTake':
        [0, 0.16, 0.32].forEach((d) => {
          this.tone(t + d, 'square', 740, 740, 0.07, 0.25, out);
          this.tone(t + d + 0.08, 'square', 988, 988, 0.07, 0.25, out);
        });
        return 0.5;
      case 'flagCapture':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.11, 'triangle', f, f, 0.25, 0.4, out));
        return 0.8;
      case 'flagReturn':
        [988, 784, 659].forEach((f, i) => this.tone(t + i * 0.1, 'triangle', f, f, 0.15, 0.35, out));
        return 0.5;
      case 'flagDrop':
        this.tone(t, 'sawtooth', 300, 150, 0.35, 0.3, out);
        return 0.4;
      case 'dryFire':
        this.burst(t, 'highpass', 3000, 1, 0.03, 0.3, out);
        return 0.05;
      case 'switch':
        this.burst(t, 'bandpass', 1500, 3, 0.05, 0.3, out);
        this.burst(t + 0.1, 'bandpass', 1100, 3, 0.05, 0.3, out);
        return 0.18;
      case 'bounce':
        this.tone(t, 'triangle', 1100, 700, 0.06, 0.2, out);
        return 0.08;
      case 'spawn':
        this.tone(t, 'sine', 300, 1200, 0.35, 0.25, out);
        return 0.4;
    }
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
