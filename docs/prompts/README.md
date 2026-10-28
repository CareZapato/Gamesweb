# Prompts de imágenes — RealTournament

**Un archivo Markdown = una imagen PNG.** Cada `.md` incluye especificaciones completas y un **prompt
listo para copiar** al generador (ChatGPT, DALL·E, etc.). Estilo **ultra plano**: 2–3 colores en
texturas de mapa, sin ruido, visual limpia en partida a 128×128.

Documento hermano (prompts detallados 1024²): [ASSET_PROMPTS.md](../ASSET_PROMPTS.md).

## Cómo usar

1. Abre el `.md` de la imagen que quieras generar.
2. Copia la sección **Prompt** (y **adjunta la plantilla** si el archivo lo indica: armas y skins).
3. Exporta PNG a la **ruta destino** indicada en ese mismo archivo.
4. Registra el archivo en el `manifest.json` correspondiente (tabla abajo).
5. Texturas tileables: pasa la **comprobación 3×3** antes de dar por buena la imagen.

## Modelo y escalado

| Tipo | Consejo |
|---|---|
| Texturas de mapa | Pide 128×128 o genera grande y reduce con **vecino más cercano** (GIMP: interpolación *Ninguna*; ImageMagick: `-filter point -resize 128x128`). |
| Armas / skins | **No generes sin plantilla** (`npm run weapons:template` / `npm run skins:template`). |
| Iconos y pickups | 128×128 suele bastar en un paso. |
| Portal | 640×360 y 512×128 según archivo. |

Evita: *photorealistic*, *detailed*, *diamond plate*, *8K*, *fine noise*.

## Fondo: opaco vs transparente

Cada `.md` incluye la fila **Fondo** en especificaciones y lo repite al final del **Prompt**.

| Tipo | Fondo | Motivo |
|---|---|---|
| `textures/` | **Opaco** | Materiales tileables del mapa (Three.js `RepeatWrapping`). |
| `weapons/` | **Opaco** | Atlas UV 128×128 completo. |
| `icons/`, `pickups/` | **Transparente** | Sprites/HUD sobre el escenario. |
| `fx/` | **Negro opaco** #000000 | Máscara de emisión; el negro no debe ser alpha 0. |
| `skins/` | **Opaco en UV** | RGBA con alfa 0 solo en huecos (visor, etc.), no lienzo vacío. |
| `portal/` tarjeta | **Opaco** | Miniatura 16:9. |
| `portal/` logo | **Transparente** | Texto sobre la tarjeta. |

## Registro en `manifest.json`

| Carpeta destino | Manifest | Claves |
|---|---|---|
| `client/public/assets/textures/` | `textures/manifest.json` → `"textures"` | `floor`, `metal`, `panel`, `grate`, `concrete`, `red`, `blue`, `trim`, `dark`, `ground` |
| `client/public/assets/weapons/` | `weapons/manifest.json` → `"weapons"` | `rifle`, `shotgun`, `sniper`, `rocket`, `grenade`, `plasma`, `charge` |
| `client/public/assets/icons/` | `icons/manifest.json` → `"weapons"` | `"0"` … `"6"` (= `WeaponId`) |
| `client/public/assets/skins/` | (nombres fijos) | `default_red.png`, `default_blue.png` |
| `client/public/assets/fx/` | (integración pendiente) | — |
| `client/public/assets/portal/` | `catalog.ts` | rutas estáticas |

Solo un archivo por **clave** de material en texturas (elige base o variante de arena, no ambos).

---

## Índice por carpeta

### `textures/` — materiales del mapa (21)

