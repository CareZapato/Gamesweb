# team_blue.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `team_blue.png` |
| Uso en el juego | Superficies base azul (CTF) |
| Material (`manifest.json`) | `blue` |
| Escala en mundo | 4×4 m |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (sin transparencia) |
| Tileable | Sí |
| Ruta destino | `client/public/assets/textures/team_blue.png` |

## Qué es en el juego
Material **blue**: zona equipo azul; misma composición que roja.

## Reglas de generación (obligatorias)
- **Estilo:** albedo plano, ultra limpio; **2–3 colores sólidos**; sin ruido, sin degradados, sin relieves (no rombos/antideslizante denso, no remaches, no ventilas).
- **Vista:** ortográfica; suelo/rejilla/terreno = **cenital** perpendicular; paredes = frontal.
- **Fondo:** **opaco** en toda la imagen (material de mapa; Three.js repite el tile).
- **Sin** texto, números, logotipos ni marcas de agua.
- **Tileable** en los cuatro lados (lo que sale por un borde continúa en el opuesto).
- **Salida:** PNG sRGB **128×128** px (si generas más grande, escala con **vecino más cercano**).
- **Validar:** cuadrícula **3×3** de la imagen; rechazar si hay costura visible.

## Prompt (copiar al generador de imágenes)
Textura tileable 128×128, vista frontal ortográfica, albedo plano. Interior azul #2F5CC0. Marco 8 px #1B2F6E. 2 colores. Sin texto. Tileable. Exportar PNG opaco (RGB o RGBA con alfa 255 en todos los píxeles): sin transparencia, sin fondo transparente, sin checkerboard.
