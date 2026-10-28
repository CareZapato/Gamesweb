# floor_antislip.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `floor_antislip.png` |
| Uso en el juego | Suelo interior: pasillos y plataformas (Foundry, Twin Dam, interiores) |
| Material (`manifest.json`) | `floor` |
| Escala en mundo | 2×2 m por repetición |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (sin transparencia) |
| Tileable | Sí |
| Ruta destino | `client/public/assets/textures/floor_antislip.png` |

## Qué es en el juego
Material **floor**: donde camina el jugador en instalaciones cerradas. Superficie industrial **muy simple**.

## Reglas de generación (obligatorias)
- **Estilo:** albedo plano, ultra limpio; **2–3 colores sólidos**; sin ruido, sin degradados, sin relieves (no rombos/antideslizante denso, no remaches, no ventilas).
- **Vista:** ortográfica; suelo/rejilla/terreno = **cenital** perpendicular; paredes = frontal.
- **Fondo:** **opaco** en toda la imagen (material de mapa; Three.js repite el tile).
- **Sin** texto, números, logotipos ni marcas de agua.
- **Tileable** en los cuatro lados (lo que sale por un borde continúa en el opuesto).
- **Salida:** PNG sRGB **128×128** px (si generas más grande, escala con **vecino más cercano**).
- **Validar:** cuadrícula **3×3** de la imagen; rechazar si hay costura visible.

## Prompt (copiar al generador de imágenes)
Textura tileable 128×128, vista cenital ortográfica, albedo plano. Relleno gris azulado sólido #3B4048. Solo líneas de junta negras #1A1D22 en cuadrícula 4×4 (líneas de 1 px, celdas 32×32). Sin patrón antideslizante, sin rombos, sin diamantes, sin relieve. Exactamente 3 colores. Sin texto. Bordes tileables perfectos. Exportar PNG opaco (RGB o RGBA con alfa 255 en todos los píxeles): sin transparencia, sin fondo transparente, sin checkerboard.
