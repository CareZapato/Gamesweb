# Prompts para generar arte (ChatGPT / generador de imágenes) y sustitución de placeholders

> **Producción recomendada (128×128, ultra plano):** **[docs/prompts/](prompts/README.md)** — **un
> archivo `.md` por imagen PNG** (texturas, armas, iconos, pickups, fx, skins, portal), cada uno con
> especificaciones y prompt autónomo. Este documento conserva prompts detallados 1024² como referencia.

Todo el arte actual del juego es provisional y se genera en código: texturas procedurales
(`client/src/render/textures.ts`), personajes y armas hechos con primitivas
(`client/src/render/Character.ts`, `WeaponModels.ts`). Este documento contiene prompts listos
para pedir imágenes **originales** a un generador, y explica qué se puede usar directamente y qué
requiere trabajo 3D adicional.

Dirección artística común: **ciencia ficción industrial de finales de los 90**. Metal pavonado
gris azulado, hormigón técnico, acentos naranja óxido y amarillo de seguridad, luces cálidas de
sodio y tubos fríos; equipos rojo (#E03030) y azul (#2F6BFF). Formas robustas y legibles, nada de
estética de ningún juego concreto, sin logotipos, sin texto.

---

## A. Texturas tileables del escenario

### Reglas que aplican a todas

* Vista **ortográfica frontal**, plano perfectamente paralelo a la cámara.
* **Sin perspectiva, sin objetos sueltos, sin sombras direccionales, sin iluminación horneada,
  sin brillos especulares fuertes, sin viñeteado.** Iluminación plana y uniforme (albedo).
* **Sin texto, letras, números, marcas de agua, firmas ni logotipos.**
* **Bordes tileables**: lo que sale por un borde continúa exactamente por el opuesto.
* Paleta y escala coherentes entre todas (ver columna "Escala real").
* Resolución de salida 1024×1024 px, PNG (sRGB). Se puede reducir a 512 si pesa demasiado.

### Comprobación 3×3 (obligatoria antes de aceptar una textura)

1. Coloca la imagen 3×3 veces en una cuadrícula (cualquier editor; o en GIMP *Filtros → Mapa →
   Teselar*, o en Photoshop *Filtro → Otro → Desplazamiento* 50 %/50 % con "Ajustar alrededor").
2. Rechaza la imagen si se ve **cualquier costura**, salto de color o tono entre copias, un
   elemento que se corta en el borde, o un detalle muy llamativo que se repite de forma evidente.
3. Si la costura es pequeña, corrígela con el tampón de clonar sobre la versión desplazada 50 % y
   vuelve a comprobar.

Los generadores de imágenes **no garantizan** bordes perfectamente tileables aunque el prompt lo
pida: la comprobación 3×3 es la que decide.

### Tabla de texturas

Destino: `client/public/assets/textures/`. "Escala real" = metros del mundo que cubre una repetición
(definido en `TEXTURE_SCALE`, `client/src/render/textures.ts`).

| Archivo | Uso en el juego | Escala real | Dimensiones | Formato | Tileable | Ruta destino | Prompt completo |
|---|---|---|---|---|---|---|---|
| `floor_antislip.png` | Suelo principal (material `floor`) | 2 × 2 m | 1024×1024 | PNG sRGB | Sí, 4 lados | `client/public/assets/textures/floor_antislip.png` | Textura tileable sin costuras de chapa de acero antideslizante industrial de ciencia ficción, patrón de relieves en diamante o lágrima en cuadrícula regular, metal gris azulado oscuro con desgaste suave en los relieves, ligeras manchas de grasa y polvo distribuidas de forma uniforme. Vista ortográfica frontal exactamente perpendicular, sin perspectiva, iluminación plana y uniforme tipo albedo, sin sombras direccionales, sin iluminación horneada, sin reflejos especulares, sin objetos, sin texto, sin números, sin logotipos, sin marcas de agua. Los bordes deben continuar perfectamente en el lado opuesto para repetir en mosaico. Cubre 2×2 metros reales: cada relieve mide unos 3 cm. Paleta: grises azulados #2A2F36 a #5A626C. 1024×1024. |
| `metal_plate.png` | Estructuras, pilares, plataformas (`metal`) | 2 × 2 m | 1024×1024 | PNG sRGB | Sí | `client/public/assets/textures/metal_plate.png` | Textura tileable sin costuras de planchas de acero industrial atornilladas, cuatro placas rectangulares por repetición separadas por juntas finas, remaches pequeños en las esquinas, superficie de metal pavonado gris medio con arañazos finos y leves marcas de óxido naranja en las juntas, desgaste homogéneo. Vista ortográfica frontal, sin perspectiva, iluminación plana uniforme de albedo, sin sombras direccionales ni luz horneada, sin reflejos, sin objetos, sin texto, sin números, sin logotipos, sin marcas de agua. Bordes que encajan perfectamente al repetir. Cubre 2×2 metros. Paleta: grises #3B4048 a #6E757E, óxido #8A4A22 muy sutil. 1024×1024. |
| `wall_panel.png` | Paredes interiores (`panel`) | 4 × 4 m | 1024×1024 | PNG sRGB | Sí | `client/public/assets/textures/wall_panel.png` | Textura tileable sin costuras de paneles de pared modulares de una instalación industrial futurista, cuadrícula de 2×2 paneles grandes con biseles poco profundos, rejillas de ventilación horizontales en uno de los paneles, pequeñas tiras de acento naranja apagado, metal gris azulado con suciedad uniforme. Vista ortográfica frontal, sin perspectiva, iluminación plana tipo albedo, sin sombras direccionales, sin iluminación horneada, sin reflejos, sin objetos, sin texto, sin números, sin señales, sin logotipos, sin marcas de agua. Bordes perfectamente continuos al repetir. Cubre 4×4 metros: cada panel mide 2 m. Paleta: #2C323B a #59616D, acento #B85A1E. 1024×1024. |
| `grate.png` | Rejillas, pasarelas, rampas (`grate`) | 2 × 2 m | 1024×1024 | PNG sRGB (sin transparencia) | Sí | `client/public/assets/textures/grate.png` | Textura tileable sin costuras de rejilla metálica industrial de pletinas paralelas soldadas sobre travesaños, visto desde arriba, los huecos se ven como un fondo casi negro uniforme (no transparente), metal gris con bordes ligeramente pulidos por el uso. Vista ortográfica frontal perpendicular, sin perspectiva, iluminación plana uniforme, sin sombras direccionales, sin luz horneada, sin objetos debajo, sin texto, sin logotipos, sin marcas de agua. Bordes perfectamente continuos en mosaico. Cubre 2×2 metros: pletinas cada 4 cm. Paleta: metal #4A5058 a #7A818A, huecos #0E1013. 1024×1024. |
| `concrete_tech.png` | Muros exteriores y bases (`concrete`) | 4 × 4 m | 1024×1024 | PNG sRGB | Sí | `client/public/assets/textures/concrete_tech.png` | Textura tileable sin costuras de hormigón técnico futurista, losas prefabricadas grandes con juntas finas y marcas circulares de encofrado, poros pequeños, manchas de humedad suaves y uniformes, tono gris frío. Vista ortográfica frontal, sin perspectiva, iluminación plana tipo albedo, sin sombras direccionales, sin iluminación horneada, sin objetos, sin grafitis, sin texto, sin números, sin logotipos, sin marcas de agua. Bordes perfectamente continuos al repetir. Cubre 4×4 metros. Paleta: #4B4E52 a #7D8084. 1024×1024. |
| `team_red.png` | Superficies de la base roja (`red`) | 4 × 4 m | 1024×1024 | PNG sRGB | Sí | `client/public/assets/textures/team_red.png` | Textura tileable sin costuras de paneles de pared industriales pintados de rojo intenso para identificar una base de equipo, cuadrícula de 2×2 paneles con biseles, chevrones geométricos abstractos en relieve apuntando hacia arriba (sin letras ni símbolos reconocibles), pintura ligeramente desgastada mostrando metal oscuro en los bordes. Vista ortográfica frontal, sin perspectiva, iluminación plana uniforme, sin sombras direccionales, sin luz horneada, sin reflejos, sin objetos, sin texto, sin números, sin logotipos, sin marcas de agua. Bordes perfectamente continuos en mosaico. Cubre 4×4 metros. Paleta: rojo #B02424 a #E03030, metal #2A2D33. 1024×1024. |
| `team_blue.png` | Superficies de la base azul (`blue`) | 4 × 4 m | 1024×1024 | PNG sRGB | Sí | `client/public/assets/textures/team_blue.png` | Textura tileable sin costuras de paneles de pared industriales pintados de azul intenso para identificar una base de equipo, cuadrícula de 2×2 paneles con biseles, chevrones geométricos abstractos en relieve apuntando hacia arriba (sin letras ni símbolos reconocibles), pintura ligeramente desgastada mostrando metal oscuro en los bordes. Vista ortográfica frontal, sin perspectiva, iluminación plana uniforme, sin sombras direccionales, sin luz horneada, sin reflejos, sin objetos, sin texto, sin números, sin logotipos, sin marcas de agua. Bordes perfectamente continuos en mosaico. Cubre 4×4 metros. Paleta: azul #1F4FCC a #2F6BFF, metal #2A2D33. Debe ser idéntica en composición a la versión roja, solo cambia el color. 1024×1024. |
| `hazard_trim.png` | Bordes, barandillas, molduras (`trim`) | 1 × 1 m | 1024×1024 | PNG sRGB | Sí | `client/public/assets/textures/hazard_trim.png` | Textura tileable sin costuras de franjas diagonales de seguridad industrial a 45 grados alternando amarillo y negro, pintadas sobre metal, con desgaste y arañazos uniformes, sin bordes ni marcos. Vista ortográfica frontal, sin perspectiva, iluminación plana uniforme, sin sombras direccionales, sin luz horneada, sin objetos, sin texto, sin números, sin logotipos, sin marcas de agua. Las franjas deben continuar perfectamente en los cuatro bordes al repetir. Cubre 1×1 metro: 4 pares de franjas. Paleta: amarillo #D9A21B, negro #15171A. 1024×1024. |
| `dark_metal.png` | Techos y zonas de fondo (`dark`) | 4 × 4 m | 1024×1024 | PNG sRGB | Sí | `client/public/assets/textures/dark_metal.png` | Textura tileable sin costuras de paneles de techo industrial muy oscuros, cuadrícula regular de placas con tornillos y conductos planos integrados, metal casi negro mate con polvo uniforme, bajo contraste. Vista ortográfica frontal, sin perspectiva, iluminación plana uniforme, sin sombras direccionales, sin luz horneada, sin reflejos, sin objetos, sin texto, sin números, sin logotipos, sin marcas de agua. Bordes perfectamente continuos al repetir. Cubre 4×4 metros. Paleta: #121418 a #2A2E35. 1024×1024. |
| `ground_outdoor.png` | Terreno exterior de Puesto Avanzado y Tres Torres (`ground`) | 6 × 6 m | 1024×1024 | PNG sRGB | Sí, 4 lados | `client/public/assets/textures/ground_outdoor.png` | Textura tileable sin costuras de terreno exterior de una zona industrial: tierra compactada marrón grisácea con grava fina dispersa, piedras pequeñas planas, huellas de neumático muy suaves y manchas de polvo más claras repartidas de forma uniforme, sin charcos, sin hierba alta, sin objetos. Vista cenital ortográfica exactamente perpendicular al suelo, sin perspectiva, iluminación plana y uniforme tipo albedo, sin sombras direccionales, sin iluminación horneada, sin reflejos, sin texto, sin números, sin logotipos, sin marcas de agua. Ningún elemento llamativo que se repita de forma evidente. Los bordes deben continuar perfectamente en el lado opuesto para repetir en mosaico. Cubre 6×6 metros reales: cada piedra mide entre 1 y 6 cm. Paleta: #4E4234 a #8A7760. 1024×1024. |
| `tower_concrete.png` (opcional, para sustituir `concrete` en Tres Torres) | Pilares de las torres | 4 × 4 m | 1024×1024 | PNG sRGB | Sí | `client/public/assets/textures/tower_concrete.png` | Textura tileable sin costuras de hormigón estructural visto de una torre industrial, encofrado de tablas horizontales con vetas suaves, juntas de hormigonado cada 2 m, pequeñas manchas de óxido que bajan de los anclajes, tono gris cálido. Vista ortográfica frontal, sin perspectiva, iluminación plana tipo albedo, sin sombras direccionales, sin luz horneada, sin objetos, sin grafitis, sin texto, sin números, sin logotipos, sin marcas de agua. Bordes perfectamente continuos al repetir. Cubre 4×4 metros. Paleta: #5A5650 a #8E8A82, óxido #7A4A2A muy sutil. 1024×1024. |
| `lava_rock_wall.png` (opcional, para el material `panel` del Pozo de Lava) | Pared del cilindro | 4 × 4 m | 1024×1024 | PNG sRGB | Sí | `client/public/assets/textures/lava_rock_wall.png` | Textura tileable sin costuras de paneles de pared de una fundición, metal grueso ennegrecido por el calor con vetas de pavonado azulado y marrón, juntas remachadas en una cuadrícula de 2×2, hollín uniforme. **Sin brillos ni resplandor de lava** (la luz de la lava la pone el motor). Vista ortográfica frontal, sin perspectiva, iluminación plana tipo albedo, sin sombras direccionales, sin iluminación horneada, sin reflejos, sin objetos, sin texto, sin logotipos, sin marcas de agua. Bordes perfectamente continuos al repetir. Cubre 4×4 metros. Paleta: #1E1A18 a #4A3E36. 1024×1024. |
| `emblem_red.png` | Emblema decorativo de la base roja (**pendiente de integración**: el código aún no tiene un material de decal) | No tileable (decal 2 × 2 m) | 1024×1024 | PNG con fondo transparente | No | `client/public/assets/textures/emblem_red.png` | Emblema original abstracto para un equipo rojo de un juego de ciencia ficción industrial: forma geométrica simétrica con un triángulo apuntando hacia arriba dentro de un anillo segmentado, líneas gruesas y legibles a distancia, rojo #E03030 con borde metálico oscuro. Vista frontal plana centrada, fondo totalmente transparente, sin perspectiva, sin sombras, sin texto, sin letras, sin números, sin parecido con logotipos, escudos o marcas existentes, sin marcas de agua. 1024×1024. |
| `emblem_blue.png` | Emblema de la base azul (**pendiente de integración**) | No tileable (decal 2 × 2 m) | 1024×1024 | PNG con fondo transparente | No | `client/public/assets/textures/emblem_blue.png` | Emblema original abstracto para un equipo azul de un juego de ciencia ficción industrial, misma construcción geométrica que el emblema rojo (triángulo dentro de un anillo segmentado) pero con el triángulo apuntando hacia abajo, líneas gruesas y legibles, azul #2F6BFF con borde metálico oscuro. Vista frontal plana centrada, fondo totalmente transparente, sin perspectiva, sin sombras, sin texto, sin letras, sin números, sin parecido con logotipos existentes, sin marcas de agua. 1024×1024. |

### Cómo sustituir las texturas provisionales

1. Guarda el PNG aprobado (tras la comprobación 3×3) en `client/public/assets/textures/`.
2. Edita `client/public/assets/textures/manifest.json` y cambia `null` por el nombre del archivo:

   ```json
   { "textures": { "floor": "floor_antislip.png", "metal": "metal_plate.png", "panel": null, ... } }
   ```

   Claves válidas: `floor, metal, panel, grate, concrete, red, blue, trim, dark, ground` (los
   nombres de material de `shared/src/map.ts`). Un archivo por material: `tower_concrete.png` o
   `lava_rock_wall.png` sustituyen a `concrete` o `panel` en **todos** los mapas.
3. Recarga la página (en desarrollo no hace falta reiniciar). Si un archivo falta o falla, el juego
   mantiene la textura procedural y avisa en la consola.

**Mapas normales / rugosidad**: no se piden al generador. Un "normal map" generado a partir de una
imagen de color sería una invención con iluminación incorrecta. Si se necesitan, deben derivarse
con una herramienta específica (p. ej. desde un mapa de alturas pintado a mano) y se integrarían
añadiendo `normalMap` en `applyTextureOverrides`; hoy no está implementado.

### Efectos emisivos (separados de las texturas de superficie)

Lava, portales y círculos de salto **no** son texturas de superficie: hoy son shaders animados
(`client/src/render/MapFeatures.ts`) dibujados encima de la geometría, y su brillo lo calcula el
motor. Por eso se piden como imágenes **aparte**, nunca mezcladas con el albedo de suelos o paredes:

* Las texturas de superficie (tabla de arriba) siguen las reglas de albedo: sin brillo, sin luz
  horneada, sin resplandor de lava ni halos de portal.
* Los efectos se piden como **máscaras o rampas en escala de grises o de color sobre negro puro**
  (negro = sin emisión), para usarlas con mezcla aditiva. No llevan fondo de escenario.
* Las tileables también pasan la comprobación 3×3; las que no son tileables (anillos, discos) se
  piden centradas con margen negro.
* Integración (pendiente): se cargarían como `map` de los materiales de `MapFeatures` en lugar del
  patrón procedural; el color de cada portal se sigue aplicando por código (`PortalDef.color`).

| Archivo | Uso | Tileable | Dimensiones | Formato | Ruta destino | Prompt completo |
|---|---|---|---|---|---|---|
| `fx_lava_flow.png` | Superficie animada de la lava (se desplaza por UV) | Sí, 4 lados | 1024×1024 | PNG sRGB, fondo opaco | `client/public/assets/fx/fx_lava_flow.png` | Textura tileable sin costuras de lava fundida vista desde arriba como mapa de emisión: zonas de magma muy brillante amarillo anaranjado separadas por placas de costra oscura casi negra con bordes incandescentes, patrón orgánico uniforme sin elementos que destaquen. Vista cenital ortográfica, sin perspectiva, sin sombras, sin reflejos del entorno, sin humo, sin chispas, sin objetos, sin texto, sin logotipos, sin marcas de agua. Las costras negras deben ser negro puro #000000 (sin emisión). Bordes que continúan perfectamente al repetir. Paleta: #000000, #3A0A02, #FF5A0A, #FFB020, #FFF2A0. 1024×1024. |
| `fx_portal_swirl.png` | Disco animado de los portales (se rota y se tiñe por código) | No (disco) | 1024×1024 | PNG en escala de grises sobre negro | `client/public/assets/fx/fx_portal_swirl.png` | Máscara de emisión en escala de grises de un remolino de energía circular visto de frente: espirales finas de cinco brazos que convergen en un núcleo blanco brillante, bordes que se desvanecen suavemente hasta negro antes del límite del círculo, simetría radial. Fondo negro puro #000000 fuera del disco, sin color (se tiñe en el juego), sin perspectiva, sin marco, sin objetos, sin texto, sin logotipos, sin marcas de agua. Centrado con un 5 % de margen negro. 1024×1024. |
| `fx_portal_ring.png` | Aro del portal (marco reconocible, distinto de una puerta) | No (anillo) | 1024×1024 | PNG en escala de grises sobre negro | `client/public/assets/fx/fx_portal_ring.png` | Máscara de emisión en escala de grises de un aro de energía circular visto de frente: anillo grueso con segmentos técnicos regulares y pequeños nodos brillantes cada 30 grados, halo suave hacia dentro y hacia fuera, interior negro. Fondo negro puro #000000, sin color, sin perspectiva, sin texto, sin logotipos, sin marcas de agua. Centrado con un 6 % de margen negro. 1024×1024. |
| `fx_jump_circle.png` | Círculo de salto en el suelo (pulsos concéntricos) | No (disco) | 1024×1024 | PNG en escala de grises sobre negro | `client/public/assets/fx/fx_jump_circle.png` | Máscara de emisión en escala de grises de una plataforma de impulso circular vista desde arriba: anillo exterior grueso y brillante, tres anillos concéntricos interiores más finos, tres chevrones en el centro apuntando hacia arriba de la imagen indicando dirección de lanzamiento, todo con brillo suave. Fondo negro puro #000000, sin color (se tiñe de verde en el juego), vista cenital ortográfica, sin perspectiva, sin texto, sin números, sin logotipos, sin marcas de agua. Centrado con un 5 % de margen negro. 1024×1024. |
| `fx_shield_hex.png` | Destello de escudo (impacto y recogida) | Sí, 4 lados | 512×512 | PNG en escala de grises sobre negro | `client/public/assets/fx/fx_shield_hex.png` | Textura tileable sin costuras de una rejilla hexagonal de energía como máscara de emisión: celdas hexagonales regulares con bordes finos brillantes y centros negros, intensidad uniforme. Fondo negro puro #000000, sin color, vista frontal ortográfica, sin perspectiva, sin texto, sin logotipos, sin marcas de agua. Bordes que continúan perfectamente al repetir. 512×512. |

---

## A2. Referencias de los mapas nuevos (para modelar o vestir la geometría)

Uso: **referencia visual para quien detalle los mapas**. No se importan al juego: la jugabilidad
(colisiones, rutas, alturas) la define la geometría simple de `shared/src/maps/*.ts` y no debe
cambiar al vestirla. Reglas: vista indicada en cada prompt, iluminación neutra, sin personajes,
sin texto, sin logotipos, diseño original. Ruta destino: `docs/reference/maps/`. 1536×1024, PNG.

| Archivo | Mapa | Prompt completo |
|---|---|---|
| `map_outpost_concept.png` | Puesto Avanzado (exterior) | Concept art original de una arena exterior de ciencia ficción industrial para un videojuego multijugador, vista aérea en tres cuartos a media altura: terreno de tierra compactada y grava entre muros de contención de hormigón altos, cielo abierto azul despejado, dos bases bajas de hormigón simétricas en extremos opuestos (una con paneles rojos, otra con paneles azules) con azoteas transitables y rampas exteriores, una pasarela metálica elevada sobre pilares de acero a un lado, contenedores apilados y un núcleo central de hormigón con rampas en el centro, un corredor cubierto de contenedores al otro lado. Alturas distintas y coberturas claras, lectura limpia de rutas. Iluminación diurna suave sin sombras duras, colores apagados con acentos rojo #E03030 y azul #2F6BFF. Sin personajes, sin vehículos, sin texto, sin logotipos, sin marcas de agua. |
| `map_towers_concept.png` | Tres Torres | Concept art original de tres torres industriales de hormigón y acero de tres plantas abiertas cada una, dispuestas en triángulo sobre una explanada de tierra, vista en tres cuartos al atardecer: forjados metálicos, rampas de rejilla entre plantas, pilares de hormigón en las esquinas, una banda luminosa de color distinto en cada torre (ámbar, cian y violeta), puentes estrechos de rejilla a media altura que unen las torres con una plataforma central, un puente más bajo que pasa por debajo. Iluminación de atardecer anaranjada suave sin sombras duras, cielo degradado de naranja a azul oscuro. Sin personajes, sin texto, sin logotipos, sin marcas de agua. |
| `map_gateways_portals.png` | Pasarelas: puertas y portales | Hoja de referencia original de elementos de un complejo interior de ciencia ficción industrial, cuatro viñetas sobre fondo gris neutro: (1) una puerta rectangular abierta en una pared de paneles metálicos con dintel de franjas amarillas y negras de seguridad, claramente un vano sin energía; (2) un portal circular en una pared con un aro luminoso naranja y un disco de remolino de energía; (3) un portal circular en el suelo como agujero con aro cian y remolino; (4) un portal circular magenta en una pared. Los portales deben distinguirse a simple vista de las puertas por su forma circular y su luz. Vista frontal y ligeramente elevada, iluminación neutra sin sombras duras. Sin personajes, sin texto, sin logotipos, sin marcas de agua. |
| `map_lava_shaft_concept.png` | Pozo de Lava | Concept art original del interior de un enorme pozo cilíndrico de una fundición de ciencia ficción, vista desde un anillo intermedio mirando a través del vacío: cinco pasarelas anulares metálicas a distintas alturas pegadas a la pared curva, puentes estrechos de rejilla que cruzan el vacío a distintas alturas (algunos se cruzan formando pequeñas plataformas, otros pasan uno sobre otro sin tocarse), círculos de impulso verdes luminosos en el suelo de los anillos, lava brillante naranja en el fondo iluminando las estructuras desde abajo, techo oscuro. Sin suelo seguro bajo los puentes. Atmósfera calurosa con ligera neblina, sin personajes, sin texto, sin logotipos, sin marcas de agua. |

---

## A3. Pickups de salud y escudo

Uso: **referencia para modelar** los objetos recogibles (hoy son primitivas en
`client/src/render/WorldProps.ts`). Deben distinguirse a distancia entre sí y de la munición:
**salud = cápsula médica vertical** (roja la pequeña, verde la grande), **escudo = celda hexagonal
de energía** (azul la pequeña, violeta la grande), **munición = caja rectangular** con franja del
color del arma. Ruta destino: `docs/reference/pickups/`. 1536×1024, PNG.

| Archivo | Prompt completo |
|---|---|
| `pickup_health_sheet.png` | Hoja de referencia de dos objetos recogibles originales para un videojuego de ciencia ficción industrial: cápsulas médicas futuristas verticales con carcasa de vidrio translúcido, tapas metálicas gris claro arriba y abajo y un núcleo líquido luminoso en el interior; a la izquierda la pequeña con núcleo rojo #FF3A4A, a la derecha la grande (un 35 % mayor) con núcleo verde #30FF70. Cada una en vista frontal y en vista de tres cuartos, sobre fondo gris claro liso, a la misma escala, iluminación neutra de estudio sin sombras duras. Formas simples y legibles a distancia. Sin cruces de organizaciones reales, sin texto, sin logotipos, sin marcas de agua. |
| `pickup_shield_sheet.png` | Hoja de referencia de dos objetos recogibles originales para un videojuego de ciencia ficción industrial: celdas de escudo de energía con forma de hexágono plano de canto, núcleo de energía translúcido y marco metálico claro; a la izquierda la pequeña en azul #2A9CFF, a la derecha la grande (un 35 % mayor) en violeta #8A7AFF con un segundo marco hexagonal interior. Cada una en vista frontal y en vista de tres cuartos, sobre fondo gris claro liso, a la misma escala, iluminación neutra de estudio sin sombras duras. Silueta claramente distinta de una cápsula médica y de una caja de munición. Sin texto, sin logotipos, sin marcas de agua. |

---

## B. Referencias de personaje (hoja de modelo)

Uso: **referencia para un modelador 3D**. No se importan al juego.

Reglas comunes: personaje humano original con armadura, complexión corpulenta y atlética; las tres
vistas (frente, perfil, espalda) **a la misma escala y altura**, alineadas en horizontal; misma pose
en A (brazos a ~45°) o en T en todas; fondo liso gris claro neutro; luz neutra uniforme sin sombras
duras; **sin armas ni objetos tapando el cuerpo**; manos abiertas y visibles; sin texto, sin
logotipos, sin marcas de agua.

| Archivo | Dimensiones | Formato | Ruta destino | Prompt completo |
|---|---|---|---|---|
| `character_red_sheet.png` | 1536×1024 | PNG | `docs/reference/character_red_sheet.png` | Hoja de modelo de personaje original para un videojuego de ciencia ficción industrial: soldado humano con armadura corporal modular, complexión corpulenta y atlética, casco cerrado con visor horizontal ancho, placas en hombros, pecho, antebrazos y espinillas, juntas de tejido técnico oscuro, cinturón con módulos, botas pesadas. Color principal de la armadura rojo #E03030 con placas secundarias gris metal y detalles naranja apagado. Tres vistas a la misma escala y altura alineadas horizontalmente: frente, perfil izquierdo y espalda, en pose A idéntica (brazos separados unos 45 grados, palmas visibles, piernas ligeramente abiertas). Sin armas, sin objetos en las manos, nada que tape el cuerpo. Fondo liso gris claro uniforme, iluminación neutra y plana de estudio sin sombras duras, estilo de concept art limpio y legible. Sin texto, sin etiquetas, sin números, sin logotipos, sin emblemas reconocibles, sin marcas de agua. Diseño original que no se parezca a personajes de juegos existentes. |
| `character_blue_sheet.png` | 1536×1024 | PNG | `docs/reference/character_blue_sheet.png` | Hoja de modelo de personaje original para un videojuego de ciencia ficción industrial: el mismo diseño exacto de soldado humano con armadura corporal modular (complexión corpulenta y atlética, casco cerrado con visor horizontal ancho, placas en hombros, pecho, antebrazos y espinillas, juntas de tejido técnico oscuro, cinturón con módulos, botas pesadas), pero con la armadura en azul #2F6BFF, placas secundarias gris metal y detalles cian apagado. Tres vistas a la misma escala y altura alineadas horizontalmente: frente, perfil izquierdo y espalda, en pose A idéntica (brazos separados unos 45 grados, palmas visibles, piernas ligeramente abiertas). Sin armas, sin objetos en las manos, nada que tape el cuerpo. Fondo liso gris claro uniforme, iluminación neutra y plana de estudio sin sombras duras, estilo de concept art limpio. Sin texto, sin etiquetas, sin números, sin logotipos, sin marcas de agua. Diseño original. |
| `character_neutral_sheet.png` (DM) | 1536×1024 | PNG | `docs/reference/character_neutral_sheet.png` | Hoja de modelo de personaje original para un videojuego de ciencia ficción industrial: el mismo soldado con armadura modular corpulenta (casco cerrado con visor ancho, placas en hombros, pecho, antebrazos y espinillas, juntas de tejido técnico, botas pesadas) en colores neutros gris acero y grafito, con las placas de hombros y el visor en un único color de acento fácilmente recoloreable (blanco liso). Tres vistas a la misma escala y altura alineadas: frente, perfil izquierdo, espalda, pose A idéntica, palmas visibles. Sin armas ni objetos. Fondo gris claro liso, iluminación neutra plana sin sombras duras. Sin texto, sin logotipos, sin marcas de agua. Diseño original. |

Comprobación: superpón las tres vistas; la cabeza, hombros, cintura, rodillas y pies deben estar a
la misma altura. Si no, regenera: el modelador no puede usar vistas incoherentes.

---

## C. Referencias de las siete armas

Lenguaje común de diseño: ciencia ficción industrial robusta, carcasas de metal pavonado gris
oscuro, piezas funcionales visibles (tornillos, disipadores), un **color de acento por arma**
coincidente con el del juego, siluetas muy distintas entre sí para reconocerlas a distancia. Cada
prompt pide **vista lateral** ortográfica y **vista en primera persona** en la misma imagen. Sin
texto, sin logotipos, sin parecido con armas reales concretas ni de otros juegos.

Ruta destino de todas: `docs/reference/weapons/`. Dimensiones 1536×1024, PNG.

| Archivo | Arma | Prompt completo |
|---|---|---|
| `w1_carabina_tormenta.png` | Carabina Tormenta (automática, acento cian) | Hoja de referencia de un arma original de ciencia ficción industrial llamada carabina automática ligera: cuerpo compacto y alargado de metal gris oscuro pavonado, cañón con disipador de calor de aletas, cargador curvo inferior, culata esquelética corta, mira óptica pequeña, tiras de luz cian #2FD0FF en los laterales. Mitad izquierda: vista lateral ortográfica completa del arma, perfil derecho, sobre fondo gris claro liso. Mitad derecha: la misma arma vista en primera persona desde detrás y a la derecha, sostenida por unas manos con guantes blindados gris oscuro, cañón apuntando al centro de la imagen. Iluminación neutra de estudio sin sombras duras. Siluetas limpias y legibles. Sin texto, sin números de serie, sin logotipos, sin marcas de agua, sin parecido con armas reales o de otros videojuegos. |
| `w2_dispersor_ariete.png` | Dispersor Ariete (escopeta, acento naranja) | Hoja de referencia de un arma original de ciencia ficción industrial tipo escopeta pesada de dos cañones paralelos superpuestos: cuerpo corto, ancho y macizo de metal gris oscuro, bocachas rectangulares grandes, guardamanos de bombeo con estrías, tambor lateral de cartuchos, detalles naranja #FF8A2A. Mitad izquierda: vista lateral ortográfica completa, perfil derecho, sobre fondo gris claro liso. Mitad derecha: la misma arma en primera persona desde detrás y a la derecha, sostenida por manos con guantes blindados, apuntando al centro. Iluminación neutra sin sombras duras. Silueta claramente distinta de un rifle: corta y ancha. Sin texto, sin logotipos, sin marcas de agua, sin parecido con armas reales o de otros videojuegos. |
| `w3_aguja_lumen.png` | Aguja Lumen (francotirador, acento verde lima) | Hoja de referencia de un arma original de ciencia ficción industrial tipo fusil de precisión de energía: cañón muy largo y fino con raíles paralelos, mira telescópica alargada, culata maciza con apoyo para la mejilla, bípode plegado, bobinas verdes luminosas #7DFF6A a lo largo del cañón, cuerpo gris oscuro. Mitad izquierda: vista lateral ortográfica completa, perfil derecho, sobre fondo gris claro liso. Mitad derecha: la misma arma en primera persona desde detrás y a la derecha, sostenida por manos con guantes blindados, apuntando al centro. Iluminación neutra sin sombras duras. Silueta la más larga de las cinco. Sin texto, sin logotipos, sin marcas de agua, sin parecido con armas reales o de otros videojuegos. |
| `w4_lanzador_cometa.png` | Lanzador Cometa (cohetes, acento rojo) | Hoja de referencia de un arma original de ciencia ficción industrial tipo lanzacohetes de hombro: tubo cilíndrico grueso de metal gris oscuro con anillos de refuerzo, boca ensanchada, empuñadura y gatillo bajo el tubo, mira lateral plegable, ventilación trasera con anillo rojo luminoso #FF3B3B, franja de advertencia roja. Mitad izquierda: vista lateral ortográfica completa, perfil derecho, sobre fondo gris claro liso. Mitad derecha: la misma arma en primera persona desde detrás y a la derecha, sostenida por manos con guantes blindados, apuntando al centro. Iluminación neutra sin sombras duras. Silueta tubular gruesa. Sin texto, sin logotipos, sin marcas de agua, sin parecido con armas reales o de otros videojuegos. |
| `w5_mortero_grillo.png` | Mortero Grillo (lanzagranadas, acento amarillo) | Hoja de referencia de un arma original de ciencia ficción industrial tipo lanzagranadas de tambor: cañón corto y ancho, tambor giratorio grande de seis recámaras bajo el cañón, cuerpo achaparrado de metal gris oscuro, asa superior de transporte, detalles amarillo #FFD23A. Mitad izquierda: vista lateral ortográfica completa, perfil derecho, sobre fondo gris claro liso. Mitad derecha: la misma arma en primera persona desde detrás y a la derecha, sostenida por manos con guantes blindados, apuntando al centro. Iluminación neutra sin sombras duras. Silueta compacta con tambor prominente. Sin texto, sin logotipos, sin marcas de agua, sin parecido con armas reales o de otros videojuegos. |
| `w6_hilo_aurora.png` | Hilo Aurora (rayo de plasma, acento violeta) | Hoja de referencia de un arma original de ciencia ficción industrial tipo emisor de energía continua: cuerpo estilizado y liso de metal gris azulado oscuro, tres bobinas anulares luminosas violeta #B36BFF a lo largo del cañón, emisor frontal de cristal, dos celdas de energía laterales, empuñadura corta. Mitad izquierda: vista lateral ortográfica completa, perfil derecho, sobre fondo gris claro liso. Mitad derecha: la misma arma en primera persona desde detrás y a la derecha, sostenida por manos con guantes blindados, apuntando al centro. Iluminación neutra sin sombras duras. Silueta con tres anillos prominentes. Sin texto, sin logotipos, sin marcas de agua, sin parecido con armas reales o de otros videojuegos. |
| `w7_lanza_cuasar.png` | Lanza Cuásar (francotirador de carga, acento rosa) | Hoja de referencia de un arma original de ciencia ficción industrial tipo lanza de precisión de carga: cuerpo oscuro y afilado con dos raíles paralelos que convergen en la punta, cámara de carga rosa luminosa #FF5FA8 sobre el cuerpo, mira telescópica corta con anillo luminoso, culata en bloque, sin cargador. Mitad izquierda: vista lateral ortográfica completa, perfil derecho, sobre fondo gris claro liso. Mitad derecha: la misma arma en primera persona desde detrás y a la derecha, sostenida por manos con guantes blindados, apuntando al centro. Iluminación neutra sin sombras duras. Silueta de lanza con raíles en punta. Sin texto, sin logotipos, sin marcas de agua, sin parecido con armas reales o de otros videojuegos. |

**Texturas de las armas (ya hay plantilla).** Cada arma usa un atlas de 128×128 (o 256×256 con el
mismo layout ×2) con una "red" de seis caras por caja, como las skins. `npm run weapons:template`
escribe `client/public/assets/weapons/template_<arma>.png`; píntala y apunta el archivo en
`client/public/assets/weapons/manifest.json` (`"rifle": "mi_rifle.png"`; `null` = placeholder).

---

## D. Qué es (y qué no es) una imagen de referencia

* Una **imagen de referencia** es un dibujo 2D para guiar a una persona. **No es un modelo 3D**,
  no tiene esqueleto (rig), ni UVs, ni animaciones, y no se puede "importar" como personaje.
* Una **textura UV** de personaje es una imagen cuya disposición depende de cómo se desplegó la
  malla concreta (sus *islas UV*). Solo se puede generar si se le da al generador la **plantilla UV
  exportada del modelo** como imagen de entrada y se le pide pintar respetando exactamente las
  islas. Sin esa plantilla, cualquier "textura de personaje" generada no encaja con ningún modelo.
  **Estado actual**: los personajes ya son figuras de bloques con **plantilla de skin propia**
  (`client/public/assets/skins/template.png`, formato en [SKINS.md](SKINS.md)): una skin de 128×128
  se pinta a mano o con IA adjuntando esa plantilla. Las **armas** también tienen
  plantilla de atlas (`npm run weapons:template`, ver la sección C). Un eventual modelo de personaje
  3D de alta resolución sigue **PENDIENTE** (no existe ese modelo ni su plantilla UV).
* Prompt base para cuando exista la plantilla (adjuntando `character_uv_template.png`): *"Pinta la
  textura de color (albedo) de este personaje sobre la plantilla UV adjunta, respetando exactamente
  la posición, forma y límites de cada isla, sin pintar fuera de ellas, fondo de las zonas vacías
  gris neutro #808080, iluminación plana sin sombras ni brillos horneados, sin texto ni logotipos,
  estilo y colores de la hoja de referencia adjunta."* Después hay que comprobar en el software 3D
  que cada parte cae en su sitio.
* No se deben generar "normal maps" con el generador de imágenes (ver sección A).

### Flujo de trabajo para personajes reales

1. **Modelado** (Blender, licencia GPL; el archivo resultante es tuyo) a partir de la hoja de
   referencia, en pose A, ~1,8 m de alto, con los pies en el origen y mirando a **−Z**
   (convención del juego). Objetivo: 3 000–8 000 triángulos (8 jugadores en pantalla, GPU integrada).
2. **UV**: desplegar sin solapes; exportar la plantilla UV (`UV → Export UV Layout`, PNG 2048×2048).
3. **Textura**: pintar a mano o usar el prompt de plantilla UV de arriba; 1024² o 2048² basta.
4. **Rig**: esqueleto humanoide simple (cadera, columna, cuello, cabeza, brazos, piernas). Hueso o
   punto de anclaje en la mano derecha para el arma y en la espalda para la bandera.
5. **Animaciones** mínimas: `idle`, `run` (bucle a 8,5 m/s), `jump`, `fall`, `dash`, `death`, y
   apuntado vertical (puede ser un hueso de columna rotado por código con el `pitch`).
6. **Exportar a glTF binario (`.glb`)**, Y arriba, escala en metros, con las animaciones incluidas.
   Validar con <https://github.khronos.org/glTF-Validator/> o el visor de three.js.
7. Colocar en `client/public/assets/models/character.glb`.

### Integrar el GLB (trabajo pendiente en el código)

Hoy `Character.ts` construye el cuerpo con cajas y anima las piernas por código. Para usar un GLB:

* Cargarlo una vez con `GLTFLoader` (`three/examples/jsm/loaders/GLTFLoader.js`) y clonar por
  jugador con `SkeletonUtils.clone` (`three/examples/jsm/utils/SkeletonUtils.js`).
* Sustituir en `Character` las mallas de caja por el clon, conservar la interfaz pública
  (`update`, `setWeapon`, `setCarrier`, `muzzleWorld`, `dispose`) para que `Game.ts` no cambie.
* Reproducir clips con `AnimationMixer` según velocidad, suelo, dash y vida.
* Colorear por equipo cambiando el color del material de acento (o un mapa de color por equipo).
* Mantener el placeholder como respaldo si la carga falla.

Las **colisiones y hitboxes no dependen del modelo**: el servidor usa cajas fijas
(`shared/src/combat.ts`). Cambiar el aspecto no cambia la jugabilidad.

Las armas en primera y tercera persona siguen el mismo proceso (`client/public/assets/models/
w1…w5.glb`, origen en la empuñadura, cañón hacia −Z, un nodo vacío llamado `muzzle` en la boca) y
sustituirían a `buildWeapon` en `WeaponModels.ts`.

### Sonidos

Los sonidos son síntesis procedural (`client/src/audio/Sfx.ts`). Para cambiarlos por grabaciones
propias o con licencia compatible (CC0, CC-BY con atribución), cargar archivos con `AudioBuffer`
en `Sfx` manteniendo los mismos nombres (`rifle`, `explosion`, `flagCapture`…). No uses sonidos de
otros juegos ni de bancos con licencia desconocida.
