# Skins de personaje — RealTournament

Los personajes son figuras de bloques (cabeza, torso, brazos y piernas como prismas, casco con
visor, pechera y hombreras). **Toda la apariencia sale de un único PNG**: la *skin*. Este documento
define el formato, cómo se valida y cómo se usa en el juego.

## Resumen del formato

| | |
|---|---|
| Archivo | PNG, RGBA de 8 bits recomendado (también se aceptan gris, RGB e indexado; entrelazado Adam7 permitido) |
| Tamaño | **128×128 px** exactos, u opcionalmente **256×256 px** (mismo layout ×2) |
| Peso | máximo **48 KB** |
| Filtrado | `NearestFilter`, sin mipmaps (los píxeles se ven nítidos) |
| Transparencia | en las **capas exteriores**, alfa 0 = no hay capa (se ve lo de debajo) |
| Color de equipo | los píxeles con **alfa exactamente 254** se tiñen del color del equipo |
| Plantilla | `client/public/assets/skins/template.png` (`npm run skins:template` la regenera) |

El **layout** (qué rectángulo es cada cara de cada parte) está definido una sola vez en
`client/src/render/skinLayout.ts`. De ahí salen las UV de cada caja (`skinBox.ts`), la plantilla
(`scripts/skins.ts`) y las pruebas. Si cambias una región, cambian todos a la vez.

## Cómo se organiza: la "red" de cada caja

Cada parte es una caja de `ancho × alto × fondo` píxeles de skin. Sus seis caras se despliegan así:

```
          d       w       w
       +------+-------+-------+
       |      |  top  | bottom|            ocupa 2(w+d) × (d+h) px
       +------+-------+-------+------+
       | right| front |  left | back |
       +------+-------+-------+------+
          d       w       d       w
```

* `front` (frente) mira hacia donde mira el personaje (−Z).
* `right` y `left` son **el lado derecho e izquierdo del propio personaje** (visto de frente, su
  derecha queda a tu izquierda).
* `top` tiene su borde inferior pegado al frente; `bottom` tiene su borde superior pegado al frente.
* Las imágenes no se espejan: lo que dibujes en `front` se ve derecho y legible en el modelo.
* Los dos cuadrados de las esquinas de arriba (`d×d`) están vacíos y no se usan.

## Mapa de la imagen de 128×128

Cada carácter ≈ 2 px de ancho × 4 px de alto. Letras: `H` cabeza, `C` casco, `I` brazo izquierdo,
`T` torso, `P` pechera, `D` brazo derecho, `L` pierna izquierda, `M` pierna derecha, `O` hombrera
izquierda, `Q` hombrera derecha, `.` libre (puedes usarlo para notas, no se lee en el juego).

```
......HHHHHHHHHHHH.............CCCCCCCCCCCCC.........IIIIII.....   y=0
......HHHHHHHHHHHH.............CCCCCCCCCCCCC.........IIIIII.....
......HHHHHHHHHHHH.............CCCCCCCCCCCCC......IIIIIIIIIIII..
HHHHHHHHHHHHHHHHHHHHHHHH.......CCCCCCCCCCCCC......IIIIIIIIIIII..
HHHHHHHHHHHHHHHHHHHHHHHHCCCCCCCCCCCCCCCCCCCCCCCCCCIIIIIIIIIIII..
HHHHHHHHHHHHHHHHHHHHHHHHCCCCCCCCCCCCCCCCCCCCCCCCCCIIIIIIIIIIII..
........................CCCCCCCCCCCCCCCCCCCCCCCCCCIIIIIIIIIIII..
....TTTTTTTTTTTT.........PPPPPPPPPPPPP.......DDDDDD.............   y=26
....TTTTTTTTTTTT.........PPPPPPPPPPPPP....DDDDDDDDDDDD..........
TTTTTTTTTTTTTTTTTTTTPPPPPPPPPPPPPPPPPPPPPPDDDDDDDDDDDD..........
TTTTTTTTTTTTTTTTTTTTPPPPPPPPPPPPPPPPPPPPPPDDDDDDDDDDDD..........
TTTTTTTTTTTTTTTTTTTTPPPPPPPPPPPPPPPPPPPPPPDDDDDDDDDDDD..........
TTTTTTTTTTTTTTTTTTTT......................DDDDDDDDDDDD..........
TTTTTTTTTTTTTTTTTTTT............................................
....LLLLLL.......MMMMMM.......OOOOOOOO........QQQQQQQQ..........   y=54
....LLLLLL.......MMMMMM.......OOOOOOOO........QQQQQQQQ..........
LLLLLLLLLLLLLMMMMMMMMMMMMMOOOOOOOOOOOOOOOOQQQQQQQQQQQQQQQQ......
LLLLLLLLLLLLLMMMMMMMMMMMMM......................................
LLLLLLLLLLLLLMMMMMMMMMMMMM......................................
LLLLLLLLLLLLLMMMMMMMMMMMMM......................................
LLLLLLLLLLLLLMMMMMMMMMMMMM......................................
LLLLLLLLLLLLLMMMMMMMMMMMMM......................................   y=84
................................................................   y=88: libre
```

