# default_blue.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `default_blue.png` |
| Uso | Skin por defecto equipo azul |
| Dimensiones | 128×128 px |
| Formato | PNG RGBA (≤48 KB) |
| Fondo | **Opaco en UV** (alfa 0 solo en huecos de la plantilla) |
| Tileable | No |
| Ruta destino | `client/public/assets/skins/default_blue.png` |
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
Como roja pero franjas cian #2EC4C8; mismas zonas alfa 254. template.png obligatorio. 128×128. Exportar PNG RGBA: no uses lienzo totalmente transparente; pinta solo dentro de la plantilla; alfa 0 únicamente en huecos previstos (visor, etc.); resto opaco.
