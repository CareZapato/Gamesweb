# fx_shield_hex.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `fx_shield_hex.png` |
| Uso | Destello escudo |
| Dimensiones | 128×128 px |
| Formato | PNG opaco |
| Fondo | **Negro opaco** #000000 (sin transparencia) |
| Tileable | Sí |
| Ruta destino | `client/public/assets/fx/fx_shield_hex.png` |

## Qué es en el juego
Feedback escudo al impacto/recogida.

## Reglas (obligatorias)
- Máscara de **emisión**: negro puro **#000000** = sin brillo.
- **Fondo negro opaco** (alfa 255), **no** usar transparencia: el alpha del PNG no define la emisión.
- **Sin** mezclar con texturas de suelo/pared.
- Colores solo donde indique el prompt; portales/salto en escala de grises si se tiñen por código.

## Prompt
Tileable 128×128: rejilla hexagonal simple, bordes hex blancos finos, interior negro #000000. Sin color. Sin texto. Exportar PNG opaco: el negro #000000 debe ser color sólido con alfa 255, nunca transparencia (el motor usa el negro como “sin emisión”).
