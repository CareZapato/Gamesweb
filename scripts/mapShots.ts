/**
 * Visual review of the maps: one headless client starts a Deathmatch on every map, is teleported
 * (server side) to a few viewpoints and takes screenshots. Also fails on shader or page errors.
 *
 *   npm run build && npm run maps:shots
 *
 * Screenshots go to e2e-artifacts/maps/.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { matchMaker } from '@colyseus/core';
import { MAPS } from '@arena/shared';
import { chromium, type Page } from 'playwright-core';
import { createGameServer, defaultStaticDir } from '../server/src/createGameServer';

const PORT = 3900 + Math.floor(Math.random() * 300);
const OUT = resolve('e2e-artifacts/maps');
mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type View = [x: number, y: number, z: number, yaw: number, pitch: number];
const VIEWS: Record<string, View[]> = {
  outpost: [
    [0, 6.5, -60, Math.PI, -0.1],
    [-27, 4, -36, Math.PI, -0.05],
    [20, 0, -38, Math.PI, 0],
  ],
  towers: [
    [-5, 0, -36, Math.PI, 0.35],
    [0, 10, -12, Math.PI, 0],
    [-30, 0, 12, -2.3, 0.3],
  ],
  gateways: [
    [0, 1, -2.5, Math.PI, -0.35],
    [-20, 0, -20, Math.PI / 2, 0],
    [-20, 0, 15, Math.PI, -0.3],
    [-2, 0, -4.5, Math.PI / 2, 0],
  ],
  lava: [
    [-21, 13, -1, -Math.PI / 2, -0.25],
    [18, 3, -2, Math.PI / 2, 0.05],
    [0, 3.25, 0, Math.PI, 0.45],
  ],
};

const main = async () => {
  const server = await createGameServer({ port: PORT, host: '127.0.0.1', staticDir: defaultStaticDir() });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }).catch(() =>
    chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }),
  );
  const errors: string[] = [];
  try {
    const page: Page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if ((m.type() === 'error' || /WebGLProgram|Shader Error/.test(m.text())) && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
    });
    await page.goto(`http://127.0.0.1:${PORT}/realtournament/?debug`);
    await page.fill('#in-name', 'Revisor');
    await page.click('#btn-create');
    await page.waitForFunction(`!document.getElementById('screen-lobby').classList.contains('hidden')`);
    const code = ((await page.textContent('#lobby-code')) ?? '').trim();
    for (const map of MAPS) {
      const views = VIEWS[map.id];
      if (!views) continue;
      await page.selectOption('#sel-mode', 'dm');
      await sleep(150);
      await page.selectOption('#sel-map', map.id);
      await sleep(300);
      await page.click('#btn-start');
      await page.waitForFunction(`!!window.__arena.game && window.__arena.game.alive`, undefined, { timeout: 15000 });
      const room = matchMaker.getLocalRoomById(code) as unknown as {
        debugSim: { end(r: string): void; players: Map<number, { sim: Record<string, number | boolean>; protectTimer: number }> };
      };
      const id = (await page.evaluate(`window.__arena.myId`)) as number;
      let i = 0;
      for (const [x, y, z, yaw, pitch] of views) {
        const p = room.debugSim.players.get(id)!;
        Object.assign(p.sim, { x, y, z, vx: 0, vy: 0, vz: 0, onGround: true });
        await page.evaluate(`(() => { const inp = window.__arena.game.d.input; inp.yaw = ${yaw}; inp.pitch = ${pitch}; })()`);
        await sleep(1200);
        await page.screenshot({ path: `${OUT}/${map.id}-${++i}.png` });
      }
      room.debugSim.end('score');
      await page.waitForFunction(`!document.getElementById('screen-results').classList.contains('hidden')`);
      await page.screenshot({ path: `${OUT}/${map.id}-results.png` });
      await page.click('#btn-to-lobby');
      await page.waitForFunction(`!document.getElementById('screen-lobby').classList.contains('hidden')`);
      console.log(`OK   ${map.name}: ${views.length} capturas`);
    }
  } finally {
    await browser.close();
    await server.gracefullyShutdown(false);
  }
  if (errors.length) console.log(`FAIL errores en la página:\n${errors.slice(0, 10).join('\n')}`);
  else console.log(`Sin errores de página ni de shaders. Capturas en ${OUT}`);
  process.exit(errors.length ? 1 : 0);
};

void main();
