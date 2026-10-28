# weapon_2.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `weapon_2.png` |
| Arma | Aguja Lumen (WeaponId 2) |
| Uso | Icono HUD / rueda de armas |
| Clave `manifest.json` | `"2"` |
| Dimensiones | 128×128 px |
| Formato | PNG RGBA |
| Fondo | **Transparente** (alfa 0) |
| Tileable | No |
| Ruta destino | `client/public/assets/icons/weapons/weapon_2.png` |

## Qué es en el juego
Pictograma para identificar el arma Aguja Lumen en la interfaz.

## Reglas (obligatorias)
- **128×128** PNG **RGBA** con **fondo transparente** (HUD superpone el icono).
- **Silueta lateral derecha**, un color de relleno + contorno negro opcional 2 px.
- **Sin texto** ni números.
- Fuera de la silueta: **alfa 0** (no gris, no blanco, no checkerboard).

## Prompt
Icono minimalista 128×128: Fusil muy largo, rectángulo de mira encima. Silueta perfil derecho, relleno sólido #7DFF6A, formas gruesas (pictograma), sin texto, sin sombras. Exportar PNG RGBA: fondo 100% transparente (alfa 0 en todo píxel fuera del dibujo); la silueta/objeto con alfa opaco.
