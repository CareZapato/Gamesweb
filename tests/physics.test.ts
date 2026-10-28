import { describe, expect, it } from 'vitest';
import {
  box,
  Btn,
  CollisionWorld,
  createPlayerSimState,
  DT,
  type InputCmd,
  MAPS,
  PLAYER,
  playerAABB,
  ramp,
  stepMovement,
} from '@arena/shared';

const flat = (extra: Parameters<typeof box>[] = []) =>
  new CollisionWorld({
    killY: -50,
    boxes: [box(-50, -1, -50, 50, 0, 50, 'floor'), ...extra.map((a) => box(...a))],
    ramps: [],
  });

let seq = 0;
const cmd = (buttons: number, yaw = 0, pitch = 0): InputCmd => ({ seq: ++seq, buttons, yaw, pitch, weapon: 0, viewTick: 0 });

/** yaw that makes "forward" point toward +X */
const YAW_PLUS_X = -Math.PI / 2;

describe('movimiento y colisiones', () => {
  it('no atraviesa una pared corriendo', () => {
    const world = flat([[5, 0, -10, 5.3, 4, 10, 'metal']]);
    const s = createPlayerSimState(0, 0, 0);
    s.onGround = true;
    for (let i = 0; i < 120; i++) stepMovement(s, cmd(Btn.Forward, YAW_PLUS_X), world, DT);
    expect(s.x).toBeLessThanOrEqual(5 - PLAYER.radius + 1e-6);
    expect(s.x).toBeGreaterThan(4.4);
  });

  it('el dash no atraviesa una pared delgada (0,3 m) y respeta su distancia', () => {
    const world = flat([[2, 0, -10, 2.3, 4, 10, 'metal']]);
    const s = createPlayerSimState(0, 0, 0);
    s.onGround = true;
    for (let i = 0; i < 60; i++) stepMovement(s, cmd(Btn.Dash | Btn.Forward, YAW_PLUS_X), world, DT);
    expect(s.x).toBeLessThanOrEqual(2 - PLAYER.radius + 1e-6);
  });

  it('el dash tiene cooldown y velocidad acotada', () => {
    const world = flat();
    const s = createPlayerSimState(0, 0, 0);
    s.onGround = true;
    let dashes = 0;
    let maxSpeed = 0;
    for (let i = 0; i < 90; i++) {
      const before = s.dashCd;
      // press and release every other tick to try to spam the dash
      stepMovement(s, cmd(i % 2 === 0 ? Btn.Dash | Btn.Forward : Btn.Forward, YAW_PLUS_X), world, DT);
      if (s.dashCd > before) dashes++;
      maxSpeed = Math.max(maxSpeed, Math.hypot(s.vx, s.vz));
    }
    // 3 seconds with 1.1 s cooldown: at most 3 dashes
    expect(dashes).toBeLessThanOrEqual(Math.ceil(3 / PLAYER.dashCooldown));
    expect(dashes).toBeGreaterThanOrEqual(2);
    expect(maxSpeed).toBeLessThanOrEqual(PLAYER.maxHorizontalSpeed + 1e-6);
  });

  it('altura de salto coherente con la configuración', () => {
    const world = flat();
    const s = createPlayerSimState(0, 0, 0);
    s.onGround = true;
    let maxY = 0;
    stepMovement(s, cmd(Btn.Jump), world, DT);
    for (let i = 0; i < 60; i++) {
      stepMovement(s, cmd(0), world, DT);
      maxY = Math.max(maxY, s.y);
    }
    const ideal = (PLAYER.jumpSpeed * PLAYER.jumpSpeed) / (2 * PLAYER.gravity);
    expect(maxY).toBeGreaterThan(ideal * 0.85);
    expect(maxY).toBeLessThan(ideal * 1.1);
    expect(s.onGround).toBe(true);
    expect(s.y).toBeCloseTo(0, 5);
  });

  it('sube escalones bajos pero no muros altos', () => {
    const world = flat([
      [2, 0, -5, 4, 0.4, 5, 'metal'],
      [6, 0, -5, 8, 1.2, 5, 'metal'],
    ]);
    const s = createPlayerSimState(0, 0, 0);
    s.onGround = true;
    let maxY = 0;
    for (let i = 0; i < 90; i++) {
      stepMovement(s, cmd(Btn.Forward, YAW_PLUS_X), world, DT);
      maxY = Math.max(maxY, s.y);
    }
    expect(maxY).toBeCloseTo(0.4, 3);
    expect(s.y).toBeCloseTo(0, 3);
    expect(s.x).toBeLessThanOrEqual(6 - PLAYER.radius + 1e-6);
  });

  it('sube y baja rampas', () => {
    const world = new CollisionWorld({
      killY: -50,
      boxes: [box(-50, -1, -50, 50, 0, 50, 'floor'), box(10, 0, -5, 40, 3, 5, 'concrete')],
      ramps: [ramp(4, 0, -2, 10, 3, 2, '+x', 'metal')],
    });
    const s = createPlayerSimState(0, 0, 0);
    s.onGround = true;
    for (let i = 0; i < 90; i++) stepMovement(s, cmd(Btn.Forward, YAW_PLUS_X), world, DT);
    expect(s.y).toBeCloseTo(3, 3);
    expect(s.x).toBeGreaterThan(12);
    // walk back down, staying grounded on the way
    let airborneTicks = 0;
    for (let i = 0; i < 90; i++) {
      stepMovement(s, cmd(Btn.Forward, -YAW_PLUS_X), world, DT);
      if (!s.onGround) airborneTicks++;
    }
    expect(s.y).toBeCloseTo(0, 3);
    expect(airborneTicks).toBeLessThan(5);
  });

  it('el techo detiene el salto', () => {
    const world = flat([[-5, 2.5, -5, 5, 3, 5, 'metal']]);
    const s = createPlayerSimState(0, 0, 0);
    s.onGround = true;
    stepMovement(s, cmd(Btn.Jump), world, DT);
    for (let i = 0; i < 30; i++) stepMovement(s, cmd(0), world, DT);
    expect(s.y + PLAYER.height).toBeLessThanOrEqual(2.5 + 1e-6);
  });
});

