import { describe, expect, it } from 'vitest';
import {
  aabbOverlap,
  Btn,
  clonePlayerSimState,
  CollisionWorld,
  createPlayerSimState,
  DT,
  getMap,
  headingVec,
  headingYaw,
  type InputCmd,
  type MapDef,
  MAPS,
  mapsForMode,
  mapSupportsMode,
  PICKUPS,
  PLAYER,
  PORTAL,
  type PlayerSimState,
  playerAABB,
  rankPlayers,
  stepMovement,
  TICK_RATE,
  type Tuple3,
  WeaponId,
  wrapAngle,
} from '@arena/shared';
import { LAVA_LEVELS } from '../shared/src/maps/lavaShaft';
import { TOWERS } from '../shared/src/maps/threeTowers';
import { GameSim, type SimPlayer } from '../server/src/game/GameSim';

let seq = 0;
const cmd = (buttons: number, yaw = 0): InputCmd => ({ seq: ++seq, buttons, yaw, pitch: 0, weapon: 0, viewTick: 0 });

const NEW_MAPS = ['outpost', 'towers', 'gateways', 'lava'];
const mapById = (id: string): MapDef => {
  const m = getMap(id);
  if (!m) throw new Error(id);
  return m;
};

const solidAt = (world: CollisionWorld, s: PlayerSimState) => world.overlapsAny(playerAABB(s.x, s.y + 0.001, s.z, PLAYER.radius, PLAYER.height));
const dead = (world: CollisionWorld, s: PlayerSimState) =>
  s.y < world.killY || world.touchesLava(playerAABB(s.x, s.y, s.z, PLAYER.radius, PLAYER.height));

// ---------------------------------------------------------------- reachability

const YAWS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

/**
 * Explores the map from a spawn with the real movement code: from every grounded spot reached it
 * tries walking and jumping in 8 directions, then coasts until landing (portals and jump circles
 * act on their own because they are part of `stepMovement`). Returns the grounded spots reached.
 */
const explore = (map: MapDef, from: Tuple3): Tuple3[] => {
  const world = new CollisionWorld(map);
  const seen = new Set<string>();
  const nodes: Tuple3[] = [];
  const key = (x: number, y: number, z: number) => `${Math.round(x)},${Math.round(y * 2)},${Math.round(z)}`;
  const queue: Tuple3[] = [from];
  seen.add(key(...from));
  const actions: { hold: number; buttons: number; first: number }[] = [
    { hold: 8, buttons: Btn.Forward, first: Btn.Forward },
    { hold: 14, buttons: Btn.Forward, first: Btn.Forward | Btn.Jump },
  ];
  let guard = 0;
  while (queue.length > 0 && guard++ < 40000) {
    const n = queue.shift()!;
    nodes.push(n);
    for (const yaw0 of YAWS) {
      for (const a of actions) {
        const s = createPlayerSimState(n[0], n[1], n[2]);
        s.onGround = true;
        let yaw = yaw0;
        let ok = true;
        for (let t = 0; t < 120; t++) {
          const warps = s.warps;
          const b = t === 0 ? a.first : t < a.hold ? a.buttons : 0;
          stepMovement(s, cmd(b, yaw), world, DT);
          if (s.warps !== warps) yaw = wrapAngle(yaw + s.warpYaw);
          if (dead(world, s)) {
            ok = false;
            break;
          }
          if (t >= a.hold && s.onGround && Math.hypot(s.vx, s.vz) < 0.2) break;
        }
        if (!ok || !s.onGround) continue;
        const k = key(s.x, s.y, s.z);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([s.x, s.y, s.z]);
      }
    }
  }
  return nodes;
};

const near = (nodes: Tuple3[], p: Tuple3, r = 1.2) => nodes.some((n) => Math.hypot(n[0] - p[0], n[2] - p[2]) <= r && n[1] - p[1] > -0.6 && n[1] - p[1] < 1.0);

