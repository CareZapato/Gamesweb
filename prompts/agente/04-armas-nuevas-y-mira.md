Lee `README.md`, `docs/ARCHITECTURE.md`, `shared/src/weapons.ts`, `shared/src/combat.ts` y
`client/src/render/WeaponModels.ts`. Responde en español.

Objetivo: ampliar y mejorar el arsenal (de 5 a 7 armas), con apuntado con clic derecho.

1. **Rayo de plasma** (nueva, ranura 6, nombre original): haz continuo delgado hacia delante,
   hitscan por tick mientras se mantiene el clic, alcance medio (~30 m), daño por tick bajo,
   consume munición por tick, sin dispersión. Debe validarse en servidor como el resto (cadencia
   = tick, munición, origen, dirección) y usar la compensación de lag existente. Visual: línea
   fina brillante que se dibuja continua desde el cañón, con impacto de chispas.
2. **Segundo francotirador** (ranura 7, distinto de la Aguja Lumen actual): por ejemplo de carga
   (mantener clic carga 0–1,5 s, más daño cuanto más carga) o de cerrojo con penetración de un
   jugador. Elige una, justifica y deja ambas diferenciadas en rol.
3. **Apuntar con clic derecho en todas las armas**: reduce FOV según el arma (configurable en
   `weapons.ts`: `adsFov`, `adsSpreadMult`, `adsMoveMult`), reduce dispersión y velocidad de
   movimiento mientras se apunta. La dispersión y velocidad reducidas **deben aplicarse en la
   simulación compartida** (añade un bit `Aim` a los botones del input; actualiza `decodeInput`,
   límites de bits y tests) para que servidor y predicción coincidan. Los francotiradores muestran
   su mira de alcance; el resto, el arma alineada al centro (posición de viewmodel ADS).
4. **Rediseño visual de las 7 armas** en `WeaponModels.ts`: mismo estilo cúbico del juego,
   siluetas muy distintas, pocas piezas (≤ 12 mallas por arma, geometrías compartidas), material
   con un único atlas de textura por arma preparado para reemplazo (UVs por caja al estilo de las
   skins). Deja `client/public/assets/weapons/manifest.json` (null = placeholder) igual que el de
   texturas del mapa.
5. Teclas 1–7 y rueda; munición, sonidos procedurales y entradas del HUD para las nuevas armas.
6. Tests: plasma (daño por tick, munición, alcance, sin daño a compañeros en CTF), segundo
   francotirador (carga o penetración), ADS (input con bit Aim cambia dispersión y velocidad igual
   en cliente y servidor).

Criterios: typecheck, test, build, e2e en verde. Actualiza la tabla de armas en
`docs/ARCHITECTURE.md`.
