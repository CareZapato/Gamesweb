# Reglas de economía para prompts (v0.1.0)

Objetivo: máximo avance en **Reducto: Horda** con el **menor costo** en tokens y en generación de imágenes.

## Modelos (de más barato a más caro)

1. **Composer / Fast** — UI, HTML/CSS, entradas Vite, mapas como datos, documentación, ajustes visuales sin física (tinte, escala).
2. **Sonnet** — `shared/` simulación, protocolo, servidor Colyseus, tests de reglas, reconciliación cliente.
3. **Opus / thinking** — Solo si un prompt Sonnet **falla dos veces** en la misma fase (mismo test rojo).

No uses modelos “thinking” para tareas que solo tocan `client/src/ui` o `docs/`.

## Un chat = un archivo de `prompts/0.1.0/`

- No mezcles mapa + servidor + HUD en un solo mensaje.
- Adjunta **solo** el `.md` de esa fase; el agente debe leer `docs/games/deadhold/ANALISIS.md` **solo** cuando el prompt lo indique.

## Alcance por turno

- **Máximo ~6 archivos** tocados por prompt, salvo mapa holdout (solo `shared/src/maps/holdout.ts` + registro).
- **Prohibido** regenerar PNG, correr scripts de prompts de arte, o ampliar `docs/prompts/` en v0.1.0.
- **Reutilizar** texturas existentes vía `Material` del mapa; zombies = `Character` + color, no skin nueva.

## Verificación obligatoria (texto fijo al final de cada prompt)

```
Al terminar: npm run typecheck && npm test && npm run build.
No romper RealTournament: los tests existentes deben seguir en verde.
```

## Commits

- Un commit por fase, mensaje en español: `deadhold: <fase>`.
- Rama de trabajo: `otro-juego`.

## Anti-patrones (caros)

- “Refactoriza todo el GameSim” → usar sala `DeadholdRoom` separada.
- “Crea 20 PNG de zombies” → arquetipos por escala + emissive.
- “Haz multiplayer perfecto” → v0.1.0 solo coop en misma sala, sin matchmaking nuevo.

## Contexto mínimo al agente

Incluye siempre estas rutas, nada más:

- `shared/src/games.ts`, `client/src/catalog.ts`, `server/src/ArenaRoom.ts` (referencia)
- `docs/games/deadhold/ANALISIS.md`

No pegues el monorepo entero ni logs de Render.
