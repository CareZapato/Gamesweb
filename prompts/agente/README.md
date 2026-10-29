# Prompts para el agente de Cursor

Úsalos **en orden**, cada uno en un **chat nuevo** (así el contexto es pequeño y más barato).
Al terminar cada uno: revisa que `npm run typecheck`, `npm test` y `npm run build` pasen, prueba a
jugar y haz commit antes del siguiente.

| # | Archivo | Qué hace | Modelo recomendado |
|---|---|---|---|
| 1 | `01-catalogo-realtournament-render.md` | Portal de minijuegos, renombrar a RealTournament, salas por juego, despliegue en Render | Sonnet |
| 2 | `02-graficos-bajos-y-optimizacion.md` | Calidad baja por defecto y menos recursos | Composer |
| 3 | `03-personajes-cubicos-y-skins.md` | Personaje de bloques y skins con un único archivo de textura | Sonnet |
| 4 | `04-armas-nuevas-y-mira.md` | Rediseño de armas, rayo de plasma, segundo francotirador, apuntar con clic derecho | Sonnet |
| 5 | `05-armas-desbloqueables.md` | Empezar con un arma y recoger el resto en el mapa | Sonnet |
| 6 | `06-multikills-y-rachas.md` | Double/triple/…/penta kill y rachas | Composer |
| 7 | `07-hud-e-iconos.md` | HUD mejorado e iconos de armas | Composer |
| 8 | `08-cinco-arenas.md` | 4 mapas nuevos: exterior, tres torres, puertas y portales, pozo de lava | Sonnet |
| 9 | `09-prompts-texturas-minimalistas.md` | Carpeta de prompts de imágenes simples (texturas, armas, iconos, pickups, skins) | Composer |
| 10 | `10-escudo-y-marcador.md` | Escudo en lugar de armadura y marcador de puntajes en vivo | Sonnet |
| 11 | [`11-deadhold-horda-v0.1.0.md`](11-deadhold-horda-v0.1.0.md) | Segundo juego: supervivencia zombie endless | [Fases v0.1.0](../0.1.0/README.md) |

Regla práctica de costo: **Composer** para tareas acotadas de UI, ajustes y documentos;
**Sonnet** cuando se toca simulación compartida, red o servidor (si se equivoca ahí, sale más caro
corregirlo). Usa un modelo superior (Opus) solo si un prompt falla dos veces.
