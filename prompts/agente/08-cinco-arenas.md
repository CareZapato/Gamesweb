Lee `docs/ARCHITECTURE.md` (sección "Mapas"), `shared/src/map.ts`, `shared/src/maps/*.ts`,
`shared/src/movement.ts`, `tests/physics.test.ts` y `tests/maps.test.ts`. Responde en español.

Objetivo: **cuatro mapas originales** con la estructura de datos compartida (cajas + rampas =
visual y colisión; portales, círculos de salto y lava en `shared`, validados por el servidor).
Foundry y Twin Dam se conservan; los nuevos van primero en `MAPS`.

Requisitos comunes:
- Colisiones autoritativas, spawns seguros (libres y orientados a espacio abierto), pickups que
  reaparecen y rutas que no dejan atrapado a nadie.
- Selector del lobby filtrado por modo (`mapSupportsMode`): CTF nunca arranca sin bases, banderas
  y rutas (el servidor lo rechaza aunque el cliente lo pida).
- ≤ 250 cajas y ≤ 4 luces puntuales por mapa.

Mapas:
1. **Puesto Avanzado** (`outpost`, DM + CTF): exterior con cielo y terreno (`ground`), estructuras
   industriales, alturas y coberturas; CTF simétrico con el patrón de espejo de `helpers.ts`.
2. **Tres Torres** (`towers`, DM): niveles transitables, puentes y rutas verticales; armas
   (munición), cápsulas de salud y escudos en cada torre sin que ninguna concentre ventaja.
3. **Pasarelas** (`gateways`, DM): puertas (vanos estáticos con dintel) distinguibles de portales;
   portales en pared o suelo con color por enlace, salidas seguras, regla de dirección coherente y
   bloqueo de reentrada; el servidor valida el viaje y el cliente solo reproduce efectos; solo
   viajan jugadores (no proyectiles) en v1.
4. **Pozo de Lava** (`lava`, DM): lava letal (ignora el escudo); ≥ 5 niveles con pasarelas
   perimetrales con armas, salud, escudo y munición; puentes estrechos que se cruzan y que no; sin
   suelo de seguridad; círculos de salto físicos (dirección, potencia y enfriamiento
   configurables) con aterrizajes útiles y sin chocar con techos; todos los niveles alcanzables.

Tests (`tests/maps.test.ts`): alcanzabilidad por búsqueda con la simulación compartida desde el
primer y el último spawn; filtrado por modo; simetría CTF; equilibrio de torres; salidas,
dirección, enfriamiento y salida ocupada de portales; predicción del cliente igual al servidor con
latencia; trayectorias de los círculos de salto; muerte por lava y reaparición.

Capturas: `npm run maps:shots` (falla si hay errores de página o de shader).

Criterios: typecheck, test, build, e2e en verde.
