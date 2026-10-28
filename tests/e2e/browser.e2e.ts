/**
 * Browser end-to-end check with two real clients (Chrome or Edge already installed on the machine,
 * driven through playwright-core; no browser download).
 *
 *   npm run build && npm run test:e2e
 *
 * Covers: portal → RealTournament card → menu → create room → join by code → ready → start → both clients render the match and see
 * each other → movement through pointer lock (if the headless browser grants it) → shooting →
 * forced match end → results → back to lobby → CTF match start. Screenshots go to e2e-artifacts/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { matchMaker } from '@colyseus/core';
import { getMap } from '@arena/shared';
import { type Browser, chromium, type Page } from 'playwright-core';
import { createGameServer, defaultStaticDir } from '../../server/src/createGameServer';
import { buildDefaultSkin, buildTemplate, encodePng, PALETTE_GOLD } from '../../scripts/skins';

const PORT = 3600 + Math.floor(Math.random() * 300);
/** Optional artificial one-way delay applied by both clients (E2E_LAG_MS=80 → ~160 ms RTT). */
const LAG = Number(process.env.E2E_LAG_MS ?? 0);
// the entry point is the portal; it forwards ?debug / ?lag to the game it opens
const URL_BASE = `http://127.0.0.1:${PORT}/?debug${LAG > 0 ? `&lag=${LAG}` : ''}`;
const OUT = resolve('e2e-artifacts');
mkdirSync(OUT, { recursive: true });

const results: { name: string; ok: boolean; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail?: string) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (page: Page, fn: string, timeout = 10000) => {
  try {
    await page.waitForFunction(fn, undefined, { timeout });
    return true;
  } catch {
    return false;
  }
};

const launch = async (): Promise<Browser> => {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless: true, args });
    } catch {
      // try the next installed browser
    }
  }
  throw new Error('No se encontró Chrome ni Edge instalados');
};