describe('mapas nuevos: recorrido completo', () => {
  for (const id of NEW_MAPS) {
    const map = mapById(id);
    it(
      `${map.name}: desde el primer y el último spawn se alcanzan todos los pickups, banderas y spawns`,
      () => {
        const targets: [string, Tuple3][] = [
          ...map.pickups.map((p, i): [string, Tuple3] => [`pickup ${i} (${p.kind})`, p.pos]),
          ...map.flags.map((f): [string, Tuple3] => [`bandera ${f.team}`, f.pos]),
          ...map.spawns.map((s, i): [string, Tuple3] => [`spawn ${i}`, s.pos]),
        ];
        for (const start of [map.spawns[0], map.spawns[map.spawns.length - 1]]) {
          const nodes = explore(map, start.pos);
          const missing = targets.filter(([, p]) => !near(nodes, p)).map(([n, p]) => `${n} @ ${p.map((v) => v.toFixed(1))}`);
          expect(missing, `desde ${start.pos}`).toEqual([]);
        }
      },
      240_000,
    );
  }

  it(
    'Pozo de Lava: los cinco niveles son accesibles',
    () => {
      const map = mapById('lava');
      const nodes = explore(map, map.spawns[0].pos);
      for (const { y } of LAVA_LEVELS) expect(nodes.some((n) => Math.abs(n[1] - y) < 0.01), `nivel y=${y}`).toBe(true);
    },
    240_000,
  );
});

// ---------------------------------------------------------------- mode filtering

describe('selector de mapas por modo', () => {
  it('los cuatro mapas nuevos están en Deathmatch y CTF solo lista mapas con bases, banderas y spawns por equipo', () => {
    const dm = mapsForMode('dm').map((m) => m.id);
    for (const id of NEW_MAPS) expect(dm).toContain(id);
    const ctf = mapsForMode('ctf');
    expect(ctf.map((m) => m.id)).toContain('outpost');
    for (const m of ctf) {
      expect(m.flags.some((f) => f.team === 0) && m.flags.some((f) => f.team === 1)).toBe(true);
      expect(m.spawns.filter((s) => s.team === 0).length).toBeGreaterThanOrEqual(4);
      expect(m.spawns.filter((s) => s.team === 1).length).toBeGreaterThanOrEqual(4);
    }
    for (const id of ['towers', 'gateways', 'lava']) expect(mapSupportsMode(mapById(id), 'ctf')).toBe(false);
  });

  it('una sala CTF no puede arrancar en un mapa sin banderas', () => {
    expect(() => new GameSim({ mode: 'ctf', mapId: 'towers', timeLimit: 10, scoreLimit: 3 }, 1)).toThrow();
  });

  it('Puesto Avanzado: CTF simétrico (bases y spawns espejados)', () => {
    const m = mapById('outpost');
    const [red, blue] = [0, 1].map((t) => m.flags.find((f) => f.team === t)!.pos);
    expect(blue).toEqual([red[0], red[1], -red[2]]);
    const reds = m.spawns.filter((s) => s.team === 0);
    for (const s of reds) expect(m.spawns.some((o) => o.team === 1 && o.pos[0] === s.pos[0] && o.pos[2] === -s.pos[2])).toBe(true);
  });
});

// ---------------------------------------------------------------- three towers

