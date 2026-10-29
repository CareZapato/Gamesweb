# Skins — Reducto: Horda (jugador + zombies)

Texturas **128×128** con el layout de [SKINS.md](../../../SKINS.md). Mismo rig cúbico que RealTournament; estilo visual de referencia: [arena_reference.jpg](../../../reference/deadhold/arena_reference.jpg) (voxel/low-poly, piel zombie gris-verde, ojos naranja, soldado con visor cian y acentos naranja).

## Antes de generar

1. `npm run skins:template` genera en `client/public/assets/skins/` las skins **válidas 128×128** (presets + zombies). Para arte IA full-size, repinta sobre la plantilla o convierte a UV manualmente.
2. Al generar con IA: adjunta **`client/public/assets/skins/template.png`** en cada prompt.
2. Reglas globales: [docs/prompts/README.md](../../README.md) (opaco en UV, alfa 254 = zona de equipo en **jugadores**, ≤48 KB).

## Lista de prompts (orden sugerido)

### Jugador — modelos predefinidos (lobby Deadhold)

| # | Archivo | PNG destino | Rol |
|---|---------|-------------|-----|
| 1 | [preset_survivor_orange.md](./preset_survivor_orange.md) | `client/public/assets/skins/preset_survivor_orange.png` | Soldado central (referencia) |
| 2 | [preset_survivor_cyan.md](./preset_survivor_cyan.md) | `preset_survivor_cyan.png` | Variante cian |
| 3 | [preset_survivor_steel.md](./preset_survivor_steel.md) | `preset_survivor_steel.png` | Gris acero |

### Zombies — uno por arquetipo (tinte suave encima)

| # | Archivo | PNG destino | Arquetipo |
|---|---------|-------------|-----------|
| 4 | [zombie_walker.md](./zombie_walker.md) | `zombie_walker.png` | Caminante |
| 5 | [zombie_runner.md](./zombie_runner.md) | `zombie_runner.png` | Corredor |
| 6 | [zombie_brute.md](./zombie_brute.md) | `zombie_brute.png` | Bruto |
| 7 | [zombie_armored.md](./zombie_armored.md) | `zombie_armored.png` | Acorazado |
| 8 | [zombie_colossus.md](./zombie_colossus.md) | `zombie_colossus.png` | Coloso |

### RealTournament — skins de referencia aún sin empaquetar (bots / DM)

Ya documentadas en `docs/prompts/skins/`; copia a `client/public/assets/skins/` cuando las generes:

| Prompt existente | Uso |
|------------------|-----|
| [skin_neutral_dm.md](../skin_neutral_dm.md) | DM neutro |
| [skin_foundry_worker.md](../skin_foundry_worker.md) | Mapa foundry |
| [skin_tower_ranger.md](../skin_tower_ranger.md) | Torre |
| [skin_gateway_runner.md](../skin_gateway_runner.md) | Portales |

## Estilo común (pegar en cualquier prompt)

> Personaje **voxel / low-poly cúbico**, caras planas con pocos tonos, sin fotorealismo. Paleta oscura `#2a3038`, acentos **naranja** `#ff7a1a` / `#b85a1e` y **cian** `#2fd0ff` en visores o luces. Zombies: piel **gris verdoso** `#8a9a78` / `#6a7a62`, ojos rectangulares **naranja rojizo** `#ff6020`, ropa rasgada gris `#3a3a3a`. Sin texto, logos ni watermark.

## En el juego

- **Jugador:** lobby Deadhold → grid «Modelo predefinido» (`client/src/skins/playerPresets.ts`).
- **Zombies:** si existe `assets/skins/zombie_<arquetipo>.png`, el cliente la usa; si no, tinte verde de `zombieVisual.ts`.
