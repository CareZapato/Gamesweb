# pickup_health_small.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `pickup_health_small.png` |
| Uso | Pickup salud +25 (cápsula pequeña) |
| Dimensiones | 128×128 px |
| Formato | PNG RGBA |
| Fondo | **Transparente** (alfa 0) |
| Tileable | No |
| Ruta destino | `client/public/assets/pickups/pickup_health_small.png` |

## Qué es en el juego
Objeto **health** en mapa; núcleo rojo como en `WorldProps.ts`.

## Reglas (obligatorias)
- **128×128** PNG **RGBA** con **fondo transparente** (sprite sobre el mundo 3D).
- **2–4 colores planos**, formas gruesas reconocibles a distancia.
- **Sin texto**.
- Fuera del objeto: **alfa 0**.

## Prompt
Sprite 128×128: cápsula vertical simple, carcasa gris claro #F2F5F7 contorno grueso, tapas #D8DDE2, núcleo rojo plano #FF3A4A. Sin cruz médica, sin texto. Vista frontal, albedo plano. Exportar PNG RGBA: fondo 100% transparente (alfa 0 en todo píxel fuera del dibujo); la silueta/objeto con alfa opaco.
