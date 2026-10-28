# Fase 03 — Reglas compartidas de oleadas (Sonnet)

## Objetivo

Lógica **determinista y testeable** de escalado numérico y economía, sin Colyseus.

## Tareas

1. Crear `shared/src/deadhold/` con:
   - `waves.ts`: `enemiesInWave(n)`, multiplicadores vida/daño/velocidad, cola si `maxAlive`.
   - `archetypes.ts`: ids caminante/corredor/bruto/acorazado/coloso + oleada mínima de aparición.
   - `shop.ts`: tipos de mejora, costes, topes de stack, generación de 3–5 ofertas por oleada.
2. Exportar desde `shared/src/index.ts`.
3. Tests `tests/deadhold-waves.test.ts`: oleadas 1, 5, 10, 25; moneda; ofertas no duplican tope.

**No** modificar `GameSim` de RT; solo código nuevo bajo `deadhold/`.

## Verificación

`npm run typecheck && npm test`.
