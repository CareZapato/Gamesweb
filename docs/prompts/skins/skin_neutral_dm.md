# skin_neutral_dm.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `skin_neutral_dm.png` |
| Uso | Deathmatch neutro (teñido por jugador) |
| Dimensiones | 128×128 px |
| Formato | PNG RGBA (≤48 KB) |
| Fondo | **Opaco en UV** (alfa 0 solo en huecos de la plantilla) |
| Tileable | No |
| Ruta destino | `docs/reference/skins/skin_neutral_dm.png` |
| Plantilla | `client/public/assets/skins/template.png` |

## Qué es en el juego
Apariencia del personaje de bloques (1 PNG = todo el cuerpo).

## Reglas (obligatorias)
- **Adjuntar:** `client/public/assets/skins/template.png` (`npm run skins:template`).
- **128×128** PNG RGBA, ≤ **48 KB**; layout exacto [SKINS.md](../../SKINS.md).
- **No** es un sprite con fondo transparente: el lienzo UV va **opaco** salvo huecos (visor, etc.) con **alfa 0**.
- **Alfa 254** en zonas de color de equipo; capas exteriores pueden usar alfa 0 donde no hay pieza.
- Colores planos; sin texto ni marcas.

## Prompt
template.png: gris acero #6E757E, hombreras y visor blanco alfa 254. Sin franjas de equipo. 128×128. Exportar PNG RGBA: no uses lienzo totalmente transparente; pinta solo dentro de la plantilla; alfa 0 únicamente en huecos previstos (visor, etc.); resto opaco.
