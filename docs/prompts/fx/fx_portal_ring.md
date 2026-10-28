# fx_portal_ring.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `fx_portal_ring.png` |
| Uso | Aro del portal |
| Dimensiones | 256×256 px |
| Formato | PNG opaco |
| Fondo | **Negro opaco** #000000 (sin transparencia) |
| Tileable | No |
| Ruta destino | `client/public/assets/fx/fx_portal_ring.png` |

## Qué es en el juego
Marco circular distinto de puerta rectangular.

## Reglas (obligatorias)
- Máscara de **emisión**: negro puro **#000000** = sin brillo.
- **Fondo negro opaco** (alfa 255), **no** usar transparencia: el alpha del PNG no define la emisión.
- **Sin** mezclar con texturas de suelo/pared.
- Colores solo donde indique el prompt; portales/salto en escala de grises si se tiñen por código.

## Prompt
Máscara grises 256×256: anillo grueso segmentado en 6 partes, interior negro, fondo #000000. Sin color ni texto. Margen 6%. Exportar PNG opaco: el negro #000000 debe ser color sólido con alfa 255, nunca transparencia (el motor usa el negro como “sin emisión”).
