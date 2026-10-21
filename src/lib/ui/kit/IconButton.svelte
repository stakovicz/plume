<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';

  /** Square icon button. `active` = pressed/selected tool; `quiet` = no background until hover. */
  let { icon, label, active = false, quiet = false, disabled = false, onclick }: {
    icon: IconName; label: string; active?: boolean; quiet?: boolean; disabled?: boolean; onclick: (e: MouseEvent) => void;
  } = $props();
</script>

<button type="button" class:active class:quiet title={label} aria-label={label} aria-pressed={active} {disabled} {onclick}>
  <Icon name={icon} />
</button>

<style>
  button {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: var(--radius-2);
    background: transparent;
    color: var(--text);
  }
  button.quiet {
    width: var(--quiet-button);
    height: var(--quiet-button);
    color: var(--text-2);
  }
  button:hover:not(:disabled) {
    background: var(--hover);
  }
  button.active {
    background: var(--accent-soft);
    color: var(--accent);
  }
  button:disabled {
    opacity: 0.4;
  }
</style>
