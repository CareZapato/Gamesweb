# Fase 02 — Mapa holdout (Composer)

## Objetivo

Arena grande centrada, spawns perimetrales para hordas, **solo materiales ya definidos** en `shared/src/map.ts`.

## Tareas

1. Añadir `shared/src/maps/holdout.ts`: plataforma central, anillo walkable ~80 m, 8–12 puntos `hordeSpawns: [x,y,z][]` (nuevo campo opcional en `MapDef` o tabla en comentario exportada).
2. Registrar mapa en `shared/src/maps/index.ts`; modo soportado: nuevo `'survival'` o reutilizar `'dm'` con reglas en sala (preferir `'survival'` en `MatchSettings` si es poco invasivo).
3. Spawns jugador en el centro; `killY` coherente.
4. Test mínimo: mapa carga, spawns dentro de suelo, sin cajas flotantes (`tests/maps.test.ts` o `tests/deadhold-map.test.ts`).

Leer geometría de referencia en `shared/src/maps/outpost.ts`; **no** copiar CTF.

## Verificación

`npm test` incluye al menos 1 test del mapa holdout.
