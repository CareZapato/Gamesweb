import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/prompts');

/** Frases estándar al final del prompt copiable al generador. */
const SUFFIX_OPAQUE_RGB =
  ' Exportar PNG opaco (RGB o RGBA con alfa 255 en todos los píxeles): sin transparencia, sin fondo transparente, sin checkerboard.';
const SUFFIX_TRANSPARENT =
  ' Exportar PNG RGBA: fondo 100% transparente (alfa 0 en todo píxel fuera del dibujo); la silueta/objeto con alfa opaco.';
const SUFFIX_FX_OPAQUE_BLACK =
  ' Exportar PNG opaco: el negro #000000 debe ser color sólido con alfa 255, nunca transparencia (el motor usa el negro como “sin emisión”).';
const SUFFIX_SKIN_RGBA =
  ' Exportar PNG RGBA: no uses lienzo totalmente transparente; pinta solo dentro de la plantilla; alfa 0 únicamente en huecos previstos (visor, etc.); resto opaco.';
const SUFFIX_WEAPON_ATLAS =
  ' Exportar PNG opaco: rellena el cuadrado 128×128 completo (zonas sin pintar en gris neutro #404448 opaco); sin transparencia.';

const MAP_RULES = `## Reglas de generación (obligatorias)
- **Estilo:** albedo plano, ultra limpio; **2–3 colores sólidos**; sin ruido, sin degradados, sin relieves (no rombos/antideslizante denso, no remaches, no ventilas).
- **Vista:** ortográfica; suelo/rejilla/terreno = **cenital** perpendicular; paredes = frontal.
- **Fondo:** **opaco** en toda la imagen (material de mapa; Three.js repite el tile).
- **Sin** texto, números, logotipos ni marcas de agua.
- **Tileable** en los cuatro lados (lo que sale por un borde continúa en el opuesto).
- **Salida:** PNG sRGB **128×128** px (si generas más grande, escala con **vecino más cercano**).
- **Validar:** cuadrícula **3×3** de la imagen; rechazar si hay costura visible.`;

function mapDoc(t) {
  const variant = t.variantNote ? `\n${t.variantNote}` : '';
  return `# ${t.file}

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | \`${t.file}\` |
| Uso en el juego | ${t.use} |
| Material (\`manifest.json\`) | \`${t.material}\` |
| Escala en mundo | ${t.scale} |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (sin transparencia) |
| Tileable | Sí |
| Ruta destino | \`${t.dest}\` |

## Qué es en el juego
${t.context}${variant}

${MAP_RULES}

## Prompt (copiar al generador de imágenes)
${t.prompt}${SUFFIX_OPAQUE_RGB}
`;
}