describe('Tres Torres: recursos repartidos', () => {
  const map = mapById('towers');
  const inTower = (p: Tuple3, t: (typeof TOWERS)[number]) => Math.abs(p[0] - t.cx) <= 6 && Math.abs(p[2] - t.cz) <= 6;

  it('cada torre tiene armas, salud y escudo; ninguna concentra todas las ventajas', () => {
    const roofWeapons = new Set<number>();
    for (const t of TOWERS) {
      const own = map.pickups.filter((p) => inTower(p.pos, t));
      expect(own.some((p) => p.kind === 'health')).toBe(true);
      expect(own.some((p) => p.kind === 'shield')).toBe(true);
      expect(own.filter((p) => p.kind === 'ammo').length).toBeGreaterThanOrEqual(2);
      expect(own.some((p) => p.kind === 'shieldBig' || p.kind === 'healthBig')).toBe(false);
      roofWeapons.add(t.roofWeapon);
    }
    expect(roofWeapons.size).toBe(TOWERS.length);
    // the big shield is on the exposed junction, outside every tower
    const big = map.pickups.filter((p) => p.kind === 'shieldBig');
    expect(big.length).toBe(1);
    expect(TOWERS.some((t) => inTower(big[0].pos, t))).toBe(false);
  });

  it('los pickups de cada torre se recogen en el servidor', () => {
    const sim = new GameSim({ mode: 'dm', mapId: 'towers', timeLimit: 10, scoreLimit: 25 }, 7);
    const p = sim.addPlayer(1, 'A', 0);
    map.pickups.forEach((def, i) => {
      if (!TOWERS.some((t) => inTower(def.pos, t))) return;
      p.hp = 10;
      p.shield = 0;
      if (def.weapon !== undefined) p.sim.ammo[def.weapon] = 0;
      placeAt(p, def.pos);
      sim.step();
      expect(sim.pickups[i].available, `pickup ${i} ${def.kind}`).toBe(false);
    });
  });
});

const placeAt = (p: SimPlayer, pos: Tuple3) => {
  p.sim.x = pos[0];
  p.sim.y = pos[1];
  p.sim.z = pos[2];
  p.sim.vx = p.sim.vy = p.sim.vz = 0;
  p.sim.onGround = true;
  p.protectTimer = 0;
};

// ---------------------------------------------------------------- portals

