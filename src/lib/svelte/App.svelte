<script lang="ts">
  // =====================================
  // APP SHELL — Phase 3g
  // Minimal Svelte surface that exercises the IPC adapter (Phase 3f)
  // and mounts the legal page (Phase 3i) when the URL hash is #legal.
  //
  // Demonstrates:
  //   - isTauriRuntime() detection
  //   - runtimeGetState() IPC call
  //   - runtimeGetCorrelationId() IPC call
  //   - IpcError typed catch
  //   - Conditional mounting of Legal.svelte
  // =====================================

  import { onMount } from 'svelte';
  import { runtimeGetCorrelationId, runtimeGetState } from '../../../runtime/src-tauri/lib/ipc/commands';
  import { IpcError, isTauriRuntime } from '../../../runtime/src-tauri/lib/ipc/errors';
  import Legal from './Legal.svelte';

  let runtimeDetected = false;
  let phase = 'unknown';
  let correlationId = 'unavailable';
  let ipcError: string | null = null;
  let loaded = false;
  let showLegal = false;

  function syncHash(): void {
    showLegal = typeof window !== 'undefined' && window.location.hash === '#legal';
  }

  onMount(async () => {
    runtimeDetected = isTauriRuntime();
    if (!runtimeDetected) {
      loaded = true;
      syncHash();
      window.addEventListener('hashchange', syncHash);
      return;
    }
    try {
      const state = await runtimeGetState();
      phase = state.phase;
      correlationId = await runtimeGetCorrelationId();
    } catch (e) {
      ipcError = e instanceof IpcError ? `[${e.kind}] ${e.message}` : String(e);
    } finally {
      loaded = true;
      syncHash();
      window.addEventListener('hashchange', syncHash);
    }
  });
</script>

<main>
  <h1>Automation Kernel — Runtime Shell</h1>
  <p>Phase 3g: Svelte shell established. UI components to be built in subsequent phases.</p>

  <section>
    <h2>Runtime state</h2>
    {#if !loaded}
      <p>Loading…</p>
    {:else}
      <dl>
        <dt>Tauri runtime detected</dt>
        <dd>{runtimeDetected}</dd>
        <dt>Kernel phase</dt>
        <dd><code>{phase}</code></dd>
        <dt>Correlation ID</dt>
        <dd><code>{correlationId}</code></dd>
        {#if ipcError}
          <dt>IPC error</dt>
          <dd><code>{ipcError}</code></dd>
        {/if}
      </dl>
    {/if}
  </section>

  <section>
    <h2>IPC surface</h2>
    <p>Phase 3f adapter exposes 21 typed commands. None are invoked by this shell.</p>
    <ul>
      <li><code>runtime_*</code> — runtime state (3)</li>
      <li><code>window_*</code> — window management (7)</li>
      <li><code>settings_*</code> — desktop settings (4)</li>
      <li><code>session_*</code> — window session (3, not auth)</li>
      <li><code>log_*</code> — logging (2)</li>
      <li><code>config_*</code> — configuration (2)</li>
    </ul>
  </section>

  <section>
    <h2>Legal</h2>
    <p>Phase 3i: content relocated to the kernel tree.</p>
    <p>
      <a href="#legal">View Privacy Policy / Terms / Data Deletion</a>
    </p>
  </section>
</main>

{#if showLegal}
  <Legal />
{/if}
