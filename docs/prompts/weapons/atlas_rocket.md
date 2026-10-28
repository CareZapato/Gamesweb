# atlas_rocket.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `atlas_rocket.png` |
| Arma | Lanzador Cometa (WeaponId 3) |
| Clave `manifest.json` | `rocket` |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (atlas completo) |
| Tileable | No (atlas UV) |
| Ruta destino | `client/public/assets/weapons/atlas_rocket.png` |
| Plantilla | `client/public/assets/weapons/template_rocket.png` |

## Qué es en el juego
Atlas del modelo cúbico del arma (1ª y 3ª persona). Lanzacohetes tubo grueso.

## Reglas (obligatorias)
- **Adjuntar:** `client/public/assets/weapons/template_<clave>.png` (`npm run weapons:template`).
- Pintar **solo dentro** de cada isla; no mover UVs.
- **128×128** PNG **opaco** (atlas UV completo); colores planos; sin ruido ni texto.
- **Sin** fondo transparente: el PNG debe cubrir las 128×128 px.

## Prompt (adjuntar plantilla)
Pinta sobre `template_rocket.png`. Ultra plano: cuerpo #505648, oscuro #24281F, empuñadura #2A2520, glow #FF3B3B. Sin degradados ni texto. 128×128. Exportar PNG opaco: rellena el cuadrado 128×128 completo (zonas sin pintar en gris neutro #404448 opaco); sin transparencia.
