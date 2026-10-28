# pickup_ammo_box.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `pickup_ammo_box.png` |
| Uso | Pickup munición (franja color del arma en juego) |
| Dimensiones | 128×128 px |
| Formato | PNG RGBA |
| Fondo | **Transparente** (alfa 0) |
| Tileable | No |
| Ruta destino | `client/public/assets/pickups/pickup_ammo_box.png` |

## Qué es en el juego
Objeto **ammo**; caja oliva con franja teñida por código.

## Reglas (obligatorias)
- **128×128** PNG **RGBA** con **fondo transparente** (sprite sobre el mundo 3D).
- **2–4 colores planos**, formas gruesas reconocibles a distancia.
- **Sin texto**.
- Fuera del objeto: **alfa 0**.

## Prompt
Sprite 128×128: caja rectangular oliva #3D4A32, franja superior gris neutro #808080 (el juego tiñe). Sin calibres ni texto. Vista 3/4 muy simple. Exportar PNG RGBA: fondo 100% transparente (alfa 0 en todo píxel fuera del dibujo); la silueta/objeto con alfa opaco.
