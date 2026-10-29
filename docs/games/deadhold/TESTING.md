# Pruebas — Reducto: Horda

Ejecutar **después de cada cambio** en cliente, servidor o `shared/deadhold`:

```bash
npm run typecheck
npm run test:deadhold
npm run test:rt
npm run build
```

Atajo de toda la suite:

```bash
npm run test:all
```

## Qué cubre cada comando

| Script | Archivos | Qué verifica |
|--------|----------|----------------|
| `test:deadhold` | `deadhold-waves`, `deadhold.integration`, `holdout-map` | Fórmulas, tienda, Colyseus, mapa holdout |
| `test:rt` | `integration.test.ts` | RealTournament sin regresión (lobby, movimiento, aislamiento de salas) |
| `test:all` | Toda la carpeta `tests/` | Proyecto completo |

## Comprobación manual rápida (~5 min)

1. `npm run dev` → portal con **solo 2 juegos**.
2. `/deadhold/` → crear sala → iniciar → oleada 1.
3. Matar todos los enemigos → **tienda**: clic en una mejora y en **Listo**; el overlay debe cerrarse y **Haz clic para jugar** debe permitir volver al FPS.
4. Oleada 2: movimiento WASD y disparo OK.
5. `/realtournament/` → crear sala → iniciar partida (humo RT).

## E2E opcional (navegador)

Con servidor + build:

```bash
npm run build && npm start
# otra terminal:
npm run test:e2e
```

(E2E actual centrado en RealTournament; ampliar a deadhold en una fase futura.)