const textures = [
  {
    file: 'floor_antislip.png',
    material: 'floor',
    use: 'Suelo interior: pasillos y plataformas (Foundry, Twin Dam, interiores)',
    scale: '2×2 m por repetición',
    dest: 'client/public/assets/textures/floor_antislip.png',
    context:
      'Material **floor**: donde camina el jugador en instalaciones cerradas. Superficie industrial **muy simple**.',
    prompt:
      'Textura tileable 128×128, vista cenital ortográfica, albedo plano. Relleno gris azulado sólido #3B4048. Solo líneas de junta negras #1A1D22 en cuadrícula 4×4 (líneas de 1 px, celdas 32×32). Sin patrón antideslizante, sin rombos, sin diamantes, sin relieve. Exactamente 3 colores. Sin texto. Bordes tileables perfectos.',
  },
  {
    file: 'metal_plate.png',
    material: 'metal',
    use: 'Pilares, plataformas, rampas metálicas',
    scale: '2×2 m',
    dest: 'client/public/assets/textures/metal_plate.png',
    context: 'Material **metal**: estructura industrial.',
    prompt:
      'Textura tileable 128×128, vista frontal ortográfica, albedo plano. Cuadrícula 2×2 de placas gris plano #5A626C separadas por juntas #1A1D22 de 2 px. Sin remaches, sin arañazos. 3 colores. Sin texto. Tileable.',
  },
  {
    file: 'wall_panel.png',
    material: 'panel',
    use: 'Paredes interiores modulares',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/wall_panel.png',
    context: 'Material **panel**: muros de pasillos y salas.',
    prompt:
      'Textura tileable 128×128, vista frontal ortográfica, albedo plano. Fondo gris #454B55. Una franja horizontal naranja #B85A1E de 8 px en el centro vertical. Una línea vertical de junta #2A2E35 en x=64. Sin ventilas. 3 colores. Sin texto. Tileable.',
  },
  {
    file: 'grate.png',
    material: 'grate',
    use: 'Pasarelas de rejilla',
    scale: '2×2 m',
    dest: 'client/public/assets/textures/grate.png',
    context: 'Material **grate**: suelo de rejilla; huecos negros opacos (no transparencia).',
    prompt:
      'Textura tileable 128×128, vista cenital ortográfica, albedo plano. Fondo negro #121418. Cinco barras verticales grises #5A5F66, grosor 6 px, separación uniforme. Sin travesaños finos. 2–3 colores. Sin texto. Tileable.',
  },
  {
    file: 'concrete_tech.png',
    material: 'concrete',
    use: 'Muros gruesos, bases, bloques exteriores',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/concrete_tech.png',
    context: 'Material **concrete**: hormigón técnico.',
    prompt:
      'Textura tileable 128×128, vista frontal ortográfica, albedo plano. Color único #6D6B66. Solo cruz de junta #4A4844 (líneas 2 px en centro). Sin manchas ni grietas. 2–3 colores. Sin texto. Tileable.',
  },
  {
    file: 'team_red.png',
    material: 'red',
    use: 'Superficies base roja (CTF)',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/team_red.png',
    context: 'Material **red**: zona equipo rojo.',
    prompt:
      'Textura tileable 128×128, vista frontal ortográfica, albedo plano. Interior rojo #C33A2A. Marco perimetral 8 px #7A1C1C. Sin símbolos. 2 colores. Sin texto. Tileable.',
  },
  {
    file: 'team_blue.png',
    material: 'blue',
    use: 'Superficies base azul (CTF)',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/team_blue.png',
    context: 'Material **blue**: zona equipo azul; misma composición que roja.',
    prompt:
      'Textura tileable 128×128, vista frontal ortográfica, albedo plano. Interior azul #2F5CC0. Marco 8 px #1B2F6E. 2 colores. Sin texto. Tileable.',
  },
  {
    file: 'hazard_trim.png',
    material: 'trim',
    use: 'Franjas de advertencia en bordes y dinteles',
    scale: '1×1 m',
    dest: 'client/public/assets/textures/hazard_trim.png',
    context: 'Material **trim**: amarillo/negro de seguridad.',
    prompt:
      'Textura tileable 128×128, vista frontal ortográfica, albedo plano. Franjas a 45° alternando amarillo #E0B020 y negro #1A1A1A, 4 bandas por repetición. 2 colores. Sin texto. Tileable.',
  },
  {
    file: 'dark_metal.png',
    material: 'dark',
    use: 'Techos y zonas superiores oscuras',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/dark_metal.png',
    context: 'Material **dark**: techos poco iluminados.',
    prompt:
      'Textura tileable 128×128, vista frontal ortográfica, albedo plano. Relleno #1D2027. Línea vertical y horizontal centradas #121418 de 1 px. 2–3 colores. Sin texto. Tileable.',
  },
  {
    file: 'ground_outdoor.png',
    material: 'ground',
    use: 'Suelo exterior (Outpost, Tres Torres)',
    scale: '6×6 m',
    dest: 'client/public/assets/textures/ground_outdoor.png',
    context: 'Material **ground**: tierra exterior.',
    prompt:
      'Textura tileable 128×128, vista cenital ortográfica, albedo plano. Damero 2×2 alternando #6B5A45 y #5E5040 (celdas 64×64). Sin grava ni piedras. 2 colores. Sin texto. Tileable.',
  },
  {
    file: 'floor_outpost_dust.png',
    material: 'floor',
    use: 'Suelo mapa Puesto Avanzado',
    scale: '2×2 m',
    dest: 'client/public/assets/textures/floor_outpost_dust.png',
    context: 'Variante de **floor** para exterior árido.',
    variantNote: 'En `manifest.json` la clave es `floor` (solo cambia el archivo).',
    prompt:
      'Textura tileable 128×128, cenital, albedo plano. Beige gris #6A6258. Juntas #4A4540: una vertical y una horizontal (2×2). Sin antideslizante. 2–3 colores. Sin texto. Tileable.',
  },
  {
    file: 'ground_outpost.png',
    material: 'ground',
    use: 'Terreno Puesto Avanzado',
    scale: '6×6 m',
    dest: 'client/public/assets/textures/ground_outpost.png',
    context: 'Variante de **ground**.',
    variantNote: 'Clave manifest: `ground`.',
    prompt:
      'Textura tileable 128×128, cenital, albedo plano. Base #5E5040. Tres parches rectangulares #6E6050 (≥24×24 px), simétricos para tile. 2–3 colores. Sin texto. Tileable.',
  },
  {
    file: 'concrete_tower.png',
    material: 'concrete',
    use: 'Hormigón Tres Torres',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/concrete_tower.png',
    context: 'Variante **concrete** para torres.',
    variantNote: 'Clave manifest: `concrete`.',
    prompt:
      'Textura tileable 128×128, frontal, albedo plano. Base #5A5650. Tres franjas horizontales #6E6A62 (8 px). 2 colores. Sin texto. Tileable.',
  },
  {
    file: 'panel_tower_band_amber.png',
    material: 'panel',
    use: 'Pared torre ámbar (Tres Torres)',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/panel_tower_band_amber.png',
    context: 'Variante **panel** con acento ámbar.',
    variantNote: 'Clave manifest: `panel`.',
    prompt:
      'Textura tileable 128×128, frontal, albedo plano. Fondo gris #454B55. Banda horizontal ámbar #D4A017 de 12 px en el centro. 2 colores. Sin texto. Tileable.',
  },
  {
    file: 'panel_tower_band_cyan.png',
    material: 'panel',
    use: 'Pared torre cian',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/panel_tower_band_cyan.png',
    context: 'Variante **panel** cian.',
    variantNote: 'Clave manifest: `panel`.',
    prompt:
      'Textura tileable 128×128, frontal, albedo plano. Fondo gris #454B55. Banda cian #2EC4C8 de 12 px en el centro. 2 colores. Sin texto. Tileable.',
  },
  {
    file: 'panel_tower_band_violet.png',
    material: 'panel',
    use: 'Pared torre violeta',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/panel_tower_band_violet.png',
    context: 'Variante **panel** violeta.',
    variantNote: 'Clave manifest: `panel`.',
    prompt:
      'Textura tileable 128×128, frontal, albedo plano. Fondo gris #454B55. Banda violeta #8B6BFF de 12 px en el centro. 2 colores. Sin texto. Tileable.',
  },
  {
    file: 'panel_gateways_clean.png',
    material: 'panel',
    use: 'Paredes mapa Pasarelas',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/panel_gateways_clean.png',
    context: 'Variante **panel** interior limpio (puertas/portales son geometría).',
    variantNote: 'Clave manifest: `panel`.',
    prompt:
      'Textura tileable 128×128, frontal, albedo plano. Gris #525A66. Juntas 2×2 #3A4049 de 1 px. Sin dibujos de puerta. 2–3 colores. Sin texto. Tileable.',
  },
  {
    file: 'panel_lava_foundry.png',
    material: 'panel',
    use: 'Pared cilindro Pozo de Lava',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/panel_lava_foundry.png',
    context: 'Variante **panel** oscura; la lava brilla por shader, no en esta textura.',
    variantNote: 'Clave manifest: `panel`.',
    prompt:
      'Textura tileable 128×128, frontal, albedo plano. Marrón oscuro #2A2420. Juntas 2×2 #1A1512. Sin brillo naranja. 2 colores. Sin texto. Tileable.',
  },
  {
    file: 'metal_lava_walkway.png',
    material: 'metal',
    use: 'Pasarelas anillares Pozo de Lava',
    scale: '2×2 m',
    dest: 'client/public/assets/textures/metal_lava_walkway.png',
    context: 'Variante **metal** cálida para pasarelas.',
    variantNote: 'Clave manifest: `metal`.',
    prompt:
      'Textura tileable 128×128, albedo plano. Gris cálido #5A5048. Juntas 2×2 #3A3530. Sin remaches. 2–3 colores. Sin texto. Tileable.',
  },
  {
    file: 'floor_foundry.png',
    material: 'floor',
    use: 'Suelo mapa Fundición',
    scale: '2×2 m',
    dest: 'client/public/assets/textures/floor_foundry.png',
    context: 'Variante **floor** fría con juntas acento óxido.',
    variantNote: 'Clave manifest: `floor`.',
    prompt:
      'Textura tileable 128×128, cenital, albedo plano. Relleno #363A42. Juntas cuadrícula 4×4 #8A4A22 de 1 px. Sin rombos. 3–4 colores. Sin texto. Tileable.',
  },
  {
    file: 'concrete_twin_dam.png',
    material: 'concrete',
    use: 'Hormigón Presa Gemela',
    scale: '4×4 m',
    dest: 'client/public/assets/textures/concrete_twin_dam.png',
    context: 'Variante **concrete** dos tonos.',
    variantNote: 'Clave manifest: `concrete`.',
    prompt:
      'Textura tileable 128×128, frontal, albedo plano. Mitad izquierda #5E6268, mitad derecha #6A7580, corte vertical en x=64. 2 colores. Sin texto. Tileable.',
  },
];

