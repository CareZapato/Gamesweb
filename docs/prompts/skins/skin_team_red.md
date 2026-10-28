# default_red.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `default_red.png` |
| Uso | Skin por defecto equipo rojo / referencia CTF |
| Dimensiones | 128×128 px |
| Formato | PNG RGBA (≤48 KB) |
| Fondo | **Opaco en UV** (alfa 0 solo en huecos de la plantilla) |
| Tileable | No |
| Ruta destino | `client/public/assets/skins/default_red.png` |
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
Sobre template.png: armadura cúbica plana, zonas equipo alfa 254 en blanco/gris claro, base gris #5A626C, casco con visor oscuro, acento pechera naranja #B85A1E. 128×128, sin logos. Exportar PNG RGBA: no uses lienzo totalmente transparente; pinta solo dentro de la plantilla; alfa 0 únicamente en huecos previstos (visor, etc.); resto opaco.
