Lee `docs/ARCHITECTURE.md` (secciones "Salud, escudo y daño" y "Marcador"),
`shared/src/constants.ts`, `server/src/game/GameSim.ts`, `client/src/ui/Hud.ts` y
`tests/gamesim.test.ts`. Responde en español.

Objetivo: **escudo** (sustituye a la armadura; un único sistema) y **marcador** en vivo.

Escudo:
- Atributo + pickup; por defecto 100 de salud y 0 de escudo, máximo 100; cantidad y reaparición
  configurables. Se limita al máximo y no se consume si ya está lleno.
- Absorbe el daño antes que la salud; la lava lo ignora; la reaparición restablece los valores.
  Todo autoritativo en el servidor.
- HUD con salud y escudo separados, número y barra; efectos y sonidos distintos para recoger,
  daño al escudo y escudo agotado.

Marcador:
- Tab mantenido o botón "Puntajes" del menú de pausa; no pausa la partida.
- Columnas: Puesto (1.º…), Nombre, Bajas, Muertes, Daño realizado, Puntaje, Ping, Equipo (si
  aplica) y Capturas (CTF). En vivo, ordenado por el servidor (`rankPlayers`), jugador local
  resaltado; la pantalla de resultados usa el mismo orden.
- DM: puntaje ↓, bajas ↓, muertes ↑, daño ↓, id estable. CTF: equipos, capturas, bajas, menos
  muertes, daño.
- Daño realizado = daño efectivo a enemigos: sin autodaño, entorno, aliados ni exceso (overkill).

Tests: escudo por defecto, límites, absorción y lava; daño contado una vez y sus exclusiones;
desempates DM y CTF; e2e del marcador con Tab y desde la pausa.

Criterios: typecheck, test, build, e2e en verde.