## Coordenadas exactas (128 px)

Cada celda es `(x,y) ancho×alto` de esa cara. Para 256 px multiplica **todo** por 2.

| Parte | Capa | Caja (ancho×alto×fondo) | `top` | `bottom` | `right` | `front` | `left` | `back` |
|---|---|---|---|---|---|---|---|---|
| Cabeza (`head`) | base | 12×12×12 | (12,0) 12×12 | (24,0) 12×12 | (0,12) 12×12 | (12,12) 12×12 | (24,12) 12×12 | (36,12) 12×12 |
| Casco (`helmet`) | exterior | 13×13×13 | (61,0) 13×13 | (74,0) 13×13 | (48,13) 13×13 | (61,13) 13×13 | (74,13) 13×13 | (87,13) 13×13 |
| Brazo izquierdo (`armL`) | base | 6×20×6 | (106,0) 6×6 | (112,0) 6×6 | (100,6) 6×20 | (106,6) 6×20 | (112,6) 6×20 | (118,6) 6×20 |
| Torso (`torso`) | base | 12×20×8 | (8,26) 12×8 | (20,26) 12×8 | (0,34) 8×20 | (8,34) 12×20 | (20,34) 8×20 | (28,34) 12×20 |
| Pechera (`chest`) | exterior | 13×12×9 | (49,26) 13×9 | (62,26) 13×9 | (40,35) 9×12 | (49,35) 13×12 | (62,35) 9×12 | (71,35) 13×12 |
| Brazo derecho (`armR`) | base | 6×20×6 | (90,26) 6×6 | (96,26) 6×6 | (84,32) 6×20 | (90,32) 6×20 | (96,32) 6×20 | (102,32) 6×20 |
| Pierna izquierda (`legL`) | base | 6×27×7 | (7,54) 6×7 | (13,54) 6×7 | (0,61) 7×27 | (7,61) 6×27 | (13,61) 7×27 | (20,61) 6×27 |
| Pierna derecha (`legR`) | base | 6×27×7 | (33,54) 6×7 | (39,54) 6×7 | (26,61) 7×27 | (33,61) 6×27 | (39,61) 7×27 | (46,61) 6×27 |
| Hombrera izquierda (`pauldronL`) | exterior | 8×6×8 | (60,54) 8×8 | (68,54) 8×8 | (52,62) 8×6 | (60,62) 8×6 | (68,62) 8×6 | (76,62) 8×6 |
| Hombrera derecha (`pauldronR`) | exterior | 8×6×8 | (92,54) 8×8 | (100,54) 8×8 | (84,62) 8×6 | (92,62) 8×6 | (100,62) 8×6 | (108,62) 8×6 |

* **Base**: siempre se dibuja. Un píxel transparente en una capa base queda como un **agujero**
  (no lo uses, salvo que quieras ese efecto).
* **Exterior** (casco, pechera, hombreras): son cajas ligeramente más grandes puestas por encima
  de las de base. **Alfa 0 = nada**, así que puedes dejar la cara abierta (por ejemplo, el casco
  deja ver la cabeza por debajo del visor) o quitar la capa por completo.
* Todo lo que está por debajo de `y = 88` está libre. La plantilla lo usa para su leyenda.

## Color de equipo

Los píxeles con **alfa 254** (visualmente idénticos a opacos) son la *zona de color de equipo*. Al
cargar la skin el juego los vuelve opacos y les aplica el color del jugador, multiplicado por su
brillo: píxeles **blancos** dan el color completo, grises dan versiones más oscuras (sombreado).

* En **Captura la bandera**: rojo o azul según el equipo.
* En **Deathmatch**: un color de acento distinto por jugador.

Casi todos los editores permiten fijar el alfa a 254: en Aseprite, un color con `A = 254`; en
GIMP/Krita, opacidad 99,6 %. La plantilla incluye la leyenda `ALFA 254 = COLOR EQUIPO`.

## Cargar la skin