const dirTex = path.join(root, 'textures');
fs.mkdirSync(dirTex, { recursive: true });
for (const t of textures) {
  fs.writeFileSync(path.join(dirTex, t.file.replace('.png', '.md')), mapDoc(t), 'utf8');
}

const WEAPON_RULES = `## Reglas (obligatorias)
- **Adjuntar:** \`client/public/assets/weapons/template_<clave>.png\` (\`npm run weapons:template\`).
- Pintar **solo dentro** de cada isla; no mover UVs.
- **128×128** PNG **opaco** (atlas UV completo); colores planos; sin ruido ni texto.
- **Sin** fondo transparente: el PNG debe cubrir las 128×128 px.`;

const weapons = [
  { file: 'atlas_rifle.png', key: 'rifle', id: 0, name: 'Carabina Tormenta', accent: '#2FD0FF', body: '#46505E', dark: '#23272E', grip: '#2B2622', desc: 'Carabina automática.' },
  { file: 'atlas_shotgun.png', key: 'shotgun', id: 1, name: 'Dispersor Ariete', accent: '#FF8A2A', body: '#5A4A3C', dark: '#2B2420', grip: '#3A2A1C', desc: 'Escopeta ancha.' },
  { file: 'atlas_sniper.png', key: 'sniper', id: 2, name: 'Aguja Lumen', accent: '#7DFF6A', body: '#384640', dark: '#1A1F1C', grip: '#25211C', desc: 'Fusil largo con visor.' },
  { file: 'atlas_rocket.png', key: 'rocket', id: 3, name: 'Lanzador Cometa', accent: '#FF3B3B', body: '#505648', dark: '#24281F', grip: '#2A2520', desc: 'Lanzacohetes tubo grueso.' },
  { file: 'atlas_grenade.png', key: 'grenade', id: 4, name: 'Mortero Grillo', accent: '#FFD23A', body: '#5A553C', dark: '#2A2818', grip: '#2A2520', desc: 'Lanzagranadas con tambor.' },
  { file: 'atlas_plasma.png', key: 'plasma', id: 5, name: 'Hilo Aurora', accent: '#B36BFF', body: '#3A4555', dark: '#1E2430', grip: '#252830', desc: 'Emisor de rayo continuo.' },
  { file: 'atlas_charge.png', key: 'charge', id: 6, name: 'Lanza Cuásar', accent: '#FF5FA8', body: '#3A3540', dark: '#1A1820', grip: '#28242A', desc: 'Francotirador de carga.' },
];

