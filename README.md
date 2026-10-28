# Minijuegos online · RealTournament

Catálogo de minijuegos web multijugador. En `/` hay un **portal** ligero (HTML/CSS) con una tarjeta
por juego; cada juego vive en su propia ruta y sus salas están aisladas del resto. El primer juego
es **RealTournament** (antes "Arena Vértice"), en `/realtournament/`, y hay dos tarjetas
"Próximamente" de ejemplo.

## RealTournament

Shooter de arena en primera persona para navegador, multijugador online con servidor
autoritativo. Inspirado en el ritmo de los arena shooters de finales de los 90, con nombres,
mapas, armas, sonidos y estética **originales** (todo el arte actual es geometría y texturas
procedurales generadas en código; los sonidos se sintetizan con WebAudio).

* Modos: **Deathmatch** (todos contra todos) y **Captura la bandera** (rojo vs azul).
* Mapas: **Puesto Avanzado** (arena exterior, DM y CTF), **Tres Torres** (DM), **Pasarelas**
  (DM, puertas y portales de colores), **Pozo de Lava** (DM, cilindro de cinco niveles con
  círculos de salto), además de **Fundición Delta** (DM) y **Represa Gemela** (CTF y DM). El lobby
  solo ofrece en CTF los mapas con bases, banderas y spawns por equipo.
* 7 armas (incluye un rayo de plasma continuo y un francotirador de carga), apuntar con clic derecho en todas, salto, dash, **salud y escudo** (el escudo absorbe el daño primero; la lava lo ignora), munición, salas privadas por código de hasta 8 jugadores.
* Marcador en vivo ordenado por el servidor (Puesto, Nombre, Bajas, Muertes, Daño realizado,
  Puntaje, Ping; Equipo y Capturas en CTF): **Tab** mantenido o botón **Puntajes** del menú de
  pausa. No pausa la partida.
* Personajes de bloques (casco con visor, pechera, hombreras) **texturizables con un único PNG**
  (128×128 o 256×256): cada jugador puede cargar su skin en el lobby. Formato y plantilla en
  [docs/SKINS.md](docs/SKINS.md).

> Estado: prototipo jugable y probado automáticamente (ver "Qué está verificado"). **No** está
> validado para producción: falta medir rendimiento en GPU real y probar con jugadores en Internet.

## Requisitos

* Node.js **22.12 o superior** (probado con 22.16) y npm 10.
* Un navegador de escritorio con WebGL2 (Chrome, Edge, Firefox).

## Instalación y uso

```bash
npm install          # instala los tres paquetes del monorepo (shared, server, client)
npm run dev          # servidor de juego en :2567 + cliente Vite en :5173 (Ctrl+C para parar)
```

Abre `http://localhost:5173` (portal), pulsa **Jugar** en la tarjeta de RealTournament (o ve directo a
`http://localhost:5173/realtournament/`), escribe un apodo y pulsa **Crear sala**. Comparte el código de 6
caracteres (botón **Copiar**). Para probar solo, abre una segunda pestaña o ventana y únete con
ese código. El anfitrión puede iniciar solo si no hay nadie más (útil para explorar el mapa).

### Otros comandos

| Comando | Qué hace |
|---|---|
| `npm run dev:server` / `npm run dev:client` | Lanza cada parte por separado |
| `npm run typecheck` | Comprueba tipos de `shared`, `server` y `client` |
| `npm test` | Pruebas unitarias + integración con servidor real (192 tests; el recorrido completo de los mapas tarda ~1 min) |
| `npm run skins:template` | Regenera `template.png`, `default_red.png` y `default_blue.png` en `client/public/assets/skins/` |
| `npm run weapons:template` | Escribe `template_<arma>.png` (atlas 128×128 de cada arma) en `client/public/assets/weapons/` |
| `npm run build` | Compila el cliente en `client/dist` (portal y cada juego en bundles separados) |
| `npm start` | Servidor de producción: portal + juegos + WebSocket en `http://localhost:2567` |
| `npm run test:e2e` | Prueba con dos navegadores reales (requiere `npm run build` y Chrome o Edge instalado) |
| `npm run maps:shots` | Arranca una partida en cada mapa, toma capturas desde varios puntos (`e2e-artifacts/maps/`) y falla ante errores de página o de shaders |

### Jugar en red local