describe('mapas: geometría y puntos válidos', () => {
  for (const map of MAPS) {
    const world = new CollisionWorld(map);
    it(`${map.name}: spawns libres y apoyados en suelo`, () => {
      for (const s of map.spawns) {
        const a = playerAABB(s.pos[0], s.pos[1] + 0.01, s.pos[2], PLAYER.radius, PLAYER.height);
        expect(world.overlapsAny(a), `spawn ${s.pos} dentro de geometría`).toBe(false);
        const floor = world.floorBelow(playerAABB(s.pos[0], s.pos[1], s.pos[2], PLAYER.radius, PLAYER.height), 0.05);
        expect(floor, `spawn ${s.pos} sin suelo`).not.toBeNull();
      }
    });
    it(`${map.name}: cada spawn mira hacia espacio abierto (≥3 m caminando 1 s)`, () => {
      const blocked: string[] = [];
      for (const s of map.spawns) {
        const st = createPlayerSimState(s.pos[0], s.pos[1], s.pos[2]);
        for (let i = 0; i < 30; i++) stepMovement(st, cmd(Btn.Forward, s.yaw), world, DT);
        const moved = Math.hypot(st.x - s.pos[0], st.z - s.pos[2]);
        if (moved <= 3) blocked.push(`[${s.pos}] yaw ${s.yaw.toFixed(2)}: ${moved.toFixed(2)} m`);
      }
      expect(blocked).toEqual([]);
    });
    it(`${map.name}: pickups y banderas alcanzables`, () => {
      for (const p of [...map.pickups.map((x) => x.pos), ...map.flags.map((f) => f.pos)]) {
        const a = playerAABB(p[0], p[1] + 0.01, p[2], PLAYER.radius, PLAYER.height);
        expect(world.overlapsAny(a), `punto ${p} dentro de geometría`).toBe(false);
        expect(world.floorBelow(playerAABB(p[0], p[1], p[2], 0.3, 1), 0.05), `punto ${p} sin suelo`).not.toBeNull();
      }
    });
    it(`${map.name}: paredes con grosor mínimo para no ser atravesadas`, () => {
      for (const b of map.boxes) {
        if (b.mat === 'light') continue;
        const thin = Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]);
        expect(thin, `caja ${JSON.stringify(b)}`).toBeGreaterThanOrEqual(0.3 - 1e-9);
      }
    });
  }
});
