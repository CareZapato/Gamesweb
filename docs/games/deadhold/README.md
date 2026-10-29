# Reducto: Horda (`deadhold`)

Segundo minijuego del portal: **supervivencia zombie endless** sobre el motor de RealTournament (simulación autoritativa, Colyseus, Vite + Three.js).

- **Análisis de diseño:** [ANALISIS.md](./ANALISIS.md)
- **Implementación por fases:** [prompts/0.1.0/README.md](../../../prompts/0.1.0/README.md)
- **Prompt índice agente:** [prompts/agente/11-deadhold-horda-v0.1.0.md](../../../prompts/agente/11-deadhold-horda-v0.1.0.md)

## Cómo jugar

1. Abre el **portal** (`/` en local o la URL de despliegue) y entra en **Reducto: Horda**, o ve directo a **`/deadhold/`**.
2. Pon tu nombre, **crea sala** (código de 6 caracteres) o **únete** con el código de un amigo (1–4 jugadores).
3. El **anfitrión** pulsa **Iniciar** cuando el equipo esté listo. Mapa fijo: **`holdout`** (arena central, spawns en el perímetro).
4. **Combate:** elimina a todos los enemigos de la oleada. Controles iguales que RealTournament (WASD, ratón, disparo, armas del inventario RT).
5. **Tienda (~30 s):** gasta **scrap** en hasta 3 ofertas de mejora; cuando todos marcan listo (o pasa el tiempo), empieza la siguiente oleada.
6. **Fin de run:** si mueren todos los humanos, la partida termina con resumen (nivel alcanzado, oleada de caída, bajas, scrap). El anfitrión puede volver al lobby o repetir.

**Coop:** friendly fire desactivado; el scrap por baja va al jugador que mata; el bonus de “oleada limpia” se reparte entre los vivos.

**Aislamiento de salas:** el código solo vale para el juego con el que se creó (`game: deadhold`). Un código de RealTournament no abre Reducto y viceversa.

## Oleadas y límites (v0.1.0)

Modo **endless**: no hay oleada máxima de diseño; la dificultad escala numéricamente sin tope.

### Cuántos enemigos spawnean

Fórmula en `shared/src/deadhold/waves.ts` (determinista en servidor):

```
base(n) = floor(3 + n×1.2 + floor(n^1.15)×0.4)
enemigos(n) = base(n) + (n≥5 y n múltiplo de 5 ? 1 especial : 0)
```

Ejemplos: oleada **1 → 4**, **5 → 12** (11 + coloso/bruto), **10 → 21**, **25 → 50**.

### Tope de vivos simultáneos

- **`maxAlive = 40`** (`WAVES.maxAlive`): en el plan free de Render no entran más de 40 zombies a la vez.
- El resto **espera en cola** y entra en lotes cuando mueren otros (`spawnBatch` 2 cada 0,5 s por defecto).

### Escalado por oleada `n`

| Stat | Fórmula | Tope |
|------|---------|------|
| Vida (y escudo base) | `1 + n×0.12` | — |
| Daño melee | `1 + n×0.04` | — |
| Velocidad | `1 + n×0.02` | **×1.6** máximo |

### Arquetipos (desbloqueo)

| Id | Nombre | Oleada ≥ | Notas |
|----|--------|----------|--------|
| `walker` | Caminante | 1 | Composición habitual |
| `runner` | Corredor | 3 | Más rápido, menos vida |
| `brute` | Bruto | 8 | Mucha vida, empuje |
| `armored` | Acorazado | 15 | Escudo frontal |
| `colossus` | Coloso | 25 | Especial en oleadas 5, 10, 15… |

Composición concreta de cada oleada: `planWave(n, seed)` (semilla de partida varía la mezcla, no el total).

### Ritmo de sala

Constantes en `shared/src/deadhold/protocol.ts` (`DEADHOLD`):

- **4 s** de gracia al inicio de cada oleada antes del spawn.
- **30 s** de tienda entre oleadas.
- **Máx. 4 jugadores** por sala.

## Desarrollo y pruebas

```bash
npm run dev          # portal + /deadhold/ + servidor
npm run typecheck
npm run test:deadhold   # oleadas + integración Colyseus
npm run test:rt         # humo RealTournament
npm run test:all        # suite completa
npm run build
npm start
```

Guía de pruebas: [TESTING.md](./TESTING.md).

Tests relevantes:

- `tests/deadhold-waves.test.ts` — fórmulas, tienda, cola de spawn.
- `tests/deadhold.integration.test.ts` — director de oleadas, sala Colyseus, WRONG_GAME, coop.
- `tests/integration.test.ts` — humo **RealTournament** (regresión del primer juego).

Despliegue (Render): `render.yaml` usa `npm run build`; no hace falta entrada extra: `client/vite.config.ts` ya compila `deadhold/index.html` y el servidor redirige `/deadhold/`.

Rama de trabajo histórica: `otro-juego`.