const dirW = path.join(root, 'weapons');
fs.mkdirSync(dirW, { recursive: true });
for (const w of weapons) {
  const md = `# ${w.file}

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | \`${w.file}\` |
| Arma | ${w.name} (WeaponId ${w.id}) |
| Clave \`manifest.json\` | \`${w.key}\` |
| Dimensiones | 128×128 px |
| Formato | PNG sRGB opaco |
| Fondo | **Opaco** (atlas completo) |
| Tileable | No (atlas UV) |
| Ruta destino | \`client/public/assets/weapons/${w.file}\` |
| Plantilla | \`client/public/assets/weapons/template_${w.key}.png\` |

## Qué es en el juego
Atlas del modelo cúbico del arma (1ª y 3ª persona). ${w.desc}

${WEAPON_RULES}

## Prompt (adjuntar plantilla)
Pinta sobre \`template_${w.key}.png\`. Ultra plano: cuerpo ${w.body}, oscuro ${w.dark}, empuñadura ${w.grip}, glow ${w.accent}. Sin degradados ni texto. 128×128.${SUFFIX_WEAPON_ATLAS}
`;
  fs.writeFileSync(path.join(dirW, w.file.replace('.png', '.md')), md, 'utf8');
}

const ICON_RULES = `## Reglas (obligatorias)
- **128×128** PNG **RGBA** con **fondo transparente** (HUD superpone el icono).
- **Silueta lateral derecha**, un color de relleno + contorno negro opcional 2 px.
- **Sin texto** ni números.
- Fuera de la silueta: **alfa 0** (no gris, no blanco, no checkerboard).`;