1. En el **lobby** pulsa **Cargar skin** y elige tu PNG (o descarga la plantilla desde el mismo panel).
2. El cliente comprueba el archivo (PNG, 128×128 o 256×256, ≤ 48 KB, decodificable) y lo envía.
3. El **servidor lo vuelve a validar** y, si es correcto, lo retransmite a todos los jugadores de
   la sala; quien entra después también recibe las skins ya elegidas.
4. Tu skin se ve en tus brazos en primera persona y en tu personaje para los demás.
5. **Quitar** vuelve a la skin por defecto. Puedes cambiarla solo fuera de la partida y como mucho
   una vez por segundo.

Si el archivo no es válido, recibes un aviso (`Skin rechazada: …`) y se mantiene la anterior o la
skin por defecto. **No existen las URLs externas**: la única forma de tener skin es enviar los
bytes del PNG.

La skin vive **en la memoria del servidor mientras estás en la sala** y se descarta al salir (no
hay base de datos). Tu navegador la recuerda mientras no recargues la página, para reenviarla al
entrar en otra sala.

### Skins por defecto

Si no cargas ninguna (o la tuya falla), se usa `default_red.png` o `default_blue.png`: según el
equipo en CTF y alternadas por jugador en Deathmatch. Se generan con `npm run skins:template`
(`scripts/skins.ts`); puedes reemplazarlas por arte propio respetando el layout.

## Validación en el servidor

`server/src/skins.ts` (`validateSkinPng`) no confía en el cliente. Rechaza si:

* los datos no son bytes, están vacíos o pesan más de **48 KB** (se comprueba antes de decodificar);
* no tienen firma PNG o la cabecera `IHDR` es inválida o imposible (tipo de color/profundidad);
* el tamaño no es **exactamente** 128×128 o 256×256;
* falta `IEND`, o hay un chunk truncado o con **CRC** incorrecto, o un indexado sin paleta;
* el flujo zlib de `IDAT` no se puede descomprimir, no mide exactamente lo que dice la cabecera
  (la descompresión está limitada a ese tamaño: no hay "bombas") o tiene un filtro de línea inválido.

No se convierte a píxeles en el servidor: solo se valida la estructura y se retransmiten los
bytes originales. Pruebas: `tests/skins.test.ts` (validación) y `tests/skins.integration.test.ts`
(retransmisión con un servidor Colyseus real).

### Límite de mensaje WebSocket

Una skin viaja como **un único mensaje** de cliente a servidor. Por eso `NET.maxPayloadBytes`
(`shared/src/constants.ts`) se subió de **16 KB a 64 KB** (48 KB de PNG + cabecera del mensaje).
Los demás mensajes siguen siendo de unos pocos cientos de bytes; el abuso queda acotado por el
límite de 120 mensajes/s, el máximo de 48 KB validado y el de **1 skin por segundo y jugador**.

## El modelo y las hitboxes

Un píxel de skin = 3 cm (`MPP` en `client/src/render/characterModel.ts`). Las hitboxes del servidor
(`shared/src/combat.ts`, `PLAYER` en `constants.ts`) **no cambian**; el modelo se ajusta a ellas:

* cabeza 36 cm y casco 39 cm, centrados en `headCenter = 1,62 m`: dentro de la caja de cabeza (±20 cm);
* torso, brazos, hombreras y piernas dentro del ancho de la caja de cuerpo (±40 cm);
* altura total ≈ 1,8 m.

`tests/skinLayout.test.ts` lo comprueba (cabeza y casco dentro de `headBox`, resto dentro de
`bodyBox`), además de que las regiones del layout no se solapan y caben en la imagen a 128 y 256 px.

## Para desarrolladores

| Archivo | Papel |
|---|---|
| `client/src/render/skinLayout.ts` | Regiones de cada cara (fuente única), escalado a 256 px |
| `client/src/render/skinBox.ts` | Geometría de una caja con UV por cara (sin Three.js, testeada) |
| `client/src/render/characterModel.ts` | Medidas y posiciones del modelo (testeadas contra las hitboxes) |
| `client/src/render/skinTexture.ts` | Decodificar PNG, teñir zona de equipo, almacén de skins y texturas |
| `client/src/render/Character.ts` | Personaje de tercera persona (una malla por parte, un material) |
| `client/src/render/ViewArms.ts` | Brazos en primera persona (posiciones de las manos por arma) |
| `shared/src/skin.ts` | Límites (`SKIN`) y lectura de la cabecera PNG, común a cliente y servidor |
| `server/src/skins.ts`, `ArenaRoom.ts` | Validación y retransmisión |
| `scripts/skins.ts` | Generador de `template.png`, `default_red.png` y `default_blue.png` |

Si cambias el modelo de un arma, revisa `GRIPS` en `ViewArms.ts` (dónde agarra cada mano).
