<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Modal sheet (native <dialog>): title, content, buttons bottom right. Escape closes it (`onclose`). */
  let { open, title, onclose, children, actions }: {
    open: boolean; title: string; onclose: () => void; children: Snippet; actions: Snippet;
  } = $props();

  let el: HTMLDialogElement;
  $effect(() => {
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  });
</script>

<dialog bind:this={el} aria-label={title} {onclose}>
  <h2>{title}</h2>
  {@render children()}
  <footer>{@render actions()}</footer>
</dialog>

<style>
  dialog {
    /* WebKit (Tauri) stretches the dialog over its UA `inset: 0` and the grid spreads its rows apart: size it to its content */
    height: max-content;
    align-content: start;
    width: 340px;
    padding: var(--space-4);
    border: none;
    border-radius: var(--radius-2);
    background: var(--panel);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  dialog[open] {
    display: grid;
    gap: var(--space-3);
  }
  dialog::backdrop {
    background: var(--backdrop);
  }
  h2 {
    margin: 0;
    font-size: var(--text-13);
    font-weight: 600;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