const icons = [
  { file: 'weapon_0.png', id: 0, name: 'Carabina Tormenta', color: '#2FD0FF', shape: 'Carabina alargada, cargador curvo abajo, culata corta.' },
  { file: 'weapon_1.png', id: 1, name: 'Dispersor Ariete', color: '#FF8A2A', shape: 'Escopeta corta y ancha, doble cañón como bloque grueso.' },
  { file: 'weapon_2.png', id: 2, name: 'Aguja Lumen', color: '#7DFF6A', shape: 'Fusil muy largo, rectángulo de mira encima.' },
  { file: 'weapon_3.png', id: 3, name: 'Lanzador Cometa', color: '#FF3B3B', shape: 'Tubo grueso horizontal, boca ensanchada.' },
  { file: 'weapon_4.png', id: 4, name: 'Mortero Grillo', color: '#FFD23A', shape: 'Cañón corto, tambor circular grande debajo.' },
  { file: 'weapon_5.png', id: 5, name: 'Hilo Aurora', color: '#B36BFF', shape: 'Emisor con tres anillos en el cañón.' },
  { file: 'weapon_6.png', id: 6, name: 'Lanza Cuásar', color: '#FF5FA8', shape: 'Dos raíles convergentes, culata en bloque.' },
];

const dirI = path.join(root, 'icons');
fs.mkdirSync(dirI, { recursive: true });
for (const ic of icons) {
  const md = `# ${ic.file}

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | \`${ic.file}\` |
| Arma | ${ic.name} (WeaponId ${ic.id}) |
| Uso | Icono HUD / rueda de armas |
| Clave \`manifest.json\` | \`"${ic.id}"\` |
| Dimensiones | 128×128 px |
| Formato | PNG RGBA |
| Fondo | **Transparente** (alfa 0) |
| Tileable | No |
| Ruta destino | \`client/public/assets/icons/weapons/${ic.file}\` |

## Qué es en el juego
Pictograma para identificar el arma ${ic.name} en la interfaz.

${ICON_RULES}

## Prompt
Icono minimalista 128×128: ${ic.shape} Silueta perfil derecho, relleno sólido ${ic.color}, formas gruesas (pictograma), sin texto, sin sombras.${SUFFIX_TRANSPARENT}
`;
  fs.writeFileSync(path.join(dirI, ic.file.replace('.png', '.md')), md, 'utf8');
}

const PICKUP_RULES = `## Reglas (obligatorias)
- **128×128** PNG **RGBA** con **fondo transparente** (sprite sobre el mundo 3D).
- **2–4 colores planos**, formas gruesas reconocibles a distancia.
- **Sin texto**.
- Fuera del objeto: **alfa 0**.`;

