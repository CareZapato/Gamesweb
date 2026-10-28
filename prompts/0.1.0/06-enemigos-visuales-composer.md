# Fase 06 — Enemigos visuales (Composer)

## Objetivo

Diferenciar zombies **sin PNG nuevos**.

## Tareas

1. `Character.ts` o helper `ZombieCharacter`: parámetros `scale`, `tint`, opcional `emissive` verde apagado.
2. Cliente: renderizar horda desde snapshots (flags `PF.Zombie` + byte arquetipo si hace falta).
3. Coloso/bruto: escalas 1.25 / 1.5 según arquetipo.
4. No añadir animaciones nuevas; reutilizar walk cycle existente.

## Verificación

En partida se distinguen al menos caminante vs bruto por tamaño/color.
