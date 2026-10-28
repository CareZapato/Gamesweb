# floor_outpost_dust.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `floor_outpost_dust.png` |
| Uso en el juego | Suelo mapa Puesto Avanzado |
| Material (`manifest.json`) | `floor` |
| Escala en mundo | 2×2 m |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (sin transparencia) |
| Tileable | Sí |
| Ruta destino | `client/public/assets/textures/floor_outpost_dust.png` |

## Qué es en el juego
Variante de **floor** para exterior árido.
En `manifest.json` la clave es `floor` (solo cambia el archivo).

## Reglas de generación (obligatorias)
- **Estilo:** albedo plano, ultra limpio; **2–3 colores sólidos**; sin ruido, sin degradados, sin relieves (no rombos/antideslizante denso, no remaches, no ventilas).
- **Vista:** ortográfica; suelo/rejilla/terreno = **cenital** perpendicular; paredes = frontal.
- **Fondo:** **opaco** en toda la imagen (material de mapa; Three.js repite el tile).
- **Sin** texto, números, logotipos ni marcas de agua.
- **Tileable** en los cuatro lados (lo que sale por un borde continúa en el opuesto).
- **Salida:** PNG sRGB **128×128** px (si generas más grande, escala con **vecino más cercano**).
- **Validar:** cuadrícula **3×3** de la imagen; rechazar si hay costura visible.

## Prompt (copiar al generador de imágenes)
Textura tileable 128×128, cenital, albedo plano. Beige gris #6A6258. Juntas #4A4540: una vertical y una horizontal (2×2). Sin antideslizante. 2–3 colores. Sin texto. Tileable. Exportar PNG opaco (RGB o RGBA con alfa 255 en todos los píxeles): sin transparencia, sin fondo transparente, sin checkerboard.
