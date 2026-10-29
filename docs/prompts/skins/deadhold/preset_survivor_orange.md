# preset_survivor_orange.png

| Campo | Valor |
|---|---|
| Archivo | `preset_survivor_orange.png` |
| Uso | Modelo predefinido jugador Deadhold (soldado referencia) |
| Dimensiones | 128×128 px |
| Ruta destino | `client/public/assets/skins/preset_survivor_orange.png` |
| Plantilla | `client/public/assets/skins/template.png` |
| Referencia visual | `docs/reference/deadhold/arena_reference.jpg` |

## Reglas

- Adjuntar **template.png** y opcionalmente **arena_reference.jpg**.
- Layout [SKINS.md](../../../SKINS.md); PNG ≤48 KB; UV opaco salvo huecos (visor alfa 0).
- Zona equipo: alfa **254** en placas que deben teñirse (usa blanco/gris claro).

## Prompt

Sobre template.png, skin 128×128 voxel/low-poly: soldado superviviente con armadura **gris carbón** #3d454f, **hombros y rodilleras naranja** #d85a00 / #ff8f33, **visor cian** #2fd0ff (rectángulo luminoso, hueco alfa 0 en visor interior si aplica), pechera con línea naranja, botas oscuras. Estilo bloques planos como arena_reference.jpg (chibi armado, sin caras realistas). Sin texto. Exportar PNG RGBA opaco en UV.
