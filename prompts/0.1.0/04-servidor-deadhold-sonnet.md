# Fase 04 — Servidor DeadholdRoom (Sonnet)

## Objetivo

Sala PvE oleadas + tienda; reutilizar movimiento/disparo del jugador humano.

## Tareas

1. `shared/src/games.ts`: `deadhold: 'deadhold'` en `ROOM_NAMES`.
2. `server/src/DeadholdRoom.ts` (patrón `ArenaRoom.ts`):
   - Mapa `holdout`, 1–4 jugadores, sin CTF.
   - Fases: `combat` / `shop` / `gameover`.
   - `WaveDirector`: spawnea zombies como entidades con `ZombieBrain` (nuevo, inspirado en `BotBrain.ts`).
   - Melee zombie: daño por intervalo en rango; usar stats de `archetypes` × multiplicadores de oleada.
3. `server/src/createGameServer.ts`: `server.define(ROOM_NAMES.deadhold, DeadholdRoom)`.
4. Protocolo: mensajes mínimos (`wave`, `shop`, `level`, `scrap`) en `shared/src/protocol.ts` o módulo `deadholdProtocol.ts`.
5. Tests integración: 1 oleada completa con 3 zombies mock (`tests/deadhold.integration.test.ts`).

Zombies **no** usan armas; team distinto al jugador.

## Verificación

`npm test`; unirse con `options.game: 'deadhold'` (test o manual con debug).