describe('portales', () => {
  const map = mapById('gateways');
  const world = new CollisionWorld(map);

  it('cada portal tiene destino, color compartido con su pareja y salidas libres, con suelo y fuera de todo disparador', () => {
    const portals = map.portals!;
    expect(portals.length).toBe(6);
    for (const p of portals) {
      const dest = portals.find((d) => d.id === p.to)!;
      expect(dest, p.id).toBeDefined();
      expect(dest.to).toBe(p.id);
      expect(dest.color).toBe(p.color);
      for (const e of p.exits) {
        const a = playerAABB(e[0], e[1] + 0.01, e[2], PLAYER.radius, PLAYER.height);
        expect(world.overlapsAny(a), `${p.id} salida ${e} dentro de geometría`).toBe(false);
        expect(world.floorBelow(playerAABB(e[0], e[1], e[2], PLAYER.radius, PLAYER.height), 0.05), `${p.id} salida ${e} sin suelo`).not.toBeNull();
        for (const t of world.portals) expect(aabbHit(a, t.trigger), `${p.id} salida ${e} dentro del disparador ${t.def.id}`).toBe(false);
      }
    }
    // links of different colours are distinguishable
    expect(new Set(portals.map((p) => p.color)).size).toBe(3);
  });

  it('ningún spawn ni pickup está dentro de un disparador de portal', () => {
    for (const pt of [...map.spawns.map((s) => s.pos), ...map.pickups.map((p) => p.pos)]) {
      const a = playerAABB(pt[0], pt[1], pt[2], PLAYER.radius, PLAYER.height);
      for (const t of world.portals) expect(aabbHit(a, t.trigger), `${pt} en ${t.def.id}`).toBe(false);
    }
  });

  /** Walks into `id` from 3 m in front of it and keeps walking forward (view turned like the client does). */
  const walkInto = (id: string, ticks = 75) => {
    const i = world.portals.findIndex((p) => p.def.id === id);
    const def = world.portals[i].def;
    const f = headingVec(def.face);
    const s = createPlayerSimState(def.pos[0] + f.x * 3, def.kind === 'wall' ? 0 : def.pos[1], def.pos[2] + f.z * 3);
    s.onGround = true;
    let yaw = def.kind === 'wall' ? headingYaw(def.face) + Math.PI : headingYaw(def.face) + Math.PI;
    const trace: { warps: number; inside: boolean; x: number; z: number }[] = [];
    for (let t = 0; t < ticks; t++) {
      const w = s.warps;
      stepMovement(s, cmd(Btn.Forward, yaw), world, DT);
      if (s.warps !== w) yaw = wrapAngle(yaw + s.warpYaw);
      trace.push({ warps: s.warps, inside: solidAt(world, s), x: s.x, z: s.z });
    }
    return { s, trace, dest: world.portals[world.portals[i].to].def, yaw };
  };

  for (const id of ['O1', 'O2', 'C1', 'C2', 'M1', 'M2']) {
    it(`${id}: un solo viaje, sin bucles, nunca dentro de geometría, y sale según la regla de dirección`, () => {
      const { s, trace, dest, yaw } = walkInto(id);
      expect(s.warps).toBe(1);
      expect(trace.some((t) => t.inside)).toBe(false);
      const exit = dest.exits[0];
      // after the trip the player keeps walking out of the exit, along its face
      const out = headingVec(dest.face);
      expect((s.x - exit[0]) * out.x + (s.z - exit[2]) * out.z).toBeGreaterThan(0.5);
      expect(wrapAngle(yaw - headingYaw(dest.face))).toBeCloseTo(0, 5);
    });
  }

  it('regla de pared: la velocidad horizontal se rota y la vertical se conserva', () => {
    const i = world.portals.findIndex((p) => p.def.id === 'C2');
    const def = world.portals[i].def;
    // just outside the trigger: the next step enters it before touching the wall
    const s = createPlayerSimState(def.pos[0], 0.2, def.pos[2] + PLAYER.radius + 0.6);
    s.vx = 1;
    s.vz = -6; // into the wall (face +z)
    s.vy = 2;
    s.onGround = false;
    stepMovement(s, cmd(0, 0), world, DT);
    expect(s.warps).toBe(1);
    // C2 faces +z, C1 sends along +z: entering heading −z means a half turn
    expect(s.warpYaw).toBeCloseTo(Math.PI * (s.warpYaw > 0 ? 1 : -1), 5);
    expect(s.vz).toBeGreaterThan(5);
    expect(s.vx).toBeLessThan(0);
    expect(s.vy).toBeGreaterThan(1); // only gravity acted on it
  });

  it('regla de suelo: la velocidad se redirige según la salida y la vertical se anula', () => {
    const i = world.portals.findIndex((p) => p.def.id === 'M1');
    const def = world.portals[i].def;
    const s = createPlayerSimState(def.pos[0], 0, def.pos[2]);
    s.vx = 0;
    s.vz = -5;
    s.onGround = true;
    stepMovement(s, cmd(Btn.Forward, 0), world, DT);
    expect(s.warps).toBe(1);
    const dest = world.portals[world.portals[i].to].def;
    expect(dest.id).toBe('M2');
    expect(s.vx).toBeGreaterThan(0); // M2 faces +x
    expect(Math.abs(s.vz)).toBeLessThan(1e-9);
    expect(s.vy).toBe(0);
    expect(wrapAngle(0 + s.warpYaw - headingYaw(dest.face))).toBeCloseTo(0, 9);
  });

  it('bloqueo de reentrada: dentro del enfriamiento no hay viaje, después sí', () => {
    const o1 = world.portals.find((p) => p.def.id === 'O1')!;
    const s = createPlayerSimState(-29.5, 0, -20);
    s.onGround = true;
    stepMovement(s, cmd(0), world, DT);
    expect(s.warps).toBe(1);
    // force the player straight back into the destination trigger: blocked during the cooldown
    const o2 = world.portals[o1.to];
    const ticks = Math.floor(PORTAL.reentryCooldown / DT) - 2;
    for (let t = 0; t < ticks; t++) {
      s.x = 29.5;
      s.z = 20;
      s.vx = s.vz = 0;
      stepMovement(s, cmd(0), world, DT);
      expect(s.warps).toBe(1);
    }
    for (let t = 0; t < 4; t++) {
      s.x = o2.def.pos[0] - 0.5;
      s.z = o2.def.pos[2];
      stepMovement(s, cmd(0), world, DT);
    }
    expect(s.warps).toBe(2);
  });

  it('salida ocupada: usa la siguiente; si todas están ocupadas espera', () => {
    const s = createPlayerSimState(-29.5, 0, -20);
    s.onGround = true;
    const first = mapById('gateways').portals!.find((p) => p.id === 'O2')!.exits[0];
    stepMovement(s, cmd(0), world, DT, { exitBlocked: (x, _y, z) => x === first[0] && z === first[2] });
    expect(s.warps).toBe(1);
    expect([s.x, s.z]).toEqual([27.4, 22.2]);
    const t = createPlayerSimState(-29.5, 0, -20);
    t.onGround = true;
    stepMovement(t, cmd(0), world, DT, { exitBlocked: () => true });
    expect(t.warps).toBe(0);
  });

  it('los proyectiles no viajan por portales: chocan con la pared del portal', () => {
    const o1 = map.portals!.find((p) => p.id === 'O1')!;
    const hit = world.raycast({ x: o1.pos[0] + 5, y: o1.pos[1], z: o1.pos[2] }, { x: -1, y: 0, z: 0 }, 10);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBeCloseTo(5, 3);
  });
});

