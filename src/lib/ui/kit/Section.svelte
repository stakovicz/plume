<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Inspector section: small caps title (with `action`, e.g. an on/off toggle, at its right), then rows. */
  let { title, action, children }: { title?: string; action?: Snippet; children?: Snippet } = $props();
</script>

<section>
  {#if title}<header><h3>{title}</h3>{@render action?.()}</header>{/if}
  {@render children?.()}
</section>

<style>
  section {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border-bottom: var(--hairline) solid var(--border);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h3 {
    margin: 0;
    font-size: var(--text-11);
    font-weight: 600;
    color: var(--text-2);
  }
</style>
