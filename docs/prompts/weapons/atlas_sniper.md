# atlas_sniper.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `atlas_sniper.png` |
| Arma | Aguja Lumen (WeaponId 2) |
| Clave `manifest.json` | `sniper` |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (atlas completo) |
| Tileable | No (atlas UV) |
| Ruta destino | `client/public/assets/weapons/atlas_sniper.png` |
| Plantilla | `client/public/assets/weapons/template_sniper.png` |

## Qué es en el juego
Atlas del modelo cúbico del arma (1ª y 3ª persona). Fusil largo con visor.

## Reglas (obligatorias)
- **Adjuntar:** `client/public/assets/weapons/template_<clave>.png` (`npm run weapons:template`).
- Pintar **solo dentro** de cada isla; no mover UVs.
- **128×128** PNG **opaco** (atlas UV completo); colores planos; sin ruido ni texto.
- **Sin** fondo transparente: el PNG debe cubrir las 128×128 px.

## Prompt (adjuntar plantilla)
Pinta sobre `template_sniper.png`. Ultra plano: cuerpo #384640, oscuro #1A1F1C, empuñadura #25211C, glow #7DFF6A. Sin degradados ni texto. 128×128. Exportar PNG opaco: rellena el cuadrado 128×128 completo (zonas sin pintar en gris neutro #404448 opaco); sin transparencia.
