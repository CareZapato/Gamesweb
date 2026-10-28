# weapon_1.png

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | `weapon_1.png` |
| Arma | Dispersor Ariete (WeaponId 1) |
| Uso | Icono HUD / rueda de armas |
| Clave `manifest.json` | `"1"` |
| Dimensiones | 128×128 px |
| Formato | PNG RGBA |
| Fondo | **Transparente** (alfa 0) |
| Tileable | No |
| Ruta destino | `client/public/assets/icons/weapons/weapon_1.png` |

## Qué es en el juego
Pictograma para identificar el arma Dispersor Ariete en la interfaz.

## Reglas (obligatorias)
- **128×128** PNG **RGBA** con **fondo transparente** (HUD superpone el icono).
- **Silueta lateral derecha**, un color de relleno + contorno negro opcional 2 px.
- **Sin texto** ni números.
- Fuera de la silueta: **alfa 0** (no gris, no blanco, no checkerboard).

## Prompt
Icono minimalista 128×128: Escopeta corta y ancha, doble cañón como bloque grueso. Silueta perfil derecho, relleno sólido #FF8A2A, formas gruesas (pictograma), sin texto, sin sombras. Exportar PNG RGBA: fondo 100% transparente (alfa 0 en todo píxel fuera del dibujo); la silueta/objeto con alfa opaco.
