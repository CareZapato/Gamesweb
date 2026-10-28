# ground_outdoor.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `ground_outdoor.png` |
| Uso en el juego | Suelo exterior (Outpost, Tres Torres) |
| Material (`manifest.json`) | `ground` |
| Escala en mundo | 6×6 m |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (sin transparencia) |
| Tileable | Sí |
| Ruta destino | `client/public/assets/textures/ground_outdoor.png` |

## Qué es en el juego
Material **ground**: tierra exterior.

## Reglas de generación (obligatorias)
- **Estilo:** albedo plano, ultra limpio; **2–3 colores sólidos**; sin ruido, sin degradados, sin relieves (no rombos/antideslizante denso, no remaches, no ventilas).
- **Vista:** ortográfica; suelo/rejilla/terreno = **cenital** perpendicular; paredes = frontal.
- **Fondo:** **opaco** en toda la imagen (material de mapa; Three.js repite el tile).
- **Sin** texto, números, logotipos ni marcas de agua.
- **Tileable** en los cuatro lados (lo que sale por un borde continúa en el opuesto).
- **Salida:** PNG sRGB **128×128** px (si generas más grande, escala con **vecino más cercano**).
- **Validar:** cuadrícula **3×3** de la imagen; rechazar si hay costura visible.

## Prompt (copiar al generador de imágenes)
Textura tileable 128×128, vista cenital ortográfica, albedo plano. Damero 2×2 alternando #6B5A45 y #5E5040 (celdas 64×64). Sin grava ni piedras. 2 colores. Sin texto. Tileable. Exportar PNG opaco (RGB o RGBA con alfa 255 en todos los píxeles): sin transparencia, sin fondo transparente, sin checkerboard.