`npm run dev` escucha en todas las interfaces. Desde otro equipo de la LAN abre
`http://<IP-de-tu-PC>:5173` (Vite muestra la IP en la consola). El cliente se conecta solo al
puerto 2567 de esa misma IP. Puede que tengas que permitir los puertos 5173 y 2567 en el
cortafuegos. Para algo más estable: `npm run build && npm start` y abre `http://<IP>:2567`.

En Internet hace falta HTTPS/WSS y un servidor persistente: ver [docs/DEPLOY.md](docs/DEPLOY.md)
(incluye la guía para **Render**, con un `render.yaml` listo).

### Parámetros de URL (en `/realtournament/`)

| Parámetro | Efecto |
|---|---|
| `?room=ABC234` | Rellena el código de sala (también vale `#ABC234`) |
| `?server=https://host:puerto` | Usa otro servidor de juego |
| `?lag=80` | Retraso artificial de 80 ms por sentido en este cliente (pruebas de red) |
| `?debug` | Expone `window.__arena` (solo lectura) para pruebas automatizadas |

El portal (`/`) reenvía `debug`, `lag` y `server` al juego que abre.

### Añadir un juego al catálogo

1. Entrada nueva en `client/src/catalog.ts` (id, nombre, ruta, `roomName`, estado): el portal la
   dibuja solo, sin tocar su código.
2. Página del juego en `client/<ruta>/index.html` y su entrada en `client/vite.config.ts`
   (`build.rollupOptions.input`), para que tenga su propio bundle.
3. Su `roomName` en `shared/src/games.ts` y su clase de sala (que extienda `GameRoom`) registrada
   en `server/src/createGameServer.ts`. `GameRoom` ya aporta códigos únicos globalmente y rechaza
   (`WRONG_GAME`) a quien entre con el código de otro juego.

Latencia simulada en el servidor: pon `SIMULATE_LATENCY_MS=150` en `.env` (copia de `.env.example`)
y reinicia `npm run dev`.

## Controles

| Acción | Tecla |
|---|---|
| Moverse | WASD (o flechas) |
| Apuntar / disparar | Ratón / clic izquierdo |
| Apuntar (todas las armas; mira de alcance en Aguja Lumen y Lanza Cuásar) | Clic derecho (mantener) |
| Saltar | Espacio |
| Dash | Shift (corto, con enfriamiento: barra "DASH") |
| Armas | 1–7 o rueda (Hilo Aurora: mantener disparo; Lanza Cuásar: mantener para cargar y soltar para disparar) |
| Marcador | Tab (mantener) |
| Menú y ajustes | Esc (libera el ratón; la partida sigue) |

En el menú de pausa: **calidad gráfica** (preset), sensibilidad, campo de visión, volumen,
resolución máxima, partículas, sombras, limitar a 60 FPS, invertir eje Y y panel de FPS/red.
Se guardan en el navegador.

### Presets de calidad gráfica

| Preset | Qué hace (resumen) |
|---|---|
| **Baja** (por defecto) | Pixel ratio ≤ 1, sin antialias ni sombras, texturas 128 px, materiales Lambert en el mapa, sin luces puntuales del nivel, niebla más cercana, sin tone mapping ACES, partículas y trazadores reducidos, personajes Lambert, tope 60 FPS, pausa de render con pestaña oculta. |
| **Media** | Similar al equilibrio anterior: StandardMaterial, texturas 256 px, luces del mapa, antialias, tone mapping ACES, pixel ratio 1,25. |
| **Alta** | Sombras, partículas altas, pixel ratio 1,5, anisotropía 8. |
| **Personalizada** | Los controles sueltos (pixel ratio, partículas, sombras, 60 FPS) mandan; el antialias solo cambia al **recargar la página**. |

## Configuración

* Servidor: copia `.env.example` a `.env` (puerto, interfaz, orígenes permitidos, latencia simulada).
  No hay secretos ni base de datos.
* Cliente: `client/.env.example` (`VITE_SERVER_URL`, solo si el cliente se publica en otro dominio).
* Los ajustes del jugador se guardan en `localStorage` (`realtournament-settings`; la clave antigua
  `arena-vertice-settings` se migra sola) y el token de reconexión en `sessionStorage`
  (`realtournament-reconnect`).
* Armas: `shared/src/weapons.ts`. Reglas y pickups: `shared/src/rules.ts`. Física y red:
  `shared/src/constants.ts`. Mapas: `shared/src/maps/`. Todo se comparte entre cliente y servidor.

