# 11 — Reducto: Horda (supervivencia zombie endless)

**Rama:** `otro-juego`  
**Diseño:** [docs/games/deadhold/ANALISIS.md](../../docs/games/deadhold/ANALISIS.md)  
**Prompts por fase (económicos):** [prompts/0.1.0/README.md](../0.1.0/README.md)

## Qué hace este juego

Segundo título del portal: arena central grande, **oleadas de zombies**, **tienda de mejoras** entre rondas, **niveles endless** con escalado numérico. Reutiliza motor, armas y texturas de RealTournament; enemigos = variaciones del personaje cubico (escala/tinte).

## Cómo ejecutarlo (barato)

1. Lee `prompts/0.1.0/00-reglas-economia.md`.
2. Un chat nuevo por cada `01` … `07` en `prompts/0.1.0/`.
3. Modelo: **Composer** en fases 01, 02, 05, 06; **Sonnet** en 03, 04, 07.
4. Alternativa un solo hilo: pegar `prompts/0.1.0/PROMPT-MAESTRO.md` (más caro).

| Fase | Archivo | Modelo |
|------|---------|--------|
| 1 | `0.1.0/01-catalogo-y-rutas-composer.md` | Composer |
| 2 | `0.1.0/02-mapa-holdout-composer.md` | Composer |
| 3 | `0.1.0/03-shared-oleadas-sonnet.md` | Sonnet |
| 4 | `0.1.0/04-servidor-deadhold-sonnet.md` | Sonnet |
| 5 | `0.1.0/05-cliente-hud-composer.md` | Composer |
| 6 | `0.1.0/06-enemigos-visuales-composer.md` | Composer |
| 7 | `0.1.0/07-integracion-y-tests-sonnet.md` | Sonnet |

Al terminar todo: actualizar portal (`deadhold` jugable), tag git `deadhold-v0.1.0` opcional.
