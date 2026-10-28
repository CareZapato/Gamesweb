Lee `docs/ASSET_PROMPTS.md`, `client/src/render/textures.ts`, `docs/SKINS.md` (si existe) y
`shared/src/weapons.ts`. Responde en español. Esta tarea es solo de documentación: no cambies código.

Objetivo: crear la carpeta **`docs/prompts/`** con prompts para un generador de imágenes (ChatGPT)
orientados a **rendimiento y estilo minimalista**: pocos detalles, colores planos, formas grandes,
legibles a baja resolución, coherentes con personajes cúbicos. Nada fotorrealista.

Estructura (un archivo por categoría, cada prompt completo y autónomo, en una tabla con: nombre de
archivo esperado, uso, dimensiones, formato, tileable sí/no, ruta destino, prompt):

1. `01-texturas-mapa.md`: las texturas de los materiales del mapa (`floor, metal, panel, grate,
   concrete, red, blue, trim, dark, ground`) a **128×128 o 256×256**, paleta limitada (4–6 colores por
   textura), sin ruido fino, estilo "pixel art limpio / low-poly plano". Mantén las reglas de vista
   ortográfica, sin luz horneada, sin texto, tileable y la comprobación 3×3. Añade variantes por
   tema para las arenas existentes.
2. `02-armas-atlas.md`: textura atlas de cada arma (formato definido en el prompt 04 si existe; si
   no, indica que está pendiente de plantilla UV y explica por qué).
3. `03-iconos-armas.md`: iconos de HUD por arma, 128×128 PNG transparente, silueta lateral de un
   color, sin texto.
4. `04-pickups-mapa.md`: texturas/sprites para los objetos recogibles (cápsula de salud, celda de
   escudo, munición, cada arma en pedestal), simples y reconocibles por color y forma. Los
   efectos emisivos (lava, portales, círculos de salto) van aparte, sobre negro.
5. `05-skins-personaje.md`: skins de personaje que respetan **exactamente** el layout de
   `docs/SKINS.md`, siempre adjuntando `client/public/assets/skins/template.png` como imagen de
   entrada; explica que sin la plantilla el resultado no encaja; incluye 6 ideas de skins
   originales (rojo, azul, neutro y 3 temáticas). Sin personajes de otros juegos ni marcas.
6. `06-portal-catalogo.md`: miniatura de la tarjeta de RealTournament en el portal (16:9,
   640×360) y logotipo de texto original (aquí sí se permite el texto "RealTournament").

Incluye al inicio de `docs/prompts/README.md` una guía corta: qué modelo de imagen usar, cómo
reducir a la resolución final con filtro "vecino más cercano" para el estilo pixelado, y cómo
registrar cada archivo en los `manifest.json` correspondientes. Actualiza `docs/ASSET_PROMPTS.md`
para que remita a esta carpeta.
