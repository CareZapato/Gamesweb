# Arquitectura y protocolo — RealTournament

> Este documento describe **RealTournament** (antes "Arena Vértice"), el primer juego del catálogo
> de minijuegos. La sección "Catálogo y salas por juego" explica lo que es común a todos los juegos.

## Catálogo y salas por juego

```
client/index.html  ──► portal (HTML/CSS + catalog.ts, ~2 kB, sin Three.js)
client/realtournament/index.html ──► juego RealTournament (bundle propio, ~800 kB)
                    └──────────── mismo origen que el servidor Node (Express + Colyseus)
```

* **Portal** (`/`): `client/src/portal/` pinta una tarjeta por entrada de `client/src/catalog.ts`
  (id, nombre, ruta, `roomName`, estado `available | soon`). No importa nada del juego; Vite
  compila cada página como una entrada independiente (`client/vite.config.ts`).
* **Registro de juegos** (`shared/src/games.ts`): `ROOM_NAMES` asocia cada juego a su `roomName` de
  Colyseus (`realtournament`). Cada juego registra su propia clase de sala con `server.define`.
* **`GameRoom`** (`server/src/GameRoom.ts`) es la base de todas las salas:
  * Código de sala de 6 caracteres, privado, **único globalmente**: el registro de códigos
    (`roomCodes.ts`) es uno solo para todos los juegos del proceso.
  * **Validación del juego**: el cliente indica en las opciones de `create`/`joinById` el juego al
    que cree entrar (`game`). Si no coincide con el `roomName` de la sala, el servidor rechaza con
    `4303 WRONG_GAME` (el cliente lo muestra como "Ese código pertenece a otro juego"). Un cliente
    que no indica juego también se rechaza.
* Los datos del navegador llevan el nombre del juego: `localStorage` `realtournament-settings` y
  `sessionStorage` `realtournament-reconnect` (las claves antiguas `arena-vertice-*` se migran/borran
  al arrancar).

## Visión general

```
┌──────────────── navegador ────────────────┐        ┌──────────── Node.js (sin GPU/DOM) ───────────┐
│ client/  (Vite + Three.js + HTML/CSS)     │  WS    │ server/  (Colyseus 0.18 + Express 5)          │
│  main.ts      flujo de pantallas          │◄──────►│  createGameServer.ts  HTTP, WS, CORS, estático│
│  net/Net.ts   SDK Colyseus, reconexión    │ JSON/  │  ArenaRoom.ts         sala: lobby, fases,     │
│  game/Game.ts predicción, reconciliación, │ msgpack│                       validación, difusión    │
│               interpolación, render       │        │  game/GameSim.ts      simulación autoritativa │
│  render/*     mapa, personajes, efectos   │        │  roomCodes.ts         códigos de sala         │
│  audio/Sfx.ts sonido procedural WebAudio  │        └───────────────────────────────────────────────┘
│  ui/*         HUD y pantallas             │                         ▲
└───────────────────────────────────────────┘                         │ importan el mismo código
                     ▲                                                │
                     └──────────────── shared/ (TypeScript puro) ─────┘
                       constants, weapons, rules, map, world (colisión), movement,
                       combat (hitscan/proyectiles/explosiones), protocol, maps/*
```

* **`shared/`** no depende de Three.js ni del DOM. Contiene todo lo que cliente y servidor deben
  calcular igual: colisiones, movimiento, armas, proyectiles, mapas y el formato de mensajes. Así
  la predicción del cliente coincide bit a bit con el servidor cuando no hay pérdida de inputs.
* **`server/`** es la única autoridad. El anfitrión de la sala es solo un jugador con permisos de
  configuración; **no** simula nada.
* **`client/`** solo envía intenciones (botones + ángulos) y dibuja.
* No hay base de datos: las salas viven en memoria y desaparecen al vaciarse.

## Configuración centralizada

| Qué | Dónde |
|---|---|
| Tick, tasas de snapshot, límites de red, física del jugador | `shared/src/constants.ts` |
| Las 7 armas (daño, cadencia, dispersión, munición, proyectiles, explosiones, carga, ADS) | `shared/src/weapons.ts` |
| Reglas de modo (límites, puntos, bandera), pickups, duración de resultados | `shared/src/rules.ts` |
| Mapas (geometría + colisión + spawns + pickups + banderas + luces + portales + círculos de salto + lava) | `shared/src/maps/*.ts` |
| Salud y escudo iniciales/máximos, portales y círculos de salto (enfriamientos) | `shared/src/constants.ts` (`PLAYER`, `PORTAL`, `JUMP_PAD`) |
| Orden del marcador | `shared/src/rules.ts` (`rankPlayers`) |
| Ajustes del jugador (sensibilidad, FOV, volumen, calidad) | `client/src/settings.ts` (localStorage) |
| Variables del servidor | `.env` (ver `.env.example`) |

