Lee `client/realtournament/index.html`, `client/src/style.css` y `client/src/ui/Hud.ts`. Responde en español.
No cambies la simulación ni el protocolo.

Objetivo: HUD más claro y con iconos.

1. **Iconos de armas**: crea SVG originales, minimalistas, monocromos (silueta lateral en un trazo
   limpio) en `client/public/assets/icons/weapons/<id>.svg` para todas las armas, usando
   `currentColor` para poder teñirlos. Úsalos en la barra de armas, el killfeed (icono en vez del
   nombre) y la tabla de resultados.
2. Barra de armas inferior: icono + tecla + munición; actual resaltada con el color de acento;
   no poseídas atenuadas (si existen pickups de armas); munición baja en rojo parpadeante.
3. Salud y escudo con barras además del número; destello al recibir daño; aviso de salud baja.
4. Mira personalizable en ajustes (punto, cruz, círculo; color; tamaño) guardada en localStorage.
5. Indicadores de banderas CTF con iconos y flecha hacia la bandera cuando está fuera de pantalla.
6. Escalado del HUD (80–130 %) en ajustes; legible a 1366×768 y 1920×1080.
7. Debe quedar listo para reemplazar los SVG por PNG de `docs/prompts/` (ver prompt 09): carga
   desde `client/public/assets/icons/manifest.json`.

Criterios: typecheck, build y e2e en verde; adjunta capturas del HUD en DM y CTF.
