Lee `README.md` y `docs/ARCHITECTURE.md` antes de empezar. Responde en español.

Objetivo: convertir este proyecto en un **catálogo de minijuegos web** donde este shooter es el
primer juego, llamado **RealTournament** (hoy se llama "Arena Vértice": renómbralo en UI, títulos,
README, docs y claves de localStorage/sessionStorage, migrando los ajustes guardados).

1. **Portal principal** (`/`): página estilo selector de minijuegos, con tarjetas grandes
   (miniatura, nombre, descripción corta, jugadores 1–8, botón "Jugar"). RealTournament es la
   única tarjeta activa; añade 2 tarjetas "Próximamente" deshabilitadas como ejemplo. Estética
   arcade limpia, ligera (HTML/CSS, sin Three.js en el portal).
2. **Estructura multi-juego**: Vite multipágina o rutas; el juego vive en `/realtournament/`. El
   portal no debe cargar el bundle del juego (comprobar con `npm run build` que hay chunks separados).
   Crea un registro `client/src/catalog.ts` (id, nombre, ruta, roomName, estado) para añadir juegos
   futuros sin tocar el portal.
3. **Salas aisladas por juego**: cada juego registra su propio `roomName` en Colyseus
   (`realtournament`). Los códigos de sala deben incluir o validar el juego: unirse con un código
   de otro juego debe dar error claro. Los códigos de sala siguen siendo únicos globalmente. Añade
   test de integración: un código de RealTournament no permite entrar desde otro roomName.
4. **Despliegue en Render** (render.com) como un único *Web Service* Node (sirve portal, juego y
   WebSocket en el mismo origen): crea `render.yaml` (buildCommand `npm ci && npm run build`,
   startCommand `npm start`, healthCheckPath `/health`, variable `NODE_VERSION=22`), asegúrate de que
   el servidor usa `process.env.PORT` y escucha en `0.0.0.0`. Documenta en `docs/DEPLOY.md` la
   sección Render: plan gratuito se duerme tras inactividad (primera conexión lenta, partidas se
   pierden al reiniciar), WSS es automático con HTTPS, `ALLOWED_ORIGINS` con la URL de Render.
   No inventes opciones de `render.yaml`: verifica la documentación oficial antes.
5. Actualiza la prueba `tests/e2e/browser.e2e.ts` para entrar por el portal y hacer clic en
   RealTournament.

Criterios: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` en verde. Informa qué
verificaste y qué no (el despliegue real en Render no puedes probarlo: dilo).