## Simulación

* **Paso fijo de 30 Hz** en el servidor (`setFixedTimestep`). Snapshots cada 2 ticks (15 Hz),
  personalizados por cliente (incluyen su estado propio completo y el último input confirmado).
* **Orden de un tick**: inputs de jugadores → proyectiles → pickups → banderas → historial para
  compensación de lag → límite de tiempo.
* **Controlador cinemático propio** (sin Rapier): el mundo son cajas AABB y rampas en cuña. El
  movimiento se resuelve por ejes con sub-pasos de 0,2 m (menor que el grosor mínimo de pared,
  0,3 m, verificado por test), con subida de escalones de 0,45 m y pegado al suelo. El dash es un
  impulso horizontal de duración fija con enfriamiento; nunca supera `maxHorizontalSpeed`.
* **Los jugadores no colisionan entre sí** (regla documentada y habitual en arena shooters; evita
  bloqueos en pasillos y simplifica la predicción).
* El mismo `stepMovement` / `stepWeapon` / `stepProjectile` corre en servidor y cliente.

## Netcode

### Inputs (cliente → servidor)

`[seq, buttons, yaw, pitch, weapon, viewTick]`, uno por tick de cliente (30/s).

* `buttons`: bits `Forward 1, Back 2, Left 4, Right 8, Jump 16, Dash 32, Fire 64, Aim 128` (máximo válido 255, derivado de `Btn`).
* `weapon`: arma deseada (el servidor aplica el tiempo de cambio).
* `viewTick`: tick de servidor que el cliente estaba viendo al disparar (para lag compensation).

Validación en servidor (`decodeInput` + `GameSim.queueInput`): tipos, rangos, enteros, ángulos
normalizados, `seq` estrictamente creciente (duplicados y reordenados se descartan), cola máxima
de 12 inputs y **créditos de input**: cada tick se gana 1 crédito (máx. 4) y cada input consume 1;
un cliente que envía más rápido que 30/s no avanza más rápido (anti speed-hack). Si un jugador no
envía nada durante 8 ticks, el servidor lo simula con un input vacío para que la gravedad y los
proyectiles sigan afectándole.

### Snapshots (servidor → cliente)

```
{ t: tick, a: último seq procesado, tl: segundos restantes,
  me: estado propio completo (posición, velocidad, dash, arma, munición, hp, maxHp, shield,
      maxShield, enfriamientos de portal y de círculo de salto, contador de viajes…),
  p:  [[id, x*100, y*100, z*100, yaw*1000, pitch*1000, flags, arma, equipo, viajes & 255], …],
  pr: [[id, arma, x*100, y*100, z*100], …],       // proyectiles
  pk: [índices de pickups no disponibles],
  fl: [[equipo, estado, x, y, z, portador, vuelveEn], …],   // CTF
  ts: [puntos rojo, puntos azul] }
```

Flags de jugador: `Alive 1, Dashing 2, OnGround 4, Carrier 8, Protected 16, Disconnected 32, Switching 64`.

### Predicción y reconciliación (jugador local)

1. Cada tick el cliente muestrea input, lo aplica localmente con `stepMovement`/`stepWeapon`, lo
   guarda en `pending` y lo envía.
2. Al llegar un snapshot, descarta los inputs con `seq <= a`, copia el estado autoritativo `me` y
   **re-simula** los pendientes.
3. La diferencia entre la predicción anterior y la nueva se absorbe con un desplazamiento visual que
   decae exponencialmente (sin tirones). Errores > 3 m se aplican de golpe.
4. El panel de red (`Esc → Mostrar FPS y red`) muestra el error de predicción medio.

### Interpolación (jugadores remotos y proyectiles)

