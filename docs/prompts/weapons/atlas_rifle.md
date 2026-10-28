# atlas_rifle.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `atlas_rifle.png` |
| Arma | Carabina Tormenta (WeaponId 0) |
| Clave `manifest.json` | `rifle` |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (atlas completo) |
| Tileable | No (atlas UV) |
| Ruta destino | `client/public/assets/weapons/atlas_rifle.png` |
| Plantilla | `client/public/assets/weapons/template_rifle.png` |

## Qué es en el juego
Atlas del modelo cúbico del arma (1ª y 3ª persona). Carabina automática.

## Reglas (obligatorias)
- **Adjuntar:** `client/public/assets/weapons/template_<clave>.png` (`npm run weapons:template`).
- Pintar **solo dentro** de cada isla; no mover UVs.
- **128×128** PNG **opaco** (atlas UV completo); colores planos; sin ruido ni texto.
- **Sin** fondo transparente: el PNG debe cubrir las 128×128 px.

## Prompt (adjuntar plantilla)
Pinta sobre `template_rifle.png`. Ultra plano: cuerpo #46505E, oscuro #23272E, empuñadura #2B2622, glow #2FD0FF. Sin degradados ni texto. 128×128. Exportar PNG opaco: rellena el cuadrado 128×128 completo (zonas sin pintar en gris neutro #404448 opaco); sin transparencia.
