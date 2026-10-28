Lee `README.md` y `docs/ARCHITECTURE.md`. Responde en español. Solo toca el cliente
(`client/`), no cambies la simulación compartida.

Objetivo: que el juego funcione bien en equipos modestos.

1. **Calidad por defecto = Baja.** Añade en ajustes un selector de preset `Baja / Media / Alta`
   (más los ajustes sueltos actuales). Baja: pixel ratio 0.75 o 1, sin antialias, sin sombras,
   partículas bajas, luces puntuales desactivadas (solo hemisférica + direccional), niebla más
   cercana, sin tone mapping costoso, texturas 128 px, anisotropía 1. Migra ajustes guardados: si
   el usuario nunca eligió preset, aplica Baja.
   El antialias del `WebGLRenderer` solo se puede fijar al crearlo: aplica el cambio al recargar y
   avísalo en la UI.
2. **Optimizaciones** (mide antes y después con el panel de red: FPS y draw calls):
   - Materiales del mapa con `MeshLambertMaterial` en Baja (en vez de `MeshStandardMaterial`).
   - Personajes: geometrías y materiales compartidos entre jugadores; `InstancedMesh` para pickups.
   - Limitar a 60 FPS opcional, y pausar el render con la pestaña oculta (sin parar la red).
   - Revisar asignaciones por frame en `Game.ts` (vectores nuevos en `render`, `Map` nuevos en
     interpolación) y reutilizarlas.
   - Effects: reducir el pool en Baja; partículas como `Points` con tamaño fijo.
   - Viewmodel: escena separada sin luces dinámicas en Baja.
3. Documenta en `README.md` los presets y qué cambia cada uno.

Criterios: typecheck, test, build y e2e en verde; reporta draw calls en Fundición Delta antes y
después (desde el panel de red en la prueba e2e). No afirmes FPS en GPU real si no lo mediste.
