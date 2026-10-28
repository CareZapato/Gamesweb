# Fase 01 — Catálogo y rutas (Composer)

## Objetivo

Registrar **Reducto: Horda** (`id: deadhold`) como **segundo juego** del portal, sin lógica de partida aún.

## Tareas

1. `client/src/catalog.ts`: insertar en **posición 2** (después de RealTournament) entrada:
   - `id: 'deadhold'`, nombre **Reducto: Horda**, descripción oleadas zombie endless, `route: '/deadhold/'`, `roomName: null`, `status: 'soon'`, 1–4 jugadores, `thumbnail: '/portal/deadhold_card.svg'`.
2. Desplazar entradas “Próximamente” existentes sin borrarlas.
3. Crear `client/deadhold/index.html` mínimo (“Próximamente — supervivencia por oleadas”) y entrada en `client/vite.config.ts` (`deadhold: .../deadhold/index.html`).
4. Crear `client/public/portal/deadhold_card.svg` (tarjeta simple, 2–3 colores, estilo portal).
5. `docs/games/deadhold/README.md` enlace al análisis.

**No** tocar `shared/src/games.ts` ni servidor todavía.

## Verificación

`npm run typecheck && npm run build`. Portal `/` muestra la nueva tarjeta; `/deadhold/` carga la página stub.
