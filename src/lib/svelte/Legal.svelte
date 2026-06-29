<script lang="ts">
  // =====================================
  // LEGAL PAGE — Phase 3i
  // Renders LEGAL_CONTENT (recovered from commit 025ca5f and relocated
  // to runtime/src-tauri/lib/content/legal.ts in the kernel tree).
  //
  // Three documents available via the tab control:
  //   - Privacy Policy
  //   - Terms of Service
  //   - Data Deletion Policy
  //
  // No routing — single component with internal tab state. The React
  // pages (privacypolicy.tsx, TermsOfService.tsx, DataDeletion.tsx)
  // that imported this content were purged in 3g.
  // =====================================

  import { LEGAL_CONTENT } from '../../../runtime/src-tauri/lib/content/legal';

  type LegalSection = {
    id: string;
    title: string;
    content: string;
  };

  type LegalDocument = {
    version: string;
    effectiveDate: string;
    lastUpdated: string;
    metaComplianceDate: string;
    title: string;
    sections: LegalSection[];
  };

  type TabKey = 'privacyPolicy' | 'termsOfService' | 'dataDeletionPolicy';

  const documents: Record<TabKey, LegalDocument> = {
    privacyPolicy: LEGAL_CONTENT.privacyPolicy as LegalDocument,
    termsOfService: LEGAL_CONTENT.termsOfService as LegalDocument,
    dataDeletionPolicy: LEGAL_CONTENT.dataDeletionPolicy as LegalDocument,
  };

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'privacyPolicy', label: 'Privacy Policy' },
    { key: 'termsOfService', label: 'Terms of Service' },
    { key: 'dataDeletionPolicy', label: 'Data Deletion' },
  ];

  let active: TabKey = 'privacyPolicy';
  $: doc = documents[active];

  // Strip the simple markdown-ish formatting from the recovered content
  // (paragraph breaks and inline emphasis). The original React pages
  // likely did this with a heavier library; here we keep it minimal.
  function paragraphs(raw: string): string[] {
    return raw
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
</script>

<main class="legal-page">
  <h1>Legal</h1>

  <nav class="tabs" aria-label="Legal documents">
    {#each tabs as tab (tab.key)}
      <button
        type="button"
        class:active={active === tab.key}
        on:click={() => (active = tab.key)}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  <article class="document">
    <header>
      <h2>{doc.title}</h2>
      <dl class="meta">
        <dt>Version</dt><dd>{doc.version}</dd>
        <dt>Effective</dt><dd>{doc.effectiveDate}</dd>
        <dt>Last updated</dt><dd>{doc.lastUpdated}</dd>
        {#if doc.metaComplianceDate}
          <dt>Meta compliance</dt><dd>{doc.metaComplianceDate}</dd>
        {/if}
      </dl>
    </header>

    {#each doc.sections as section (section.id)}
      <section id={section.id}>
        <h3>{section.title}</h3>
        {#each paragraphs(section.content) as para, i (i)}
          <p>{para}</p>
        {/each}
      </section>
    {/each}
  </article>
</main>

<style>
  .legal-page {
    padding: 2rem;
    max-width: 48rem;
    margin: 0 auto;
    line-height: 1.6;
  }
  h1 {
    margin-bottom: 1.5rem;
  }
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid rgba(127, 127, 127, 0.3);
  }
  .tabs button {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 0.75rem 1rem;
    cursor: pointer;
    color: inherit;
    font: inherit;
  }
  .tabs button:hover {
    border-bottom-color: rgba(127, 127, 127, 0.5);
  }
  .tabs button.active {
    border-bottom-color: currentColor;
    font-weight: 600;
  }
  .meta {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: 0.25rem 1rem;
    margin: 0 0 2rem 0;
    font-size: 0.875rem;
    opacity: 0.7;
  }
  .meta dt {
    font-weight: 600;
  }
  .meta dd {
    margin: 0;
  }
  article section {
    margin: 2rem 0;
  }
  article h3 {
    margin: 0 0 1rem 0;
  }
  p {
    margin: 0 0 1rem 0;
  }
</style>