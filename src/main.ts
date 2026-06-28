// =====================================
// SVELTE ENTRY — Phase 3g
// The minimal WebView shell. Replaces src/main.tsx (legacy React).
// Mounts App.svelte into #app (declared in index.html).
// =====================================

import App from './lib/svelte/App.svelte';
import './lib/svelte/app.css';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Svelte mount target #app not found in index.html');
}

const app = new App({ target });

export default app;
