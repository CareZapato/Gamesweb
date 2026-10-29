# deadhold_card.png — Reducto: Horda

## Especificaciones

| Campo | Valor |
|---|---|
| Archivo | `deadhold_card.png` |
| Uso | Miniatura tarjeta del portal (junto a RealTournament) |
| Dimensiones | 640×360 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (ilustración a sangre) |
| Tileable | No |
| Ruta destino | `client/public/portal/deadhold_card.png` |

## Qué es en el juego

Tarjeta del catálogo en `client/src/catalog.ts` (`id: deadhold`, ruta `/deadhold/`). Tras generar la imagen, actualiza `thumbnail` en el catálogo de `/portal/deadhold_card.svg` a `/portal/deadhold_card.png`.

## Reglas

- Puede incluir el título **Reducto: Horda** si queda legible en miniatura (opcional; el portal ya muestra el nombre).
- Estilo plano/minimalista, coherente con `realtournament_card.png`: pocos colores, formas grandes.
- Sin marcas ajenas, sin watermark.

## Prompt (copiar al generador de imágenes)

Ilustración 640×360, estilo plano vectorial simplificado: arena circular grande vista desde arriba en perspectiva suave, plataforma central iluminada, anillo oscuro de perímetro, siluetas de 4–6 zombies cúbicos (verde grisáceo) acercándose desde los bordes, un soldado cúbico en el centro con rifle, chispas o humo leve, paleta oscura (#07090d) con acentos cian (#2fd0ff) y naranja (#ff7a1a). Sensación de oleada / supervivencia cooperativa. Sin fotorealismo, sin texto obligatorio. Exportar PNG opaco RGB (alfa 255 en todos los píxeles): sin transparencia ni checkerboard.
