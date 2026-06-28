import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

// Phase 3g: Svelte-only WebView. React + Vite's React plugin removed.
// The IPC adapter at src/lib/ipc/ (Phase 3f) is framework-agnostic
// and works as-is in a Svelte build.
//
// Build output: ./dist/ — Tauri's frontendDist points here.

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
