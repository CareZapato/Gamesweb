import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer, defaultStaticDir } from './createGameServer';

// optional .env at the repository root (see .env.example); real environment variables take precedence
const envFile = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../.env');
if (existsSync(envFile)) {
  const preset = { ...process.env };
  process.loadEnvFile(envFile);
  Object.assign(process.env, preset);
}

const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? '0.0.0.0';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const simulateLatencyMs = Number(process.env.SIMULATE_LATENCY_MS ?? 0);
const staticDir = process.env.STATIC_DIR ?? defaultStaticDir();

await createGameServer({ port, host, allowedOrigins, simulateLatencyMs, staticDir });

console.log(`[servidor] servidor escuchando en ${host}:${port}`);
if (simulateLatencyMs > 0) console.log(`[servidor] latencia simulada: ${simulateLatencyMs} ms (ida y vuelta)`);
if (allowedOrigins.length > 0) console.log(`[servidor] orígenes permitidos: ${allowedOrigins.join(', ')}`);
