# atlas_charge.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `atlas_charge.png` |
| Arma | Lanza Cuásar (WeaponId 6) |
| Clave `manifest.json` | `charge` |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (atlas completo) |
| Tileable | No (atlas UV) |
| Ruta destino | `client/public/assets/weapons/atlas_charge.png` |
| Plantilla | `client/public/assets/weapons/template_charge.png` |

## Qué es en el juego
Atlas del modelo cúbico del arma (1ª y 3ª persona). Francotirador de carga.

## Reglas (obligatorias)
- **Adjuntar:** `client/public/assets/weapons/template_<clave>.png` (`npm run weapons:template`).
- Pintar **solo dentro** de cada isla; no mover UVs.
- **128×128** PNG **opaco** (atlas UV completo); colores planos; sin ruido ni texto.
- **Sin** fondo transparente: el PNG debe cubrir las 128×128 px.

## Prompt (adjuntar plantilla)
Pinta sobre `template_charge.png`. Ultra plano: cuerpo #3A3540, oscuro #1A1820, empuñadura #28242A, glow #FF5FA8. Sin degradados ni texto. 128×128. Exportar PNG opaco: rellena el cuadrado 128×128 completo (zonas sin pintar en gris neutro #404448 opaco); sin transparencia.