const pickups = [
  {
    file: 'pickup_health_small.png',
    use: 'Pickup salud +25 (cápsula pequeña)',
    dest: 'client/public/assets/pickups/pickup_health_small.png',
    context: 'Objeto **health** en mapa; núcleo rojo como en `WorldProps.ts`.',
    prompt:
      'Sprite 128×128: cápsula vertical simple, carcasa gris claro #F2F5F7 contorno grueso, tapas #D8DDE2, núcleo rojo plano #FF3A4A. Sin cruz médica, sin texto. Vista frontal, albedo plano.',
  },
  {
    file: 'pickup_health_big.png',
    use: 'Pickup salud +50',
    dest: 'client/public/assets/pickups/pickup_health_big.png',
    context: 'Objeto **healthBig**; ~35 % más grande, núcleo verde.',
    prompt:
      'Igual que cápsula pequeña pero más alta; núcleo verde #30FF70. Sin texto.',
  },
  {
    file: 'pickup_shield_small.png',
    use: 'Pickup escudo +50',
    dest: 'client/public/assets/pickups/pickup_shield_small.png',
    context: 'Objeto **shield**; hexágono plano azul.',
    prompt:
      'Sprite 128×128: hexágono azul #2A9CFF, borde claro grueso #BFE6FF. Distinto de cápsula. Sin texto. Frontal plano.',
  },
  {
    file: 'pickup_shield_big.png',
    use: 'Pickup escudo +100',
    dest: 'client/public/assets/pickups/pickup_shield_big.png',
    context: 'Objeto **shieldBig**; hexágono violeta con marco interior.',
    prompt:
      'Hexágono violeta #8A7AFF, borde #BFE6FF, hexágono interior más pequeño. Sin texto.',
  },
  {
    file: 'pickup_ammo_box.png',
    use: 'Pickup munición (franja color del arma en juego)',
    dest: 'client/public/assets/pickups/pickup_ammo_box.png',
    context: 'Objeto **ammo**; caja oliva con franja teñida por código.',
    prompt:
      'Sprite 128×128: caja rectangular oliva #3D4A32, franja superior gris neutro #808080 (el juego tiñe). Sin calibres ni texto. Vista 3/4 muy simple.',
  },
];

const dirP = path.join(root, 'pickups');
fs.mkdirSync(dirP, { recursive: true });
for (const p of pickups) {
  const md = `# ${p.file}

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | \`${p.file}\` |
| Uso | ${p.use} |
| Dimensiones | 128×128 px |
| Formato | PNG RGBA |
| Fondo | **Transparente** (alfa 0) |
| Tileable | No |
| Ruta destino | \`${p.dest}\` |

## Qué es en el juego
${p.context}

${PICKUP_RULES}

## Prompt
${p.prompt}${SUFFIX_TRANSPARENT}
`;
  fs.writeFileSync(path.join(dirP, p.file.replace('.png', '.md')), md, 'utf8');
}

const FX_RULES = `## Reglas (obligatorias)
- Máscara de **emisión**: negro puro **#000000** = sin brillo.
- **Fondo negro opaco** (alfa 255), **no** usar transparencia: el alpha del PNG no define la emisión.
- **Sin** mezclar con texturas de suelo/pared.
- Colores solo donde indique el prompt; portales/salto en escala de grises si se tiñen por código.`;

