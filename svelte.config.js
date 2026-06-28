import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Phase 3g: Svelte config. Minimal — preprocessing only.
// Component config (e.g. scoped style emission) lives here when
// future UI phases add it.
export default {
  preprocess: vitePreprocess(),
};
