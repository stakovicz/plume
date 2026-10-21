<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Inspector section: small caps title, then rows. */
  let { title, children }: { title?: string; children: Snippet } = $props();
</script>

<section>
  {#if title}<h3>{title}</h3>{/if}
  {@render children()}
</section>

<style>
  section {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border-bottom: var(--hairline) solid var(--border);
  }
  h3 {
    margin: 0;
    font-size: var(--text-11);
    font-weight: 600;
    color: var(--text-2);
  }
</style>