const fx = [
  {
    file: 'fx_lava_flow.png',
    use: 'Superficie lava animada (UV)',
    size: '256×256',
    tileable: 'Sí',
    dest: 'client/public/assets/fx/fx_lava_flow.png',
    context: 'Hazard lava en fondo del pozo; negro = costra sin emisión.',
    prompt:
      'Textura tileable 256×256 cenital: bloques grandes costra #000000 y magma plano #FF5A0A / #FFB020, bordes nítidos, sin humo. 4 colores. Sin texto. Tileable 3×3.',
  },
  {
    file: 'fx_portal_swirl.png',
    use: 'Disco central del portal',
    size: '256×256',
    tileable: 'No',
    dest: 'client/public/assets/fx/fx_portal_swirl.png',
    context: 'Portal en pared/suelo; el color lo aplica el motor.',
    prompt:
      'Máscara escala de grises 256×256: remolino circular de 5 brazos gruesos, centro blanco, fade a negro #000000 fuera del disco. Sin color. Sin texto. Margen negro 5%.',
  },
  {
    file: 'fx_portal_ring.png',
    use: 'Aro del portal',
    size: '256×256',
    tileable: 'No',
    dest: 'client/public/assets/fx/fx_portal_ring.png',
    context: 'Marco circular distinto de puerta rectangular.',
    prompt:
      'Máscara grises 256×256: anillo grueso segmentado en 6 partes, interior negro, fondo #000000. Sin color ni texto. Margen 6%.',
  },
  {
    file: 'fx_jump_circle.png',
    use: 'Círculo de salto en suelo',
    size: '256×256',
    tileable: 'No',
    dest: 'client/public/assets/fx/fx_jump_circle.png',
    context: 'Jump pad; se tiñe verde en juego.',
    prompt:
      'Máscara grises 256×256 cenital: anillo exterior grueso blanco, dos anillos interiores, tres chevrones sólidos al centro apuntando arriba. Fondo #000000. Sin texto.',
  },
  {
    file: 'fx_shield_hex.png',
    use: 'Destello escudo',
    size: '128×128',
    tileable: 'Sí',
    dest: 'client/public/assets/fx/fx_shield_hex.png',
    context: 'Feedback escudo al impacto/recogida.',
    prompt:
      'Tileable 128×128: rejilla hexagonal simple, bordes hex blancos finos, interior negro #000000. Sin color. Sin texto.',
  },
];

const dirFx = path.join(root, 'fx');
fs.mkdirSync(dirFx, { recursive: true });
for (const f of fx) {
  const md = `# ${f.file}

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | \`${f.file}\` |
| Uso | ${f.use} |
| Dimensiones | ${f.size} px |
| Formato | PNG opaco |
| Fondo | **Negro opaco** #000000 (sin transparencia) |
| Tileable | ${f.tileable} |
| Ruta destino | \`${f.dest}\` |

## Qué es en el juego
${f.context}

${FX_RULES}

## Prompt
${f.prompt}${SUFFIX_FX_OPAQUE_BLACK}
`;
  fs.writeFileSync(path.join(dirFx, f.file.replace('.png', '.md')), md, 'utf8');
}

const SKIN_RULES = `## Reglas (obligatorias)
- **Adjuntar:** \`client/public/assets/skins/template.png\` (\`npm run skins:template\`).
- **128×128** PNG RGBA, ≤ **48 KB**; layout exacto [SKINS.md](../../SKINS.md).
- **No** es un sprite con fondo transparente: el lienzo UV va **opaco** salvo huecos (visor, etc.) con **alfa 0**.
- **Alfa 254** en zonas de color de equipo; capas exteriores pueden usar alfa 0 donde no hay pieza.
- Colores planos; sin texto ni marcas.`;