const main = async () => {
  const server = await createGameServer({ port: PORT, host: '127.0.0.1', staticDir: defaultStaticDir() });
  const browser = await launch();
  const errors: string[] = [];
  const newPage = async (label: string) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`[${label}] console: ${m.text()}`);
    });
    page.on('response', (r) => {
      // the deliberate join with a nonexistent code is expected to fail
      if (r.status() >= 400 && !r.url().includes('ZZZZZZ')) errors.push(`[${label}] HTTP ${r.status()} ${r.url()}`);
    });
    const jsLoaded: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'script') jsLoaded.push(r.url());
    });
    await page.goto(URL_BASE);
    return Object.assign(page, { jsLoaded });
  };
  /** From the portal: click the RealTournament card and wait for the game menu. */
  const enterRealTournament = async (page: Page) => {
    await page.click('[data-game="realtournament"] a.play');
    return waitFor(page, `location.pathname === '/realtournament/' && !document.getElementById('screen-menu').classList.contains('hidden')`);
  };

  try {
    const a = await newPage('A');
    const b = await newPage('B');

    // ---- portal
    await a.waitForSelector('#catalog .card');
    check('Portal: las 3 miniaturas cargan', await waitFor(a, `[...document.querySelectorAll('#catalog img')].length === 3 && [...document.querySelectorAll('#catalog img')].every((i) => i.complete && i.naturalWidth > 0)`));
    await a.screenshot({ path: `${OUT}/00-portal.png` });
    const cards = await a.$$eval('#catalog .card', (els) =>
      els.map((e) => ({ soon: e.classList.contains('soon'), link: !!e.querySelector('a.play'), disabled: !!(e.querySelector('button.play') as HTMLButtonElement | null)?.disabled })),
    );
    check('Portal: 1 juego activo y 2 "Próximamente" deshabilitados', cards.length === 3 && cards.filter((c) => c.link && !c.soon).length === 1 && cards.filter((c) => c.soon && c.disabled).length === 2, JSON.stringify(cards));
    check('Portal: no carga el bundle del juego', a.jsLoaded.length > 0 && a.jsLoaded.every((u) => !/realtournament-.*\.js/.test(u)), a.jsLoaded.map((u) => u.split('/').pop()).join(', '));
    check('Portal: la tarjeta activa enlaza a /realtournament/', ((await a.getAttribute('[data-game="realtournament"] a.play', 'href')) ?? '').startsWith('/realtournament/'));
    check('A entra a RealTournament desde el portal', await enterRealTournament(a));
    check('B entra a RealTournament desde el portal', await enterRealTournament(b));
    check('El título de la página es RealTournament', (await a.title()) === 'RealTournament');
    await a.screenshot({ path: `${OUT}/01-menu.png` });

    await a.fill('#in-name', 'Ana');
    await a.click('#btn-create');
    check('A crea sala y ve el lobby', await waitFor(a, `!document.getElementById('screen-lobby').classList.contains('hidden')`));
    const code = (await a.textContent('#lobby-code'))?.trim() ?? '';
    check('Código de sala de 6 caracteres', /^[2-9A-HJKMNP-Z]{6}$/.test(code), code);

    await b.fill('#in-name', 'Beto');
    await b.fill('#in-code', 'ZZZZZZ');
    await b.click('#btn-join');
    await waitFor(b, `document.getElementById('menu-status').textContent.length > 0 && !document.getElementById('menu-status').textContent.includes('Entrando')`);
    check('Código inexistente muestra error', /No existe/.test((await b.textContent('#menu-status')) ?? ''), (await b.textContent('#menu-status')) ?? '');

    await b.fill('#in-code', code.toLowerCase());
    await b.click('#btn-join');
    check('B entra con el código', await waitFor(b, `!document.getElementById('screen-lobby').classList.contains('hidden')`));
    check('A ve 2 jugadores', await waitFor(a, `document.querySelectorAll('#lobby-list li').length === 2`));
    // ---- skins: A loads a 256 px gold skin, B loads the 128 px template; a wrong-size file is refused
    const skinGold = `${OUT}/skin-gold-256.png`;
    const skinTemplate = `${OUT}/skin-template-128.png`;
    const skinBad = `${OUT}/skin-bad-64.png`;
    writeFileSync(skinGold, buildDefaultSkin(PALETTE_GOLD, 256).png());
    writeFileSync(skinTemplate, buildTemplate(128).png());
    writeFileSync(skinBad, encodePng(64, 64, new Uint8Array(64 * 64 * 4).fill(255)));
    await a.setInputFiles('#in-skin', skinBad);
    check('Skin de tamaño incorrecto: aviso en el cliente y no se envía', await waitFor(a, `[...document.querySelectorAll('.toast')].some((t) => /Skin rechazada.*tamaño/.test(t.textContent))`, 4000));
    await a.setInputFiles('#in-skin', skinGold);
    check('A carga su skin y ve la vista previa', await waitFor(a, `!document.getElementById('skin-preview').classList.contains('hidden')`, 5000));
    await sleep(1100); // the server accepts one skin change per second
    await b.setInputFiles('#in-skin', skinTemplate);
    check('B carga su skin y ve la vista previa', await waitFor(b, `!document.getElementById('skin-preview').classList.contains('hidden')`, 5000));
    const aId = (await a.evaluate(`window.__arena.myId`)) as number;
    const bId = (await b.evaluate(`window.__arena.myId`)) as number;
    check('El servidor retransmite la skin de A a B (decodificada, 256 px)', await waitFor(b, `window.__arena.skins.image(${aId})?.size === 256`, 5000));
    check('El servidor retransmite la skin de B a A (decodificada, 128 px)', await waitFor(a, `window.__arena.skins.image(${bId})?.size === 128`, 5000));
    await a.screenshot({ path: `${OUT}/02b-lobby-skins.png` });

    check('Inicio bloqueado hasta que B esté listo', await a.isDisabled('#btn-start'));
    await b.click('#btn-ready');
    check('Inicio habilitado con B listo', await waitFor(a, `!document.getElementById('btn-start').disabled`));
    await a.screenshot({ path: `${OUT}/02-lobby.png` });

    await a.click('#btn-start');
    const started = (await waitFor(a, `!!window.__arena.game`)) && (await waitFor(b, `!!window.__arena.game`));
    check('Partida DM arranca en ambos clientes', started);
    const drawCalls = await a.evaluate(`window.__arena.game.d.renderer.info.render.calls`) as number;
    console.log(`DEBUG draw calls (mapa DM por defecto, calidad Baja por defecto): ${drawCalls}`);
    check('Ambos reciben snapshots y estado propio', (await waitFor(a, `!!window.__arena.game.me && window.__arena.game.alive`)) && (await waitFor(b, `!!window.__arena.game.me && window.__arena.game.alive`)));
    check('A ve el personaje de B (interpolado)', await waitFor(a, `window.__arena.game.chars.size === 1`, 5000));

    // pointer lock + movement
    await a.click('#view');
    const locked = await waitFor(a, `document.pointerLockElement !== null`, 3000);
    check('Pointer Lock concedido tras clic', locked, locked ? '' : 'el navegador headless no lo concedió; movimiento no probado por teclado');
    if (locked) {
      const before = await a.evaluate(`({x: window.__arena.game.pred.x, z: window.__arena.game.pred.z})`) as { x: number; z: number };
      await a.keyboard.down('KeyW');
      await sleep(1200);
      await a.keyboard.up('KeyW');
      await sleep(600 + LAG * 4);
      const after = await a.evaluate(`({x: window.__arena.game.pred.x, z: window.__arena.game.pred.z})`) as { x: number; z: number };
      const moved = Math.hypot(after.x - before.x, after.z - before.z);
      check('A se mueve con W (predicción local)', moved > 2, `${moved.toFixed(2)} m`);
      const remoteSeen = await b.evaluate(
        `(() => { const id = window.__arena.game.chars.keys().next().value; const r = window.__arena.game.remote.get(id); return r ? {x: r.x, z: r.z} : null; })()`,
      ) as { x: number; z: number } | null;
      check(
        'B ve a A en la posición movida (estado compartido)',
        !!remoteSeen && Math.hypot(remoteSeen.x - after.x, remoteSeen.z - after.z) < 0.6,
        remoteSeen ? `B ve (${remoteSeen.x.toFixed(2)}, ${remoteSeen.z.toFixed(2)}) vs A (${after.x.toFixed(2)}, ${after.z.toFixed(2)})` : 'sin datos',
      );
      const err = await a.evaluate(`window.__arena.game.predError`) as number;
      check('Error de predicción bajo', err < 0.05, `${(err * 100).toFixed(2)} cm`);

      const ammoBefore = await a.evaluate(`window.__arena.game.me.ammo[0]`) as number;
      await a.mouse.down();
      await sleep(500);
      await a.mouse.up();
      await sleep(400 + LAG * 4);
      const ammoAfter = await a.evaluate(`window.__arena.game.me.ammo[0]`) as number;
      check('Disparar consume munición validada por el servidor', ammoAfter < ammoBefore, `${ammoBefore} → ${ammoAfter}`);

      await a.keyboard.press('Digit4');
      await sleep(900 + LAG * 4);
      const w = await a.evaluate(`window.__arena.game.me.weapon`) as number;
      check('Cambio de arma con tecla 4 (lanzacohetes)', w === 3, `arma ${w}`);
      await a.mouse.down();
      await sleep(80);
      await a.mouse.up();
      await sleep(150);
      await a.screenshot({ path: `${OUT}/03-dm-a-rocket.png` });

      // ---- aiming (right mouse) and the two new weapons
      await waitFor(a, `window.__arena.game.alive`, 8000);
      const myId = (await a.evaluate(`window.__arena.myId`)) as number;
      const serverOf = () =>
        (matchMaker.getLocalRoomById(code) as unknown as {
          debugSim: { players: Map<number, { lastCmd: { buttons: number } | null; sim: { ammo: number[]; weapon: number; charge: number } }> } | null;
        }).debugSim!.players.get(myId)!;
      const fovHip = (await a.evaluate(`window.__arena.game.camera.fov`)) as number;
      await a.mouse.down({ button: 'right' });
      await sleep(600 + LAG * 2);
      const ads = (await a.evaluate(`({ fov: window.__arena.game.camera.fov, t: window.__arena.game.adsT, aim: (window.__arena.game.d.input.buttons() & 128) !== 0 })`)) as { fov: number; t: number; aim: boolean };
      check('Clic derecho apunta: reduce el FOV y centra el arma', ads.aim && ads.fov < fovHip - 5 && ads.t > 0.8, `FOV ${fovHip.toFixed(0)} → ${ads.fov.toFixed(0)}, ads ${ads.t.toFixed(2)}`);
      await sleep(300 + LAG * 4);
      check('El servidor recibe el bit Aim en los inputs', ((serverOf().lastCmd?.buttons ?? 0) & 128) !== 0);
      await a.screenshot({ path: `${OUT}/03b-dm-a-aim-rocket.png` });
      await a.mouse.up({ button: 'right' });
      await sleep(400);

      await a.keyboard.press('Digit6');
      await sleep(900 + LAG * 4);
      check('Tecla 6: Hilo Aurora (rayo de plasma)', ((await a.evaluate(`window.__arena.game.me.weapon`)) as number) === 5);
      const plasmaBefore = serverOf().sim.ammo[5];
      await a.mouse.down();
      await sleep(350);
      await a.screenshot({ path: `${OUT}/03c-dm-a-plasma.png` });
      await sleep(250);
      await a.mouse.up();
      await sleep(300 + LAG * 4);
      const plasmaUsed = plasmaBefore - serverOf().sim.ammo[5];
      check('El rayo consume munición por tick validada por el servidor', plasmaUsed >= 10, `${plasmaUsed} balas en ~0,6 s`);

      await a.keyboard.press('Digit7');
      await sleep(1000 + LAG * 4);
      check('Tecla 7: Lanza Cuásar (francotirador de carga)', ((await a.evaluate(`window.__arena.game.me.weapon`)) as number) === 6);
      const chargeBefore = serverOf().sim.ammo[6];
      await a.mouse.down();
      await sleep(1800);
      const charged = (await a.evaluate(`({ c: window.__arena.game.pred.charge, bar: !document.getElementById('hud-charge').classList.contains('hidden') })`)) as { c: number; bar: boolean };
      check('Mantener clic carga el arma (0–1,5 s) y muestra la barra', charged.c > 1.4 && charged.bar, `carga ${charged.c.toFixed(2)} s`);
      await a.screenshot({ path: `${OUT}/03d-dm-a-charge.png` });
      await a.mouse.up();
      await sleep(400 + LAG * 4);
      check('Al soltar dispara y gasta 1 de munición', serverOf().sim.ammo[6] === chargeBefore - 1, `${chargeBefore} → ${serverOf().sim.ammo[6]}`);
      await sleep(900);
      await a.mouse.down({ button: 'right' });
      await sleep(700 + LAG * 2);
      check('El francotirador muestra su mira de alcance', await a.evaluate(`!document.getElementById('scope').classList.contains('hidden')`) as boolean);
      await a.screenshot({ path: `${OUT}/03e-dm-a-scope.png` });
      await a.mouse.up({ button: 'right' });
      await sleep(300);
      if (process.env.E2E_WEAPON_SHOTS) {
        // visual review of the seven models: resting and aiming views (E2E_WEAPON_SHOTS=1 npm run test:e2e)
        for (let i = 0; i < 7; i++) {
          await a.keyboard.press(`Digit${i + 1}`);
          await sleep(1000 + LAG * 4);
          await a.screenshot({ path: `${OUT}/w${i + 1}-hip.png` });
          await a.mouse.down({ button: 'right' });
          await sleep(700 + LAG * 2);
          await a.screenshot({ path: `${OUT}/w${i + 1}-ads.png` });
          await a.mouse.up({ button: 'right' });
          await sleep(200);
        }
      }
      await a.keyboard.press('Digit1');
      await sleep(700 + LAG * 4);

      await a.keyboard.down('Tab');
      await sleep(200);
      const sb = (await a.evaluate(`document.getElementById('scoreboard').innerText`)) as string;
      check('Tab muestra el marcador con Puesto, Daño, Puntaje y Ping', /Puesto/.test(sb) && /Daño/.test(sb) && /Puntaje/.test(sb) && /Ping/.test(sb) && /1\.º/.test(sb));
      await a.screenshot({ path: `${OUT}/04-dm-scoreboard.png` });
      await a.keyboard.up('Tab');
      check(
        'El HUD muestra salud y escudo por separado con su máximo',
        (await a.evaluate(`document.getElementById('hud-shield-max').textContent === '/100' && document.getElementById('hud-hp-max').textContent === '/100'`)) as boolean,
      );

      // "Puntajes" from the pause menu, with the cursor released: the match keeps running
      await a.evaluate(`document.exitPointerLock()`);
      check('Al soltar el cursor aparece el menú de pausa', await waitFor(a, `!document.getElementById('pause').classList.contains('hidden')`, 3000));
      await a.click('#btn-scores');
      const t0 = (await a.evaluate(`window.__arena.game.snaps.at(-1).t`)) as number;
      await sleep(700);
      const t1 = (await a.evaluate(`window.__arena.game.snaps.at(-1).t`)) as number;
      const pinned = (await a.evaluate(`document.getElementById('pause-scores').innerText`)) as string;
      check('El botón Puntajes muestra el marcador en la pausa', /Puesto/.test(pinned) && /1\.º/.test(pinned));
      check('Abrir el marcador no pausa la partida', t1 > t0, `tick ${t0} → ${t1}`);
      await a.screenshot({ path: `${OUT}/04b-pause-scores.png` });
      await a.click('#btn-scores');
      check('El botón vuelve a los ajustes', (await a.evaluate(`document.getElementById('pause-scores').classList.contains('hidden')`)) as boolean);
      await a.click('#btn-resume');
      await waitFor(a, `document.pointerLockElement !== null`, 3000);
    }
    await sleep(500);
    await b.screenshot({ path: `${OUT}/05-dm-b-view.png` });

    const fps = await a.evaluate(`window.__arena.game.fps`) as number;
    check('Bucle de render activo', fps > 1, `${fps.toFixed(1)} FPS en headless/SwiftShader (no representativo de GPU real)`);

    // ---- skins in the match: put both players face to face (server-side teleport) and capture both views
    const room = matchMaker.getLocalRoomById(code) as unknown as {
      debugSim: { end(r: string): void; players: Map<number, { sim: { x: number; y: number; z: number; vx: number; vy: number; vz: number }; protectTimer: number }>; map: { id: string } } | null;
    };
    const sim = room.debugSim!;
    const spawn = getMap(sim.map.id)!.spawns[0];
    const dist = 2.6;
    const fx = -Math.sin(spawn.yaw), fz = -Math.cos(spawn.yaw); // forward vector of a yaw
    const place = (id: number, x: number, z: number) => {
      const p = sim.players.get(id)!;
      Object.assign(p.sim, { x, y: spawn.pos[1], z, vx: 0, vy: 0, vz: 0 });
      p.protectTimer = 0;
    };
    place(aId, spawn.pos[0], spawn.pos[2]);
    place(bId, spawn.pos[0] + fx * dist, spawn.pos[2] + fz * dist);
    await a.evaluate(`(() => { const i = window.__arena.game.d.input; i.yaw = ${spawn.yaw}; i.pitch = -0.05; })()`);
    await b.evaluate(`(() => { const i = window.__arena.game.d.input; i.yaw = ${spawn.yaw + Math.PI}; i.pitch = -0.05; })()`);
    await sleep(1800 + LAG * 4);
    // texture the characters actually wear: A's own skin is 256 px, B's is 128 px
    const wornByB = (await b.evaluate(`[...window.__arena.game.chars.values()].map((c) => c.mat.map.image.width)`)) as number[];
    const wornByA = (await a.evaluate(`[...window.__arena.game.chars.values()].map((c) => c.mat.map.image.width)`)) as number[];
    check('B ve a A con la skin 256 px de A', wornByB.length === 1 && wornByB[0] === 256, JSON.stringify(wornByB));
    check('A ve a B con la skin 128 px de B', wornByA.length === 1 && wornByA[0] === 128, JSON.stringify(wornByA));
    check('Los brazos en primera persona usan la skin propia', (await a.evaluate(`window.__arena.game.viewArms.mat.map.image.width`)) === 256 && (await b.evaluate(`window.__arena.game.viewArms.mat.map.image.width`)) === 128);
    await a.screenshot({ path: `${OUT}/05b-skins-view-a.png` });
    await b.screenshot({ path: `${OUT}/05c-skins-view-b.png` });

    // forced end → results → lobby
    room.debugSim!.end('score');
    check('Pantalla de resultados en ambos', (await waitFor(a, `!document.getElementById('screen-results').classList.contains('hidden')`)) && (await waitFor(b, `!document.getElementById('screen-results').classList.contains('hidden')`)));
    check('Recursos de la partida liberados', (await a.evaluate(`window.__arena.game === null`)) as boolean);
    await a.screenshot({ path: `${OUT}/06-results.png` });
    await a.click('#btn-to-lobby');
    check('Vuelta al lobby en ambos', (await waitFor(a, `!document.getElementById('screen-lobby').classList.contains('hidden')`)) && (await waitFor(b, `!document.getElementById('screen-lobby').classList.contains('hidden')`)));

    // CTF
    await a.selectOption('#sel-mode', 'ctf');
    check('B ve el cambio a CTF', await waitFor(b, `document.getElementById('sel-mode').value === 'ctf'`));
    await b.click('#btn-ready');
    await waitFor(a, `!document.getElementById('btn-start').disabled`);
    await sleep(150); // the server ignores lobby actions of the same player closer than 100 ms
    await a.click('#btn-start');
    check('Partida CTF arranca', (await waitFor(a, `!!window.__arena.game && window.__arena.game.flags.length === 2`)) && (await waitFor(b, `!!window.__arena.game`)));
    await sleep(1500);
    await a.screenshot({ path: `${OUT}/07-ctf-a.png` });
    await b.screenshot({ path: `${OUT}/08-ctf-b.png` });
    const teams = await a.evaluate(`window.__arena.lobby.players.map(p => p.team).sort().join(',')`) as string;
    check('Equipos balanceados (1 rojo, 1 azul)', teams === '0,1', teams);

    // host leaves → B becomes host
    await a.evaluate(`window.__arena.net.leave()`);
    check('Al salir el anfitrión, B pasa a ser anfitrión', await waitFor(b, `window.__arena.lobby.hostId === window.__arena.myId`, 5000));
  } finally {
    check('Sin errores de JavaScript en la página', errors.length === 0, errors.slice(0, 5).join(' | '));
    await browser.close();
    await server.gracefullyShutdown(false);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas${LAG > 0 ? ` (latencia artificial ${LAG} ms por sentido)` : ''}. Capturas en ${OUT}`);
  process.exit(failed.length > 0 ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
