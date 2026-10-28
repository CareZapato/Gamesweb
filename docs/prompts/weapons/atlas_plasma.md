# atlas_plasma.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `atlas_plasma.png` |
| Arma | Hilo Aurora (WeaponId 5) |
| Clave `manifest.json` | `plasma` |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (atlas completo) |
| Tileable | No (atlas UV) |
| Ruta destino | `client/public/assets/weapons/atlas_plasma.png` |
| Plantilla | `client/public/assets/weapons/template_plasma.png` |

## Qué es en el juego
Atlas del modelo cúbico del arma (1ª y 3ª persona). Emisor de rayo continuo.

## Reglas (obligatorias)
- **Adjuntar:** `client/public/assets/weapons/template_<clave>.png` (`npm run weapons:template`).
- Pintar **solo dentro** de cada isla; no mover UVs.
- **128×128** PNG **opaco** (atlas UV completo); colores planos; sin ruido ni texto.
- **Sin** fondo transparente: el PNG debe cubrir las 128×128 px.

## Prompt (adjuntar plantilla)
Pinta sobre `template_plasma.png`. Ultra plano: cuerpo #3A4555, oscuro #1E2430, empuñadura #252830, glow #B36BFF. Sin degradados ni texto. 128×128. Exportar PNG opaco: rellena el cuadrado 128×128 completo (zonas sin pintar en gris neutro #404448 opaco); sin transparencia.
