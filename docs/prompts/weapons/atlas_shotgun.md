# atlas_shotgun.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `atlas_shotgun.png` |
| Arma | Dispersor Ariete (WeaponId 1) |
| Clave `manifest.json` | `shotgun` |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (atlas completo) |
| Tileable | No (atlas UV) |
| Ruta destino | `client/public/assets/weapons/atlas_shotgun.png` |
| Plantilla | `client/public/assets/weapons/template_shotgun.png` |

## Qué es en el juego
Atlas del modelo cúbico del arma (1ª y 3ª persona). Escopeta ancha.

## Reglas (obligatorias)
- **Adjuntar:** `client/public/assets/weapons/template_<clave>.png` (`npm run weapons:template`).
- Pintar **solo dentro** de cada isla; no mover UVs.
- **128×128** PNG **opaco** (atlas UV completo); colores planos; sin ruido ni texto.
- **Sin** fondo transparente: el PNG debe cubrir las 128×128 px.

## Prompt (adjuntar plantilla)
Pinta sobre `template_shotgun.png`. Ultra plano: cuerpo #5A4A3C, oscuro #2B2420, empuñadura #3A2A1C, glow #FF8A2A. Sin degradados ni texto. 128×128. Exportar PNG opaco: rellena el cuadrado 128×128 completo (zonas sin pintar en gris neutro #404448 opaco); sin transparencia.
