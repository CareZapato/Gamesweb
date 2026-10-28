# Prompts v0.1.0 — Reducto: Horda (segundo juego)

Paquete de prompts **separados por costo y modelo**, para implementar el modo supervivencia zombie sin quemar tokens.

## Cómo usarlos

1. Lee **`00-reglas-economia.md`** una vez (reglas globales).
2. Ejecuta los prompts **en orden numérico**, **un chat nuevo por archivo**.
3. Tras cada prompt: `npm run typecheck`, `npm test`, `npm run build`; commit en la rama `otro-juego`.
4. Diseño completo: [`docs/games/deadhold/ANALISIS.md`](../../docs/games/deadhold/ANALISIS.md).

## Tabla rápida (modelo ≈ costo)

| Archivo | Modelo sugerido | Por qué |
|---------|------------------|---------|
| `00-reglas-economia.md` | (lectura humana) | — |
| `01-catalogo-y-rutas-composer.md` | Composer / Fast | Solo TS/HTML portal, sin sim |
| `02-mapa-holdout-composer.md` | Composer | Datos de mapa, sin red |
| `03-shared-oleadas-sonnet.md` | Sonnet | Fórmulas + tipos compartidos |
| `04-servidor-deadhold-sonnet.md` | Sonnet | Colyseus + IA + spawner |
| `05-cliente-hud-composer.md` | Composer | UI oleada/tienda |
| `06-enemigos-visuales-composer.md` | Composer | Escala/tinte Character, sin PNG |
| `07-integracion-y-tests-sonnet.md` | Sonnet | Cierre, tests, regresión RT |
| `PROMPT-MAESTRO.md` | Sonnet (solo planificación) | Pegar al agente si quieres un solo hilo con fases |

**Regla de oro**: no pidas imágenes ni prompts de `docs/prompts/` en esta versión; todo visual sale de materiales y skins ya en el repo.
