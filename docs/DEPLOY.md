# Despliegue con HTTPS / WSS

## Lo importante primero

**Un hosting estático (GitHub Pages, Netlify estático, un bucket S3…) no basta.** El cliente es
estático, pero el juego necesita un **proceso Node.js persistente** que mantenga conexiones
WebSocket abiertas durante toda la partida y simule a 30 ticks/s. Hace falta una máquina o servicio
que ejecute procesos de larga duración y acepte WebSockets: un VPS, un contenedor (Fly.io,
Railway, Render "web service", etc.) o un servidor propio.

Funciones serverless de corta duración (Lambda, Vercel Functions…) **no sirven** para el servidor.

Si la página se sirve por HTTPS, el navegador exige **WSS** (WebSocket cifrado) para el juego.

## Render (render.com)

Un único **Web Service** Node sirve el portal (`/`), los juegos (`/realtournament/`) y el
WebSocket de Colyseus en el mismo origen, así que no hay CORS ni URL de servidor que configurar.
El repositorio incluye el Blueprint [`render.yaml`](../render.yaml); sus campos se contrastaron con la
[especificación oficial](https://render.com/docs/blueprint-spec).

### Pasos

1. Sube el repositorio a GitHub, GitLab o Bitbucket.
2. En el Dashboard de Render: **New → Blueprint**, elige el repositorio (Render lee `render.yaml`
   de la raíz) y confirma. Render compila y arranca el servicio.
3. Abre `https://<nombre>.onrender.com`: portal → **Jugar** en RealTournament. Comprobación:
   `https://<nombre>.onrender.com/health` devuelve `{"ok":true,"uptime":N}`.

Sin Blueprint (New → Web Service) usa los mismos valores:

| Campo | Valor |
|---|---|
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Variable `NODE_VERSION` | `22` |
| Variable `ALLOWED_ORIGINS` | Opcional: el servidor usa `RENDER_EXTERNAL_URL` solo si está vacía |

### Cómo encaja con el servidor

* Render asigna el puerto en `PORT` (10000 por defecto); el servidor usa `process.env.PORT` y escucha
  en `0.0.0.0` (`HOST` por defecto), que es lo que Render necesita para enrutar el tráfico.
* `NODE_ENV=production` solo se define **en tiempo de ejecución** en Render, así que `npm ci` del
  build instala también las dependencias de desarrollo (Vite) y `npm run build` funciona.
  `tsx`, que ejecuta el servidor, es una dependencia normal.
* `NODE_VERSION=22` fija la versión con la que se prueba el proyecto (`engines`: `>=22.12.0`); sin
  ella, los servicios nuevos usan la versión por defecto de Render, que es más reciente.
* **WSS es automático**: Render termina TLS y sirve la página por HTTPS. El cliente usa el origen
  de la página, y el SDK de Colyseus convierte `https://` en `wss://`.
* **`ALLOWED_ORIGINS`**: `render.yaml` lo rellena con la URL pública del servicio
  (`RENDER_EXTERNAL_URL`, `https://<nombre>.onrender.com`). Si añades un dominio propio, **agrégalo**
  en el Dashboard (lista separada por comas, p. ej. `https://<nombre>.onrender.com,https://juego.ejemplo.com`);
  si no, el servidor rechazará el WebSocket desde ese dominio.
* Una sola instancia: las salas viven en memoria de un proceso, no escales a varias instancias.
* Región: por defecto `oregon`; descomenta `region:` en `render.yaml` (p. ej. `frankfurt`) para
  acercarla a tus jugadores. No se puede cambiar después de crear el servicio.

### Limitaciones del plan gratuito (`plan: free`)

Según la [documentación de Render](https://render.com/docs/free):

* **Se duerme tras 15 minutos sin tráfico entrante** (cuenta tanto HTTP como mensajes de WebSocket
  de conexiones abiertas). El juego envía un ping cada segundo mientras haya una pestaña abierta,
  así que una sala con jugadores conectados mantiene el servicio despierto; con todos fuera, se duerme.
* **La primera conexión tras dormirse es lenta**: tarda en torno a un minuto en volver a arrancar
  (Render muestra una página de carga al navegador).
* **Las partidas se pierden al reiniciar**: las salas están solo en memoria. Se pierden al dormirse,
  en cada redeploy y cuando Render reinicia el servicio (puede hacerlo en cualquier momento).
  Al volver, el código de sala ya no existe.
* Recursos reducidos (0,1 CPU y 512 MB según la documentación de Render). La simulación a 30 Hz no se
  ha medido en esa CPU: si notas tirones con varias salas, sube de plan en `render.yaml` (p. ej. `plan: 0.5c-512mb`; los
  identificadores válidos están en la [especificación del Blueprint](https://render.com/docs/blueprint-spec)).
* 750 horas de instancia gratuitas al mes por workspace; al agotarlas, Render suspende los servicios
  gratuitos hasta el mes siguiente.

> **No verificado**: el despliegue real en Render no se ha probado desde este repositorio (no hay
> acceso a una cuenta). Lo comprobado en local es `npm ci --dry-run`, `npm run build` y
> `PORT=… npm start` con `/health`, `/` y `/realtournament/` respondiendo.

## Opción A (recomendada): un solo proceso sirve cliente + juego

El servidor ya sirve `client/dist` como estático, así que página, matchmaking y WebSocket
comparten origen y no hay CORS que configurar.

```bash
git clone <repo> arena && cd arena
npm ci
npm run build                 # genera client/dist
cp .env.example .env          # edita PORT / ALLOWED_ORIGINS si quieres
PORT=2567 HOST=127.0.0.1 npm start
```

Delante, un proxy inverso termina TLS y reenvía HTTP y WebSocket al puerto 2567.

### Caddy (certificado automático de Let's Encrypt)

```caddyfile
juego.ejemplo.com {
    reverse_proxy 127.0.0.1:2567
}
```

Caddy reenvía las cabeceras `Upgrade` de WebSocket automáticamente.

### Nginx

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    listen 443 ssl http2;
    server_name juego.ejemplo.com;
    ssl_certificate     /etc/letsencrypt/live/juego.ejemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/juego.ejemplo.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:2567;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;     # no cortar WebSockets inactivos
    }
}
```

### Mantener el proceso vivo

systemd (`/etc/systemd/system/arena.service`):

```ini
[Unit]
Description=Minijuegos online (RealTournament) game server
After=network.target

[Service]
WorkingDirectory=/opt/arena
ExecStart=/usr/bin/npm start
Environment=PORT=2567 HOST=127.0.0.1 ALLOWED_ORIGINS=https://juego.ejemplo.com
Restart=always
User=arena

[Install]
WantedBy=multi-user.target
```

`sudo systemctl enable --now arena`. Comprobación: `curl https://juego.ejemplo.com/health`.

## Opción B: cliente en un CDN estático, servidor aparte

1. Servidor en `https://api.ejemplo.com` (como en la opción A, con proxy y TLS).
2. `ALLOWED_ORIGINS=https://juego.ejemplo.com` en el servidor (CORS de matchmaking y origen del
   WebSocket).
3. Compila el cliente apuntando al servidor:
   `VITE_SERVER_URL=https://api.ejemplo.com npm run build` y publica `client/dist` en el CDN.
   (El SDK convierte `https://` en `wss://` automáticamente.)

Alternativa sin recompilar: `https://juego.ejemplo.com/?server=https://api.ejemplo.com`.

## Notas operativas

* **Estado en memoria**: reiniciar el proceso cierra todas las salas. Las partidas son cortas y no
  hay progreso que perder, pero conviene desplegar fuera de horas de juego.
* **Un proceso, una máquina**: suficiente para muchas salas de 8 jugadores (cada sala es ligera),
  pero no está medido a escala. Para varias máquinas haría falta el `RedisPresence`/`RedisDriver`
  de Colyseus y afinidad de sesión en el balanceador; no está configurado.
* **Latencia**: el juego tolera bien 50–150 ms. Despliega la región cerca de los jugadores.
* **Sin secretos**: no hay claves ni base de datos. `ALLOWED_ORIGINS` es la única configuración de
  seguridad relevante; déjala vacía solo en desarrollo o LAN.
* El servidor responde `GET /health` → `{"ok":true,"uptime":N}` para monitorización.
* Contenedor: cualquier imagen `node:22-alpine` con `npm ci && npm run build` y `npm start`
  funciona; expón el puerto `PORT`. No se incluye Dockerfile verificado.