## Estructura

```
shared/   lógica común sin DOM: colisión, movimiento, armas, proyectiles, mapas, protocolo, registro de juegos
server/   Colyseus + Express: salas (GameRoom base + ArenaRoom de RealTournament), simulación a 30 Hz
client/   Vite multipágina:
            index.html + src/portal/ + src/catalog.ts   portal (sin Three.js)
            realtournament/index.html + src/*           juego: predicción, render, HUD, audio, menús
tests/    vitest (unitarias + integración) y e2e/ (navegador real con playwright-core)
docs/     arquitectura y protocolo, skins, despliegue, prompts de assets
scripts/  dev.mjs y generador de la plantilla y skins por defecto (npm run skins:template)
render.yaml   Blueprint de Render (un único Web Service)
```

## Documentación

* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura, protocolo de red, netcode, reglas, límites.
* [docs/SKINS.md](docs/SKINS.md) — formato de skin (PNG 128×128 / 256×256), layout con diagrama,
  color de equipo, validación y límites.
* [docs/DEPLOY.md](docs/DEPLOY.md) — despliegue con HTTPS/WSS (Render, Caddy, Nginx, systemd).
* [docs/ASSET_PROMPTS.md](docs/ASSET_PROMPTS.md) — prompts para generar texturas y referencias de
  personajes y armas, y cómo sustituir los placeholders.

## Qué está verificado

Automáticamente, en esta máquina (Windows, Node 22.16):

* `npm run typecheck` y `npm run build` sin errores.
* `npm test`: 129/129. Incluye armas nuevas (plasma por tick, rango, lag comp, sin daño a compañeros en CTF;
  carga del francotirador; bit Aim idéntico en cliente y servidor), layout de armas (≤ 12 mallas, atlas sin solapes), layout de skins (regiones sin solapes y dentro de la imagen a 128 y 256 px),
  modelo visual dentro de las hitboxes, validación de PNG en el servidor (tamaño, formato, peso, CRC,
  zlib), retransmisión de skins con servidor real, aislamiento de salas por juego (un código de RealTournament no
  permite entrar desde otro `roomName`, y viceversa; códigos únicos entre juegos), movimiento y dash sin atravesar paredes, cadencia y munición
  validadas, rechazo de flood de inputs, cohete recto sin caída y granada balística, explosiones
  bloqueadas por paredes, bajas y reapariciones, flujo CTF completo (tomar, soltar, devolver,
  auto-retorno, capturar, desconexión del portador, muerte simultánea), lag compensation y
  servidor Colyseus real (salas, errores, traspaso de anfitrión, reconexión, fin de partida).
* `npm run test:e2e`: 48/48 (incluye clic derecho/ADS con el bit Aim recibido por el servidor, plasma, carga y mira de alcance;
  `E2E_WEAPON_SHOTS=1` guarda capturas de las 7 armas; incluye dos skins distintas de 256 y 128 px; capturas en
  `e2e-artifacts/05b-*` y `05c-*`) con dos navegadores headless reales (entrando por el portal y la
  tarjeta de RealTournament; comprueba que el portal no descarga el bundle del juego), también con
  80 ms de latencia artificial por sentido (error de predicción medido: 0 cm).
* `npm run build` genera bundles separados: portal ≈ 2 kB, juego ≈ 800 kB.
* Servidor de producción local (`PORT=10099 npm start`): `/health`, `/`, `/realtournament/` y
  estáticos responden bien.

**No verificado** (pendiente de prueba manual): **despliegue real en Render** (`render.yaml` se
escribió contra la documentación oficial pero no se ha desplegado), sensación de juego con ratón
real, rendimiento en GPU integrada a 1080p (el e2e usa render por software), audio a oído, partidas
con 8 jugadores, conexiones por Internet reales y navegadores distintos de Chromium.

## Licencias de recursos

No se ha descargado ningún recurso de terceros: texturas procedurales en
`client/src/render/textures.ts`, sonidos sintetizados en `client/src/audio/Sfx.ts`, modelos
construidos con primitivas en `client/src/render/`, plantilla y skins por defecto generadas por
código (`scripts/skins.ts`). Dependencias npm con licencias MIT/Apache-2.0
(Three.js, Colyseus, Vite, Express, Vitest, playwright-core).
