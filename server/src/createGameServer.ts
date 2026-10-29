import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchMaker, Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { NET, ROOM_NAMES } from '@arena/shared';
import express from 'express';
import { ArenaRoom } from './ArenaRoom';
import { DeadholdRoom } from './DeadholdRoom';

export interface GameServerOptions {
  port: number;
  host?: string;
  /** Directory with the built client to serve (optional). */
  staticDir?: string;
  /** Comma separated list of allowed browser origins. Empty = reflect any origin. */
  allowedOrigins?: string[];
  /** Simulated round-trip latency in ms (testing only). */
  simulateLatencyMs?: number;
}


export const createGameServer = async (opts: GameServerOptions) => {
  const allowed = (opts.allowedOrigins ?? []).filter(Boolean);
  if (allowed.length > 0) {
    const original = matchMaker.controller.getCorsHeaders.bind(matchMaker.controller);
    matchMaker.controller.getCorsHeaders = (headers: Headers) => {
      const base = original(headers);
      const origin = headers.get('origin') ?? '';
      return { ...base, 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] };
    };
  }

  const transport = new WebSocketTransport({
    maxPayload: NET.maxPayloadBytes,
    verifyClient: allowed.length > 0 ? (info: { origin: string }) => !info.origin || allowed.includes(info.origin) : undefined,
  });

  const server = new Server({
    transport,
    greet: false,
    express: (app) => {
      app.get('/health', (_req, res) => {
        res.json({ ok: true, uptime: Math.round(process.uptime()) });
      });
      if (opts.staticDir && existsSync(opts.staticDir)) {
        const root = opts.staticDir;
        app.use(express.static(root, { index: 'index.html', maxAge: '1h' }));
        const rt = join(root, 'realtournament/index.html');
        app.get('/realtournament', (_req, res) => res.redirect(301, '/realtournament/'));
        app.get('/realtournament/', (_req, res, next) => {
          if (existsSync(rt)) res.sendFile(rt);
          else next();
        });
        const dh = join(root, 'deadhold/index.html');
        app.get('/deadhold', (_req, res) => res.redirect(301, '/deadhold/'));
        app.get('/deadhold/', (_req, res, next) => {
          if (existsSync(dh)) res.sendFile(dh);
          else next();
        });
      }
    },
  });
  // one room type per game, each under its own name (see shared/src/games.ts)
  server.define(ROOM_NAMES.realtournament, ArenaRoom);
  server.define(ROOM_NAMES.deadhold, DeadholdRoom);
  if (opts.simulateLatencyMs && opts.simulateLatencyMs > 0) server.simulateLatency(opts.simulateLatencyMs);
  await server.listen(opts.port, opts.host);
  return server;
};

export const defaultStaticDir = (): string => resolve(fileURLToPath(new URL('.', import.meta.url)), '../../client/dist');
