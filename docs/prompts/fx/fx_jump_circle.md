# fx_jump_circle.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `fx_jump_circle.png` |
| Uso | Círculo de salto en suelo |
| Dimensiones | 256×256 px |
| Formato | PNG opaco |
| Fondo | **Negro opaco** #000000 (sin transparencia) |
| Tileable | No |
| Ruta destino | `client/public/assets/fx/fx_jump_circle.png` |

## Qué es en el juego
Jump pad; se tiñe verde en juego.

## Reglas (obligatorias)
- Máscara de **emisión**: negro puro **#000000** = sin brillo.
- **Fondo negro opaco** (alfa 255), **no** usar transparencia: el alpha del PNG no define la emisión.
- **Sin** mezclar con texturas de suelo/pared.
- Colores solo donde indique el prompt; portales/salto en escala de grises si se tiñen por código.

## Prompt
Máscara grises 256×256 cenital: anillo exterior grueso blanco, dos anillos interiores, tres chevrones sólidos al centro apuntando arriba. Fondo #000000. Sin texto. Exportar PNG opaco: el negro #000000 debe ser color sólido con alfa 255, nunca transparencia (el motor usa el negro como “sin emisión”).
