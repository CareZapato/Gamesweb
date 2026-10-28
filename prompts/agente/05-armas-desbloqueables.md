Lee `README.md`, `docs/ARCHITECTURE.md`, `shared/src/rules.ts` y `server/src/game/GameSim.ts`.
Responde en español.

Objetivo: no entregar todas las armas al aparecer; se consiguen **durante la partida** recogiéndolas
en el mapa (estilo arena clásico). Sin progresión entre partidas ni cuentas.

1. Al aparecer: solo el arma inicial (la carabina) con munición base. Las demás se marcan como no
   poseídas (`owned` en el estado de simulación compartido; se reinicia al morir).
2. **Pickups de arma** en los mapas (`kind: 'weapon'`, `weapon: WeaponId`): dan el arma y munición
   inicial; si ya la tienes, solo munición. Tiempo de reaparición configurable por arma en
   `rules.ts`. Las armas potentes (cohetes, francotiradores, plasma) en posiciones expuestas o de
   riesgo. Añádelos a todos los mapas existentes.
3. El servidor rechaza cambiar a un arma no poseída (y la predicción del cliente también, misma
   función compartida). El HUD muestra las armas no poseídas atenuadas; las teclas de armas no
   poseídas no hacen nada; la rueda las salta.
4. Modelo del pickup: el arma flotando y girando sobre un pedestal, con el color de acento del
   arma (usa los modelos de `WeaponModels.ts` a escala, con instancias compartidas).
5. Opción de sala para el anfitrión: "Armas: recoger en el mapa (por defecto) / todas desde el
   inicio".
6. Tests: aparecer solo con carabina; recoger da arma y munición; recoger ya poseída solo
   munición; no se puede seleccionar arma no poseída (ni forzando el input); al morir se pierden.

Criterios: typecheck, test, build, e2e en verde (ajusta el e2e que cambia a la tecla 4).
