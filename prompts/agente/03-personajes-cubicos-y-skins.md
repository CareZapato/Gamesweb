Lee `README.md`, `docs/ARCHITECTURE.md` y `client/src/render/Character.ts`. Responde en español.

Objetivo: personajes de **estilo cúbico/voxel bien logrado** (tipo figura de bloques: cabeza, torso,
brazos y piernas como prismas con proporciones heroicas, hombreras y casco con visor), fáciles de
modelar, ligeros y **texturizables con un único archivo de skin**.

1. **Formato de skin** (documéntalo en `docs/SKINS.md` con un diagrama):
   - Un PNG de **128×128** px (opcional 256×256, mismo layout escalado ×2).
   - Layout fijo tipo "net": cada parte (cabeza, torso, brazo izq/der, pierna izq/der, casco/capa
     exterior opcional) ocupa una región con sus 6 caras (frente, atrás, izq, der, arriba, abajo)
     en posiciones exactas en píxeles. Define las regiones en código compartido
     `client/src/render/skinLayout.ts` y úsalas para generar las UVs de cada caja.
   - Píxeles transparentes en la capa exterior = sin capa. Filtrado `NearestFilter`, sin mipmaps.
   - Zona de color de equipo: píxeles con canal alfa 254 o una máscara aparte se tiñen de rojo/azul.
2. **Plantilla**: genera por código `client/public/assets/skins/template.png` (regiones
   coloreadas y rotuladas con el nombre de cada cara) y `default_red.png` / `default_blue.png`
   simples. Añade un script `npm run skins:template` que la regenere.
3. **Carga por jugador**: en el lobby, botón "Cargar skin" (PNG). Validación en cliente y en
   servidor: tamaño exacto 128×128 o 256×256, PNG, máximo 48 KB, decodificable. El servidor la
   retransmite a los jugadores de esa sala (en memoria, se descarta al salir; respeta
   `maxPayload` subiéndolo solo si hace falta y documentándolo). Si falla, usa la skin por
   defecto. No permitas URLs externas.
4. El personaje de primera persona muestra los brazos con la skin.
5. Hitboxes del servidor **no cambian** (`shared/src/combat.ts`); el modelo visual debe cuadrar
   con ellas (cabeza dentro de la caja de cabeza).
6. Tests: unitario del layout (regiones sin solapes y dentro de la imagen) y de la validación de
   skins en servidor (rechaza tamaño, formato o peso incorrecto).

Criterios: typecheck, test, build, e2e en verde; captura de pantalla con dos skins distintas.
