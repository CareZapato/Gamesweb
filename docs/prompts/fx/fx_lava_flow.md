# fx_lava_flow.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `fx_lava_flow.png` |
| Uso | Superficie lava animada (UV) |
| Dimensiones | 256×256 px |
| Formato | PNG opaco |
| Fondo | **Negro opaco** #000000 (sin transparencia) |
| Tileable | Sí |
| Ruta destino | `client/public/assets/fx/fx_lava_flow.png` |

## Qué es en el juego
Hazard lava en fondo del pozo; negro = costra sin emisión.

## Reglas (obligatorias)
- Máscara de **emisión**: negro puro **#000000** = sin brillo.
- **Fondo negro opaco** (alfa 255), **no** usar transparencia: el alpha del PNG no define la emisión.
- **Sin** mezclar con texturas de suelo/pared.
- Colores solo donde indique el prompt; portales/salto en escala de grises si se tiñen por código.

## Prompt
Textura tileable 256×256 cenital: bloques grandes costra #000000 y magma plano #FF5A0A / #FFB020, bordes nítidos, sin humo. 4 colores. Sin texto. Tileable 3×3. Exportar PNG opaco: el negro #000000 debe ser color sólido con alfa 255, nunca transparencia (el motor usa el negro como “sin emisión”).