const skins = [
  {
    file: 'default_red.png',
    title: 'skin_team_red',
    use: 'Skin por defecto equipo rojo / referencia CTF',
    dest: 'client/public/assets/skins/default_red.png',
    prompt:
      'Sobre template.png: armadura cúbica plana, zonas equipo alfa 254 en blanco/gris claro, base gris #5A626C, casco con visor oscuro, acento pechera naranja #B85A1E. 128×128, sin logos.',
  },
  {
    file: 'default_blue.png',
    title: 'skin_team_blue',
    use: 'Skin por defecto equipo azul',
    dest: 'client/public/assets/skins/default_blue.png',
    prompt:
      'Como roja pero franjas cian #2EC4C8; mismas zonas alfa 254. template.png obligatorio. 128×128.',
  },
  {
    file: 'skin_neutral_dm.png',
    title: 'skin_neutral_dm',
    use: 'Deathmatch neutro (teñido por jugador)',
    dest: 'docs/reference/skins/skin_neutral_dm.png',
    prompt:
      'template.png: gris acero #6E757E, hombreras y visor blanco alfa 254. Sin franjas de equipo. 128×128.',
  },
  {
    file: 'skin_foundry_worker.png',
    title: 'skin_foundry_worker',
    use: 'Temática Fundición',
    dest: 'docs/reference/skins/skin_foundry_worker.png',
    prompt:
      'template.png: overol marrón #5A4030, casco amarillo #D9A21B, hombreras alfa 254 ámbar #E0A030. 128×128 plano.',
  },
  {
    file: 'skin_tower_ranger.png',
    title: 'skin_tower_ranger',
    use: 'Temática Tres Torres',
    dest: 'docs/reference/skins/skin_tower_ranger.png',
    prompt:
      'template.png: verde oliva #4A5A38, hombreras alfa 254 violeta #8B6BFF, visor violeta. 128×128.',
  },
  {
    file: 'skin_gateway_runner.png',
    title: 'skin_gateway_runner',
    use: 'Temática Pasarelas',
    dest: 'docs/reference/skins/skin_gateway_runner.png',
    prompt:
      'template.png: traje #1E2430, líneas cian #2FD0FF gruesas en brazos, hombreras alfa 254 magenta #C040FF. 128×128.',
  },
];

const dirS = path.join(root, 'skins');
fs.mkdirSync(dirS, { recursive: true });
for (const s of skins) {
  const md = `# ${s.file}

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | \`${s.file}\` |
| Uso | ${s.use} |
| Dimensiones | 128×128 px |
| Formato | PNG RGBA (≤48 KB) |
| Fondo | **Opaco en UV** (alfa 0 solo en huecos de la plantilla) |
| Tileable | No |
| Ruta destino | \`${s.dest}\` |
| Plantilla | \`client/public/assets/skins/template.png\` |

## Qué es en el juego
Apariencia del personaje de bloques (1 PNG = todo el cuerpo).

${SKIN_RULES}

## Prompt
${s.prompt}${SUFFIX_SKIN_RGBA}
`;
  fs.writeFileSync(path.join(dirS, s.title + '.md'), md, 'utf8');
}

const portal = [
  {
    file: 'realtournament_card.png',
    use: 'Miniatura tarjeta portal 16:9',
    size: '640×360',
    dest: 'client/public/assets/portal/realtournament_card.png',
    format: 'PNG sRGB opaco',
    fondo: '**Opaco** (ilustración a sangre)',
    prompt:
      'Ilustración 640×360 plana: arena industrial simplificada, dos soldados cúbicos, bases roja/azul, cielo 3 tonos. Sin logos ajenos, sin texto en imagen. Formas grandes, pocos detalles.',
    suffix: SUFFIX_OPAQUE_RGB,
  },
  {
    file: 'realtournament_logo.png',
    use: 'Logotipo texto RealTournament',
    size: '512×128',
    dest: 'client/public/assets/portal/realtournament_logo.png',
    format: 'PNG RGBA',
    fondo: '**Transparente** (alfa 0 fuera del texto)',
    prompt:
      'Logotipo 512×128: texto exacto RealTournament, sans-serif gruesa, blanco #FFFFFF contorno #15171A, barra de la T naranja #FF8A2A. Sin slogans.',
    suffix: SUFFIX_TRANSPARENT,
  },
];

const dirPo = path.join(root, 'portal');
fs.mkdirSync(dirPo, { recursive: true });
for (const p of portal) {
  const md = `# ${p.file}

## Especificaciones
| Campo | Valor |
|---|---|
| Archivo | \`${p.file}\` |
| Uso | ${p.use} |
| Dimensiones | ${p.size} px |
| Formato | ${p.format} |
| Fondo | ${p.fondo} |
| Tileable | No |
| Ruta destino | \`${p.dest}\` |

## Qué es en el juego
Catálogo en \`client/src/catalog.ts\` / portal HTML.

## Reglas
- Aquí **sí** permitido el texto **RealTournament** (solo en el logo).
- Estilo plano, legible en miniatura.

## Prompt
${p.prompt}${p.suffix}
`;
  fs.writeFileSync(path.join(dirPo, p.file.replace('.png', '.md')), md, 'utf8');
}

console.log('Generated prompts in', root);