Se dibujan **110 ms en el pasado** (`NET.interpDelayMs`) interpolando entre los dos snapshots que
rodean ese instante. El reloj de servidor se estima con un estimador de máximo (el snapshot más
"adelantado" marca el desfase), con deriva lenta hacia abajo. Si el último campo de un jugador
(contador de viajes por portal) cambia entre dos snapshots, no se interpola: se dibuja ya en la
salida, para que no "atraviese" las paredes entre los dos extremos del portal.

### Disparos

* El cliente dibuja trazadores y fogonazos al instante (predicción **solo visual**). La dispersión
  usa una semilla determinista (`hash(jugador, contador de disparos)`), así que el patrón local y el
  del servidor coinciden.
* El servidor vuelve a comprobar arma, cambio en curso, cadencia, munición, origen (ojo del
  jugador según el estado del servidor) y dirección (de sus propios yaw/pitch).
* **Compensación de lag** para hitscan: historial de 30 ticks (1 s), rebobinado máximo de 250 ms,
  interpolación entre ticks del historial, `viewTick` del futuro recortado al presente y no se
  rebobina a través de una muerte/reaparición (contador de vidas). Las paredes no se rebobinan.
* Cohetes y granadas **no** usan compensación de lag: nacen en el servidor al procesar el input y
  se simulan en tiempo real. El cliente que dispara muestra su propio proyectil predicho con el
  mismo id (`jugador*65536 + contador`) y lo oculta cuando llega la explosión autoritativa.
* Daño, muertes, puntos y banderas **solo** los decide el servidor y llegan como eventos.

### Eventos

Se agrupan por tick en un mensaje `ev` con id creciente (`e`); el cliente ignora ids ya vistos
(robusto ante reenvíos tras reconexión). Tipos: `shot, fire, hit, kill, boom, bounce, pickup, spawn,
dash, jump, flag, streak` (multi-kill, racha sin morir, racha cortada), `warp` (viaje por portal:
origen y destino) y `pad` (lanzamiento de un círculo de salto). `hit` lleva `sd` (daño absorbido
por el escudo) y `sb` (el escudo se agotó con ese golpe); `kill` lleva `cause: 'lava' | 'fall'`
en las muertes por entorno. El cliente solo reproduce efectos y sonidos a partir de ellos.

### Límites anti-abuso

* `maxMessagesPerSecond = 120` por cliente (Colyseus desconecta al que lo supera).
* `maxPayload = 64 KB` por mensaje WebSocket (era 16 KB; se subió **solo** para poder enviar una
  skin PNG de hasta 48 KB en un mensaje; el resto de mensajes pesa unos cientos de bytes).
* Skins: máximo 48 KB, validadas estructuralmente, 1 cambio por segundo y jugador, solo fuera de
  la partida (ver "Skins" más abajo y [SKINS.md](SKINS.md)).
* Acciones de lobby (listo, equipo, ajustes, iniciar) limitadas a una cada 100 ms por cliente.
* Nombres saneados (NFKC, sin caracteres de control ni HTML), máximo 16 caracteres, únicos por sala.
* `ALLOWED_ORIGINS` restringe origen en CORS de matchmaking y en el handshake WebSocket.

## Salas

