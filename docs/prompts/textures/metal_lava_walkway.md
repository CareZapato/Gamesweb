# metal_lava_walkway.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `metal_lava_walkway.png` |
| Uso en el juego | Pasarelas anillares Pozo de Lava |
| Material (`manifest.json`) | `metal` |
| Escala en mundo | 2×2 m |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (sin transparencia) |
| Tileable | Sí |
| Ruta destino | `client/public/assets/textures/metal_lava_walkway.png` |

## Qué es en el juego
Variante **metal** cálida para pasarelas.
Clave manifest: `metal`.

## Reglas de generación (obligatorias)
- **Estilo:** albedo plano, ultra limpio; **2–3 colores sólidos**; sin ruido, sin degradados, sin relieves (no rombos/antideslizante denso, no remaches, no ventilas).
- **Vista:** ortográfica; suelo/rejilla/terreno = **cenital** perpendicular; paredes = frontal.
- **Fondo:** **opaco** en toda la imagen (material de mapa; Three.js repite el tile).
- **Sin** texto, números, logotipos ni marcas de agua.
- **Tileable** en los cuatro lados (lo que sale por un borde continúa en el opuesto).
- **Salida:** PNG sRGB **128×128** px (si generas más grande, escala con **vecino más cercano**).
- **Validar:** cuadrícula **3×3** de la imagen; rechazar si hay costura visible.

## Prompt (copiar al generador de imágenes)
Textura tileable 128×128, albedo plano. Gris cálido #5A5048. Juntas 2×2 #3A3530. Sin remaches. 2–3 colores. Sin texto. Tileable. Exportar PNG opaco (RGB o RGBA con alfa 255 en todos los píxeles): sin transparencia, sin fondo transparente, sin checkerboard.
