<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Label on the left, controls on the right, aligned across rows. `reserve`: keep room for a trailing
   *  small icon button (like the padlock of the row below) so the fields line up. `single`: one numeric
   *  value, so the label gets 2/3 of the width and the value 1/3. */
  let { label, reserve = false, single = false, children }: {
    label?: string; reserve?: boolean; single?: boolean; children: Snippet;
  } = $props();
</script>

<div class="row" class:single>
  <span class="label">{label ?? ''}</span>
  <div class="controls">{@render children()}{#if reserve}<span class="reserve"></span>{/if}</div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: var(--label-w) 1fr;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--control-h);
  }
  .row.single {
    grid-template-columns: 2fr 1fr;
  }
  .label {
    font-size: var(--text-12);
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }
  .controls > :global(*) {
    flex: 1 1 0;
    min-width: 0;
  }
  .controls > :global(button[aria-pressed]),
  .controls > .reserve {
    flex: none;
  }
  .reserve {
    width: var(--quiet-button);
  }
</style>
