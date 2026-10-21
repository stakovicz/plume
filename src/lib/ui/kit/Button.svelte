<script lang="ts">
  import type { Snippet } from 'svelte';

  /** `primary`: the default action of a dialog (accent background). */
  let { onclick, disabled = false, primary = false, children }: { onclick: () => void; disabled?: boolean; primary?: boolean; children: Snippet } = $props();
</script>

<button type="button" class:primary {disabled} {onclick}>{@render children()}</button>

<style>
  button {
    height: var(--control-h);
    padding: 0 var(--space-3);
    border: var(--hairline) solid var(--border-strong);
    border-radius: var(--radius-2);
    background: var(--field);
    font-size: var(--text-12);
  }
  button:hover:not(:disabled) {
    background: var(--hover);
  }
  button:active:not(:disabled) {
    background: var(--accent-soft);
  }
  button.primary {
    border-color: transparent;
    background: var(--accent);
    color: var(--on-accent);
  }
  button.primary:hover:not(:disabled),
  button.primary:active:not(:disabled) {
    background: var(--accent);
    filter: brightness(1.1);
  }
  button:disabled {
    opacity: 0.4;
  }
</style>
