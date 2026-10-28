# Prompt maestro — Reducto: Horda (v0.1.0)

Usa este texto **solo** si quieres un agente que planifique y ejecute por fases. Para ahorrar, es **más barato** ejecutar los archivos `01`…`07` en chats separados.

---

Implementa el segundo minijuego **Reducto: Horda** (`deadhold`) en la rama `otro-juego`, siguiendo `docs/games/deadhold/ANALISIS.md` y las reglas de `prompts/0.1.0/00-reglas-economia.md`.

**Restricciones**

- Mismo motor que RealTournament: `shared` simulación, Colyseus, Three.js, texturas existentes.
- Endless por oleadas: contador de **nivel superado**, tienda entre oleadas, escalado numérico de cantidad y stats.
- v0.1.0: un mapa `holdout`, 3–5 tipos de zombie (escala/forma), sin arte PNG nuevo.
- No romper RealTournament; tests actuales en verde.

**Plan de ejecución**

Ejecuta en orden las fases descritas en:

1. `prompts/0.1.0/01-catalogo-y-rutas-composer.md`
2. `prompts/0.1.0/02-mapa-holdout-composer.md`
3. `prompts/0.1.0/03-shared-oleadas-sonnet.md`
4. `prompts/0.1.0/04-servidor-deadhold-sonnet.md`
5. `prompts/0.1.0/05-cliente-hud-composer.md`
6. `prompts/0.1.0/06-enemigos-visuales-composer.md`
7. `prompts/0.1.0/07-integracion-y-tests-sonnet.md`

Tras **cada** fase: `npm run typecheck && npm test && npm run build`, commit `deadhold: <fase>`.

**Modelo por fase**: Composer para 01, 02, 05, 06; Sonnet para 03, 04, 07.

Comienza por la fase 01 y no avances hasta que build y tests pasen.
