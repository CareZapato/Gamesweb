import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    // listen on the LAN so other computers can open the dev client
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      // multi-page: the portal (/) is plain HTML/CSS/TS and never loads a game bundle.
      // Add one entry per game (client/<game>/index.html).
      input: {
        portal: resolve(import.meta.dirname, 'index.html'),
        realtournament: resolve(import.meta.dirname, 'realtournament/index.html'),
      },
    },
  },
});