* `ArenaRoom` (sala de RealTournament, registrada como `realtournament`) extiende `GameRoom`:
  privada (`setPrivate`), `roomId` = código de 6 caracteres de un alfabeto sin
  ambigüedades (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`), generado con `crypto.randomInt` y comprobado
  contra los códigos activos de **todos** los juegos (~887 millones de combinaciones). Unirse solo
  es posible conociendo el código (`joinById`) y declarando el juego correcto.
* Capacidad: 8. Errores tipados: `4301 MATCH_IN_PROGRESS`, `4302 ROOM_FULL`, `4303 WRONG_GAME`
  (código de otro juego); un código inexistente produce el error estándar de Colyseus (el cliente
  lo traduce a mensaje legible).
* Fases: `lobby → playing → results → lobby` (automático tras 20 s o con "Volver al lobby" del
  anfitrión; "Revancha" reinicia con la misma configuración).
* El anfitrión configura modo, mapa, tiempo y límite; solo puede iniciar cuando todos los demás
  jugadores conectados están listos. Si se va, el anfitrión pasa al jugador conectado más antiguo.
* **Reconexión**: al cortarse la conexión sin consentimiento, el servidor reserva el puesto
  20 s (`allowReconnection`). En partida, el jugador queda marcado como desconectado: muere sin
  penalización, suelta la bandera si la llevaba y reaparece al volver. El SDK reintenta solo; si se
  recarga la página, el cliente usa el token guardado en `sessionStorage` (válido 20 s).
* Equipos CTF: se asignan al equipo con menos jugadores; un cambio solo se acepta si no deja una
  diferencia mayor de 1. Al iniciar, el servidor rebalancea si hace falta.
* La sala se elimina cuando queda vacía (`autoDispose`) y libera su código.

## Skins y personajes

Los personajes son figuras de bloques (`client/src/render/Character.ts`) texturizadas con **un solo
PNG de 128×128 (o 256×256)** con un layout fijo (`skinLayout.ts`). Formato, validación y diagrama
en [SKINS.md](SKINS.md). Resumen técnico:

* `C2S.Skin` (`{ png: Uint8Array | null }`): el jugador envía su skin (null = quitarla). La sala
  (`ArenaRoom`) la valida con `validateSkinPng` (`server/src/skins.ts`: tamaño exacto, ≤ 48 KB,
  firma, CRC de cada chunk, flujo zlib de longitud exacta con descompresión acotada), la guarda
  **en memoria** en el `Member` y la retransmite con `S2C.Skin` (`{ id, png }`) a toda la sala. Quien
  entra o se reconecta recibe las skins ya elegidas; al salir un jugador se emite `png: null`. Una
  skin inválida solo provoca un `Notice` al emisor. No hay URLs externas ni persistencia.
* Cliente: `SkinStore` guarda los bytes por id de jugador y los decodifica con el navegador;
  `SkinTextures` crea una `DataTexture` (`NearestFilter`, sin mipmaps) por skin y color de equipo
  (los píxeles con alfa 254 se tiñen). Si no hay skin propia se usa `default_red/blue.png`.
* Las **hitboxes del servidor no cambian** (`shared/src/combat.ts`). `characterModel.ts` contiene las
  medidas del modelo y un test comprueba que la cabeza y el casco quedan dentro de `headBox` y el
  resto dentro de `bodyBox`.
* Primera persona: `ViewArms.ts` dibuja los brazos del jugador con su skin, pegados al modelo del
  arma (siguen balanceo, retroceso y cambio de arma).

## Mapas

Seis mapas en `shared/src/maps/` (el orden de `MAPS` es el del selector). Los cuatro primeros son
los de la ampliación de requisitos; Fundición Delta y Represa Gemela se conservan.

| Id | Nombre | Modos | Idea |
|---|---|---|---|
| `outpost` | Puesto Avanzado | DM, CTF | Exterior a cielo abierto (cúpula de degradado `skyTop`), terreno `ground`, muros de contención de 12 m. Mitad roja escrita una vez y espejada (bases y rutas idénticas): pasarela industrial a 4 m (armas de precisión), campo central con contenedores y núcleo elevado, corredor cubierto de contenedores (combate cercano). Azotea de cada base accesible por rampa exterior. |
| `towers` | Tres Torres | DM | Tres torres de tres niveles (5, 10 y azotea a 15) con rampas internas; puentes a 10 m por un cruce central y un puente bajo a 5 m que pasa por debajo. Cada torre: salud en el 1.º, escudo en el 2.º, munición de arma potente distinta en la azotea (francotirador, cohetes, Cuásar) y otra en planta baja. El escudo grande está en el cruce expuesto. |
| `gateways` | Pasarelas | DM | Rejilla 3×3 de celdas de 20 m: salas en las esquinas, pasillos en T en los lados y un vestíbulo central. **Puertas**: vanos rectangulares de 3 × 3,2 m con dintel de franjas de peligro (estáticas). **Portales**: discos circulares animados con aro del color del enlace, en paredes o como agujeros en el suelo; naranja (sala NO ↔ sala SE), cian (agujero del vestíbulo ↔ pared de la sala NE), magenta (agujero de la sala SO ↔ pared oeste del vestíbulo). |
| `lava` | Pozo de Lava | DM | Cilindro interior de radio 24 con lava en el fondo (volumen `hazards`). Cinco anillos (y = 3, 8, 13, 18, 23) aproximados con franjas de 3 m; cada anillo tiene salud, escudo y munición. Puentes estrechos a distintas alturas: tres cruces forman plataformas (L1 centro, L2 oeste, L4 este) y los demás pasan 4,5 m por encima o por debajo sin tocarse. Subida: un círculo de salto por anillo (L1–L4) que lanza por un hueco del anillo superior, más uno en la plataforma central que llega al puente de L2. Bajada: un hueco en cada anillo L2–L5. |
| `foundry` | Fundición Delta | DM | Mapa original de tres niveles. |
| `twin` | Represa Gemela | CTF, DM | Mapa original CTF simétrico. |

`mapSupportsMode(map, mode)` decide qué aparece en el selector y qué acepta el servidor (lobby y
`GameSim`): DM necesita ≥ 4 spawns; CTF necesita las dos banderas y ≥ 4 spawns por equipo. Un mapa
sin bases nunca puede arrancar en CTF.

**Portales** (`PortalDef`): `kind` pared/suelo, posición, cara, radio, destino (`to`), salidas en
orden de preferencia y color. Viajan **solo jugadores**; proyectiles y disparos chocan con la
pared o el suelo del portal (v1). El viaje está dentro de `stepMovement`, así que la predicción
del cliente y el servidor lo ejecutan igual y la reconciliación no devuelve al jugador al origen:
* el disparador es una losa de 0,5 m delante de la pared (o una caja sobre el agujero);
* las salidas están fuera de todo disparador, libres y con suelo (test); si una salida está ocupada
  por otro jugador se usa la siguiente y, si todas lo están, el jugador espera en el disparador;
* **regla de dirección**: al entrar por una pared, la velocidad horizontal, la dirección del dash
  y la vista giran el ángulo entre la dirección de entrada y la cara de salida (la vertical se
  conserva); al entrar por un agujero de suelo, la rapidez horizontal se redirige según la cara de
  salida, la vertical se anula y la vista mira hacia esa cara;
* bloqueo de reentrada de 0,75 s (`PORTAL.reentryCooldown`), que evita bucles instantáneos;
* el cliente gira `input.yaw` en el mismo ángulo (`warpYaw`) y corta la interpolación visual.

**Círculos de salto** (`JumpPadDef`): al pisarlos (bajando o parado) fijan la velocidad a `launch`;
es un salto físico con colisiones normales, no un teletransporte. Dirección, potencia y
enfriamiento son configurables por círculo; `target` es el punto de aterrizaje que comprueban los
tests (llega a su plataforma, sin chocar con el techo y sin atravesar paredes).

**Lava**: tocar un volumen `hazards` mata al instante con `cause: 'lava'`, ignorando el escudo.

## Salud, escudo y daño

* `PLAYER.startHealth = 100`, `maxHealth = 100`, `startShield = 0`, `maxShield = 100`
  (`shared/src/constants.ts`). Cada jugador lleva `hp/maxHp/shield/maxShield` en el servidor y en su
  estado propio. El escudo **sustituye** a la antigua armadura (un solo sistema).
* Pickups (`shared/src/rules.ts`): `health` +25 (20 s), `healthBig` +50 (30 s), `shield` +50 (25 s),
  `shieldBig` +100 (40 s), `ammo` (15 s). Nunca superan el máximo y **no se consumen** si el
  valor ya está al máximo. Visualmente: cápsula médica (roja/verde), celda hexagonal de energía
  (azul/violeta) y caja de munición con franja del color del arma.
* Daño normal: primero el escudo, el resto a la salud. La lava ignora el escudo. Al reaparecer se
  restauran los valores iniciales.
* **Daño realizado** = salud + escudo realmente quitados a enemigos (`damageDealt`): sin daño
  propio, a aliados (no se aplica en CTF), del entorno, ni la parte que sobra tras matar.
* HUD: SALUD y ESCUDO separados, con número, máximo y barra; destello azul cuando el escudo absorbe,
  temblor y aviso al agotarse; sonidos propios de recogida, impacto y rotura del escudo.

## Marcador

* `rankPlayers` (`shared/src/rules.ts`) ordena en el servidor y devuelve `rank`; el marcador en vivo
  (`S2C.Scoreboard`, con `damage` y `rank`) y los resultados usan el mismo orden y el cliente no lo
  reordena.
* DM: puntaje ↓, bajas ↓, muertes ↑, daño ↓ y por último el id del jugador (estable).
* CTF: primero los equipos por resultado (capturas del equipo), luego dentro de cada equipo:
  capturas ↓, bajas ↓, muertes ↑, daño ↓, id. El puesto se reinicia en cada equipo.
* Columnas: Puesto (1.º, 2.º…), Nombre, Equipo (CTF), Bajas, Muertes, Daño, Capturas (CTF),
  Puntaje y Ping; el jugador local resaltado. Se abre manteniendo **Tab** o con el botón
  **Puntajes** del menú de pausa (cursor liberado); la partida sigue corriendo.
* El ganador en DM sigue siendo quien tiene **más puntaje**; los desempates ordenan la tabla pero un
  empate a puntos se muestra como empate.

## Reglas

**Deathmatch**: +1 por baja; −1 por suicidio (caída, lava, explosión propia). Si alguien muere por el
entorno ≤ 5 s después de recibir daño de otro, la baja es para ese otro. Gana quien alcanza el
límite de bajas o quien más tiene al acabar el tiempo (empate posible).

**CTF**: banderas con estados explícitos `Home / Carried / Dropped`.
* Tocar la bandera enemiga en base o en el suelo → `Carried`.
* Capturar: llevarla a tu base **solo si tu bandera está en casa** (+1 al equipo, +5 al jugador).
* Muerte o desconexión del portador → `Dropped` en el suelo bajo su posición (o vuelve a casa si
  cae al vacío).
* Tocar tu propia bandera caída → vuelve a casa (+1). Si nadie la toca en 20 s → vuelve sola.
* Muerte simultánea de dos portadores en el mismo tick: ambas banderas caen; ninguna captura.
* Sin fuego amigo (ni daño ni empuje a compañeros; el daño propio sí existe).

## Armas (valores por defecto en `shared/src/weapons.ts`)

| # | Nombre | Tipo | Notas |
|---|---|---|---|
| 1 | Carabina Tormenta | hitscan automático | 0,09 s, 9 daño, dispersión 0,004→0,04 rad que crece con ráfaga |
| 2 | Dispersor Ariete | hitscan multiperdigón | 10 × 8 daño, patrón estratificado con semilla, caída 10–35 m |
| 3 | Aguja Lumen | hitscan semiautomático | 70 daño, ×2 a la cabeza, 1,3 s, mira de alcance (FOV 25) con clic derecho |
| 4 | Lanzador Cometa | proyectil recto | 28 m/s, sin gravedad, explota al impacto, radio 4 m |
| 5 | Mortero Grillo | proyectil balístico | gravedad 22, 3 rebotes, mecha 2 s, explota al tocar jugador |
| 6 | Hilo Aurora | hitscan continuo (rayo de plasma) | un rayo por tick (30/s) mientras se mantiene el disparo, 4 daño, 30 m, sin dispersión ni caída, 1 de munición por tick (120 iniciales, máx. 300) |
| 7 | Lanza Cuásar | hitscan de carga | mantener = cargar 0–1,5 s; al soltar dispara con daño 20→100 (×1,5 a la cabeza), mínimo 0,2 s (si no, se cancela sin gastar), 1 de munición por disparo (máx. 20), mira de alcance (FOV 14), movimiento ×0,55 mientras carga |

**Por qué el segundo francotirador es de carga y no de penetración.** La Aguja Lumen es instantánea
y semiautomática (un disparo cada 1,3 s sin aviso). La Lanza Cuásar cambia el rol: es lenta de
preparar y comprometida (visible por la barra de carga y el sonido, y camina más lento), pero con
daño letal a la cabeza y ritmo de decisión distinto (carga parcial = daño parcial). Se valida igual
que el resto: cadencia (`fireInterval` tras disparar), munición, origen y dirección; la carga es
estado de simulación (`PlayerSimState.charge`) y se reinicia al cambiar de arma.

**Apuntar (clic derecho, todas las armas).** Es el bit `Aim` de los botones, así que lo ve el
servidor y los efectos viven en la simulación compartida: `adsSpreadMult` multiplica la dispersión
en `stepWeapon` y `adsMoveMult` ralentiza la carrera en `stepMovement`, idénticos en cliente y
servidor. `adsFov` solo es visual (zoom suave del cliente, `min(FOV del jugador, adsFov)`). Los
francotiradores (`scoped`) muestran una mira de alcance; el resto centra el arma (pose ADS) y
afina el punto de mira. No se apunta mientras hay un cambio de arma pendiente.

**Visual de las armas.** `client/src/render/weaponLayout.ts` define las 7 armas como cajas (≤ 12
mallas por arma, geometrías compartidas, siluetas muy distintas) y un atlas de 128×128 por arma
con la misma convención de "red" por caja que las skins (1 texel = 4 cm). `WeaponModels.ts` pinta
un atlas placeholder y lo sustituye por `client/public/assets/weapons/<archivo>.png` si
`client/public/assets/weapons/manifest.json` lo indica (`null` = placeholder), igual que las
texturas del mapa.

Explosiones: daño con caída lineal desde el centro, bloqueadas por paredes (se comprueba línea de
visión a varios puntos del cuerpo), empuje radial (rocket jump posible), daño propio reducido.

## Pruebas

| Comando | Qué verifica |
|---|---|
| `npm test` | 192 tests. `tests/maps.test.ts` cubre la ampliación: recorrido completo de los cuatro mapas nuevos con el movimiento real (desde el primer y el último spawn se alcanzan todos los pickups, banderas y spawns; en el Pozo de Lava, los cinco niveles), filtro de mapas por modo, recursos de las tres torres, portales (salidas libres y fuera de disparadores, sin bucles, nunca dentro de geometría, regla de dirección, bloqueo de reentrada, salida ocupada, proyectiles no viajan), predicción con 6 ticks de latencia a través de un portal y de un círculo de salto sin retroceso, trayectorias de los círculos, lava y respawn, escudo (absorción, tope, pickup no consumido al máximo), daño realizado contado una vez y desempates del marcador. Además (incluye armas nuevas: plasma por tick, rango, lag comp y sin daño a compañeros en CTF; carga del francotirador; bit Aim idéntico en cliente y servidor; layout de armas ≤ 12 mallas sin solapes en el atlas; layout de skins sin solapes, modelo dentro de las hitboxes, validación de PNG en el servidor y retransmisión de skins con servidor real): física y mapas, proyectiles y explosiones, simulación de partida (armas, munición, cadencia, flood de inputs, lag comp, pickups, DM, CTF completo, desconexiones) e integración con servidor Colyseus real (códigos, unión, inicio, estado compartido, sala llena/en curso/inexistente, traspaso de anfitrión, reconexión con token, fin y vuelta a lobby) y aislamiento entre juegos (código de un juego rechazado desde otro `roomName` y viceversa, códigos únicos globalmente). |
| `npm run test:e2e` | 54 comprobaciones (incluye marcador con Tab y botón Puntajes en la pausa sin detener la partida, HUD de salud y escudo,  clic derecho → FOV y bit Aim en el servidor, plasma con consumo por tick, carga de la Lanza Cuásar con barra y mira de alcance; `E2E_WEAPON_SHOTS=1` guarda capturas `w1…w7-hip/ads.png` de las 7 armas) con dos navegadores reales (Chrome/Edge instalado, headless): portal (tarjetas, sin bundle del juego) → tarjeta RealTournament → menú → crear → unirse → cargar skins distintas (256 y 128 px; una de tamaño incorrecto se rechaza) → listo → partida DM (jugadores cara a cara con sus skins, capturas en `e2e-artifacts/05b-*` y `05c-*`) → movimiento con Pointer Lock → ver al otro → disparo y munición → cambio de arma → resultados → lobby → CTF → traspaso de anfitrión, sin errores JS. Requiere `npm run build` antes. `E2E_LAG_MS=80` añade latencia artificial. |

## Limitaciones conocidas

* Mensajes de red sin Schema de Colyseus (JSON compacto con cuantización simple); suficiente para
  8 jugadores pero no optimizado por deltas.
* Lag compensation solo para hitscan; los proyectiles se ven con la latencia real.
* Sin colisión jugador-jugador (decisión de diseño). La única excepción es la ocupación de las
  salidas de portal, que el cliente estima con las posiciones interpoladas (puede diferir del
  servidor un tick; la reconciliación lo corrige).
* Portales v1: solo jugadores; la superficie es animada, no muestra el otro lado.
* Las puertas de Pasarelas son vanos estáticos (no se abren ni cierran), para no complicar la
  predicción. Las "armas" de los mapas son pickups de munición específica: todas las armas
  están en el equipamiento inicial.
* Mapas en versión de geometría simple (cajas y rampas): el cilindro de lava se aproxima con
  franjas escalonadas.
* Un solo proceso de servidor: las salas no se reparten entre varias máquinas (Colyseus lo permite
  con Redis, no configurado).
* Rendimiento solo medido en navegador headless con renderizado por software; falta medir en GPU
  integrada real.
