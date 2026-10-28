# Fase 05 — Cliente y HUD (Composer)

## Objetivo

Página jugable mínima: conectar a sala, mostrar oleada/nivel/scrap y UI de tienda.

## Tareas

1. Copiar estructura ligera de `client/realtournament/` → `client/deadhold/` (main, Net, pantallas reducidas).
2. Forzar `game: 'deadhold'` al unirse; mapa holdout; sin lobby CTF complejo (crear sala directa o lobby 1 pantalla).
3. HUD: `#hud-wave`, `#hud-level`, `#hud-scrap`, panel tienda entre oleadas (botones de mejoras desde snapshot/eventos).
4. `catalog.ts`: pasar `status: 'available'` y `roomName` cuando el servidor exista (esta fase, si fase 04 lista).

Reutilizar `Game.ts` **solo** si extracción es grande; preferir `DeadholdGame.ts` que importe render/combat compartido.

## Verificación

`npm run build`; local `npm run dev` → jugar 2 oleadas en solitario.
