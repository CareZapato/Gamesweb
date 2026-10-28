Lee `docs/ARCHITECTURE.md`, `server/src/game/GameSim.ts` y `client/src/game/Game.ts`.
Responde en español.

Objetivo: anuncios de **multi-kill** y **rachas**, decididos por el servidor.

1. **Multi-kill**: bajas consecutivas del mismo jugador con ≤ 4 s entre una y la siguiente:
   2 Double Kill, 3 Triple Kill, 4 Quadra Kill, 5+ Penta Kill (configurable en `rules.ts`). Los
   suicidios y las bajas de compañeros no cuentan.
2. **Rachas** sin morir: 5 Racha asesina, 10 Imparable, 15 Dominando, 20 Leyenda (nombres
   originales en español, configurables). Al morir se anuncia "Racha cortada por X" si era ≥ 5.
3. Nuevo evento de servidor `{ k: 'streak', p, kind: 'multi' | 'spree' | 'ended', n, by? }`;
   añádelo al protocolo compartido.
4. Cliente: texto grande animado en el centro para quien lo logra (con sonido procedural distinto
   por nivel), y línea en el killfeed para los demás. Contadores de mejor racha y mejor multi-kill
   en la tabla de resultados.
5. Tests en `tests/gamesim.test.ts`: double/triple con tiempos dentro y fuera de la ventana,
   suicidio no cuenta, racha y racha cortada.

Criterios: typecheck, test, build en verde.