| Prompt | PNG | Material manifest |
|---|---|---|
| [floor_antislip.md](textures/floor_antislip.md) | `floor_antislip.png` | `floor` |
| [metal_plate.md](textures/metal_plate.md) | `metal_plate.png` | `metal` |
| [wall_panel.md](textures/wall_panel.md) | `wall_panel.png` | `panel` |
| [grate.md](textures/grate.md) | `grate.png` | `grate` |
| [concrete_tech.md](textures/concrete_tech.md) | `concrete_tech.png` | `concrete` |
| [team_red.md](textures/team_red.md) | `team_red.png` | `red` |
| [team_blue.md](textures/team_blue.md) | `team_blue.png` | `blue` |
| [hazard_trim.md](textures/hazard_trim.md) | `hazard_trim.png` | `trim` |
| [dark_metal.md](textures/dark_metal.md) | `dark_metal.png` | `dark` |
| [ground_outdoor.md](textures/ground_outdoor.md) | `ground_outdoor.png` | `ground` |
| [floor_outpost_dust.md](textures/floor_outpost_dust.md) | `floor_outpost_dust.png` | `floor` (variante Outpost) |
| [ground_outpost.md](textures/ground_outpost.md) | `ground_outpost.png` | `ground` (Outpost) |
| [concrete_tower.md](textures/concrete_tower.md) | `concrete_tower.png` | `concrete` (Tres Torres) |
| [panel_tower_band_amber.md](textures/panel_tower_band_amber.md) | `panel_tower_band_amber.png` | `panel` |
| [panel_tower_band_cyan.md](textures/panel_tower_band_cyan.md) | `panel_tower_band_cyan.png` | `panel` |
| [panel_tower_band_violet.md](textures/panel_tower_band_violet.md) | `panel_tower_band_violet.png` | `panel` |
| [panel_gateways_clean.md](textures/panel_gateways_clean.md) | `panel_gateways_clean.png` | `panel` (Pasarelas) |
| [panel_lava_foundry.md](textures/panel_lava_foundry.md) | `panel_lava_foundry.png` | `panel` (Pozo de Lava) |
| [metal_lava_walkway.md](textures/metal_lava_walkway.md) | `metal_lava_walkway.png` | `metal` (Lava) |
| [floor_foundry.md](textures/floor_foundry.md) | `floor_foundry.png` | `floor` (Fundición) |
| [concrete_twin_dam.md](textures/concrete_twin_dam.md) | `concrete_twin_dam.png` | `concrete` (Presa Gemela) |

### `weapons/` — atlas por arma (7)

| Prompt | PNG | Manifest |
|---|---|---|
| [atlas_rifle.md](weapons/atlas_rifle.md) | `atlas_rifle.png` | `rifle` |
| [atlas_shotgun.md](weapons/atlas_shotgun.md) | `atlas_shotgun.png` | `shotgun` |
| [atlas_sniper.md](weapons/atlas_sniper.md) | `atlas_sniper.png` | `sniper` |
| [atlas_rocket.md](weapons/atlas_rocket.md) | `atlas_rocket.png` | `rocket` |
| [atlas_grenade.md](weapons/atlas_grenade.md) | `atlas_grenade.png` | `grenade` |
| [atlas_plasma.md](weapons/atlas_plasma.md) | `atlas_plasma.png` | `plasma` |
| [atlas_charge.md](weapons/atlas_charge.md) | `atlas_charge.png` | `charge` |

### `icons/` — HUD (7)

[weapon_0.md](icons/weapon_0.md) … [weapon_6.md](icons/weapon_6.md) → `icons/weapons/weapon_<id>.png`

### `pickups/` — recogibles (5)

[pickup_health_small.md](pickups/pickup_health_small.md), [pickup_health_big.md](pickups/pickup_health_big.md),
[pickup_shield_small.md](pickups/pickup_shield_small.md), [pickup_shield_big.md](pickups/pickup_shield_big.md),
[pickup_ammo_box.md](pickups/pickup_ammo_box.md)

### `fx/` — emisivos sobre negro (5)

[fx_lava_flow.md](fx/fx_lava_flow.md), [fx_portal_swirl.md](fx/fx_portal_swirl.md),
[fx_portal_ring.md](fx/fx_portal_ring.md), [fx_jump_circle.md](fx/fx_jump_circle.md),
[fx_shield_hex.md](fx/fx_shield_hex.md)

### `skins/` — personaje (6)

[skin_team_red.md](skins/skin_team_red.md) → `default_red.png`, [skin_team_blue.md](skins/skin_team_blue.md) → `default_blue.png`,
[skin_neutral_dm.md](skins/skin_neutral_dm.md), [skin_foundry_worker.md](skins/skin_foundry_worker.md),
[skin_tower_ranger.md](skins/skin_tower_ranger.md), [skin_gateway_runner.md](skins/skin_gateway_runner.md)

Layout: [SKINS.md](../SKINS.md). Plantilla: `client/public/assets/skins/template.png`.

### `portal/` — catálogo (2)

[realtournament_card.md](portal/realtournament_card.md), [realtournament_logo.md](portal/realtournament_logo.md)

---

Regenerar en bloque (opcional): `node scripts/gen-prompt-docs.mjs`.
