<script lang="ts" generics="T extends string">
  import Icon, { type IconName } from './Icon.svelte';

  /** One-of-N picker (macOS segmented control). With `icon`, a segment shows it and `title` is its tooltip. */
  let { value, options, onchange, label, disabled = false }: {
    value: T; options: { value: T; title: string; icon?: IconName }[]; onchange: (v: T) => void; label: string; disabled?: boolean;
  } = $props();
</script>

<div role="radiogroup" aria-label={label} class:disabled>
  {#each options as o (o.value)}
    <button type="button" role="radio" aria-checked={o.value === value} {disabled} onclick={() => onchange(o.value)}
      title={o.icon && o.title} aria-label={o.icon && o.title}>
      {#if o.icon}<Icon name={o.icon} />{:else}{o.title}{/if}
    </button>
  {/each}
</div>

<style>
  div {
    display: flex;
    height: var(--control-h);
    padding: var(--hairline);
    border-radius: var(--radius-2);
    background: var(--hover);
  }
  div.disabled {
    opacity: 0.5;
  }
  button {
    flex: 1;
    min-width: 0;
    padding: 0 var(--space-1);
    border: none;
    border-radius: var(--radius-1);
    background: none;
    font-size: var(--text-11);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button :global(svg) {
    vertical-align: middle;
  }
  button[aria-checked='true'] {
    background: var(--field);
    box-shadow: 0 0 0 var(--hairline) var(--border);
  }
</style>