const aabbHit = aabbOverlap;

// ---------------------------------------------------------------- prediction through portals and pads

/**
 * Client prediction vs. authoritative server with latency: the client applies every input at once,
 * the server receives it `lag` ticks later. Whenever the server acknowledges an input, the client
 * rewinds to the server state and replays the unacknowledged inputs (what `Game.onSnapshot` does).
 * The replayed position must match the prediction: no snapping back to the portal entrance.
 */
const predictVsServer = (mapId: string, start: Tuple3, yaw0: number, ticks: number, lag: number) => {
  const sim = new GameSim({ mode: 'dm', mapId, timeLimit: 10, scoreLimit: 25 }, 3);
  const world = new CollisionWorld(mapById(mapId));
  const p = sim.addPlayer(1, 'A', 0);
  placeAt(p, start);
  const pred = clonePlayerSimState(p.sim);
  let yaw = yaw0;
  let s = 1000;
  const inFlight: InputCmd[] = [];
  const pending: InputCmd[] = [];
  let maxErr = 0;
  for (let t = 0; t < ticks; t++) {
    const c: InputCmd = { seq: ++s, buttons: Btn.Forward, yaw, pitch: 0, weapon: pred.weapon, viewTick: sim.tick };
    const w = pred.warps;
    stepMovement(pred, c, world, DT);
    if (pred.warps !== w) yaw = wrapAngle(yaw + pred.warpYaw);
    pending.push(c);
    inFlight.push(c);
    if (inFlight.length > lag) sim.queueInput(p.id, inFlight.shift()!);
    sim.step();
    // reconcile
    const replay = clonePlayerSimState(p.sim);
    const left = pending.filter((x) => x.seq > p.lastSeq);
    for (const x of left) stepMovement(replay, x, world, DT);
    maxErr = Math.max(maxErr, Math.hypot(replay.x - pred.x, replay.y - pred.y, replay.z - pred.z));
  }
  return { maxErr, pred, server: p };
};

describe('predicción con latencia', () => {
  it('cruzar un portal con 6 ticks de latencia no provoca retroceso en la reconciliación', () => {
    const { maxErr, pred } = predictVsServer('gateways', [-25, 0, -20], Math.PI / 2, 90, 6);
    expect(pred.warps).toBe(1);
    expect(maxErr).toBeLessThan(1e-6);
  });

  it('un círculo de salto con 6 ticks de latencia lanza igual en cliente y servidor', () => {
    const map = mapById('lava');
    const pad = map.jumpPads![0];
    const { maxErr, pred, server } = predictVsServer('lava', [pad.pos[0], pad.pos[1], pad.pos[2] - 2.5], Math.PI, 70, 6);
    expect(pred.pads).toBeGreaterThanOrEqual(1);
    expect(server.alive).toBe(true);
    expect(maxErr).toBeLessThan(1e-6);
  });
});

// ---------------------------------------------------------------- jump pads

