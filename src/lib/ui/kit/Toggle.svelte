<script lang="ts">
  /** On/off checkbox, placed on a section's title line (Section `action`): the title names it, `label` is for assistive tech. */
  let { checked, onchange, label, disabled = false }: {
    checked: boolean; onchange: (v: boolean) => void; label: string; disabled?: boolean;
  } = $props();
</script>

<input type="checkbox" aria-label={label} {checked} {disabled} onchange={(e) => onchange(e.currentTarget.checked)} />

<style>
  input {
    margin: 0;
    accent-color: var(--accent);
  }
  input:disabled {
    opacity: 0.5;
  }
</style>
