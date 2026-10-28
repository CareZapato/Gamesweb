# Reducto: Horda — análisis de diseño (v0.1.0)

Segundo minijuego del portal, **mismo motor** que RealTournament: simulación compartida (`shared/`), servidor Colyseus, cliente Vite + Three.js, **texturas y materiales existentes** (`client/public/assets/textures/`, armas, skins). Sin arte nuevo obligatorio en la primera entrega.

## Fantasía y loop

- **Endless por oleadas**: el jugador (o equipo) permanece en el **centro de una arena grande**. Cada oleada spawnea enemigos desde **spawns perimetrales**; al eliminar a todos, la oleada cuenta como **nivel superado** y sube el contador global (`nivel`, visible en HUD y resultados).
- **Entre oleadas (fase tienda, ~25–40 s)**: pausa de combate, menú de **mejoras configurables** (build) con moneda ganada en la oleada. No hay mapa de exploración entre rondas: solo preparación.
- **Muerte = fin de run** (salvo revive coop futuro). Puntuación: `nivel alcanzado`, bajas totales, moneda no gastada opcional.

## Reutilización del motor (alcance económico)

| Ya existe | Uso en Reducto |
|-----------|----------------|
| `stepMovement`, armas hitscan/proyectil | Jugador igual que RT |
| `GameSim` / daño por zonas | Jugador vs “zombies” (mismas cajas de colisión, otro `team`) |
| `MapView` + materiales `floor`, `metal`, `panel`, `concrete` | Arena circular o cuadrada grande, sin PNG nuevos |
| `Character` + skins | Zombies = mismo rig, **tinte verde/gris**, escala 1.0 → 1.25 → 1.5 por arquetipo |
| `BotBrain` (patrón) | IA melee: perseguir, atacar a distancia corta, sin armas |
| Portal + `catalog.ts` + `ROOM_NAMES` | Segunda tarjeta “Próximamente” → jugable en fases |

**No reutilizar en v0.1.0**: CTF, banderas, bots de RT, marcador DM. Modo **PvE cooperativo** (1–4), sala propia `deadhold`.

## Mapa “centro grande”

- **Id sugerido**: `holdout` en `shared/src/maps/`.
- Plataforma central elevada (spawn seguro), **anillo exterior** con 8–12 spawns de horda etiquetados por ángulo.
- Tamaño útil ~80×80 m (similar a Outpost pero más abierto, pocos pasillos).
- Materiales: suelo `floor`/`ground`, muros bajos `metal`, coberturas `panel` (no laberinto denso).
- **Kill Y** / bordes: fuera del anillo = muerte (opcional v0.2).

## Enemigos (zombies)

Tratarlos como **jugadores sim simplificados** sin armas:

| Arquetipo | Desbloqueo (oleada ≥) | Escala visual | Comportamiento |
|-----------|------------------------|---------------|----------------|
| Caminante | 1 | 1.0 | Lento, melee, poco daño |
| Corredor | 3 | 1.0 | Más velocidad, menos vida |
| Bruto | 8 | 1.25 | Lento, mucha vida, empuje |
| Acorazado | 15 | 1.35 | Escudo frontal (absorbe como escudo jugador) |
| Coloso | 25 | 1.5 | Boss de oleada cada 5 niveles |

**Daño melee**: raycast corto o proximidad cada `attackInterval`; no proyectiles en v0.1.0.

IA en servidor: derivar de `BotBrain` → `ZombieBrain.ts` (solo Forward + orientación, sin Aim/Fire).

## Escalado numérico por oleada

Parámetros en `shared/src/deadhold/waves.ts` (nuevo), todo **determinista** en servidor:

```
enemigosEnOleada(n) = floor(baseCount + n * countPerWave + floor(n^1.15) * burst)
vidaMult(n)         = 1 + n * hpPerWave
dañoMult(n)         = 1 + n * dmgPerWave
speedMult(n)        = min(maxSpeedMult, 1 + n * speedPerWave)
tiposActivos(n)     = tabla por arquetipo (ver arriba)
```

- Oleadas **5, 10, 15…**: +1 enemigo “especial” garantizado (bruto/coloso).
- **Cap** de entidades vivas simultáneas (p. ej. 40) para plan free de Render: si el techo se alcanza, el resto entra al morir uno (cola de spawn).

## Economía de oleada y mejoras

- **Moneda**: `scrap` por baja (base + bonus por arquetipo). No se pierde al morir en la misma run hasta fin de partida.
- **Tienda entre oleadas** (servidor envía `ShopOffer[]`, cliente elige hasta N picks o gasta scrap):

  Categorías v0.1.0 (stackable con tope):

  - +Vida máxima / curación instantánea
  - +Daño hitscan / +radio explosión
  - +Cadencia / −tiempo recarga (fire interval floor)
  - +Velocidad movimiento / −cooldown dash
  - +Munición reserva / recarga parcial entre oleadas
  - +1 “vida de oleada” (escudo temporal solo para la siguiente)

- **Rareza**: cada 5 niveles, oferta “rara” (p. ej. escopeta permanente si empezaste solo con carabina — reutilizar pickup weapon logic).

## Red y sala

- `DeadholdRoom extends GameRoom` (patrón `ArenaRoom`): fases `lobby` → `combat` → `shop` → `combat` …
- Snapshots: jugadores + lista zombies (cuantizada como `PlayerSnap` con flag `Zombie` + arquetipo en weapon slot o flags extra).
- Eventos: `waveStart`, `waveClear`, `level`, `shopOpen`, `upgradePick`, `gameOver`.
- **Solo PvE**: friendly fire off; zombies en `team: 2`.

## Cliente

- Ruta: `/deadhold/` (HTML + entrada Vite).
- HUD: oleada/nivel, scrap, temporizador tienda, contador enemigos restantes, panel mejoras (HTML overlay, estilo RT).
- Sin mapa nuevo de assets: placeholder tarjeta portal SVG hasta arte dedicado.

## Fases de implementación (orden)

1. Registro portal + sala vacía + mapa holdout mínimo (solo geometría, sin zombies).
2. Spawner + 1 tipo caminante + oleada 1–3 + contador nivel.
3. Escalado numérico + tienda básica (3 mejoras).
4. Más arquetipos + coloso cada 5 oleadas.
5. Coop 2–4 + pruebas rendimiento.

## Riesgos

- **CPU** con muchos AI: tick zombies en batch, LOD IA (actualizar orientación cada 2 ticks lejos del jugador).
- **Memoria** Colyseus: límite jugadores+zombies en snapshot; preferir ids compactos.
- **Scope creep**: no nuevas armas ni mapas múltiples hasta oleada 20 estable.

## Métricas de éxito v0.1.0

- 1 jugador sobrevive ≥ 10 oleadas en mapa holdout.
- `npm test` incluye tests de fórmulas de oleada y tienda determinista.
- Build Render sin assets nuevos.