describe('círculos de salto', () => {
  for (const map of MAPS.filter((m) => (m.jumpPads ?? []).length > 0)) {
    const world = new CollisionWorld(map);
    map.jumpPads!.forEach((pad, i) => {
      it(`${map.name} círculo ${i}: aterriza en su objetivo, sin techo ni atravesar paredes`, () => {
        const s = createPlayerSimState(pad.pos[0], pad.pos[1], pad.pos[2]);
        s.onGround = true;
        let prevVy = 0;
        let rising = false;
        let ceiling = false;
        let insideSolid = false;
        for (let t = 0; t < 4 * TICK_RATE; t++) {
          stepMovement(s, cmd(0), world, DT);
          if (s.vy > 0) rising = true;
          // a ceiling stops the rise abruptly (vy jumps to 0 instead of decreasing with gravity)
          if (rising && prevVy > PLAYER.gravity * DT * 1.5 && s.vy <= 0 && !s.onGround) ceiling = true;
          prevVy = s.vy;
          if (solidAt(world, s)) insideSolid = true;
          if (dead(world, s)) break;
          if (rising && s.onGround) break;
        }
        expect(s.pads).toBe(1);
        expect(ceiling).toBe(false);
        expect(insideSolid).toBe(false);
        expect(dead(world, s)).toBe(false);
        expect(s.onGround).toBe(true);
        expect(s.y).toBeCloseTo(pad.target[1], 1);
        expect(Math.hypot(s.x - pad.target[0], s.z - pad.target[2])).toBeLessThan(1.0);
      });
    });
  }

  it('el enfriamiento impide relanzar al instante', () => {
    const map = mapById('lava');
    const world = new CollisionWorld(map);
    const pad = map.jumpPads![0];
    const s = createPlayerSimState(pad.pos[0], pad.pos[1], pad.pos[2]);
    s.onGround = true;
    stepMovement(s, cmd(0), world, DT);
    expect(s.pads).toBe(1);
    // put the player back on the circle at once: no second launch until the cooldown ends
    s.x = pad.pos[0];
    s.y = pad.pos[1];
    s.z = pad.pos[2];
    s.vx = s.vy = s.vz = 0;
    s.onGround = true;
    stepMovement(s, cmd(0), world, DT);
    expect(s.pads).toBe(1);
  });
});

// ---------------------------------------------------------------- lava

describe('lava', () => {
  it('mata aunque haya escudo, la causa es lava y el respawn restablece salud y escudo iniciales', () => {
    const sim = new GameSim({ mode: 'dm', mapId: 'lava', timeLimit: 10, scoreLimit: 25 }, 5);
    const p = sim.addPlayer(1, 'A', 0);
    placeAt(p, [8, 2, -8]);
    p.sim.onGround = false;
    p.shield = PLAYER.maxShield;
    p.hp = PLAYER.maxHealth;
    sim.drainEvents();
    for (let i = 0; i < TICK_RATE && p.alive; i++) sim.step();
    expect(p.alive).toBe(false);
    expect(p.deaths).toBe(1);
    const kill = sim.drainEvents().find((e) => e.k === 'kill');
    expect(kill && kill.k === 'kill' ? kill.cause : null).toBe('lava');
    for (let i = 0; i < Math.ceil(PLAYER.respawnDelay * TICK_RATE) + 2; i++) sim.step();
    expect(p.alive).toBe(true);
    expect(p.hp).toBe(PLAYER.startHealth);
    expect(p.shield).toBe(PLAYER.startShield);
    expect(p.sim.y).toBeGreaterThan(0);
  });

  it('no hay suelo sólido que proteja de la caída: el fondo del pozo es lava', () => {
    const map = mapById('lava');
    const world = new CollisionWorld(map);
    const s = createPlayerSimState(8, 2, -8);
    for (let i = 0; i < TICK_RATE * 2 && !dead(world, s); i++) stepMovement(s, cmd(0), world, DT);
    expect(dead(world, s)).toBe(true);
  });
});

// ---------------------------------------------------------------- shield

