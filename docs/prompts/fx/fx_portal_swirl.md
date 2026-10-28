# fx_portal_swirl.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `fx_portal_swirl.png` |
| Uso | Disco central del portal |
| Dimensiones | 256×256 px |
| Formato | PNG opaco |
| Fondo | **Negro opaco** #000000 (sin transparencia) |
| Tileable | No |
| Ruta destino | `client/public/assets/fx/fx_portal_swirl.png` |

## Qué es en el juego
Portal en pared/suelo; el color lo aplica el motor.

## Reglas (obligatorias)
- Máscara de **emisión**: negro puro **#000000** = sin brillo.
- **Fondo negro opaco** (alfa 255), **no** usar transparencia: el alpha del PNG no define la emisión.
- **Sin** mezclar con texturas de suelo/pared.
- Colores solo donde indique el prompt; portales/salto en escala de grises si se tiñen por código.

## Prompt
Máscara escala de grises 256×256: remolino circular de 5 brazos gruesos, centro blanco, fade a negro #000000 fuera del disco. Sin color. Sin texto. Margen negro 5%. Exportar PNG opaco: el negro #000000 debe ser color sólido con alfa 255, nunca transparencia (el motor usa el negro como “sin emisión”).