describe('escudo', () => {
  const sim = () => new GameSim({ mode: 'dm', mapId: 'towers', timeLimit: 10, scoreLimit: 25 }, 11);
  const findPickup = (kind: string) => mapById('towers').pickups.findIndex((p) => p.kind === kind);

  it('valores iniciales configurables: 100 de salud y 0 de escudo, máximo 100', () => {
    const p = sim().addPlayer(1, 'A', 0);
    expect([p.hp, p.maxHp, p.shield, p.maxShield]).toEqual([PLAYER.startHealth, PLAYER.maxHealth, PLAYER.startShield, PLAYER.maxShield]);
    expect([PLAYER.startHealth, PLAYER.startShield, PLAYER.maxShield]).toEqual([100, 0, 100]);
  });

  it('el pickup suma sin pasar del máximo y no se consume con el escudo lleno', () => {
    const s = sim();
    const p = s.addPlayer(1, 'A', 0);
    const i = findPickup('shield');
    const def = mapById('towers').pickups[i];
    p.shield = p.maxShield;
    placeAt(p, def.pos);
    s.step();
    expect(s.pickups[i].available).toBe(true);
    expect(p.shield).toBe(p.maxShield);
    p.shield = 80;
    s.step();
    expect(s.pickups[i].available).toBe(false);
    expect(p.shield).toBe(p.maxShield);
    expect(PICKUPS.shield.amount).toBeGreaterThan(20);
  });

  it('la salud tampoco supera su máximo ni se consume llena', () => {
    const s = sim();
    const p = s.addPlayer(1, 'A', 0);
    const i = findPickup('health');
    placeAt(p, mapById('towers').pickups[i].pos);
    s.step();
    expect(s.pickups[i].available).toBe(true);
    p.hp = 90;
    s.step();
    expect(p.hp).toBe(p.maxHp);
    expect(s.pickups[i].available).toBe(false);
  });

  it('el escudo absorbe, el resto va a la salud y sincroniza escudo y máximo en el estado propio', () => {
    const s = sim();
    const a = s.addPlayer(1, 'A', 0);
    const b = s.addPlayer(2, 'B', 0);
    b.protectTimer = 0;
    b.shield = 50;
    s.damage(b, a.id, 30, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect([b.shield, b.hp]).toEqual([20, 100]);
    s.damage(b, a.id, 30, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect([b.shield, b.hp]).toEqual([0, 90]);
    const own = s.ownState(b.id)!;
    expect([own.hp, own.maxHp, own.shield, own.maxShield]).toEqual([90, 100, 0, 100]);
  });
});

// ---------------------------------------------------------------- effective damage

describe('daño realizado', () => {
  const duel = (mode: 'dm' | 'ctf' = 'dm') => {
    const s = new GameSim(mode === 'dm' ? { mode, mapId: 'towers', timeLimit: 10, scoreLimit: 25 } : { mode, mapId: 'outpost', timeLimit: 10, scoreLimit: 3 }, 2);
    const a = s.addPlayer(1, 'A', 0);
    const b = s.addPlayer(2, 'B', mode === 'ctf' ? 1 : 0);
    a.protectTimer = b.protectTimer = 0;
    return { s, a, b };
  };

  it('cuenta salud + escudo realmente quitados, una sola vez y sin sobrante (overkill)', () => {
    const { s, a, b } = duel();
    b.shield = 50;
    b.hp = 100;
    s.damage(b, a.id, 30, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(a.damageDealt).toBe(30);
    s.damage(b, a.id, 500, WeaponId.Rocket, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(a.damageDealt).toBe(150); // 20 shield + 100 health left, the other 380 are overkill
    expect(b.alive).toBe(false);
    s.damage(b, a.id, 50, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }); // already dead
    expect(a.damageDealt).toBe(150);
  });

  it('excluye el daño a uno mismo, a aliados y el del entorno', () => {
    const { s, a, b } = duel();
    s.damage(a, a.id, 40, WeaponId.Rocket, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(a.damageDealt).toBe(0);
    b.hp = 100;
    s.kill(b, -1, -1, false, 'lava');
    expect(a.damageDealt).toBe(0);
    const c = duel('ctf');
    const ally = c.s.addPlayer(3, 'C', 0);
    ally.protectTimer = 0;
    c.s.damage(ally, c.a.id, 40, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(c.a.damageDealt).toBe(0);
    expect(ally.hp).toBe(100);
    c.s.damage(c.b, c.a.id, 40, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(c.a.damageDealt).toBe(40);
  });

  it('el marcador y los resultados exponen el daño realizado', () => {
    const { s, a, b } = duel();
    s.damage(b, a.id, 25, WeaponId.Rifle, 'body', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    const board = s.scoreboard(new Map([[1, 40]]));
    expect(board.find((e) => e.id === 1)!.damage).toBe(25);
    expect(board.find((e) => e.id === 1)!.ping).toBe(40);
    s.end('time');
    expect(s.results!.players.find((e) => e.id === 1)!.damage).toBe(25);
  });
});

// ---------------------------------------------------------------- ranking

describe('clasificación', () => {
  const P = (id: number, o: Partial<{ team: number; score: number; kills: number; deaths: number; damage: number; captures: number }>) => ({
    id,
    team: -1,
    score: 0,
    kills: 0,
    deaths: 0,
    damage: 0,
    captures: 0,
    ...o,
  });

  it('DM: puntaje, bajas, menos muertes, daño y finalmente id estable', () => {
    const r = rankPlayers(
      [
        P(5, { score: 3, kills: 3, deaths: 1, damage: 100 }),
        P(4, { score: 3, kills: 3, deaths: 1, damage: 100 }),
        P(3, { score: 3, kills: 3, deaths: 1, damage: 250 }),
        P(2, { score: 3, kills: 3, deaths: 0 }),
        P(1, { score: 3, kills: 4, deaths: 9 }),
        P(6, { score: 5 }),
      ],
      'dm',
      [0, 0],
    );
    expect(r.map((p) => p.id)).toEqual([6, 1, 2, 3, 4, 5]);
    expect(r.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('CTF: primero el resultado de equipos; dentro, capturas, bajas, menos muertes y daño', () => {
    const r = rankPlayers(
      [
        P(1, { team: 0, captures: 2, kills: 0 }),
        P(2, { team: 1, captures: 0, kills: 9 }),
        P(3, { team: 1, captures: 1, kills: 1, deaths: 5 }),
        P(4, { team: 1, captures: 1, kills: 1, deaths: 2 }),
        P(5, { team: 1, captures: 1, kills: 1, deaths: 2, damage: 90 }),
        P(6, { team: 0, captures: 2, kills: 1 }),
      ],
      'ctf',
      [2, 3],
    );
    expect(r.map((p) => p.id)).toEqual([5, 4, 3, 2, 6, 1]);
    expect(r.map((p) => p.rank)).toEqual([1, 2, 3, 4, 1, 2]);
  });

  it('el servidor envía el marcador ya ordenado y los resultados usan el mismo orden', () => {
    const s = new GameSim({ mode: 'dm', mapId: 'towers', timeLimit: 10, scoreLimit: 25 }, 4);
    const a = s.addPlayer(1, 'A', 0);
    const b = s.addPlayer(2, 'B', 0);
    const c = s.addPlayer(3, 'C', 0);
    a.score = b.score = c.score = 2;
    a.kills = b.kills = c.kills = 2;
    c.deaths = 0;
    a.deaths = 1;
    b.deaths = 1;
    b.damageDealt = 80;
    const board = s.scoreboard(new Map());
    expect(board.map((e) => e.id)).toEqual([3, 2, 1]);
    expect(board.map((e) => e.rank)).toEqual([1, 2, 3]);
    s.end('time');
    expect(s.results!.players.map((e) => e.id)).toEqual([3, 2, 1]);
    expect(s.results!.players.map((e) => e.rank)).toEqual([1, 2, 3]);
    // equal scores: the tie-breaks order the table, but nobody wins the match
    expect(s.results!.winnerId).toBe(-1);
  });
});